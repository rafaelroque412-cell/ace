"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ClipboardList, FileStack, Loader, Plus } from "lucide-react";
import { OBJECT_TYPES, necesidadStatusLabel, objectTypeLabel } from "@/lib/legal-taxonomy";
import { useSettingsCatalog } from "./use-settings-catalog";

type Necesidad = {
  id: string;
  codigo: string | null;
  nombre: string;
  tipo_contratacion: string;
  area_usuaria: string | null;
  status: string;
  created_at: string;
};

export function NecesidadList({ canManage }: { canManage: boolean }) {
  const { entity: configuredEntity } = useSettingsCatalog();
  const [necesidades, setNecesidades] = useState<Necesidad[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [nombre, setNombre] = useState("");
  const [tipoContratacion, setTipoContratacion] = useState("bienes");
  const [finalidadPublica, setFinalidadPublica] = useState("");
  const [objetivo, setObjetivo] = useState("");
  const [centroCosto, setCentroCosto] = useState("");
  const [metaPresupuestal, setMetaPresupuestal] = useState("");
  const [proyectoInversion, setProyectoInversion] = useState("");
  const [areaUsuaria, setAreaUsuaria] = useState("");

  async function reload() {
    setLoading(true);
    try {
      const response = await fetch("/api/necesidades");
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "No se pudieron cargar las necesidades.");
      } else {
        setNecesidades(payload.necesidades ?? []);
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

  async function createNecesidad(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (nombre.trim().length < 3) {
      setError("Escribe un nombre de contratación más completo.");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/necesidades", {
        body: JSON.stringify({
          nombre,
          tipoContratacion,
          finalidadPublica,
          objetivo,
          centroCosto,
          metaPresupuestal,
          proyectoInversion,
          areaUsuaria,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "No se pudo registrar la necesidad.");
        return;
      }
      setNombre("");
      setFinalidadPublica("");
      setObjetivo("");
      setCentroCosto("");
      setMetaPresupuestal("");
      setProyectoInversion("");
      setAreaUsuaria("");
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
          <h2>Necesidades</h2>
          <p>Registro de necesidades del área usuaria. Cada una genera su Ficha y código único y luego se deriva a expediente.</p>
        </div>
        {canManage ? (
          <button className="primaryButton" onClick={() => setShowForm((current) => !current)} type="button">
            <Plus size={17} />
            Nueva necesidad
          </button>
        ) : null}
      </div>

      {showForm && canManage ? (
        <form className="processForm" onSubmit={createNecesidad}>
          <label className="processFormWide">
            <span>Nombre de la contratación</span>
            <input onChange={(event) => setNombre(event.target.value)} placeholder="Adquisición de equipos de cómputo" value={nombre} />
          </label>
          <label>
            <span>Tipo de contratación</span>
            <select onChange={(event) => setTipoContratacion(event.target.value)} value={tipoContratacion}>
              {OBJECT_TYPES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Área usuaria</span>
            <input onChange={(event) => setAreaUsuaria(event.target.value)} placeholder="Subgerencia de…" value={areaUsuaria} />
          </label>
          <label>
            <span>Centro de costo</span>
            <input onChange={(event) => setCentroCosto(event.target.value)} placeholder="C.C. 001" value={centroCosto} />
          </label>
          <label>
            <span>Meta presupuestal</span>
            <input onChange={(event) => setMetaPresupuestal(event.target.value)} placeholder="Meta 0001" value={metaPresupuestal} />
          </label>
          <label>
            <span>Proyecto de inversión</span>
            <input onChange={(event) => setProyectoInversion(event.target.value)} placeholder="CUI / código (si aplica)" value={proyectoInversion} />
          </label>
          <label className="processFormWide">
            <span>Finalidad pública</span>
            <input onChange={(event) => setFinalidadPublica(event.target.value)} placeholder="Necesidad pública que se satisface" value={finalidadPublica} />
          </label>
          <label className="processFormWide">
            <span>Objetivo</span>
            <input onChange={(event) => setObjetivo(event.target.value)} placeholder="Objetivo de la contratación" value={objetivo} />
          </label>
          <div className="processFormActions">
            <button className="primaryButton" disabled={saving} type="submit">
              {saving ? <Loader size={16} /> : <Plus size={16} />}
              Registrar necesidad
            </button>
          </div>
        </form>
      ) : null}

      {error ? <p className="formMessage errorText">{error}</p> : null}

      {loading ? (
        <p className="sideMuted">Cargando necesidades…</p>
      ) : necesidades.length === 0 ? (
        <div className="emptyState">
          <ClipboardList size={20} />
          <p>
            Aún no hay necesidades.{" "}
            {canManage ? "Registra una con “Nueva necesidad”." : "Registrar necesidades requiere rol Área usuaria, ATE o DEC."}
          </p>
        </div>
      ) : (
        <div className="processGrid">
          {necesidades.map((necesidad) => (
            <Link className="processCard" href={`/necesidades/${necesidad.id}`} key={necesidad.id}>
              <div className="processCardTop">
                <FileStack size={18} />
                <span className={`processStatus status-${necesidad.status}`}>{necesidadStatusLabel(necesidad.status)}</span>
              </div>
              <strong>{necesidad.nombre}</strong>
              <small>
                {necesidad.codigo ?? "Sin código"} · {objectTypeLabel(necesidad.tipo_contratacion)}
              </small>
              <div className="processCardMeta">
                <span>{necesidad.area_usuaria ?? configuredEntity?.name ?? "Sin área"}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
