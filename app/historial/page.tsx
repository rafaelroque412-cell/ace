import Link from "next/link";
import { Bot } from "lucide-react";
import { AppShell } from "../components/app-shell";
import { ChatHistory } from "../components/chat-history";

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
      title="Historial de consultas y fuentes usadas"
    >
      <section className="singleWorkspace">
        <ChatHistory />
      </section>
    </AppShell>
  );
}
