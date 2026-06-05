import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getCorpusQualityByProcedure } from "@/lib/corpus-quality";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const auth = await requireUser();
    if ("error" in auth) {
      return auth.error;
    }

    return NextResponse.json(await getCorpusQualityByProcedure());
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo evaluar la calidad del corpus" },
      { status: 500 },
    );
  }
}
