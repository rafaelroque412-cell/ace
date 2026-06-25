"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bot,
  Check,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Download,
  Eye,
  FileText,
  Filter,
  Grid3x3,
  HelpCircle,
  Info,
  List as ListIcon,
  Loader2,
  Lock,
  MapPin,
  MessageCircle,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Table2,
  Trash2,
  UploadCloud,
  X,
  AlertCircle,
  FileUp,
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
  return {
    error: "Con error",
    indexed: "Indexado",
    processing: "Procesando",
    uploaded: "Subido",
  }[status];
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

const WIZARD_STEPS = [
  { id: 0, label: "Documento", icon: FileText, hint: "Sube el PDF e identifica el documento" },
  { id: 1, label: "Contenido", icon: FileText, hint: "Describe el contenido del expediente" },
  { id: 2, label: "Persona", icon: FileText, hint: "Quién lo presenta o solicita" },
  { id: 3, label: "Ubicación", icon: MapPin, hint: "Dónde se encuentra en papel" },
] as const;

const STATUS_PILLS: { id: StatusFilter; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "pendientes", label: "Pendientes" },
  { id: "indexados", label: "Indexados" },
  { id: "error", label: "Con error" },
];

type Toast = {
  id: number;
  message: string;
  kind: "success" | "error" | "warning" | "info";
};

