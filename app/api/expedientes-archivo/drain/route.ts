import { NextResponse } from "next/server";
import { requireDec } from "@/lib/auth";
import { drainStuckExpedientes } from "@/lib/expedientes-archivo-queue";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// El OCR de un expediente escaneado es pesado; damos margen amplio por invocación.
export const maxDuration = 300;

// OCR pesado: lotes pequeños por invocación.
const batchSize = Number.parseInt(process.env.EXPEDIENTES_DRAIN_BATCH ?? "2", 10);

// Autoriza al scheduled function / cron (Authorization: Bearer CRON_SECRET) o a un
// editor/admin que dispare el drenado manualmente.
async function authorize(request: Request): Promise<NextResponse | null> {
  const cronSecret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization");
  if (cronSecret && header === `Bearer ${cronSecret}`) {
    return null;
  }
  const auth = await requireDec();
  if ("error" in auth) {
    return auth.error;
  }
  return null;
}

async function handle(request: Request) {
  const denied = await authorize(request);
  if (denied) {
    return denied;
  }
  try {
    const summary = await drainStuckExpedientes(batchSize);
    return NextResponse.json(summary);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo drenar la cola de expedientes" },
      { status: 500 },
    );
  }
}

// GET para el cron; POST para el trigger manual.
export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
