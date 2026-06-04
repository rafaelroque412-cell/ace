import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { supabaseRest, supabaseUserRest } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type EventRow = {
  id: string;
  event_type: string;
  document_id: string | null;
  document_type: string | null;
  process_type: string | null;
  source_entity: string | null;
  topic: string | null;
  title: string;
  summary: string | null;
  created_at: string;
};

type Follow = { kind: string; value: string };

function isRelevant(event: EventRow, follows: Follow[]) {
  return follows.some((follow) => {
    if (follow.kind === "process") return event.process_type === follow.value;
    if (follow.kind === "document_type") return event.document_type === follow.value;
    if (follow.kind === "entity") {
      return (event.source_entity ?? "").toLowerCase().includes(follow.value.toLowerCase());
    }
    if (follow.kind === "topic") {
      return (event.topic ?? "").toLowerCase().includes(follow.value.toLowerCase());
    }
    return false;
  });
}

export async function GET() {
  try {
    const auth = await requireUser();
    if ("error" in auth) {
      return auth.error;
    }

    const [events, follows] = await Promise.all([
      supabaseRest<EventRow[]>(
        "boletin_eventos?select=id,event_type,document_id,document_type,process_type,source_entity,topic,title,summary,created_at&order=created_at.desc&limit=60",
      ),
      supabaseUserRest<Follow[]>(auth.user.accessToken, "seguimientos?select=kind,value"),
    ]);

    return NextResponse.json({
      follows,
      events: events.map((event) => ({ ...event, relevante: isRelevant(event, follows) })),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo cargar el boletín", events: [], follows: [] },
      { status: 500 },
    );
  }
}
