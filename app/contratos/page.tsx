import Link from "next/link";
import { UploadCloud } from "lucide-react";
import { AppShell } from "../components/app-shell";

export default function ContratosPage() {
  return (
    <AppShell
      active="contratos"
      action={
        <Link className="secondaryButton" href="/documentos">
          <UploadCloud size={17} />
          Cargar expediente
        </Link>
      }
      eyebrow="Fase 2"
      title="Generacion de contratos"
    >
      <section className="emptyModule">
        <strong>Modulo preparado</strong>
        <p>
          La generacion de contratos se conectara a los documentos indexados, plantillas DOCX y
          datos estructurados del proceso.
        </p>
      </section>
    </AppShell>
  );
}
