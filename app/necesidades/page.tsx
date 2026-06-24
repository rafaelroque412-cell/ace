import { AppShell } from "../components/app-shell";
import { NecesidadList } from "../components/necesidad-list";
import { getSessionUser } from "@/lib/auth";

export default async function NecesidadesPage() {
  const user = await getSessionUser();
  const canManage = (user?.capabilities ?? []).includes("necesidad.manage");

  return (
    <AppShell active="necesidades" eyebrow="Módulo 1" title="Gestión de Necesidades">
      <section className="singleWorkspace">
        <NecesidadList canManage={canManage} />
      </section>
    </AppShell>
  );
}
