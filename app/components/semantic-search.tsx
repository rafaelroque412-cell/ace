"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Clipboard,
  ExternalLink,
  FileSearch,
  Layers3,
  LoaderCircle,
  MessageSquareText,
  RotateCcw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";
import { documentTypeLabel, processTypeLabel } from "@/lib/legal-taxonomy";
import { PdfCiteButton } from "./pdf-cite-viewer";
import { SaveButton } from "./save-button";

type SearchSource = {
  article: string | null;
  sectionTitle?: string | null;
  chunkId: string;
  chunkIndex: number;
  documentId: string;
  documentTitle: string;
  documentType: string;
  excerpt: string;
  pageEnd: number | null;
  pageStart: number | null;
  score: number;
  semanticScore: number;
  lexicalScore: number;
  evidenceQuality: number;
  matchType: "semantica" | "lexical" | "hibrida";
  sourceEntity: string | null;
  processType: string | null;
  status: string | null;
  topic: string | null;
  vigencia: string | null;
  year: number | null;
  citation: string;
};

type SearchResponse = {
  assessment?: {
    averageScore: number;
    confidence: "alta" | "media" | "baja";
    evidenceQuality: number;
    evidenceWarnings?: string[];
    lexicalScore: number;
    queryUsed?: string;
    reason: string;
    scope?: "legal" | "off_topic" | "unknown";
    sufficient: boolean;
    topScore: number;
    uniqueDocuments: number;
  };
  error?: string;
  sources?: SearchSource[];
};

type Confidence = NonNullable<SearchResponse["assessment"]>["confidence"];
type SourceTab = "normativa" | "directivas" | "opiniones" | "bases";

type FacetValue = { value: string; label: string; count: number };
type Facets = {
  documentType: FacetValue[];
  sourceEntity: FacetValue[];
  processType: FacetValue[];
  year: FacetValue[];
  vigencia: FacetValue[];
};

function sourceRoleLabel(documentType: string) {
  return documentType === "bases_integradas"
    ? "Esquema de implementacion"
    : "Fuente normativa";
}

const exampleQueries = [
  "impedimentos para contratar",
  "contrataciones por emergencia",
  "garantia de fiel cumplimiento",
  "impedimntos para contrtatar",
];

const filterLabels: Record<string, string> = {
  article: "Articulo",
  documentType: "Tipo",
  processType: "Proceso",
  sourceEntity: "Entidad",
  status: "Estado",
  topic: "Tema",
  vigencia: "Vigencia",
  year: "Año",
};

function sourceLocation(source: SearchSource) {
  const parts = [
    source.pageStart ? `pagina ${source.pageStart}` : "pagina no identificada",
    source.article ? `articulo ${source.article}` : "articulo no identificado",
  ];

  return parts.join(" · ");
}

function confidenceClass(confidence: Confidence) {
  if (confidence === "alta") {
    return "confidencePill high";
  }

  if (confidence === "media") {
    return "confidencePill medium";
  }

  return "confidencePill low";
}

function relevanceLabel(score: number) {
  if (score >= 0.72) {
    return "Muy relevante";
  }

  if (score >= 0.55) {
    return "Relevante";
  }

  return "Revisar";
}

function groupByDocument(sources: SearchSource[]) {
  const grouped = new Map<string, SearchSource[]>();

  for (const source of sources) {
    grouped.set(source.documentId, [...(grouped.get(source.documentId) ?? []), source]);
  }

  return Array.from(grouped.entries()).map(([documentId, documentSources]) => ({
    documentId,
    documentTitle: documentSources[0]?.documentTitle ?? "Documento sin titulo",
    sourceCount: documentSources.length,
    topScore: Math.max(...documentSources.map((source) => source.score)),
  }));
}

