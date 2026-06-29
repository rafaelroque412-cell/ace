import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { buildRespuestaDocx } from "@/lib/respuesta-generator";
import { buildRespuestaPdf } from "@/lib/respuesta-pdf";
import { downloadStorageObject, supabaseRest, writeAuditLog } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function slugify(asunto: string): string {
  return (
    asunto
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "respuesta"
  );
}

export async function POST(request: Request) {
  try {
    const auth = await requireUser();
    if ("error" in auth) return auth.error;

    const body = await request.json();
    const {
      format = "docx",
      oficinaId,
      entity,
      nroOficio,
      destinatario,
      cargoDestinatario,
      asunto,
      cuerpo,
      baseLegal,
      remitente,
      cargoRemitente,
    } = body;

    if (!cuerpo || !asunto) {
      return NextResponse.json({ error: "Faltan datos obligatorios: asunto y cuerpo." }, { status: 400 });
    }

    const slug = slugify(asunto);
    const fecha = new Date().toLocaleDateString("es-PE", { day: "numeric", month: "long", year: "numeric" });

    // ── PDF sobre la hoja membretada de la OFICINA ──
    if (format === "pdf") {
      let letterheadBytes: Uint8Array | null = null;
      let ofiResponsable = "";
      let ofiCargo = "";
      let ofiEntidad = "";
      try {
        const [ofi] = await supabaseRest<
          Array<{
            membrete_path: string | null;
            membrete_bucket: string | null;
            responsable_nombre: string | null;
            responsable_cargo: string | null;
            entidad: string | null;
          }>
        >(
          `expedientes_oficinas?id=eq.${oficinaId}&select=membrete_path,membrete_bucket,responsable_nombre,responsable_cargo,entidad`,
        );
        if (ofi) {
          ofiResponsable = ofi.responsable_nombre ?? "";
          ofiCargo = ofi.responsable_cargo ?? "";
          ofiEntidad = ofi.entidad ?? "";
          if (ofi.membrete_path && ofi.membrete_bucket) {
            const blob = await downloadStorageObject(ofi.membrete_bucket, ofi.membrete_path);
            letterheadBytes = new Uint8Array(await blob.arrayBuffer());
          }
        }
      } catch {
        letterheadBytes = null; // sin membrete: PDF en blanco
      }

      const pdfBytes = await buildRespuestaPdf({
        letterheadBytes,
        entityName: ofiEntidad || entity?.name || "",
        nroOficio: nroOficio ?? "",
        fecha,
        destinatario: destinatario ?? "",
        cargoDestinatario: cargoDestinatario ?? "",
        asunto,
        cuerpo,
        baseLegal: Array.isArray(baseLegal) ? baseLegal : [],
        remitente: remitente || ofiResponsable || "",
        cargoRemitente: cargoRemitente || ofiCargo || "",
      });

      await writeAuditLog({
        action: "respuesta.export",
        actorReference: auth.user.email ?? auth.user.id,
        details: { nroOficio, asunto, format: "pdf", membrete: Boolean(letterheadBytes) },
        entityType: "respuesta",
        module: "expedientes-archivo",
      });

      return new Response(new Uint8Array(pdfBytes), {
        headers: {
          "Content-Disposition": `attachment; filename="respuesta-${slug}.pdf"`,
          "Content-Type": "application/pdf",
        },
      });
    }

    // ── DOCX con membrete de texto ──
    if (!entity?.name) {
      return NextResponse.json({ error: "Para .docx indica el nombre de la entidad (membrete)." }, { status: 400 });
    }

    const buffer = await buildRespuestaDocx({
      entity: {
        name: entity.name,
        ruc: entity.ruc ?? "",
        address: entity.address ?? "",
        executingUnit: entity.executingUnit ?? "",
      },
      nroOficio: nroOficio ?? "OFICIO N° ___ -2026",
      destinatario: destinatario ?? "[DESTINATARIO]",
      cargoDestinatario: cargoDestinatario ?? "",
      asunto,
      cuerpo,
      baseLegal: baseLegal ?? [],
      remitente: remitente ?? entity.name,
      cargoRemitente: cargoRemitente ?? "",
    });

    await writeAuditLog({
      action: "respuesta.export",
      actorReference: auth.user.email ?? auth.user.id,
      details: { nroOficio, asunto, format: "docx" },
      entityType: "respuesta",
      module: "expedientes-archivo",
    });

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Disposition": `attachment; filename="respuesta-${slug}.docx"`,
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo exportar el documento" },
      { status: 500 },
    );
  }
}
