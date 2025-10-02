import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  buildSelectForIris,
  buildSelectForPoints,
  datasetKeys,
  type DatasetKey,
  exportLimit,
  fetchDatasetSchema,
  fetchRecords,
} from "@/lib/enedis";

const querySchema = z.object({
  bbox: z.string().optional(),
  year: z
    .string()
    .optional()
    .transform((value) => (value ? Number.parseInt(value, 10) : undefined))
    .refine((value) => value === undefined || Number.isFinite(value ?? 0), {
      message: "Année invalide",
    }),
  limit: z
    .string()
    .optional()
    .transform((value) => (value ? Number.parseInt(value, 10) : undefined)),
  offset: z
    .string()
    .optional()
    .transform((value) => (value ? Number.parseInt(value, 10) : undefined)),
  minConsumption: z
    .string()
    .optional()
    .transform((value) => (value ? Number.parseFloat(value) : undefined)),
  maxConsumption: z
    .string()
    .optional()
    .transform((value) => (value ? Number.parseFloat(value) : undefined)),
  search: z.string().optional(),
  commune: z.string().optional(),
  segment: z.string().optional(),
  perPdl: z
    .string()
    .optional()
    .transform((value) => value === "true"),
  export: z
    .string()
    .optional()
    .transform((value) => value === "true"),
});

type Query = z.infer<typeof querySchema>;

function toDatasetKey(value: string): DatasetKey | null {
  return datasetKeys.includes(value as DatasetKey) ? (value as DatasetKey) : null;
}

export async function GET(request: NextRequest, context: { params: { dataset: string } }) {
  const datasetKey = toDatasetKey(context.params.dataset);
  if (!datasetKey) {
    return NextResponse.json({ error: "Jeu de données inconnu" }, { status: 404 });
  }
  const parseResult = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams.entries()));
  if (!parseResult.success) {
    return NextResponse.json(
      { error: "Paramètres invalides", details: parseResult.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const query = parseResult.data as Query;
  try {
    const mapping = await fetchDatasetSchema(datasetKey);
    const select =
      datasetKey === "iris"
        ? buildSelectForIris(mapping, query.perPdl).select
        : buildSelectForPoints(mapping);
    const groupBy = datasetKey === "iris" ? mapping.irisField ?? "code_iris" : undefined;
    const orderBy = datasetKey === "iris" ? "mwh_total DESC" : undefined;
    const limit = query.export ? exportLimit : query.limit;
    const { results, total_count } = await fetchRecords({
      dataset: datasetKey,
      bbox: query.bbox,
      year: query.year,
      search: query.search,
      limit,
      offset: query.offset,
      minConsumption: query.minConsumption,
      maxConsumption: query.maxConsumption,
      commune: query.commune,
      segment: query.segment,
      select,
      groupBy,
      orderBy,
    });
    const normalized = results.map((item) => {
      const fields = (item.record?.fields ?? item.fields ?? {}) as Record<string, unknown>;
      const geometry = (item.geometry ?? fields[mapping.geometryField]) as unknown;
      return {
        id: item.id,
        geometry,
        fields,
      };
    });
    const response = NextResponse.json(
      {
        dataset: datasetKey,
        total: total_count ?? normalized.length,
        results: normalized,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "public, s-maxage=600, stale-while-revalidate=300",
        },
      },
    );
    return response;
  } catch (error) {
    console.error("/api/enedis", error);
    return NextResponse.json(
      { error: "Erreur lors de l'appel à l'API Enedis" },
      { status: 502 },
    );
  }
}
