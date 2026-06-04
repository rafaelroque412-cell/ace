"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogIn, UserPlus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type LoginFormProps = {
  next: string;
};

export function LoginForm({ next }: LoginFormProps) {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);

    const supabase = createClient();

    try {
      if (mode === "signin") {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) {
          throw signInError;
        }
        router.push(next);
        router.refresh();
      } else {
        const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
        if (signUpError) {
          throw signUpError;
        }
        if (data.session) {
          router.push(next);
          router.refresh();
        } else {
          setInfo(
            "Cuenta creada. Si la confirmacion por correo esta activada, revisa tu bandeja; luego inicia sesion.",
          );
          setMode("signin");
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo completar la autenticacion");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="authForm" onSubmit={handleSubmit}>
      <div className="authTabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "signin"}
          className={mode === "signin" ? "active" : undefined}
          onClick={() => setMode("signin")}
        >
          Iniciar sesion
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "signup"}
          className={mode === "signup" ? "active" : undefined}
          onClick={() => setMode("signup")}
        >
          Registrarse
        </button>
      </div>

      <label className="authField">
        <span>Correo</span>
        <input
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="tu@correo.com"
        />
      </label>

      <label className="authField">
        <span>Contrasena</span>
        <input
          type="password"
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
          required
          minLength={6}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Minimo 6 caracteres"
        />
      </label>

      {error ? <p className="authError">{error}</p> : null}
      {info ? <p className="authInfo">{info}</p> : null}

      <button className="primaryButton" type="submit" disabled={loading}>
        {mode === "signin" ? <LogIn size={18} /> : <UserPlus size={18} />}
        {loading ? "Procesando..." : mode === "signin" ? "Entrar" : "Crear cuenta"}
      </button>
    </form>
  );
}
