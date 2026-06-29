import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { APP_AREAS, APP_ROLES, type AppRole, areasForRole } from "@/lib/permisos-contratacion";
import { supabaseRest, writeAuditLog } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const governmentLevels = ["gobierno_nacional", "gobierno_regional", "gobierno_local"] as const;

const entitySchema = z.object({
  address: z.string().trim().min(5).max(260),
  executingUnit: z.string().trim().regex(/^\d{6}$/, "La unidad ejecutora debe tener 6 digitos"),
  governmentLevel: z.enum(governmentLevels),
  name: z.string().trim().min(3).max(180),
  ruc: z.string().trim().regex(/^\d{11}$/, "El RUC debe tener 11 digitos"),
});

const processTypeSchema = z.object({
  active: z.boolean().default(true),
  category: z.enum(["competitivo", "no_competitivo", "contrato_menor"]).default("competitivo"),
  code: z.string().trim().min(2).max(80).regex(/^[a-z0-9_]+$/),
  description: z.string().trim().max(400).optional().or(z.literal("")),
  frequentMunicipality: z.boolean().default(false),
  label: z.string().trim().min(3).max(140),
  legalBasis: z.string().trim().max(260).optional().or(z.literal("")),
  object: z.string().trim().max(160).optional().or(z.literal("")),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
});

const saveSchema = z.object({
  entity: entitySchema,
  processTypes: z.array(processTypeSchema).min(1).max(50),
});

type EntitySettingsRow = {
  address: string | null;
  executing_unit: string | null;
  government_level: string | null;
  id: string;
  name: string | null;
  ruc: string | null;
  updated_at: string | null;
};

type ProcessTypeRow = {
  active: boolean;
  category?: string | null;
  code: string;
  description: string | null;
  frequent_municipality?: boolean | null;
  label: string;
  legal_basis?: string | null;
  object?: string | null;
  sort_order: number;
  updated_at: string | null;
};

const governmentLevelOptions = [
  {
    examples: "Ministerios, organismos publicos, programas y organismos constitucionales autonomos",
    label: "Gobierno Nacional",
    value: "gobierno_nacional",
  },
  {
    examples: "Gobiernos Regionales",
    label: "Gobierno Regional",
    value: "gobierno_regional",
  },
  {
    examples: "Municipalidades Provinciales y Municipalidades Distritales",
    label: "Gobierno Local",
    value: "gobierno_local",
  },
] as const;

const roles = APP_ROLES.map((role) => ({
  description: role.description,
  label: role.label,
  value: role.value,
}));

const rolePermissions = APP_AREAS.map((area) => ({
  area: area.area,
  permissions: Object.fromEntries(
    APP_ROLES.map((role) => [role.value, role.value === "admin" || area.roles.includes(role.value)]),
  ) as Record<AppRole, boolean>,
  scope: area.scope,
}));

