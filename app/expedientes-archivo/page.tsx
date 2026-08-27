import { AppShell } from "../components/app-shell";
import { ExpedientesArchivoWorkspace } from "../components/expedientes-archivo-workspace";
import { getSessionUser } from "@/lib/auth";

export default async function ExpedientesArchivoPage() {
  const user = await getSessionUser();
  // A diferencia de /archivo y /documentos (que usan isEditor = dec/admin tal
  // cual), aqui el area usuaria tambien administra: sube y responde sus
  // propios expedientes archivados, no solo busca.
  const canManage = Boolean(user?.isEditor || user?.role === "area_usuaria");
  const isAdmin = Boolean(user?.isAdmin);
  const userEntity = user?.entity ?? null;

  return (
    <AppShell
      active="expedientes-archivo"
      eyebrow="Biblioteca de expedientes"
      title="Expedientes archivados"
    >
      <section className="singleWorkspace">
        <ExpedientesArchivoWorkspace canManage={canManage} isAdmin={isAdmin} userEntity={userEntity} />
      </section>
    </AppShell>
  );
}
