import Link from "next/link";
import { Bot } from "lucide-react";
import { AppShell } from "../components/app-shell";
import { DocumentUpload } from "../components/document-upload";

export default function DocumentosPage() {
  return (
    <AppShell
      active="documentos"
      action={
        <Link className="secondaryButton" href="/chat">
          <Bot size={17} />
          Ir al chat
        </Link>
      }
      eyebrow="Base documental"
      title="Carga, procesamiento e indexacion de PDFs"
    >
      <section className="singleWorkspace">
        <DocumentUpload />
      </section>
    </AppShell>
  );
}
