import Link from "next/link";
import { Bot, FileSearch } from "lucide-react";
import { AppShell } from "../components/app-shell";
import { ProcedureValidator } from "../components/procedure-validator";

export default function ValidarPage() {
  return (
    <AppShell
      active="validar"
      action={
        <div className="buttonCluster">
          <Link className="secondaryButton" href="/busqueda">
            <FileSearch size={17} />
            Consultas
          </Link>
          <Link className="secondaryButton" href="/chat">
            <Bot size={17} />
            Chat
          </Link>
        </div>
      }
      eyebrow="Validacion operativa"
      title="Agente de procedimiento"
    >
      <ProcedureValidator />
    </AppShell>
  );
}
