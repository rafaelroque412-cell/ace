import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { getSupabaseServerConfig, supabaseRest, writeAuditLog } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const TIPOS = ["OFICIO", "INFORME", "CARTA", "MEMORANDUM"] as const;
type Tipo = (typeof TIPOS)[number];

// Esquema de cada fila del Excel. Valido nombre obligatorio; el resto es opcional.
const OficinaRowSchema = z.object({
  nombre: z.string().trim().min(2, "El nombre es obligatorio (mín. 2 caracteres)").max(200),
  entidad: z.string().trim().max(200).optional().nullable(),
  ruc: z
    .string()
    .trim()
    .max(20)
    .optional()
    .nullable()
    .or(z.literal(""))
    .refine(
      (v) => !v || /^\d{11}$/.test(v),
      "El RUC debe tener 11 dígitos numéricos",
    ),
  responsable_nombre: z.string().trim().max(200).optional().nullable(),
  responsable_cargo: z.string().trim().max(200).optional().nullable(),
  sufijo: z.string().trim().max(60).optional().nullable(),
  ancho: z.coerce.number().int().min(1).max(6).optional().default(3),
  activo: z.union([z.boolean(), z.string()]).optional().default(true),
});

type OficinaRowKey = keyof z.infer<typeof OficinaRowSchema>;
type ParsedRow = z.infer<typeof OficinaRowSchema> & { _row: number };

// Modo "simple": el archivo trae columnas tipo nombre, entidad, ruc, etc.
const SIMPLE_ALIASES: Record<OficinaRowKey, string[]> = {
  nombre: ["nombre", "oficina", "area", "area_usuario", "área", "usuario"],
  entidad: ["entidad", "institucion", "institución", "municipalidad"],
  ruc: ["ruc", "ruc_entidad"],
  responsable_nombre: ["responsable", "responsable_nombre", "firma", "firma_nombre"],
  responsable_cargo: ["cargo", "responsable_cargo", "cargo_responsable"],
  sufijo: ["sufijo", "siglas"],
  ancho: ["ancho", "ancho_numeracion", "padding"],
  activo: ["activo", "estado"],
};

// Modo "siaf": archivo del SIAF/MEF (ej. area.XLS) con su nomenclatura.
// El admin lo sube tal cual; mapeamos automáticamente a nuestro modelo.
const SIAF_ALIASES: Record<OficinaRowKey, string[]> = {
  nombre: ["nombre_depend", "dependencia", "area", "oficina"],
  entidad: ["nombre_sede", "entidad"],
  ruc: [],
  responsable_nombre: [],
  responsable_cargo: [],
  sufijo: ["abreviado_depend", "siglas", "abreviatura"],
  ancho: [],
  activo: ["estado"],
};

// Columnas SIAF adicionales (no se mapean a oficinas pero se usan para
// componer responsable_nombre / responsable_cargo en una sola pasada).
const SIAF_EXTRA_HEADERS = {
  paterno: ["paterno", "apellido_paterno"],
  materno: ["materno", "apellido_materno"],
  nombres: ["nombres", "nombre"],
  empleado: ["empleado", "dni"],
  cargo: ["cargo_depend", "cargo", "denominacion_cargo"],
  centro_costo: ["centro_costo", "ccosto"],
  tipo_depend: ["tipo_depend", "tipo"],
  sec_ejec: ["sec_ejec", "unidad_ejecutora"],
  nombre_entidad: ["nombre_entidad", "razon_social"],
  ruc_entidad: ["ruc_entidad", "ruc"],
};

function normalizeHeader(h: string): string {
  return h
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function buildHeaderMap(
  headerRow: string[],
  aliases: Record<OficinaRowKey, string[]>,
): Map<OficinaRowKey, number> {
  const map = new Map<OficinaRowKey, number>();
  const normalized = headerRow.map(normalizeHeader);
  (Object.keys(aliases) as OficinaRowKey[]).forEach((key) => {
    const list = aliases[key].map(normalizeHeader);
    const idx = normalized.findIndex((n) => list.includes(n));
    if (idx !== -1) map.set(key, idx);
  });
  return map;
}

function buildExtraHeaderMap(
  headerRow: string[],
  extras: Record<string, string[]>,
): Map<string, number> {
  const map = new Map<string, number>();
  const normalized = headerRow.map(normalizeHeader);
  Object.keys(extras).forEach((key) => {
    const list = extras[key].map(normalizeHeader);
    const idx = normalized.findIndex((n) => list.includes(n));
    if (idx !== -1) map.set(key, idx);
  });
  return map;
}

function asText(value: unknown, max = 200): string | null {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;
}

function asBool(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    return v === "true" || v === "1" || v === "si" || v === "sí" || v === "activo" || v === "x";
  }
  return true;
}

function asInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.trunc(n))) : fallback;
}