export function ExpedientesArchivoWorkspace({ canManage }: { canManage: boolean }) {
  const [tab, setTab] = useState<"buscar" | "subir">("buscar");

  // Búsqueda
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

  // Lista
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

  // Wizard de subida
  const [form, setForm] = useState<SubirForm>(EMPTY_FORM);
  const [file, setFile] = useState<File | null>(null);
  const [wizardStep, setWizardStep] = useState<WizardStep>(0);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [reindexingId, setReindexingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Modales
  const [bulkOpen, setBulkOpen] = useState(false);
  const [replaceExp, setReplaceExp] = useState<ExpedienteItem | null>(null);
  const [openExp, setOpenExp] = useState<ExpedienteItem | null>(null);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  // Toasts
  const [toasts, setToasts] = useState<Toast[]>([]);

  function showToast(message: string, kind: Toast["kind"] = "info") {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, kind }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }

  function dismissToast(id: number) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  // ── Carga inicial y polling ────────────────────────────────────────
  const loadExpedientes = useCallback(async () => {
    try {
      const data = await loadExpedientesAction();
      setExpedientes((data as ExpedienteItem[]) ?? []);
    } catch {
      // Silenciar
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

  // ── Atajos de teclado ──────────────────────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const isTyping =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCmdOpen((v) => !v);
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "i" && !isTyping) {
        e.preventDefault();
        setChatOpen(true);
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "u" && canManage && !isTyping) {
        e.preventDefault();
        setTab("subir");
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b" && !isTyping) {
        e.preventDefault();
        setTab("buscar");
        return;
      }
      if ((e.metaKey || e.ctrlKey) && tab === "subir" && canManage) {
        if (e.key === "ArrowRight") {
          e.preventDefault();
          setWizardStep((s) => (Math.min(3, s + 1) as WizardStep));
        } else if (e.key === "ArrowLeft") {
          e.preventDefault();
          setWizardStep((s) => (Math.max(0, s - 1) as WizardStep));
        }
      }
      if (e.key === "/" && !isTyping) {
        e.preventDefault();
        const input = document.getElementById("exp-search-input") as HTMLInputElement | null;
        input?.focus();
        return;
      }
      if (e.key === "?" && !isTyping) {
        e.preventDefault();
        setHelpOpen((v) => !v);
        return;
      }
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

  function canProceedStep(): { ok: boolean; reason?: string } {
    if (wizardStep === 0) {
      if (!file) return { ok: false, reason: "Selecciona un PDF para continuar" };
    }
    return { ok: true };
  }

  // ── Búsqueda ───────────────────────────────────────────────────────
  async function runSearch(event?: React.FormEvent) {
    event?.preventDefault();
    if (query.trim().length < 2) {
      setSearchMessage("Escribe al menos 2 caracteres para buscar.");
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
          setSearchMessage(
            "Sin resultados. Prueba con otros términos o sube el expediente si aún no está en el archivo.",
          );
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
      const msg = err instanceof Error ? err.message : "No se pudo consultar.";
      setSearchMessage(msg);
      showToast(msg, "error");
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
      const msg = err instanceof Error ? err.message : "Error al consultar.";
      setChatMessages((prev) => [
        ...prev,
        { role: "ai", text: msg },
      ]);
      showToast(msg, "error");
    } finally {
      setSearching(false);
    }
  }

  // ── Subida con progress ────────────────────────────────────────────
  async function uploadExpediente(event: React.FormEvent) {
    event.preventDefault();
    if (!file) {
      showToast("Selecciona un archivo PDF antes de subir.", "warning");
      return;
    }
    if (file.size > maxPdfSizeBytes) {
      showToast(`El PDF supera el límite de ${maxPdfSizeLabel}.`, "error");
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
    setUploadProgress(0);

    try {
      const xhr = new XMLHttpRequest();
      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) {
          setUploadProgress(Math.round((e.loaded / e.total) * 100));
        }
      });

      const result = await new Promise<{ ok: boolean; status: number; body: unknown }>(
        (resolve) => {
          xhr.addEventListener("load", () => {
            try {
              const body = xhr.responseText ? JSON.parse(xhr.responseText) : null;
              resolve({ ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status, body });
            } catch {
              resolve({ ok: false, status: xhr.status, body: null });
            }
          });
          xhr.addEventListener("error", () =>
            resolve({ ok: false, status: 0, body: null }),
          );
          xhr.open("POST", "/api/expedientes-archivo");
          xhr.send(formData);
        },
      );

      if (!result.ok) {
        const errorMsg =
          (result.body as { error?: string })?.error ?? "No se pudo subir el expediente";
        showToast(errorMsg, "error");
        setUploadMessage(errorMsg);
        return;
      }

      setFile(null);
      setForm(EMPTY_FORM);
      setWizardStep(0);
      setUploadMessage(null);
      setUploadProgress(0);
      showToast(
        "Expediente subido. Se está procesando con OCR e indexando en segundo plano.",
        "success",
      );
      await loadExpedientes();
    } catch (err) {
      showToast("No se pudo conectar con el servidor.", "error");
    } finally {
      setUploading(false);
    }
  }

  // ── Acciones individuales ──────────────────────────────────────────
  async function reindexExpediente(id: string) {
    setReindexingId(id);
    try {
      const res = await fetch(`/api/expedientes-archivo/${id}`, { method: "POST" });
      if (!res.ok) {
        const payload = await res.json();
        showToast(payload.error ?? "No se pudo reindexar", "error");
        return;
      }
      showToast("Reindexado iniciado en segundo plano.", "info");
      await loadExpedientes();
    } catch {
      showToast("No se pudo conectar con el servidor.", "error");
    } finally {
      setReindexingId(null);
    }
  }

  async function deleteExpediente(exp: ExpedienteItem) {
    if (
      !confirm(
        `¿Eliminar el expediente "${exp.title}"?\n\nEsta acción no se puede deshacer. El PDF y sus chunks también se eliminarán.`,
      )
    )
      return;
    setDeletingId(exp.id);
    try {
      const res = await fetch(`/api/expedientes-archivo/${exp.id}`, { method: "DELETE" });
      if (!res.ok) {
        const payload = await res.json();
        showToast(payload.error ?? "No se pudo eliminar", "error");
        return;
      }
      showToast(`Expediente "${exp.title}" eliminado.`, "success");
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(exp.id);
        return next;
      });
      await loadExpedientes();
    } catch {
      showToast("No se pudo conectar con el servidor.", "error");
    } finally {
      setDeletingId(null);
    }
  }

  async function replaceExpedienteFile(file: File) {
    if (!replaceExp) return;
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch(`/api/expedientes-archivo/${replaceExp.id}`, {
        method: "PUT",
        body: formData,
      });
      if (!res.ok) {
        const payload = await res.json();
        showToast(payload.error ?? "No se pudo reemplazar", "error");
        return;
      }
      showToast("PDF reemplazado. Se está reprocesando.", "success");
      setReplaceExp(null);
      await loadExpedientes();
    } catch {
      showToast("No se pudo conectar con el servidor.", "error");
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
        showToast(payload.error ?? "No se pudo aplicar la operación", "error");
        return;
      }
      showToast(
        `Operación aplicada a ${selectedIds.size} expediente${selectedIds.size === 1 ? "" : "s"}.`,
        "success",
      );
      setSelectedIds(new Set());
      setBulkOpen(false);
      await loadExpedientes();
    } catch {
      showToast("No se pudo conectar con el servidor.", "error");
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

  const statusCounts = useMemo(() => {
    return {
      todos: expedientes.length,
      pendientes: expedientes.filter(
        (e) => e.status === "uploaded" || e.status === "processing",
      ).length,
      indexados: expedientes.filter((e) => e.status === "indexed").length,
      error: expedientes.filter((e) => e.status === "error").length,
    };
  }, [expedientes]);

  const stats = useMemo(() => {
    const total = expedientes.length;
    const indexed = expedientes.filter((e) => e.status === "indexed").length;
    const pending = expedientes.filter(
      (e) => e.status === "uploaded" || e.status === "processing",
    ).length;
    const error = expedientes.filter((e) => e.status === "error").length;
    const totalBytes = expedientes.reduce((s, e) => s + (e.file_size ?? 0), 0);
    return { total, indexed, pending, error, totalBytes };
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
      showToast("Solo se permiten archivos PDF", "warning");
      return;
    }
    if (f.size > maxPdfSizeBytes) {
      showToast(`El PDF supera el límite de ${maxPdfSizeLabel}`, "error");
      return;
    }
    setFile(f);
    showToast("PDF cargado. Revisa los datos y haz clic en Siguiente.", "success");
  }

  function onFileSelect(f: File | null) {
    if (!f) return;
    if (f.type !== "application/pdf") {
      showToast("Solo se permiten archivos PDF", "warning");
      return;
    }
    if (f.size > maxPdfSizeBytes) {
      showToast(`El PDF supera el límite de ${maxPdfSizeLabel}`, "error");
      return;
    }
    setFile(f);
  }

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div className="expPanel" id="expedientes-archivo">
      {/* Header con icono y contexto */}
      <div className="expPanelHeader">
        <div className="expPanelHeaderText">
          <p className="expPanelHeaderEyebrow">
            <Sparkles size={12} /> Biblioteca de expedientes
          </p>
          <h2 className="expPanelHeaderTitle">
            Busca el contenido y localiza dónde está el expediente físico
          </h2>
          <p className="expPanelHeaderSubtitle">
            Usa el buscador para encontrar expedientes por contenido, o sube nuevos PDF con OCR automático.
          </p>
        </div>
        <div className="expPanelHeaderIcon" aria-hidden="true">
          <FileText size={20} />
        </div>
      </div>

      {/* Tabs */}
      <div className="expTabBar" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "buscar"}
          className={tab === "buscar" ? "expTab active" : "expTab"}
          onClick={() => setTab("buscar")}
        >
          <Search size={15} /> Buscar
        </button>
        {canManage ? (
          <button
            type="button"
            role="tab"
            aria-selected={tab === "subir"}
            className={tab === "subir" ? "expTab active" : "expTab"}
            onClick={() => setTab("subir")}
          >
            <UploadCloud size={15} /> Subir
            {hasPending ? (
              <span className="expTabBadge" aria-label="Procesando">
                {statusCounts.pendientes}
              </span>
            ) : null}
          </button>
        ) : null}
        <button
          type="button"
          className="expTabHelp"
          onClick={() => setHelpOpen(true)}
          aria-label="Ver atajos de teclado"
        >
          <HelpCircle size={14} /> <kbd>?</kbd> Atajos
        </button>
      </div>

      {/* ── Tab: Buscar ─────────────────────────────────────────── */}
      {tab === "buscar" ? (
        <div className="expTabContent">
          {/* Modo toggle */}
          <div className="expModeToggle" role="tablist" aria-label="Modo de búsqueda">
            <button
              type="button"
              role="tab"
              aria-selected={mode === "buscar"}
              className={mode === "buscar" ? "active" : ""}
              onClick={() => setMode("buscar")}
            >
              <Search size={14} /> Buscar por contenido
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "preguntar"}
              className={mode === "preguntar" ? "active" : ""}
              onClick={() => setMode("preguntar")}
            >
              <Bot size={14} /> Preguntar a la IA
            </button>
          </div>

          {/* Search bar */}
          <form onSubmit={runSearch} className="expSearchBar">
            <Search size={18} className="expSearchHint" />
            <input
              id="exp-search-input"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                mode === "buscar"
                  ? "Ej. licencia de funcionamiento, predio 2024, oficio 0345…"
                  : "Ej. ¿Dónde está el expediente de la licencia 2024-0345?"
              }
              className="expSearchInput"
              aria-label={mode === "buscar" ? "Buscar en el contenido" : "Preguntar a la IA"}
            />
            {mode === "buscar" ? (
              <input
                type="number"
                value={filterAnio}
                onChange={(e) => setFilterAnio(e.target.value)}
                placeholder="Año"
                className="expField-input"
                style={{ width: 90 }}
                aria-label="Filtrar por año"
              />
            ) : null}
            <button
              type="submit"
              disabled={searching}
              className="expBtn expBtn-primary"
            >
              {searching ? (
                <Loader2 size={16} className="expSpin" />
              ) : mode === "buscar" ? (
                <Search size={16} />
              ) : (
                <Bot size={16} />
              )}
              {searching ? "Buscando..." : "Buscar"}
            </button>
          </form>

          {searchMessage ? (
            <div className="expMessage expMessage-info">
              <Info size={16} />
              <span>{searchMessage}</span>
            </div>
          ) : null}

          {/* Answer AI */}
          {answer ? (
            <div className="expAnswerCard">
              <div className="expAnswerHeader">
                <div className="expAnswerAvatar">
                  <Sparkles size={16} />
                </div>
                <div>
                  <h3 className="expAnswerTitle">Respuesta de la IA</h3>
                  <p className="expAnswerSubtitle">
                    Basada en los expedientes del archivo. Las citas [E#] enlazan a las fuentes.
                  </p>
                </div>
              </div>
              <p className="expAnswerText">{answer.answer}</p>
              {answer.sources.length > 0 ? (
                <div className="expAnswerSources">
                  <p className="expAnswerSourcesLabel">Fuentes ({answer.sources.length})</p>
                  {answer.sources.map((source, index) => (
                    <button
                      key={`${source.expedienteId}-${index}`}
                      type="button"
                      className="expCitation"
                      onClick={() => {
                        const exp = expedientes.find((e) => e.id === source.expedienteId);
                        if (exp) setOpenExp(exp);
                      }}
                    >
                      <span className="expCitationNumber">E{index + 1}</span>
                      <span className="expCitationTitle">{source.title}</span>
                      <span className="expCitationSource">{source.citation}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          {/* Resultados keyword */}
          {results ? (
            <div className="expResults">
              <div className="expFormSectionHeader">
                <h3 className="expFormSectionTitle">
                  <FileText size={16} /> Resultados
                  <span className="expFormSectionHint">
                    {results.length} coincidencia{results.length === 1 ? "" : "s"}
                  </span>
                </h3>
              </div>
              {results.length === 0 ? null : (
                results.map((source) => (
                  <article
                    key={source.expedienteId}
                    className="expResultCard"
                    onClick={() => {
                      const exp = expedientes.find((e) => e.id === source.expedienteId);
                      if (exp) setOpenExp(exp);
                    }}
                  >
                    <div className="expResultIcon">
                      <FileText size={18} />
                    </div>
                    <div className="expResultBody">
                      <h4 className="expResultTitle">{source.title}</h4>
                      <div className="expResultMeta">
                        {source.materia ? (
                          <span className="expResultMetaItem">{source.materia}</span>
                        ) : null}
                        {source.pageStart ? (
                          <span className="expResultMetaItem">pág. {source.pageStart}</span>
                        ) : null}
                      </div>
                      {source.ubicacionResumen ? (
                        <div className="expResultMeta">
                          <span className="expResultMetaItem">
                            <MapPin size={12} /> {source.ubicacionResumen}
                          </span>
                        </div>
                      ) : null}
                      {source.excerpt ? (
                        <p className="expResultExcerpt">{source.excerpt}</p>
                      ) : null}
                    </div>
                    <div className="expResultActions">
                      <a
                        href={`/api/expedientes-archivo/${source.expedienteId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="expIconButton"
                        title="Abrir PDF"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <FileText size={14} />
                      </a>
                    </div>
                  </article>
                ))
              )}
            </div>
          ) : null}

          {/* Dashboard de stats */}
          {stats.total > 0 ? (
            <div className="expStats" aria-label="Resumen del archivo">
              <div className="expStatCard statBrand">
                <div className="expStatHeader">
                  <span className="expStatLabel">Total</span>
                  <FileText className="expStatIcon" size={16} />
                </div>
                <span className="expStatValue">{stats.total}</span>
                <span className="expStatHint">expedientes en el archivo</span>
              </div>
              <div className="expStatCard statSuccess">
                <div className="expStatHeader">
                  <span className="expStatLabel">Indexados</span>
                  <CheckCircle2 className="expStatIcon" size={16} />
                </div>
                <span className="expStatValue">{stats.indexed}</span>
                <span className="expStatHint">listos para buscar</span>
              </div>
              <div className="expStatCard statWarning">
                <div className="expStatHeader">
                  <span className="expStatLabel">Pendientes</span>
                  <Loader2 className="expStatIcon" size={16} />
                </div>
                <span className="expStatValue">{stats.pending}</span>
                <span className="expStatHint">procesándose ahora</span>
              </div>
              <div className="expStatCard statDanger">
                <div className="expStatHeader">
                  <span className="expStatLabel">Con error</span>
                  <AlertCircle className="expStatIcon" size={16} />
                </div>
                <span className="expStatValue">{stats.error}</span>
                <span className="expStatHint">requieren atención</span>
              </div>
              <div className="expStatCard statInfo">
                <div className="expStatHeader">
                  <span className="expStatLabel">Tamaño</span>
                  <FileUp className="expStatIcon" size={16} />
                </div>
                <span className="expStatValue">{formatBytes(stats.totalBytes)}</span>
                <span className="expStatHint">en Supabase Storage</span>
              </div>
            </div>
          ) : null}

          {/* Header de lista */}
          {expedientes.length > 0 ? (
            <>
              <div className="expListHeader">
                <input
                  type="search"
                  placeholder="Filtra la lista por título, materia u oficina…"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="expListSearch"
                  aria-label="Filtro rápido de la lista"
                />
                <div
                  className="expViewToggle"
                  role="tablist"
                  aria-label="Modo de vista"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={viewMode === "lista"}
                    className={viewMode === "lista" ? "active" : ""}
                    onClick={() => setViewMode("lista")}
                    title="Vista lista"
                    aria-label="Vista lista"
                  >
                    <ListIcon size={14} />
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={viewMode === "tabla"}
                    className={viewMode === "tabla" ? "active" : ""}
                    onClick={() => setViewMode("tabla")}
                    title="Vista tabla"
                    aria-label="Vista tabla"
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
                    aria-label="Vista tarjetas"
                  >
                    <Grid3x3 size={14} />
                  </button>
                </div>
                <div className="expPillGroup" role="tablist" aria-label="Filtrar por estado">
                  {STATUS_PILLS.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      role="tab"
                      aria-selected={statusFilter === s.id}
                      className={statusFilter === s.id ? "expPill active" : "expPill"}
                      onClick={() => setStatusFilter(s.id)}
                    >
                      {s.label}
                      <span className="expPillCount">{statusCounts[s.id]}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Filtros avanzados */}
              <div className="expAdvancedFilters">
                <div className="expField">
                  <label className="expField-label">
                    <Filter size={11} /> Oficina
                  </label>
                  <input
                    value={advancedFilters.oficina}
                    onChange={(e) =>
                      setAdvancedFilters((f) => ({ ...f, oficina: e.target.value }))
                    }
                    placeholder="Filtrar por oficina"
                    className="expField-input"
                  />
                </div>
                <div className="expField">
                  <label className="expField-label">Estante</label>
                  <input
                    value={advancedFilters.estante}
                    onChange={(e) =>
                      setAdvancedFilters((f) => ({ ...f, estante: e.target.value }))
                    }
                    placeholder="Nº estante"
                    className="expField-input"
                  />
                </div>
                <div className="expField">
                  <label className="expField-label">Tipo de documento</label>
                  <input
                    value={advancedFilters.tipoDocumento}
                    onChange={(e) =>
                      setAdvancedFilters((f) => ({ ...f, tipoDocumento: e.target.value }))
                    }
                    placeholder="Resolución, Oficio…"
                    className="expField-input"
                  />
                </div>
                <button
                  type="button"
                  className="expBtn expBtn-ghost"
                  onClick={() =>
                    setAdvancedFilters({ oficina: "", estante: "", tipoDocumento: "" })
                  }
                  disabled={
                    !advancedFilters.oficina &&
                    !advancedFilters.estante &&
                    !advancedFilters.tipoDocumento
                  }
                >
                  <X size={14} /> Limpiar
                </button>
              </div>

              {/* Bulk bar */}
              {canManage && selectedIds.size > 0 ? (
                <div className="expBulkBar" role="region" aria-label="Acciones masivas">
                  <strong>{selectedIds.size}</strong>
                  <span>seleccionado{selectedIds.size === 1 ? "" : "s"}</span>
                  <button type="button" onClick={() => setSelectedIds(new Set())}>
                    <X size={14} /> Cancelar
                  </button>
                  <button
                    type="button"
                    className="primary"
                    onClick={() => setBulkOpen(true)}
                  >
                    <MapPin size={14} /> Mover / reasignar
                  </button>
                </div>
              ) : null}

              {/* Contenido */}
              {loadingList ? (
                <div className="expEmpty">
                  <Loader2 size={24} className="expSpin" />
                  <p className="expEmpty-desc">Cargando expedientes…</p>
                </div>
              ) : filteredExps.length === 0 ? (
                <div className="expEmpty">
                  <div className="expEmpty-icon">
                    <FileText size={24} />
                  </div>
                  <h3 className="expEmpty-title">
                    {expedientes.length === 0
                      ? "El archivo está vacío"
                      : "Sin coincidencias"}
                  </h3>
                  <p className="expEmpty-desc">
                    {expedientes.length === 0
                      ? "Sube el primer expediente para empezar a indexar contenido."
                      : "No hay expedientes que coincidan con los filtros aplicados. Prueba ajustando los criterios."}
                  </p>
                  {expedientes.length === 0 && canManage ? (
                    <button
                      type="button"
                      className="expBtn expBtn-primary expEmpty-action"
                      onClick={() => setTab("subir")}
                    >
                      <Plus size={16} /> Subir primer expediente
                    </button>
                  ) : null}
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
                  onDownload={(exp) =>
                    window.open(`/api/expedientes-archivo/${exp.id}`, "_blank")
                  }
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
                <div className="expList">
                  {filteredExps.map((exp) => (
                    <article
                      key={exp.id}
                      className="expListItem"
                      onClick={() => setOpenExp(exp)}
                    >
                      <div className="expListItemIcon">
                        <FileText size={18} />
                      </div>
                      <div className="expListItemBody">
                        <h4 className="expListItemTitle">{exp.title}</h4>
                        <div className="expListItemMeta">
                          {exp.serie_documento ? (
                            <span>N° {exp.serie_documento}</span>
                          ) : (
                            <span>Sin número</span>
                          )}
                          {exp.anio ? <span>· {exp.anio}</span> : null}
                          {exp.oficina ? <span>· {exp.oficina}</span> : null}
                          <span>· {formatBytes(exp.file_size)}</span>
                          <span
                            className={`expStatus expStatus-${exp.status}`}
                            data-status={exp.status}
                          >
                            {statusLabel(exp.status)}
                          </span>
                        </div>
                        {exp.nro_estante || exp.nro_piso || exp.nro_local ? (
                          <div className="expListItemMeta">
                            <span className="expResultMetaItem">
                              <MapPin size={12} />
                              {[exp.nro_estante && `E${exp.nro_estante}`, exp.nro_piso && `P${exp.nro_piso}`, exp.nro_local]
                                .filter(Boolean)
                                .join(" / ")}
                            </span>
                          </div>
                        ) : null}
                      </div>
                      <div
                        className="expListItemActions"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {canManage ? (
                          <>
                            <input
                              type="checkbox"
                              checked={selectedIds.has(exp.id)}
                              onChange={() => toggleSelect(exp.id)}
                              aria-label={`Seleccionar ${exp.title}`}
                              className="expTooltip"
                              data-tip="Seleccionar"
                              style={{ marginRight: 4 }}
                            />
                            <button
                              type="button"
                              onClick={() => setOpenExp(exp)}
                              className="expIconButton"
                              aria-label="Ver detalle"
                              title="Ver detalle"
                            >
                              <Eye size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => void reindexExpediente(exp.id)}
                              disabled={reindexingId === exp.id}
                              className="expIconButton"
                              aria-label="Reindexar"
                              title="Reindexar"
                            >
                              <RefreshCw
                                size={14}
                                className={reindexingId === exp.id ? "expSpin" : ""}
                              />
                            </button>
                            <a
                              href={`/api/expedientes-archivo/${exp.id}`}
                              target="_blank"
                              rel="noreferrer"
                              className="expIconButton"
                              aria-label="Descargar PDF"
                              title="Descargar PDF"
                            >
                              <Download size={14} />
                            </a>
                            <button
                              type="button"
                              onClick={() => void deleteExpediente(exp)}
                              disabled={deletingId === exp.id}
                              className="expIconButton danger"
                              aria-label="Eliminar"
                              title="Eliminar"
                            >
                              <Trash2 size={14} />
                            </button>
                          </>
                        ) : (
                          <a
                            href={`/api/expedientes-archivo/${exp.id}`}
                            target="_blank"
                            rel="noreferrer"
                            className="expIconButton"
                            aria-label="Abrir PDF"
                            title="Abrir PDF"
                          >
                            <FileText size={14} />
                          </a>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </>
          ) : null}
        </div>
      ) : null}

      {/* ── Tab: Subir (wizard 4 pasos) ─────────────────────────── */}
      {tab === "subir" && canManage ? (
        <div className="expTabContent">
          <form onSubmit={uploadExpediente}>
            {/* Wizard progress */}
            <div className="expWizard">
              <div className="expWizardProgress">
                {WIZARD_STEPS.map((step, idx) => {
                  const Icon = step.icon;
                  const isActive = wizardStep === idx;
                  const isDone = wizardStep > idx;
                  return (
                    <>
                      <button
                        key={step.id}
                        type="button"
                        onClick={() => setWizardStep(idx as WizardStep)}
                        className={
                          "expWizardStep" +
                          (isActive ? " active" : "") +
                          (isDone ? " done" : "")
                        }
                      >
                        <span className="expWizardStepNumber">
                          {isDone ? <Check size={14} /> : idx + 1}
                        </span>
                        <span className="expWizardStepLabel">{step.label}</span>
                      </button>
                      {idx < WIZARD_STEPS.length - 1 ? (
                        <div
                          key={`conn-${idx}`}
                          className="expWizardStepConnector"
                        />
                      ) : null}
                    </>
                  );
                })}
              </div>
            </div>

            {/* Paso 0: Documento */}
            {wizardStep === 0 ? (
              <>
                <div className="expFormSection">
                  <div className="expFormSectionHeader">
                    <h3 className="expFormSectionTitle">
                      <FileUp size={16} /> 1. Carga el PDF
                      <span className="expFormSectionHint">
                        Arrastra un archivo o haz clic para seleccionarlo
                      </span>
                    </h3>
                    {file ? (
                      <span className="expFormSectionCounter complete">
                        <Check size={12} /> Cargado
                      </span>
                    ) : null}
                  </div>

                  <label
                    className={
                      "expFilePicker" +
                      (isDragging ? " dragging" : "") +
                      (file ? " hasFile" : "")
                    }
                    onDragOver={onDragOver}
                    onDragLeave={onDragLeave}
                    onDrop={onDrop}
                  >
                    {file ? (
                      <div className="expFilePickerFile">
                        <FileText size={20} />
                        <div>
                          <strong>{file.name}</strong>
                          <span>{formatBytes(file.size)}</span>
                        </div>
                        <button
                          type="button"
                          className="expBtn expBtn-ghost"
                          onClick={(e) => {
                            e.preventDefault();
                            setFile(null);
                          }}
                        >
                          <X size={14} /> Quitar
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="expFilePickerIcon">
                          <UploadCloud size={24} />
                        </div>
                        <p className="expFilePickerTitle">
                          {isDragging
                            ? "Suelta el PDF aquí"
                            : "Arrastra un PDF o haz clic"}
                        </p>
                        <p className="expFilePickerSub">
                          Tamaño máximo: {maxPdfSizeLabel}
                        </p>
                      </>
                    )}
                    <input
                      type="file"
                      accept="application/pdf"
                      onChange={(e) => onFileSelect(e.target.files?.[0] ?? null)}
                    />
                  </label>
                </div>

                <div className="expFormSection">
                  <div className="expFormSectionHeader">
                    <h3 className="expFormSectionTitle">
                      <Info size={16} /> 2. Identifica el documento
                    </h3>
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 12,
                    }}
                  >
                    <div className="expField">
                      <label className="expField-label">
                        SGD de expediente <span className="optional">(opcional)</span>
                      </label>
                      <input
                        value={form.sgdExpediente}
                        onChange={(e) => setField("sgdExpediente", e.target.value)}
                        placeholder="Ej. 2024-001234"
                        className="expField-input"
                      />
                    </div>
                    <div className="expField">
                      <label className="expField-label">
                        Serie documental
                      </label>
                      <input
                        value={form.serieDocumento}
                        onChange={(e) => setField("serieDocumento", e.target.value)}
                        placeholder="Resolución, Oficio, Informe…"
                        className="expField-input"
                      />
                    </div>
                    <div className="expField">
                      <label className="expField-label">
                        Tipo de documento
                      </label>
                      <select
                        value={form.tipoDocumento}
                        onChange={(e) => setField("tipoDocumento", e.target.value)}
                        className="expField-select"
                      >
                        <option value="">— Selecciona —</option>
                        <option value="Resolución">Resolución</option>
                        <option value="Oficio">Oficio</option>
                        <option value="Decreto">Decreto</option>
                        <option value="Ordenanza">Ordenanza</option>
                        <option value="Informe">Informe</option>
                        <option value="Memorando">Memorando</option>
                        <option value="Carta">Carta</option>
                        <option value="otro">Otro…</option>
                      </select>
                    </div>
                    {form.tipoDocumento === "otro" ? (
                      <div className="expField">
                        <label className="expField-label">
                          Especificar tipo
                        </label>
                        <input
                          value={form.tipoDocumentoCustom}
                          onChange={(e) => setField("tipoDocumentoCustom", e.target.value)}
                          placeholder="Escribe el tipo de documento"
                          className="expField-input"
                        />
                      </div>
                    ) : null}
                    <div className="expField">
                      <label className="expField-label">
                        Año <span className="optional">(opcional)</span>
                      </label>
                      <input
                        type="number"
                        value={form.anio}
                        onChange={(e) => setField("anio", e.target.value)}
                        placeholder="2024"
                        className="expField-input"
                      />
                    </div>
                    <div className="expField">
                      <label className="expField-label">
                        Folio <span className="optional">(opcional)</span>
                      </label>
                      <input
                        value={form.folio}
                        onChange={(e) => setField("folio", e.target.value)}
                        placeholder="Nº de folio inicial"
                        className="expField-input"
                      />
                    </div>
                    <div className="expField" style={{ gridColumn: "1 / -1" }}>
                      <label className="expField-label">
                        Oficina <span className="optional">(opcional)</span>
                      </label>
                      <input
                        value={form.oficina}
                        onChange={(e) => setField("oficina", e.target.value)}
                        placeholder="Subgerencia, área, dirección…"
                        className="expField-input"
                      />
                    </div>
                    <div className="expField" style={{ gridColumn: "1 / -1" }}>
                      <label className="expField-label">
                        Título <span className="optional">(opcional)</span>
                      </label>
                      <input
                        value={form.title}
                        onChange={(e) => setField("title", e.target.value)}
                        placeholder="Si lo dejas vacío se usa el nombre del archivo"
                        className="expField-input"
                      />
                      <span className="expField-hint">
                        El título se mostrará en los resultados de búsqueda.
                      </span>
                    </div>
                  </div>
                </div>
              </>
            ) : null}

            {/* Paso 1: Contenido */}
            {wizardStep === 1 ? (
              <div className="expFormSection">
                <div className="expFormSectionHeader">
                  <h3 className="expFormSectionTitle">
                    <FileText size={16} /> Describe el contenido
                    <span className="expFormSectionHint">
                      Estos campos ayudan a la IA a encontrar el expediente
                    </span>
                  </h3>
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 12,
                  }}
                >
                  <div className="expField">
                    <label className="expField-label">Materia</label>
                    <input
                      value={form.materia}
                      onChange={(e) => setField("materia", e.target.value)}
                      placeholder="Contratación, personal, presupuesto…"
                      className="expField-input"
                    />
                  </div>
                  <div className="expField">
                    <label className="expField-label">Asunto</label>
                    <input
                      value={form.asunto}
                      onChange={(e) => setField("asunto", e.target.value)}
                      placeholder="Asunto o sumilla del documento"
                      className="expField-input"
                    />
                  </div>
                  <div className="expField" style={{ gridColumn: "1 / -1" }}>
                    <label className="expField-label">Resumen</label>
                    <textarea
                      rows={3}
                      value={form.resumen}
                      onChange={(e) => setField("resumen", e.target.value)}
                      placeholder="Resumen ejecutivo (3-5 líneas)"
                      className="expField-textarea"
                    />
                  </div>
                  <div className="expField" style={{ gridColumn: "1 / -1" }}>
                    <label className="expField-label">Observaciones</label>
                    <textarea
                      rows={2}
                      value={form.observaciones}
                      onChange={(e) => setField("observaciones", e.target.value)}
                      placeholder="Notas adicionales sobre este expediente"
                      className="expField-textarea"
                    />
                  </div>
                </div>
              </div>
            ) : null}

            {/* Paso 2: Persona */}
            {wizardStep === 2 ? (
              <div className="expFormSection">
                <div className="expFormSectionHeader">
                  <h3 className="expFormSectionTitle">
                    <Info size={16} /> Persona
                    <span className="expFormSectionHint">
                      Quién presenta o solicita este documento
                    </span>
                  </h3>
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 12,
                  }}
                >
                  <div className="expField">
                    <label className="expField-label">Tipo de persona</label>
                    <select
                      value={form.personaTipo}
                      onChange={(e) =>
                        setField("personaTipo", e.target.value as SubirForm["personaTipo"])
                      }
                      className="expField-select"
                    >
                      <option value="">— Sin persona —</option>
                      <option value="natural">Persona natural</option>
                      <option value="juridica">Persona jurídica</option>
                    </select>
                  </div>
                  <div className="expField">
                    <label className="expField-label">Documento</label>
                    <input
                      value={form.personaDocumento}
                      onChange={(e) => setField("personaDocumento", e.target.value)}
                      placeholder="DNI o RUC"
                      className="expField-input"
                    />
                  </div>
                  <div className="expField" style={{ gridColumn: "1 / -1" }}>
                    <label className="expField-label">Nombre</label>
                    <input
                      value={form.personaNombre}
                      onChange={(e) => setField("personaNombre", e.target.value)}
                      placeholder="Razón social o nombre completo"
                      className="expField-input"
                    />
                  </div>
                </div>
              </div>
            ) : null}

            {/* Paso 3: Ubicación */}
            {wizardStep === 3 ? (
              <div className="expFormSection">
                <div className="expFormSectionHeader">
                  <h3 className="expFormSectionTitle">
                    <MapPin size={16} /> Ubicación física
                    <span className="expFormSectionHint">
                      Dónde se encuentra el expediente en papel
                    </span>
                  </h3>
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 12,
                  }}
                >
                  <div className="expField">
                    <label className="expField-label">Tipo de contenedor</label>
                    <select
                      value={form.tipoAlmacenamiento}
                      onChange={(e) => setField("tipoAlmacenamiento", e.target.value)}
                      className="expField-select"
                    >
                      <option value="">— Sin contenedor —</option>
                      {CONTENEDOR_TIPOS.map((tipo) => (
                        <option key={tipo} value={tipo}>
                          {CONTENEDOR_TIPO_LABELS[tipo]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="expField">
                    <label className="expField-label">Nº de archivador</label>
                    <input
                      value={form.nroArchivador}
                      onChange={(e) => setField("nroArchivador", e.target.value)}
                      placeholder="Ej. 12"
                      className="expField-input"
                    />
                  </div>
                  <div className="expField">
                    <label className="expField-label">Nº de paquete</label>
                    <input
                      value={form.nroPaquete}
                      onChange={(e) => setField("nroPaquete", e.target.value)}
                      placeholder="Opcional"
                      className="expField-input"
                    />
                  </div>
                  <div className="expField">
                    <label className="expField-label">Empastado</label>
                    <select
                      value={form.empastado}
                      onChange={(e) => setField("empastado", e.target.value)}
                      className="expField-select"
                    >
                      <option value="">— Sin definir —</option>
                      <option value="si">Sí</option>
                      <option value="no">No</option>
                    </select>
                  </div>
                  <div className="expField">
                    <label className="expField-label">Color</label>
                    <select
                      value={form.colorArchivador}
                      onChange={(e) => setField("colorArchivador", e.target.value)}
                      className="expField-select"
                    >
                      <option value="">— Sin color —</option>
                      {ARCHIVO_COLORES.map((color) => (
                        <option key={color} value={color}>
                          {color}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="expField">
                    <label className="expField-label">Estante</label>
                    <input
                      value={form.nroEstante}
                      onChange={(e) => setField("nroEstante", e.target.value)}
                      placeholder="Ej. 3"
                      className="expField-input"
                    />
                  </div>
                  <div className="expField">
                    <label className="expField-label">Piso</label>
                    <input
                      value={form.nroPiso}
                      onChange={(e) => setField("nroPiso", e.target.value)}
                      placeholder="Ej. 2"
                      className="expField-input"
                    />
                  </div>
                  <div className="expField" style={{ gridColumn: "1 / -1" }}>
                    <label className="expField-label">Local / ambiente</label>
                    <select
                      value={form.nroLocal}
                      onChange={(e) => setField("nroLocal", e.target.value)}
                      className="expField-select"
                    >
                      <option value="">— Sin ambiente —</option>
                      {ARCHIVO_AMBIENTES.map((amb) => (
                        <option key={amb} value={amb}>
                          {amb}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            ) : null}

            {/* Acciones del wizard */}
            <div
              style={{
                display: "flex",
                gap: 10,
                justifyContent: "space-between",
                marginTop: 24,
                paddingTop: 16,
                borderTop: "1px solid var(--exp-line)",
              }}
            >
              <div style={{ display: "flex", gap: 10 }}>
                {wizardStep > 0 ? (
                  <button
                    type="button"
                    className="expBtn expBtn-ghost"
                    onClick={() => setWizardStep((s) => (s - 1) as WizardStep)}
                  >
                    <ChevronLeft size={16} /> Anterior
                  </button>
                ) : null}
                <button
                  type="button"
                  className="expBtn expBtn-ghost"
                  onClick={() => {
                    setForm(EMPTY_FORM);
                    setFile(null);
                    setWizardStep(0);
                  }}
                >
                  <X size={14} /> Cancelar
                </button>
              </div>
              {wizardStep < 3 ? (
                <button
                  type="button"
                  className="expBtn expBtn-primary"
                  onClick={() => {
                    const check = canProceedStep();
                    if (!check.ok) {
                      showToast(check.reason ?? "Completa los datos requeridos", "warning");
                      return;
                    }
                    setWizardStep((s) => (s + 1) as WizardStep);
                  }}
                >
                  Siguiente <ChevronRight size={16} />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={uploading}
                  className="expBtn expBtn-primary"
                >
                  {uploading ? (
                    <Loader2 size={16} className="expSpin" />
                  ) : (
                    <UploadCloud size={16} />
                  )}
                  {uploading ? `Subiendo… ${uploadProgress}%` : "Subir al archivo"}
                </button>
              )}
            </div>

            {uploading && uploadProgress > 0 && uploadProgress < 100 ? (
              <div className="expProgress" style={{ marginTop: 12 }}>
                <div
                  className="expProgress-bar"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            ) : null}
          </form>
        </div>
      ) : tab === "subir" && !canManage ? (
        <div className="expTabContent">
          <div className="expEmpty">
            <div className="expEmpty-icon">
              <Lock size={24} />
            </div>
            <h3 className="expEmpty-title">Acceso restringido</h3>
            <p className="expEmpty-desc">
              La carga y gestión de expedientes requiere rol DEC/Editor o administrador.
              Puedes buscar y consultar todos los expedientes indexados.
            </p>
            <button
              type="button"
              className="expBtn expBtn-secondary expEmpty-action"
              onClick={() => setTab("buscar")}
            >
              <Search size={16} /> Ir a buscar
            </button>
          </div>
        </div>
      ) : null}

      {/* ── Modales y slide-overs ─────────────────────────────────── */}
      {openExp ? (
        <div className="expSlideOverOverlay" onClick={() => setOpenExp(null)}>
          <aside
            className="expSlideOver"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="Detalle del expediente"
          >
            <div className="expSlideOver-header">
              <div>
                <h3 className="expSlideOver-title">{openExp.title}</h3>
                <p className="expSlideOver-subtitle">
                  {openExp.serie_documento ?? "Sin número"} · {openExp.anio ?? "s/f"} ·{" "}
                  {formatBytes(openExp.file_size)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpenExp(null)}
                className="expSlideOver-close"
                aria-label="Cerrar"
              >
                <X size={18} />
              </button>
            </div>
            <div className="expSlideOver-body">
              <iframe
                title="Vista previa"
                src={`/api/expedientes-archivo/${openExp.id}`}
                style={{ width: "100%", height: "70vh", border: 0 }}
              />
              <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
                {openExp.materia ? (
                  <div className="expField">
                    <label className="expField-label">Materia</label>
                    <div>{openExp.materia}</div>
                  </div>
                ) : null}
                {openExp.asunto ? (
                  <div className="expField">
                    <label className="expField-label">Asunto</label>
                    <div>{openExp.asunto}</div>
                  </div>
                ) : null}
                {(openExp.nro_estante || openExp.nro_piso || openExp.nro_local) ? (
                  <div className="expField">
                    <label className="expField-label">Ubicación física</label>
                    <div>
                      {[openExp.nro_estante && `Estante ${openExp.nro_estante}`, openExp.nro_piso && `Piso ${openExp.nro_piso}`, openExp.nro_local]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
            {canManage ? (
              <div className="expSlideOver-footer">
                <button
                  type="button"
                  className="expBtn expBtn-ghost"
                  onClick={() => {
                    setReplaceExp(openExp);
                    setOpenExp(null);
                  }}
                >
                  <RefreshCw size={14} /> Reemplazar PDF
                </button>
                <a
                  href={`/api/expedientes-archivo/${openExp.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="expBtn expBtn-secondary"
                >
                  <Download size={14} /> Descargar
                </a>
                <button
                  type="button"
                  className="expBtn expBtn-primary"
                  onClick={() => setOpenExp(null)}
                >
                  Cerrar
                </button>
              </div>
            ) : null}
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
        <div className="expSlideOverOverlay" onClick={() => setHelpOpen(false)}>
          <aside
            className="expSlideOver expSlideOver-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="Atajos de teclado"
          >
            <div className="expSlideOver-header">
              <div>
                <h3 className="expSlideOver-title">Atajos de teclado</h3>
                <p className="expSlideOver-subtitle">
                  Navega más rápido con el teclado
                </p>
              </div>
              <button
                type="button"
                onClick={() => setHelpOpen(false)}
                className="expSlideOver-close"
                aria-label="Cerrar"
              >
                <X size={18} />
              </button>
            </div>
            <div className="expSlideOver-body">
              <table className="expHelpTable">
                <tbody>
                  <tr>
                    <td>
                      <kbd>⌘</kbd>
                      <kbd>K</kbd>
                    </td>
                    <td>Abrir paleta de comandos</td>
                  </tr>
                  <tr>
                    <td>
                      <kbd>Ctrl</kbd>
                      <kbd>I</kbd>
                    </td>
                    <td>Abrir chat con IA</td>
                  </tr>
                  <tr>
                    <td>
                      <kbd>Ctrl</kbd>
                      <kbd>U</kbd>
                    </td>
                    <td>Ir a pestaña Subir</td>
                  </tr>
                  <tr>
                    <td>
                      <kbd>Ctrl</kbd>
                      <kbd>B</kbd>
                    </td>
                    <td>Ir a pestaña Buscar</td>
                  </tr>
                  <tr>
                    <td>
                      <kbd>Ctrl</kbd>
                      <kbd>→</kbd>
                    </td>
                    <td>Siguiente paso del wizard</td>
                  </tr>
                  <tr>
                    <td>
                      <kbd>Ctrl</kbd>
                      <kbd>←</kbd>
                    </td>
                    <td>Paso anterior del wizard</td>
                  </tr>
                  <tr>
                    <td>
                      <kbd>/</kbd>
                    </td>
                    <td>Enfocar buscador</td>
                  </tr>
                  <tr>
                    <td>
                      <kbd>?</kbd>
                    </td>
                    <td>Mostrar/ocultar esta ayuda</td>
                  </tr>
                  <tr>
                    <td>
                      <kbd>Esc</kbd>
                    </td>
                    <td>Cerrar paneles y modales</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </aside>
        </div>
      ) : null}

      {/* ── Toasts ─────────────────────────────────────────────── */}
      <div aria-live="polite" aria-atomic="true">
        {toasts.map((toast) => {
          const Icon =
            toast.kind === "success"
              ? CheckCircle2
              : toast.kind === "error"
                ? AlertCircle
                : toast.kind === "warning"
                  ? AlertCircle
                  : Info;
          return (
            <div
              key={toast.id}
              className={`expToast expToast-${toast.kind}`}
              role="status"
            >
              <Icon className="expToast-icon" size={18} />
              <span className="expToast-message">{toast.message}</span>
              <button
                type="button"
                className="expToast-close"
                onClick={() => dismissToast(toast.id)}
                aria-label="Cerrar notificación"
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
