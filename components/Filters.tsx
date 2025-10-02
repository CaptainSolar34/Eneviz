"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export type Suggestion = {
  id: string;
  label: string;
  commune: string | null;
  geometry: unknown;
};

type FiltersProps = {
  year: number;
  minYear: number;
  maxYear: number;
  onYearChange: (year: number) => void;
  playing: boolean;
  onTogglePlay: () => void;
  minConsumption?: number;
  maxConsumption?: number;
  onMinConsumptionChange: (value?: number) => void;
  onMaxConsumptionChange: (value?: number) => void;
  commune?: string;
  onCommuneChange: (value: string) => void;
  search: string;
  onSearchChange: (value: string) => void;
  onSuggestionSelected: (suggestion: Suggestion) => void;
  dataset: "residential" | "business";
  segment?: string;
  onSegmentChange: (value?: string) => void;
  segments?: string[];
};

export function Filters({
  year,
  minYear,
  maxYear,
  onYearChange,
  playing,
  onTogglePlay,
  minConsumption,
  maxConsumption,
  onMinConsumptionChange,
  onMaxConsumptionChange,
  commune,
  onCommuneChange,
  search,
  onSearchChange,
  onSuggestionSelected,
  dataset,
  segment,
  onSegmentChange,
  segments = [],
}: FiltersProps) {
  const [query, setQuery] = useState(search);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loadingSuggest, setLoadingSuggest] = useState(false);

  useEffect(() => {
    setQuery(search);
  }, [search]);

  useEffect(() => {
    if (!query || query.length < 3) {
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    const controller = new AbortController();
    async function run() {
      try {
        setLoadingSuggest(true);
        const url = new URL("/api/enedis/suggest", window.location.origin);
        url.searchParams.set("q", query);
        url.searchParams.set("dataset", dataset);
        url.searchParams.set("year", String(year));
        const response = await fetch(url.toString(), { signal: controller.signal });
        if (!response.ok) return;
        const json = (await response.json()) as { suggestions: Suggestion[] };
        if (!cancelled) {
          setSuggestions(json.suggestions);
        }
      } catch (error) {
        if (!cancelled) {
          console.warn("suggestion error", error);
        }
      } finally {
        if (!cancelled) setLoadingSuggest(false);
      }
    }
    run();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [query, dataset, year]);

  const minLabel = useMemo(() => (minConsumption !== undefined ? `${minConsumption.toLocaleString("fr-FR")} MWh` : "Min"), [
    minConsumption,
  ]);
  const maxLabel = useMemo(() => (maxConsumption !== undefined ? `${maxConsumption.toLocaleString("fr-FR")} MWh` : "Max"), [
    maxConsumption,
  ]);

  return (
    <aside className="flex w-full max-w-sm flex-col gap-4 overflow-y-auto border-r border-slate-200 bg-white/70 p-4 backdrop-blur dark:border-slate-800 dark:bg-slate-900/70">
      <Card className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Année</h2>
          <Button type="button" variant="ghost" size="sm" onClick={onTogglePlay}>
            {playing ? "Pause" : "Lecture"}
          </Button>
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-sm text-slate-500">
            <span>{minYear}</span>
            <span>{maxYear}</span>
          </div>
          <input
            type="range"
            min={minYear}
            max={maxYear}
            value={year}
            onChange={(event) => onYearChange(Number.parseInt(event.target.value, 10))}
          />
          <div className="text-right text-sm font-medium">{year}</div>
        </div>
      </Card>

      <Card className="space-y-3">
        <h2 className="text-base font-semibold">Filtres</h2>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-500">Min consommation (MWh)</span>
          <input
            type="number"
            inputMode="decimal"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/40 dark:border-slate-700 dark:bg-slate-900"
            placeholder="Aucune"
            value={minConsumption ?? ""}
            onChange={(event) => onMinConsumptionChange(event.target.value ? Number(event.target.value) : undefined)}
          />
          <span className="text-xs text-slate-400">{minLabel}</span>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-500">Max consommation (MWh)</span>
          <input
            type="number"
            inputMode="decimal"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/40 dark:border-slate-700 dark:bg-slate-900"
            placeholder="Aucune"
            value={maxConsumption ?? ""}
            onChange={(event) => onMaxConsumptionChange(event.target.value ? Number(event.target.value) : undefined)}
          />
          <span className="text-xs text-slate-400">{maxLabel}</span>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-500">Commune / Code INSEE</span>
          <input
            type="text"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/40 dark:border-slate-700 dark:bg-slate-900"
            value={commune ?? ""}
            onChange={(event) => onCommuneChange(event.target.value)}
            placeholder="Ex. Montpellier"
          />
        </label>
        <div className="space-y-1">
          <label htmlFor="segment" className="text-sm text-slate-500">
            Segment
          </label>
          <select
            id="segment"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/40 dark:border-slate-700 dark:bg-slate-900"
            value={segment ?? ""}
            onChange={(event) => onSegmentChange(event.target.value || undefined)}
          >
            <option value="">Tous les segments</option>
            {segments.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
      </Card>

      <Card className="space-y-3">
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-600">Recherche</label>
          <input
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              onSearchChange(event.target.value);
            }}
            placeholder="Adresse, commune, code INSEE"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/40 dark:border-slate-700 dark:bg-slate-900"
          />
        </div>
        <div className="max-h-48 overflow-y-auto rounded-md border border-slate-200 dark:border-slate-800">
          {loadingSuggest ? (
            <div className="p-3">
              <Skeleton className="h-3 w-full" />
            </div>
          ) : suggestions.length === 0 ? (
            <p className="p-3 text-xs text-slate-500">Aucun résultat pour l'instant.</p>
          ) : (
            <ul className="divide-y divide-slate-200 text-sm dark:divide-slate-800">
              {suggestions.map((suggestion) => (
                <li key={suggestion.id}>
                  <button
                    type="button"
                    onClick={() => onSuggestionSelected(suggestion)}
                    className="flex w-full flex-col items-start gap-1 px-3 py-2 text-left hover:bg-brand-50 focus:bg-brand-100 focus:outline-none dark:hover:bg-slate-800"
                  >
                    <span className="font-medium">{suggestion.label}</span>
                    {suggestion.commune && <span className="text-xs text-slate-500">{suggestion.commune}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>

      <Card className="space-y-3">
        <h2 className="text-base font-semibold">À propos</h2>
        <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
          Les jeux de données agrègent les points de livraison (PDL) pour respecter les seuils de confidentialité : au moins 10
          logements pour le résidentiel et une puissance souscrite supérieure à 36 kVA pour les entreprises. Les valeurs sont
          exprimées en MWh annuels.
        </p>
      </Card>
    </aside>
  );
}
