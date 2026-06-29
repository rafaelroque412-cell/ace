"use client";

import { Building2 } from "lucide-react";
import { useState } from "react";
import { AreasTab } from "./oficinas/areas-tab";
import { MembreteTab } from "./oficinas/membrete-tab";
import { NumeracionTab } from "./oficinas/numeracion-tab";
import { ErrorLine, LoadingLine, useOficinas } from "./oficinas/use-oficinas";

type Tab = "areas" | "numeracion" | "membrete";

// Gestión de OFICINAS emisoras (admin) en 3 pestañas:
//   1) Áreas       — CRUD de oficinas (nombre, entidad, RUC, responsable, siglas)
//   2) Numeración  — correlativo por tipo (OFICIO/INFORME/CARTA/MEMORANDUM)
//   3) Membrete    — PDF de fondo que se usa al exportar respuestas
// Regla: para configurar numeración y membrete primero hay que tener el área
// registrada. La pestaña "Numeración" está habilitada cuando hay al menos
// 1 oficina, y "Membrete" cuando la oficina activa ya tiene numeración
// configurada.
export function OficinasSettings() {
  const { oficinas, loading, error, reload, setOficinas } = useOficinas();
  const [tab, setTab] = useState<Tab>("areas");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const hasOficinas = oficinas.length > 0;
  const numeracionConfigurada = hasOficinas
    ? oficinas.some((o) => o.counters.some((c) => c.siguiente > 0))
    : false;

  return (
    <section className="toolPanel" style={{ marginTop: 24 }}>
      <div className="userSectionTitle" style={{ marginBottom: 12 }}>
        <h2>
          <Building2 size={18} style={{ verticalAlign: "-3px" }} /> Oficinas y
          numeración
        </h2>
        <p style={{ color: "var(--muted, #667)", fontSize: 13, margin: "4px 0 0" }}>
          Configura en orden: 1) registra el área, 2) define la numeración
          correlativa, 3) sube la hoja membretada. La pestaña "Responder" usa esta
          configuración.
        </p>
      </div>

      <nav
        role="tablist"
        style={{
          display: "flex",
          gap: 4,
          borderBottom: "1px solid var(--line, #e2e4ea)",
          marginBottom: 16,
        }}
      >
        <TabButton
          active={tab === "areas"}
          onClick={() => setTab("areas")}
          step={1}
          label="Áreas"
          enabled
        />
        <TabButton
          active={tab === "numeracion"}
          onClick={() => setTab("numeracion")}
          step={2}
          label="Numeración"
          enabled={hasOficinas}
          badge={hasOficinas ? undefined : "Pendiente"}
        />
        <TabButton
          active={tab === "membrete"}
          onClick={() => setTab("membrete")}
          step={3}
          label="Membrete"
          enabled={hasOficinas}
          badge={hasOficinas && !numeracionConfigurada ? "Después" : undefined}
        />
      </nav>

      {localError ? <ErrorLine message={localError} /> : null}
      {error ? <ErrorLine message={error} /> : null}

      {loading ? (
        <LoadingLine message="Cargando oficinas…" />
      ) : tab === "areas" ? (
        <AreasTab
          oficinas={oficinas}
          setOficinas={setOficinas}
          busyId={busyId}
          setBusyId={setBusyId}
          error={null}
          setError={setLocalError}
          reload={reload}
        />
      ) : tab === "numeracion" ? (
        !hasOficinas ? (
          <NumeracionTab
            oficinas={[]}
            setOficinas={setOficinas}
            busyId={busyId}
            setBusyId={setBusyId}
            setError={setLocalError}
          />
        ) : (
          <NumeracionTab
            oficinas={oficinas}
            setOficinas={setOficinas}
            busyId={busyId}
            setBusyId={setBusyId}
            setError={setLocalError}
          />
        )
      ) : (
        <MembreteTab
          oficinas={oficinas}
          setOficinas={setOficinas}
          busyId={busyId}
          setBusyId={setBusyId}
          setError={setLocalError}
          reload={reload}
        />
      )}
    </section>
  );
}

function TabButton({
  active,
  onClick,
  step,
  label,
  enabled,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  step: number;
  label: string;
  enabled: boolean;
  badge?: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      disabled={!enabled}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "10px 14px",
        background: "transparent",
        border: 0,
        borderBottom: active ? "2px solid var(--brand, #0f766e)" : "2px solid transparent",
        color: !enabled
          ? "var(--muted, #94a3b8)"
          : active
            ? "var(--brand, #0f766e)"
            : "var(--ink, #1f2937)",
        fontWeight: active ? 600 : 500,
        fontSize: 14,
        cursor: enabled ? "pointer" : "not-allowed",
        opacity: enabled ? 1 : 0.6,
        marginBottom: -1,
      }}
    >
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 22,
          height: 22,
          borderRadius: 999,
          background: active ? "var(--brand, #0f766e)" : "var(--line, #e2e4ea)",
          color: active ? "#fff" : "var(--muted, #667)",
          fontSize: 11,
          fontWeight: 700,
        }}
      >
        {step}
      </span>
      {label}
      {badge ? (
        <span
          style={{
            fontSize: 10,
            padding: "1px 6px",
            borderRadius: 999,
            background: "#fef3c7",
            color: "#92400e",
            fontWeight: 600,
          }}
        >
          {badge}
        </span>
      ) : null}
    </button>
  );
}
