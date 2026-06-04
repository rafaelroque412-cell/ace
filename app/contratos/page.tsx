import Link from "next/link";
import { ScanSearch } from "lucide-react";
import { AppShell } from "../components/app-shell";
import { ContractForm } from "../components/contract-form";

export default function ContratosPage() {
  return (
    <AppShell
      active="contratos"
      action={
        <Link className="secondaryButton" href="/analizar">
          <ScanSearch size={17} />
          Analizar documento
        </Link>
      }
      eyebrow="Asistente"
      title="Generación de contratos"
    >
      <section className="singleWorkspace">
        <ContractForm />
      </section>
    </AppShell>
  );
}
