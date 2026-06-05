import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "../../components/app-shell";
import { ProcessDetail } from "../../components/process-detail";
import { getSessionUser } from "@/lib/auth";

export default async function ExpedienteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [{ id }, user] = await Promise.all([params, getSessionUser()]);

  return (
    <AppShell
      active="expedientes"
      action={
        <Link className="secondaryButton" href="/expedientes">
          <ArrowLeft size={17} />
          Volver
        </Link>
      }
      eyebrow="Procedimiento"
      title="Detalle del expediente"
    >
      <section className="singleWorkspace">
        <ProcessDetail processId={id} canManage={Boolean(user?.isDec)} />
      </section>
    </AppShell>
  );
}
