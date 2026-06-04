"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  Check,
  Clipboard,
  ExternalLink,
  FileText,
  LoaderCircle,
  MessageSquareText,
  Pin,
  Quote,
  RotateCcw,
  Search,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import {
  ANSWERABLE_DOCUMENT_TYPE_OPTIONS,
  PROCESS_TYPES,
  processTypeLabel,
} from "@/lib/legal-taxonomy";
import { SaveButton } from "./save-button";

type ChatSource = {
  article: string | null;
  sectionTitle?: string | null;
  chunkId: string;
  documentId: string;
  documentTitle: string;
  documentType: string;
  sourceEntity: string | null;
  processType: string | null;
  chunkIndex: number;
  pageEnd: number | null;
  pageStart: number | null;
  score: number;
  semanticScore: number;
  lexicalScore: number;
  evidenceQuality: number;
  matchType: "semantica" | "lexical" | "hibrida";
  excerpt: string;
  topic: string | null;
  status: string | null;
  vigencia: string | null;
  year: number | null;
  citation: string;
};

type ChatAssessment = {
  coverage?: {
    bases: boolean;
    directiva: boolean;
    ley: boolean;
    opinion: boolean;
    reglamento: boolean;
  };
  evidenceQuality: number;
  evidenceWarnings?: string[];
  lexicalScore: number;
  queryUsed?: string;
  reason: string;
  scope?: "legal" | "off_topic" | "unknown";
  topScore: number;
  uniqueDocuments: number;
};

type ChatResponse = {
  answer?: string;
  assessment?: ChatAssessment;
  confidence?: "alta" | "media" | "baja";
  error?: string;
  messageId?: string | null;
  model?: string;
  sessionId?: string;
  sources?: ChatSource[];
};

type ConversationMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  assessment?: ChatAssessment;
  confidence?: ChatResponse["confidence"];
  mode?: string;
  note?: string;
  persistedId?: string | null;
  questionText?: string;
  sources?: ChatSource[];
  feedback?: "correct" | "incorrect";
};

const responseModes = [
  { label: "Tecnica", value: "tecnica" },
  { label: "Breve", value: "breve" },
  { label: "Informe", value: "informe" },
  { label: "Checklist", value: "checklist" },
] as const;

const exampleQuestions = [
  "Que dice la documentacion sobre impedimentos para contratar?",
  "Que pasa si escribo mal: impedimntos para contrtatar?",
  "Resume los criterios principales aplicables al expediente.",
];

const followUpPrompts = [
  "Convierte la respuesta en checklist operativo.",
  "Amplia el fundamento legal con las mismas fuentes.",
  "Senala limitaciones y puntos que requieren revision humana.",
];

const documentTypes = [{ label: "Todos", value: "" }, ...ANSWERABLE_DOCUMENT_TYPE_OPTIONS];

const processTypes = [{ label: "Todos", value: "" }, ...PROCESS_TYPES];

function groupSourcesByDocument(sources: ChatSource[]) {
  const grouped = new Map<
    string,
    {
      document: ChatSource;
      sources: ChatSource[];
    }
  >();

  for (const source of sources) {
    const existing = grouped.get(source.documentId);

    if (existing) {
      existing.sources.push(source);
    } else {
      grouped.set(source.documentId, {
        document: source,
        sources: [source],
      });
    }
  }

  return Array.from(grouped.values());
}

function confidenceClasses(confidence: ChatResponse["confidence"]) {
  if (confidence === "alta") {
    return "confidencePill high";
  }

  if (confidence === "media") {
    return "confidencePill medium";
  }

  return "confidencePill low";
}

function confidenceMeaning(confidence: ChatResponse["confidence"]) {
  if (confidence === "alta") {
    return "Alta: hay evidencia normativa suficiente, buena coincidencia con la pregunta y referencias trazables por pagina o articulo.";
  }

  if (confidence === "media") {
    return "Media: la respuesta esta sustentada, pero requiere revision porque la coincidencia o la cobertura normativa no es completa.";
  }

  return "Baja: no usar como conclusion juridica; faltan fuentes suficientes, trazabilidad precisa o coincidencia fuerte con la pregunta.";
}

