import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  // 303 fuerza GET en la redireccion tras el POST del formulario de salida.
  return NextResponse.redirect(new URL("/login", request.url), { status: 303 });
}
