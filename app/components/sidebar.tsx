"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Activity,
  Archive,
  BarChart3,
  Bell,
  BookOpenCheck,
  Bookmark,
  Bot,
  Briefcase,
  ClipboardList,
  FileSearch,
  FileText,
  GitCompare,
  History,
  Library,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  ScanSearch,
  ScrollText,
  Settings,
  ShieldCheck,
  UploadCloud,
} from "lucide-react";

export type SidebarActive =
  | "panel"
  | "chat"
  | "busqueda"
  | "validar"
  | "normas"
  | "archivo"
  | "analizar"
  | "necesidades"
  | "expedientes"
  | "expedientes-archivo"
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

import type { SessionUser } from "@/lib/auth";

type SidebarUser = Pick<SessionUser, "email" | "role" | "isAdmin"> & {
  permissions: readonly unknown[];
} | null;

const SIDEBAR_COLLAPSED_KEY = "ace-sidebar-collapsed";

type SidebarSectionItem = {
  href: string;
  id: string;
  label: string;
  icon: typeof BookOpenCheck;
  adminOnly: boolean;
  requiredRole?: string;
};

type SidebarSection = {
  label: string;
  items: SidebarSectionItem[];
};

const NAVIGATION: SidebarSection[] = [
  {
    items: [{ href: "/", id: "panel", label: "Inicio", icon: BookOpenCheck, adminOnly: false }],
    label: "General",
  },
  {
    items: [
      { href: "/chat", id: "chat", label: "Chat con fuentes", icon: Bot, adminOnly: false },
      { href: "/busqueda", id: "busqueda", label: "Búsqueda documental", icon: FileSearch, adminOnly: false },
      { href: "/normas", id: "normas", label: "Normas por artículo", icon: Library, adminOnly: false },
      { href: "/archivo", id: "archivo", label: "Archivo documental", icon: Archive, adminOnly: false },
    ],
    label: "Consultar",
  },
  {
    items: [
      { href: "/validar", id: "validar", label: "Validar procedimiento", icon: ShieldCheck, adminOnly: false },
      { href: "/analizar", id: "analizar", label: "Analizar documento", icon: ScanSearch, adminOnly: false },
      { href: "/comparar", id: "comparar", label: "Comparar normas", icon: GitCompare, adminOnly: false },
    ],
    label: "Revisar",
  },
  {
    items: [
      { href: "/necesidades", id: "necesidades", label: "Necesidades", icon: ClipboardList, adminOnly: false },
      { href: "/expedientes", id: "expedientes", label: "Expedientes", icon: Briefcase, adminOnly: false },
      { href: "/expedientes-archivo", id: "expedientes-archivo", label: "Biblioteca expedientes", icon: Library, adminOnly: false },
      { href: "/contratos", id: "contratos", label: "Contratos", icon: FileText, adminOnly: false },
    ],
    label: "Trabajo",
  },
  {
    items: [
      { href: "/guardado", id: "guardado", label: "Guardados", icon: Bookmark, adminOnly: false },
      { href: "/historial", id: "historial", label: "Historial", icon: History, adminOnly: false },
      { href: "/alertas", id: "alertas", label: "Alertas", icon: Bell, adminOnly: false },
    ],
    label: "Organizar",
  },
  {
    items: [
      { href: "/documentos", id: "documentos", label: "Biblioteca PDF", icon: UploadCloud, adminOnly: false },
      { href: "/evaluacion", id: "evaluacion", label: "Evaluación IA", icon: BarChart3, adminOnly: true, requiredRole: "Admin" },
      { href: "/metricas", id: "metricas", label: "Monitoreo", icon: Activity, adminOnly: true, requiredRole: "Admin" },
      { href: "/auditoria", id: "auditoria", label: "Auditoría", icon: ScrollText, adminOnly: true, requiredRole: "Admin" },
      { href: "/configuracion", id: "configuracion", label: "Configuración", icon: Settings, adminOnly: true, requiredRole: "Admin" },
    ],
    label: "Administrar",
  },
];

function readCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

function writeCollapsed(value: boolean) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, value ? "1" : "0");
  } catch {}
}

export function Sidebar({
  active,
  user,
  newsCount,
}: {
  active: SidebarActive;
  user: SidebarUser;
  newsCount: number;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    // Lectura de localStorage post-montaje (evita mismatch de hidratación SSR).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCollapsed(readCollapsed());
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      writeCollapsed(next);
      return next;
    });
  }

  // Atajo de teclado: [ colapsa, ] expande, \ alterna
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      if (event.key === "[" || (event.key === "\\" && (event.ctrlKey || event.metaKey))) {
        event.preventDefault();
        setCollapsed((prev) => {
          const next = !prev;
          writeCollapsed(next);
          return next;
        });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <>
      <button
        type="button"
        className="sidebarMobileToggle"
        onClick={() => setMobileOpen((s) => !s)}
        aria-label="Mostrar menú"
        aria-expanded={mobileOpen}
      >
        <PanelLeftOpen size={18} />
      </button>
      {mobileOpen ? <div className="sidebarMobileScrim" onClick={() => setMobileOpen(false)} /> : null}
      <aside
        className={`sidebar ${collapsed ? "collapsed" : ""} ${mobileOpen ? "mobileOpen" : ""}`}
        aria-label="Navegación principal"
        data-collapsed={collapsed}
      >
        <div className="sidebarTop">
          <Link className="brand" href="/" onClick={() => setMobileOpen(false)}>
            <div className="brandMark">A</div>
            <div className="brandText">
              <strong>ACE IA</strong>
              <span>Juridica</span>
            </div>
          </Link>
          <button
            type="button"
            className="sidebarCollapseBtn"
            onClick={toggleCollapsed}
            aria-label={collapsed ? "Expandir menú" : "Colapsar menú"}
            title={collapsed ? "Expandir menú (Ctrl+\\)" : "Colapsar menú (Ctrl+\\)"}
          >
            {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          </button>
        </div>

        <nav className="nav" aria-label="Menu principal">
          {NAVIGATION.map((section) => (
            <div className="navSection" key={section.label}>
              <span className="navSectionLabel">{section.label}</span>
              <div className="navSectionItems">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const locked = Boolean(item.adminOnly && !user?.isAdmin);

                  if (locked) {
                    const requiredRole = item.requiredRole ?? "Admin";
                    return (
                      <span className="navLocked" key={item.id} title={`Requiere rol ${requiredRole}`}>
                        <Icon size={18} />
                        <span className="navLabel">{item.label}</span>
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
                      title={collapsed ? item.label : undefined}
                      onClick={() => setMobileOpen(false)}
                    >
                      <Icon size={18} />
                      <span className="navLabel">{item.label}</span>
                      {item.id === "alertas" && newsCount > 0 ? (
                        <span className="navBadge">{newsCount}</span>
                      ) : null}
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
                <span className="navLabel">Cerrar sesion</span>
              </button>
            </form>
          </div>
        ) : null}
      </aside>
    </>
  );
}