function documentPdfUrl(source: Pick<ChatSource, "documentId" | "pageStart">) {
  return `/api/documents/${source.documentId}${source.pageStart ? `#page=${source.pageStart}` : ""}`;
}

function sourcePrecisionLabel(source: Pick<ChatSource, "article" | "pageStart">) {
  if (source.article && source.pageStart) {
    return `Referencia precisa: articulo ${source.article}, pagina ${source.pageStart}`;
  }

  if (source.article) {
    return `Referencia por articulo ${source.article}`;
  }

  if (source.pageStart) {
    return `Referencia por pagina ${source.pageStart}`;
  }

  return "Referencia aproximada: pagina/articulo no identificado";
}

function buildMessageId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getSourceSummary(sources: ChatSource[]) {
  const documentCount = new Set(sources.map((source) => source.documentId)).size;
  const topScore = sources[0]?.score ?? 0;
  return `${documentCount} documento(s) · ${sources.length} fragmento(s) · score ${topScore.toFixed(
    3,
  )}`;
}

function CoverageGrid({ coverage }: { coverage?: ChatAssessment["coverage"] }) {
  const items = [
    { label: "Ley", value: coverage?.ley, detail: "normativa" },
    { label: "Reglamento", value: coverage?.reglamento, detail: "normativa" },
    { label: "Directiva", value: coverage?.directiva, detail: "aplicable" },
    { label: "Opinion", value: coverage?.opinion, detail: "criterio no obligatorio" },
    { label: "Bases", value: coverage?.bases, detail: "solo esquema" },
  ];

  return (
    <div className="coverageGrid" aria-label="Cobertura de fuentes">
      {items.map((item) => (
        <span data-found={item.value ? "true" : "false"} key={item.label}>
          <strong>{item.label}</strong>
          {item.value ? "si" : "no"}
          <small>{item.detail}</small>
        </span>
      ))}
    </div>
  );
}

function renderFormattedText(text: string) {
  const tokens = text.split(/(\*\*[^*]+\*\*|__[^_]+__|<u>.*?<\/u>)/g);

  return tokens.map((token, index) => {
    if (token.startsWith("**") && token.endsWith("**")) {
      return <strong key={`${token}-${index}`}>{token.slice(2, -2)}</strong>;
    }

    if (token.startsWith("__") && token.endsWith("__")) {
      return <u key={`${token}-${index}`}>{token.slice(2, -2)}</u>;
    }

    if (token.startsWith("<u>") && token.endsWith("</u>")) {
      return <u key={`${token}-${index}`}>{token.slice(3, -4)}</u>;
    }

    return <span key={`${token}-${index}`}>{token}</span>;
  });
}

function renderInlineWithSources(
  text: string,
  sources: ChatSource[],
  onOpenSources: (references: Array<{ number: number; source: ChatSource }>) => void,
) {
  const parts = text.split(/((?:\s*\[F\d+\])+)/g).filter((part) => part !== undefined && part !== "");
  const nodes: React.ReactNode[] = [];

  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index];
    const matches = Array.from(part.matchAll(/\[F(\d+)\]/g));

    if (matches.length > 0 && part.replace(/\s|\[F\d+\]/g, "") === "") {
      const validReferences: Array<{ number: number; source: ChatSource }> = [];
      const missingNumbers: number[] = [];

      for (const match of matches) {
        const sourceNumber = Number(match[1]);
        const source = sources[sourceNumber - 1];

        if (source) {
          validReferences.push({ number: sourceNumber, source });
        } else {
          missingNumbers.push(sourceNumber);
        }
      }

      if (validReferences.length > 0) {
        nodes.push(
          <button
            aria-label={`Abrir fuente ${validReferences.map((reference) => reference.number).join(", ")}`}
            className="sourceRefButton"
            key={`ref-${index}`}
            onClick={() => onOpenSources(validReferences)}
            type="button"
          >
            {validReferences.map((reference) => reference.number).join(",")}
          </button>,
        );
      }

      // No descartar en silencio una cita fuera de rango: avisar visiblemente
      // que la afirmacion no tiene una fuente recuperada que la respalde.
      for (const missingNumber of missingNumbers) {
        nodes.push(
          <span
            className="sourceRefMissing"
            key={`missing-${index}-${missingNumber}`}
            title="Fuente citada no encontrada entre las fuentes recuperadas"
          >
            F{missingNumber}?
          </span>,
        );
      }

      continue;
    }

    nodes.push(...renderFormattedText(part));
  }

  return nodes;
}

