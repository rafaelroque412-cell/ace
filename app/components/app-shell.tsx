import Link from "next/link";
import { BookOpenCheck, Bot, FileText, UploadCloud } from "lucide-react";

type AppShellProps = {
  active: "panel" | "chat" | "documentos" | "contratos";
  children: React.ReactNode;
  eyebrow: string;
  title: string;
  action?: React.ReactNode;
};

const navigation = [
  { href: "/", icon: BookOpenCheck, id: "panel", label: "Panel" },
  { href: "/chat", icon: Bot, id: "chat", label: "Consulta legal" },
  { href: "/documentos", icon: UploadCloud, id: "documentos", label: "Carga e indexacion" },
  { href: "/contratos", icon: FileText, id: "contratos", label: "Contratos" },
] as const;

export function AppShell({ active, action, children, eyebrow, title }: AppShellProps) {
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
          {navigation.map((item) => {
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
              </Link>
            );
          })}
        </nav>
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
