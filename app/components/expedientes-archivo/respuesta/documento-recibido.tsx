"use client";

import {
  BookOpen,
  FileCheck2,
  Lightbulb,
  ScrollText,
  UploadCloud,
  X,
} from "lucide-react";
import { useState } from "react";
import type { AnalisisTecnico } from "@/lib/expedientes-archivo-actions";
import { ConfirmDialog } from "../../confirm-dialog";
import { maxPdfSizeBytes, maxPdfSizeLabel } from "@/lib/upload-limits";

type Props = {
  antecedenteId: string | null;
  antecedenteMeta: {
    chunkCount: number;
    extractionMethod: string;
    fileName: string;
    fileSize: number;
    pageCount: number | null;
  } | null;
  analisis: AnalisisTecnico | null;
  documentoTexto: string;
  handleFile: (file: File | null | undefined) => Promise<void>;
  inputRef: React.RefObject<HTMLInputElement | null>;
  isDragging: boolean;
  reading: boolean;
  removeAntecedente: () => Promise<void>;
  setDocumentoTexto: (v: string) => void;
  setIsDragging: (v: boolean) => void;
  showToast: (msg: string, kind?: "success" | "error" | "warning" | "info") => void;
};

// Seccion 1: Documento recibido (antecedente) - PDF persistido en
// Supabase Storage + Pinecone namespace 'respuesta-antecedentes'.
export function DocumentoRecibido({
  antecedenteId,
  antecedenteMeta,
  analisis,
  documentoTexto,
  handleFile,
  inputRef,
  isDragging,
  reading,
  removeAntecedente,
  setDocumentoTexto,
  setIsDragging,
  showToast,
}: Props) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [showAnalisis, setShowAnalisis] = useState(true);

  function onFile(file: File | null | undefined) {
    if (!file) return;
    if (file.type !== "application/pdf") {
      showToast("Solo se permiten archivos PDF.", "warning");
      return;
    }
    if (file.size > maxPdfSizeBytes) {
      showToast(`El PDF supera ${maxPdfSizeLabel}.`, "warning");
      return;
    }
    void handleFile(file);
  }

  return (
    <div className="expFormSection">
      <div className="expFormSectionHeader">
        <h3 className="expFormSectionTitle">
          <ScrollText size={16} /> Documento recibido (antecedente)
          <span className="expFormSectionHint">
            Sube el PDF: se persiste en Storage + Pinecone. La IA lo usa como referencia.
          </span>
        </h3>
      </div>

      <label
        className={"expFilePicker" + (isDragging ? " dragging" : "")}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          onFile(e.dataTransfer.files?.[0]);
        }}
        style={{ marginBottom: 12 }}
      >
        <div className="expFilePickerIcon">
          {reading ? (
            <span style={{ display: "inline-block", width: 22, height: 22 }} className="expSpin" />
          ) : (
            <UploadCloud size={22} />
          )}
        </div>
        <p className="expFilePickerTitle">
          {reading
            ? "Procesando el PDF..."
            : isDragging
              ? "Suelta el PDF aqui"
              : "Arrastra el PDF recibido o haz clic"}
        </p>
        <p className="expFilePickerSub">
          Se lee con OCR como antecedente. Max {maxPdfSizeLabel}.
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          onChange={(e) => {
            onFile(e.target.files?.[0]);
            if (inputRef.current) inputRef.current.value = "";
          }}
          style={{ display: "none" }}
        />
      </label>

      {documentoTexto ? (
        <div className="expField">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
              marginBottom: 4,
            }}
          >
            <label className="expField-label" htmlFor="resp-doc" style={{ margin: 0 }}>
              Texto del documento recibido
            </label>
            {antecedenteId ? (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  background: "#ecfeff",
                  color: "#155e75",
                  border: "1px solid #67e8f9",
                  borderRadius: 999,
                  padding: "2px 10px",
                  fontSize: 11,
                  fontWeight: 500,
                }}
              >
                <FileCheck2 size={11} /> Persistido
                {antecedenteMeta ? (
                  <>
                    {" "}· {antecedenteMeta.pageCount ?? "?"} pag
                    {" "}· {antecedenteMeta.chunkCount} frag
                    {" "}·{" "}
                    {antecedenteMeta.extractionMethod === "pdf-text" ? "texto" : "OCR"}
                  </>
                ) : null}
              </span>
            ) : null}
            {antecedenteId ? (
              <button
                type="button"
                className="secondaryButton"
                onClick={() => setShowConfirm(true)}
                style={{ marginLeft: "auto", padding: "2px 8px", fontSize: 11 }}
              >
                <X size={11} /> Quitar antecedente
              </button>
            ) : null}
          </div>
          <textarea
            id="resp-doc"
            className="expField-input"
            value={documentoTexto}
            onChange={(e) => setDocumentoTexto(e.target.value)}
            rows={5}
          />
          <small
            style={{
              color: "var(--muted, #667)",
              fontSize: 11,
              marginTop: 2,
              display: "block",
            }}
          >
            {documentoTexto.length.toLocaleString("es-PE")} caracteres.
            {antecedenteId
              ? " Puedes editar el texto y la version editada se usara en la generacion."
              : null}
          </small>
        </div>
      ) : null}

      {analisis && (analisis.materia || analisis.puntosClave || analisis.tipoDocumento) ? (
        <div
          className="expField"
          style={{
            background: "#f0f9ff",
            border: "1px solid #bae6fd",
            borderRadius: 8,
            padding: 12,
            marginTop: 8,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginBottom: 8,
            }}
          >
            <BookOpen size={15} style={{ color: "#0c4a6e" }} />
            <strong style={{ fontSize: 13, color: "#0c4a6e" }}>
              Resumen tecnico del documento
            </strong>
            <button
              type="button"
              onClick={() => setShowAnalisis((v) => !v)}
              className="secondaryButton"
              style={{ marginLeft: "auto", padding: "2px 8px", fontSize: 11 }}
            >
              {showAnalisis ? "Ocultar" : "Mostrar"}
            </button>
          </div>
          {showAnalisis ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <AnalisisRow label="Tipo" value={analisis.tipoDocumento} />
              <AnalisisRow label="Materia" value={analisis.materia} />
              {analisis.partes ? <AnalisisRow label="Partes" value={analisis.partes} /> : null}
              <AnalisisRow label="Puntos clave" value={analisis.puntosClave} />
              {analisis.normativaIdentificada ? (
                <AnalisisRow
                  label="Normativa que aplica el documento"
                  value={analisis.normativaIdentificada}
                />
              ) : null}
              {analisis.consultasSugeridas && analisis.consultasSugeridas.length > 0 ? (
                <div
                  style={{
                    background: "#fffbeb",
                    border: "1px solid #fde68a",
                    borderRadius: 6,
                    padding: "8px 10px",
                    marginTop: 4,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 12,
                      color: "#92400e",
                      fontWeight: 600,
                      marginBottom: 4,
                    }}
                  >
                    <Lightbulb size={13} /> Consultas sugeridas para la biblioteca:
                  </div>
                  <ul
                    style={{
                      margin: 0,
                      paddingLeft: 18,
                      fontSize: 12,
                      color: "#78350f",
                    }}
                  >
                    {analisis.consultasSugeridas.map((q, i) => (
                      <li key={i} style={{ marginBottom: 2 }}>
                        {q}
                      </li>
                    ))}
                  </ul>
                  <div
                    style={{
                      fontSize: 11,
                      color: "#92400e",
                      marginTop: 6,
                      fontStyle: "italic",
                    }}
                  >
                    Pega estas consultas en la biblioteca de normativa para encontrar
                    la ley aplicable. Si no aparece, marca “Buscar en internet” en
                    la generacion.
                  </div>
                </div>
              ) : null}
              {analisis.tokenUsage ? (
                <div
                  style={{
                    fontSize: 10,
                    color: "var(--muted, #64748b)",
                    marginTop: 4,
                  }}
                >
                  Analisis IA: {analisis.tokenUsage.inputTokens} tokens entrada
                  + {analisis.tokenUsage.outputTokens} salida
                  {analisis.tokenUsage.estimatedCostUsd > 0
                    ? ` ($${analisis.tokenUsage.estimatedCostUsd.toFixed(4)})`
                    : ""}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {showConfirm ? (
        <ConfirmDialog
          open={true}
          title="¿Quitar el antecedente?"
          message="El texto extraido se conserva en el editor, pero se desvincula del documento persistido en Storage y Pinecone. Si vuelves a subir el mismo PDF, se creara un nuevo antecedente."
          tone="warning"
          confirmLabel="Quitar antecedente"
          onConfirm={() => {
            void removeAntecedente();
            setShowConfirm(false);
          }}
          onCancel={() => setShowConfirm(false)}
        />
      ) : null}
    </div>
  );
}

function AnalisisRow({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div style={{ fontSize: 12, lineHeight: 1.5 }}>
      <strong style={{ color: "#0c4a6e", fontWeight: 600 }}>{label}:</strong>{" "}
      <span style={{ color: "#0f172a" }}>{value}</span>
    </div>
  );
}