function defaultProcessTypes(): ProcessTypeRow[] {
  const rows: Array<Omit<ProcessTypeRow, "sort_order" | "updated_at">> = [
    { active: true, category: "competitivo", code: "licitacion_publica_bienes", description: "Procedimiento competitivo para contratacion de bienes.", frequent_municipality: false, label: "Licitacion Publica para Bienes", legal_basis: "Ley 32069, Reglamento y Bases Estandar DGA", object: "Bienes" },
    { active: true, category: "competitivo", code: "licitacion_publica_abreviada_bienes", description: "Procedimiento competitivo abreviado para contratacion de bienes.", frequent_municipality: false, label: "Licitacion Publica Abreviada para Bienes", legal_basis: "Ley 32069, Reglamento y Bases Estandar DGA", object: "Bienes" },
    { active: true, category: "competitivo", code: "licitacion_publica_obras", description: "Procedimiento competitivo para ejecucion de obras.", frequent_municipality: false, label: "Licitacion Publica para Obras", legal_basis: "Ley 32069, Reglamento y Bases Estandar DGA", object: "Obras" },
    { active: true, category: "competitivo", code: "licitacion_publica_abreviada_obras", description: "Procedimiento competitivo abreviado para ejecucion de obras.", frequent_municipality: true, label: "Licitacion Publica Abreviada para Obras", legal_basis: "Ley 32069, Reglamento y Bases Estandar DGA", object: "Obras" },
    { active: true, category: "competitivo", code: "concurso_publico_servicios", description: "Procedimiento competitivo para servicios.", frequent_municipality: false, label: "Concurso Publico de Servicios", legal_basis: "Ley 32069, Reglamento y Bases Estandar DGA", object: "Servicios" },
    { active: true, category: "competitivo", code: "concurso_publico_abreviado_servicios", description: "Procedimiento competitivo abreviado para servicios.", frequent_municipality: true, label: "Concurso Publico Abreviado de Servicios", legal_basis: "Ley 32069, Reglamento y Bases Estandar DGA", object: "Servicios" },
    { active: true, category: "competitivo", code: "concurso_publico_consultoria", description: "Incluye consultorias y servicios de mantenimiento vial.", frequent_municipality: false, label: "Concurso Publico para Consultorias y Servicios de Mantenimiento Vial", legal_basis: "Ley 32069, Reglamento y Bases Estandar DGA", object: "Consultorias" },
    { active: true, category: "competitivo", code: "concurso_publico_abreviado_consultoria", description: "Procedimiento abreviado para consultorias y mantenimiento vial.", frequent_municipality: false, label: "Concurso Publico Abreviado para Consultorias y Servicios de Mantenimiento Vial", legal_basis: "Ley 32069, Reglamento y Bases Estandar DGA", object: "Consultorias" },
    { active: true, category: "competitivo", code: "concurso_publico_expertos", description: "Procedimiento competitivo abreviado para expertos.", frequent_municipality: false, label: "Concurso Publico Abreviado para Expertos", legal_basis: "Ley 32069, Reglamento y Bases Estandar DGA", object: "Expertos" },
    { active: true, category: "competitivo", code: "concurso_publico_gerente_proyecto", description: "Procedimiento para gerentes de proyecto.", frequent_municipality: false, label: "Concurso Publico para Gerentes de Proyecto", legal_basis: "Ley 32069, Reglamento y Bases Estandar DGA", object: "Gerentes de Proyecto" },
    { active: true, category: "competitivo", code: "subasta_inversa_electronica", description: "Para bienes y servicios estandarizados; requiere ficha tecnica y directiva aplicable.", frequent_municipality: true, label: "Subasta Inversa Electronica", legal_basis: "Ley 32069, Reglamento, Directiva aplicable y Bases Estandar DGA", object: "Bienes y servicios estandarizados" },
    { active: true, category: "competitivo", code: "comparacion_precios", description: "Procedimiento competitivo donde el precio es factor central conforme a Reglamento.", frequent_municipality: true, label: "Comparacion de Precios", legal_basis: "Ley 32069 (art. 4) y su Reglamento (D.S. 009-2025-EF)", object: "Bienes y servicios" },
    { active: true, category: "competitivo", code: "concurso_proyectos_arquitectonicos", description: "Procedimiento competitivo para proyectos arquitectonicos y urbanisticos.", frequent_municipality: false, label: "Concurso de Proyectos Arquitectonicos y Urbanisticos", legal_basis: "Ley 32069, Reglamento y Bases Estandar DGA", object: "Proyectos arquitectonicos y urbanisticos" },
    { active: true, category: "no_competitivo", code: "procedimiento_no_competitivo", description: "Incluye supuestos como emergencia, proveedor unico, contrato resuelto o nulo, continuacion de prestaciones y otros previstos por Ley.", frequent_municipality: true, label: "Procedimiento de Seleccion No Competitivo", legal_basis: "Ley 32069 articulo 55 y Reglamento", object: "Supuestos excepcionales previstos por Ley" },
    { active: true, category: "contrato_menor", code: "contrato_menor", description: "No constituye procedimiento de seleccion competitivo; aplica reglas especiales.", frequent_municipality: true, label: "Contrato Menor", legal_basis: "Ley 32069; hasta 8 UIT", object: "Contrataciones hasta 8 UIT" },
  ];
  return rows.map((row, index) => ({ ...row, sort_order: index + 1, updated_at: null }));
}

