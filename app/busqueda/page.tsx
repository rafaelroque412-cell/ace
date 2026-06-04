import Link from "next/link";
import { Bot } from "lucide-react";
import { AppShell } from "../components/app-shell";
import { SemanticSearch } from "../components/semantic-search";

export default function BusquedaPage() {
  return (
    <AppShell
      active="busqueda"
      action={
        <Link className="secondaryButton" href="/chat">
          <Bot size={17} />
          Ir al chat
        </Link>
      }
      eyebrow="Consultas"
      title="Consultas semanticas con evidencia documental"
    >
      <section className="singleWorkspace">
        <SemanticSearch />
      </section>
    </AppShell>
  );
}