function AnswerContent({
  content,
  onOpenSources,
  sources,
}: {
  content: string;
  onOpenSources: (references: Array<{ number: number; source: ChatSource }>) => void;
  sources: ChatSource[];
}) {
  const lines = content.split(/\n+/).map((line) => line.trim()).filter(Boolean);

  return (
    <div className="answerContent">
      {lines.map((line, index) => {
        const heading = line.match(/^\*\*(.+)\*\*$/);

        if (heading) {
          return <h3 key={`${line}-${index}`}>{heading[1]}</h3>;
        }

        if (/^[-*]\s+/.test(line)) {
          return (
            <div className="answerBullet" key={`${line}-${index}`}>
              <span aria-hidden="true">•</span>
              <p>{renderInlineWithSources(line.replace(/^[-*]\s+/, ""), sources, onOpenSources)}</p>
            </div>
          );
        }

        if (/^\d+\.\s+/.test(line)) {
          const [, number = "", text = line] = line.match(/^(\d+)\.\s+(.+)$/) ?? [];
          return (
            <div className="answerNumbered" key={`${line}-${index}`}>
              <span>{number}</span>
              <p>{renderInlineWithSources(text, sources, onOpenSources)}</p>
            </div>
          );
        }

        return (
          <p key={`${line}-${index}`}>
            {renderInlineWithSources(line, sources, onOpenSources)}
          </p>
        );
      })}
    </div>
  );
}