async function getSettings() {
  const [entityRows, processRows] = await Promise.all([
    supabaseRest<EntitySettingsRow[]>(
      "entity_settings?id=eq.default&select=id,name,ruc,executing_unit,address,government_level,updated_at&limit=1",
    ).catch(() => []),
    supabaseRest<ProcessTypeRow[]>(
      "process_type_settings?select=code,label,description,active,category,object,legal_basis,frequent_municipality,sort_order,updated_at&order=sort_order.asc,label.asc",
    ).catch(() => []),
  ]);

  const entity = entityRows[0] ?? null;
  const processTypes = processRows.length > 0 ? processRows : defaultProcessTypes();

  return {
    entity: entity
      ? {
          address: entity.address ?? "",
          executingUnit: entity.executing_unit ?? "",
          governmentLevel: entity.government_level ?? "",
          name: entity.name ?? "",
          ruc: entity.ruc ?? "",
          updatedAt: entity.updated_at,
        }
      : { address: "", executingUnit: "", governmentLevel: "", name: "", ruc: "", updatedAt: null },
    governmentLevels: governmentLevelOptions,
    processTypes: processTypes.map((item) => ({
      active: item.active,
      category: item.category ?? "competitivo",
      code: item.code,
      description: item.description ?? "",
      frequentMunicipality: Boolean(item.frequent_municipality),
      label: item.label,
      legalBasis: item.legal_basis ?? "",
      object: item.object ?? "",
      sortOrder: item.sort_order,
      updatedAt: item.updated_at,
    })),
    roles,
    rolePermissions,
  };
}

// GET /api/configuracion/settings
// Devuelve la configuracion institucional: entidad, niveles de gobierno,
// catalogo de procesos, roles y matriz de permisos (derivada de
// lib/permisos-contratacion).
export async function GET() {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  try {
    return NextResponse.json(await getSettings());
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo cargar configuracion" },
      { status: 500 },
    );
  }
}

// PUT /api/configuracion/settings
// Guarda la entidad y el catalogo de procesos. El cliente debe mandar TODOS
// los procesos (upsert por code), no se soporta diff por item.
export async function PUT(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  const payload = saveSchema.safeParse(await request.json().catch(() => ({})));
  if (!payload.success) {
    return NextResponse.json(
      { error: "Datos invalidos", details: payload.error.flatten() },
      { status: 400 },
    );
  }
  try {
    const { entity, processTypes } = payload.data;
    await supabaseRest("entity_settings?on_conflict=id", {
      body: JSON.stringify({
        address: entity.address,
        executing_unit: entity.executingUnit,
        government_level: entity.governmentLevel,
        id: "default",
        name: entity.name,
        ruc: entity.ruc,
        updated_by: auth.user.id,
      }),
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      method: "POST",
    });
    await supabaseRest("process_type_settings?on_conflict=code", {
      body: JSON.stringify(
        processTypes.map((item) => ({
          active: item.active,
          category: item.category,
          code: item.code,
          description: item.description || null,
          frequent_municipality: item.frequentMunicipality,
          label: item.label,
          legal_basis: item.legalBasis || null,
          object: item.object || null,
          sort_order: item.sortOrder,
          updated_by: auth.user.id,
        })),
      ),
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      method: "POST",
    });
    await writeAuditLog({
      action: "settings.update",
      actorReference: auth.user.email ?? auth.user.id,
      details: {
        entity: { governmentLevel: entity.governmentLevel, name: entity.name, ruc: entity.ruc },
        processTypeCount: processTypes.length,
        user: { email: auth.user.email, id: auth.user.id, role: auth.user.role },
      },
      entityType: "settings",
    });
    return NextResponse.json({ saved: true, ...(await getSettings()) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo guardar configuracion" },
      { status: 500 },
    );
  }
}
