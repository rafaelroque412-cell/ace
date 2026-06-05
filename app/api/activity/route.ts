import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { supabaseUserRest } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ActivityItem = {
  confidence?: string | null;
  createdAt: string;
  detail: string;
  href: string;
  id: string;
  origin: "chat" | "guardado" | "analiza" | "validar" | "expediente";
  processType?: string | null;
  sourceCount?: number;
  title: string;
};

type ChatSessionRow = {
  id: string;
  title: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

type SavedRow = {
  id: string;
  item_type: string;
  title: string;
  note: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

type AnalysisRow = {
  id: string;
  title: string | null;
  result: Record<string, unknown>;
  created_at: string;
};

type EvaluationRow = {
  id: string;
  bidder_name: string | null;
  result: string | null;
  observations: unknown;
  created_at: string;
};

function getString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function arrayLength(value: unknown) {
  return Array.isArray(value) ? value.length : 0;
}

export async function GET() {
  const auth = await requireUser();
  if ("error" in auth) {
    return auth.error;
  }

  const [sessions, saved, analyses, evaluations] = await Promise.all([
    supabaseUserRest<ChatSessionRow[]>(
      auth.user.accessToken,
      "chat_sessions?select=id,title,metadata,created_at,updated_at&order=updated_at.desc&limit=20",
    ).catch(() => []),
    supabaseUserRest<SavedRow[]>(
      auth.user.accessToken,
      "guardados?select=id,item_type,title,note,metadata,created_at&order=created_at.desc&limit=30",
    ).catch(() => []),
    supabaseUserRest<AnalysisRow[]>(
      auth.user.accessToken,
      "document_analyses?select=id,title,result,created_at&order=created_at.desc&limit=20",
    ).catch(() => []),
    supabaseUserRest<EvaluationRow[]>(
      auth.user.accessToken,
      "process_evaluations?select=id,bidder_name,result,observations,created_at&order=created_at.desc&limit=20",
    ).catch(() => []),
  ]);

  const items: ActivityItem[] = [
    ...sessions.map((item) => ({
      createdAt: item.updated_at,
      detail: "Consulta con historial y fuentes persistidas.",
      href: "/historial",
      id: `chat-${item.id}`,
      origin: "chat" as const,
      title: item.title ?? "Chat jurídico",
    })),
    ...saved.map((item) => {
      const metadata = item.metadata ?? {};
      const legal = metadata.legal as Record<string, unknown> | undefined;
      const assessment = legal?.assessment as Record<string, unknown> | undefined;
      return {
        confidence: getString(assessment?.confidence) ?? getString(metadata.confidence),
        createdAt: item.created_at,
        detail: item.note ?? `Elemento guardado (${item.item_type}).`,
        href: item.item_type === "validacion" ? "/validar" : item.item_type === "mensaje" ? "/historial" : "/guardado",
        id: `saved-${item.id}`,
        origin: item.item_type === "validacion" ? ("validar" as const) : ("guardado" as const),
        processType: getString(metadata.processType) ?? getString((metadata.inferredContext as Record<string, unknown> | undefined)?.procedureType),
        sourceCount: arrayLength((legal?.sources as unknown[]) ?? metadata.sources),
        title: item.title,
      };
    }),
    ...analyses.map((item) => ({
      confidence: getString(item.result?.confidence),
      createdAt: item.created_at,
      detail: getString(item.result?.confidenceReason) ?? "Análisis documental con fuentes usadas.",
      href: "/analizar",
      id: `analysis-${item.id}`,
      origin: "analiza" as const,
      processType: getString(item.result?.processType),
      sourceCount: arrayLength(item.result?.sources),
      title: item.title ?? "Análisis documental",
    })),
    ...evaluations.map((item) => ({
      createdAt: item.created_at,
      detail: `Resultado: ${item.result ?? "riesgo"}.`,
      href: "/expedientes",
      id: `evaluation-${item.id}`,
      origin: "expediente" as const,
      title: item.bidder_name ?? "Evaluación de expediente",
    })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return NextResponse.json({ items: items.slice(0, 60) });
}
