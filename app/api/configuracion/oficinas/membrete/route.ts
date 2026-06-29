import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getSupabaseServerConfig, supabaseRest, uploadPdfToStorage, writeAuditLog } from "@/lib/supabase-server";
import { maxPdfSizeBytes, maxPdfSizeLabel } from "@/lib/upload-limits";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

type OficinaRowMembrete = { membrete_path: string | null; membrete_bucket: string | null };

async function loadMembreteRef(oficinaId: string): Promise<OficinaRowMembrete | null> {
  const rows = await supabaseRest<OficinaRowMembrete[]>(
    `expedientes_oficinas?id=eq.${oficinaId}&select=membrete_path,membrete_bucket`,
  ).catch(() => []);
  return rows[0] ?? null;
}

async function clearMembrete(oficinaId: string) {
  await supabaseRest(`expedientes_oficinas?id=eq.${oficinaId}`, {
    body: JSON.stringify({
      membrete_path: null,
      membrete_bucket: null,
      updated_at: new Date().toISOString(),
    }),
    method: "PATCH",
  });
}

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

// Elimina la hoja membretada de una oficina. Borra el archivo del storage
// (best-effort) y limpia las columnas membrete_path / membrete_bucket.
export async function DELETE(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  try {
    const oficinaId = new URL(request.url).searchParams.get("oficinaId");
    if (!oficinaId) {
      return NextResponse.json({ error: "Falta la oficina" }, { status: 400 });
    }
    const ref = await loadMembreteRef(oficinaId);
    if (!ref?.membrete_path) {
      return NextResponse.json({ ok: true, alreadyEmpty: true });
    }
    const { deleteStorageObjects } = await import("@/lib/supabase-server");
    if (ref.membrete_bucket) {
      await deleteStorageObjects(ref.membrete_bucket, [ref.membrete_path]).catch(
        () => undefined,
      );
    }
    await clearMembrete(oficinaId);
    await writeAuditLog({
      action: "oficinas.membrete.delete",
      actorReference: auth.user.email ?? auth.user.id,
      details: { oficinaId, path: ref.membrete_path },
      entityId: oficinaId,
      entityType: "oficina",
      module: "configuracion",
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo eliminar la hoja membretada" },
      { status: 500 },
    );
  }
}
