import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { LoginForm } from "@/app/components/login-form";

export const dynamic = "force-dynamic";

type LoginPageProps = {
  searchParams: Promise<{ next?: string }>;
};

function safeNext(value?: string) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { next } = await searchParams;
  const target = safeNext(next);
  const user = await getSessionUser();

  if (user) {
    redirect(target);
  }

  return (
    <main className="authShell">
      <section className="authCard">
        <div className="authBrand">
          <div className="brandMark">A</div>
          <div>
            <strong>ACE IA Juridica</strong>
            <span>Contrataciones publicas - Peru</span>
          </div>
        </div>
        <p className="authLead">
          Accede para consultar el corpus normativo y tu historial privado de consultas.
        </p>
        <LoginForm next={target} />
      </section>
    </main>
  );
}
