import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { supabaseUserRest, writeAuditLog } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const saveValidationSchema = z.object({
  processId: z.string().uuid().optional().or(z.literal("")),
  result: z.record(z.string(), z.unknown()),
  title: z.string().trim().min(3).max(240),
});

function resultToProcessEvaluation(value: Record<string, unknown>) {
  const rules = value.rules as Record<string, unknown> | null | undefined;
  const findings = Array.isArray(rules?.findings) ? rules.findings : [];
  const conclusion = typeof rules?.conclusion === "string" ? rules.conclusion : "requiere_revision";
  const mappedResult = conclusion === "procede" ? "cumple" : conclusion === "no_procede" ? "no_cumple" : "riesgo";

  return {
    matrix: findings,
    observations: [
      {
        critical: value.critical ?? null,
        legalAssessment: (value.legal as Record<string, unknown> | null | undefined)?.assessment ?? null,
        nextSteps: rules?.nextSteps ?? [],
        plan: value.plan ?? null,
      },
    ],
    result: mappedResult,
  };
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) {
    return auth.error;
  }

  const payload = saveValidationSchema.safeParse(await request.json().catch(() => ({})));
  if (!payload.success) {
    return NextResponse.json({ error: "Datos invalidos", details: payload.error.flatten() }, { status: 400 });
  }

  const data = payload.data;
  const saved = await supabaseUserRest<Array<{ id: string }>>(auth.user.accessToken, "guardados", {
    body: JSON.stringify({
      item_type: "validacion",
      metadata: data.result,
      note: "Validacion operativa generada desde el menu Validar.",
      owner_id: auth.user.id,
      title: data.title,
    }),
    method: "POST",
  });

  let evaluation: { id: string } | null = null;
  if (data.processId) {
    const mapped = resultToProcessEvaluation(data.result);
    const [row] = await supabaseUserRest<Array<{ id: string }>>(auth.user.accessToken, "process_evaluations", {
      body: JSON.stringify({
        bidder_name: "Validacion de procedimiento",
        matrix: mapped.matrix,
        model: "agent-orchestrator",
        observations: mapped.observations,
        owner_id: auth.user.id,
        process_id: data.processId,
        result: mapped.result,
      }),
      method: "POST",
    });
    evaluation = row;
  }

  await writeAuditLog({
    action: "agent.validation.save",
    actorReference: auth.user.email ?? auth.user.id,
    details: {
      processId: data.processId || null,
      savedId: saved[0]?.id ?? null,
      user: { entity: auth.user.entity, id: auth.user.id, role: auth.user.role },
    },
    entityId: data.processId || saved[0]?.id,
    entityType: data.processId ? "procurement_process" : "guardado",
  });

  return NextResponse.json({ evaluation, saved: saved[0] ?? null });
}
