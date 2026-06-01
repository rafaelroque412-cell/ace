import {
  BookOpenCheck,
  Bot,
  FileSearch,
  FileText,
  GitCompare,
  History,
  UploadCloud,
} from "lucide-react";
import { DocumentUpload } from "./components/document-upload";
import { LegalChat } from "./components/legal-chat";

const modules = [
  {
    title: "Chat juridico con fuentes",
    description: "Respuestas sustentadas en Ley 32069, reglamento y documentos OECE cargados.",
    icon: Bot,
    status: "MVP",
  },
  {
    title: "Carga documental",
    description: "Subida de PDFs, extraccion de texto, clasificacion y resumen automatico.",
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

export default function Home() {
  return (
    <main className="shell">
      <aside className="sidebar" aria-label="Navegacion principal">
        <div className="brand">
          <div className="brandMark">A</div>
          <div>
            <strong>ACE IA</strong>
            <span>Juridica</span>
          </div>
        </div>

        <nav className="nav">
          <a href="#panel" className="active">
            <BookOpenCheck size={18} />
            Panel
          </a>
          <a href="#documentos">
            <UploadCloud size={18} />
            Documentos
          </a>
          <a href="#chat">
            <Bot size={18} />
            Chat
          </a>
          <a href="#contratos">
            <FileText size={18} />
            Contratos
          </a>
        </nav>
      </aside>

      <section className="content">
        <header className="topbar">
          <div>
            <p className="eyebrow">Preparado para GitHub y Vercel</p>
            <h1>Aplicacion juridica con IA para contrataciones publicas</h1>
          </div>
          <button className="primaryButton" type="button">
            <UploadCloud size={18} />
            Cargar PDF
          </button>
        </header>

        <section className="statusBand" id="panel">
          <div>
            <span>Arquitectura inicial</span>
            <strong>Next.js + Vercel + Supabase + Pinecone + OpenAI</strong>
          </div>
          <div>
            <span>Enfoque MVP</span>
            <strong>Chat, documentos, busqueda y citas verificables</strong>
          </div>
          <div>
            <span>Seguridad</span>
            <strong>API keys solo en servidor</strong>
          </div>
        </section>

        <section className="workspace">
          <LegalChat />
          <DocumentUpload />
        </section>

        <section className="moduleGrid" id="contratos">
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
      </section>
    </main>
  );
}
