import "server-only";

import { z } from "zod";

const DATASET_SCHEMA_CACHE = new Map<DatasetKey, Promise<DatasetFieldMapping>>();

export const datasetKeys = ["residential", "business", "iris"] as const;
export type DatasetKey = (typeof datasetKeys)[number];

export const datasetDefinitions: Record<DatasetKey, { id: string; baseUrlEnv: "ENEDIS_BASE_URL" | "ODRE_BASE_URL" }> = {
  residential: {
    id: "consommation-annuelle-residentielle-par-adresse",
    baseUrlEnv: "ENEDIS_BASE_URL",
  },
  business: {
    id: "consommation-annuelle-entreprise-par-adresse",
    baseUrlEnv: "ENEDIS_BASE_URL",
  },
  iris: {
    id: "consommation-electrique-par-secteur-dactivite-iris",
    baseUrlEnv: "ODRE_BASE_URL",
  },
};

const metadataSchema = z.object({
  fields: z
    .array(
      z.object({
        name: z.string(),
        type: z.string().optional(),
        label: z.string().optional(),
      }),
    )
    .default([]),
});

export type DatasetFieldMapping = {
  geometryField: string;
  yearField: string;
  consumptionField: string;
  pdlField?: string;
  addressField?: string;
  irisField?: string;
  communeField?: string;
  segmentField?: string;
};

const geometryCandidates = ["geo_point_2d", "geo_shape", "geometry", "geo_point"];
const yearCandidates = ["annee", "year", "date", "millesime"];
const consumptionCandidates = ["conso", "consommation", "mwh", "valeur", "consommation_mwh"];
const pdlCandidates = ["nb_pdl", "nb_pdl_residentiel", "nb_sites", "nombre_pdl", "nb_logements"];
const addressCandidates = ["adresse", "nom_adresse", "libelle_adresse", "nom_voie", "adresse_complete"];
const irisCandidates = ["code_iris", "iris", "id_iris"];
const communeCandidates = ["libelle_commune", "nom_commune", "commune", "code_commune", "code_insee"];
const segmentCandidates = ["segment", "categorie", "secteur", "tranche", "branche"];

const API_VERSION_PATH = "/api/explore/v2.1/catalog/datasets";

function assertEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`La variable d'environnement ${name} est requise`);
  }
  return value;
}

function pickField(fields: { name: string }[], candidates: string[]): string | undefined {
  for (const candidate of candidates) {
    const match = fields.find((field) => field.name.toLowerCase() === candidate);
    if (match) return match.name;
  }
  return fields.find((field) =>
    candidates.some((candidate) => field.name.toLowerCase().includes(candidate)),
  )?.name;
}

export async function fetchDatasetSchema(dataset: DatasetKey): Promise<DatasetFieldMapping> {
  if (!DATASET_SCHEMA_CACHE.has(dataset)) {
    DATASET_SCHEMA_CACHE.set(dataset, loadDatasetSchema(dataset));
  }
  return DATASET_SCHEMA_CACHE.get(dataset)!;
}

async function loadDatasetSchema(dataset: DatasetKey): Promise<DatasetFieldMapping> {
  const definition = datasetDefinitions[dataset];
  const baseUrl = assertEnv(definition.baseUrlEnv);
  const url = new URL(`${baseUrl}${API_VERSION_PATH}/${definition.id}`);
  url.searchParams.set("limit", "1");
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
    },
    next: { revalidate: 60 * 60 },
  });
  if (!response.ok) {
    throw new Error(`Impossible de charger le schéma du jeu ${definition.id}`);
  }
  const json = metadataSchema.parse(await response.json());
  const fields = json.fields;
  const geometryField = pickField(fields, geometryCandidates);
  const yearField = pickField(fields, yearCandidates);
  const consumptionField = pickField(fields, consumptionCandidates);
  if (!geometryField || !yearField || !consumptionField) {
    throw new Error(`Schéma incomplet pour ${definition.id}`);
  }
  return {
    geometryField,
    yearField,
    consumptionField,
    pdlField: pickField(fields, pdlCandidates),
    addressField: pickField(fields, addressCandidates),
    irisField: pickField(fields, irisCandidates),
    communeField: pickField(fields, communeCandidates),
    segmentField: pickField(fields, segmentCandidates),
  };
}

export type RecordsQuery = {
  dataset: DatasetKey;
  bbox?: string;
  year?: number;
  search?: string;
  limit?: number;
  offset?: number;
  minConsumption?: number;
  maxConsumption?: number;
  commune?: string;
  segment?: string;
  select?: string;
  groupBy?: string;
  orderBy?: string;
  additionalWhere?: string[];
};

