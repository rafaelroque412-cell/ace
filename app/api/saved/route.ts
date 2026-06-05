import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { supabaseUserRest } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const savedSchema = z.object({
  itemType: z.enum(["documento", "articulo", "mensaje", "validacion", "analisis"]),
  title: z.string().trim().min(1).max(300),
  documentId: z.string().uuid().optional().or(z.literal("")),
  articleId: z.string().uuid().optional().or(z.literal("")),
  messageId: z.string().uuid().optional().or(z.literal("")),
  carpetaId: z.string().uuid().optional().or(z.literal("")),
  note: z.string().trim().max(2000).optional().or(z.literal("")),
});

export async function GET() {
  const auth = await requireUser();
  if ("error" in auth) {
    return auth.error;
  }
  const items = await supabaseUserRest(
    auth.user.accessToken,
    "guardados?select=id,carpeta_id,item_type,document_id,article_id,message_id,title,note,metadata,created_at&order=created_at.desc",
  );
  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) {
    return auth.error;
  }
  const payload = savedSchema.safeParse(await request.json());
  if (!payload.success) {
    return NextResponse.json({ error: "Datos invalidos" }, { status: 400 });
  }
  const data = payload.data;
  const [item] = await supabaseUserRest<Array<{ id: string }>>(auth.user.accessToken, "guardados", {
    body: JSON.stringify({
      article_id: data.articleId || null,
      carpeta_id: data.carpetaId || null,
      document_id: data.documentId || null,
      item_type: data.itemType,
      message_id: data.messageId || null,
      note: data.note || null,
      owner_id: auth.user.id,
      title: data.title,
    }),
    method: "POST",
  });
  return NextResponse.json({ item });
}

export async function PATCH(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) {
    return auth.error;
  }
  const body = (await request.json().catch(() => ({}))) as { id?: string; note?: string };
  if (!body.id) {
    return NextResponse.json({ error: "Falta id" }, { status: 400 });
  }
  await supabaseUserRest(auth.user.accessToken, `guardados?id=eq.${body.id}`, {
    body: JSON.stringify({ note: body.note ?? null }),
    method: "PATCH",
  });
  return NextResponse.json({ updated: true });
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
  await supabaseUserRest(auth.user.accessToken, `guardados?id=eq.${id}`, { method: "DELETE" });
  return NextResponse.json({ deleted: true });
}
