import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Roles del SDD "IA Contrataciones Publicas". Los valores antiguos user/editor
// se normalizan a consulta/dec para compatibilidad.
export type AppRole = "consulta" | "area_usuaria" | "dec" | "legal" | "admin";

export type AppPermission = {
  area: string;
  scope: string;
};

export type SessionUser = {
  accessToken: string;
  email: string | null;
  entity: string | null;
  id: string;
  isAdmin: boolean;
  // dec o admin: gestiona el corpus y los expedientes (crear/evaluar/generar)
  isDec: boolean;
  // alias de isDec por compatibilidad con el codigo de gestion de corpus
  isEditor: boolean;
  // legal o admin: revisa informes legales / nulidades
  isLegal: boolean;
  permissions: AppPermission[];
  role: AppRole;
};

function normalizeRole(raw: string | null | undefined): AppRole {
  if (raw === "admin") return "admin";
  if (raw === "dec" || raw === "editor") return "dec";
  if (raw === "legal") return "legal";
  if (raw === "area_usuaria") return "area_usuaria";
  return "consulta";
}

function parsePermissions(metadata: unknown): AppPermission[] {
  if (!metadata || typeof metadata !== "object") {
    return [];
  }

  const permissions = (metadata as { permissions?: unknown }).permissions;
  if (!Array.isArray(permissions)) {
    return [];
  }

  return permissions
    .map((item) => {
      if (typeof item === "string") {
        return { area: item, scope: "" };
      }

      if (!item || typeof item !== "object") {
        return null;
      }

      const record = item as { area?: unknown; scope?: unknown };
      return typeof record.area === "string"
        ? {
            area: record.area,
            scope: typeof record.scope === "string" ? record.scope : "",
          }
        : null;
    })
    .filter((item): item is AppPermission => Boolean(item));
}

// Lee el usuario autenticado, su rol (profiles) y su access token. Devuelve
// null si no hay sesion. Usar en server components y rutas API.
export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const [{ data: sessionData }, profileResult] = await Promise.all([
    supabase.auth.getSession(),
    supabase.from("profiles").select("role, entity, metadata").eq("id", user.id).maybeSingle(),
  ]);

  // Fallback si la columna `entity` aun no existe (migracion del SDD no aplicada):
  // reintenta leyendo solo `role` para no degradar a todos a rol consulta.
  let profile = profileResult.data as { role?: string; entity?: string | null; metadata?: unknown } | null;
  if (!profile && profileResult.error) {
    const { data } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    profile = data;
  }

  const role = normalizeRole(profile?.role);
  const isAdmin = role === "admin";

  return {
    accessToken: sessionData.session?.access_token ?? "",
    email: user.email ?? null,
    entity: (profile?.entity as string | null) ?? null,
    id: user.id,
    isAdmin,
    isDec: role === "dec" || isAdmin,
    isEditor: role === "dec" || isAdmin,
    isLegal: role === "legal" || isAdmin,
    permissions: parsePermissions(profile?.metadata),
    role,
  };
}

type AuthResult = { user: SessionUser } | { error: NextResponse };

// Exige sesion valida; devuelve 401 si no hay usuario.
export async function requireUser(): Promise<AuthResult> {
  const user = await getSessionUser();

  if (!user) {
    return { error: NextResponse.json({ error: "No autenticado" }, { status: 401 }) };
  }

  return { user };
}

// Exige rol admin; devuelve 401 sin sesion o 403 si no es admin.
export async function requireAdmin(): Promise<AuthResult> {
  const result = await requireUser();

  if ("error" in result) {
    return result;
  }

  if (!result.user.isAdmin) {
    return { error: NextResponse.json({ error: "Requiere rol de administrador" }, { status: 403 }) };
  }

  return result;
}

// Exige rol DEC o admin (gestion del corpus y expedientes); 403 en otro caso.
export async function requireDec(): Promise<AuthResult> {
  const result = await requireUser();

  if ("error" in result) {
    return result;
  }

  if (!result.user.isDec) {
    return {
      error: NextResponse.json({ error: "Requiere rol DEC o administrador" }, { status: 403 }),
    };
  }

  return result;
}

// Alias historico de requireDec (rutas de gestion de corpus ya existentes).
export const requireEditor = requireDec;

// Exige rol Legal o admin (revision de informes legales).
export async function requireLegal(): Promise<AuthResult> {
  const result = await requireUser();

  if ("error" in result) {
    return result;
  }

  if (!result.user.isLegal) {
    return {
      error: NextResponse.json({ error: "Requiere rol Legal o administrador" }, { status: 403 }),
    };
  }

  return result;
}
