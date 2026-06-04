import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { supabaseUserRest, writeAuditLog } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ChatMessageRow = {
  id: string;
  metadata: Record<string, unknown>;
  role: "user" | "assistant" | "system";
};

function mergeMessageMetadata(
  current: Record<string, unknown>,
  input: { action: string; note?: string | null },
) {
  const feedbackHistory = Array.isArray(current.feedbackHistory)
    ? current.feedbackHistory
    : [];
  const nextMetadata = {
    ...current,
    feedbackHistory: [
      ...feedbackHistory,
      {
        action: input.action,
        createdAt: new Date().toISOString(),
        note: input.note ?? null,
      },
    ],
  };

  if (input.action === "save_note") {
    return {
      ...nextMetadata,
      note: input.note ?? "",
      noteSavedAt: new Date().toISOString(),
    };
  }

  if (input.action === "mark_correct" || input.action === "mark_incorrect") {
    return {
      ...nextMetadata,
      feedback: input.action === "mark_correct" ? "correct" : "incorrect",
      feedbackAt: new Date().toISOString(),
      feedbackNote: input.note ?? null,
    };
  }

  return nextMetadata;
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireUser();
    if ("error" in auth) {
      return auth.error;
    }

    const { accessToken } = auth.user;
    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as {
      action?: string;
      note?: string | null;
    };

    if (!id) {
      return NextResponse.json({ error: "Falta id del mensaje" }, { status: 400 });
    }

    if (!body.action || !["save_note", "mark_correct", "mark_incorrect"].includes(body.action)) {
      return NextResponse.json({ error: "Accion no permitida" }, { status: 400 });
    }

    // RLS asegura que el usuario solo pueda tocar mensajes de sus sesiones.
    const [message] = await supabaseUserRest<ChatMessageRow[]>(
      accessToken,
      `chat_messages?id=eq.${id}&select=id,role,metadata`,
    );

    if (!message) {
      return NextResponse.json({ error: "Mensaje no encontrado" }, { status: 404 });
    }

    if (message.role !== "assistant") {
      return NextResponse.json(
        { error: "Solo se puede evaluar o anotar una respuesta del asistente" },
        { status: 400 },
      );
    }

    const metadata = mergeMessageMetadata(message.metadata ?? {}, {
      action: body.action,
      note: typeof body.note === "string" ? body.note.trim() : null,
    });
    const [updated] = await supabaseUserRest<ChatMessageRow[]>(accessToken, `chat_messages?id=eq.${id}`, {
      body: JSON.stringify({ metadata }),
      method: "PATCH",
    });

    await writeAuditLog({
      action: `chat.response.${body.action}`,
      details: {
        note: typeof body.note === "string" ? body.note.trim() : null,
      },
      entityId: id,
      entityType: "chat_message",
    });

    await supabaseUserRest(accessToken, "chat_response_notes", {
      body: JSON.stringify({
        feedback:
          body.action === "mark_correct"
            ? "correct"
            : body.action === "mark_incorrect"
              ? "incorrect"
              : null,
        message_id: id,
        metadata: {
          action: body.action,
        },
        note: typeof body.note === "string" && body.note.trim() ? body.note.trim() : body.action,
      }),
      method: "POST",
    }).catch(() => undefined);

    return NextResponse.json({
      message: updated,
      metadata,
      saved: true,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "No se pudo actualizar la respuesta",
      },
      { status: 500 },
    );
  }
}
