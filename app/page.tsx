import Link from "next/link";
import { Bot, FileSearch, FileText, GitCompare, History, UploadCloud } from "lucide-react";
import { AppShell } from "./components/app-shell";
import { getSessionUser } from "@/lib/auth";

const modules = [
  {
    title: "Chat juridico con fuentes",
    description: "Respuestas sustentadas en documentos indexados y fragmentos verificables.",
    icon: Bot,
    status: "MVP",
  },
  {
    title: "Carga documental",
    description: "Subida de PDFs, extraccion de texto, chunks y envio automatico a Pinecone.",
    icon: UploadCloud,
    status: "MVP",
  },
  {
    title: "Busqueda inteligente",
    description: "Consulta semantica sobre articulos, opiniones, directivas y resoluciones.",
    icon: FileSearch,
    status: "MVP",
  },
  {
    title: "Contratos",
    description: "Generacion de contratos de bienes o servicios segun informacion del proceso.",
    icon: FileText,
    status: "Fase 2",
  },
  {
    title: "Comparacion normativa",
    description: "Contraste entre ley, reglamento, directivas y versiones anteriores.",
    icon: GitCompare,
    status: "Fase 2",
  },
  {
    title: "Historial y auditoria",
    description: "Registro de consultas, fuentes usadas, versiones y trazabilidad.",
    icon: History,
    status: "MVP",
  },
];

export default async function Home() {
  const user = await getSessionUser();

  return (
    <AppShell
      active="panel"
      action={
        user?.isAdmin ? (
          <Link className="primaryButton" href="/documentos">
            <UploadCloud size={18} />
            Cargar PDF
          </Link>
        ) : undefined
      }
      eyebrow="Panel operativo"
      title="Aplicacion juridica con IA para contrataciones publicas"
    >
      <section className="statusBand">
        <div>
          <span>Arquitectura</span>
          <strong>Next.js + Vercel + Supabase + Pinecone + OpenAI</strong>
        </div>
        <div>
          <span>Flujo activo</span>
          <strong>Documentos indexados y consulta con fuentes</strong>
        </div>
        <div>
          <span>Seguridad</span>
          <strong>API keys solo en servidor</strong>
        </div>
      </section>

      <section className="quickActions">
        <Link className="actionTile" href="/chat">
          <Bot size={24} />
          <span>Consulta legal</span>
          <strong>Preguntar con busqueda semantica y fuentes verificables.</strong>
        </Link>
        <Link className="actionTile" href="/documentos">
          <UploadCloud size={24} />
          <span>Carga e indexacion</span>
          <strong>Subir PDFs, extraer texto, guardar chunks y enviar a Pinecone.</strong>
        </Link>
      </section>

      <section className="moduleGrid">
        {modules.map((item) => {
          const Icon = item.icon;
          return (
            <article className="moduleCard" key={item.title}>
              <div className="moduleIcon">
                <Icon size={21} />
              </div>
              <div>
                <div className="moduleTitle">
                  <h3>{item.title}</h3>
                  <span>{item.status}</span>
                </div>
                <p>{item.description}</p>
              </div>
            </article>
          );
        })}
      </section>
    </AppShell>
  );
}
