import { NextResponse } from "next/server";
import { createClient as createSupabaseAdminClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { APP_AREAS, APP_ROLES, type AppRole, areasForRole } from "@/lib/permisos-contratacion";
import { getSupabaseServerConfig, supabaseRest, writeAuditLog } from "@/lib/supabase-server";

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

const userRoleSchema = z.enum(APP_ROLES.map((role) => role.value) as [AppRole, ...AppRole[]]);
const updateUserSchema = z.object({
  action: z.literal("update_user"),
  entity: z.string().trim().max(180).optional().or(z.literal("")),
  role: userRoleSchema,
  userId: z.string().uuid(),
});
const createUserSchema = z.object({
  action: z.literal("create_user"),
  email: z.string().trim().email(),
  entity: z.string().trim().max(180).optional().or(z.literal("")),
  password: z.string().min(8).max(120).optional().or(z.literal("")),
  role: userRoleSchema,
});
const seedUsersSchema = z.object({
  action: z.literal("seed_role_users"),
  entity: z.string().trim().max(180).optional().or(z.literal("")),
});
const userActionSchema = z.discriminatedUnion("action", [createUserSchema, seedUsersSchema]);

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

type ProfileRow = {
  created_at: string | null;
  email: string | null;
  entity: string | null;
  id: string;
  metadata?: Record<string, unknown> | null;
  role: string;
};

// Catalogo de roles y matriz de areas: derivados del modelo central
// (lib/permisos-contratacion.ts) para evitar divergencias.
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

function adminClient() {
  const { serviceRoleKey, supabaseUrl } = getSupabaseServerConfig();
  return createSupabaseAdminClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function temporaryPassword() {
  const token = crypto.randomUUID().replace(/-/g, "").slice(0, 14);
  return `Ace-${token}!9`;
}

function profileEmailForRole(role: z.infer<typeof userRoleSchema>) {
  return `${role.replace("_", ".")}@ace.local`;
}

function permissionsForRole(role: z.infer<typeof userRoleSchema>) {
  return areasForRole(role);
}

function profileMetadata(role: z.infer<typeof userRoleSchema>, entity?: string | null) {
  return {
    entity: entity || null,
    permissionVersion: "ace-role-matrix-v1",
    permissions: permissionsForRole(role),
    role,
    updatedAt: new Date().toISOString(),
  };
}

async function findAuthUserByEmail(email: string) {
  const supabase = adminClient();
  const target = email.toLowerCase();

  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 100 });
    if (error) {
      throw new Error(error.message);
    }

    const found = data.users.find((user) => user.email?.toLowerCase() === target);
    if (found) {
      return found;
    }

    if (data.users.length < 100) {
      return null;
    }
  }

  return null;
}

function authMetadata(role: z.infer<typeof userRoleSchema>, entity?: string | null) {
  return profileMetadata(role, entity);
}

async function createOrLinkUser(input: {
  email: string;
  entity?: string | null;
  password: string;
  role: z.infer<typeof userRoleSchema>;
}) {
  const supabase = adminClient();
  const metadata = authMetadata(input.role, input.entity);
  const { data, error } = await supabase.auth.admin.createUser({
    email: input.email,
    email_confirm: true,
    password: input.password,
    user_metadata: metadata,
  });

  if (data.user && !error) {
    await upsertProfile({
      email: input.email,
      entity: input.entity || null,
      role: input.role,
      userId: data.user.id,
    });
    return { status: "created" as const, userId: data.user.id };
  }

  const alreadyExists = error?.message.toLowerCase().includes("already") || error?.message.toLowerCase().includes("registered");
  if (!alreadyExists) {
    throw new Error(error?.message ?? "No se pudo crear usuario");
  }

  const existing = await findAuthUserByEmail(input.email);
  if (!existing) {
    throw new Error("El correo ya existe en Auth, pero no se pudo localizar para vincularlo al perfil ACE.");
  }

  const { error: updateError } = await supabase.auth.admin.updateUserById(existing.id, {
    user_metadata: metadata,
  });
  if (updateError) {
    throw new Error(updateError.message);
  }

  await upsertProfile({
    email: input.email,
    entity: input.entity || null,
    role: input.role,
    userId: existing.id,
  });

  return { status: "linked" as const, userId: existing.id };
}

