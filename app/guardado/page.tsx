import Link from "next/link";
import { FileSearch } from "lucide-react";
import { AppShell } from "../components/app-shell";
import { SavedWorkspace } from "../components/saved-workspace";

export default function GuardadoPage() {
  return (
    <AppShell
      active="guardado"
      action={
        <Link className="secondaryButton" href="/busqueda">
          <FileSearch size={17} />
          Ir a Consultas
        </Link>
      }
      eyebrow="Engagement"
      title="Mis carpetas y guardados"
    >
      <section className="singleWorkspace">
        <SavedWorkspace />
      </section>
    </AppShell>
  );
}
