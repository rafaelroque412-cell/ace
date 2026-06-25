import Link from "next/link";
import { Bot } from "lucide-react";
import { AppShell } from "../components/app-shell";
import { NewsFeed } from "../components/news-feed";

// AppShell consulta sesión/datos vía Supabase en el servidor; render dinámico
// para no instanciar el cliente en build-time (prerender sin env vars).
export const dynamic = "force-dynamic";

export default function AlertasPage() {
  return (
    <AppShell
      active="alertas"
      action={
        <Link className="secondaryButton" href="/chat">
          <Bot size={17} />
          Ir al chat
        </Link>
      }
      eyebrow="Engagement"
      title="Alertas y boletín normativo"
    >
      <section className="singleWorkspace">
        <NewsFeed />
      </section>
    </AppShell>
  );
}
