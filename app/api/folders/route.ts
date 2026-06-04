import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { supabaseUserRest } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const folderSchema = z.object({ name: z.string().trim().min(1).max(120) });

export async function GET() {
  const auth = await requireUser();
  if ("error" in auth) {
    return auth.error;
  }
  const folders = await supabaseUserRest(
    auth.user.accessToken,
    "carpetas?select=id,name,created_at&order=created_at.asc",
  );
  return NextResponse.json({ folders });
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) {
    return auth.error;
  }
  const payload = folderSchema.safeParse(await request.json());
  if (!payload.success) {
    return NextResponse.json({ error: "Nombre invalido" }, { status: 400 });
  }
  const [folder] = await supabaseUserRest<Array<{ id: string; name: string }>>(
    auth.user.accessToken,
    "carpetas",
    {
      body: JSON.stringify({ name: payload.data.name, owner_id: auth.user.id }),
      method: "POST",
    },
  );
  return NextResponse.json({ folder });
}
