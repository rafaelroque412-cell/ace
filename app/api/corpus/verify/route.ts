import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { verifyCorpusReadiness } from "@/lib/corpus-verification";
import { writeAuditLog } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 90;

export async function GET() {
  const auth = await requireAdmin();
  if ("error" in auth) {
    return auth.error;
  }

  try {
    const result = await verifyCorpusReadiness();
    await writeAuditLog({
      action: "corpus.verify",
      actorReference: auth.user.id,
      details: {
        corpusReady: result.corpusReady,
        indexedDocuments: result.documents.indexed,
      },
      entityType: "corpus",
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo verificar el corpus" },
      { status: 500 },
    );
  }
}
