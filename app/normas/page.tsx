import Link from "next/link";
import { Bot } from "lucide-react";
import { AppShell } from "../components/app-shell";
import { NormativeBrowser } from "../components/normative-browser";

export default function NormasPage() {
  return (
    <AppShell
      active="normas"
      action={
        <Link className="secondaryButton" href="/chat">
          <Bot size={17} />
          Ir al chat
        </Link>
      }
      eyebrow="Base documental"
      title="Navegador normativo: lee la norma por articulo"
    >
      <section className="singleWorkspace">
        <NormativeBrowser />
      </section>
    </AppShell>
  );
}
