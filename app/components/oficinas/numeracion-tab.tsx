"use client";

import { Hash, Loader2, Save } from "lucide-react";
import { useState } from "react";
import { formatCounterPreview, type Oficina } from "./use-oficinas";

const TIPOS = ["OFICIO", "INFORME", "CARTA", "MEMORANDUM"] as const;

export function NumeracionTab({
  oficinas,
  setOficinas,
  busyId,
  setBusyId,
  setError,
}: {
  oficinas: Oficina[];
  setOficinas: (v: Oficina[]) => void;
  busyId: string | null;
  setBusyId: (v: string | null) => void;
  setError: (v: string | null) => void;
}) {
  if (oficinas.length === 0) {
    return (
      <EmptyState
        title="Aún no hay oficinas registradas"
        message="Primero registra un área en la pestaña anterior. Cada oficina necesita su numeración correlativa por tipo (OFICIO, INFORME, CARTA, MEMORANDUM)."
      />
    );
  }

  function handlePatchCounter(oficinaId: string, tipo: string, siguiente: number) {
    setOficinas(
      oficinas.map((other) =>
        other.id === oficinaId
          ? {
              ...other,
              counters: other.counters.map((c) =>
                c.tipo === tipo
                  ? {
                      ...c,
                      siguiente,
                      preview: formatCounterPreview(
                        c.tipo,
                        siguiente,
                        other.ancho,
                        other.sufijo,
                      ),
                    }
                  : c,
              ),
            }
          : other,
      ),
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div
        style={{
          background: "#ecfeff",
          color: "#155e75",
          padding: 12,
          borderRadius: 8,
          fontSize: 13,
        }}
      >
        <strong>Formato de la numeración:</strong>{" "}
        <code
          style={{
            background: "#fff",
            padding: "1px 6px",
            borderRadius: 4,
            fontSize: 12,
          }}
        >
          {`{TIPO} N° {nro}-{año}-{sufijo}`}
        </code>{" "}
        — Ej: <strong>OFICIO N° 001-2026-MDCH-GM</strong>. El año se toma del
        servidor. El sufijo se descompone por "/" o "-" en varios segmentos.
      </div>

      {oficinas.map((o) => (
        <NumeracionCard
          key={o.id}
          oficina={o}
          oficinas={oficinas}
          patchCounter={handlePatchCounter}
          setOficinas={setOficinas}
          busyId={busyId}
          setBusyId={setBusyId}
          setError={setError}
        />
      ))}
    </div>
  );
}

function NumeracionCard({
  oficina,
  oficinas,
  patchCounter,
  setOficinas,
  busyId,
  setBusyId,
  setError,
}: {
  oficina: Oficina;
  oficinas: Oficina[];
  patchCounter: (oficinaId: string, tipo: string, siguiente: number) => void;
  setOficinas: (v: Oficina[]) => void;
  busyId: string | null;
  setBusyId: (v: string | null) => void;
  setError: (v: string | null) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  function handlePatch(tipo: string, siguiente: number) {
    patchCounter(oficina.id, tipo, siguiente);
  }

  async function save() {
    setSaving(true);
    setBusyId(oficina.id);
    try {
      const res = await fetch(
        `/api/configuracion/oficinas/${oficina.id}/numeracion`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            counters: oficina.counters.map((c) => ({
              tipo: c.tipo,
              siguiente: c.siguiente,
            })),
          }),
        },
      );
      let data: { ok?: boolean; error?: string; counters?: typeof oficina.counters } = {};
      try {
        const text = await res.text();
        data = text ? (JSON.parse(text) as typeof data) : {};
      } catch {
        data = { error: `Respuesta no es JSON (status ${res.status})` };
      }
      if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`);
      setSavedAt(Date.now());
      if (data.counters) {
        setOficinas(
          oficinas.map((o) =>
            o.id === oficina.id
              ? {
                  ...o,
                  counters: oficina.counters.map((c) => {
                    const updated = data.counters!.find(
                      (dc) => dc.tipo === c.tipo,
                    );
                    return updated
                      ? { ...c, siguiente: updated.siguiente }
                      : c;
                  }),
                }
              : o,
          ),
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar la numeración");
    } finally {
      setSaving(false);
      setBusyId(null);
    }
  }

  return (
    <div
      style={{
        border: "1px solid var(--line, #e2e4ea)",
        borderRadius: 12,
        padding: 14,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 8,
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <h4 style={{ margin: 0, fontSize: 15 }}>
          {oficina.nombre}
          {oficina.sufijo ? (
            <span
              style={{
                color: "var(--muted, #667)",
                fontSize: 12,
                fontWeight: 400,
                marginLeft: 6,
              }}
            >
              ({oficina.sufijo})
            </span>
          ) : null}
        </h4>
        <span style={{ fontSize: 12, color: "var(--muted, #667)" }}>
          {oficina.entidad ?? "Sin entidad"}
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 8,
        }}
      >
        {TIPOS.map((t) => {
          const c = oficina.counters.find((x) => x.tipo === t);
          const preview = formatCounterPreview(
            t,
            c?.siguiente ?? 1,
            oficina.ancho,
            oficina.sufijo,
          );
          return (
            <label key={t} className="formField">
              <span>
                <Hash size={11} style={{ verticalAlign: "-1px" }} /> {t}
              </span>
              <input
                type="number"
                min={1}
                value={c?.siguiente ?? 1}
                onChange={(e) =>
                  handlePatch(t, Math.max(1, parseInt(e.target.value, 10) || 1))
                }
              />
              <small
                style={{
                  color: "var(--brand, #0f766e)",
                  fontSize: 11,
                  fontWeight: 500,
                  fontFamily: "ui-monospace, monospace",
                }}
              >
                {preview}
              </small>
            </label>
          );
        })}
      </div>

      <div
        style={{
          display: "flex",
          gap: 10,
          marginTop: 12,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <button
          className="primaryButton"
          onClick={save}
          type="button"
          disabled={saving || busyId === oficina.id}
        >
          {saving ? <Loader2 size={16} className="expSpin" /> : <Save size={16} />}{" "}
          Guardar numeración
        </button>
        {savedAt && Date.now() - savedAt < 30_000 ? (
          <span
            style={{
              color: "#1f9d55",
              fontSize: 12,
              fontWeight: 500,
            }}
          >
            Guardado
          </span>
        ) : null}
        <span style={{ fontSize: 12, color: "var(--muted, #667)" }}>
          El ancho y sufijo se editan en la pestaña <strong>Áreas</strong>.
        </span>
      </div>
    </div>
  );
}

function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <div
      style={{
        background: "#f1f5f9",
        color: "#475569",
        padding: 16,
        borderRadius: 8,
        fontSize: 14,
      }}
    >
      <strong>{title}</strong>
      <p style={{ margin: "6px 0 0", fontSize: 13 }}>{message}</p>
    </div>
  );
}
