"use client";

import { Building2, Check, Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { formatDocumentNumber } from "@/lib/document-number";

export type Counter = { tipo: string; siguiente: number; preview: string };
export type Oficina = {
  id: string;
  nombre: string;
  entidad: string | null;
  ruc: string | null;
  responsable_nombre: string | null;
  responsable_cargo: string | null;
  sufijo: string | null;
  ancho: number;
  activo: boolean;
  membrete: boolean;
  counters: Counter[];
};

const API = "/api/configuracion/oficinas";

// Construye el preview oficial peruano de un correlativo.
// Formato: {TIPO} N° {NNN}-{AAAA}-{ENTIDAD}/{AREA}
// Ver lib/document-number.ts para detalles.
export function formatCounterPreview(
  tipo: string,
  siguiente: number,
  ancho: number,
  sufijo: string | null | undefined,
  year?: number,
): string {
  return formatDocumentNumber({
    siguiente,
    ancho,
    sufijo: sufijo ?? null,
    tipo,
    ...(year !== undefined ? { year } : {}),
  });
}

export type LoadState = "idle" | "loading" | "ready" | "error";

export function useOficinas() {
  const [oficinas, setOficinas] = useState<Oficina[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(API, { cache: "no-store" });
      const data = await res.json();
      setOficinas(data.oficinas ?? []);
      setError(data.error ?? null);
    } catch {
      setError("No se pudo cargar las oficinas");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { oficinas, loading, error, reload, setOficinas };
}

// Pequeño indicador de estado: "actualizado N segundos atrás"
export function SavedBadge({ at }: { at: number | null }) {
  if (at === null) return null;
  const seconds = Math.floor((Date.now() - at) / 1000);
  if (seconds > 30) return null;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        color: "#1f9d55",
        fontSize: 12,
        fontWeight: 500,
      }}
    >
      <Check size={14} /> Guardado
    </span>
  );
}

export function LoadingLine({ message = "Cargando…" }: { message?: string }) {
  return (
    <p style={{ color: "var(--muted, #667)", fontSize: 13 }}>
      <Loader2 size={14} className="expSpin" /> {message}
    </p>
  );
}

export function ErrorLine({ message }: { message: string }) {
  return (
    <p
      role="alert"
      style={{
        background: "#fee2e2",
        color: "#991b1b",
        padding: 10,
        borderRadius: 8,
        fontSize: 13,
      }}
    >
      <Building2 size={14} style={{ verticalAlign: "-2px" }} /> {message}
    </p>
  );
}
