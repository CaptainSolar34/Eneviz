import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { buildSelectForPoints, fetchDatasetSchema, fetchRecords } from "@/lib/enedis";

const querySchema = z.object({
  q: z.string().min(2),
  dataset: z.enum(["residential", "business"]).default("residential"),
  year: z
    .string()
    .optional()
    .transform((value) => (value ? Number.parseInt(value, 10) : undefined)),
});

export async function GET(request: NextRequest) {
  const parseResult = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams.entries()));
  if (!parseResult.success) {
    return NextResponse.json(
      { error: "Paramètres invalides" },
      { status: 400 },
    );
  }
  const { q, dataset, year } = parseResult.data;
  try {
    const schema = await fetchDatasetSchema(dataset);
    const select = buildSelectForPoints(schema);
    const { results } = await fetchRecords({
      dataset,
      search: q,
      year,
      limit: 8,
      select,
    });
    const suggestions = results.map((item) => {
      const fields = (item.record?.fields ?? item.fields ?? {}) as Record<string, unknown>;
      return {
        id: item.id,
        label: fields[schema.addressField ?? ""] ?? fields[schema.communeField ?? ""] ?? q,
        commune: fields[schema.communeField ?? ""] ?? null,
        geometry: item.geometry ?? fields[schema.geometryField],
      };
    });
    return NextResponse.json({ suggestions }, { status: 200 });
  } catch (error) {
    console.error("/api/enedis/suggest", error);
    return NextResponse.json({ error: "Erreur de suggestion" }, { status: 502 });
  }
}
