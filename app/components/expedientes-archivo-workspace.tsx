"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bot,
  Briefcase,
  Eye,
  FileText,
  Grid3x3,
  List,
  Lock,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  Table2,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import {
  ARCHIVO_AMBIENTES,
  ARCHIVO_COLORES,
  CONTENEDOR_TIPOS,
  CONTENEDOR_TIPO_LABELS,
} from "@/lib/expedientes-archivo";
import { maxPdfSizeBytes, maxPdfSizeLabel } from "@/lib/upload-limits";
import type {
  AdvancedFilters,
  ChatAnswer,
  ExpedienteItem,
  SearchMode,
  SearchResult,
  SortBy,
  SortDir,
  StatusFilter,
  SubirForm,
  ViewMode,
  WizardStep,
} from "./expedientes-archivo/types";
import { ChatPanel } from "./expedientes-archivo/chat-panel";
import { CommandPalette } from "./expedientes-archivo/command-palette";
import { TablaExpedientes } from "./expedientes-archivo/tabla-expedientes";
import { TarjetasExpedientes } from "./expedientes-archivo/tarjetas-expedientes";
import { BulkMoveModal } from "./expedientes-archivo/bulk-move-modal";
import { ReplaceFileModal } from "./expedientes-archivo/replace-file-modal";
import {
  chatWithExpedientes,
  loadExpedientes as loadExpedientesAction,
  searchExpedientes,
} from "@/lib/expedientes-archivo-actions";

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function statusLabel(status: ExpedienteItem["status"]) {
  return { error: "Error", indexed: "Indexado", processing: "Procesando", uploaded: "Subido" }[status];
}

const EMPTY_FORM: SubirForm = {
  title: "",
  sgdExpediente: "",
  serieDocumento: "",
  tipoDocumento: "",
  tipoDocumentoCustom: "",
  anio: "",
  folio: "",
  oficina: "",
  materia: "",
  asunto: "",
  resumen: "",
  observaciones: "",
  personaTipo: "",
  personaDocumento: "",
  personaNombre: "",
  tipoAlmacenamiento: "",
  nroArchivador: "",
  nroPaquete: "",
  empastado: "",
  colorArchivador: "",
  nroEstante: "",
  nroPiso: "",
  nroLocal: "",
};

