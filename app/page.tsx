"use client";

import { useEffect, useMemo, useState } from "react";

import { AboutData } from "@/components/AboutData";
import { Filters, type Suggestion } from "@/components/Filters";
import { Legend } from "@/components/Legend";
import { MapView, type MapDataExport, type MapDataset, type MapMode, exportFeaturesToCsv } from "@/components/MapView";
import { Toolbar } from "@/components/Toolbar";

const MIN_YEAR = 2018;
const CURRENT_YEAR = new Date().getFullYear() - 1;

const DEFAULT_STYLE =
  typeof process !== "undefined" && process.env.NEXT_PUBLIC_MAPTILER_API_KEY
    ? `https://api.maptiler.com/maps/streets/style.json?key=${process.env.NEXT_PUBLIC_MAPTILER_API_KEY}`
    : "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";

export default function HomePage() {
  const [dataset, setDataset] = useState<MapDataset>("residential");
  const [mode, setMode] = useState<MapMode>("points");
  const [year, setYear] = useState(CURRENT_YEAR);
  const [playing, setPlaying] = useState(false);
  const [minConsumption, setMinConsumption] = useState<number | undefined>();
  const [maxConsumption, setMaxConsumption] = useState<number | undefined>();
  const [commune, setCommune] = useState("");
  const [search, setSearch] = useState("");
  const [segment, setSegment] = useState<string | undefined>();
  const [availableSegments, setAvailableSegments] = useState<string[]>([]);
  const [mapData, setMapData] = useState<MapDataExport>({ features: { type: "FeatureCollection", features: [] }, raw: [] });
  const [focusGeometry, setFocusGeometry] = useState<unknown>();
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    if (!playing) return;
    const interval = setInterval(() => {
      setYear((current) => {
        if (current >= CURRENT_YEAR) {
          return MIN_YEAR;
        }
        return current + 1;
      });
    }, 2500);
    return () => clearInterval(interval);
  }, [playing]);

  const legendValues = useMemo(() => {
    if (mode === "iris") {
      return mapData.features.features.map((feature) => Number(feature.properties?.indicateur ?? feature.properties?.mwh_total ?? 0));
    }
    return mapData.features.features.map((feature) => Number(feature.properties?.conso ?? feature.properties?.mwh ?? feature.properties?.valeur ?? 0));
  }, [mode, mapData]);

  useEffect(() => {
    if (mapData.raw.length === 0) return;
    const first = mapData.raw[0]?.fields ?? {};
    const segmentKey = Object.keys(first).find((key) => key.toLowerCase().includes("segment") || key.toLowerCase().includes("secteur"));
    if (!segmentKey) {
      setAvailableSegments([]);
      return;
    }
    const values = new Set<string>();
    for (const item of mapData.raw) {
      const value = item.fields?.[segmentKey];
      if (typeof value === "string" && value.trim()) {
        values.add(value.trim());
      }
    }
    setAvailableSegments(Array.from(values).sort((a, b) => a.localeCompare(b, "fr")));
  }, [mapData]);

  const handleSuggestionSelected = (suggestion: Suggestion) => {
    setSearch(suggestion.label);
    if (suggestion.commune) {
      setCommune(suggestion.commune);
    }
    setFocusGeometry(suggestion.geometry);
  };

  const handleExport = (format: "csv" | "geojson") => {
    if (!mapData.features.features.length) return;
    if (format === "csv") {
      const csv = exportFeaturesToCsv(mapData.features);
      downloadBlob(csv, `eneviz-${mode}-${dataset}-${year}.csv`, "text/csv;charset=utf-8");
    } else {
      const content = JSON.stringify(mapData.features);
      downloadBlob(content, `eneviz-${mode}-${dataset}-${year}.geojson`, "application/geo+json");
    }
  };

  return (
    <div className="flex h-screen flex-col bg-slate-100 dark:bg-slate-950">
      <Toolbar
        mode={mode}
        dataset={dataset}
        onModeChange={(value) => {
          setMode(value);
          setPlaying(false);
        }}
        onDatasetChange={(value) => {
          setDataset(value);
          setSegment(undefined);
        }}
        onExport={handleExport}
        onOpenHelp={() => setHelpOpen(true)}
      />
      <div className="flex flex-1 overflow-hidden">
        <Filters
          year={year}
          minYear={MIN_YEAR}
          maxYear={CURRENT_YEAR}
          onYearChange={(value) => {
            setYear(value);
            setPlaying(false);
          }}
          playing={playing}
          onTogglePlay={() => setPlaying((value) => !value)}
          minConsumption={minConsumption}
          maxConsumption={maxConsumption}
          onMinConsumptionChange={setMinConsumption}
          onMaxConsumptionChange={setMaxConsumption}
          commune={commune}
          onCommuneChange={setCommune}
          search={search}
          onSearchChange={setSearch}
          onSuggestionSelected={handleSuggestionSelected}
          dataset={dataset}
          segment={segment}
          onSegmentChange={setSegment}
          segments={availableSegments}
        />
        <div className="relative flex flex-1 flex-col">
          <div className="relative flex-1">
            <MapView
              dataset={dataset}
              mode={mode}
              year={year}
              minConsumption={minConsumption}
              maxConsumption={maxConsumption}
              commune={commune}
              search={search}
              segment={segment}
              mapStyle={DEFAULT_STYLE}
              onDataReady={setMapData}
              focusGeometry={focusGeometry}
            />
            <div className="pointer-events-none absolute bottom-4 left-4 flex max-w-sm flex-col gap-3">
              <Legend mode={mode} values={legendValues} />
              <AboutData />
            </div>
          </div>
        </div>
      </div>
      {helpOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="max-w-2xl space-y-4 rounded-2xl bg-white p-6 text-sm shadow-xl dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Aide & mentions</h2>
              <button type="button" className="text-xl" onClick={() => setHelpOpen(false)}>
                ×
              </button>
            </div>
            <p>
              Cette visualisation exploite les API ouvertes d'Enedis (ODRÉ). Déplacez la carte pour charger les données dans
              l'emprise courante, utilisez les filtres à gauche pour affiner la sélection et changez de mode pour basculer entre
              points d'adresses et agrégation IRIS.
            </p>
            <ul className="list-disc space-y-1 pl-5 text-xs text-slate-500">
              <li>Les exports CSV et GeoJSON reflètent les filtres actifs et les données actuellement visibles.</li>
              <li>Les points agrègent les PDL pour préserver l'anonymat : aucune donnée individuelle n'est exposée.</li>
              <li>Les consommations sont exprimées en MWh annuels, millésimes disponibles depuis 2018.</li>
            </ul>
            <div className="text-right text-xs text-slate-500">
              Source : Enedis & ODRÉ – mise à jour {new Date().getFullYear()}.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function downloadBlob(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
