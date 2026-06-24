import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { type Necesidad } from "@/lib/necesidades";
import { buildFichaNecesidadDocx } from "@/lib/necesidad-ficha";
import { supabaseUserRest } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function safeFileName(text: string) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 90);
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if ("error" in auth) {
    return auth.error;
  }

  const { id } = await context.params;
  try {
    const [necesidades] = await Promise.all([
      supabaseUserRest<Necesidad[]>(
        auth.user.accessToken,
        "necesidades?id=eq." +
          id +
          "&select=id,codigo,nombre,finalidad_publica,objetivo,centro_costo,meta_presupuestal,proyecto_inversion,tipo_contratacion,area_usuaria,status,summary,process_id,owner_id,entity,created_at,updated_at",
      ),
    ]);
    const necesidad = necesidades[0];
    if (!necesidad) {
      return NextResponse.json({ error: "Necesidad no encontrada" }, { status: 404 });
    }

    const buffer = await buildFichaNecesidadDocx(necesidad);
    const fileName = `ficha-necesidad-${safeFileName(necesidad.codigo ?? necesidad.nombre)}.docx`;
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo generar la ficha" },
      { status: 500 },
    );
  }
}
