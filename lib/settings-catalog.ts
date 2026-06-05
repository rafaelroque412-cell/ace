import type { AppRole, SessionUser } from "./auth";
import { PROCESS_TYPES, type TaxonomyOption } from "./legal-taxonomy";
import { supabaseRest } from "./supabase-server";

export type CatalogEntity = {
  address: string;
  executingUnit: string;
  governmentLevel: string;
  name: string;
  ruc: string;
};

export type CatalogProcessType = TaxonomyOption & {
  active: boolean;
  category: "competitivo" | "no_competitivo" | "contrato_menor";
  frequentMunicipality: boolean;
  legalBasis: string;
  object: string;
  sortOrder: number;
};

export type CatalogPermission = {
  area: string;
  scope: string;
};

export type SettingsCatalog = {
  entity: CatalogEntity;
  processTypes: CatalogProcessType[];
  user: {
    email: string | null;
    entity: string | null;
    id: string;
    isAdmin: boolean;
    isDec: boolean;
    isLegal: boolean;
    permissions: CatalogPermission[];
    role: AppRole;
  };
};

type EntitySettingsRow = {
  address: string | null;
  executing_unit: string | null;
  government_level: string | null;
  name: string | null;
  ruc: string | null;
};

type ProcessTypeRow = {
  active: boolean;
  category?: string | null;
  code: string;
  frequent_municipality?: boolean | null;
  label: string;
  legal_basis?: string | null;
  object?: string | null;
  sort_order: number | null;
};

const rolePermissionMatrix: Record<AppRole, CatalogPermission[]> = {
  admin: [
    { area: "Consulta documental", scope: "Chat, busqueda, normas, historial y guardados." },
    { area: "Expedientes", scope: "Crear, actualizar y gestionar expedientes institucionales." },
    { area: "Biblioteca documental", scope: "Subir, reindexar y eliminar documentos del corpus." },
    { area: "Analisis juridico", scope: "Revision legal, riesgos, informes y fundamento juridico." },
    { area: "Validacion de procedimientos", scope: "Validar procedencia y fuentes; verificacion de corpus." },
    { area: "Evaluacion IA", scope: "Banco de preguntas, corridas y feedback institucional." },
    { area: "Monitoreo y auditoria", scope: "Metricas, auditoria, integraciones y verificacion operativa." },
    { area: "Configuracion", scope: "Entidad, procesos, usuarios, roles y permisos." },
  ],
  area_usuaria: [
    { area: "Consulta documental", scope: "Chat, busqueda, normas, historial y guardados." },
    { area: "Validacion de procedimientos", scope: "Validar procedencia y fuentes." },
  ],
  consulta: [
    { area: "Consulta documental", scope: "Chat, busqueda, normas, historial y guardados." },
    { area: "Validacion de procedimientos", scope: "Validar procedencia y fuentes." },
  ],
  dec: [
    { area: "Consulta documental", scope: "Chat, busqueda, normas, historial y guardados." },
    { area: "Expedientes", scope: "Crear, actualizar y gestionar expedientes institucionales." },
    { area: "Biblioteca documental", scope: "Subir, reindexar y eliminar documentos del corpus." },
    { area: "Validacion de procedimientos", scope: "Validar procedencia y fuentes." },
  ],
  legal: [
    { area: "Consulta documental", scope: "Chat, busqueda, normas, historial y guardados." },
    { area: "Analisis juridico", scope: "Revision legal, riesgos, informes y fundamento juridico." },
    { area: "Validacion de procedimientos", scope: "Validar procedencia y fuentes." },
  ],
};

const emptyEntity: CatalogEntity = {
  address: "",
  executingUnit: "",
  governmentLevel: "",
  name: "",
  ruc: "",
};

function normalizeCategory(value?: string | null): CatalogProcessType["category"] {
  if (value === "no_competitivo" || value === "contrato_menor") {
    return value;
  }

  return "competitivo";
}

function fallbackProcessTypes(): CatalogProcessType[] {
  return PROCESS_TYPES.filter((item) => item.value !== "todos").map((item, index) => ({
    active: true,
    category: "competitivo",
    frequentMunicipality: false,
    label: item.label,
    legalBasis: "",
    object: "",
    sortOrder: index + 1,
    value: item.value,
  }));
}

function processRowsToOptions(rows: ProcessTypeRow[]): CatalogProcessType[] {
  const activeRows = rows.filter((row) => row.active);

  if (activeRows.length === 0) {
    return fallbackProcessTypes();
  }

  return activeRows.map((row, index) => ({
    active: row.active,
    category: normalizeCategory(row.category),
    frequentMunicipality: Boolean(row.frequent_municipality),
    label: row.label,
    legalBasis: row.legal_basis ?? "",
    object: row.object ?? "",
    sortOrder: row.sort_order ?? index + 1,
    value: row.code,
  }));
}

function permissionsForUser(user: SessionUser): CatalogPermission[] {
  return user.permissions.length > 0 ? user.permissions : rolePermissionMatrix[user.role];
}

export function permissionsForRole(role: AppRole): CatalogPermission[] {
  return rolePermissionMatrix[role];
}

export async function getSettingsCatalog(user: SessionUser): Promise<SettingsCatalog> {
  const [entityRows, processRows] = await Promise.all([
    supabaseRest<EntitySettingsRow[]>(
      "entity_settings?id=eq.default&select=name,ruc,executing_unit,address,government_level&limit=1",
    ).catch(() => []),
    supabaseRest<ProcessTypeRow[]>(
      "process_type_settings?select=code,label,active,category,object,legal_basis,frequent_municipality,sort_order&active=eq.true&order=sort_order.asc,label.asc",
    ).catch(() => []),
  ]);

  const entity = entityRows[0];

  return {
    entity: entity
      ? {
          address: entity.address ?? "",
          executingUnit: entity.executing_unit ?? "",
          governmentLevel: entity.government_level ?? "",
          name: entity.name ?? "",
          ruc: entity.ruc ?? "",
        }
      : emptyEntity,
    processTypes: processRowsToOptions(processRows),
    user: {
      email: user.email,
      entity: user.entity || entity?.name || null,
      id: user.id,
      isAdmin: user.isAdmin,
      isDec: user.isDec,
      isLegal: user.isLegal,
      permissions: permissionsForUser(user),
      role: user.role,
    },
  };
}
