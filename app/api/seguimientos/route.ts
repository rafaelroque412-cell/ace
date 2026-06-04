import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { supabaseUserRest } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const followSchema = z.object({
  kind: z.enum(["process", "document_type", "entity", "topic"]),
  value: z.string().trim().min(1).max(160),
});

export async function GET() {
  const auth = await requireUser();
  if ("error" in auth) {
    return auth.error;
  }
  const follows = await supabaseUserRest(
    auth.user.accessToken,
    "seguimientos?select=id,kind,value&order=created_at.desc",
  );
  return NextResponse.json({ follows });
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) {
    return auth.error;
  }
  const payload = followSchema.safeParse(await request.json());
  if (!payload.success) {
    return NextResponse.json({ error: "Seguimiento invalido" }, { status: 400 });
  }
  try {
    const [follow] = await supabaseUserRest<Array<{ id: string }>>(
      auth.user.accessToken,
      "seguimientos?on_conflict=owner_id,kind,value",
      {
        body: JSON.stringify({ kind: payload.data.kind, owner_id: auth.user.id, value: payload.data.value }),
        headers: { Prefer: "resolution=merge-duplicates,return=representation" },
        method: "POST",
      },
    );
    return NextResponse.json({ follow });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo seguir" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) {
    return auth.error;
  }
  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Falta id" }, { status: 400 });
  }
  await supabaseUserRest(auth.user.accessToken, `seguimientos?id=eq.${id}`, { method: "DELETE" });
  return NextResponse.json({ deleted: true });
}
