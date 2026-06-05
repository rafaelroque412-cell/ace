import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { runOperationalVerification } from "@/lib/operational-verification";
import { writeAuditLog } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET() {
  try {
    const auth = await requireAdmin();
    if ("error" in auth) {
      return auth.error;
    }

    const result = await runOperationalVerification(auth.user);

    await writeAuditLog({
      action: "system.operational_verify",
      details: {
        corpusReady: result.corpus.corpusReady,
        failed: result.summary.failed,
        ok: result.ok,
        passed: result.summary.passed,
      },
      entityType: "system",
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "No se pudo ejecutar la verificacion operativa",
      },
      { status: 500 },
    );
  }
}
