import {
  type ExpedienteArchivo,
  getExpedientesNamespace,
} from "@/lib/expedientes-archivo";
import { processExpedienteDocument } from "@/lib/expedientes-archivo-processing";
import { deleteRecords } from "@/lib/pinecone";
import {
  downloadStorageObject,
  supabaseRest,
  writeAuditLog,
} from "@/lib/supabase-server";
import type { DrainSummary } from "@/lib/indexing-queue";

// Cola de indexación resiliente para la Biblioteca de Expedientes Archivados.
// Igual que el corpus normativo: el `after()` de subida/reindex/reemplazo es la
// vía rápida, pero si la invocación serverless muere a mitad del OCR (PDF grande,
// timeout), el expediente queda en 'uploaded' o 'processing' para siempre. Este
// drainer (invocado por el scheduled function / worker) reprocesa los atascados
// usando el PDF ya guardado en Storage. El estado (status + updated_at) ES la cola.

// Un 'processing' más viejo que esto se considera muerto y se re-encola.
const staleMinutes = Number.parseInt(process.env.EXPEDIENTES_STALE_MINUTES ?? "10", 10);
// Margen para que el `after()` de la subida reclame un 'uploaded' antes de que lo
// haga el drainer (evita reprocesar en paralelo lo que ya se está procesando).
const claimSeconds = Number.parseInt(process.env.EXPEDIENTES_CLAIM_SECONDS ?? "120", 10);

const EXP_SELECT =
  "id,sgd_expediente,serie_documento,anio,tipo_documento,asunto,materia,resumen,title,oficina,tipo_almacenamiento,nro_archivador,nro_paquete,empastado,color_archivador,nro_estante,nro_piso,nro_local,folio,observaciones,persona_tipo,persona_documento,persona_nombre,file_name,file_size,mime_type,storage_bucket,storage_path,status,error_message,metadata,uploaded_by,created_at,updated_at";

// Expedientes pendientes (su `after()` nunca arrancó) o atascados (processing muerto).
// No reintenta los 'error' (son terminales: requieren reindex manual) para no
// entrar en bucle con PDF genuinamente ilegibles.
export async function findStuckExpedientes(limit = 2): Promise<ExpedienteArchivo[]> {
  const staleThreshold = new Date(Date.now() - staleMinutes * 60 * 1000).toISOString();
  const claimThreshold = new Date(Date.now() - claimSeconds * 1000).toISOString();
  const filter = `or=(and(status.eq.uploaded,created_at.lt.${claimThreshold}),and(status.eq.processing,updated_at.lt.${staleThreshold}))`;
  return supabaseRest<ExpedienteArchivo[]>(
    `expedientes_archivo?${filter}&select=${EXP_SELECT}&order=created_at.asc&limit=${limit}`,
  );
}

// Borra los restos (chunks + vectores) de un intento anterior fallido para que el
// reprocesado sea idempotente (la tabla de chunks tiene unique(expediente_id,chunk_index),
// así que reinsertar sin limpiar reventaría).
async function cleanupExpedienteIndex(expedienteId: string): Promise<void> {
  const chunks = await supabaseRest<Array<{ pinecone_vector_id: string | null }>>(
    `expedientes_archivo_chunks?expediente_id=eq.${expedienteId}&select=pinecone_vector_id`,
  ).catch(() => []);
  const vectorIds = chunks
    .map((chunk) => chunk.pinecone_vector_id)
    .filter((id): id is string => Boolean(id));
  if (vectorIds.length > 0) {
    await deleteRecords(vectorIds, getExpedientesNamespace()).catch(() => undefined);
  }
  await supabaseRest(`expedientes_archivo_chunks?expediente_id=eq.${expedienteId}`, {
    method: "DELETE",
  }).catch(() => undefined);
}

// Procesa hasta `limit` expedientes atascados. Cada uno en su try/catch para que
// uno con error no aborte el resto. Pensado para correr acotado por invocación.
export async function drainStuckExpedientes(limit = 2): Promise<DrainSummary> {
  const expedientes = await findStuckExpedientes(limit);
  const items: DrainSummary["items"] = [];

  for (const expediente of expedientes) {
    try {
      await cleanupExpedienteIndex(expediente.id);
      const blob = await downloadStorageObject(
        expediente.storage_bucket,
        expediente.storage_path,
      );
      const file = new File([blob], expediente.file_name, {
        type: expediente.mime_type || "application/pdf",
      });
      await processExpedienteDocument(expediente, file);
      items.push({ id: expediente.id, ok: true, title: expediente.title });
    } catch (error) {
      items.push({
        error: error instanceof Error ? error.message : "Error desconocido",
        id: expediente.id,
        ok: false,
        title: expediente.title,
      });
      // processExpedienteDocument ya marca el expediente en 'error'.
    }
  }

  const summary: DrainSummary = {
    failed: items.filter((item) => !item.ok).length,
    items,
    processed: items.filter((item) => item.ok).length,
    scanned: expedientes.length,
  };

  if (summary.scanned > 0) {
    await writeAuditLog({
      action: "expedientes.drain",
      details: summary,
      entityType: "expediente_archivo",
      module: "expedientes-archivo",
    });
  }

  return summary;
}
