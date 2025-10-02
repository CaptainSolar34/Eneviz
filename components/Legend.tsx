import { Card } from "@/components/ui/card";

import { computeQuantiles } from "@/lib/geo";

type LegendProps = {
  mode: "points" | "iris";
  values: number[];
};

export function Legend({ mode, values }: LegendProps) {
  const quantiles = computeQuantiles(values);
  return (
    <Card className="space-y-3 bg-white/90 text-sm dark:bg-slate-900/90">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold">Légende</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {mode === "points"
            ? "Taille et couleur des bulles proportionnelles à la consommation agrégée (MWh)."
            : "Couleurs par quantiles de consommation (MWh/PDL)."}
        </p>
      </div>
      <div className="flex flex-col gap-1">
        {quantiles.colors.map((color, index) => {
          const min = index === 0 ? 0 : Math.round(quantiles.thresholds[index - 1] ?? 0);
          const max = Math.round(quantiles.thresholds[index] ?? quantiles.thresholds[quantiles.thresholds.length - 1] ?? 0);
          return (
            <div key={color} className="flex items-center gap-2">
              <span className="inline-flex h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-xs text-slate-600 dark:text-slate-300">
                {min.toLocaleString("fr-FR")}
                {" - "}
                {max.toLocaleString("fr-FR")}
              </span>
            </div>
          );
        })}
      </div>
      <p className="text-[11px] leading-relaxed text-slate-400">
        Visualisation non contractuelle – Source : Enedis & ODRÉ. Données agrégées pour garantir la confidentialité des PDL.
      </p>
    </Card>
  );
}
