import { after, NextResponse } from "next/server";
import { requireEditor, requireUser } from "@/lib/auth";
import { type ExpedienteArchivo, getExpedientesNamespace } from "@/lib/expedientes-archivo";
import { processExpedienteDocument } from "@/lib/expedientes-archivo-processing";
import { deleteRecords } from "@/lib/pinecone";
import {
  deleteStorageObjects,
  downloadStorageObject,
  getSupabaseServerConfig,
  supabaseRest,
  writeAuditLog,
} from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const SELECT =
  "id,numero_expediente,numero_documento,fecha,anio,asunto,materia,resumen,remitente,destinatario,title,tipo_contenedor,nro_archivador,nro_caja,color,ubicacion,codigo_ubicacion,nro_folios,observaciones,file_name,file_size,mime_type,storage_bucket,storage_path,status,error_message,metadata,uploaded_by,created_at,updated_at";

type ChunkVector = { pinecone_vector_id: string | null };

async function getVectorIds(expedienteId: string) {
  const chunks = await supabaseRest<ChunkVector[]>(
    `expedientes_archivo_chunks?expediente_id=eq.${expedienteId}&select=pinecone_vector_id`,
  );
  return chunks
    .map((chunk) => chunk.pinecone_vector_id)
    .filter((id): id is string => Boolean(id));
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireUser();
    if ("error" in auth) {
      return auth.error;
    }
    getSupabaseServerConfig();
    const { id } = await context.params;

    const [expediente] = await supabaseRest<ExpedienteArchivo[]>(
      `expedientes_archivo?id=eq.${id}&select=${SELECT}`,
    );
    if (!expediente) {
      return NextResponse.json({ error: "Expediente no encontrado" }, { status: 404 });
    }

    const blob = await downloadStorageObject(expediente.storage_bucket, expediente.storage_path);
    return new Response(blob, {
      headers: {
        "Content-Disposition": `inline; filename="${expediente.file_name.replaceAll('"', "")}"`,
        "Content-Type": expediente.mime_type || "application/pdf",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo abrir el expediente" },
      { status: 500 },
    );
  }
}

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireEditor();
    if ("error" in auth) {
      return auth.error;
    }
    getSupabaseServerConfig();
    const { id } = await context.params;

    const [expediente] = await supabaseRest<ExpedienteArchivo[]>(
      `expedientes_archivo?id=eq.${id}&select=${SELECT}`,
    );
    if (!expediente) {
      return NextResponse.json({ error: "Expediente no encontrado" }, { status: 404 });
    }

    await supabaseRest(`expedientes_archivo?id=eq.${id}`, {
      body: JSON.stringify({ error_message: null, status: "processing" }),
      method: "PATCH",
    }).catch(() => undefined);

    after(async () => {
      try {
        const namespace = getExpedientesNamespace();
        const vectorIds = await getVectorIds(id);
        await deleteRecords(vectorIds, namespace);
        await supabaseRest(`expedientes_archivo_chunks?expediente_id=eq.${id}`, { method: "DELETE" });

        const blob = await downloadStorageObject(expediente.storage_bucket, expediente.storage_path);
        const file = new File([blob], expediente.file_name, {
          type: expediente.mime_type || "application/pdf",
        });
        const result = await processExpedienteDocument(expediente, file);
        await writeAuditLog({
          action: "expedientes.reindex",
          actorReference: auth.user.email ?? auth.user.id,
          details: { chunkCount: result.chunkCount, pageCount: result.pageCount },
          entityId: id,
          entityType: "expediente_archivo",
          module: "expedientes",
        });
      } catch {
        // processExpedienteDocument ya persiste el error.
      }
    });

    return NextResponse.json({ expedienteId: id, reindexing: true }, { status: 202 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo reindexar el expediente" },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireEditor();
    if ("error" in auth) {
      return auth.error;
    }
    getSupabaseServerConfig();
    const { id } = await context.params;

    const [expediente] = await supabaseRest<ExpedienteArchivo[]>(
      `expedientes_archivo?id=eq.${id}&select=id,title,storage_bucket,storage_path`,
    );
    if (!expediente) {
      return NextResponse.json({ error: "Expediente no encontrado" }, { status: 404 });
    }

    const vectorIds = await getVectorIds(id);
    await deleteRecords(vectorIds, getExpedientesNamespace());
    await deleteStorageObjects(expediente.storage_bucket, [expediente.storage_path]);
    await supabaseRest(`expedientes_archivo?id=eq.${id}`, { method: "DELETE" });

    await writeAuditLog({
      action: "expedientes.delete",
      actorReference: auth.user.email ?? auth.user.id,
      details: { title: expediente.title, vectors: vectorIds.length },
      entityId: id,
      entityType: "expediente_archivo",
      module: "expedientes",
    });

    return NextResponse.json({ deleted: { expedienteId: id, vectors: vectorIds.length } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo eliminar el expediente" },
      { status: 500 },
    );
  }
}
