"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Briefcase, FileStack, Loader, Plus } from "lucide-react";
import {
  OBJECT_TYPES,
  objectTypeLabel,
  processStatusLabel,
  processTypeLabel,
} from "@/lib/legal-taxonomy";
import { processLabelFromOptions, useSettingsCatalog, withBlankProcessOption } from "./use-settings-catalog";

type Process = {
  id: string;
  nomenclature: string;
  object_type: string;
  procedure_type: string | null;
  amount: number | null;
  entity: string | null;
  status: string;
  updated_at: string;
};

function formatAmount(amount: number | null) {
  if (amount == null) return "—";
  return `S/ ${amount.toLocaleString("es-PE", { minimumFractionDigits: 2 })}`;
}

export function ProcessList({ canManage }: { canManage: boolean }) {
  const { entity: configuredEntity, processTypes: configuredProcessTypes } = useSettingsCatalog();
  const procedureTypes = withBlankProcessOption(configuredProcessTypes, "Sin definir");
  const [processes, setProcesses] = useState<Process[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [nomenclature, setNomenclature] = useState("");
  const [objectType, setObjectType] = useState("servicios");
  const [procedureType, setProcedureType] = useState("");
  const [amount, setAmount] = useState("");
  const [entity, setEntity] = useState("");

  async function reload() {
    setLoading(true);
    try {
      const response = await fetch("/api/processes");
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "No se pudieron cargar los expedientes.");
      } else {
        setProcesses(payload.processes ?? []);
        setError("");
      }
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
  }, []);

  async function createProcess(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (nomenclature.trim().length < 3) {
      setError("Escribe una nomenclatura más completa.");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/processes", {
        body: JSON.stringify({
          nomenclature,
          objectType,
          procedureType,
          amount: amount || undefined,
          entity: entity || configuredEntity?.name || undefined,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "No se pudo crear el expediente.");
        return;
      }
      setNomenclature("");
      setProcedureType("");
      setAmount("");
      setEntity("");
      setShowForm(false);
      setError("");
      await reload();
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="processWorkspace">
      <div className="processHeader">
        <div>
          <h2>Mis expedientes</h2>
          <p>Procedimientos de contratación con sus documentos, evaluaciones y riesgos.</p>
        </div>
        {canManage ? (
          <button className="primaryButton" onClick={() => setShowForm((current) => !current)} type="button">
            <Plus size={17} />
            Nuevo expediente
          </button>
        ) : null}
      </div>

      {showForm && canManage ? (
        <form className="processForm" onSubmit={createProcess}>
          <label className="processFormWide">
            <span>Nomenclatura / objeto</span>
            <input
              onChange={(event) => setNomenclature(event.target.value)}
              placeholder="CP N° 001-2026 — Servicio de mantenimiento"
              value={nomenclature}
            />
          </label>
          <label>
            <span>Tipo de objeto</span>
            <select onChange={(event) => setObjectType(event.target.value)} value={objectType}>
              {OBJECT_TYPES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Procedimiento</span>
            <select onChange={(event) => setProcedureType(event.target.value)} value={procedureType}>
              {procedureTypes.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Monto (S/)</span>
            <input inputMode="decimal" onChange={(event) => setAmount(event.target.value)} placeholder="95000" value={amount} />
          </label>
          <label>
            <span>Entidad</span>
            <input
              onChange={(event) => setEntity(event.target.value)}
              placeholder="Municipalidad de…"
              value={entity || configuredEntity?.name || ""}
            />
          </label>
          <div className="processFormActions">
            <button className="primaryButton" disabled={saving} type="submit">
              {saving ? <Loader size={16} /> : <Plus size={16} />}
              Crear expediente
            </button>
          </div>
        </form>
      ) : null}

      {error ? <p className="formMessage errorText">{error}</p> : null}

      {loading ? (
        <p className="sideMuted">Cargando expedientes…</p>
      ) : processes.length === 0 ? (
        <div className="emptyState">
          <Briefcase size={20} />
          <p>
            Aún no hay expedientes. {canManage ? "Crea uno con “Nuevo expediente”." : "Crear y gestionar expedientes requiere un rol con gestión (DEC, AGA, Titular o administrador)."}
          </p>
        </div>
      ) : (
        <div className="processGrid">
          {processes.map((process) => (
            <Link className="processCard" href={`/expedientes/${process.id}`} key={process.id}>
              <div className="processCardTop">
                <FileStack size={18} />
                <span className={`processStatus status-${process.status}`}>{processStatusLabel(process.status)}</span>
              </div>
              <strong>{process.nomenclature}</strong>
              <small>
                {objectTypeLabel(process.object_type)}
                {process.procedure_type
                  ? ` · ${
                      processLabelFromOptions(configuredProcessTypes, process.procedure_type) ??
                      processTypeLabel(process.procedure_type) ??
                      process.procedure_type
                    }`
                  : ""}
              </small>
              <div className="processCardMeta">
                <span>{formatAmount(process.amount)}</span>
                <span>{process.entity ?? "Sin entidad"}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
