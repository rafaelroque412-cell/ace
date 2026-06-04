import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { supabaseUserRest } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ChatSessionRow = {
  id: string;
  title: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

type ChatMessageRow = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  sources: unknown[];
  model: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export async function GET() {
  try {
    const auth = await requireUser();
    if ("error" in auth) {
      return auth.error;
    }

    const { accessToken } = auth.user;
    // RLS filtra automaticamente a las sesiones del usuario autenticado.
    const sessions = await supabaseUserRest<ChatSessionRow[]>(
      accessToken,
      "chat_sessions?select=id,title,metadata,created_at,updated_at&order=updated_at.desc&limit=25",
    );
    const sessionsWithMessages = await Promise.all(
      sessions.map(async (session) => {
        const messages = await supabaseUserRest<ChatMessageRow[]>(
          accessToken,
          `chat_messages?session_id=eq.${session.id}&select=id,role,content,sources,model,metadata,created_at&order=created_at.asc`,
        );
        const assistantMessages = messages.filter((message) => message.role === "assistant");
        const sourceCount = assistantMessages.reduce(
          (total, message) => total + (Array.isArray(message.sources) ? message.sources.length : 0),
          0,
        );

        return {
          ...session,
          messageCount: messages.length,
          messages,
          sourceCount,
        };
      }),
    );

    return NextResponse.json({ sessions: sessionsWithMessages });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "No se pudo cargar el historial",
        sessions: [],
      },
      { status: 500 },
    );
  }
}