export function LegalChat() {
  const searchParams = useSearchParams();
  const initialQuestion = searchParams.get("pregunta") ?? "";
  const initialDocumentTypeParam = searchParams.get("documentType") ?? "";
  const initialDocumentType = documentTypes.some((item) => item.value === initialDocumentTypeParam)
    ? initialDocumentTypeParam
    : "";
  const initialProcessType = searchParams.get("processType") ?? "";
  const initialSourceEntity = searchParams.get("sourceEntity") ?? "";
  const initialStatus = searchParams.get("status") ?? "";
  const initialTopic = searchParams.get("topic") ?? "";
  const initialVigencia = searchParams.get("vigencia") ?? "";
  const initialYear = searchParams.get("year") ?? "";
  const [assessment, setAssessment] = useState<ChatAssessment | null>(null);
  const [confidence, setConfidence] = useState<ChatResponse["confidence"] | null>(null);
  const [copiedId, setCopiedId] = useState("");
  const [documentType, setDocumentType] = useState(initialDocumentType);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [mode, setMode] = useState("tecnica");
  const [processType, setProcessType] = useState(initialProcessType);
  const [question, setQuestion] = useState(initialQuestion);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [sourceEntity, setSourceEntity] = useState(initialSourceEntity);
  const [sources, setSources] = useState<ChatSource[]>([]);
  const [selectedReferences, setSelectedReferences] = useState<
    Array<{ number: number; source: ChatSource }> | null
  >(
    null,
  );
  const [status, setStatus] = useState(initialStatus);
  const [topic, setTopic] = useState(initialTopic);
  const [vigencia, setVigencia] = useState(initialVigencia);
  const [year, setYear] = useState(initialYear);
  const sourceGroups = useMemo(() => groupSourcesByDocument(sources), [sources]);
  const canSubmit = question.trim().length >= 5 && !loading;
  const activeFilterCount = [documentType, sourceEntity, processType, status, topic, vigencia, year].filter(
    Boolean,
  ).length;
  const hasConversation = messages.length > 0;

  async function submitQuestion(event?: React.FormEvent<HTMLFormElement>, override?: string) {
    event?.preventDefault();

    const normalizedQuestion = (override ?? question).trim();

    if (normalizedQuestion.length < 5) {
      setError("Escribe una pregunta mas especifica.");
      return;
    }

    const userMessage: ConversationMessage = {
      content: normalizedQuestion,
      id: buildMessageId(),
      role: "user",
    };

    setLoading(true);
    setAssessment(null);
    setConfidence(null);
    setError("");
    setMessages((current) => [...current, userMessage]);
    setQuestion("");
    setSources([]);

    try {
      const response = await fetch("/api/chat", {
        body: JSON.stringify({
          filters: {
            documentType,
            processType,
            sourceEntity,
            status,
            topic,
            vigencia,
            year,
          },
          mode,
          question: normalizedQuestion,
          sessionId: sessionId ?? undefined,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const payload = (await response.json()) as ChatResponse;

      if (!response.ok) {
        setError(payload.error ?? "No se pudo responder la consulta.");
        return;
      }

      const assistantMessage: ConversationMessage = {
        assessment: payload.assessment,
        confidence: payload.confidence,
        content: payload.answer ?? "No se genero respuesta.",
        id: buildMessageId(),
        persistedId: payload.messageId ?? null,
        mode,
        questionText: normalizedQuestion,
        role: "assistant",
        sources: payload.sources ?? [],
      };

      setAssessment(payload.assessment ?? null);
      setConfidence(payload.confidence ?? null);
      setMessages((current) => [...current, assistantMessage]);
      setSessionId(payload.sessionId ?? sessionId);
      setSources(payload.sources ?? []);
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  }

  function resetChat() {
    setAssessment(null);
    setConfidence(null);
    setCopiedId("");
    setError("");
    setMessages([]);
    setQuestion("");
    setSessionId(null);
    setSources([]);
  }

  function clearFilters() {
    setDocumentType("");
    setProcessType("");
    setSourceEntity("");
    setStatus("");
    setTopic("");
    setVigencia("");
    setYear("");
  }

  async function copyMessage(message: ConversationMessage) {
    await navigator.clipboard.writeText(message.content);
    setCopiedId(message.id);
  }

  async function updateAssistantMessage(
    message: ConversationMessage,
    action: "mark_correct" | "mark_incorrect" | "save_note",
    note?: string,
  ) {
    if (!message.persistedId) {
      setError("La respuesta aun no tiene identificador persistido.");
      return;
    }

    try {
      const response = await fetch(`/api/chat/messages/${message.persistedId}`, {
        body: JSON.stringify({ action, note }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "PATCH",
      });
      const payload = await response.json();

      if (!response.ok) {
        setError(payload.error ?? "No se pudo guardar la accion.");
        return;
      }

      setMessages((current) =>
        current.map((item) => {
          if (item.id !== message.id) {
            return item;
          }

          if (action === "save_note") {
            return { ...item, note: note ?? "" };
          }

          return {
            ...item,
            feedback: action === "mark_correct" ? "correct" : "incorrect",
          };
        }),
      );
      setError("");
    } catch {
      setError("No se pudo conectar con el servidor.");
    }
  }

  function buildAutomaticNote(message: ConversationMessage) {
    const sourceLines = (message.sources ?? [])
      .slice(0, 6)
      .map((source, index) => `${index + 1}. ${source.citation}`)
      .join("\n");

    return [
      `Pregunta: ${message.questionText ?? "No registrada"}`,
      "",
      "Respuesta:",
      message.content,
      "",
      sourceLines ? `Fuentes:\n${sourceLines}` : "Fuentes: sin fuentes recuperadas",
    ].join("\n");
  }

  async function saveAutomaticNote(message: ConversationMessage) {
    await updateAssistantMessage(message, "save_note", buildAutomaticNote(message));
  }

  function askFollowUp(prompt: string) {
    void submitQuestion(undefined, prompt);
  }

  return (
    <div className="legalTool">
      <div className="legalToolHeader">
        <div className="legalToolTitle">
          <div className="legalToolIcon">
            <ShieldCheck size={22} />
          </div>
          <div>
            <p className="eyebrow">
              Consulta legal
            </p>
            <h2>Chat juridico</h2>
            <p>
              Respuestas redactadas solo cuando hay fuentes suficientes.
            </p>
          </div>
        </div>
        <button
          className="secondaryButton compactButton"
          onClick={resetChat}
          type="button"
        >
          <RotateCcw size={16} />
          Nueva consulta
        </button>
      </div>

      <div className="chatWorkspace">
        <section className="chatMain">
          <div className="chatTimeline">
            {!hasConversation ? (
              <div className="chatEmpty">
                <Search size={24} />
                <strong>Empieza con una pregunta juridica</strong>
                <span>El chat recupera fuentes, evalua suficiencia y redacta la respuesta.</span>
              </div>
            ) : null}

            {messages.map((message) => (
              <article className={`chatMessage ${message.role}`} key={message.id}>
                <div className="chatMessageHeader">
                  <strong>{message.role === "user" ? "Pregunta" : "Respuesta"}</strong>
                  {message.role === "assistant" && message.confidence ? (
                    <span className={confidenceClasses(message.confidence)} title={confidenceMeaning(message.confidence)}>
                      Confianza {message.confidence}
                    </span>
                  ) : null}
                </div>
                {message.role === "assistant" ? (
                  <AnswerContent
                    content={message.content}
                    onOpenSources={(references) => setSelectedReferences(references)}
                    sources={message.sources ?? []}
                  />
                ) : (
                  <p>{message.content}</p>
                )}
                {message.role === "assistant" && message.sources?.length ? (
                  <small>
                    {getSourceSummary(message.sources)} · evidencia{" "}
                    {(
                      message.sources.reduce((total, source) => total + source.evidenceQuality, 0) /
                      message.sources.length
                    ).toFixed(2)}
                  </small>
                ) : null}
                {message.role === "assistant" ? (
                  <div className="responseActions">
                    <button
                      className="responseActionButton"
                      onClick={() => void saveAutomaticNote(message)}
                      type="button"
                    >
                      <Pin size={15} />
                      {message.note ? "Guardado en notas" : "Guardar en notas"}
                    </button>
                    <button className="responseIconButton" onClick={() => void copyMessage(message)} title="Copiar respuesta" type="button">
                      {copiedId === message.id ? <Check size={16} /> : <Clipboard size={16} />}
                    </button>
                    <button
                      aria-pressed={message.feedback === "correct"}
                      className="responseIconButton"
                      onClick={() => void updateAssistantMessage(message, "mark_correct")}
                      title="Marcar respuesta correcta"
                      type="button"
                    >
                      <ThumbsUp size={16} />
                    </button>
                    <button
                      aria-pressed={message.feedback === "incorrect"}
                      className="responseIconButton"
                      onClick={() => void updateAssistantMessage(message, "mark_incorrect")}
                      title="Marcar respuesta incorrecta"
                      type="button"
                    >
                      <ThumbsDown size={16} />
                    </button>
                    {message.note ? <small>Nota guardada</small> : null}
                    <SaveButton
                      itemType="mensaje"
                      messageId={message.persistedId ?? undefined}
                      title={message.content.slice(0, 120)}
                      label="Guardar"
                    />
                  </div>
                ) : null}
              </article>
            ))}

            {loading ? (
              <div className="chatMessage assistant">
                <div className="chatMessageHeader">
                  <strong>Respuesta</strong>
                </div>
                <span className="loadingInline">
                  <LoaderCircle size={18} />
                  Buscando fuentes y generando respuesta...
                </span>
              </div>
            ) : null}

            {error ? <p className="formMessage errorText">{error}</p> : null}
          </div>

          <form className="chatComposer" onSubmit={submitQuestion}>
            <label className="composerQuestion">
              <span>Pregunta</span>
              <textarea
                aria-label="Pregunta juridica"
                onChange={(event) => setQuestion(event.target.value)}
                placeholder="Ej. Que requisitos debo revisar antes de aprobar este expediente?"
                value={question}
              />
            </label>

            <div className="exampleQuestions">
              {exampleQuestions.map((item) => (
                <button key={item} onClick={() => setQuestion(item)} type="button">
                  {item}
                </button>
              ))}
            </div>

            <div className="composerFooter">
              <div className="modeSelector" role="tablist">
                {responseModes.map((item) => (
                  <button
                    aria-selected={mode === item.value}
                    key={item.value}
                    onClick={() => setMode(item.value)}
                    role="tab"
                    type="button"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <button className="primaryButton" disabled={!canSubmit} type="submit">
                {loading ? <LoaderCircle size={18} /> : <Send size={18} />}
                {loading ? "Consultando..." : "Consultar"}
              </button>
            </div>
          </form>
        </section>

        <aside className="chatSidePanel">
          <section className="sideBox">
            <button
              className="filterToggle"
              onClick={() => setShowFilters((current) => !current)}
              type="button"
            >
              <span>
                <SlidersHorizontal size={17} />
                Filtros semanticos
              </span>
              <strong>{activeFilterCount}</strong>
            </button>

            {showFilters ? (
              <div className="filterPanel compactFilters">
                <label>
                  <span>Tipo</span>
                  <select onChange={(event) => setDocumentType(event.target.value)} value={documentType}>
                    {documentTypes.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
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
                  <span>Tipo de proceso</span>
                  <select onChange={(event) => setProcessType(event.target.value)} value={processType}>
                    {processTypes.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Año</span>
                  <input
                    inputMode="numeric"
                    onChange={(event) => setYear(event.target.value)}
                    placeholder="2026"
                    value={year}
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
                    placeholder="indexed"
                    value={status}
                  />
                </label>
                <label>
                  <span>Vigencia</span>
                  <input
                    onChange={(event) => setVigencia(event.target.value)}
                    placeholder="vigente"
                    value={vigencia}
                  />
                </label>
                <button className="secondaryButton compactButton" onClick={clearFilters} type="button">
                  <RotateCcw size={15} />
                  Limpiar filtros
                </button>
              </div>
            ) : null}
          </section>

          <section className="sideBox">
            <div className="sideBoxHeader">
              <MessageSquareText size={17} />
              <strong>Continuar analisis</strong>
            </div>
            <div className="followUps">
              {followUpPrompts.map((prompt) => (
                <button disabled={!hasConversation || loading} key={prompt} onClick={() => askFollowUp(prompt)} type="button">
                  {prompt}
                </button>
              ))}
            </div>
          </section>

          <section className="sideBox">
            <div className="sideBoxHeader">
              <FileText size={17} />
              <strong>Evidencia recuperada</strong>
            </div>
            {assessment ? (
              <div className="evidenceMini">
                {confidence ? <span className={confidenceClasses(confidence)}>Confianza {confidence}</span> : null}
                {confidence ? <p className="confidenceMeaning">{confidenceMeaning(confidence)}</p> : null}
                <small>
                  {assessment.uniqueDocuments} documento(s) · score {assessment.topScore.toFixed(3)} ·
                  calidad {assessment.evidenceQuality.toFixed(2)} · literal{" "}
                  {(assessment.lexicalScore * 100).toFixed(0)}%
                </small>
                {assessment.queryUsed ? <small>Busqueda usada: {assessment.queryUsed}</small> : null}
                <CoverageGrid coverage={assessment.coverage} />
                {assessment.evidenceWarnings?.length ? (
                  <div className="warningList">
                    <AlertTriangle size={15} />
                    <span>{assessment.evidenceWarnings.join(" ")}</span>
                  </div>
                ) : null}
              </div>
            ) : null}
            {sourceGroups.length === 0 ? (
              <p className="sideMuted">Sin fuentes recuperadas en esta consulta.</p>
            ) : (
              sourceGroups.map(({ document, sources: documentSources }, index) => (
                <article className="evidenceCard" key={document.documentId}>
                  <span>Fuente {index + 1}</span>
                  <strong>{document.documentTitle}</strong>
                  <small>
                    {document.documentType} · {document.sourceEntity ?? "Sin entidad"} ·{" "}
                    {processTypeLabel(document.processType)
                      ? `${processTypeLabel(document.processType)} · `
                      : ""}
                    {documentSources.length} fragmento(s)
                  </small>
                  <a
                    className="sourceLink"
                    href={documentPdfUrl(document)}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <ExternalLink size={14} />
                    {document.pageStart ? `Abrir pagina ${document.pageStart}` : "Abrir PDF"}
                  </a>
                  {documentSources.map((source) => (
                    <details key={source.chunkId}>
                      <summary>
                        {source.citation || `Fragmento ${source.chunkIndex + 1}`} · {source.matchType} ·{" "}
                        calidad {source.evidenceQuality.toFixed(2)}
                      </summary>
                      <strong className="precisionLine">{sourcePrecisionLabel(source)}</strong>
                      <small>
                        Score {source.score.toFixed(3)} · semantico{" "}
                        {source.semanticScore.toFixed(3)} · literal{" "}
                        {(source.lexicalScore * 100).toFixed(0)}%
                      </small>
                      <p>{source.excerpt}</p>
                      <a
                        className="sourceLink"
                        href={documentPdfUrl(source)}
                        rel="noreferrer"
                        target="_blank"
                      >
                        <ExternalLink size={14} />
                        {source.pageStart ? `Abrir exactamente pagina ${source.pageStart}` : "Abrir PDF"}
                      </a>
                    </details>
                  ))}
                </article>
              ))
            )}
          </section>
        </aside>
      </div>
      <Dialog.Root open={Boolean(selectedReferences)} onOpenChange={(open) => !open && setSelectedReferences(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="dialogOverlay" />
          <Dialog.Content className="sourceModal">
            <Dialog.Title>
              {selectedReferences && selectedReferences.length > 1
                ? `Fuentes ${selectedReferences.map((reference) => reference.number).join(", ")}`
                : `Fuente ${selectedReferences?.[0]?.number ?? ""}`}
            </Dialog.Title>
            <Dialog.Description>
              Verificacion documental de la afirmacion seleccionada.
            </Dialog.Description>
            {selectedReferences ? (
              <div className="sourceModalBody">
                {selectedReferences.map((reference) => (
                  <article className="sourceModalReference" key={`${reference.number}-${reference.source.chunkId}`}>
                    <div className="sourceModalReferenceHeader">
                      <strong>Fuente {reference.number}</strong>
                      <span>{reference.source.documentTitle}</span>
                    </div>
                    <div className="sourceModalMeta">
                      <span>{reference.source.documentType}</span>
                      <span>{reference.source.sourceEntity ?? "Sin entidad"}</span>
                      {processTypeLabel(reference.source.processType) ? (
                        <span>{processTypeLabel(reference.source.processType)}</span>
                      ) : null}
                      {reference.source.sectionTitle ? <span>{reference.source.sectionTitle}</span> : null}
                      <span>Calidad {reference.source.evidenceQuality.toFixed(2)}</span>
                    </div>
                    <div className="sourceExactBox">
                      <strong>Ubicacion verificada</strong>
                      <span>{sourcePrecisionLabel(reference.source)}</span>
                      <small>
                        Fragmento {reference.source.chunkIndex + 1} · {reference.source.matchType} ·
                        semantico {reference.source.semanticScore.toFixed(3)} · literal{" "}
                        {(reference.source.lexicalScore * 100).toFixed(0)}%
                      </small>
                    </div>
                    <strong>{reference.source.citation}</strong>
                    <div className="sourceQuote">
                      <Quote size={17} />
                      <p>{reference.source.excerpt}</p>
                    </div>
                    <a
                      className="secondaryButton compactButton"
                      href={documentPdfUrl(reference.source)}
                      rel="noreferrer"
                      target="_blank"
                    >
                      <ExternalLink size={15} />
                      {reference.source.pageStart ? `Abrir PDF en pagina ${reference.source.pageStart}` : "Abrir PDF"}
                    </a>
                  </article>
                ))}
                <div className="dialogActions">
                  <Dialog.Close className="primaryButton" type="button">
                    Entendido
                  </Dialog.Close>
                </div>
              </div>
            ) : null}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
