import { randomUUID } from "node:crypto";
import { after, NextResponse } from "next/server";
import { requireEditor, requireUser } from "@/lib/auth";
import {
  ARCHIVO_COLORES,
  ARCHIVO_AMBIENTES,
  type ExpedienteArchivo,
  normalizeCatalogValue,
  normalizeContenedorTipo,
} from "@/lib/expedientes-archivo";
import { processExpedienteDocument } from "@/lib/expedientes-archivo-processing";
import {
  downloadStorageObject,
  getSupabaseServerConfig,
  supabaseRest,
  uploadPdfToStorage,
  writeAuditLog,
} from "@/lib/supabase-server";
import { maxPdfSizeBytes, maxPdfSizeLabel } from "@/lib/upload-limits";
import {
  checkRateLimit,
  getRateLimitKey,
  RATE_LIMITS,
  rateLimitResponse,
} from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const SELECT =
  "id,numero_expediente,numero_documento,fecha,anio,asunto,materia,resumen,remitente,destinatario,title,tipo_contenedor,nro_archivador,nro_caja,color,ubicacion,codigo_ubicacion,nro_folios,observaciones,file_name,file_size,mime_type,storage_bucket,storage_path,status,error_message,metadata,uploaded_by,created_at,updated_at";

function safeName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9.\-_]+/g, "-")
    .slice(0, 80);
}

function formText(formData: FormData, key: string, max = 500): string | null {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;
}

function formInt(formData: FormData, key: string): number | null {
  const value = formData.get(key);
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }
  const parsed = Number.parseInt(value.trim(), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function GET(request: Request) {
  try {
    const auth = await requireUser();
    if ("error" in auth) {
      return auth.error;
    }

    const rl = checkRateLimit(
      getRateLimitKey(request, auth.user.id, "list"),
      RATE_LIMITS.search,
    );
    if (!rl.allowed) {
      return rateLimitResponse(rl);
    }

    getSupabaseServerConfig();

    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const anio = url.searchParams.get("anio");
    const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(url.searchParams.get("limit") ?? "50", 10) || 50));
    const offset = (page - 1) * limit;

    let query = `expedientes_archivo?select=${SELECT}&order=created_at.desc&limit=${limit}&offset=${offset}`;
    if (status) {
      query += `&status=eq.${encodeURIComponent(status)}`;
    }
    if (anio) {
      query += `&anio=eq.${encodeURIComponent(anio)}`;
    }

    const expedientes = await supabaseRest<ExpedienteArchivo[]>(query);

    // Contar total para paginación
    let countQuery = `expedientes_archivo?select=id`;
    if (status) countQuery += `&status=eq.${encodeURIComponent(status)}`;
    if (anio) countQuery += `&anio=eq.${encodeURIComponent(anio)}`;
    const allIds = await supabaseRest<Array<{ id: string }>>(countQuery);
    const total = allIds.length;

    return NextResponse.json({
      expedientes,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    return NextResponse.json(
      {
        expedientes: [],
        error: error instanceof Error ? error.message : "No se pudo listar los expedientes",
        setupRequired: true,
      },
      { status: 503 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireEditor();
    if ("error" in auth) {
      return auth.error;
    }

    const rl = checkRateLimit(
      getRateLimitKey(request, auth.user.id, "upload"),
      RATE_LIMITS.upload,
    );
    if (!rl.allowed) {
      return rateLimitResponse(rl);
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

    const { storageBucket } = getSupabaseServerConfig();
    const title = formText(formData, "title", 300) ?? file.name;
    const fechaRaw = formData.get("fecha");
    const fecha =
      typeof fechaRaw === "string" && /^\d{4}-\d{2}-\d{2}$/.test(fechaRaw.trim())
        ? fechaRaw.trim()
        : null;

    const storagePath = `expedientes/${randomUUID()}-${safeName(file.name)}`;
    await uploadPdfToStorage(storagePath, file);

    const [expediente] = await supabaseRest<ExpedienteArchivo[]>(`expedientes_archivo?select=id`, {
      body: JSON.stringify({
        anio: formInt(formData, "anio"),
        asunto: formText(formData, "asunto"),
        codigo_ubicacion: formText(formData, "codigoUbicacion", 120),
        color: normalizeCatalogValue(formData.get("color"), ARCHIVO_COLORES),
        destinatario: formText(formData, "destinatario", 300),
        fecha,
        file_name: file.name,
        file_size: file.size,
        materia: formText(formData, "materia", 200),
        metadata: { uploadSource: "web" },
        mime_type: file.type,
        nro_archivador: formText(formData, "nroArchivador", 60),
        nro_caja: formText(formData, "nroCaja", 60),
        nro_folios: formInt(formData, "nroFolios"),
        numero_documento: formText(formData, "numeroDocumento", 120),
        numero_expediente: formText(formData, "numeroExpediente", 120),
        observaciones: formText(formData, "observaciones", 1000),
        remitente: formText(formData, "remitente", 300),
        status: "uploaded",
        storage_bucket: storageBucket,
        storage_path: storagePath,
        tipo_contenedor: normalizeContenedorTipo(formData.get("tipoContenedor")),
        title,
        ubicacion: normalizeCatalogValue(formData.get("ubicacion"), ARCHIVO_AMBIENTES),
        uploaded_by: auth.user.id,
      }),
      method: "POST",
    });

    await writeAuditLog({
      action: "expedientes.upload",
      actorReference: auth.user.email ?? auth.user.id,
      details: { fileName: file.name, title },
      entityId: expediente.id,
      entityType: "expediente_archivo",
      module: "expedientes",
    });

    // Procesa e indexa en segundo plano descargando el PDF desde Storage (releer el
    // File del request tras la respuesta da bytes corruptos para archivos pequenos).
    after(async () => {
      try {
        const blob = await downloadStorageObject(storageBucket, storagePath);
        const pdfFile = new File([blob], file.name, { type: "application/pdf" });
        const [full] = await supabaseRest<ExpedienteArchivo[]>(
          `expedientes_archivo?id=eq.${expediente.id}&select=${SELECT}`,
        );
        if (full) {
          await processExpedienteDocument(full, pdfFile);
        }
      } catch {
        // processExpedienteDocument ya persiste el error en el expediente.
      }
    });

    return NextResponse.json({ expediente, processing: true }, { status: 202 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo subir el expediente" },
      { status: 500 },
    );
  }
}
