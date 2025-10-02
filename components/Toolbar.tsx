"use client";

import { Button } from "@/components/ui/button";

import { ThemeToggle } from "./ThemeToggle";

type Mode = "points" | "iris";
type Dataset = "residential" | "business";

type ToolbarProps = {
  mode: Mode;
  onModeChange: (mode: Mode) => void;
  dataset: Dataset;
  onDatasetChange: (dataset: Dataset) => void;
  onExport: (format: "csv" | "geojson") => void;
  onOpenHelp: () => void;
};

export function Toolbar({ mode, onModeChange, dataset, onDatasetChange, onExport, onOpenHelp }: ToolbarProps) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white/80 px-4 py-2 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
      <div className="flex items-center gap-2">
        <span className="text-base font-semibold">Eneviz</span>
        <span className="text-xs uppercase tracking-wide text-slate-500">beta</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center rounded-full border border-slate-200 bg-white p-1 text-sm shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <Button
            type="button"
            variant={dataset === "residential" ? "primary" : "ghost"}
            size="sm"
            className="rounded-full"
            onClick={() => onDatasetChange("residential")}
          >
            Résidentiel
          </Button>
          <Button
            type="button"
            variant={dataset === "business" ? "primary" : "ghost"}
            size="sm"
            className="rounded-full"
            onClick={() => onDatasetChange("business")}
          >
            Entreprises
          </Button>
        </div>
        <div className="flex items-center rounded-full border border-slate-200 bg-white p-1 text-sm shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <Button
            type="button"
            variant={mode === "points" ? "primary" : "ghost"}
            size="sm"
            className="rounded-full"
            onClick={() => onModeChange("points")}
          >
            Points
          </Button>
          <Button
            type="button"
            variant={mode === "iris" ? "primary" : "ghost"}
            size="sm"
            className="rounded-full"
            onClick={() => onModeChange("iris")}
          >
            IRIS
          </Button>
        </div>
        <div className="flex items-center gap-1">
          <Button type="button" variant="outline" size="sm" onClick={() => onExport("csv")}>
            Export CSV
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => onExport("geojson")}>
            Export GeoJSON
          </Button>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={onOpenHelp}>
          Aide
        </Button>
        <ThemeToggle />
      </div>
    </header>
  );
}
