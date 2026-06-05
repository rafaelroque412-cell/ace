import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { supabaseRest } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type AuditRow = {
  action: string;
  entity_type: string;
  created_at: string;
};

type ChatMessageRow = {
  role: "user" | "assistant" | "system";
  content: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

function dayKey(value: string) {
  return value.slice(0, 10);
}

export async function GET() {
  try {
    const auth = await requireAdmin();
    if ("error" in auth) {
      return auth.error;
    }

    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const [auditRows, chatMessages] = await Promise.all([
      supabaseRest<AuditRow[]>(
        `audit_logs?created_at=gte.${since}&select=action,entity_type,created_at&order=created_at.desc&limit=1000`,
      ),
      supabaseRest<ChatMessageRow[]>(
        `chat_messages?created_at=gte.${since}&select=role,content,metadata,created_at&order=created_at.desc&limit=1000`,
      ),
    ]);
    const actionCounts = new Map<string, number>();
    const dayCounts = new Map<string, number>();

    for (const row of auditRows) {
      actionCounts.set(row.action, (actionCounts.get(row.action) ?? 0) + 1);
      dayCounts.set(dayKey(row.created_at), (dayCounts.get(dayKey(row.created_at)) ?? 0) + 1);
    }

    const assistantMessages = chatMessages.filter((message) => message.role === "assistant");
    const feedback = {
      correct: assistantMessages.filter((message) => message.metadata.feedback === "correct").length,
      incorrect: assistantMessages.filter((message) => message.metadata.feedback === "incorrect").length,
      notes: assistantMessages.filter((message) => Boolean(message.metadata.note)).length,
    };
    const confidence = {
      alta: assistantMessages.filter((message) => message.metadata.confidence === "alta").length,
      baja: assistantMessages.filter((message) => message.metadata.confidence === "baja").length,
      media: assistantMessages.filter((message) => message.metadata.confidence === "media").length,
    };

    return NextResponse.json({
      actions: Array.from(actionCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 12)
        .map(([action, count]) => ({ action, count })),
      chat: {
        assistantMessages: assistantMessages.length,
        confidence,
        feedback,
        userMessages: chatMessages.filter((message) => message.role === "user").length,
      },
      days: Array.from(dayCounts.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([day, count]) => ({ count, day })),
      since,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo cargar uso del sistema" },
      { status: 500 },
    );
  }
}
