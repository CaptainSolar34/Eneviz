"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import { Feature, FeatureCollection } from "geojson";
import maplibregl, { Map } from "maplibre-gl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import Supercluster from "supercluster";

import { computeQuantiles, createCsvFromFeatures, geometryToBbox, clampBbox } from "@/lib/geo";

export type MapDataset = "residential" | "business";
export type MapMode = "points" | "iris";

export type MapDataExport = {
  features: FeatureCollection;
  raw: any[];
};

type MapViewProps = {
  dataset: MapDataset;
  mode: MapMode;
  year: number;
  minConsumption?: number;
  maxConsumption?: number;
  commune?: string;
  search?: string;
  segment?: string;
  mapStyle: string;
  onBoundsChange?: (bbox: string) => void;
  onDataReady?: (data: MapDataExport) => void;
  focusGeometry?: unknown;
};

type ApiResponse = {
  dataset: MapDataset | "iris";
  total: number;
  results: Array<{ id: string; geometry: any; fields: Record<string, unknown> }>;
};

const fetcher = (url: string) => fetch(url).then((response) => response.json() as Promise<ApiResponse>);

const EMPTY: FeatureCollection = { type: "FeatureCollection", features: [] };

export function MapView({
  dataset,
  mode,
  year,
  minConsumption,
  maxConsumption,
  commune,
  search,
  segment,
  mapStyle,
  onBoundsChange,
  onDataReady,
  focusGeometry,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const [bbox, setBbox] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;
    const initialState = {
      center: [2.454071, 46.279229],
      zoom: 5,
    };
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: mapStyle,
      center: initialState.center,
      zoom: initialState.zoom,
      attributionControl: true,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }));
    map.addControl(new maplibregl.FullscreenControl());
    map.addControl(
      new maplibregl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: false,
        showUserLocation: true,
      }),
    );
    map.on("load", () => {
      setLoaded(true);
      updateBounds(map);
    });
    map.on("moveend", () => updateBounds(map));
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [mapStyle]);

  const updateBounds = useCallback(
    (map: Map) => {
      const bounds = map.getBounds();
      const bboxValue = clampBbox([
        [bounds.getWest(), bounds.getSouth()],
        [bounds.getEast(), bounds.getNorth()],
      ]);
      setBbox(bboxValue);
      onBoundsChange?.(bboxValue);
    },
    [onBoundsChange],
  );

  useEffect(() => {
    if (!focusGeometry || !mapRef.current) return;
    const bounds = geometryToBbox(focusGeometry);
    if (bounds) {
      mapRef.current.fitBounds(bounds as any, { padding: 40, maxZoom: 16, duration: 1000 });
    }
  }, [focusGeometry]);

  const queryKey = useMemo(() => {
    if (!bbox) return null;
    const params = new URLSearchParams();
    params.set("year", String(year));
    params.set("bbox", bbox);
    if (minConsumption !== undefined) params.set("minConsumption", String(minConsumption));
    if (maxConsumption !== undefined) params.set("maxConsumption", String(maxConsumption));
    if (commune) params.set("commune", commune);
    if (search) params.set("search", search);
    if (segment) params.set("segment", segment);
    if (mode === "iris") params.set("perPdl", "true");
    return `/api/enedis/${mode === "iris" ? "iris" : dataset}?${params.toString()}`;
  }, [bbox, year, minConsumption, maxConsumption, commune, search, segment, mode, dataset]);

  const { data, error, isLoading } = useSWR(queryKey, fetcher, {
    revalidateOnFocus: false,
    keepPreviousData: true,
  });

  const pointFeatures = useMemo(() => {
    if (!data || mode !== "points") return EMPTY;
    const features: Feature[] = [];
    for (const item of data.results) {
      const geometry = toPointGeometry(item.geometry ?? item.fields?.geometry);
      if (!geometry) continue;
      const props = {
        ...item.fields,
        id: item.id,
      };
      const conso = Number(props.conso_mwh ?? props.consommation ?? props.mwh ?? props.valeur ?? props.indicateur ?? 0);
      const pdl = Number(
        props.nb_pdl ?? props.nb_logements ?? props.nombre_pdl ?? props.total_sites ?? props.nb_sites ?? 0,
      );
      features.push({
        type: "Feature",
        geometry,
        properties: {
          ...props,
          conso,
          pdl,
        },
      });
    }
    return { type: "FeatureCollection", features } as FeatureCollection;
  }, [data, mode]);

  const clusterIndex = useMemo(() => {
    if (pointFeatures.features.length === 0) return null;
    const index = new Supercluster<{ conso: number; total: number }>({
      radius: 80,
      maxZoom: 18,
      map: (properties) => ({
        conso: Number(properties.conso ?? 0),
        total: Number(properties.pdl ?? properties.nb_pdl ?? properties.total_sites ?? 1),
      }),
      reduce: (accumulated, properties) => {
        accumulated.conso = (accumulated.conso ?? 0) + (properties.conso ?? 0);
        accumulated.total = (accumulated.total ?? 0) + (properties.total ?? 0);
      },
    });
    index.load(pointFeatures.features as any);
    return index;
  }, [pointFeatures]);

  const [clusterFeatures, setClusterFeatures] = useState<FeatureCollection>(EMPTY);

  useEffect(() => {
    if (!clusterIndex || !mapRef.current) return;
    const map = mapRef.current;
    const refresh = () => {
      const bounds = map.getBounds();
      const zoom = map.getZoom();
      const clusters = clusterIndex.getClusters([
        bounds.getWest(),
        bounds.getSouth(),
        bounds.getEast(),
        bounds.getNorth(),
      ], Math.round(zoom));
      const features: Feature[] = clusters.map((cluster) => ({
        type: "Feature",
        geometry: cluster.geometry as any,
        properties: cluster.properties as Record<string, unknown>,
        id: (cluster as any).id ?? cluster.properties?.cluster_id,
      }));
      setClusterFeatures({ type: "FeatureCollection", features });
    };
    refresh();
    map.on("move", refresh);
    map.on("moveend", refresh);
    return () => {
      map.off("move", refresh);
      map.off("moveend", refresh);
    };
  }, [clusterIndex]);

  useEffect(() => {
    if (!loaded || !mapRef.current) return;
    const map = mapRef.current;
    if (!map.getSource("points")) {
      map.addSource("points", {
        type: "geojson",
        data: clusterFeatures,
      });
      map.addLayer({
        id: "clusters",
        type: "circle",
        source: "points",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": [
            "step",
            ["get", "conso"],
            "#e0f2fe",
            500,
            "#7dd3fc",
            2000,
            "#1d4ed8",
            10000,
            "#0f172a",
          ],
          "circle-radius": ["interpolate", ["linear"], ["get", "point_count"], 1, 18, 200, 40],
          "circle-opacity": 0.8,
        },
      });
      map.addLayer({
        id: "cluster-count",
        type: "symbol",
        source: "points",
        filter: ["has", "point_count"],
        layout: {
          "text-field": ["to-string", ["get", "point_count"]],
          "text-size": 12,
        },
        paint: {
          "text-color": "#0f172a",
        },
      });
      map.addLayer({
        id: "unclustered-point",
        type: "circle",
        source: "points",
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": "#1d4ed8",
          "circle-opacity": 0.85,
          "circle-radius": 8,
          "circle-stroke-color": "white",
          "circle-stroke-width": 1,
        },
      });
      map.on("click", "clusters", (event) => {
        const feature = event.features?.[0];
        if (!feature) return;
        const clusterId = feature.properties?.cluster_id;
        if (clusterId === undefined || !clusterIndex) return;
        const expansionZoom = Math.min(clusterIndex.getClusterExpansionZoom(clusterId), 18);
        map.easeTo({ center: feature.geometry.coordinates as [number, number], zoom: expansionZoom });
      });
      map.on("click", "unclustered-point", (event) => {
        const feature = event.features?.[0];
        if (!feature) return;
        const properties = feature.properties ?? {};
        const content = popupContent(properties);
        new maplibregl.Popup({ closeButton: true })
          .setLngLat(feature.geometry.coordinates as [number, number])
          .setHTML(content)
          .addTo(map);
      });
      map.on("mouseenter", "clusters", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "clusters", () => {
        map.getCanvas().style.cursor = "";
      });
    }
    const source = map.getSource("points") as maplibregl.GeoJSONSource;
    source.setData(clusterFeatures);
  }, [clusterFeatures, loaded, clusterIndex]);

  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    const pointVisibility = mode === "points" ? "visible" : "none";
    const irisVisibility = mode === "iris" ? "visible" : "none";
    ["clusters", "cluster-count", "unclustered-point"].forEach((layerId) => {
      if (map.getLayer(layerId)) {
        map.setLayoutProperty(layerId, "visibility", pointVisibility);
      }
    });
    ["iris-fill", "iris-outline"].forEach((layerId) => {
      if (map.getLayer(layerId)) {
        map.setLayoutProperty(layerId, "visibility", irisVisibility);
      }
    });
  }, [mode]);

  const irisFeatures = useMemo(() => {
    if (!data || mode !== "iris") return EMPTY;
    const features: Feature[] = [];
    for (const item of data.results) {
      const geometry = item.geometry;
      if (!geometry) continue;
      const props = {
        ...item.fields,
        id: item.id,
      };
      const indicateur = Number(props.indicateur ?? props.mwh_total ?? props.valeur ?? 0);
      features.push({
        type: "Feature",
        geometry,
        properties: {
          ...props,
          indicateur,
        },
      });
    }
    return { type: "FeatureCollection", features } as FeatureCollection;
  }, [data, mode]);

  useEffect(() => {
    if (!loaded || !mapRef.current || mode !== "iris") {
      if (mapRef.current && mapRef.current.getSource("iris")) {
        (mapRef.current.getSource("iris") as maplibregl.GeoJSONSource).setData({ type: "FeatureCollection", features: [] });
      }
      return;
    }
    const map = mapRef.current;
    const values = irisFeatures.features.map((feature) => Number(feature.properties?.indicateur ?? 0));
    const quantiles = computeQuantiles(values);
    if (!map.getSource("iris")) {
      map.addSource("iris", {
        type: "geojson",
        data: irisFeatures,
      });
      map.addLayer({
        id: "iris-fill",
        type: "fill",
        source: "iris",
        paint: {
          "fill-color": [
            "case",
            ["has", "indicateur"],
            [
              "step",
              ["to-number", ["get", "indicateur"]],
              quantiles.colors[0] ?? "#e2e8f0",
              quantiles.thresholds[0] ?? 0,
              quantiles.colors[1] ?? "#cbd5f5",
              quantiles.thresholds[1] ?? 0,
              quantiles.colors[2] ?? "#94a3ff",
              quantiles.thresholds[2] ?? 0,
              quantiles.colors[3] ?? "#6474ff",
              quantiles.thresholds[3] ?? 0,
              quantiles.colors[4] ?? "#3b5bdb",
            ],
            "#cbd5f5",
          ],
          "fill-opacity": 0.75,
        },
      });
      map.addLayer({
        id: "iris-outline",
        type: "line",
        source: "iris",
        paint: {
          "line-color": "#1e293b",
          "line-width": 0.5,
          "line-opacity": 0.5,
        },
      });
      map.on("mousemove", "iris-fill", (event) => {
        const feature = event.features?.[0];
        map.getCanvas().style.cursor = feature ? "pointer" : "";
      });
      map.on("click", "iris-fill", (event) => {
        const feature = event.features?.[0];
        if (!feature) return;
        const props = feature.properties ?? {};
        const html = `
          <div class="space-y-1">
            <div class="text-sm font-semibold">${props.libelle_commune ?? "IRIS"}</div>
            <div class="text-xs text-slate-500">IRIS ${props.code_iris ?? ""}</div>
            <div class="text-sm">${Number(props.mwh_total ?? props.indicateur ?? 0).toLocaleString("fr-FR")} MWh</div>
            ${props.total_sites ? `<div class="text-xs text-slate-500">${props.total_sites} sites agrégés</div>` : ""}
          </div>`;
        new maplibregl.Popup({ closeButton: true })
          .setLngLat(event.lngLat)
          .setHTML(html)
          .addTo(map);
      });
    }
    const source = map.getSource("iris") as maplibregl.GeoJSONSource;
    source.setData(irisFeatures);
  }, [irisFeatures, loaded, mode]);

  useEffect(() => {
    if (onDataReady) {
      const features = mode === "iris" ? irisFeatures : pointFeatures;
      onDataReady({
        features,
        raw: data?.results ?? [],
      });
    }
  }, [pointFeatures, irisFeatures, data, onDataReady, mode]);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" aria-label="Carte des consommations" role="region" />
      {error && (
        <div className="absolute left-4 top-4 max-w-xs rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800 shadow-lg">
          Erreur de chargement des données. Merci de réessayer.
        </div>
      )}
      {isLoading && (
        <div className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 rounded-full bg-white/80 px-4 py-1 text-sm text-slate-600 shadow">
          Chargement…
        </div>
      )}
    </div>
  );
}

