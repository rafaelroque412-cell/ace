"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  Lightbulb,
  LoaderCircle,
  ScanSearch,
  ShieldCheck,
  Upload,
  XCircle,
} from "lucide-react";
import { documentTypeLabel } from "@/lib/legal-taxonomy";
import { PdfCiteButton } from "./pdf-cite-viewer";

type ClauseCheck = { key: string; label: string; presente: boolean; nota: string };
type Source = {
  documentId: string;
  documentTitle: string;
  documentType: string;
  citation: string;
  pageStart: number | null;
  article: string | null;
  excerpt: string;
};
type Analysis = {
  resumen: string;
  confidence: "alta" | "media" | "baja";
  clausulas: ClauseCheck[];
  riesgos: string[];
  recomendaciones: string[];
  normasAplicables: Array<{ documentTitle: string; documentType: string; citation: string }>;
  sources: Source[];
  model: string;
};
type IndexedDoc = { id: string; title: string; document_type: string; status: string };

function confidenceClass(value: Analysis["confidence"]) {
  return value === "alta" ? "confidencePill high" : value === "media" ? "confidencePill medium" : "confidencePill low";
}

export function DocumentAnalyzer() {
  const [mode, setMode] = useState<"upload" | "indexed">("upload");
  const [file, setFile] = useState<File | null>(null);
  const [docs, setDocs] = useState<IndexedDoc[]>([]);
  const [selectedDoc, setSelectedDoc] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/documents")
      .then((response) => response.json())
      .then((payload) => {
        if (!cancelled) {
          setDocs((payload.documents ?? []).filter((doc: IndexedDoc) => doc.status === "indexed"));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDocs([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function runAnalysis() {
    setError("");
    setAnalysis(null);
    setLoading(true);

    try {
      let response: Response;
      if (mode === "upload") {
        if (!file) {
          setError("Adjunta un PDF para analizar.");
          setLoading(false);
          return;
        }
        const formData = new FormData();
        formData.append("file", file);
        formData.append("title", file.name);
        response = await fetch("/api/analyze", { body: formData, method: "POST" });
      } else {
        if (!selectedDoc) {
          setError("Elige un documento indexado.");
          setLoading(false);
          return;
        }
        response = await fetch("/api/analyze", {
          body: JSON.stringify({ documentId: selectedDoc }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        });
      }

      const payload = (await response.json()) as { analysis?: Analysis; error?: string };
      if (!response.ok || !payload.analysis) {
        setError(payload.error ?? "No se pudo analizar el documento.");
        return;
      }
      setAnalysis(payload.analysis);
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  }

  const missingClauses = analysis?.clausulas.filter((clause) => !clause.presente).length ?? 0;

  return (
    <div className="toolPanel">
      <div className="toolPanelHeader">
        <div>
          <p className="eyebrow">Asistente</p>
          <h2>Analizar documento</h2>
        </div>
        <ScanSearch size={22} />
      </div>

      <div className="toolBody">
        <div className="sourceTabs" role="tablist" aria-label="Origen del documento">
          <button aria-selected={mode === "upload"} onClick={() => setMode("upload")} role="tab" type="button">
            Subir archivo
          </button>
          <button aria-selected={mode === "indexed"} onClick={() => setMode("indexed")} role="tab" type="button">
            Documento indexado
          </button>
        </div>

        {mode === "upload" ? (
          <label className="uploadField">
            <Upload size={18} />
            <span>{file ? file.name : "Selecciona un PDF (bases, contrato, expediente)"}</span>
            <input
              accept="application/pdf"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              type="file"
            />
          </label>
        ) : (
          <label className="promptInput">
            <span>Documento del corpus</span>
            <select onChange={(event) => setSelectedDoc(event.target.value)} value={selectedDoc}>
              <option value="">Elige un documento...</option>
              {docs.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {doc.title} ({documentTypeLabel(doc.document_type)})
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="formActions">
          <button className="primaryButton" disabled={loading} onClick={runAnalysis} type="button">
            {loading ? <LoaderCircle size={18} /> : <ScanSearch size={18} />}
            {loading ? "Analizando..." : "Analizar"}
          </button>
        </div>

        {error ? <p className="formMessage errorText">{error}</p> : null}
      </div>

      {analysis ? (
        <div className="analysisReport">
          <div className="evidenceSummary">
            <div className="evidenceSummaryHeader">
              <span className={confidenceClass(analysis.confidence)}>Confianza {analysis.confidence}</span>
              <span className={missingClauses > 0 ? "sourceBadge warning" : "sourceBadge valid"}>
                {missingClauses > 0
                  ? `${missingClauses} cláusula(s) obligatoria(s) faltante(s)`
                  : "Cláusulas obligatorias presentes"}
              </span>
            </div>
            <p>{analysis.resumen}</p>
          </div>

          <section className="analysisSection">
            <h3>
              <ShieldCheck size={17} /> Cláusulas obligatorias (art. 60)
            </h3>
            <div className="clauseList">
              {analysis.clausulas.map((clause) => (
                <div className={`clauseItem ${clause.presente ? "ok" : "missing"}`} key={clause.key}>
                  {clause.presente ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                  <div>
                    <strong>{clause.label}</strong>
                    <span>{clause.nota}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {analysis.riesgos.length > 0 ? (
            <section className="analysisSection">
              <h3>
                <AlertTriangle size={17} /> Riesgos
              </h3>
              <ul className="analysisList">
                {analysis.riesgos.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </section>
          ) : null}

          {analysis.recomendaciones.length > 0 ? (
            <section className="analysisSection">
              <h3>
                <Lightbulb size={17} /> Recomendaciones
              </h3>
              <ul className="analysisList">
                {analysis.recomendaciones.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </section>
          ) : null}

          {analysis.sources.length > 0 ? (
            <section className="analysisSection">
              <h3>
                <FileText size={17} /> Normas aplicables
              </h3>
              <div className="documentList">
                {analysis.sources.map((source, index) => (
                  <article className="sourceItem" key={source.documentId + index}>
                    <div className="sourceItemHeader">
                      <div>
                        <span>
                          [F{index + 1}] {documentTypeLabel(source.documentType)}
                        </span>
                        <strong>{source.documentTitle}</strong>
                      </div>
                    </div>
                    <div className="sourceMetaGrid">
                      <span>{source.citation}</span>
                    </div>
                    <p>{source.excerpt.slice(0, 360)}</p>
                    <div className="sourceActions">
                      <PdfCiteButton
                        documentId={source.documentId}
                        page={source.pageStart}
                        quote={source.excerpt}
                      />
                      <a
                        className="secondaryButton compactButton"
                        href={`/api/documents/${source.documentId}${source.pageStart ? `#page=${source.pageStart}` : ""}`}
                        rel="noreferrer"
                        target="_blank"
                      >
                        <FileText size={15} />
                        Abrir PDF
                      </a>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          <p className="analysisDisclaimer">
            Análisis de apoyo generado con IA sobre el corpus indexado; no constituye asesoría legal
            vinculante. Verifica las fuentes citadas.
          </p>
        </div>
      ) : null}
    </div>
  );
}
