import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { supabaseRest } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type DocumentRow = {
  id: string;
  title: string;
  document_type: string;
  process_type: string | null;
  source_entity: string | null;
  status: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

function metadataString(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function metadataNumber(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normKey(document: DocumentRow) {
  const metadata = document.metadata ?? {};
  return (
    metadataString(metadata, "documentNumber") ??
    metadataString(metadata, "number") ??
    document.title
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim()
  );
}

export async function GET() {
  try {
    const auth = await requireUser();
    if ("error" in auth) {
      return auth.error;
    }

    const documents = await supabaseRest<DocumentRow[]>(
      "documents?status=eq.indexed&document_type=in.(ley,reglamento,directiva,opinion,resolucion)&select=id,title,document_type,process_type,source_entity,status,metadata,created_at&order=document_type.asc,created_at.desc&limit=500",
    );
    const groups = new Map<string, DocumentRow[]>();

    for (const document of documents) {
      const key = normKey(document);
      groups.set(key, [...(groups.get(key) ?? []), document]);
    }

    const versions = Array.from(groups.entries()).map(([key, rows]) => ({
      key,
      documents: rows.map((row) => ({
        amends: metadataString(row.metadata, "amends"),
        createdAt: row.created_at,
        documentType: row.document_type,
        id: row.id,
        processType: row.process_type,
        sourceEntity: row.source_entity,
        status: metadataString(row.metadata, "status") ?? row.status,
        title: row.title,
        vigencia: metadataString(row.metadata, "vigencia"),
        year: metadataNumber(row.metadata, "year"),
      })),
      hasAmendments: rows.some((row) => Boolean(metadataString(row.metadata, "amends"))),
      latestYear: Math.max(...rows.map((row) => metadataNumber(row.metadata, "year") ?? 0)),
      title: rows[0]?.title ?? key,
      total: rows.length,
    }));

    return NextResponse.json({ versions });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo construir el versionado normativo" },
      { status: 500 },
    );
  }
}
