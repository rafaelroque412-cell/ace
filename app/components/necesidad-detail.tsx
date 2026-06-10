"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRightCircle,
  Briefcase,
  Download,
  FileText,
  Loader,
  Trash2,
  UploadCloud,
} from "lucide-react";
import {
  NECESIDAD_DOC_KINDS,
  NECESIDAD_STATUSES,
  necesidadDocKindLabel,
  necesidadStatusLabel,
  objectTypeLabel,
} from "@/lib/legal-taxonomy";

type Necesidad = {
  id: string;
  codigo: string | null;
  nombre: string;
  finalidad_publica: string | null;
  objetivo: string | null;
  centro_costo: string | null;
  meta_presupuestal: string | null;
  proyecto_inversion: string | null;
  tipo_contratacion: string;
  area_usuaria: string | null;
  status: string;
  summary: string | null;
  process_id: string | null;
  entity: string | null;
  created_at: string;
};

type Documento = {
  id: string;
  kind: string;
  title: string;
  status: string;
  created_at: string;
};

type Permisos = { manage: boolean; derivar: boolean };

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="fichaRow">
      <span className="fichaLabel">{label}</span>
      <span className="fichaValue">{value && value.trim() ? value : "—"}</span>
    </div>
  );
}

export function NecesidadDetail({ necesidadId, permisos }: { necesidadId: string; permisos: Permisos }) {
  const [necesidad, setNecesidad] = useState<Necesidad | null>(null);
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deriving, setDeriving] = useState(false);
  const [kind, setKind] = useState("requerimiento");
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // La carga se bloquea una vez derivada (la instrucción documental sigue en el expediente).
  const puedeAdjuntar = permisos.manage && necesidad?.status !== "derivada";

  async function reload() {
    try {
      const response = await fetch(`/api/necesidades/${necesidadId}`);
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "No se pudo cargar la necesidad.");
        return;
      }
      setNecesidad(payload.necesidad);
      setDocumentos(payload.documentos ?? []);
      setError("");
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [necesidadId]);

  async function changeStatus(status: string) {
    try {
      await fetch(`/api/necesidades/${necesidadId}`, {
        body: JSON.stringify({ status }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      });
      await reload();
    } catch {
      setError("No se pudo actualizar el estado.");
    }
  }

  async function derivar() {
    setDeriving(true);
    setError("");
    try {
      const response = await fetch(`/api/necesidades/${necesidadId}/derivar`, { method: "POST" });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "No se pudo derivar a expediente.");
        return;
      }
      await reload();
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setDeriving(false);
    }
  }

  async function uploadDocumento(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError("Selecciona un PDF.");
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("kind", kind);
      const response = await fetch(`/api/necesidades/${necesidadId}/documentos`, { body: formData, method: "POST" });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "No se pudo subir el documento.");
        return;
      }
      if (fileRef.current) {
        fileRef.current.value = "";
      }
      setError("");
      await reload();
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setUploading(false);
    }
  }

  async function deleteDocumento(documentoId: string) {
    setDeletingId(documentoId);
    try {
      const response = await fetch(`/api/necesidades/${necesidadId}/documentos?documentoId=${documentoId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        setError(payload.error ?? "No se pudo eliminar el documento.");
        return;
      }
      await reload();
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) {
    return <p className="sideMuted">Cargando necesidad…</p>;
  }

  if (!necesidad) {
    return (
      <div className="emptyState">
        <AlertTriangle size={20} />
        <p>{error || "Necesidad no encontrada."}</p>
      </div>
    );
  }

  return (
    <div className="processDetail">
      <header className="processDetailHeader">
        <div>
          <h2>{necesidad.nombre}</h2>
          <div className="processDetailMeta">
            <span>{necesidad.codigo ?? "Sin código"}</span>
            <span>{objectTypeLabel(necesidad.tipo_contratacion)}</span>
            <span>{necesidad.area_usuaria ?? "Sin área usuaria"}</span>
          </div>
        </div>
        <div className="processStatusBox">
          {permisos.manage && necesidad.status !== "derivada" ? (
            <label>
              <span>Estado</span>
              <select onChange={(event) => void changeStatus(event.target.value)} value={necesidad.status}>
                {NECESIDAD_STATUSES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <span className={`processStatus status-${necesidad.status}`}>{necesidadStatusLabel(necesidad.status)}</span>
          )}
        </div>
      </header>

      {error ? <p className="formMessage errorText">{error}</p> : null}

      <div className="processDetailGrid">
        <section className="processPanel">
          <div className="processPanelHead">
            <FileText size={17} />
            <strong>Ficha de Necesidad</strong>
          </div>
          <div className="fichaGrid">
            <Row label="Entidad" value={necesidad.entity} />
            <Row label="Área usuaria" value={necesidad.area_usuaria} />
            <Row label="Tipo de contratación" value={objectTypeLabel(necesidad.tipo_contratacion)} />
            <Row label="Centro de costo" value={necesidad.centro_costo} />
            <Row label="Meta presupuestal" value={necesidad.meta_presupuestal} />
            <Row label="Proyecto de inversión" value={necesidad.proyecto_inversion} />
            <Row label="Finalidad pública" value={necesidad.finalidad_publica} />
            <Row label="Objetivo" value={necesidad.objetivo} />
            <Row label="Descripción / resumen" value={necesidad.summary} />
          </div>
          <a className="secondaryButton compactButton" href={`/api/necesidades/${necesidad.id}/ficha`}>
            <Download size={15} />
            Exportar Ficha (Word)
          </a>
        </section>

        <aside className="processSide">
          <section className="processPanel">
            <div className="processPanelHead">
              <ArrowRightCircle size={17} />
              <strong>Derivación a expediente</strong>
            </div>
            {necesidad.process_id ? (
              <>
                <p className="sideMuted">Esta necesidad ya fue derivada a un expediente de contratación.</p>
                <Link className="primaryButton compactButton" href={`/expedientes/${necesidad.process_id}`}>
                  <Briefcase size={15} />
                  Abrir expediente
                </Link>
              </>
            ) : (
              <>
                <p className="sideMuted">
                  Al derivar, la DEC crea el Expediente de Contratación y la necesidad pasa a estado “derivada”.
                </p>
                <button
                  className="primaryButton compactButton"
                  disabled={!permisos.derivar || deriving}
                  onClick={derivar}
                  type="button"
                >
                  {deriving ? <Loader size={15} /> : <ArrowRightCircle size={15} />}
                  Derivar a expediente
                </button>
                {!permisos.derivar ? (
                  <small className="sideMuted">Derivar requiere rol con gestión de expedientes (DEC, AGA, Titular).</small>
                ) : null}
              </>
            )}
          </section>

          <section className="processPanel">
            <div className="processPanelHead">
              <FileText size={17} />
              <strong>Adjuntos</strong>
            </div>

            {puedeAdjuntar ? (
              <form className="docUploadForm" onSubmit={uploadDocumento}>
                <select onChange={(event) => setKind(event.target.value)} value={kind}>
                  {NECESIDAD_DOC_KINDS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
                <input accept="application/pdf" ref={fileRef} type="file" />
                <button className="primaryButton compactButton" disabled={uploading} type="submit">
                  {uploading ? <Loader size={15} /> : <UploadCloud size={15} />}
                  Adjuntar PDF
                </button>
              </form>
            ) : null}

            {documentos.length === 0 ? (
              <p className="sideMuted">
                {puedeAdjuntar
                  ? "Sin adjuntos. Carga el requerimiento firmado, el TDR/ET u otros sustentos de la necesidad."
                  : "Sin adjuntos."}
              </p>
            ) : (
              <ul className="docList">
                {documentos.map((doc) => (
                  <li className="docItem" key={doc.id}>
                    <FileText size={16} />
                    <div className="docItemBody">
                      <strong>{doc.title}</strong>
                      <small>{necesidadDocKindLabel(doc.kind)}</small>
                    </div>
                    {puedeAdjuntar ? (
                      <button
                        aria-label="Eliminar adjunto"
                        className="iconButton"
                        disabled={deletingId === doc.id}
                        onClick={() => void deleteDocumento(doc.id)}
                        type="button"
                      >
                        {deletingId === doc.id ? <Loader size={15} /> : <Trash2 size={15} />}
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
