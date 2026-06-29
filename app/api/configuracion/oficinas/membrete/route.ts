import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getSupabaseServerConfig, supabaseRest, uploadPdfToStorage, writeAuditLog } from "@/lib/supabase-server";
import { maxPdfSizeBytes, maxPdfSizeLabel } from "@/lib/upload-limits";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

// Sube la hoja membretada (PDF) de una oficina concreta.
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  try {
    const { storageBucket } = getSupabaseServerConfig();
    const formData = await request.formData();
    const file = formData.get("file");
    const oficinaId = formData.get("oficinaId");
    if (typeof oficinaId !== "string" || !oficinaId) {
      return NextResponse.json({ error: "Falta la oficina" }, { status: 400 });
    }
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Adjunta la hoja membretada en PDF" }, { status: 400 });
    }
    if (file.type !== "application/pdf") {
      return NextResponse.json({ error: "La hoja membretada debe ser un PDF" }, { status: 400 });
    }
    if (file.size > maxPdfSizeBytes) {
      return NextResponse.json({ error: `El PDF supera el límite de ${maxPdfSizeLabel}` }, { status: 400 });
    }

    const path = `respuesta/membrete-${oficinaId}-${randomUUID()}.pdf`;
    await uploadPdfToStorage(path, file);
    await supabaseRest(`expedientes_oficinas?id=eq.${oficinaId}`, {
      body: JSON.stringify({ membrete_path: path, membrete_bucket: storageBucket, updated_at: new Date().toISOString() }),
      method: "PATCH",
    });

    await writeAuditLog({
      action: "oficinas.membrete",
      actorReference: auth.user.email ?? auth.user.id,
      details: { oficinaId, fileName: file.name },
      entityId: oficinaId,
      entityType: "oficina",
      module: "configuracion",
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo subir la hoja membretada" }, { status: 500 });
  }
}
