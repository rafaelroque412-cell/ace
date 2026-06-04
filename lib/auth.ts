import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export type SessionUser = {
  accessToken: string;
  email: string | null;
  id: string;
  isAdmin: boolean;
  // editor o admin: puede gestionar el corpus (subir/reindexar/borrar documentos)
  isEditor: boolean;
  role: "user" | "editor" | "admin";
};

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

  const [{ data: sessionData }, { data: profile }] = await Promise.all([
    supabase.auth.getSession(),
    supabase.from("profiles").select("role").eq("id", user.id).maybeSingle(),
  ]);

  const role: SessionUser["role"] =
    profile?.role === "admin" ? "admin" : profile?.role === "editor" ? "editor" : "user";

  return {
    accessToken: sessionData.session?.access_token ?? "",
    email: user.email ?? null,
    id: user.id,
    isAdmin: role === "admin",
    isEditor: role === "admin" || role === "editor",
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

// Exige rol editor o admin (gestion del corpus); 401 sin sesion o 403 si es user.
export async function requireEditor(): Promise<AuthResult> {
  const result = await requireUser();

  if ("error" in result) {
    return result;
  }

  if (!result.user.isEditor) {
    return { error: NextResponse.json({ error: "Requiere rol de editor o administrador" }, { status: 403 }) };
  }

  return result;
}
