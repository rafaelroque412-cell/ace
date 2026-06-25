"use client";

import { useState, useRef } from "react";
import { X, UploadCloud, FileText } from "lucide-react";
import { maxPdfSizeBytes, maxPdfSizeLabel } from "@/lib/upload-limits";
import type { ReplaceFileModalProps } from "./types";

export function ReplaceFileModal({ exp, onClose, onApply }: ReplaceFileModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function handleFileChange(f: File | null) {
    setError(null);
    if (!f) {
      setFile(null);
      return;
    }
    if (f.type !== "application/pdf") {
      setError("Solo se permiten archivos PDF");
      setFile(null);
      return;
    }
    if (f.size > maxPdfSizeBytes) {
      setError(`El PDF supera el límite de ${maxPdfSizeLabel}`);
      setFile(null);
      return;
    }
    setFile(f);
  }

  function confirm() {
    if (!file) return;
    onApply(file);
  }

  return (
    <div className="subirSlideOverOverlay" onClick={onClose}>
      <aside
        className="subirSlideOver subirSlideOverModal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Reemplazar PDF"
      >
        <header className="subirSlideOverHead">
          <div>
            <strong>Reemplazar PDF</strong>
            <span>&ldquo;{exp.title}&rdquo; se reprocesará automáticamente</span>
          </div>
          <button
            type="button"
            className="subirSlideOverClose"
            onClick={onClose}
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </header>
        <div className="subirSlideOverBody">
          <p className="subirReplaceCurrent">
            <strong>PDF actual:</strong> {exp.file_name} ({(exp.file_size / 1024).toFixed(0)} KB)
          </p>
          <div className="subirReplacePreview">
            <iframe
              title="Vista previa del PDF actual"
              src={`/api/expedientes-archivo/${exp.id}`}
            />
          </div>
          <div className="subirReplaceDropzone">
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
              hidden
            />
            {!file ? (
              <button
                type="button"
                className="subirReplaceDropzoneBtn"
                onClick={() => fileInputRef.current?.click()}
              >
                <UploadCloud size={28} />
                <strong>Selecciona el nuevo PDF</strong>
                <span>Máx. {maxPdfSizeLabel}</span>
              </button>
            ) : (
              <div className="subirReplaceFileInfo">
                <FileText size={24} />
                <div>
                  <strong>{file.name}</strong>
                  <span>{(file.size / 1024).toFixed(0)} KB</span>
                </div>
                <button
                  type="button"
                  className="subirLinkBtn"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Cambiar
                </button>
              </div>
            )}
            {error ? <small className="fieldErrorMsg">{error}</small> : null}
          </div>
          <p className="subirReplaceWarning">
            El nuevo archivo se reprocesará con OCR y se re-indexará en Pinecone. Los metadatos (título, ubicación, etc.) se conservan.
          </p>
          <div className="subirSlideOverActions">
            <button type="button" className="subirGhostBtn" onClick={onClose}>
              Cancelar
            </button>
            <button
              type="button"
              className="primaryButton"
              onClick={confirm}
              disabled={!file}
            >
              <UploadCloud size={16} /> Confirmar reemplazo
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}