function FacetGroup({
  label,
  values,
  selected,
  onToggle,
}: {
  label: string;
  values: FacetValue[];
  selected: string;
  onToggle: (value: string) => void;
}) {
  if (values.length === 0) {
    return null;
  }

  return (
    <div className="facetGroup">
      <span>{label}</span>
      <div className="facetChips">
        {values.map((facet) => (
          <button
            key={facet.value}
            className={`facetChip ${selected === facet.value ? "active" : ""}`}
            onClick={() => onToggle(selected === facet.value ? "" : facet.value)}
            type="button"
          >
            {facet.label} <b>{facet.count}</b>
          </button>
        ))}
      </div>
    </div>
  );
}

export function SemanticSearch() {
  const router = useRouter();
  const [copiedId, setCopiedId] = useState("");
  const [documentType, setDocumentType] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [processType, setProcessType] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchSource[]>([]);
  const [sourceTab, setSourceTab] = useState<SourceTab>("normativa");
  const [showFilters, setShowFilters] = useState(false);
  const [sourceEntity, setSourceEntity] = useState("");
  const [status, setStatus] = useState("");
  const [topic, setTopic] = useState("");
  const [topK, setTopK] = useState(10);
  const [vigencia, setVigencia] = useState("");
  const [year, setYear] = useState("");
  const [article, setArticle] = useState("");
  const [facets, setFacets] = useState<Facets | null>(null);
  const [assessment, setAssessment] = useState<SearchResponse["assessment"] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/facets")
      .then((response) => response.json())
      .then((payload) => {
        if (!cancelled) {
          setFacets(payload.facets ?? null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFacets(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);
  const canSearch = query.trim().length >= 5 && !loading;
  const activeFilterCount = [
    documentType,
    processType,
    sourceEntity,
    status,
    topic,
    vigencia,
    year,
    article,
  ].filter(Boolean).length;
  const activeFilters = [
    { key: "documentType", value: documentType ? documentTypeLabel(documentType) : "" },
    { key: "processType", value: processType ? processTypeLabel(processType) ?? processType : "" },
    { key: "sourceEntity", value: sourceEntity },
    { key: "article", value: article },
    { key: "year", value: year },
    { key: "topic", value: topic },
    { key: "status", value: status },
    { key: "vigencia", value: vigencia },
  ].filter((filter) => filter.value);
  const visibleResults = useMemo(
    () =>
      results.filter((source) => {
        if (sourceTab === "bases") {
          return source.documentType === "bases_integradas";
        }

        if (sourceTab === "directivas") {
          return source.documentType === "directiva";
        }

        if (sourceTab === "opiniones") {
          return source.documentType === "opinion";
        }

        return ["ley", "reglamento", "directiva", "opinion"].includes(source.documentType);
      }),
    [results, sourceTab],
  );
  const visibleDocumentGroups = useMemo(() => groupByDocument(visibleResults), [visibleResults]);
  const correctedQuery =
    assessment?.queryUsed && assessment.queryUsed !== query.trim().toLowerCase()
      ? assessment.queryUsed
      : "";
  const searched = Boolean(assessment || results.length > 0 || error);

  async function performSearch(targetTab: SourceTab, event?: React.FormEvent<HTMLFormElement>) {
    event?.preventDefault();

    const normalizedQuery = query.trim();

    if (normalizedQuery.length < 5) {
      setError("Escribe una busqueda mas especifica.");
      return;
    }

    setAssessment(null);
    setError("");
    setLoading(true);
    setResults([]);

    try {
      const response = await fetch("/api/search", {
        body: JSON.stringify({
          filters: {
            article,
            documentType:
              documentType ||
              (targetTab === "bases"
                ? "bases_integradas"
                : targetTab === "directivas"
                  ? "directiva"
                  : targetTab === "opiniones"
                    ? "opinion"
                    : ""),
            processType,
            sourceEntity,
            status,
            topic,
            vigencia,
            year,
          },
          query: normalizedQuery,
          topK,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const payload = (await response.json()) as SearchResponse;

      if (!response.ok) {
        setError(payload.error ?? "No se pudo ejecutar la busqueda.");
        return;
      }

      setAssessment(payload.assessment ?? null);
      setResults(payload.sources ?? []);
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  }

  function submitSearch(event: React.FormEvent<HTMLFormElement>) {
    void performSearch(sourceTab, event);
  }

  function changeTab(tab: SourceTab) {
    setSourceTab(tab);

    // Re-consulta al servidor cuando ya hay una busqueda activa, porque el
    // tipo documental enviado depende del tab seleccionado.
    if (query.trim().length >= 5) {
      void performSearch(tab);
    }
  }

  function clearFilters() {
    setDocumentType("");
    setProcessType("");
    setSourceEntity("");
    setStatus("");
    setTopic("");
    setVigencia("");
    setYear("");
    setArticle("");
  }

  function resetSearch() {
    clearFilters();
    setAssessment(null);
    setCopiedId("");
    setError("");
    setQuery("");
    setResults([]);
    setTopK(10);
    setSourceTab("normativa");
  }

  async function copySource(source: SearchSource) {
    const text = [
      source.documentTitle,
      sourceLocation(source),
      `Score: ${source.score.toFixed(3)}`,
      source.excerpt,
    ].join("\n");

    await navigator.clipboard.writeText(text);
    setCopiedId(source.chunkId);
    window.setTimeout(() => setCopiedId(""), 1800);
  }

  function sendToChat(source: SearchSource) {
    const prompt = [
      query.trim(),
      `Usa como punto de partida esta fuente: ${source.citation || sourceLocation(source)} de ${source.documentTitle}.`,
    ]
      .filter(Boolean)
      .join(" ");
    const params = new URLSearchParams({
      pregunta: prompt,
    });

    if (documentType || source.documentType) {
      params.set("documentType", documentType || source.documentType);
    }

    if (processType || source.processType) {
      params.set("processType", processType || source.processType || "");
    }

    if (sourceEntity) {
      params.set("sourceEntity", sourceEntity);
    }

    if (topic) {
      params.set("topic", topic);
    }

    if (status) {
      params.set("status", status);
    }

    if (vigencia) {
      params.set("vigencia", vigencia);
    }

    if (year) {
      params.set("year", year);
    }

    router.push(`/chat?${params.toString()}`);
  }

  return (
    <div className="toolPanel">
      <div className="toolPanelHeader">
        <div>
          <p className="eyebrow">Motor semantico</p>
          <h2>Buscar en la biblioteca</h2>
        </div>
        <FileSearch size={22} />
      </div>

      <form className="toolBody" onSubmit={submitSearch}>
        <div className="sourceTabs" role="tablist" aria-label="Tipo de evidencia">
          <button aria-selected={sourceTab === "normativa"} disabled={loading} onClick={() => changeTab("normativa")} role="tab" type="button">
            Normativa
          </button>
          <button aria-selected={sourceTab === "directivas"} disabled={loading} onClick={() => changeTab("directivas")} role="tab" type="button">
            Directivas
          </button>
          <button aria-selected={sourceTab === "opiniones"} disabled={loading} onClick={() => changeTab("opiniones")} role="tab" type="button">
            Opiniones
          </button>
          <button aria-selected={sourceTab === "bases"} disabled={loading} onClick={() => changeTab("bases")} role="tab" type="button">
            Bases / esquemas
          </button>
        </div>

        <label className="promptInput searchQuery">
          <span>Consulta</span>
          <textarea
            aria-label="Consulta semantica"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Ej. impedimentos para contratar con el Estado"
            value={query}
          />
        </label>

        <div className="exampleQuestions">
          {exampleQueries.map((item) => (
            <button key={item} onClick={() => setQuery(item)} type="button">
              {item}
            </button>
          ))}
        </div>

        <div className="filterBar">
          <button
            className="filterToggle inlineFilterToggle"
            onClick={() => setShowFilters((current) => !current)}
            type="button"
          >
            <span>
              <SlidersHorizontal size={17} />
              Filtros
            </span>
            <strong>{activeFilterCount}</strong>
          </button>
          <button className="secondaryButton compactButton" onClick={clearFilters} type="button">
            <RotateCcw size={15} />
            Limpiar filtros
          </button>
        </div>

        {activeFilters.length > 0 ? (
          <div className="activeFilterChips" aria-label="Filtros activos">
            {activeFilters.map((filter) => (
              <span key={filter.key}>
                {filterLabels[filter.key]}: {filter.value}
              </span>
            ))}
          </div>
        ) : null}

        {showFilters ? (
          <div className="searchFilters">
            {facets ? (
              <div className="facetGroups">
                <FacetGroup
                  label="Tipo documental"
                  values={facets.documentType}
                  selected={documentType}
                  onToggle={setDocumentType}
                />
                <FacetGroup
                  label="Entidad"
                  values={facets.sourceEntity}
                  selected={sourceEntity}
                  onToggle={setSourceEntity}
                />
                <FacetGroup
                  label="Tipo de proceso"
                  values={facets.processType}
                  selected={processType}
                  onToggle={setProcessType}
                />
                <FacetGroup label="Año" values={facets.year} selected={year} onToggle={setYear} />
                <FacetGroup
                  label="Vigencia"
                  values={facets.vigencia}
                  selected={vigencia}
                  onToggle={setVigencia}
                />
              </div>
            ) : null}
            <div className="formGrid">
              <label>
                <span>Articulo Nº</span>
                <input
                  inputMode="numeric"
                  onChange={(event) => setArticle(event.target.value.trim())}
                  placeholder="144"
                  value={article}
                />
              </label>
              <label>
                <span>Tema</span>
                <input
                  onChange={(event) => setTopic(event.target.value)}
                  placeholder="impedimentos"
                  value={topic}
                />
              </label>
              <label>
                <span>Estado</span>
                <input
                  onChange={(event) => setStatus(event.target.value)}
                  placeholder="vigente, derogado..."
                  value={status}
                />
              </label>
              <label>
                <span>Resultados</span>
                <select onChange={(event) => setTopK(Number(event.target.value))} value={topK}>
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={15}>15</option>
                  <option value={20}>20</option>
                </select>
              </label>
            </div>
          </div>
        ) : null}

        <div className="formActions">
          <button className="secondaryButton" onClick={resetSearch} type="button">
            <RotateCcw size={17} />
            Limpiar
          </button>
          <button className="primaryButton" disabled={!canSearch} type="submit">
            {loading ? <LoaderCircle size={18} /> : <Search size={18} />}
            {loading ? "Buscando..." : "Buscar"}
          </button>
        </div>

        {error ? <p className="formMessage errorText">{error}</p> : null}
        {assessment ? (
          <div className="evidenceSummary">
            <div className="evidenceSummaryHeader">
              <span className={confidenceClass(assessment.confidence)}>
                Confianza {assessment.confidence}
              </span>
              <span className={assessment.sufficient ? "sourceBadge valid" : "sourceBadge warning"}>
                {assessment.sufficient ? "Fuente suficiente" : "Fuente insuficiente"}
              </span>
            </div>
            <strong>{assessment.reason}</strong>
            <small>
              {assessment.uniqueDocuments} documento(s) · score superior{" "}
              {assessment.topScore.toFixed(3)} · promedio {assessment.averageScore.toFixed(3)} ·
              coincidencia {(assessment.lexicalScore * 100).toFixed(0)}% · calidad{" "}
              {assessment.evidenceQuality.toFixed(2)}
            </small>
            {correctedQuery ? <small>Busqueda usada: {correctedQuery}</small> : null}
            {assessment.evidenceWarnings?.length ? (
              <div className="warningList">
                <AlertTriangle size={15} />
                <span>{assessment.evidenceWarnings.join(" ")}</span>
              </div>
            ) : null}
          </div>
        ) : null}
      </form>

      <div className="documentList">
        <div className="listHeader">
          <div>
            <strong>Fragmentos recuperados</strong>
            <small>
              {visibleDocumentGroups.length > 0
                ? `${visibleDocumentGroups.length} documento(s) con evidencia`
                : "Sin documentos recuperados"}
            </small>
          </div>
          <span>{visibleResults.length}</span>
        </div>

        {visibleDocumentGroups.length > 0 ? (
          <div className="documentEvidenceStrip">
            {visibleDocumentGroups.slice(0, 4).map((group) => (
              <div key={group.documentId}>
                <Layers3 size={15} />
                <strong>{group.documentTitle}</strong>
                <span>
                  {group.sourceCount} fragmento(s) · {group.topScore.toFixed(3)}
                </span>
              </div>
            ))}
          </div>
        ) : null}

        {visibleResults.length === 0 ? (
          <div className="emptyState searchEmpty">
            <ShieldCheck size={20} />
            <strong>{searched ? "No se encontro evidencia suficiente." : "Listo para buscar evidencia."}</strong>
            <span>
              {searched
                ? "Prueba quitar filtros o usar terminos juridicos mas amplios."
                : "Escribe una consulta legal y, si hace falta, acotala por tipo, entidad, año o vigencia."}
            </span>
          </div>
        ) : (
          visibleResults.map((source, index) => (
            <article className="sourceItem" key={source.chunkId}>
              <div className="sourceItemHeader">
                <div>
                  <span>
                    Resultado {index + 1} · {source.documentType} ·{" "}
                    {source.sourceEntity ?? "Sin entidad"}
                    {processTypeLabel(source.processType)
                      ? ` · ${processTypeLabel(source.processType)}`
                      : ""}
                  </span>
                  <strong>{source.documentTitle}</strong>
                </div>
                <span className={`relevanceBadge ${source.evidenceQuality >= 0.55 ? "valid" : "warning"}`}>
                  {relevanceLabel(source.evidenceQuality)}
                </span>
              </div>
              <div className="sourceMetaGrid">
                <span>{source.citation || sourceLocation(source)}</span>
                {source.sectionTitle ? <span>Seccion {source.sectionTitle}</span> : null}
                <span>Fragmento {source.chunkIndex + 1}</span>
                <span>{source.matchType}</span>
                <span>{sourceRoleLabel(source.documentType)}</span>
                <span>Calidad {source.evidenceQuality.toFixed(2)}</span>
                <span>Semantico {source.semanticScore.toFixed(3)}</span>
                <span>Literal {(source.lexicalScore * 100).toFixed(0)}%</span>
                {source.topic ? <span>Tema {source.topic}</span> : null}
                {processTypeLabel(source.processType) ? (
                  <span>Proceso {processTypeLabel(source.processType)}</span>
                ) : null}
                {source.status ? <span>Estado {source.status}</span> : null}
                {source.vigencia ? <span>Vigencia {source.vigencia}</span> : null}
                {source.year ? <span>{source.year}</span> : null}
              </div>
              <p>{source.excerpt}</p>
              <div className="sourceActions">
                <PdfCiteButton
                  documentId={source.documentId}
                  page={source.pageStart}
                  quote={source.excerpt}
                />
                <a
                  className="secondaryButton compactButton"
                  href={`/api/documents/${source.documentId}`}
                  rel="noreferrer"
                  target="_blank"
                >
                  <ExternalLink size={15} />
                  Abrir PDF
                </a>
                <button className="secondaryButton compactButton" onClick={() => sendToChat(source)} type="button">
                  <MessageSquareText size={15} />
                  Enviar al chat
                </button>
                <button className="secondaryButton compactButton" onClick={() => copySource(source)} type="button">
                  <Clipboard size={15} />
                  {copiedId === source.chunkId ? "Copiado" : "Copiar fuente"}
                </button>
                <SaveButton
                  itemType="documento"
                  documentId={source.documentId}
                  title={`${source.documentTitle} — ${source.citation || sourceLocation(source)}`}
                />
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
