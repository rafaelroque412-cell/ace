import { NextResponse } from "next/server";
import { createClient as createSupabaseAdminClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { APP_ROLES, type AppRole, areasForRole } from "@/lib/permisos-contratacion";
import { getSupabaseServerConfig, supabaseRest, writeAuditLog } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const userRoleSchema = z.enum(
  APP_ROLES.map((role) => role.value) as [AppRole, ...AppRole[]],
);

const createUserSchema = z.object({
  email: z.string().trim().email(),
  entity: z.string().trim().max(180).optional().or(z.literal("")),
  password: z.string().min(8).max(120).optional().or(z.literal("")),
  role: userRoleSchema,
});

const seedSchema = z.object({
  entity: z.string().trim().max(180).optional().or(z.literal("")),
});

type ProfileRow = {
  created_at: string | null;
  email: string | null;
  entity: string | null;
  id: string;
  metadata?: Record<string, unknown> | null;
  role: string;
};

function adminClient() {
  const { serviceRoleKey, supabaseUrl } = getSupabaseServerConfig();
  return createSupabaseAdminClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function temporaryPassword() {
  const token = crypto.randomUUID().replace(/-/g, "").slice(0, 14);
  return `Ace-${token}!9`;
}

function profileEmailForRole(role: AppRole) {
  return `${role.replace("_", ".")}@ace.local`;
}

function profileMetadata(role: AppRole, entity?: string | null) {
  return {
    entity: entity || null,
    permissionVersion: "ace-role-matrix-v1",
    permissions: areasForRole(role),
    role,
    updatedAt: new Date().toISOString(),
  };
}

async function findAuthUserByEmail(email: string) {
  const supabase = adminClient();
  const target = email.toLowerCase();
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw new Error(error.message);
    const found = data.users.find((user) => user.email?.toLowerCase() === target);
    if (found) return found;
    if (data.users.length < 100) return null;
  }
  return null;
}

async function upsertProfile(input: {
  email: string;
  entity?: string | null;
  role: AppRole;
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

async function createOrLinkUser(input: {
  email: string;
  entity?: string | null;
  password: string;
  role: AppRole;
}) {
  const supabase = adminClient();
  const metadata = profileMetadata(input.role, input.entity);
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
  const alreadyExists =
    error?.message.toLowerCase().includes("already") ||
    error?.message.toLowerCase().includes("registered");
  if (!alreadyExists) throw new Error(error?.message ?? "No se pudo crear usuario");

  const existing = await findAuthUserByEmail(input.email);
  if (!existing) {
    throw new Error(
      "El correo ya existe en Auth, pero no se pudo localizar para vincularlo al perfil ACE.",
    );
  }
  const { error: updateError } = await supabase.auth.admin.updateUserById(existing.id, {
    user_metadata: metadata,
  });
  if (updateError) throw new Error(updateError.message);
  await upsertProfile({
    email: input.email,
    entity: input.entity || null,
    role: input.role,
    userId: existing.id,
  });
  return { status: "linked" as const, userId: existing.id };
}

function permissionsForRole(role: AppRole) {
  return areasForRole(role);
}

function shapeUser(profile: ProfileRow) {
  const parsedRole = userRoleSchema.safeParse(profile.role);
  return {
    createdAt: profile.created_at,
    email: profile.email,
    entity: profile.entity ?? "",
    id: profile.id,
    permissions: Array.isArray(profile.metadata?.permissions)
      ? profile.metadata.permissions
      : permissionsForRole(parsedRole.success ? (profile.role as AppRole) : "consulta"),
    role: profile.role,
  };
}

// GET /api/configuracion/users?limit=200
// Lista todos los perfiles de usuario. Para >200, agregar paginacion luego.
export async function GET(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  try {
    const limit = Math.min(500, Math.max(1, parseInt(new URL(request.url).searchParams.get("limit") ?? "200", 10) || 200));
    const profileRows = await supabaseRest<ProfileRow[]>(
      `profiles?select=id,email,role,entity,metadata,created_at&order=created_at.desc&limit=${limit}`,
    ).catch(() => []);
    return NextResponse.json({ users: profileRows.map(shapeUser) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo listar usuarios" },
      { status: 500 },
    );
  }
}

// POST /api/configuracion/users
// Body: { email, role, entity?, password? }
// Crea o vincula un usuario y devuelve credenciales si fue creado.
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  const payload = createUserSchema.safeParse(await request.json().catch(() => ({})));
  if (!payload.success) {
    return NextResponse.json(
      { error: "Datos invalidos", details: payload.error.flatten() },
      { status: 400 },
    );
  }
  try {
    const password = payload.data.password || temporaryPassword();
    const result = await createOrLinkUser({
      email: payload.data.email,
      entity: payload.data.entity || null,
      password,
      role: payload.data.role,
    });
    const responseBody: {
      status: "created" | "linked";
      email: string;
      role: AppRole;
      password?: string;
    } = {
      status: result.status,
      email: payload.data.email,
      role: payload.data.role,
    };
    if (result.status === "created") {
      responseBody.password = password;
    }
    await writeAuditLog({
      action: "settings.user.create",
      actorReference: auth.user.email ?? auth.user.id,
      details: {
        status: result.status,
        email: payload.data.email,
        role: payload.data.role,
        user: { email: auth.user.email, id: auth.user.id, role: auth.user.role },
      },
      entityId: result.userId,
      entityType: "profile",
    });
    return NextResponse.json(responseBody, { status: result.status === "created" ? 201 : 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo crear usuario" },
      { status: 500 },
    );
  }
}

// DELETE /api/configuracion/users?userId=X
// Quita acceso al usuario (lo elimina de Auth y de profiles).
// No permite eliminarse a si mismo.
export async function DELETE(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  const userId = new URL(request.url).searchParams.get("userId");
  if (!userId) {
    return NextResponse.json({ error: "Falta userId" }, { status: 400 });
  }
  try {
    if (userId === auth.user.id) {
      return NextResponse.json(
        { error: "No puedes eliminar tu propio usuario activo" },
        { status: 400 },
      );
    }
    const supabase = adminClient();
    const { error } = await supabase.auth.admin.deleteUser(userId);
    if (error) throw new Error(error.message);
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
    return NextResponse.json({ deleted: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo eliminar" },
      { status: 500 },
    );
  }
}
