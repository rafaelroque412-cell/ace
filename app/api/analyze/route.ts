import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { analyzeLegalDocument } from "@/lib/legal-analysis";
import { extractPdfPlainText } from "@/lib/pdf-processing";
import { supabaseRest, supabaseUserRest } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const maxPdfSize = 50 * 1024 * 1024;
const minTextLength = 120;

type DocumentRow = { id: string; title: string; document_type: string };
type ChunkRow = { content: string };

export async function POST(request: Request) {
  try {
    const auth = await requireUser();
    if ("error" in auth) {
      return auth.error;
    }

    const contentType = request.headers.get("content-type") ?? "";
    let text = "";
    let title: string | undefined;
    let documentType: string | undefined;
    let source: "upload" | "indexed" = "upload";
    let documentId: string | null = null;

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file");

      if (!(file instanceof File)) {
        return NextResponse.json({ error: "Adjunta un archivo PDF" }, { status: 400 });
      }
      if (file.type !== "application/pdf") {
        return NextResponse.json({ error: "Solo se permiten archivos PDF" }, { status: 400 });
      }
      if (file.size > maxPdfSize) {
        return NextResponse.json({ error: "El PDF supera el limite de 50 MB" }, { status: 400 });
      }

      const titleValue = formData.get("title");
      title = typeof titleValue === "string" && titleValue.trim() ? titleValue.trim() : file.name;
      const extracted = await extractPdfPlainText(file);
      text = extracted.text;
    } else {
      const payload = (await request.json().catch(() => ({}))) as { documentId?: string };

      if (!payload.documentId) {
        return NextResponse.json({ error: "Falta documentId o archivo" }, { status: 400 });
      }

      source = "indexed";
      documentId = payload.documentId;
      const [docs, chunks] = await Promise.all([
        supabaseRest<DocumentRow[]>(
          `documents?id=eq.${payload.documentId}&select=id,title,document_type`,
        ),
        supabaseRest<ChunkRow[]>(
          `document_chunks?document_id=eq.${payload.documentId}&select=content&order=chunk_index.asc&limit=80`,
        ),
      ]);
      const doc = docs[0];
      if (!doc) {
        return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });
      }
      title = doc.title;
      documentType = doc.document_type;
      text = chunks.map((chunk) => chunk.content).join("\n\n");
    }

    if (text.trim().length < minTextLength) {
      return NextResponse.json(
        { error: "No se pudo extraer texto suficiente del documento (¿PDF escaneado?)." },
        { status: 422 },
      );
    }

    const analysis = await analyzeLegalDocument({ text, title, documentType });

    await supabaseUserRest(auth.user.accessToken, "document_analyses", {
      body: JSON.stringify({
        document_id: documentId,
        model: analysis.model,
        owner_id: auth.user.id,
        result: {
          clausulas: analysis.clausulas,
          confidence: analysis.confidence,
          normasAplicables: analysis.normasAplicables,
          recomendaciones: analysis.recomendaciones,
          resumen: analysis.resumen,
          riesgos: analysis.riesgos,
        },
        source,
        title,
      }),
      method: "POST",
    }).catch(() => undefined);

    return NextResponse.json({ analysis, title });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo analizar el documento" },
      { status: 500 },
    );
  }
}
