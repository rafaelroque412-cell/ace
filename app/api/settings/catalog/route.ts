import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getSettingsCatalog } from "@/lib/settings-catalog";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const auth = await requireUser();
  if ("error" in auth) {
    return auth.error;
  }

  try {
    return NextResponse.json(await getSettingsCatalog(auth.user));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo cargar el catalogo de configuracion" },
      { status: 500 },
    );
  }
}
