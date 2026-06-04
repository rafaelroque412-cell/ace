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
type RawFacet = { value: string; count: number };
type FacetGroups = {
  total: number;
  documentType: RawFacet[];
  sourceEntity: RawFacet[];
  processType: RawFacet[];
  year: RawFacet[];
  vigencia: RawFacet[];
};

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

// Aplica etiqueta legible a las facetas ya agregadas por la BD (que vienen
// ordenadas por conteo, o por valor en el caso de year).
function labelFacets(raw: RawFacet[] | undefined, label: (value: string) => string): Facet[] {
  return (raw ?? []).map(({ value, count }) => ({ value, label: label(value), count }));
}

// Camino preferido: agregacion en la BD (escala sin traer filas). Lanza si la
// funcion corpus_facets aun no esta aplicada en la BD para activar el fallback.
async function facetsFromRpc() {
  const groups = await supabaseRest<FacetGroups>("rpc/corpus_facets", { body: "{}", method: "POST" });

  return {
    total: groups.total ?? 0,
    facets: {
      documentType: labelFacets(groups.documentType, documentTypeLabel),
      sourceEntity: labelFacets(groups.sourceEntity, (value) => value),
      processType: labelFacets(groups.processType, (value) => processTypeLabel(value) ?? value),
      year: labelFacets(groups.year, (value) => value),
      vigencia: labelFacets(groups.vigencia, (value) => value),
    },
  };
}

// Fallback: agregacion en memoria (corpus pequeno o RPC aun no aplicada).
async function facetsFromScan() {
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

  return {
    total: docs.length,
    facets: {
      documentType: toFacets(documentType, documentTypeLabel),
      sourceEntity: toFacets(sourceEntity, (value) => value),
      processType: toFacets(processType, (value) => processTypeLabel(value) ?? value),
      year: toFacets(year, (value) => value).sort((a, b) => Number(b.value) - Number(a.value)),
      vigencia: toFacets(vigencia, (value) => value),
    },
  };
}

export async function GET() {
  try {
    const auth = await requireUser();
    if ("error" in auth) {
      return auth.error;
    }

    const result = await facetsFromRpc().catch(() => facetsFromScan());

    return NextResponse.json(result);
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
