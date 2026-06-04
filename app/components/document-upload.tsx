"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Database,
  FileText,
  Filter,
  Layers3,
  RefreshCw,
  Trash2,
  UploadCloud,
} from "lucide-react";
import {
  DOCUMENT_TYPES,
  PROCESS_TYPES,
  documentTypeLabel,
  processTypeLabel,
} from "@/lib/legal-taxonomy";

type DocumentItem = {
  id: string;
  title: string;
  file_name: string;
  file_size: number;
  document_type: string;
  process_type?: string | null;
  error_message: string | null;
  metadata: {
    ai?: {
      classificationConfidence?: string;
      suggestedDocumentType?: string | null;
      suggestedSourceEntity?: string | null;
    };
    chunkCount?: number;
    indexingPipelineVersion?: string;
    extractionMethod?: string;
    ocrPartial?: boolean;
    pageCount?: number;
    pinecone?: {
      recordCount?: number;
      verification?: {
        hitCount?: number;
        verified?: boolean;
      };
    };
    processType?: string | null;
    summary?: string;
    textLength?: number;
    topic?: string | null;
    vigencia?: string | null;
    year?: number | null;
  };
  source_entity: string | null;
  status: "uploaded" | "processing" | "indexed" | "error";
  created_at: string;
};

type DocumentsResponse = {
  documents: DocumentItem[];
  error?: string;
  setupRequired?: boolean;
};

type PendingAction = {
  document: DocumentItem;
  type: "delete" | "reindex";
} | null;

type BulkDeleteTarget = {
  count: number;
  documentType: string;
  processType: string;
} | null;

type BulkReindexTarget = {
  count: number;
  ids: string[];
} | null;

const documentTypes = DOCUMENT_TYPES;

const processTypes = [{ label: "No aplica", value: "" }, ...PROCESS_TYPES];
const maxPdfSize = 50 * 1024 * 1024;

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function statusLabel(status: DocumentItem["status"]) {
  const labels = {
    error: "Error",
    indexed: "Indexado",
    processing: "Procesando",
    uploaded: "Subido",
  };

  return labels[status];
}

function getDocumentProcessType(document: DocumentItem) {
  return document.process_type ?? document.metadata?.processType ?? "";
}

