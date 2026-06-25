import { NextResponse } from "next/server";
import { requireEditor } from "@/lib/auth";
import { extractExpedienteInventory } from "@/lib/expedientes-archivo-processing";
import { writeAuditLog } from "@/lib/supabase-server";
import { maxPdfSizeBytes, maxPdfSizeLabel } from "@/lib/upload-limits";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

// Lee el PDF cargado y devuelve los datos detectados (numero/fecha/asunto/materia/
// remitente/destinatario/resumen/folios) para autocompletar el formulario de
// registro del archivo fisico. No guarda nada ni indexa.
export async function POST(request: Request) {
  try {
    const auth = await requireEditor();
    if ("error" in auth) {
      return auth.error;
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Debes adjuntar un archivo PDF" }, { status: 400 });
    }
    if (file.type !== "application/pdf") {
      return NextResponse.json({ error: "Solo se permiten archivos PDF" }, { status: 400 });
    }
    if (file.size > maxPdfSizeBytes) {
      return NextResponse.json({ error: `El PDF supera el limite de ${maxPdfSizeLabel}` }, { status: 400 });
    }

    const titleValue = formData.get("title");
    const title = typeof titleValue === "string" ? titleValue.trim() : "";

    const inventory = await extractExpedienteInventory(file, title);

    await writeAuditLog({
      action: "expedientes.extract",
      actorReference: auth.user.email ?? auth.user.id,
      details: { fileName: file.name, extractionMethod: inventory.extractionMethod },
      entityType: "expediente_extract",
      module: "expedientes-archivo",
    });

    return NextResponse.json({ inventory });
  } catch (error) {
    // Errores operacionales (PDF no procesable, OCR no útil) → 422 Unprocessable Entity
    // No son errores del servidor, son del input
    const message = error instanceof Error ? error.message : "No se pudo extraer la informacion del PDF";
    const isOperational = /ocr|texto|escaneado|legible|pdf/i.test(message);
    return NextResponse.json(
      { error: message, retryable: !isOperational },
      { status: isOperational ? 422 : 500 },
    );
  }
}
