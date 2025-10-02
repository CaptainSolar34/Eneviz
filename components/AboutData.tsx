import { Card } from "@/components/ui/card";

export function AboutData() {
  return (
    <Card className="space-y-2 text-sm leading-relaxed">
      <h3 className="text-sm font-semibold">À propos des données</h3>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Les points représentent des agrégats d'adresses comptant au minimum 10 logements (résidentiel) ou des sites d'entreprise
        souscrivant une puissance supérieure à 36 kVA. Les valeurs affichées sont des consommations annuelles en MWh et le nombre
        de PDL agrégés quand il est disponible.
      </p>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Les choroplèthes IRIS reposent sur le dataset « Consommation et thermosensibilité d'électricité à la maille IRIS ». Les
        agrégations sont calculées via l'API Explore v2.1 d'Enedis/ODRÉ et limitées à l'emprise de la carte.
      </p>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Source : Open Data Enedis & ODRÉ – Visualisation non contractuelle. Millésimes disponibles : 2018 à millésime le plus
        récent publié.
      </p>
    </Card>
  );
}
