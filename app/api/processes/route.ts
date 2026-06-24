import { NextResponse } from "next/server";
import { requireCapability, requireUser } from "@/lib/auth";
import { type ProcurementProcess, processCreateSchema } from "@/lib/processes";
import { supabaseUserRest, writeAuditLog } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const auth = await requireUser();
  if ("error" in auth) {
    return auth.error;
  }

  try {
    // RLS limita a los expedientes del usuario (o todos si es admin).
    const processes = await supabaseUserRest<ProcurementProcess[]>(
      auth.user.accessToken,
      "procurement_processes?select=id,nomenclature,object_type,procedure_type,amount,entity,status,summary,created_at,updated_at&order=updated_at.desc&limit=100",
    );
    return NextResponse.json({ processes });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudieron listar los expedientes", processes: [] },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireCapability("expediente.manage");
  if ("error" in auth) {
    return auth.error;
  }

  const payload = processCreateSchema.safeParse(await request.json().catch(() => ({})));
  if (!payload.success) {
    return NextResponse.json(
      { error: "Solicitud invalida", details: payload.error.flatten() },
      { status: 400 },
    );
  }

  const data = payload.data;

  try {
    const [process] = await supabaseUserRest<ProcurementProcess[]>(
      auth.user.accessToken,
      "procurement_processes",
      {
        body: JSON.stringify({
          amount: typeof data.amount === "number" ? data.amount : null,
          entity: data.entity || auth.user.entity || null,
          nomenclature: data.nomenclature,
          object_type: data.objectType,
          owner_id: auth.user.id,
          procedure_type: data.procedureType || null,
          summary: data.summary || null,
        }),
        method: "POST",
      },
    );

    await writeAuditLog({
      action: "process.create",
      details: {
        entity: process.entity,
        nomenclature: data.nomenclature,
        objectType: data.objectType,
        processType: process.procedure_type,
      },
      entityId: process.id,
      entityType: "procurement_process",
      module: "expedientes",
      processType: process.procedure_type,
      user: {
        email: auth.user.email,
        entity: process.entity ?? auth.user.entity,
        id: auth.user.id,
        role: auth.user.role,
      },
    });

    return NextResponse.json({ process }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo crear el expediente" },
      { status: 500 },
    );
  }
}
