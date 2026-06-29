import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import {
  APP_ROLES,
  type AppRole,
  areasForRole,
} from "@/lib/permisos-contratacion";
import {
  getSupabaseServerConfig,
  supabaseRest,
  writeAuditLog,
} from "@/lib/supabase-server";
import { createClient as createSupabaseAdminClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const userRoleSchema = z.enum(
  APP_ROLES.map((role) => role.value) as [AppRole, ...AppRole[]],
);

const updateUserSchema = z.object({
  entity: z.string().trim().max(180).optional().or(z.literal("")),
  role: userRoleSchema,
});

function adminClient() {
  const { serviceRoleKey, supabaseUrl } = getSupabaseServerConfig();
  return createSupabaseAdminClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
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

// PATCH /api/configuracion/users/[id]
// Body: { role, entity? }
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Falta el id del usuario" }, { status: 400 });
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
    const { error: updateAuthError } = await adminClient().auth.admin.updateUserById(id, {
      user_metadata: metadata,
    });
    if (updateAuthError) throw new Error(updateAuthError.message);
    await supabaseRest(`profiles?id=eq.${id}`, {
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
        targetUserId: id,
        entity: data.entity || null,
        role: data.role,
        user: { email: auth.user.email, id: auth.user.id, role: auth.user.role },
      },
      entityId: id,
      entityType: "profile",
    });
    return NextResponse.json({ saved: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo actualizar usuario" },
      { status: 500 },
    );
  }
}