export async function buildRecordsUrl(query: RecordsQuery): Promise<URL> {
  const { dataset, bbox, year, search, limit = 1000, offset = 0, minConsumption, maxConsumption, commune, segment, select, groupBy, orderBy, additionalWhere = [] } = query;
  const definition = datasetDefinitions[dataset];
  const baseUrl = assertEnv(definition.baseUrlEnv);
  const { geometryField, yearField, consumptionField, pdlField, addressField, communeField, segmentField } =
    await fetchDatasetSchema(dataset);
  const url = new URL(`${baseUrl}${API_VERSION_PATH}/${definition.id}/records`);
  const whereClauses: string[] = [...additionalWhere];
  if (bbox) {
    whereClauses.push(`within(${geometryField}, bbox([${bbox}]))`);
  }
  if (year) {
    whereClauses.push(`${yearField} = ${year}`);
  }
  if (minConsumption !== undefined) {
    whereClauses.push(`${consumptionField} >= ${minConsumption}`);
  }
  if (maxConsumption !== undefined) {
    whereClauses.push(`${consumptionField} <= ${maxConsumption}`);
  }
  if (commune && communeField) {
    whereClauses.push(`upper(${communeField}) like upper('%25${commune}%25')`);
  }
  if (segment && segmentField) {
    whereClauses.push(`upper(${segmentField}) = upper('${segment.replace(/'/g, "")}')`);
  }
  if (search) {
    const safeSearch = search.replace(/'/g, "");
    const likeClauses: string[] = [];
    if (addressField) {
      likeClauses.push(`upper(${addressField}) like upper('%25${safeSearch}%25')`);
    }
    if (communeField) {
      likeClauses.push(`upper(${communeField}) like upper('%25${safeSearch}%25')`);
    }
    if (likeClauses.length > 0) {
      whereClauses.push(`(${likeClauses.join(" OR ")})`);
    }
  }
  if (whereClauses.length > 0) {
    url.searchParams.set("where", whereClauses.join(" AND "));
  }
  url.searchParams.set("limit", limit.toString());
  url.searchParams.set("offset", offset.toString());
  if (select) {
    url.searchParams.set("select", select);
  }
  if (groupBy) {
    url.searchParams.set("group_by", groupBy);
  }
  if (orderBy) {
    url.searchParams.set("order_by", orderBy);
  }
  url.searchParams.set("timezone", "Europe/Paris");
  return url;
}

export type DatasetRecord = {
  id: string;
  geometry: unknown;
  properties: Record<string, unknown>;
};

const recordSchema = z.object({
  id: z.string(),
  geometry: z.any().nullable(),
  record: z
    .object({
      fields: z.record(z.any()),
    })
    .optional(),
  fields: z.record(z.any()).optional(),
});

const collectionSchema = z.object({
  results: z.array(recordSchema),
  total_count: z.number().optional(),
});

export async function fetchRecords(query: RecordsQuery) {
  const url = await buildRecordsUrl(query);
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
    },
    next: { revalidate: 600 },
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Erreur API (${response.status}): ${errorText}`);
  }
  const json = collectionSchema.parse(await response.json());
  return json;
}

export function buildSelectForPoints(mapping: DatasetFieldMapping) {
  const fields = new Set<string>([mapping.consumptionField, mapping.yearField, mapping.geometryField]);
  if (mapping.pdlField) fields.add(mapping.pdlField);
  if (mapping.addressField) fields.add(mapping.addressField);
  if (mapping.communeField) fields.add(mapping.communeField);
  if (mapping.segmentField) fields.add(mapping.segmentField);
  return Array.from(fields).join(", ");
}

export function buildSelectForIris(mapping: DatasetFieldMapping, perPdl = false) {
  const denominator = perPdl && mapping.pdlField ? mapping.pdlField : "1";
  const intensity = perPdl && mapping.pdlField
    ? `sum(${mapping.consumptionField}) / NULLIF(sum(${mapping.pdlField}), 0)`
    : `sum(${mapping.consumptionField})`;
  const fields = [`${mapping.irisField ?? "code_iris"}`];
  if (mapping.communeField) fields.push(mapping.communeField);
  if (mapping.segmentField) fields.push(mapping.segmentField);
  return {
    select: `${fields.join(", ")}, ${intensity} as indicateur, sum(${mapping.consumptionField}) as mwh_total, sum(${denominator}) as total_sites, any(${mapping.geometryField}) as geometry`;
  };
}

export const exportLimit = 5000;
