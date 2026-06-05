import Link from "next/link";
import {
  Activity,
  BarChart3,
  Bell,
  BookOpenCheck,
  Bookmark,
  Bot,
  Briefcase,
  FileSearch,
  FileText,
  GitCompare,
  History,
  Library,
  LogOut,
  Settings,
  ShieldCheck,
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
    | "validar"
    | "normas"
    | "analizar"
    | "expedientes"
    | "documentos"
    | "comparar"
    | "historial"
    | "contratos"
    | "alertas"
    | "guardado"
    | "evaluacion"
    | "metricas"
    | "auditoria"
    | "configuracion";
  children: React.ReactNode;
  eyebrow: string;
  title: string;
  action?: React.ReactNode;
};

const navigation = [
  {
    items: [{ href: "/", icon: BookOpenCheck, id: "panel", label: "Inicio", adminOnly: false }],
    label: "General",
  },
  {
    items: [
      { href: "/chat", icon: Bot, id: "chat", label: "Chat con fuentes", adminOnly: false },
      { href: "/busqueda", icon: FileSearch, id: "busqueda", label: "Búsqueda documental", adminOnly: false },
      { href: "/normas", icon: Library, id: "normas", label: "Normas por artículo", adminOnly: false },
    ],
    label: "Consultar",
  },
  {
    items: [
      { href: "/validar", icon: ShieldCheck, id: "validar", label: "Validar procedimiento", adminOnly: false },
      { href: "/analizar", icon: ScanSearch, id: "analizar", label: "Analizar documento", adminOnly: false },
      { href: "/comparar", icon: GitCompare, id: "comparar", label: "Comparar normas", adminOnly: false },
    ],
    label: "Revisar",
  },
  {
    items: [
      { href: "/expedientes", icon: Briefcase, id: "expedientes", label: "Expedientes", adminOnly: false },
      { href: "/contratos", icon: FileText, id: "contratos", label: "Contratos", adminOnly: false },
    ],
    label: "Trabajo",
  },
  {
    items: [
      { href: "/documentos", icon: UploadCloud, id: "documentos", label: "Biblioteca PDF", adminOnly: false },
      { href: "/guardado", icon: Bookmark, id: "guardado", label: "Guardados", adminOnly: false },
      { href: "/historial", icon: History, id: "historial", label: "Historial", adminOnly: false },
      { href: "/alertas", icon: Bell, id: "alertas", label: "Alertas", adminOnly: false },
    ],
    label: "Organizar",
  },
  {
    items: [
      { href: "/evaluacion", icon: BarChart3, id: "evaluacion", label: "Evaluación IA", adminOnly: true, requiredRole: "Admin" },
      { href: "/metricas", icon: Activity, id: "metricas", label: "Monitoreo", adminOnly: true, requiredRole: "Admin" },
      { href: "/auditoria", icon: ScrollText, id: "auditoria", label: "Auditoría", adminOnly: true, requiredRole: "Admin" },
      { href: "/configuracion", icon: Settings, id: "configuracion", label: "Configuración", adminOnly: true, requiredRole: "Admin" },
    ],
    label: "Administrar",
  },
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
  const sections = navigation;

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

        <nav className="nav" aria-label="Menu principal">
          {sections.map((section) => (
            <div className="navSection" key={section.label}>
              <span className="navSectionLabel">{section.label}</span>
              <div className="navSectionItems">
                {section.items.map((item) => {
                  const Icon = item.icon;

                  const locked = Boolean(item.adminOnly && !user?.isAdmin);

                  if (locked) {
                    const requiredRole = "requiredRole" in item ? item.requiredRole : "Admin";
                    return (
                      <span className="navLocked" key={item.id} title={`Requiere rol ${requiredRole}`}>
                        <Icon size={18} />
                        {item.label}
                        <small>{requiredRole}</small>
                      </span>
                    );
                  }

                  return (
                    <Link
                      aria-current={active === item.id ? "page" : undefined}
                      className={active === item.id ? "active" : undefined}
                      href={item.href}
                      key={item.id}
                      title={item.label}
                    >
                      <Icon size={18} />
                      {item.label}
                      {item.id === "alertas" && newsCount > 0 ? <span className="navBadge">{newsCount}</span> : null}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {user ? (
          <div className="userBox">
            <span className="userEmail" title={user.email ?? undefined}>
              {user.email ?? "Sesion activa"}
            </span>
            <span className="userRole">
              {user.role === "admin"
                ? "Administrador"
                : user.role === "dec"
                  ? "DEC"
                  : user.role === "legal"
                    ? "Asesoría Jurídica"
                    : user.role === "area_usuaria"
                      ? "Área Usuaria"
                      : "Consulta"}
            </span>
            {user.permissions.length > 0 ? (
              <span className="userPermissions">{user.permissions.length} permiso(s) activos</span>
            ) : null}
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
