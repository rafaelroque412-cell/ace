import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { documentTypeLabel, processTypeLabel } from "@/lib/legal-taxonomy";
import { supabaseRest } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type DocRow = {
  document_type: string;
  source_entity: string | null;
  process_type: string | null;
  metadata: Record<string, unknown>;
};

type Facet = { value: string; label: string; count: number };

function tally(map: Map<string, number>, value: string | null | undefined) {
  if (!value) {
    return;
  }
  map.set(value, (map.get(value) ?? 0) + 1);
}

function toFacets(map: Map<string, number>, label: (value: string) => string): Facet[] {
  return Array.from(map.entries())
    .map(([value, count]) => ({ value, label: label(value), count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

export async function GET() {
  try {
    const auth = await requireUser();
    if ("error" in auth) {
      return auth.error;
    }

    const docs = await supabaseRest<DocRow[]>(
      "documents?status=eq.indexed&select=document_type,source_entity,process_type,metadata&limit=1000",
    );

    const documentType = new Map<string, number>();
    const sourceEntity = new Map<string, number>();
    const processType = new Map<string, number>();
    const year = new Map<string, number>();
    const vigencia = new Map<string, number>();

    for (const doc of docs) {
      tally(documentType, doc.document_type);
      tally(sourceEntity, doc.source_entity);
      tally(processType, doc.process_type);
      const metadata = doc.metadata ?? {};
      tally(year, typeof metadata.year === "number" ? String(metadata.year) : null);
      tally(vigencia, typeof metadata.vigencia === "string" ? metadata.vigencia : null);
    }

    return NextResponse.json({
      total: docs.length,
      facets: {
        documentType: toFacets(documentType, documentTypeLabel),
        sourceEntity: toFacets(sourceEntity, (value) => value),
        processType: toFacets(processType, (value) => processTypeLabel(value) ?? value),
        year: toFacets(year, (value) => value).sort((a, b) => Number(b.value) - Number(a.value)),
        vigencia: toFacets(vigencia, (value) => value),
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "No se pudieron calcular las facetas",
        facets: {},
      },
      { status: 500 },
    );
  }
}
