"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  Link as LinkIcon,
  Loader,
  MessageSquareText,
  ScanSearch,
  ShieldAlert,
  UploadCloud,
} from "lucide-react";
import Link from "next/link";
import {
  PROCESS_DOC_KINDS,
  PROCESS_STATUSES,
  objectTypeLabel,
  processDocKindLabel,
  processStatusLabel,
  processTypeLabel,
} from "@/lib/legal-taxonomy";

type Process = {
  id: string;
  nomenclature: string;
  object_type: string;
  procedure_type: string | null;
  amount: number | null;
  entity: string | null;
  status: string;
  summary: string | null;
  created_at: string;
  updated_at: string;
};

type ProcessDoc = {
  id: string;
  library_document_id?: string | null;
  kind: string;
  bidder_name: string | null;
  title: string;
  file_name: string | null;
  status: "uploaded" | "processing" | "ready" | "error";
  error_message: string | null;
  created_at: string;
};

type LibraryDoc = {
  id: string;
  title: string;
  document_type: string;
  process_type: string | null;
  status: string;
};

type EvaluationRow = {
  id: string;
  bidder_name: string | null;
  result: "cumple" | "no_cumple" | "subsanable" | "riesgo" | null;
  matrix: Array<{
    requisito: string;
    exigidoEnBases: string;
    presentadoPorPostor: string;
    resultado: string;
    observacion: string;
  }>;
  created_at: string;
};

type RiskRow = {
  id: string;
  items: Array<{
    riesgo: string;
    nivel: "alto" | "medio" | "bajo";
    sustento: string;
    accionRecomendada: string;
  }>;
  created_at: string;
};

const draftOptions = [
  { label: "Informe técnico", value: "informe_tecnico" },
  { label: "Informe legal", value: "informe_legal" },
  { label: "Acta de admisión", value: "acta_admision" },
  { label: "Acta de calificación", value: "acta_calificacion" },
  { label: "Acta de buena pro", value: "acta_buena_pro" },
  { label: "Acta de desierto", value: "acta_desierto" },
  { label: "Memorando", value: "memorando" },
  { label: "Informe de evaluación", value: "informe_evaluacion" },
];

function formatDate(value: string) {
  return new Date(value).toLocaleString("es-PE", { dateStyle: "medium", timeStyle: "short" });
}

function DocStatus({ status }: { status: ProcessDoc["status"] }) {
  if (status === "ready") {
    return (
      <span className="docStatus ready">
        <CheckCircle2 size={14} /> Listo
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="docStatus error">
        <AlertTriangle size={14} /> Error
      </span>
    );
  }
  return (
    <span className="docStatus pending">
      <Loader size={14} /> Procesando
    </span>
  );
}

