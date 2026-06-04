import Link from "next/link";
import {
  Activity,
  BarChart3,
  Bell,
  BookOpenCheck,
  Bookmark,
  Bot,
  FileSearch,
  FileText,
  GitCompare,
  History,
  Library,
  LogOut,
  ScanSearch,
  ScrollText,
  UploadCloud,
} from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { supabaseRest } from "@/lib/supabase-server";

type AppShellProps = {
  active:
    | "panel"
    | "chat"
    | "busqueda"
    | "normas"
    | "analizar"
    | "documentos"
    | "comparar"
    | "historial"
    | "contratos"
    | "alertas"
    | "guardado"
    | "evaluacion"
    | "metricas"
    | "auditoria";
  children: React.ReactNode;
  eyebrow: string;
  title: string;
  action?: React.ReactNode;
};

const navigation = [
  { href: "/", icon: BookOpenCheck, id: "panel", label: "Panel", adminOnly: false },
  { href: "/chat", icon: Bot, id: "chat", label: "Chat", adminOnly: false },
  { href: "/busqueda", icon: FileSearch, id: "busqueda", label: "Consultas", adminOnly: false },
  { href: "/normas", icon: Library, id: "normas", label: "Normas", adminOnly: false },
  { href: "/analizar", icon: ScanSearch, id: "analizar", label: "Analizar", adminOnly: false },
  { href: "/alertas", icon: Bell, id: "alertas", label: "Alertas", adminOnly: false },
  { href: "/guardado", icon: Bookmark, id: "guardado", label: "Guardado", adminOnly: false },
  { href: "/documentos", icon: UploadCloud, id: "documentos", label: "Documentos", adminOnly: false },
  { href: "/comparar", icon: GitCompare, id: "comparar", label: "Comparar", adminOnly: false },
  { href: "/historial", icon: History, id: "historial", label: "Historial", adminOnly: false },
  { href: "/contratos", icon: FileText, id: "contratos", label: "Contratos", adminOnly: false },
  { href: "/evaluacion", icon: BarChart3, id: "evaluacion", label: "Evaluación", adminOnly: true },
  { href: "/metricas", icon: Activity, id: "metricas", label: "Monitoreo", adminOnly: true },
  { href: "/auditoria", icon: ScrollText, id: "auditoria", label: "Auditoría", adminOnly: true },
] as const;

async function countRecentNews() {
  try {
    const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
    const rows = await supabaseRest<Array<{ id: string }>>(
      `boletin_eventos?created_at=gte.${since}&select=id&limit=50`,
    );
    return rows.length;
  } catch {
    return 0;
  }
}

export async function AppShell({ active, action, children, eyebrow, title }: AppShellProps) {
  const [user, newsCount] = await Promise.all([getSessionUser(), countRecentNews()]);
  const items = navigation.filter((item) => !item.adminOnly || user?.isAdmin);

  return (
    <main className="shell">
      <aside className="sidebar" aria-label="Navegacion principal">
        <Link className="brand" href="/">
          <div className="brandMark">A</div>
          <div>
            <strong>ACE IA</strong>
            <span>Juridica</span>
          </div>
        </Link>

        <nav className="nav">
          {items.map((item) => {
            const Icon = item.icon;

            return (
              <Link
                aria-current={active === item.id ? "page" : undefined}
                className={active === item.id ? "active" : undefined}
                href={item.href}
                key={item.id}
              >
                <Icon size={18} />
                {item.label}
                {item.id === "alertas" && newsCount > 0 ? <span className="navBadge">{newsCount}</span> : null}
              </Link>
            );
          })}
        </nav>

        {user ? (
          <div className="userBox">
            <span className="userEmail" title={user.email ?? undefined}>
              {user.email ?? "Sesion activa"}
            </span>
            <span className="userRole">
              {user.role === "admin" ? "Administrador" : user.role === "editor" ? "Editor" : "Usuario"}
            </span>
            <form action="/auth/signout" method="post">
              <button className="signoutButton" type="submit">
                <LogOut size={16} />
                Cerrar sesion
              </button>
            </form>
          </div>
        ) : null}
      </aside>

      <section className="content">
        <header className="topbar">
          <div>
            <p className="eyebrow">{eyebrow}</p>
            <h1>{title}</h1>
          </div>
          {action}
        </header>

        {children}
      </section>
    </main>
  );
}
