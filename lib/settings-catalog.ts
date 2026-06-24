import type { AppRole, SessionUser } from "./auth";
import { PROCESS_TYPES, type TaxonomyOption } from "./legal-taxonomy";
import { areasForRole } from "./permisos-contratacion";
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
  return user.permissions.length > 0 ? user.permissions : areasForRole(user.role);
}

export function permissionsForRole(role: AppRole): CatalogPermission[] {
  return areasForRole(role);
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
