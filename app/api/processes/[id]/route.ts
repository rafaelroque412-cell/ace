import { NextResponse } from "next/server";
import { requireCapability, requireUser } from "@/lib/auth";
import { type ProcessDocument, type ProcurementProcess, processUpdateSchema } from "@/lib/processes";
import { deleteStorageObjects, supabaseUserRest, writeAuditLog } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type EvaluationRow = {
  id: string;
  bidder_name: string | null;
  result: string | null;
  matrix: unknown[];
  created_at: string;
};

type RiskRow = { id: string; items: unknown[]; created_at: string };

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if ("error" in auth) {
    return auth.error;
  }

  const { id } = await context.params;

  try {
    const [processes, documents, evaluations, risks] = await Promise.all([
      supabaseUserRest<ProcurementProcess[]>(
        auth.user.accessToken,
        `procurement_processes?id=eq.${id}&select=id,nomenclature,object_type,procedure_type,amount,entity,status,summary,created_at,updated_at`,
      ),
      supabaseUserRest<ProcessDocument[]>(
        auth.user.accessToken,
        `process_documents?process_id=eq.${id}&select=id,process_id,kind,bidder_name,title,file_name,storage_bucket,storage_path,mime_type,status,error_message,metadata,created_at&order=created_at.asc`,
      ),
      supabaseUserRest<EvaluationRow[]>(
        auth.user.accessToken,
        `process_evaluations?process_id=eq.${id}&select=id,bidder_name,result,matrix,created_at&order=created_at.desc`,
      ).catch(() => []),
      supabaseUserRest<RiskRow[]>(
        auth.user.accessToken,
        `process_risks?process_id=eq.${id}&select=id,items,created_at&order=created_at.desc`,
      ).catch(() => []),
    ]);

    const process = processes[0];
    if (!process) {
      return NextResponse.json({ error: "Expediente no encontrado" }, { status: 404 });
    }

    return NextResponse.json({ process, documents, evaluations, risks });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo cargar el expediente" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireCapability("expediente.manage");
  if ("error" in auth) {
    return auth.error;
  }

  const { id } = await context.params;
  const payload = processUpdateSchema.safeParse(await request.json().catch(() => ({})));
  if (!payload.success) {
    return NextResponse.json({ error: "Solicitud invalida" }, { status: 400 });
  }

  const data = payload.data;
  const patch: Record<string, unknown> = {};
  if (data.nomenclature !== undefined) patch.nomenclature = data.nomenclature;
  if (data.procedureType !== undefined) patch.procedure_type = data.procedureType || null;
  if (data.amount !== undefined) patch.amount = data.amount;
  if (data.entity !== undefined) patch.entity = data.entity || null;
  if (data.status !== undefined) patch.status = data.status;
  if (data.summary !== undefined) patch.summary = data.summary || null;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });
  }

  try {
    const [process] = await supabaseUserRest<ProcurementProcess[]>(
      auth.user.accessToken,
      `procurement_processes?id=eq.${id}`,
      { body: JSON.stringify(patch), method: "PATCH" },
    );
    return NextResponse.json({ process });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo actualizar el expediente" },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireCapability("expediente.manage");
  if ("error" in auth) {
    return auth.error;
  }

  const { id } = await context.params;

  try {
    // Limpia los archivos en Storage antes de borrar (el cascade borra las filas).
    const documents = await supabaseUserRest<Array<{ storage_bucket: string | null; storage_path: string | null }>>(
      auth.user.accessToken,
      `process_documents?process_id=eq.${id}&select=storage_bucket,storage_path`,
    ).catch(() => []);

    const byBucket = new Map<string, string[]>();
    for (const document of documents) {
      if (document.storage_bucket && document.storage_path) {
        byBucket.set(document.storage_bucket, [
          ...(byBucket.get(document.storage_bucket) ?? []),
          document.storage_path,
        ]);
      }
    }
    for (const [bucket, paths] of byBucket) {
      await deleteStorageObjects(bucket, paths).catch(() => undefined);
    }

    await supabaseUserRest(auth.user.accessToken, `procurement_processes?id=eq.${id}`, { method: "DELETE" });

    await writeAuditLog({
      action: "process.delete",
      details: { documents: documents.length },
      entityId: id,
      entityType: "procurement_process",
    });

    return NextResponse.json({ deleted: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo eliminar el expediente" },
      { status: 500 },
    );
  }
}
