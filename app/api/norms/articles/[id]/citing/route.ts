import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { supabaseRest } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type CitingRow = {
  id: string;
  source_article_id: string | null;
  raw_text: string;
  sourceDoc: { id: string; title: string } | null;
  sourceArt: { article_number: string } | null;
};

// "Citado por": concordancias entrantes resueltas a este articulo.
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireUser();
    if ("error" in auth) {
      return auth.error;
    }

    const { id } = await context.params;

    if (!id) {
      return NextResponse.json({ error: "Falta id del articulo" }, { status: 400 });
    }

    const rows = await supabaseRest<CitingRow[]>(
      `norma_concordancias?target_article_id=eq.${id}&resolved=eq.true` +
        `&select=id,source_article_id,raw_text,sourceDoc:documents!source_document_id(id,title),sourceArt:norma_articulos!source_article_id(article_number)`,
    );

    return NextResponse.json({
      citing: rows.map((row) => ({
        id: row.id,
        sourceDocumentId: row.sourceDoc?.id ?? null,
        sourceDocumentTitle: row.sourceDoc?.title ?? null,
        sourceArticleId: row.source_article_id,
        sourceArticleNumber: row.sourceArt?.article_number ?? null,
        rawText: row.raw_text,
      })),
    });
  } catch (error) {
    return NextResponse.json(
      {
        citing: [],
        error: error instanceof Error ? error.message : "No se pudo cargar 'citado por'",
      },
      { status: 500 },
    );
  }
}