async function seedCounters(oficinaId: string) {
  await supabaseRest("expedientes_doc_counters", {
    body: JSON.stringify(TIPOS.map((tipo) => ({ oficina_id: oficinaId, tipo, siguiente: 1 }))),
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    method: "POST",
  }).catch(() => undefined);
}

// POST /api/configuracion/oficinas/import
// Body: FormData con `file` (.xls/.xlsx) y opcional `mode=merge|replace` y `dryRun=true`.
// mode=merge (default): crea nuevas oficinas; las existentes por nombre se actualizan.
// mode=replace: borra todas las oficinas previas y crea las del archivo.
// dryRun=true: NO escribe; solo devuelve el preview parseado + errores.
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  try {
    getSupabaseServerConfig();

    const formData = await request.formData();
    const file = formData.get("file");
    const mode = (formData.get("mode") as string | null) ?? "merge";
    const dryRun = (formData.get("dryRun") as string | null) === "true";

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Adjunta un archivo .xls o .xlsx" }, { status: 400 });
    }
    const name = file.name.toLowerCase();
    if (!name.endsWith(".xls") && !name.endsWith(".xlsx")) {
      return NextResponse.json({ error: "Solo se aceptan archivos .xls o .xlsx" }, { status: 400 });
    }
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "El archivo supera 10 MB" }, { status: 400 });
    }
    if (mode !== "merge" && mode !== "replace") {
      return NextResponse.json({ error: "mode debe ser 'merge' o 'replace'" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return NextResponse.json({ error: "El archivo no tiene hojas" }, { status: 400 });
    }
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: "" });

    if (rows.length < 2) {
      return NextResponse.json({ error: "El archivo está vacío (sin filas de datos)" }, { status: 400 });
    }

    const headerRow = (rows[0] as unknown[]).map((c) => String(c ?? ""));
    const normalized = headerRow.map(normalizeHeader);

    // Auto-detectamos el modo segun los headers presentes.
    // SIAF: aparece nombre_depend + (centro_costo o sec_ejec o tipo_depend)
    const isSiaf =
      normalized.includes("nombre_depend") &&
      (normalized.includes("centro_costo") ||
        normalized.includes("sec_ejec") ||
        normalized.includes("tipo_depend"));

    const headerMap = isSiaf
      ? buildHeaderMap(headerRow, SIAF_ALIASES)
      : buildHeaderMap(headerRow, SIMPLE_ALIASES);
    const extraMap = isSiaf ? buildExtraHeaderMap(headerRow, SIAF_EXTRA_HEADERS) : null;

    if (!headerMap.has("nombre")) {
      return NextResponse.json(
        {
          error:
            "Falta la columna 'nombre' (acepta: nombre, oficina, area, area_usuario, nombre_depend)",
          detectedHeaders: headerRow,
          detectedFormat: isSiaf ? "siaf" : "unknown",
        },
        { status: 400 },
      );
    }

    type RowError = { row: number; error: string };
    const errors: RowError[] = [];
    const parsed: ParsedRow[] = [];

    // En SIAF, derivamos la entidad una sola vez (de la primera fila tipo 1).
    let cachedEntidad: string | null = null;
    let cachedRuc: string | null = null;

    for (let i = 1; i < rows.length; i++) {
      const r = rows[i] as unknown[];
      if (!r || r.every((c) => c === "" || c == null)) continue;

      // En SIAF saltamos la fila tipo 1 (la entidad misma) y filas inactivas.
      let tipo: number | null = null;
      let estado: string | null = null;
      if (isSiaf && extraMap) {
        const tIdx = extraMap.get("tipo_depend");
        const eIdx = extraMap.get("estado");
        if (tIdx !== undefined) tipo = Number(r[tIdx]) || null;
        if (eIdx !== undefined) estado = String(r[eIdx] ?? "").trim().toUpperCase();
        if (estado && estado !== "A") continue;
        if (tipo === 1) {
          // Fila entidad: capturo nombre y ruc y sigo.
          // En el archivo SIAF, nombre_depend de la fila tipo 1 ES la entidad
          // (ej. "MUNICIPALIDAD DISTRITAL DE CHALLHUAHUACHO").
          const nombreEntidadIdx = extraMap.get("nombre_entidad");
          const rucEntidadIdx = extraMap.get("ruc_entidad");
          if (nombreEntidadIdx !== undefined && !cachedEntidad) {
            cachedEntidad = asText(r[nombreEntidadIdx], 200);
          } else if (!cachedEntidad) {
            // Fallback: nombre_depend de la fila tipo 1
            const nIdx = headerMap.get("nombre");
            if (nIdx !== undefined) cachedEntidad = asText(r[nIdx], 200);
          }
          if (rucEntidadIdx !== undefined && !cachedRuc) {
            cachedRuc = asText(r[rucEntidadIdx], 20);
          }
          continue;
        }
      }

      const raw: Record<string, unknown> = {};
      headerMap.forEach((colIdx, key) => {
        raw[String(key)] = r[colIdx];
      });

      // En SIAF, componemos responsable_nombre y responsable_cargo desde
      // las columnas sueltas (paterno + materno + nombres) y (cargo_depend).
      if (isSiaf && extraMap) {
        const pIdx = extraMap.get("paterno");
        const mIdx = extraMap.get("materno");
        const nIdx = extraMap.get("nombres");
        const cIdx = extraMap.get("cargo");
        const paterno = pIdx !== undefined ? asText(r[pIdx], 100) : null;
        const materno = mIdx !== undefined ? asText(r[mIdx], 100) : null;
        const nombres = nIdx !== undefined ? asText(r[nIdx], 100) : null;
        const composedName = [paterno, materno, nombres].filter(Boolean).join(" ").trim() || null;
        if (composedName) raw.responsable_nombre = composedName;
        if (cIdx !== undefined) {
          const cargo = asText(r[cIdx], 200);
          if (cargo) raw.responsable_cargo = cargo;
        }
        // Sufijo por defecto: si no hay abreviado_depend, usamos centro_costo.
        if (!raw.sufijo) {
          const ccIdx = extraMap.get("centro_costo");
          if (ccIdx !== undefined) {
            const cc = asText(r[ccIdx], 60);
            if (cc) raw.sufijo = cc;
          }
        }
        // Entidad: de la fila entidad cacheada o de la columna nombre_sede.
        if (!raw.entidad && cachedEntidad) raw.entidad = cachedEntidad;
        if (!raw.ruc && cachedRuc) raw.ruc = cachedRuc;
        // ruc vacio en siaf no es error
        if (raw.ruc === "" || raw.ruc === undefined) delete raw.ruc;
      }

      const result = OficinaRowSchema.safeParse(raw);
      if (!result.success) {
        const msg = result.error.issues.map((iss) => `${iss.path.join(".")}: ${iss.message}`).join("; ");
        errors.push({ row: i + 1, error: msg });
        continue;
      }
      parsed.push({ ...result.data, _row: i + 1 });
    }

    if (parsed.length === 0) {
      return NextResponse.json(
        { error: "No se encontraron filas válidas para importar", errors, preview: [] },
        { status: 400 },
      );
    }

    if (dryRun) {
      return NextResponse.json({
        dryRun: true,
        preview: parsed,
        errors,
        total: parsed.length,
        mode,
        detectedFormat: isSiaf ? "siaf" : "simple",
        cachedEntidad,
        cachedRuc,
      });
    }

    if (mode === "replace") {
      await supabaseRest("expedientes_oficinas", {
        method: "DELETE",
        headers: { Prefer: "return=minimal" },
      });
    }

    type OfficeRow = { id: string; nombre: string };
    let existing: OfficeRow[] = [];
    if (mode === "merge") {
      existing = await supabaseRest<OfficeRow[]>(
        `expedientes_oficinas?select=id,nombre`,
      ).catch(() => []);
    }
    const nameToId = new Map(existing.map((o) => [o.nombre.trim().toLowerCase(), o.id]));

    const created: string[] = [];
    const updated: string[] = [];
    const failed: RowError[] = [...errors];

    for (const row of parsed) {
      const id = nameToId.get(row.nombre.trim().toLowerCase());
      const payload = {
        nombre: row.nombre,
        entidad: asText(row.entidad),
        ruc: asText(row.ruc, 20),
        responsable_nombre: asText(row.responsable_nombre),
        responsable_cargo: asText(row.responsable_cargo),
        sufijo: asText(row.sufijo, 60),
        ancho: asInt(row.ancho, 1, 6, 3),
        activo: asBool(row.activo),
        updated_at: new Date().toISOString(),
      };
      try {
        if (id) {
          await supabaseRest(`expedientes_oficinas?id=eq.${id}`, {
            body: JSON.stringify(payload),
            method: "PATCH",
          });
          updated.push(id);
        } else {
          const [inserted] = await supabaseRest<Array<{ id: string }>>(
            "expedientes_oficinas?select=id",
            {
              body: JSON.stringify({ ...payload, created_by: auth.user.id }),
              method: "POST",
            },
          );
          if (inserted?.id) {
            created.push(inserted.id);
            await seedCounters(inserted.id);
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        failed.push({ row: row._row, error: msg });
      }
    }

    await writeAuditLog({
      action: "oficinas.import",
      actorReference: auth.user.email ?? auth.user.id,
      details: {
        mode,
        fileName: file.name,
        fileSize: file.size,
        created: created.length,
        updated: updated.length,
        failed: failed.length,
      },
      entityType: "oficina",
      module: "configuracion",
    });

    return NextResponse.json({
      ok: true,
      mode,
      summary: {
        totalRows: parsed.length,
        created: created.length,
        updated: updated.length,
        failed: failed.length,
        errors: failed,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo importar el archivo" },
      { status: 500 },
    );
  }
}
