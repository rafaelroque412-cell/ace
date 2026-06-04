import Link from "next/link";
import { Bot, Lock } from "lucide-react";
import { AppShell } from "../components/app-shell";
import { DocumentUpload } from "../components/document-upload";
import { getSessionUser } from "@/lib/auth";

export default async function DocumentosPage() {
  const user = await getSessionUser();
  const canManage = Boolean(user?.isEditor);

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
        {canManage ? (
          <DocumentUpload />
        ) : (
          <div className="emptyState">
            <Lock size={20} />
            <p>
              La gestion del corpus normativo (carga, reindexado y borrado) esta reservada a
              editores y administradores. Puedes consultar todos los documentos indexados desde el
              chat y la busqueda.
            </p>
            <Link className="primaryButton" href="/busqueda">
              Ir a Consultas
            </Link>
          </div>
        )}
      </section>
    </AppShell>
  );
}
