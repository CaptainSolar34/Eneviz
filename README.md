# Eneviz

Application de cartographie interactive des consommations d'électricité en France basée sur Next.js, Tailwind CSS et MapLibre GL.

## 🚀 Fonctionnalités

- Visualisation des agrégats résidentiels et entreprises via points et clusters.
- Choroplèthe IRIS agrégée côté API (consommation ou MWh/PDL).
- Filtrage spatial dynamique (bbox), filtres annuels, recherche textuelle et filtrage par commune.
- Suggestions d'adresses/communes via l'API Opendatasoft proxifiée.
- Export CSV ou GeoJSON des données visibles.
- Mode sombre, panneau d'aide et légendes dynamiques.

## 📦 Installation

```bash
npm install
```

> L'environnement d'évaluation ne permet pas l'installation automatique des dépendances. Lancez la commande ci-dessus en local pour récupérer Next.js et les bibliothèques utilisées.

## 🔑 Variables d'environnement

Créez un fichier `.env.local` à la racine du projet :

```
NEXT_PUBLIC_MAPTILER_API_KEY=<clé optionnelle>
ENEDIS_BASE_URL=https://data.enedis.fr
ODRE_BASE_URL=https://odre.opendatasoft.com
```

- `NEXT_PUBLIC_MAPTILER_API_KEY` : clé MapTiler (facultatif, un fond libre Carto est utilisé sinon).
- `ENEDIS_BASE_URL` et `ODRE_BASE_URL` : domaines Opendatasoft utilisés pour les datasets Enedis/ODRÉ.

## 🧭 Démarrage

```bash
npm run dev
```

Ensuite ouvrez [http://localhost:3000](http://localhost:3000).

## ✅ Tests

Les utilitaires géospatiaux sont couverts par le runner natif Node.js :

```bash
npm test
```

## 🗂️ Structure principale

- `app/page.tsx` : mise en page principale, états et intégration carte.
- `app/api/enedis/*` : route handlers Next.js servant de proxy vers l'API Explore v2.1 avec validation Zod et mise en cache.
- `components/MapView.tsx` : initialisation MapLibre, clustering Supercluster et choroplèthe IRIS.
- `lib/enedis.ts` : construction des requêtes Opendatasoft avec détection dynamique des champs.
- `lib/geo.ts` : helpers géospatiaux (bbox, quantiles, export CSV).
- `tests/geo.test.ts` : tests unitaires exécutés via `node --test`.

## 🔒 Confidentialité

Les données affichées sont des agrégats (≥10 logements pour le résidentiel, ≥36 kVA pour les entreprises). Aucun PDL individuel n'est exposé. L'encart « À propos des données » rappelle ces limites et les sources officielles.

## 📄 Licence

Projet démonstratif pour usage pédagogique.
