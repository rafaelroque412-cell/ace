import Link from "next/link";
import { Bot } from "lucide-react";
import { AppShell } from "../components/app-shell";
import { ChatHistory } from "../components/chat-history";
import { LegalActivity } from "../components/legal-activity";

export default function HistorialPage() {
  return (
    <AppShell
      active="historial"
      action={
        <Link className="secondaryButton" href="/chat">
          <Bot size={17} />
          Ir al chat
        </Link>
      }
      eyebrow="Auditoria"
      title="Actividad jurídica, consultas y fuentes usadas"
    >
      <section className="activityWorkspace">
        <LegalActivity />
        <ChatHistory />
      </section>
    </AppShell>
  );
}