export function DocumentUpload() {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [documentType, setDocumentType] = useState("opinion");
  const [file, setFile] = useState<File | null>(null);
  const [bulkDeleteTarget, setBulkDeleteTarget] = useState<BulkDeleteTarget>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkReindexTarget, setBulkReindexTarget] = useState<BulkReindexTarget>(null);
  const [bulkReindexing, setBulkReindexing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [filterDocumentType, setFilterDocumentType] = useState("");
  const [filterProcessType, setFilterProcessType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [processType, setProcessType] = useState("");
  const [reindexingId, setReindexingId] = useState<string | null>(null);
  const [sourceEntity, setSourceEntity] = useState("");
  const [title, setTitle] = useState("");

  const selectedFileLabel = useMemo(() => {
    if (!file) {
      return "Selecciona un PDF juridico";
    }

    return `${file.name} · ${formatBytes(file.size)}`;
  }, [file]);
  const filteredDocuments = useMemo(
    () =>
      documents.filter((document) => {
        const matchesType = filterDocumentType ? document.document_type === filterDocumentType : true;
        const matchesProcess = filterProcessType ? getDocumentProcessType(document) === filterProcessType : true;
        const matchesStatus = filterStatus ? document.status === filterStatus : true;

        return matchesType && matchesProcess && matchesStatus;
      }),
    [documents, filterDocumentType, filterProcessType, filterStatus],
  );
  const integratedBasesCount = documents.filter(
    (document) => document.document_type === "bases_integradas",
  ).length;
  const directiveCount = documents.filter((document) => document.document_type === "directiva").length;
  const indexedCount = documents.filter((document) => document.status === "indexed").length;
  const bulkDeleteCount = filteredDocuments.filter(
    (document) =>
      ["bases_integradas", "directiva"].includes(document.document_type) &&
      (!filterProcessType || getDocumentProcessType(document) === filterProcessType),
  ).length;
  const canBulkDelete =
    bulkDeleteCount > 0 &&
    ["bases_integradas", "directiva"].includes(filterDocumentType) &&
    Boolean(filterProcessType);
  const canBulkReindex = filteredDocuments.length > 0 && !bulkReindexing;

  const loadDocuments = useCallback(async () => {
    // No limpia `message` para no borrar el aviso de "procesando" durante el polling.
    const response = await fetch("/api/documents", { cache: "no-store" });
    const payload = (await response.json()) as DocumentsResponse;

    if (!response.ok) {
      setMessage(payload.error ?? "No se pudieron cargar documentos");
      return;
    }

    setDocuments(payload.documents);
  }, []);
  const hasPendingDocuments = useMemo(
    () => documents.some((document) => document.status === "uploaded" || document.status === "processing"),
    [documents],
  );

  useEffect(() => {
    // Initial sync with the documents API when the upload panel mounts.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadDocuments();
  }, [loadDocuments]);

  useEffect(() => {
    // Mientras haya documentos indexandose en segundo plano, refresca el estado
    // periodicamente. La dependencia es el booleano (no la lista), de modo que el
    // intervalo no se reinicia en cada refresco y el tope de intentos se respeta.
    if (!hasPendingDocuments) {
      return;
    }

    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;

      if (attempts > 75) {
        clearInterval(timer);
        return;
      }

      void loadDocuments();
    }, 4000);

    return () => clearInterval(timer);
  }, [hasPendingDocuments, loadDocuments]);

  async function uploadDocument(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!file) {
      setMessage("Selecciona un archivo PDF antes de subir.");
      return;
    }

    if (file.size > maxPdfSize) {
      setMessage("El PDF supera el limite de 50 MB.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("documentType", documentType);
    formData.append("processType", processType);
    formData.append("sourceEntity", sourceEntity);
    formData.append("title", title);

    setLoading(true);
    setMessage("Subiendo PDF...");

    try {
      const response = await fetch("/api/documents", {
        body: formData,
        method: "POST",
      });
      const payload = await response.json();

      if (!response.ok) {
        setMessage(payload.error ?? "No se pudo subir el documento");
        return;
      }

      setFile(null);
      setProcessType("");
      setTitle("");
      setMessage("PDF subido. Procesando e indexando en segundo plano...");
      await loadDocuments();
    } catch {
      setMessage("No se pudo conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  }

  async function deleteDocument(document: DocumentItem) {
    setDeletingId(document.id);
    setMessage("Eliminando documento...");
    setPendingAction(null);

    try {
      const response = await fetch(`/api/documents/${document.id}`, {
        method: "DELETE",
      });
      const payload = await response.json();

      if (!response.ok) {
        setMessage(payload.error ?? "No se pudo eliminar el documento");
        return;
      }

      setMessage("Documento eliminado completamente.");
      await loadDocuments();
    } catch {
      setMessage("No se pudo conectar con el servidor.");
    } finally {
      setDeletingId(null);
    }
  }

  async function reindexDocument(document: DocumentItem) {
    setReindexingId(document.id);
    setMessage("Reindexando documento...");
    setPendingAction(null);

    try {
      const response = await fetch(`/api/documents/${document.id}`, {
        method: "POST",
      });
      const payload = await response.json();

      if (!response.ok) {
        setMessage(payload.error ?? "No se pudo reindexar el documento");
        return;
      }

      setMessage("Reindexado iniciado en segundo plano...");
      await loadDocuments();
    } catch {
      setMessage("No se pudo conectar con el servidor.");
    } finally {
      setReindexingId(null);
    }
  }

  async function bulkDeleteDocuments() {
    if (!bulkDeleteTarget) {
      return;
    }

    setBulkDeleting(true);
    setMessage("Eliminando documentos por proceso...");

    try {
      const response = await fetch("/api/documents", {
        body: JSON.stringify({
          documentType: bulkDeleteTarget.documentType,
          processType: bulkDeleteTarget.processType,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "DELETE",
      });
      const payload = await response.json();

      if (!response.ok) {
        setMessage(payload.error ?? "No se pudo eliminar el grupo de documentos");
        return;
      }

      setBulkDeleteTarget(null);
      setMessage(
        `Eliminados ${payload.deleted?.documents ?? 0} documento(s), ${
          payload.deleted?.vectors ?? 0
        } vector(es) y ${payload.deleted?.chunks ?? 0} fragmento(s).`,
      );
      await loadDocuments();
    } catch {
      setMessage("No se pudo conectar con el servidor.");
    } finally {
      setBulkDeleting(false);
    }
  }

  async function bulkReindexDocuments() {
    if (!bulkReindexTarget) {
      return;
    }

    setBulkReindexing(true);
    setMessage(`Reindexando ${bulkReindexTarget.count} documento(s). Esto puede tardar...`);

    try {
      const response = await fetch("/api/documents/reindex", {
        body: JSON.stringify({
          ids: bulkReindexTarget.ids,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const payload = await response.json();

      if (!response.ok) {
        setMessage(payload.error ?? "No se pudo reindexar el grupo de documentos");
        return;
      }

      setBulkReindexTarget(null);
      setMessage(
        `Reindexacion de ${payload.reindexed?.requested ?? 0} documento(s) iniciada en segundo plano.`,
      );
      await loadDocuments();
    } catch {
      setMessage("No se pudo conectar con el servidor.");
    } finally {
      setBulkReindexing(false);
    }
  }

  return (
    <div className="uploadPanel" id="documentos">
      <div className="panelHeader">
        <div>
          <p className="eyebrow">Base documental</p>
          <h2>Gestion documental</h2>
        </div>
        <UploadCloud size={22} />
      </div>

      <section className="documentStats" aria-label="Resumen documental">
        <div>
          <Database size={17} />
          <span>Total</span>
          <strong>{documents.length}</strong>
        </div>
        <div>
          <Layers3 size={17} />
          <span>Bases integradas</span>
          <strong>{integratedBasesCount}</strong>
        </div>
        <div>
          <FileText size={17} />
          <span>Directivas</span>
          <strong>{directiveCount}</strong>
        </div>
        <div>
          <RefreshCw size={17} />
          <span>Indexados</span>
          <strong>{indexedCount}</strong>
        </div>
      </section>

      <form className="documentForm" onSubmit={uploadDocument}>
        <div className="documentSectionTitle">
          <div>
            <strong>Subir nuevo PDF</strong>
            <span>Clasifica bases integradas y directivas por tipo de proceso.</span>
          </div>
        </div>
        <label className="filePicker">
          <UploadCloud size={28} />
          <strong>{selectedFileLabel}</strong>
          <span>Ley, reglamento, bases integradas, directivas, resoluciones y expedientes. Maximo 50 MB.</span>
          <input
            accept="application/pdf"
            aria-label="Seleccionar PDF"
            onChange={(event) => {
              const selected = event.target.files?.[0] ?? null;

              if (selected && selected.size > maxPdfSize) {
                setFile(null);
                setMessage("El PDF supera el limite de 50 MB.");
                event.target.value = "";
                return;
              }

              setMessage(null);
              setFile(selected);
            }}
            type="file"
          />
        </label>

        <div className="formGrid">
          <label>
            <span>Titulo</span>
            <input
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Ej. Bases integradas LP 001-2026"
              value={title}
            />
          </label>
          <label>
            <span>Entidad</span>
            <input
              onChange={(event) => setSourceEntity(event.target.value)}
              placeholder="Ej. OSCE, OECE, MEF"
              value={sourceEntity}
            />
          </label>
          <label>
            <span>Tipo</span>
            <select
              onChange={(event) => setDocumentType(event.target.value)}
              value={documentType}
            >
              {documentTypes.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Tipo de proceso</span>
            <select
              onChange={(event) => setProcessType(event.target.value)}
              value={processType}
            >
              {processTypes.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="formActions">
          <button className="secondaryButton" onClick={() => void loadDocuments()} type="button">
            <RefreshCw size={17} />
            Actualizar
          </button>
          <button className="primaryButton" disabled={loading} type="submit">
            <UploadCloud size={18} />
            {loading ? "Subiendo..." : "Subir PDF"}
          </button>
        </div>

        {message ? <p className="formMessage">{message}</p> : null}
      </form>

      <div className="documentList">
        <div className="documentToolbar">
          <div className="documentSectionTitle">
            <div>
              <strong>Biblioteca cargada</strong>
              <span>{filteredDocuments.length} documento(s) visibles</span>
            </div>
          </div>
          <div className="documentFilters">
            <label>
              <span>Tipo</span>
              <select onChange={(event) => setFilterDocumentType(event.target.value)} value={filterDocumentType}>
                <option value="">Todos</option>
                {documentTypes.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Proceso</span>
              <select onChange={(event) => setFilterProcessType(event.target.value)} value={filterProcessType}>
                {processTypes.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Estado</span>
              <select onChange={(event) => setFilterStatus(event.target.value)} value={filterStatus}>
                <option value="">Todos</option>
                <option value="indexed">Indexado</option>
                <option value="processing">Procesando</option>
                <option value="uploaded">Subido</option>
                <option value="error">Error</option>
              </select>
            </label>
            <button
              className="secondaryButton compactButton"
              onClick={() => {
                setFilterDocumentType("");
                setFilterProcessType("");
                setFilterStatus("");
              }}
              type="button"
            >
              <Filter size={15} />
              Limpiar
            </button>
          </div>
          <div className="bulkDeleteBox">
            <AlertTriangle size={16} />
            <span>Acciones masivas</span>
            <button
              className="secondaryButton compactButton"
              disabled={!canBulkReindex}
              onClick={() =>
                setBulkReindexTarget({
                  count: filteredDocuments.length,
                  ids: filteredDocuments.map((document) => document.id),
                })
              }
              type="button"
            >
              <RefreshCw size={15} />
              Reindexar visibles
            </button>
            <button
              className="dangerButton compactButton"
              disabled={!canBulkDelete || bulkDeleting}
              onClick={() =>
                setBulkDeleteTarget({
                  count: bulkDeleteCount,
                  documentType: filterDocumentType,
                  processType: filterProcessType,
                })
              }
              type="button"
            >
              <Trash2 size={15} />
              Eliminar grupo
            </button>
          </div>
        </div>

        {documents.length === 0 ? (
          <div className="emptyState">Aun no hay documentos registrados.</div>
        ) : filteredDocuments.length === 0 ? (
          <div className="emptyState">No hay documentos con esos filtros.</div>
        ) : (
          filteredDocuments.map((document) => (
            <article className="documentItem" key={document.id}>
              <div className="documentIcon">
                <FileText size={18} />
              </div>
              <div>
                <strong>{document.title}</strong>
                <span>
                  {document.document_type} · {formatBytes(document.file_size)} ·{" "}
                  {document.source_entity ?? "Sin entidad"}
                  {processTypeLabel(getDocumentProcessType(document))
                    ? ` · ${processTypeLabel(getDocumentProcessType(document))}`
                    : ""}
                </span>
                {document.metadata?.extractionMethod ? (
                  <span>
                    {document.metadata.extractionMethod === "openai-ocr"
                      ? "OCR OpenAI"
                      : "Texto PDF"}{" "}
                    · {document.metadata.chunkCount ?? 0} fragmentos
                    {document.metadata.pinecone?.recordCount
                      ? ` · ${document.metadata.pinecone.recordCount} vectores`
                      : ""}
                    {document.metadata.pinecone?.verification
                      ? ` · Pinecone ${
                          document.metadata.pinecone.verification.verified
                            ? "verificado"
                            : "pendiente de verificar"
                        }`
                      : ""}
                    {document.metadata.ocrPartial ? " · OCR parcial" : ""}
                  </span>
                ) : null}
                {document.metadata?.topic || document.metadata?.vigencia || document.metadata?.year ? (
                  <span>
                    {document.metadata.topic ? `Tema ${document.metadata.topic}` : "Tema no definido"}
                    {document.metadata.vigencia ? ` · ${document.metadata.vigencia}` : ""}
                    {document.metadata.year ? ` · ${document.metadata.year}` : ""}
                  </span>
                ) : null}
                {document.metadata?.summary ? <p>{document.metadata.summary}</p> : null}
                {document.error_message ? (
                  <span className="documentError">{document.error_message}</span>
                ) : null}
              </div>
              <div className="documentActions">
                <small data-status={document.status}>{statusLabel(document.status)}</small>
                <button
                  aria-label={`Reindexar ${document.title}`}
                  disabled={reindexingId === document.id || deletingId === document.id}
                  onClick={() => setPendingAction({ document, type: "reindex" })}
                  title="Reindexar documento"
                  type="button"
                >
                  <RefreshCw size={16} />
                </button>
                <button
                  aria-label={`Eliminar ${document.title}`}
                  disabled={deletingId === document.id}
                  onClick={() => setPendingAction({ document, type: "delete" })}
                  title="Eliminar documento"
                  type="button"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </article>
          ))
        )}
      </div>

      <Dialog.Root open={Boolean(pendingAction)} onOpenChange={(open) => !open && setPendingAction(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="dialogOverlay" />
          <Dialog.Content className="dialogContent">
            <Dialog.Title>
              {pendingAction?.type === "delete" ? "Eliminar documento" : "Reindexar documento"}
            </Dialog.Title>
            <Dialog.Description>
              {pendingAction?.type === "delete"
                ? "Se eliminara el PDF de Storage, sus fragmentos en Supabase y sus vectores en Pinecone."
                : "Se regeneraran fragmentos, paginas aproximadas, resumen y metadata sugerida por IA."}
            </Dialog.Description>
            <strong>{pendingAction?.document.title}</strong>
            <div className="dialogActions">
              <Dialog.Close className="secondaryButton" type="button">
                Cancelar
              </Dialog.Close>
              <button
                className={pendingAction?.type === "delete" ? "dangerButton" : "primaryButton"}
                onClick={() => {
                  if (!pendingAction) {
                    return;
                  }

                  if (pendingAction.type === "delete") {
                    void deleteDocument(pendingAction.document);
                  } else {
                    void reindexDocument(pendingAction.document);
                  }
                }}
                type="button"
              >
                {pendingAction?.type === "delete" ? "Eliminar" : "Reindexar"}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <Dialog.Root
        open={Boolean(bulkDeleteTarget)}
        onOpenChange={(open) => !open && setBulkDeleteTarget(null)}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="dialogOverlay" />
          <Dialog.Content className="dialogContent">
            <Dialog.Title>Eliminar documentos por proceso</Dialog.Title>
            <Dialog.Description>
              Se eliminaran PDFs de Storage, fragmentos en Supabase y vectores en Pinecone para el grupo seleccionado.
            </Dialog.Description>
            <strong>
              {documentTypeLabel(bulkDeleteTarget?.documentType)} ·{" "}
              {processTypeLabel(bulkDeleteTarget?.processType) ?? "Sin proceso"}
            </strong>
            <p>{bulkDeleteTarget?.count ?? 0} documento(s) seran eliminados.</p>
            <div className="dialogActions">
              <Dialog.Close className="secondaryButton" type="button">
                Cancelar
              </Dialog.Close>
              <button
                className="dangerButton"
                disabled={bulkDeleting}
                onClick={() => void bulkDeleteDocuments()}
                type="button"
              >
                {bulkDeleting ? "Eliminando..." : "Eliminar grupo"}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <Dialog.Root
        open={Boolean(bulkReindexTarget)}
        onOpenChange={(open) => !open && setBulkReindexTarget(null)}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="dialogOverlay" />
          <Dialog.Content className="dialogContent">
            <Dialog.Title>Reindexar documentos visibles</Dialog.Title>
            <Dialog.Description>
              Se regeneraran fragmentos, metadata juridica y vectores de Pinecone usando los PDF guardados en Supabase Storage.
            </Dialog.Description>
            <strong>{bulkReindexTarget?.count ?? 0} documento(s) seran reindexados.</strong>
            <p>Usa filtros antes de ejecutar si quieres limitarlo por tipo documental, proceso o estado.</p>
            <div className="dialogActions">
              <Dialog.Close className="secondaryButton" type="button">
                Cancelar
              </Dialog.Close>
              <button
                className="primaryButton"
                disabled={bulkReindexing}
                onClick={() => void bulkReindexDocuments()}
                type="button"
              >
                {bulkReindexing ? "Reindexando..." : "Reindexar visibles"}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
