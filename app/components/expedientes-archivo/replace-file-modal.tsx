"use client";

import { useState, useRef } from "react";
import { X, UploadCloud, FileText, AlertTriangle } from "lucide-react";
import { maxPdfSizeBytes, maxPdfSizeLabel } from "@/lib/upload-limits";
import type { ReplaceFileModalProps } from "./types";

export function ReplaceFileModal({ exp, onClose, onApply }: ReplaceFileModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
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
    <div className="expSlideOverOverlay" onClick={onClose}>
      <aside
        className="expSlideOver expSlideOver-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Reemplazar PDF"
      >
        <div className="expSlideOver-header">
          <div>
            <h3 className="expSlideOver-title">Reemplazar PDF</h3>
            <p className="expSlideOver-subtitle">&ldquo;{exp.title}&rdquo; se reprocesará automáticamente</p>
          </div>
          <button
            type="button"
            className="expSlideOver-close"
            onClick={onClose}
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>
        <div className="expSlideOver-body">
          <div className="expReplaceCurrent">
            <FileText size={16} />
            <div>
              <strong>PDF actual:</strong> {exp.file_name} (
              {(exp.file_size / 1024).toFixed(0)} KB)
            </div>
          </div>
          <div className="expReplacePreview">
            <iframe
              title="Vista previa del PDF actual"
              src={`/api/expedientes-archivo/${exp.id}`}
            />
          </div>
          <label
            className={`expReplaceDropzone ${isDragging ? "dragging" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              handleFileChange(e.dataTransfer.files?.[0] ?? null);
            }}
          >
            {!file ? (
              <div className="expReplaceDropzone-content">
                <UploadCloud size={28} />
                <strong>Selecciona el nuevo PDF</strong>
                <span>Máx. {maxPdfSizeLabel}</span>
              </div>
            ) : (
              <div className="expReplaceFile">
                <FileText size={20} />
                <div>
                  <strong>{file.name}</strong>
                  <span>{(file.size / 1024).toFixed(0)} KB</span>
                </div>
                <button
                  type="button"
                  className="expReplaceChange"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Cambiar
                </button>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
            />
          </label>
          {error ? (
            <div className="expMessage expMessage-error" style={{ marginTop: 8 }}>
              <AlertTriangle size={16} />
              <span>{error}</span>
            </div>
          ) : null}
          <div className="expReplaceWarning">
            <AlertTriangle size={16} />
            <div>
              El nuevo archivo se reprocesará con OCR y se re-indexará en Pinecone. Los
              metadatos (título, ubicación, etc.) se conservan.
            </div>
          </div>
        </div>
        <div className="expSlideOver-footer">
          <button type="button" className="expBtn expBtn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className="expBtn expBtn-primary"
            onClick={confirm}
            disabled={!file}
          >
            <UploadCloud size={16} /> Confirmar reemplazo
          </button>
        </div>
      </aside>
    </div>
  );
}