function popupContent(properties: Record<string, unknown>) {
  const year = properties.annee ?? properties.year ?? "";
  const address = properties.adresse ?? properties.libelle_adresse ?? properties.nom_voie ?? "Adresse";
  const commune = properties.libelle_commune ?? properties.commune ?? "";
  const conso = Number(properties.conso ?? properties.conso_mwh ?? properties.mwh ?? properties.valeur ?? 0);
  const pdl = properties.nb_pdl ?? properties.nb_logements ?? properties.total_sites;
  return `
    <div class="space-y-1">
      <div class="text-xs uppercase tracking-wide text-slate-500">${year}</div>
      <div class="text-sm font-semibold">${address}</div>
      <div class="text-xs text-slate-500">${commune}</div>
      <div class="text-sm">${conso.toLocaleString("fr-FR")} MWh</div>
      ${pdl ? `<div class="text-xs text-slate-500">${pdl} PDL agrégés</div>` : ""}
    </div>
  `;
}

export function exportFeaturesToCsv(features: FeatureCollection) {
  return createCsvFromFeatures(features);
}

function toPointGeometry(input: any): { type: "Point"; coordinates: [number, number] } | null {
  if (!input) return null;
  if (input.type === "Point" && Array.isArray(input.coordinates)) {
    return { type: "Point", coordinates: [Number(input.coordinates[0]), Number(input.coordinates[1])] };
  }
  if (Array.isArray(input) && input.length >= 2) {
    return { type: "Point", coordinates: [Number(input[0]), Number(input[1])] };
  }
  if (typeof input === "object") {
    const lon = input.lon ?? input.lng ?? input.longitude ?? input.x;
    const lat = input.lat ?? input.latitude ?? input.y;
    if (typeof lon === "number" && typeof lat === "number") {
      return { type: "Point", coordinates: [lon, lat] };
    }
  }
  return null;
}
