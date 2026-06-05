import Link from "next/link";
import { Lock, Settings } from "lucide-react";
import { AppShell } from "../components/app-shell";
import { AdminSettings } from "../components/admin-settings";
import { getSessionUser } from "@/lib/auth";

export default async function ConfiguracionPage() {
  const user = await getSessionUser();
  const isAdmin = Boolean(user?.isAdmin);

  return (
    <AppShell
      active="configuracion"
      action={
        <Link className="secondaryButton" href="/metricas">
          <Settings size={17} />
          Monitoreo
        </Link>
      }
      eyebrow="Administracion"
      title="Configuracion del sistema"
    >
      <section className="singleWorkspace">
        {isAdmin ? (
          <AdminSettings />
        ) : (
          <div className="emptyState">
            <Lock size={20} />
            <p>La configuracion institucional esta reservada a usuarios administradores.</p>
            <Link className="primaryButton" href="/chat">
              Ir al chat
            </Link>
          </div>
        )}
      </section>
    </AppShell>
  );
}
