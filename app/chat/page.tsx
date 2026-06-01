import Link from "next/link";
import { UploadCloud } from "lucide-react";
import { AppShell } from "../components/app-shell";
import { LegalChat } from "../components/legal-chat";

export default function ChatPage() {
  return (
    <AppShell
      active="chat"
      action={
        <Link className="secondaryButton" href="/documentos">
          <UploadCloud size={17} />
          Gestionar documentos
        </Link>
      }
      eyebrow="Consulta legal"
      title="Chat juridico con busqueda semantica"
    >
      <section className="singleWorkspace">
        <LegalChat />
      </section>
    </AppShell>
  );
}