async function upsertProfile(input: {
  email: string;
  entity?: string | null;
  role: z.infer<typeof userRoleSchema>;
  userId: string;
}) {
  await supabaseRest("profiles?on_conflict=id", {
    body: JSON.stringify({
      email: input.email,
      entity: input.entity || null,
      id: input.userId,
      metadata: profileMetadata(input.role, input.entity),
      role: input.role,
    }),
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    method: "POST",
  });
}

function defaultProcessTypes(): ProcessTypeRow[] {
  const rows: Array<Omit<ProcessTypeRow, "sort_order" | "updated_at">> = [
    {
      active: true,
      category: "competitivo",
      code: "licitacion_publica_bienes",
      description: "Procedimiento competitivo para contratacion de bienes.",
      frequent_municipality: false,
      label: "Licitacion Publica para Bienes",
      legal_basis: "Ley 32069, Reglamento y Bases Estandar DGA",
      object: "Bienes",
    },
    {
      active: true,
      category: "competitivo",
      code: "licitacion_publica_abreviada_bienes",
      description: "Procedimiento competitivo abreviado para contratacion de bienes.",
      frequent_municipality: false,
      label: "Licitacion Publica Abreviada para Bienes",
      legal_basis: "Ley 32069, Reglamento y Bases Estandar DGA",
      object: "Bienes",
    },
    {
      active: true,
      category: "competitivo",
      code: "licitacion_publica_obras",
      description: "Procedimiento competitivo para ejecucion de obras.",
      frequent_municipality: false,
      label: "Licitacion Publica para Obras",
      legal_basis: "Ley 32069, Reglamento y Bases Estandar DGA",
      object: "Obras",
    },
    {
      active: true,
      category: "competitivo",
      code: "licitacion_publica_abreviada_obras",
      description: "Procedimiento competitivo abreviado para ejecucion de obras.",
      frequent_municipality: true,
      label: "Licitacion Publica Abreviada para Obras",
      legal_basis: "Ley 32069, Reglamento y Bases Estandar DGA",
      object: "Obras",
    },
    {
      active: true,
      category: "competitivo",
      code: "concurso_publico_servicios",
      description: "Procedimiento competitivo para servicios.",
      frequent_municipality: false,
      label: "Concurso Publico de Servicios",
      legal_basis: "Ley 32069, Reglamento y Bases Estandar DGA",
      object: "Servicios",
    },
    {
      active: true,
      category: "competitivo",
      code: "concurso_publico_abreviado_servicios",
      description: "Procedimiento competitivo abreviado para servicios.",
      frequent_municipality: true,
      label: "Concurso Publico Abreviado de Servicios",
      legal_basis: "Ley 32069, Reglamento y Bases Estandar DGA",
      object: "Servicios",
    },
    {
      active: true,
      category: "competitivo",
      code: "concurso_publico_consultoria",
      description: "Incluye consultorias y servicios de mantenimiento vial.",
      frequent_municipality: false,
      label: "Concurso Publico para Consultorias y Servicios de Mantenimiento Vial",
      legal_basis: "Ley 32069, Reglamento y Bases Estandar DGA",
      object: "Consultorias",
    },
    {
      active: true,
      category: "competitivo",
      code: "concurso_publico_abreviado_consultoria",
      description: "Procedimiento abreviado para consultorias y mantenimiento vial.",
      frequent_municipality: false,
      label: "Concurso Publico Abreviado para Consultorias y Servicios de Mantenimiento Vial",
      legal_basis: "Ley 32069, Reglamento y Bases Estandar DGA",
      object: "Consultorias",
    },
    {
      active: true,
      category: "competitivo",
      code: "concurso_publico_expertos",
      description: "Procedimiento competitivo abreviado para expertos.",
      frequent_municipality: false,
      label: "Concurso Publico Abreviado para Expertos",
      legal_basis: "Ley 32069, Reglamento y Bases Estandar DGA",
      object: "Expertos",
    },
    {
      active: true,
      category: "competitivo",
      code: "concurso_publico_gerente_proyecto",
      description: "Procedimiento para gerentes de proyecto.",
      frequent_municipality: false,
      label: "Concurso Publico para Gerentes de Proyecto",
      legal_basis: "Ley 32069, Reglamento y Bases Estandar DGA",
      object: "Gerentes de Proyecto",
    },
    {
      active: true,
      category: "competitivo",
      code: "subasta_inversa_electronica",
      description: "Para bienes y servicios estandarizados; requiere ficha tecnica y directiva aplicable.",
      frequent_municipality: true,
      label: "Subasta Inversa Electronica",
      legal_basis: "Ley 32069, Reglamento, Directiva aplicable y Bases Estandar DGA",
      object: "Bienes y servicios estandarizados",
    },
    {
      active: true,
      category: "competitivo",
      code: "comparacion_precios",
      description: "Procedimiento competitivo donde el precio es factor central conforme a Reglamento.",
      frequent_municipality: true,
      label: "Comparacion de Precios",
      legal_basis: "Ley 32069 (art. 4) y su Reglamento (D.S. 009-2025-EF)",
      object: "Bienes y servicios",
    },
    {
      active: true,
      category: "competitivo",
      code: "concurso_proyectos_arquitectonicos",
      description: "Procedimiento competitivo para proyectos arquitectonicos y urbanisticos.",
      frequent_municipality: false,
      label: "Concurso de Proyectos Arquitectonicos y Urbanisticos",
      legal_basis: "Ley 32069, Reglamento y Bases Estandar DGA",
      object: "Proyectos arquitectonicos y urbanisticos",
    },
    {
      active: true,
      category: "no_competitivo",
      code: "procedimiento_no_competitivo",
      description: "Incluye supuestos como emergencia, proveedor unico, contrato resuelto o nulo, continuacion de prestaciones y otros previstos por Ley.",
      frequent_municipality: true,
      label: "Procedimiento de Seleccion No Competitivo",
      legal_basis: "Ley 32069 articulo 55 y Reglamento",
      object: "Supuestos excepcionales previstos por Ley",
    },
    {
      active: true,
      category: "contrato_menor",
      code: "contrato_menor",
      description: "No constituye procedimiento de seleccion competitivo; aplica reglas especiales.",
      frequent_municipality: true,
      label: "Contrato Menor",
      legal_basis: "Ley 32069; hasta 8 UIT",
      object: "Contrataciones hasta 8 UIT",
    },
  ];

  return rows.map((row, index) => ({ ...row, sort_order: index + 1, updated_at: null }));
}

