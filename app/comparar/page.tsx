import Link from "next/link";
import { Bot } from "lucide-react";
import { AppShell } from "../components/app-shell";
import { NormativeCompare } from "../components/normative-compare";

export default function CompararPage() {
  return (
    <AppShell
      active="comparar"
      action={
        <Link className="secondaryButton" href="/chat">
          <Bot size={17} />
          Ir al chat
        </Link>
      }
      eyebrow="Analisis normativo"
      title="Comparacion entre normas con evidencia"
    >
      <section className="singleWorkspace">
        <NormativeCompare />
      </section>
    </AppShell>
  );
}