export function ProcessDetail({ canManage, processId }: { canManage: boolean; processId: string }) {
  const [process, setProcess] = useState<Process | null>(null);
  const [documents, setDocuments] = useState<ProcessDoc[]>([]);
  const [libraryDocs, setLibraryDocs] = useState<LibraryDoc[]>([]);
  const [evaluations, setEvaluations] = useState<EvaluationRow[]>([]);
  const [risks, setRisks] = useState<RiskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [linking, setLinking] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [detectingRisks, setDetectingRisks] = useState(false);
  const [drafting, setDrafting] = useState(false);

  const [kind, setKind] = useState("bases");
  const [libraryDocumentId, setLibraryDocumentId] = useState("");
  const [bidderName, setBidderName] = useState("");
  const [evalBidderName, setEvalBidderName] = useState("");
  const [draftKind, setDraftKind] = useState("informe_evaluacion");
  const fileRef = useRef<HTMLInputElement>(null);

  async function reload() {
    try {
      const response = await fetch(`/api/processes/${processId}`);
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "No se pudo cargar el expediente.");
        return;
      }
      setProcess(payload.process);
      setDocuments(payload.documents ?? []);
      setEvaluations(payload.evaluations ?? []);
      setRisks(payload.risks ?? []);
      setError("");
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  }

  async function loadLibraryDocs() {
    try {
      const response = await fetch("/api/documents", { cache: "no-store" });
      const payload = await response.json();
      setLibraryDocs((payload.documents ?? []).filter((doc: LibraryDoc) => doc.status === "indexed"));
    } catch {
      setLibraryDocs([]);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
    void loadLibraryDocs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [processId]);

  // Polling mientras algún documento esté extrayendo texto.
  useEffect(() => {
    const pending = documents.some((doc) => doc.status === "uploaded" || doc.status === "processing");
    if (!pending) {
      return;
    }
    const timer = setInterval(() => void reload(), 3500);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documents]);

  async function uploadDocument(event: React.FormEvent<HTMLFormElement>) {
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
      if (bidderName.trim()) {
        formData.set("bidderName", bidderName.trim());
      }
      const response = await fetch(`/api/processes/${processId}/documents`, { body: formData, method: "POST" });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "No se pudo subir el documento.");
        return;
      }
      setBidderName("");
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

  async function linkLibraryDocument() {
    if (!libraryDocumentId) {
      setError("Selecciona un documento de biblioteca.");
      return;
    }
    setLinking(true);
    setError("");
    try {
      const formData = new FormData();
      formData.set("libraryDocumentId", libraryDocumentId);
      formData.set("kind", kind);
      const response = await fetch(`/api/processes/${processId}/documents`, { body: formData, method: "POST" });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "No se pudo vincular el documento.");
        return;
      }
      setLibraryDocumentId("");
      await reload();
    } catch {
      setError("No se pudo conectar para vincular documento.");
    } finally {
      setLinking(false);
    }
  }

  async function changeStatus(status: string) {
    try {
      await fetch(`/api/processes/${processId}`, {
        body: JSON.stringify({ status }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      });
      await reload();
    } catch {
      setError("No se pudo actualizar el estado.");
    }
  }

  async function evaluateOffer() {
    setEvaluating(true);
    setError("");
    try {
      const response = await fetch(`/api/processes/${processId}/evaluate`, {
        body: JSON.stringify({ bidderName: evalBidderName }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "No se pudo evaluar la oferta.");
        return;
      }
      await reload();
    } catch {
      setError("No se pudo conectar con el evaluador.");
    } finally {
      setEvaluating(false);
    }
  }

  async function detectRisks() {
    setDetectingRisks(true);
    setError("");
    try {
      const response = await fetch(`/api/processes/${processId}/risks`, { method: "POST" });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "No se pudo detectar riesgos.");
        return;
      }
      await reload();
    } catch {
      setError("No se pudo conectar con el detector de riesgos.");
    } finally {
      setDetectingRisks(false);
    }
  }

  async function generateDraft() {
    setDrafting(true);
    setError("");
    try {
      const response = await fetch(`/api/processes/${processId}/draft`, {
        body: JSON.stringify({ draftKind }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        setError(payload.error ?? "No se pudo generar el documento.");
        return;
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${draftKind}-${process?.nomenclature ?? "expediente"}.docx`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("No se pudo conectar con el generador documental.");
    } finally {
      setDrafting(false);
    }
  }

  if (loading) {
    return <p className="sideMuted">Cargando expediente…</p>;
  }

  if (!process) {
    return (
      <div className="emptyState">
        <AlertTriangle size={20} />
        <p>{error || "Expediente no encontrado."}</p>
      </div>
    );
  }

  const timeline = [
    { at: process.created_at, label: "Expediente creado", icon: Clock },
    ...documents.map((doc) => ({
      at: doc.created_at,
      label: `${processDocKindLabel(doc.kind)} cargado: ${doc.title}`,
      icon: FileText,
    })),
  ].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  return (
    <div className="processDetail">
      <header className="processDetailHeader">
        <div>
          <h2>{process.nomenclature}</h2>
          <div className="processDetailMeta">
            <span>{objectTypeLabel(process.object_type)}</span>
            {process.procedure_type ? <span>{processTypeLabel(process.procedure_type) ?? process.procedure_type}</span> : null}
            <span>{process.amount != null ? `S/ ${process.amount.toLocaleString("es-PE")}` : "Sin monto"}</span>
            <span>{process.entity ?? "Sin entidad"}</span>
          </div>
        </div>
        <div className="processStatusBox">
          {canManage ? (
            <label>
              <span>Estado</span>
              <select onChange={(event) => void changeStatus(event.target.value)} value={process.status}>
                {PROCESS_STATUSES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <span className={`processStatus status-${process.status}`}>{processStatusLabel(process.status)}</span>
          )}
        </div>
      </header>

      {error ? <p className="formMessage errorText">{error}</p> : null}

      <div className="processDetailGrid">
        <section className="processPanel">
          <div className="processPanelHead">
            <UploadCloud size={17} />
            <strong>Documentos del expediente</strong>
          </div>

          {canManage ? (
            <>
              <form className="docUploadForm" onSubmit={uploadDocument}>
                <select onChange={(event) => setKind(event.target.value)} value={kind}>
                  {PROCESS_DOC_KINDS.filter((item) => item.value !== "generado").map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
                <input
                  onChange={(event) => setBidderName(event.target.value)}
                  placeholder="Postor (si es oferta)"
                  value={bidderName}
                />
                <input accept="application/pdf" ref={fileRef} type="file" />
                <button className="primaryButton compactButton" disabled={uploading} type="submit">
                  {uploading ? <Loader size={15} /> : <UploadCloud size={15} />}
                  Subir al expediente
                </button>
              </form>
              <div className="docUploadForm">
                <select onChange={(event) => setLibraryDocumentId(event.target.value)} value={libraryDocumentId}>
                  <option value="">Vincular documento existente...</option>
                  {libraryDocs.map((doc) => (
                    <option key={doc.id} value={doc.id}>
                      {doc.title}
                    </option>
                  ))}
                </select>
                <button className="secondaryButton compactButton" disabled={linking || !libraryDocumentId} onClick={linkLibraryDocument} type="button">
                  <LinkIcon size={15} />
                  Vincular documento existente
                </button>
              </div>
            </>
          ) : null}

          {documents.length === 0 ? (
            <p className="sideMuted">Sin documentos cargados.</p>
          ) : (
            <ul className="docList">
              {documents.map((doc) => (
                <li className="docItem" key={doc.id}>
                  <FileText size={16} />
                  <div className="docItemBody">
                    <strong>{doc.title}</strong>
                    <small>
                      {processDocKindLabel(doc.kind)}
                      {doc.library_document_id ? " · vinculado de biblioteca" : ""}
                      {doc.bidder_name ? ` · ${doc.bidder_name}` : ""} · {formatDate(doc.created_at)}
                    </small>
                    {doc.status === "error" && doc.error_message ? (
                      <small className="docError">{doc.error_message}</small>
                    ) : null}
                  </div>
                  <DocStatus status={doc.status} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside className="processSide">
          <section className="processPanel">
            <div className="processPanelHead">
              <Clock size={17} />
              <strong>Línea de tiempo</strong>
            </div>
            <ul className="timeline">
              {timeline.map((item, index) => {
                const Icon = item.icon;
                return (
                  <li key={`${item.at}-${index}`}>
                    <Icon size={14} />
                    <div>
                      <span>{item.label}</span>
                      <small>{formatDate(item.at)}</small>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="processPanel processSoon">
            <div className="processPanelHead">
              <ScanSearch size={17} />
              <strong>Centro operativo del expediente</strong>
            </div>
            <div className="sourceMetaGrid">
              <span>Documentos: {documents.length}</span>
              <span>Evaluaciones: {evaluations.length}</span>
              <span>Riesgos: {risks[0]?.items?.length ?? 0}</span>
            </div>
            <div className="sourceActions">
              <Link
                className="secondaryButton compactButton"
                href={`/analizar?processId=${process.id}&processType=${process.procedure_type ?? ""}`}
              >
                <ScanSearch size={15} />
                Analizar documento
              </Link>
              <Link
                className="secondaryButton compactButton"
                href={`/validar?processId=${process.id}&processType=${process.procedure_type ?? ""}&pregunta=${encodeURIComponent(`Validar expediente ${process.nomenclature}`)}`}
              >
                <ShieldAlert size={15} />
                Validar procedimiento
              </Link>
              <Link
                className="secondaryButton compactButton"
                href={`/chat?processType=${process.procedure_type ?? ""}&pregunta=${encodeURIComponent(`Revisar expediente ${process.nomenclature} y sus documentos asociados`)}`}
              >
                <MessageSquareText size={15} />
                Consultar en chat
              </Link>
              <Link className="secondaryButton compactButton" href="/documentos">
                <LinkIcon size={15} />
                Biblioteca normativa
              </Link>
            </div>
            <div className="agentControls">
              <label>
                <span>Postor a evaluar</span>
                <input
                  onChange={(event) => setEvalBidderName(event.target.value)}
                  placeholder="Vacío: primera oferta"
                  value={evalBidderName}
                />
              </label>
              <button className="primaryButton compactButton" disabled={!canManage || evaluating} onClick={evaluateOffer} type="button">
                {evaluating ? <Loader size={15} /> : <CheckCircle2 size={15} />}
                Evaluar oferta
              </button>
              <button className="secondaryButton compactButton" disabled={!canManage || detectingRisks} onClick={detectRisks} type="button">
                {detectingRisks ? <Loader size={15} /> : <ShieldAlert size={15} />}
                Detectar riesgos
              </button>
              <label>
                <span>Documento a generar</span>
                <select onChange={(event) => setDraftKind(event.target.value)} value={draftKind}>
                  {draftOptions.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <button className="secondaryButton compactButton" disabled={!canManage || drafting} onClick={generateDraft} type="button">
                {drafting ? <Loader size={15} /> : <Download size={15} />}
                Generar DOCX
              </button>
            </div>
          </section>

          <section className="processPanel">
            <div className="processPanelHead">
              <CheckCircle2 size={17} />
              <strong>Última evaluación</strong>
            </div>
            {evaluations.length === 0 ? (
              <p className="sideMuted">Aún no hay matriz de evaluación.</p>
            ) : (
              <div className="evaluationPreview">
                <div className="resultBadge" data-result={evaluations[0]?.result ?? "riesgo"}>
                  {evaluations[0]?.result ?? "riesgo"}
                </div>
                <small>
                  {evaluations[0]?.bidder_name ?? "Postor no identificado"} ·{" "}
                  {evaluations[0] ? formatDate(evaluations[0].created_at) : ""}
                </small>
                <div className="matrixTableWrap">
                  <table className="matrixTable">
                    <thead>
                      <tr>
                        <th>Requisito</th>
                        <th>Resultado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(evaluations[0]?.matrix ?? []).slice(0, 6).map((row, index) => (
                        <tr key={`${row.requisito}-${index}`}>
                          <td>{row.requisito}</td>
                          <td>{row.resultado}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>

          <section className="processPanel">
            <div className="processPanelHead">
              <ShieldAlert size={17} />
              <strong>Riesgos</strong>
            </div>
            {risks.length === 0 ? (
              <p className="sideMuted">Aún no hay matriz de riesgos.</p>
            ) : (
              <div className="riskList">
                {(risks[0]?.items ?? []).slice(0, 5).map((risk, index) => (
                  <article className="riskItem" data-level={risk.nivel} key={`${risk.riesgo}-${index}`}>
                    <strong>{risk.riesgo}</strong>
                    <span>{risk.nivel}</span>
                    <p>{risk.sustento}</p>
                    <small>{risk.accionRecomendada}</small>
                  </article>
                ))}
              </div>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
