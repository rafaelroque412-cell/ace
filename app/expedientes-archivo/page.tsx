import { AppShell } from "../components/app-shell";
import { ExpedientesArchivoWorkspace } from "../components/expedientes-archivo-workspace";
import { getSessionUser } from "@/lib/auth";

export default async function ExpedientesArchivoPage() {
  const user = await getSessionUser();
  const canManage = Boolean(user?.isEditor);

  return (
    <AppShell
      active="expedientes-archivo"
      eyebrow="Biblioteca de expedientes"
      title="Expedientes archivados"
    >
      <section className="singleWorkspace">
        <ExpedientesArchivoWorkspace canManage={canManage} />
      </section>
    </AppShell>
  );
}