async function getSettings() {
  const [entityRows, processRows, profileRows] = await Promise.all([
    supabaseRest<EntitySettingsRow[]>(
      "entity_settings?id=eq.default&select=id,name,ruc,executing_unit,address,government_level,updated_at&limit=1",
    ).catch(() => []),
    supabaseRest<ProcessTypeRow[]>(
      "process_type_settings?select=code,label,description,active,category,object,legal_basis,frequent_municipality,sort_order,updated_at&order=sort_order.asc,label.asc",
    ).catch(() => []),
    supabaseRest<ProfileRow[]>(
      "profiles?select=id,email,role,entity,metadata,created_at&order=created_at.desc&limit=200",
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
      : {
          address: "",
          executingUnit: "",
          governmentLevel: "",
          name: "",
          ruc: "",
          updatedAt: null,
        },
    governmentLevels: [
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
    ],
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
    users: profileRows.map((item) => ({
      createdAt: item.created_at,
      email: item.email,
      entity: item.entity ?? "",
      id: item.id,
      permissions: Array.isArray(item.metadata?.permissions)
        ? item.metadata.permissions
        : permissionsForRole(userRoleSchema.safeParse(item.role).success ? (item.role as z.infer<typeof userRoleSchema>) : "consulta"),
      role: item.role,
    })),
  };
}

export async function GET() {
  const auth = await requireAdmin();
  if ("error" in auth) {
    return auth.error;
  }

  try {
    return NextResponse.json(await getSettings());
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo cargar configuracion" },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) {
    return auth.error;
  }

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
        entity: {
          governmentLevel: entity.governmentLevel,
          name: entity.name,
          ruc: entity.ruc,
        },
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

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) {
    return auth.error;
  }

  const payload = userActionSchema.safeParse(await request.json().catch(() => ({})));
  if (!payload.success) {
    return NextResponse.json(
      { error: "Datos invalidos", details: payload.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const createdCredentials: Array<{ email: string; password: string; role: string }> = [];
    const linkedUsers: Array<{ email: string; role: string; userId: string }> = [];

    if (payload.data.action === "create_user") {
      const password = payload.data.password || temporaryPassword();
      const result = await createOrLinkUser({
        email: payload.data.email,
        entity: payload.data.entity || null,
        password,
        role: payload.data.role,
      });

      if (result.status === "created") {
        createdCredentials.push({ email: payload.data.email, password, role: payload.data.role });
      } else {
        linkedUsers.push({ email: payload.data.email, role: payload.data.role, userId: result.userId });
      }
    }

    if (payload.data.action === "seed_role_users") {
      for (const role of userRoleSchema.options) {
        const email = profileEmailForRole(role);
        const password = temporaryPassword();
        const result = await createOrLinkUser({
          email,
          entity: payload.data.entity || null,
          password,
          role,
        });

        if (result.status === "created") {
          createdCredentials.push({ email, password, role });
        } else {
          linkedUsers.push({ email, role, userId: result.userId });
        }
      }
    }

    await writeAuditLog({
      action: payload.data.action === "create_user" ? "settings.user.create" : "settings.user.seed_roles",
      actorReference: auth.user.email ?? auth.user.id,
      details: {
        created: createdCredentials.map((item) => ({ email: item.email, role: item.role })),
        linked: linkedUsers,
        user: { email: auth.user.email, id: auth.user.id, role: auth.user.role },
      },
      entityType: "profile",
    });

    return NextResponse.json({
      createdCredentials,
      linkedUsers,
      saved: true,
      ...(await getSettings()),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo crear usuario" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) {
    return auth.error;
  }

  const payload = updateUserSchema.safeParse(await request.json().catch(() => ({})));
  if (!payload.success) {
    return NextResponse.json(
      { error: "Datos invalidos", details: payload.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const data = payload.data;
    const metadata = profileMetadata(data.role, data.entity || null);
    const { error: updateAuthError } = await adminClient().auth.admin.updateUserById(data.userId, {
      user_metadata: metadata,
    });
    if (updateAuthError) {
      throw new Error(updateAuthError.message);
    }

    await supabaseRest(`profiles?id=eq.${data.userId}`, {
      body: JSON.stringify({
        entity: data.entity || null,
        metadata,
        role: data.role,
      }),
      method: "PATCH",
    });

    await writeAuditLog({
      action: "settings.user.update",
      actorReference: auth.user.email ?? auth.user.id,
      details: {
        targetUserId: data.userId,
        entity: data.entity || null,
        role: data.role,
        user: { email: auth.user.email, id: auth.user.id, role: auth.user.role },
      },
      entityId: data.userId,
      entityType: "profile",
    });

    return NextResponse.json({ saved: true, ...(await getSettings()) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo actualizar usuario" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) {
    return auth.error;
  }

  const userId = new URL(request.url).searchParams.get("userId");
  if (!userId) {
    return NextResponse.json({ error: "Falta userId" }, { status: 400 });
  }

  try {
    if (userId === auth.user.id) {
      return NextResponse.json({ error: "No puedes eliminar tu propio usuario activo" }, { status: 400 });
    }

    const supabase = adminClient();
    const { error } = await supabase.auth.admin.deleteUser(userId);

    if (error) {
      throw new Error(error.message);
    }

    await supabaseRest(`profiles?id=eq.${userId}`, { method: "DELETE" }).catch(() => undefined);

    await writeAuditLog({
      action: "settings.user.delete",
      actorReference: auth.user.email ?? auth.user.id,
      details: {
        targetUserId: userId,
        user: { email: auth.user.email, id: auth.user.id, role: auth.user.role },
      },
      entityId: userId,
      entityType: "profile",
    });

    return NextResponse.json({ deleted: true, ...(await getSettings()) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo eliminar usuario" },
      { status: 500 },
    );
  }
}
