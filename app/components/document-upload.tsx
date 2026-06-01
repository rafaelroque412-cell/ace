"use client";

import { useEffect, useMemo, useState } from "react";
import { FileText, RefreshCw, UploadCloud } from "lucide-react";

type DocumentItem = {
  id: string;
  title: string;
  file_name: string;
  file_size: number;
  document_type: string;
  source_entity: string | null;
  status: "uploaded" | "processing" | "indexed" | "error";
  created_at: string;
};

type DocumentsResponse = {
  documents: DocumentItem[];
  error?: string;
  setupRequired?: boolean;
};

const documentTypes = [
  { label: "Ley", value: "ley" },
  { label: "Reglamento", value: "reglamento" },
  { label: "Opinion", value: "opinion" },
  { label: "Directiva", value: "directiva" },
  { label: "Resolucion", value: "resolucion" },
  { label: "Contrato", value: "contrato" },
  { label: "Expediente", value: "expediente" },
  { label: "Otros", value: "otros" },
];

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

export function DocumentUpload() {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [documentType, setDocumentType] = useState("opinion");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [sourceEntity, setSourceEntity] = useState("OECE");
  const [title, setTitle] = useState("");

  const selectedFileLabel = useMemo(() => {
    if (!file) {
      return "Selecciona un PDF juridico";
    }

    return `${file.name} · ${formatBytes(file.size)}`;
  }, [file]);

  async function loadDocuments() {
    setMessage(null);
    const response = await fetch("/api/documents", { cache: "no-store" });
    const payload = (await response.json()) as DocumentsResponse;

    if (!response.ok) {
      setMessage(payload.error ?? "No se pudieron cargar documentos");
      return;
    }

    setDocuments(payload.documents);
  }

  useEffect(() => {
    // Initial sync with the documents API when the upload panel mounts.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadDocuments();
  }, []);

  async function uploadDocument(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!file) {
      setMessage("Selecciona un archivo PDF antes de subir.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("documentType", documentType);
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
      setTitle("");
      setMessage("PDF subido y registrado correctamente.");
      await loadDocuments();
    } catch {
      setMessage("No se pudo conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="uploadPanel" id="documentos">
      <div className="panelHeader">
        <div>
          <p className="eyebrow">Base documental</p>
          <h2>Carga e indexacion</h2>
        </div>
        <UploadCloud size={22} />
      </div>

      <form className="documentForm" onSubmit={uploadDocument}>
        <label className="filePicker">
          <UploadCloud size={28} />
          <strong>{selectedFileLabel}</strong>
          <span>Ley, reglamento, opiniones, directivas, resoluciones y expedientes.</span>
          <input
            accept="application/pdf"
            aria-label="Seleccionar PDF"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            type="file"
          />
        </label>

        <div className="formGrid">
          <label>
            <span>Titulo</span>
            <input
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Ej. Opinion OECE sobre impedimentos"
              value={title}
            />
          </label>
          <label>
            <span>Entidad</span>
            <input
              onChange={(event) => setSourceEntity(event.target.value)}
              placeholder="OECE"
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
        <div className="listHeader">
          <strong>Documentos recientes</strong>
          <span>{documents.length}</span>
        </div>

        {documents.length === 0 ? (
          <div className="emptyState">Aun no hay documentos registrados.</div>
        ) : (
          documents.map((document) => (
            <article className="documentItem" key={document.id}>
              <div className="documentIcon">
                <FileText size={18} />
              </div>
              <div>
                <strong>{document.title}</strong>
                <span>
                  {document.document_type} · {formatBytes(document.file_size)} ·{" "}
                  {document.source_entity ?? "Sin entidad"}
                </span>
              </div>
              <small data-status={document.status}>{statusLabel(document.status)}</small>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