export function ExpedientesArchivoWorkspace({ canManage }: { canManage: boolean }) {
  // ── Tabs principales ──────────────────────────────────────────────
  const [tab, setTab] = useState<"buscar" | "subir">("buscar");

  // ── Estado de la pestaña "Buscar" ──────────────────────────────────
  const [mode, setMode] = useState<SearchMode>("buscar");
  const [query, setQuery] = useState("");
  const [filterAnio, setFilterAnio] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [answer, setAnswer] = useState<ChatAnswer | null>(null);
  const [searchMessage, setSearchMessage] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<
    { role: "user" | "ai"; text: string; sources?: SearchResult[] }[]
  >([]);

  // ── Estado de la lista de expedientes ─────────────────────────────
  const [expedientes, setExpedientes] = useState<ExpedienteItem[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("lista");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todos");
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilters>({
    oficina: "",
    estante: "",
    tipoDocumento: "",
  });
  const [sortBy, setSortBy] = useState<SortBy>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchInput, setSearchInput] = useState("");

  // ── Estado del wizard de subida ────────────────────────────────────
  const [form, setForm] = useState<SubirForm>(EMPTY_FORM);
  const [file, setFile] = useState<File | null>(null);
  const [wizardStep, setWizardStep] = useState<WizardStep>(0);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [reindexingId, setReindexingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // ── Modales y slide-overs ──────────────────────────────────────────
  const [bulkOpen, setBulkOpen] = useState(false);
  const [replaceExp, setReplaceExp] = useState<ExpedienteItem | null>(null);
  const [openExp, setOpenExp] = useState<ExpedienteItem | null>(null);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  // ── Carga inicial y polling ────────────────────────────────────────
  const loadExpedientes = useCallback(async () => {
    try {
      const data = await loadExpedientesAction();
      setExpedientes((data as ExpedienteItem[]) ?? []);
    } catch {
      // Silenciar: el estado vacío se muestra como "sin expedientes"
    } finally {
      setLoadingList(false);
    }
  }, []);

  const hasPending = useMemo(
    () => expedientes.some((exp) => exp.status === "uploaded" || exp.status === "processing"),
    [expedientes],
  );

  useEffect(() => {
    void loadExpedientes();
  }, [loadExpedientes]);

  useEffect(() => {
    if (!hasPending) return;
    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      if (attempts > 75) {
        clearInterval(timer);
        return;
      }
      void loadExpedientes();
    }, 4000);
    return () => clearInterval(timer);
  }, [hasPending, loadExpedientes]);

  // Auto-clear de mensajes de éxito
  useEffect(() => {
    if (!uploadMessage) return;
    if (/subido|eliminad|reindex/i.test(uploadMessage)) {
      const t = setTimeout(() => setUploadMessage(null), 5000);
      return () => clearTimeout(t);
    }
  }, [uploadMessage]);

  useEffect(() => {
    if (!searchMessage) return;
    const t = setTimeout(() => setSearchMessage(null), 5000);
    return () => clearTimeout(t);
  }, [searchMessage]);

  // ── Atajos de teclado ──────────────────────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const isTyping = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;

      // ⌘K / Ctrl+K → command palette
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCmdOpen((v) => !v);
        return;
      }

      // Ctrl+I → chat
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "i" && !isTyping) {
        e.preventDefault();
        setChatOpen(true);
        return;
      }

      // Ctrl+U → tab subir
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "u" && canManage && !isTyping) {
        e.preventDefault();
        setTab("subir");
        return;
      }

      // Ctrl+B → tab buscar
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b" && !isTyping) {
        e.preventDefault();
        setTab("buscar");
        return;
      }

      // Ctrl+→ / Ctrl+← → wizard steps
      if ((e.metaKey || e.ctrlKey) && tab === "subir" && canManage) {
        if (e.key === "ArrowRight") {
          e.preventDefault();
          setWizardStep((s) => (Math.min(3, s + 1) as WizardStep));
        } else if (e.key === "ArrowLeft") {
          e.preventDefault();
          setWizardStep((s) => (Math.max(0, s - 1) as WizardStep));
        }
      }

      // "/" → enfocar buscador
      if (e.key === "/" && !isTyping) {
        e.preventDefault();
        const input = document.getElementById("expedientes-search") as HTMLInputElement | null;
        input?.focus();
        return;
      }

      // "?" → ayuda
      if (e.key === "?" && !isTyping) {
        e.preventDefault();
        setHelpOpen((v) => !v);
        return;
      }

      // Escape
      if (e.key === "Escape") {
        if (cmdOpen) setCmdOpen(false);
        else if (chatOpen) setChatOpen(false);
        else if (openExp) setOpenExp(null);
        else if (bulkOpen) setBulkOpen(false);
        else if (replaceExp) setReplaceExp(null);
        else if (helpOpen) setHelpOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tab, canManage, cmdOpen, chatOpen, openExp, bulkOpen, replaceExp, helpOpen]);

  // ── Helpers de form ────────────────────────────────────────────────
  function setField<K extends keyof SubirForm>(key: K, value: SubirForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  // ── Búsqueda ───────────────────────────────────────────────────────
  async function runSearch(event?: React.FormEvent) {
    event?.preventDefault();
    if (query.trim().length < 2) {
      setSearchMessage("Escribe al menos 2 caracteres.");
      return;
    }
    setSearching(true);
    setSearchMessage(null);
    setResults(null);
    setAnswer(null);
    try {
      if (mode === "buscar") {
        const anio = filterAnio ? Number.parseInt(filterAnio, 10) : undefined;
        const data = await searchExpedientes(query.trim(), anio);
        setResults(data.results);
        if (data.results.length === 0) {
          setSearchMessage("Sin resultados en la biblioteca de expedientes.");
        }
      } else if (mode === "preguntar") {
        const data = await chatWithExpedientes(query.trim());
        setAnswer(data);
        setChatMessages((prev) => [
          ...prev,
          { role: "user", text: query.trim() },
          { role: "ai", text: data.answer, sources: data.sources },
        ]);
      }
    } catch (err) {
      setSearchMessage(err instanceof Error ? err.message : "No se pudo consultar.");
    } finally {
      setSearching(false);
    }
  }

  async function askInChat(text: string) {
    setChatMessages((prev) => [...prev, { role: "user", text }]);
    setSearching(true);
    try {
      const data = await chatWithExpedientes(text);
      setChatMessages((prev) => [
        ...prev,
        { role: "ai", text: data.answer, sources: data.sources },
      ]);
    } catch (err) {
      setChatMessages((prev) => [
        ...prev,
        { role: "ai", text: err instanceof Error ? err.message : "Error al consultar." },
      ]);
    } finally {
      setSearching(false);
    }
  }

  // ── Subida ─────────────────────────────────────────────────────────
  async function uploadExpediente(event: React.FormEvent) {
    event.preventDefault();
    if (!file) {
      setUploadMessage("Selecciona un archivo PDF antes de subir.");
      return;
    }
    if (file.size > maxPdfSizeBytes) {
      setUploadMessage(`El PDF supera el limite de ${maxPdfSizeLabel}.`);
      return;
    }
    const formData = new FormData();
    formData.append("file", file);
    for (const [key, value] of Object.entries(form)) {
      if (value !== "" && value !== null && value !== undefined) {
        formData.append(key, String(value));
      }
    }
    setUploading(true);
    setUploadMessage("Subiendo PDF...");
    try {
      const res = await fetch("/api/expedientes-archivo", {
        method: "POST",
        body: formData,
      });
      const payload = await res.json();
      if (!res.ok) {
        setUploadMessage(payload.error ?? "No se pudo subir el expediente");
        return;
      }
      setFile(null);
      setForm(EMPTY_FORM);
      setWizardStep(0);
      setUploadMessage("PDF subido. Procesando OCR e indexando...");
      await loadExpedientes();
    } catch {
      setUploadMessage("No se pudo conectar con el servidor.");
    } finally {
      setUploading(false);
    }
  }

  // ── Acciones individuales ──────────────────────────────────────────
  async function reindexExpediente(id: string) {
    setReindexingId(id);
    setUploadMessage("Reindexando expediente...");
    try {
      const res = await fetch(`/api/expedientes-archivo/${id}`, { method: "POST" });
      if (!res.ok) {
        const payload = await res.json();
        setUploadMessage(payload.error ?? "No se pudo reindexar");
        return;
      }
      setUploadMessage("Reindexado iniciado en segundo plano...");
      await loadExpedientes();
    } catch {
      setUploadMessage("No se pudo conectar con el servidor.");
    } finally {
      setReindexingId(null);
    }
  }

  async function deleteExpediente(exp: ExpedienteItem) {
    if (!confirm(`¿Eliminar "${exp.title}"? Esta acción no se puede deshacer.`)) return;
    setDeletingId(exp.id);
    setUploadMessage("Eliminando expediente...");
    try {
      const res = await fetch(`/api/expedientes-archivo/${exp.id}`, { method: "DELETE" });
      if (!res.ok) {
        const payload = await res.json();
        setUploadMessage(payload.error ?? "No se pudo eliminar");
        return;
      }
      setUploadMessage("Expediente eliminado.");
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(exp.id);
        return next;
      });
      await loadExpedientes();
    } catch {
      setUploadMessage("No se pudo conectar con el servidor.");
    } finally {
      setDeletingId(null);
    }
  }

  async function replaceExpedienteFile(file: File) {
    if (!replaceExp) return;
    const formData = new FormData();
    formData.append("file", file);
    setUploadMessage("Reemplazando PDF y reindexando...");
    try {
      const res = await fetch(`/api/expedientes-archivo/${replaceExp.id}`, {
        method: "PUT",
        body: formData,
      });
      if (!res.ok) {
        const payload = await res.json();
        setUploadMessage(payload.error ?? "No se pudo reemplazar");
        return;
      }
      setUploadMessage("PDF reemplazado. Reprocesando...");
      setReplaceExp(null);
      await loadExpedientes();
    } catch {
      setUploadMessage("No se pudo conectar con el servidor.");
    }
  }

  // ── Bulk operations ────────────────────────────────────────────────
  async function applyBulkUpdate(updates: Record<string, unknown>) {
    if (selectedIds.size === 0) return;
    try {
      const res = await fetch("/api/expedientes-archivo/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [...selectedIds], action: "update", updates }),
      });
      if (!res.ok) {
        const payload = await res.json();
        setUploadMessage(payload.error ?? "No se pudo aplicar la operación");
        return;
      }
      setUploadMessage(`Actualización masiva aplicada a ${selectedIds.size} expediente(s).`);
      setSelectedIds(new Set());
      setBulkOpen(false);
      await loadExpedientes();
    } catch {
      setUploadMessage("No se pudo conectar con el servidor.");
    }
  }

  // ── Filtros y ordenamiento ─────────────────────────────────────────
  const filteredExps = useMemo(() => {
    let list = [...expedientes];
    if (statusFilter !== "todos") {
      if (statusFilter === "pendientes") {
        list = list.filter((e) => e.status === "uploaded" || e.status === "processing");
      } else if (statusFilter === "indexados") {
        list = list.filter((e) => e.status === "indexed");
      } else if (statusFilter === "error") {
        list = list.filter((e) => e.status === "error");
      }
    }
    if (advancedFilters.oficina) {
      const q = advancedFilters.oficina.toLowerCase();
      list = list.filter((e) => (e.oficina ?? "").toLowerCase().includes(q));
    }
    if (advancedFilters.estante) {
      list = list.filter((e) => e.nro_estante === advancedFilters.estante);
    }
    if (advancedFilters.tipoDocumento) {
      list = list.filter((e) => e.tipo_documento === advancedFilters.tipoDocumento);
    }
    if (searchInput.trim()) {
      const q = searchInput.toLowerCase();
      list = list.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          (e.materia ?? "").toLowerCase().includes(q) ||
          (e.asunto ?? "").toLowerCase().includes(q) ||
          (e.serie_documento ?? "").toLowerCase().includes(q) ||
          (e.oficina ?? "").toLowerCase().includes(q),
      );
    }
    list.sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      const av = (a[sortBy] ?? "") as string | number;
      const bv = (b[sortBy] ?? "") as string | number;
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
    return list;
  }, [expedientes, statusFilter, advancedFilters, searchInput, sortBy, sortDir]);

  const stats = useMemo(() => {
    const total = expedientes.length;
    const indexed = expedientes.filter((e) => e.status === "indexed").length;
    const pending = expedientes.filter((e) => e.status === "uploaded" || e.status === "processing").length;
    const error = expedientes.filter((e) => e.status === "error").length;
    const totalBytes = expedientes.reduce((s, e) => s + (e.file_size ?? 0), 0);
    const yearMap = new Map<number, number>();
    expedientes.forEach((e) => {
      if (e.anio) yearMap.set(e.anio, (yearMap.get(e.anio) ?? 0) + 1);
    });
    const topYears = [...yearMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([year, count]) => ({ year, count }));
    const tipoMap = new Map<string, number>();
    expedientes.forEach((e) => {
      if (e.tipo_documento) tipoMap.set(e.tipo_documento, (tipoMap.get(e.tipo_documento) ?? 0) + 1);
    });
    const topTipos = [...tipoMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([tipo, count]) => ({ tipo, count }));
    return { total, indexed, pending, error, totalBytes, topYears, topTipos };
  }, [expedientes]);

  function handleSort(col: string) {
    if (sortBy === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(col as SortBy);
      setSortDir("desc");
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelectedIds((prev) => {
      if (filteredExps.every((e) => prev.has(e.id))) return new Set();
      return new Set(filteredExps.map((e) => e.id));
    });
  }

  // ── Drag & drop ───────────────────────────────────────────────────
  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }
  function onDragLeave() {
    setIsDragging(false);
  }
  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (!f) return;
    if (f.type !== "application/pdf") {
      setUploadMessage("Solo se permiten archivos PDF");
      return;
    }
    if (f.size > maxPdfSizeBytes) {
      setUploadMessage(`El PDF supera el limite de ${maxPdfSizeLabel}`);
      return;
    }
    setUploadMessage(null);
    setFile(f);
  }

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div className="uploadPanel" id="expedientes-archivo">
      {/* Header con tabs */}
      <div className="panelHeader">
        <div>
          <p className="eyebrow">Biblioteca de expedientes archivados</p>
          <h2>Busca el contenido y localiza dónde está el expediente físico</h2>
        </div>
        <Briefcase size={22} />
      </div>

      <div className="subirTabBar" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "buscar"}
          className={tab === "buscar" ? "subirTab active" : "subirTab"}
          onClick={() => setTab("buscar")}
        >
          <Search size={15} /> Buscar
        </button>
        {canManage ? (
          <button
            type="button"
            role="tab"
            aria-selected={tab === "subir"}
            className={tab === "subir" ? "subirTab active" : "subirTab"}
            onClick={() => setTab("subir")}
          >
            <UploadCloud size={15} /> Subir
          </button>
        ) : null}
        <button
          type="button"
          className="subirTabHelp"
          onClick={() => setHelpOpen(true)}
          title="Atajos de teclado (?)"
        >
          <kbd>?</kbd>
        </button>
      </div>

      {/* ── Tab: Buscar ─────────────────────────────────────────── */}
      {tab === "buscar" ? (
        <>
          <form className="documentForm" onSubmit={runSearch}>
            <div className="styleSelectors">
              <div className="styleSelectorGroup">
                <span className="styleSelectorsTitle">Modo</span>
                <div className="pillGroup">
                  <button
                    type="button"
                    className={mode === "buscar" ? "pill active" : "pill"}
                    onClick={() => setMode("buscar")}
                    aria-pressed={mode === "buscar"}
                  >
                    <Search size={15} /> Buscar
                  </button>
                  <button
                    type="button"
                    className={mode === "preguntar" ? "pill active" : "pill"}
                    onClick={() => setMode("preguntar")}
                    aria-pressed={mode === "preguntar"}
                  >
                    <Bot size={15} /> Preguntar a la IA
                  </button>
                </div>
              </div>
            </div>

            <div className="formGrid">
              <label className="fullSpan">
                <span>{mode === "buscar" ? "Buscar en el contenido" : "Pregunta en lenguaje natural"}</span>
                <input
                  id="expedientes-search"
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={
                    mode === "buscar"
                      ? "Ej. número 2024-0345, licencia de funcionamiento, predio..."
                      : "Ej. ¿Dónde está el expediente de la licencia 2024-0345?"
                  }
                  value={query}
                />
              </label>
              <label>
                <span>Año (opcional)</span>
                <input
                  onChange={(event) => setFilterAnio(event.target.value)}
                  placeholder="Ej. 2024"
                  type="number"
                  value={filterAnio}
                />
              </label>
            </div>

            <div className="formActions">
              <button className="primaryButton" disabled={searching} type="submit">
                {mode === "buscar" ? <Search size={17} /> : <Bot size={17} />}
                {searching ? "Consultando..." : mode === "buscar" ? "Buscar" : "Preguntar"}
              </button>
            </div>
            {searchMessage ? <p className="formMessage">{searchMessage}</p> : null}
          </form>

          {answer ? (
            <section className="archivoAnswer">
              <div className="documentSectionTitle">
                <div>
                  <strong>Respuesta</strong>
                  <span>Fundamentada en los expedientes archivados. Las citas [E#] corresponden a las fuentes.</span>
                </div>
              </div>
              <p className="archivoAnswerText">{answer.answer}</p>
              {answer.sources.length > 0 ? (
                <div className="archivoSources">
                  {answer.sources.map((source, index) => (
                    <article className="documentItem" key={`${source.expedienteId}-${index}`}>
                      <div className="documentIcon">
                        <FileText size={18} />
                      </div>
                      <div>
                        <strong>
                          [E{index + 1}] {source.title}
                        </strong>
                        <span>{source.citation}</span>
                        <span className="expedienteUbicacion">
                          <MapPin size={13} /> {source.ubicacionResumen}
                        </span>
                        {source.excerpt ? <p>{source.excerpt}</p> : null}
                      </div>
                    </article>
                  ))}
                </div>
              ) : null}
            </section>
          ) : null}

          {results ? (
            <section className="archivoResults">
              <div className="documentSectionTitle">
                <div>
                  <strong>Resultados</strong>
                  <span>{results.length} coincidencia(s) en la biblioteca de expedientes</span>
                </div>
              </div>
              {results.length === 0 ? (
                <div className="emptyState">Sin resultados.</div>
              ) : (
                results.map((source, index) => (
                  <article className="documentItem" key={`${source.expedienteId}-${index}`}>
                    <div className="documentIcon">
                      <FileText size={18} />
                    </div>
                    <div>
                      <strong>{source.title}</strong>
                      <span className="expedienteUbicacion">
                        <MapPin size={13} /> {source.ubicacionResumen}
                      </span>
                      {source.asunto ? <span>Asunto: {source.asunto}</span> : null}
                      {source.excerpt ? <p>{source.excerpt}</p> : null}
                    </div>
                    <div className="documentActions">
                      <a
                        href={`/api/expedientes-archivo/${source.expedienteId}`}
                        target="_blank"
                        rel="noreferrer"
                        title="Abrir PDF"
                      >
                        <FileText size={16} />
                      </a>
                    </div>
                    {index === results.length - 1 ? null : null}
                  </article>
                ))
              )}
            </section>
          ) : null}

          {/* Dashboard de stats (visible si hay >= 5 expedientes) */}
          {stats.total >= 5 ? (
            <section className="expedientesStats">
              <div className="statCard">
                <span className="statLabel">Total</span>
                <strong>{stats.total}</strong>
              </div>
              <div className="statCard">
                <span className="statLabel">Indexados</span>
                <strong>{stats.indexed}</strong>
              </div>
              <div className="statCard">
                <span className="statLabel">Pendientes</span>
                <strong>{stats.pending}</strong>
              </div>
              <div className="statCard">
                <span className="statLabel">Con error</span>
                <strong>{stats.error}</strong>
              </div>
              <div className="statCard">
                <span className="statLabel">Tamaño total</span>
                <strong>{formatBytes(stats.totalBytes)}</strong>
              </div>
            </section>
          ) : null}

          {/* Lista / Tabla / Tarjetas */}
          <div className="expedientesListHeader">
            <div className="subirViewToggle" role="tablist" aria-label="Modo de vista">
              <button
                type="button"
                role="tab"
                aria-selected={viewMode === "lista"}
                className={viewMode === "lista" ? "active" : ""}
                onClick={() => setViewMode("lista")}
                title="Vista lista"
              >
                <List size={14} />
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={viewMode === "tabla"}
                className={viewMode === "tabla" ? "active" : ""}
                onClick={() => setViewMode("tabla")}
                title="Vista tabla"
              >
                <Table2 size={14} />
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={viewMode === "tarjetas"}
                className={viewMode === "tarjetas" ? "active" : ""}
                onClick={() => setViewMode("tarjetas")}
                title="Vista tarjetas"
              >
                <Grid3x3 size={14} />
              </button>
            </div>

            <input
              type="search"
              placeholder="Filtro rápido de la lista…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="expedientesListSearch"
            />

            <div className="pillGroup">
              {(["todos", "pendientes", "indexados", "error"] as StatusFilter[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  className={statusFilter === s ? "pill active" : "pill"}
                  onClick={() => setStatusFilter(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Filtros avanzados */}
          <div className="expedientesAdvancedFilters">
            <label>
              <span>Oficina</span>
              <input
                value={advancedFilters.oficina}
                onChange={(e) =>
                  setAdvancedFilters((f) => ({ ...f, oficina: e.target.value }))
                }
                placeholder="Filtrar por oficina"
              />
            </label>
            <label>
              <span>Estante</span>
              <input
                value={advancedFilters.estante}
                onChange={(e) =>
                  setAdvancedFilters((f) => ({ ...f, estante: e.target.value }))
                }
                placeholder="Nº estante"
              />
            </label>
            <label>
              <span>Tipo doc.</span>
              <input
                value={advancedFilters.tipoDocumento}
                onChange={(e) =>
                  setAdvancedFilters((f) => ({ ...f, tipoDocumento: e.target.value }))
                }
                placeholder="Resolución, Oficio..."
              />
            </label>
            <button
              type="button"
              className="subirGhostBtn"
              onClick={() =>
                setAdvancedFilters({ oficina: "", estante: "", tipoDocumento: "" })
              }
            >
              <X size={14} /> Limpiar
            </button>
          </div>

          {/* Acciones bulk */}
          {canManage && selectedIds.size > 0 ? (
            <div className="expedientesBulkBar">
              <span>
                {selectedIds.size} seleccionado{selectedIds.size === 1 ? "" : "s"}
              </span>
              <button
                type="button"
                className="subirGhostBtn"
                onClick={() => setSelectedIds(new Set())}
              >
                <X size={14} /> Limpiar
              </button>
              <button
                type="button"
                className="primaryButton"
                onClick={() => setBulkOpen(true)}
              >
                Mover / reasignar
              </button>
            </div>
          ) : null}

          {loadingList ? (
            <div className="emptyState">Cargando expedientes…</div>
          ) : filteredExps.length === 0 ? (
            <div className="emptyState">
              {expedientes.length === 0
                ? "Aún no hay expedientes en el archivo."
                : "No hay expedientes que coincidan con los filtros aplicados."}
            </div>
          ) : viewMode === "tabla" ? (
            <TablaExpedientes
              exps={filteredExps}
              canManage={canManage}
              selectedIds={selectedIds}
              onToggle={toggleSelect}
              onSelectAll={toggleSelectAll}
              onOpen={setOpenExp}
              onDelete={deleteExpediente}
              onDownload={(exp) => window.open(`/api/expedientes-archivo/${exp.id}`, "_blank")}
              onReplace={setReplaceExp}
              sortBy={sortBy}
              sortDir={sortDir}
              onSort={handleSort}
              reindexingId={reindexingId}
              deletingId={deletingId}
              reindex={reindexExpediente}
              formatBytes={formatBytes}
              statusLabel={statusLabel}
            />
          ) : viewMode === "tarjetas" ? (
            <TarjetasExpedientes
              exps={filteredExps}
              onOpen={setOpenExp}
              formatBytes={formatBytes}
              statusLabel={statusLabel}
            />
          ) : (
            <div className="documentList">
              {filteredExps.map((exp) => (
                <article className="documentItem" key={exp.id}>
                  <div className="documentIcon">
                    <FileText size={18} />
                  </div>
                  <div>
                    <strong>{exp.title}</strong>
                    <span>
                      {exp.serie_documento ? `N° ${exp.serie_documento}` : "Sin número"}
                      {exp.materia ? ` · ${exp.materia}` : ""}
                      {exp.anio ? ` · ${exp.anio}` : ""} · {formatBytes(exp.file_size)}
                    </span>
                    <span className="expedienteUbicacion">
                      <MapPin size={13} />
                      {[
                        exp.nro_estante && `E${exp.nro_estante}`,
                        exp.nro_piso && `P${exp.nro_piso}`,
                        exp.nro_local,
                      ]
                        .filter(Boolean)
                        .join(" / ") || "Sin ubicación"}
                    </span>
                    {exp.asunto ? <span>Asunto: {exp.asunto}</span> : null}
                    {exp.metadata?.chunkCount ? (
                      <span>
                        {exp.metadata.pageCount ?? 0} páginas · {exp.metadata.chunkCount} fragmentos
                      </span>
                    ) : null}
                    {exp.error_message ? (
                      <span className="documentError">{exp.error_message}</span>
                    ) : null}
                  </div>
                  <div className="documentActions">
                    <small data-status={exp.status}>{statusLabel(exp.status)}</small>
                    <button
                      type="button"
                      onClick={() => setOpenExp(exp)}
                      title="Ver detalle"
                    >
                      <Eye size={16} />
                    </button>
                    <a
                      href={`/api/expedientes-archivo/${exp.id}`}
                      target="_blank"
                      rel="noreferrer"
                      title="Abrir PDF"
                    >
                      <FileText size={16} />
                    </a>
                    {canManage ? (
                      <>
                        <button
                          disabled={reindexingId === exp.id || deletingId === exp.id}
                          onClick={() => void reindexExpediente(exp.id)}
                          title="Reindexar"
                          type="button"
                        >
                          <RefreshCw size={16} />
                        </button>
                        <button
                          disabled={deletingId === exp.id}
                          onClick={() => void deleteExpediente(exp)}
                          title="Eliminar"
                          type="button"
                        >
                          <Trash2 size={16} />
                        </button>
                      </>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      ) : null}

      {/* ── Tab: Subir (wizard 4 pasos) ─────────────────────────── */}
      {tab === "subir" && canManage ? (
        <form className="documentForm" onSubmit={uploadExpediente}>
          <div className="subirWizardStepper" role="tablist" aria-label="Pasos del wizard">
            {(["Documento", "Contenido", "Persona", "Ubicación"] as const).map((label, idx) => (
              <button
                key={label}
                type="button"
                role="tab"
                aria-selected={wizardStep === idx}
                className={wizardStep === idx ? "active" : wizardStep > idx ? "done" : ""}
                onClick={() => setWizardStep(idx as WizardStep)}
              >
                {idx + 1}. {label}
              </button>
            ))}
          </div>

          {/* Paso 0: Documento */}
          {wizardStep === 0 ? (
            <>
              <label
                className={`filePicker ${isDragging ? "dragging" : ""}`}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
              >
                <UploadCloud size={28} />
                <strong>
                  {file ? `${file.name} · ${formatBytes(file.size)}` : "Selecciona un PDF (puede ser escaneado)"}
                </strong>
                <span>Expedientes y documentos terminados. Máximo {maxPdfSizeLabel}.</span>
                <input
                  accept="application/pdf"
                  onChange={(event) => {
                    const selected = event.target.files?.[0] ?? null;
                    if (selected && selected.size > maxPdfSizeBytes) {
                      setFile(null);
                      setUploadMessage(`El PDF supera el limite de ${maxPdfSizeLabel}.`);
                      event.target.value = "";
                      return;
                    }
                    setUploadMessage(null);
                    setFile(selected);
                  }}
                  type="file"
                />
              </label>

              <div className="formGrid">
                <label>
                  <span>SGD de expediente</span>
                  <input
                    value={form.sgdExpediente}
                    onChange={(e) => setField("sgdExpediente", e.target.value)}
                    placeholder="Ej. 2024-001234"
                  />
                </label>
                <label>
                  <span>Serie documental</span>
                  <input
                    value={form.serieDocumento}
                    onChange={(e) => setField("serieDocumento", e.target.value)}
                    placeholder="Resolución, Oficio, Informe..."
                  />
                </label>
                <label>
                  <span>Tipo de documento</span>
                  <select
                    value={form.tipoDocumento}
                    onChange={(e) => setField("tipoDocumento", e.target.value)}
                  >
                    <option value="">— Selecciona —</option>
                    <option value="Resolución">Resolución</option>
                    <option value="Oficio">Oficio</option>
                    <option value="Decreto">Decreto</option>
                    <option value="Ordenanza">Ordenanza</option>
                    <option value="Informe">Informe</option>
                    <option value="Memorando">Memorando</option>
                    <option value="Carta">Carta</option>
                    <option value="otro">Otro...</option>
                  </select>
                </label>
                {form.tipoDocumento === "otro" ? (
                  <label>
                    <span>Especificar tipo</span>
                    <input
                      value={form.tipoDocumentoCustom}
                      onChange={(e) => setField("tipoDocumentoCustom", e.target.value)}
                      placeholder="Escribe el tipo"
                    />
                  </label>
                ) : null}
                <label>
                  <span>Año</span>
                  <input
                    type="number"
                    value={form.anio}
                    onChange={(e) => setField("anio", e.target.value)}
                    placeholder="2024"
                  />
                </label>
                <label>
                  <span>Folio</span>
                  <input
                    value={form.folio}
                    onChange={(e) => setField("folio", e.target.value)}
                    placeholder="Nº de folio inicial"
                  />
                </label>
                <label>
                  <span>Oficina</span>
                  <input
                    value={form.oficina}
                    onChange={(e) => setField("oficina", e.target.value)}
                    placeholder="Subgerencia, área..."
                  />
                </label>
                <label className="fullSpan">
                  <span>Título</span>
                  <input
                    value={form.title}
                    onChange={(e) => setField("title", e.target.value)}
                    placeholder="Si lo dejas vacío se usa el nombre del archivo"
                  />
                </label>
              </div>
            </>
          ) : null}

          {/* Paso 1: Contenido */}
          {wizardStep === 1 ? (
            <div className="formGrid">
              <label>
                <span>Materia</span>
                <input
                  value={form.materia}
                  onChange={(e) => setField("materia", e.target.value)}
                  placeholder="Contratación, personal, presupuesto..."
                />
              </label>
              <label>
                <span>Asunto</span>
                <input
                  value={form.asunto}
                  onChange={(e) => setField("asunto", e.target.value)}
                  placeholder="Asunto o sumilla"
                />
              </label>
              <label className="fullSpan">
                <span>Resumen</span>
                <textarea
                  rows={3}
                  value={form.resumen}
                  onChange={(e) => setField("resumen", e.target.value)}
                  placeholder="Resumen ejecutivo (3-5 líneas)"
                />
              </label>
              <label className="fullSpan">
                <span>Observaciones</span>
                <textarea
                  rows={2}
                  value={form.observaciones}
                  onChange={(e) => setField("observaciones", e.target.value)}
                />
              </label>
            </div>
          ) : null}

          {/* Paso 2: Persona */}
          {wizardStep === 2 ? (
            <div className="formGrid">
              <label>
                <span>Tipo de persona</span>
                <select
                  value={form.personaTipo}
                  onChange={(e) => setField("personaTipo", e.target.value as SubirForm["personaTipo"])}
                >
                  <option value="">— Sin persona —</option>
                  <option value="natural">Persona natural</option>
                  <option value="juridica">Persona jurídica</option>
                </select>
              </label>
              <label>
                <span>Documento</span>
                <input
                  value={form.personaDocumento}
                  onChange={(e) => setField("personaDocumento", e.target.value)}
                  placeholder="DNI o RUC"
                />
              </label>
              <label className="fullSpan">
                <span>Nombre</span>
                <input
                  value={form.personaNombre}
                  onChange={(e) => setField("personaNombre", e.target.value)}
                  placeholder="Razón social o nombre completo"
                />
              </label>
            </div>
          ) : null}

          {/* Paso 3: Ubicación */}
          {wizardStep === 3 ? (
            <>
              <div className="documentSectionTitle">
                <div>
                  <strong>Ubicación física</strong>
                  <span>Dónde se encuentra el expediente en papel (catálogo fijo).</span>
                </div>
              </div>
              <div className="formGrid">
                <label>
                  <span>Tipo de contenedor</span>
                  <select
                    value={form.tipoAlmacenamiento}
                    onChange={(e) => setField("tipoAlmacenamiento", e.target.value)}
                  >
                    <option value="">— Sin contenedor —</option>
                    {CONTENEDOR_TIPOS.map((tipo) => (
                      <option key={tipo} value={tipo}>
                        {CONTENEDOR_TIPO_LABELS[tipo]}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Nº de archivador</span>
                  <input
                    value={form.nroArchivador}
                    onChange={(e) => setField("nroArchivador", e.target.value)}
                    placeholder="Ej. 12"
                  />
                </label>
                <label>
                  <span>Nº de paquete</span>
                  <input
                    value={form.nroPaquete}
                    onChange={(e) => setField("nroPaquete", e.target.value)}
                    placeholder="Opcional"
                  />
                </label>
                <label>
                  <span>Empastado</span>
                  <select
                    value={form.empastado}
                    onChange={(e) => setField("empastado", e.target.value)}
                  >
                    <option value="">— Sin definir —</option>
                    <option value="si">Sí</option>
                    <option value="no">No</option>
                  </select>
                </label>
                <label>
                  <span>Color</span>
                  <select
                    value={form.colorArchivador}
                    onChange={(e) => setField("colorArchivador", e.target.value)}
                  >
                    <option value="">— Sin color —</option>
                    {ARCHIVO_COLORES.map((color) => (
                      <option key={color} value={color}>
                        {color}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Estante</span>
                  <input
                    value={form.nroEstante}
                    onChange={(e) => setField("nroEstante", e.target.value)}
                    placeholder="Ej. 3"
                  />
                </label>
                <label>
                  <span>Piso</span>
                  <input
                    value={form.nroPiso}
                    onChange={(e) => setField("nroPiso", e.target.value)}
                    placeholder="Ej. 2"
                  />
                </label>
                <label>
                  <span>Local / ambiente</span>
                  <select
                    value={form.nroLocal}
                    onChange={(e) => setField("nroLocal", e.target.value)}
                  >
                    <option value="">— Sin ambiente —</option>
                    {ARCHIVO_AMBIENTES.map((amb) => (
                      <option key={amb} value={amb}>
                        {amb}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </>
          ) : null}

          <div className="formActions">
            {wizardStep > 0 ? (
              <button
                type="button"
                className="subirGhostBtn"
                onClick={() => setWizardStep((s) => (s - 1) as WizardStep)}
              >
                ← Anterior
              </button>
            ) : null}
            {wizardStep < 3 ? (
              <button
                type="button"
                className="primaryButton"
                onClick={() => setWizardStep((s) => (s + 1) as WizardStep)}
              >
                Siguiente →
              </button>
            ) : (
              <button className="primaryButton" disabled={uploading} type="submit">
                <UploadCloud size={18} /> {uploading ? "Subiendo..." : "Subir al archivo"}
              </button>
            )}
          </div>
          {uploadMessage ? <p className="formMessage">{uploadMessage}</p> : null}
        </form>
      ) : tab === "subir" && !canManage ? (
        <div className="emptyState">
          <Lock size={20} />
          <p>
            La carga y gestión de expedientes requiere rol DEC/Editor o administrador. Puedes buscar
            y consultar todos los expedientes indexados.
          </p>
        </div>
      ) : null}

      {/* ── Modales y slide-overs ─────────────────────────────────── */}
      {openExp ? (
        <div className="subirSlideOverOverlay" onClick={() => setOpenExp(null)}>
          <aside
            className="subirSlideOver"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="Detalle del expediente"
          >
            <header className="subirSlideOverHead">
              <div>
                <strong>{openExp.title}</strong>
                <span>
                  {openExp.serie_documento ?? "Sin número"} · {openExp.anio ?? "s/f"}
                </span>
              </div>
              <button
                type="button"
                className="subirSlideOverClose"
                onClick={() => setOpenExp(null)}
                aria-label="Cerrar"
              >
                <X size={18} />
              </button>
            </header>
            <div className="subirSlideOverBody">
              <iframe
                title="Vista previa"
                src={`/api/expedientes-archivo/${openExp.id}`}
                style={{ width: "100%", height: "70vh", border: 0 }}
              />
              {canManage ? (
                <div className="subirSlideOverActions">
                  <button
                    type="button"
                    className="subirGhostBtn"
                    onClick={() => {
                      setReplaceExp(openExp);
                      setOpenExp(null);
                    }}
                  >
                    Reemplazar PDF
                  </button>
                </div>
              ) : null}
            </div>
          </aside>
        </div>
      ) : null}

      {replaceExp ? (
        <ReplaceFileModal
          exp={replaceExp}
          onClose={() => setReplaceExp(null)}
          onApply={(f) => void replaceExpedienteFile(f)}
        />
      ) : null}

      {bulkOpen ? (
        <BulkMoveModal
          count={selectedIds.size}
          onClose={() => setBulkOpen(false)}
          onApply={(updates) => void applyBulkUpdate(updates)}
        />
      ) : null}

      {chatOpen ? (
        <ChatPanel
          query={query}
          onClose={() => setChatOpen(false)}
          onAsk={askInChat}
          searching={searching}
          messages={chatMessages}
          onOpenExpediente={(id) => {
            const exp = expedientes.find((e) => e.id === id);
            if (exp) setOpenExp(exp);
          }}
        />
      ) : null}

      {cmdOpen ? (
        <CommandPalette
          open={cmdOpen}
          onClose={() => setCmdOpen(false)}
          expedientes={expedientes}
          onOpenExpediente={(exp) => {
            setCmdOpen(false);
            setOpenExp(exp);
          }}
          onGoToSubir={() => canManage && setTab("subir")}
          onShowHelp={() => {
            setCmdOpen(false);
            setHelpOpen(true);
          }}
          onOpenChat={() => {
            setCmdOpen(false);
            setChatOpen(true);
          }}
        />
      ) : null}

      {helpOpen ? (
        <div className="subirSlideOverOverlay" onClick={() => setHelpOpen(false)}>
          <aside
            className="subirSlideOver subirSlideOverModal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="Atajos de teclado"
          >
            <header className="subirSlideOverHead">
              <div>
                <strong>Atajos de teclado</strong>
                <span>Navega más rápido por la biblioteca</span>
              </div>
              <button
                type="button"
                className="subirSlideOverClose"
                onClick={() => setHelpOpen(false)}
                aria-label="Cerrar"
              >
                <X size={18} />
              </button>
            </header>
            <div className="subirSlideOverBody">
              <table className="subirHelpTable">
                <tbody>
                  <tr><td><kbd>⌘</kbd>+<kbd>K</kbd></td><td>Abrir paleta de comandos</td></tr>
                  <tr><td><kbd>Ctrl</kbd>+<kbd>I</kbd></td><td>Abrir chat con IA</td></tr>
                  <tr><td><kbd>Ctrl</kbd>+<kbd>U</kbd></td><td>Ir a pestaña Subir</td></tr>
                  <tr><td><kbd>Ctrl</kbd>+<kbd>B</kbd></td><td>Ir a pestaña Buscar</td></tr>
                  <tr><td><kbd>Ctrl</kbd>+<kbd>→</kbd></td><td>Siguiente paso del wizard</td></tr>
                  <tr><td><kbd>Ctrl</kbd>+<kbd>←</kbd></td><td>Paso anterior del wizard</td></tr>
                  <tr><td><kbd>/</kbd></td><td>Enfocar buscador de la lista</td></tr>
                  <tr><td><kbd>?</kbd></td><td>Mostrar/ocultar esta ayuda</td></tr>
                  <tr><td><kbd>Esc</kbd></td><td>Cerrar paneles/modales</td></tr>
                </tbody>
              </table>
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
