"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  Moon,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Sun,
  Table2,
  Trash2,
  UploadCloud,
  X,
  AlertCircle,
  ArrowDown,
  ArrowUp,
  FileUp,
  Undo2,
  History,
  BookOpen,
  Compass,
  PlusCircle,
  LayoutGrid,
  Maximize2,
  Minimize2,
  ArrowRight,
  Lightbulb,
} from "lucide-react";
import {
  ARCHIVO_AMBIENTES,
  ARCHIVO_COLORES,
  CONTENEDOR_TIPOS,
  CONTENEDOR_TIPO_LABELS,
} from "@/lib/expedientes-archivo";
import { maxPdfSizeBytes, maxPdfSizeLabel } from "@/lib/upload-limits";
import type {
  ChatAnswer,
  ExpedienteItem,
  PdfInventory,
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
  OnboardingTour,
  TourTrigger,
  useTour,
  type TourStep,
} from "./expedientes-archivo/onboarding-tour";
import { SkeletonList, SkeletonStats } from "./expedientes-archivo/skeleton";
import { UndoToasts, useUndoStack } from "./expedientes-archivo/undo";
import { useExpedientesPreferences } from "./expedientes-archivo/use-preferences";
import { useDebouncedValue } from "@/app/hooks/use-debounced-value";
import { useTheme } from "@/app/hooks/use-theme";
import { useDensity } from "@/app/hooks/use-density";
import { Pagination, type PaginationInfo } from "./expedientes-archivo/pagination";
import {
  chatWithExpedientes,
  loadExpedientes as loadExpedientesAction,
  searchExpedientes,
  autoFillFromPdf as autoFillFromPdfAction,
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
  { id: 0, label: "Documento", hint: "Sube el PDF e identifica el documento" },
  { id: 1, label: "Contenido", hint: "Describe el contenido del expediente" },
  { id: 2, label: "Persona", hint: "Quién lo presenta o solicita" },
  { id: 3, label: "Ubicación", hint: "Dónde se encuentra en papel" },
] as const;

const STATUS_PILLS: { id: StatusFilter; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "pendientes", label: "Pendientes" },
  { id: "indexados", label: "Indexados" },
  { id: "error", label: "Con error" },
];

const TOUR_STEPS: TourStep[] = [
  {
    id: "welcome",
    target: ".expPanel",
    title: "¡Bienvenido a la Biblioteca de Expedientes!",
    content:
      "Aquí podrás buscar, organizar y consultar todos los expedientes archivados de la municipalidad. Te mostraremos las funciones principales en unos segundos.",
    position: "bottom",
  },
  {
    id: "search-tab",
    target: ".expTab:first-of-type",
    title: "Buscar expedientes",
    content:
      "Aquí puedes buscar por contenido (palabras clave) o hacer preguntas en lenguaje natural a la IA. La IA entiende consultas como '¿dónde está el expediente de la licencia 2024-0345?'",
    position: "bottom",
  },
  {
    id: "search-bar",
    target: ".expSearchBar",
    title: "Barra de búsqueda",
    content:
      "Escribe lo que buscas. Usa '/' desde cualquier lugar para enfocar esta barra. El filtro por año es opcional.",
    position: "bottom",
  },
  {
    id: "stats",
    target: ".expStats",
    title: "Resumen del archivo",
    content:
      "Aquí ves el estado general: cuántos expedientes hay, cuántos están indexados, pendientes o con error.",
    position: "top",
  },
  {
    id: "filters",
    target: ".expListHeader",
    title: "Filtros y vista",
    content:
      "Filtra por estado, oficina, estante o tipo. Cambia entre vista de lista, tabla o tarjetas según prefieras.",
    position: "bottom",
  },
  {
    id: "upload-tab",
    target: ".expTab:nth-of-type(2)",
    title: "Subir expedientes",
    content:
      "Sube PDFs escaneados o digitales. El sistema hace OCR automáticamente y los indexa para búsqueda. Sigue el wizard de 4 pasos.",
    position: "bottom",
  },
  {
    id: "command-palette",
    target: "body",
    title: "Atajos de teclado",
    content:
      "Presiona Ctrl+K en cualquier momento para abrir la paleta de comandos. También puedes usar Ctrl+I para el chat, Ctrl+B para buscar, Ctrl+U para subir, y '?' para ver todos los atajos.",
    position: "bottom",
    action: "Prueba presionando Ctrl+K ahora.",
  },
];

type Toast = {
  id: number;
  message: string;
  kind: "success" | "error" | "warning" | "info";
};

type ConfirmDialog = {
  title: string;
  message: string;
  variant: "danger" | "warning";
  onConfirm: () => void | Promise<void>;
};

/**
 * Campo editable para el preview de datos extraídos del PDF.
 * Permite al usuario revisar, modificar o eliminar cada campo
 * antes de aplicarlo al formulario.
 */
function EditableExtractedField({
  label,
  icon,
  value,
  onChange,
  onRemove,
  placeholder,
  type = "text",
  fullWidth = false,
  multiline = false,
}: {
  label: string;
  icon?: React.ReactNode;
  value: string;
  onChange: (value: string) => void;
  onRemove: () => void;
  placeholder?: string;
  type?: "text" | "number" | "date";
  fullWidth?: boolean;
  multiline?: boolean;
}) {
  const hasValue = value.trim().length > 0;
  return (
    <div
      className={
        "expExtractedField" +
        (fullWidth ? " expExtractedFieldFull" : "") +
        (hasValue ? " expExtractedFieldHasValue" : " expExtractedFieldEmpty")
      }
    >
      <label className="expExtractedFieldLabel">
        {icon}
        <span>{label}</span>
      </label>
      {multiline ? (
        <textarea
          className="expExtractedFieldInput expExtractedFieldTextarea"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={2}
        />
      ) : (
        <input
          className="expExtractedFieldInput"
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
      )}
      <button
        type="button"
        className="expExtractedFieldRemove"
        onClick={onRemove}
        aria-label={`Quitar campo ${label}`}
        title={`Quitar ${label}`}
      >
        <X size={12} />
      </button>
    </div>
  );
}

export function ExpedientesArchivoWorkspace({ canManage }: { canManage: boolean }) {
  const prefs = useExpedientesPreferences();
  const { stack: undoStack, push: pushUndo, execute: executeUndo, dismiss: dismissUndo } =
    useUndoStack();
  const { resolved: resolvedTheme, setTheme, toggle: toggleTheme } = useTheme();
  const { density, toggle: toggleDensity } = useDensity();

  const [tab, setTab] = useState<"buscar" | "subir">(prefs.tab);
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  });

  useEffect(() => {
    prefs.setTab(tab);
  }, [tab, prefs]);

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

  const [expedientes, setExpedientes] = useState<ExpedienteItem[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>(prefs.viewMode);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(prefs.statusFilter);
  const [advancedFilters, setAdvancedFilters] = useState(prefs.filters);
  const [sortBy, setSortBy] = useState<SortBy>(prefs.sortBy);
  const [sortDir, setSortDir] = useState<SortDir>(prefs.sortDir);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearchInput = useDebouncedValue(searchInput, 250);

  useEffect(() => {
    prefs.setViewMode(viewMode);
  }, [viewMode, prefs]);
  useEffect(() => {
    prefs.setStatusFilter(statusFilter);
  }, [statusFilter, prefs]);
  useEffect(() => {
    prefs.setFilters(advancedFilters);
  }, [advancedFilters, prefs]);
  useEffect(() => {
    prefs.setSortBy(sortBy);
  }, [sortBy, prefs]);
  useEffect(() => {
    prefs.setSortDir(sortDir);
  }, [sortDir, prefs]);

  const [form, setForm] = useState<SubirForm>(EMPTY_FORM);
  const [file, setFile] = useState<File | null>(null);
  const [wizardStep, setWizardStep] = useState<WizardStep>(0);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [reindexingId, setReindexingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [extracting, setExtracting] = useState(false);
  const [extractedData, setExtractedData] = useState<PdfInventory | null>(null);
  const [recentUploads, setRecentUploads] = useState<ExpedienteItem[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(false);

  const [bulkOpen, setBulkOpen] = useState(false);
  const [replaceExp, setReplaceExp] = useState<ExpedienteItem | null>(null);
  const [openExp, setOpenExp] = useState<ExpedienteItem | null>(null);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmDialog | null>(null);

  const [toasts, setToasts] = useState<Toast[]>([]);

  const tour = useTour(TOUR_STEPS, "exp-tour-completed-v1");

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

  function showConfirm(dialog: ConfirmDialog) {
    setConfirm(dialog);
  }

  function closeConfirm() {
    setConfirm(null);
  }

  async function withConfirm(dialog: ConfirmDialog) {
    return new Promise<boolean>((resolve) => {
      setConfirm({
        ...dialog,
        onConfirm: async () => {
          await dialog.onConfirm();
          setConfirm(null);
          resolve(true);
        },
      });
      // El usuario puede cancelar con el botón Cancelar
      window.requestAnimationFrame(() => {
        // Marcar que se puede cancelar revisando si aún está montado
      });
    });
  }

  const loadExpedientes = useCallback(async (page = 1) => {
    try {
      const result = await loadExpedientesAction({ page, limit: 50 });
      setExpedientes((result.expedientes as ExpedienteItem[]) ?? []);
      setPagination(result.pagination);
      setCurrentPage(page);
    } catch {
      // Silenciar
    } finally {
      setLoadingList(false);
    }
  }, []);

  // Carga los expedientes subidos recientemente (los ultimos 10) para mostrarlos
  // en la pestana Subir. Permite al usuario ver y gestionar lo que acaba de subir
  // sin tener que ir a la pestana Buscar.
  const refreshRecentUploads = useCallback(async () => {
    setLoadingRecent(true);
    try {
      const result = await loadExpedientesAction({ page: 1, limit: 10 });
      setRecentUploads((result.expedientes as ExpedienteItem[]) ?? []);
    } catch {
      // Silenciar
    } finally {
      setLoadingRecent(false);
    }
  }, []);

  // Carga inicial de recientes cuando el usuario abre la pestana Subir
  useEffect(() => {
    if (tab === "subir" && canManage) {
      void refreshRecentUploads();
    }
  }, [tab, canManage, refreshRecentUploads]);

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

  // Refs estables para evitar memory leak en el keyboard listener
  const tourOpenRef = useRef(tour.open);
  const tourDismissRef = useRef(tour.dismiss);
  useEffect(() => {
    tourOpenRef.current = tour.open;
    tourDismissRef.current = tour.dismiss;
  });

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
        else if (confirm) closeConfirm();
        else if (tourOpenRef.current) tourDismissRef.current();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tab, canManage, cmdOpen, chatOpen, openExp, bulkOpen, replaceExp, helpOpen, confirm]);

  function setField<K extends keyof SubirForm>(key: K, value: SubirForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function canProceedStep(): { ok: boolean; reason?: string } {
    if (wizardStep === 0) {
      if (!file) return { ok: false, reason: "Selecciona un PDF para continuar" };
    }
    return { ok: true };
  }

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
      setChatMessages((prev) => [...prev, { role: "ai", text: msg }]);
      showToast(msg, "error");
    } finally {
      setSearching(false);
    }
  }

  // Extrae datos del PDF cargado y rellena automaticamente los campos del
  // formulario. Usa IA + extractores deterministas del backend.
  async function extractFromPdf() {
    if (!file) {
      showToast("Selecciona un PDF primero", "warning");
      return;
    }
    if (extracting) return;

    setExtracting(true);
    setExtractedData(null);
    try {
      const data = await autoFillFromPdfAction(file, form.title);
      setExtractedData(data);
      const fieldsFound = Object.entries(data).filter(
        ([key, value]) =>
          key !== "extractionMethod" && value !== null && value !== "" && value !== undefined,
      ).length;
      if (fieldsFound === 0) {
        showToast(
          "No se detectaron datos automaticos. Completa el formulario manualmente.",
          "info",
        );
      } else {
        showToast(
          `Se detectaron ${fieldsFound} campos. Revisa y aplica los datos.`,
          "success",
        );
      }
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "No se pudo extraer datos del PDF";
      showToast(msg, "error");
    } finally {
      setExtracting(false);
    }
  }

  // Aplica los datos extraídos al formulario. Solo sobreescribe campos
  // vacíos para no pisar lo que el usuario ya escribió.
  function applyExtractedData() {
    if (!extractedData) return;
    let appliedCount = 0;
    setForm((prev) => {
      const next = { ...prev };
      // Solo aplica campos no vacios y solo si el form no tiene valor
      const tryApply = (
        extractedValue: string | number | null | undefined,
        formKey: keyof SubirForm,
        transform: (v: string | number) => string = (v) => String(v),
      ) => {
        const str = extractedValue == null ? "" : String(extractedValue).trim();
        if (!str) return;
        const current = next[formKey];
        if (current && String(current).trim() !== "") return;
        next[formKey] = transform(extractedValue as string | number) as never;
        appliedCount += 1;
      };
      tryApply(extractedData.numeroExpediente, "sgdExpediente");
      tryApply(extractedData.numeroDocumento, "serieDocumento");
      tryApply(extractedData.anio, "anio");
      tryApply(extractedData.materia, "materia");
      tryApply(extractedData.asunto, "asunto");
      tryApply(extractedData.resumen, "resumen");
      // Si el titulo esta vacio, usar el SGD como fallback
      if (!next.title?.trim() && extractedData.numeroExpediente?.trim()) {
        next.title = extractedData.numeroExpediente.trim();
        appliedCount += 1;
      }
      return next;
    });
    if (appliedCount === 0) {
      showToast(
        "No se aplicaron datos (el formulario ya tiene esos campos llenos o los datos estaban vacíos)",
        "info",
      );
    } else {
      showToast(
        `Se aplicaron ${appliedCount} campo${appliedCount === 1 ? "" : "s"} al formulario`,
        "success",
      );
    }
    setExtractedData(null);
    if (wizardStep === 0) {
      setWizardStep(1);
    }
  }

  function dismissExtractedData() {
    setExtractedData(null);
  }

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
          xhr.addEventListener("error", () => resolve({ ok: false, status: 0, body: null }));
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

      const uploadedTitle = file.name;
      setFile(null);
      setForm(EMPTY_FORM);
      setWizardStep(0);
      setUploadMessage(null);
      setUploadProgress(0);
      showToast(
        `Expediente "${uploadedTitle}" subido. Se está procesando con OCR e indexando.`,
        "success",
      );
      await Promise.all([loadExpedientes(), refreshRecentUploads()]);
    } catch (err) {
      showToast("No se pudo conectar con el servidor.", "error");
    } finally {
      setUploading(false);
    }
  }

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
      await Promise.all([loadExpedientes(), refreshRecentUploads()]);
    } catch {
      showToast("No se pudo conectar con el servidor.", "error");
    } finally {
      setReindexingId(null);
    }
  }

  async function deleteExpediente(exp: ExpedienteItem) {
    showConfirm({
      title: `¿Eliminar "${exp.title}"?`,
      message:
        "Esta acción no se puede deshacer. El PDF y sus chunks también se eliminarán.",
      variant: "danger",
      onConfirm: () => {
        void performDelete(exp);
      },
    });
  }

  async function performDelete(exp: ExpedienteItem) {
    setDeletingId(exp.id);
    try {
      const res = await fetch(`/api/expedientes-archivo/${exp.id}`, { method: "DELETE" });
      if (!res.ok) {
        const payload = await res.json();
        showToast(payload.error ?? "No se pudo eliminar", "error");
        return;
      }

      // Ofrecer undo durante 8 segundos
      pushUndo(
        `Expediente "${exp.title}" eliminado`,
        async () => {
          showToast("Función de deshacer no disponible aún", "warning");
        },
      );

      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(exp.id);
        return next;
      });
      await Promise.all([loadExpedientes(), refreshRecentUploads()]);
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
    if (debouncedSearchInput.trim()) {
      const q = debouncedSearchInput.toLowerCase();
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
  }, [expedientes, statusFilter, advancedFilters, debouncedSearchInput, sortBy, sortDir]);

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

  function clearFilters() {
    setAdvancedFilters({ oficina: "", estante: "", tipoDocumento: "" });
    setSearchInput("");
    setStatusFilter("todos");
  }

  function hasActiveFilters() {
    return (
      statusFilter !== "todos" ||
      advancedFilters.oficina !== "" ||
      advancedFilters.estante !== "" ||
      advancedFilters.tipoDocumento !== "" ||
      searchInput !== ""
    );
  }

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

  function resetPreferences() {
    showConfirm({
      title: "¿Restablecer preferencias?",
      message:
        "Esto volverá las preferencias a sus valores por defecto: vista de lista, filtro 'Todos', orden por fecha de creación.",
      variant: "warning",
      onConfirm: () => {
        prefs.resetAll();
        showToast("Preferencias restablecidas", "success");
      },
    });
  }

  return (
    <div className="expPanel" id="expedientes-archivo">
      <a className="expSkipLink" href="#exp-main">
        Saltar al contenido principal
      </a>

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
          <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center", flexWrap: "wrap" }}>
            <span className="expStatusDot" title="Conectado" aria-hidden="true" />
            <span className="expHelpText" style={{ marginTop: 0 }}>
              <Compass size={12} />
              Atajo: Ctrl+K para buscar · Ctrl+I para chat · ? para ayuda
            </span>
            <div className="expSettingsGroup" role="group" aria-label="Preferencias de visualización">
              <button
                type="button"
                className="expSettingsBtn"
                onClick={toggleDensity}
                aria-pressed={density === "compact"}
                aria-label={density === "compact" ? "Modo compacto activado" : "Modo cómodo"}
                title={density === "compact" ? "Cambiar a modo cómodo" : "Cambiar a modo compacto"}
              >
                {density === "compact" ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
              </button>
              <button
                type="button"
                className="expSettingsBtn"
                onClick={toggleTheme}
                aria-pressed={resolvedTheme === "dark"}
                aria-label={resolvedTheme === "dark" ? "Modo oscuro activado" : "Modo claro"}
                title={resolvedTheme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
              >
                {resolvedTheme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
              </button>
              <TourTrigger onClick={tour.restart} />
            </div>
          </div>
        </div>
        <div className="expPanelHeaderIcon" aria-hidden="true">
          <BookOpen size={20} />
        </div>
      </div>

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
                <span className="expPingDot" style={{ width: 6, height: 6 }} />
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

      {tab === "buscar" ? (
        <div className="expTabContent" id="exp-main" tabIndex={-1}>
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
            <button type="submit" disabled={searching} className="expBtn expBtn-primary">
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

          {mode === "preguntar" && !query && !answer ? (
            <div className="expSuggestedQuestions" aria-label="Ejemplos de preguntas">
              <span
                className="expHelpText"
                style={{ marginTop: 0, marginBottom: 4 }}
              >
                <Lightbulb size={12} /> Prueba con una de estas preguntas:
              </span>
              {[
                "¿Cuántos expedientes de contratación hay en 2024?",
                "¿Dónde está el expediente de la licencia 2024-0345?",
                "Resúmeme los expedientes de la subgerencia de tránsito",
              ].map((q) => (
                <button
                  key={q}
                  type="button"
                  className="expSuggestedQuestion"
                  onClick={() => {
                    setQuery(q);
                    setTimeout(() => {
                      const form = document.querySelector(
                        "form.expSearchBar",
                      ) as HTMLFormElement | null;
                      form?.requestSubmit();
                    }, 50);
                  }}
                >
                  <ArrowRight size={12} />
                  <span>{q}</span>
                </button>
              ))}
            </div>
          ) : null}

          {searchMessage ? (
            <div className="expMessage expMessage-info" role="status">
              <Info size={16} />
              <span>{searchMessage}</span>
            </div>
          ) : null}

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
              {results.length === 0
                ? null
                : results.map((source) => (
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
                  ))}
            </div>
          ) : null}

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
                  className="expSegmented"
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

              {hasActiveFilters() ? (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
                  <span className="expHelpText" style={{ marginTop: 0 }}>
                    <Filter size={12} /> Filtros activos:
                  </span>
                  {searchInput ? (
                    <span className="expFilterChip">
                      Búsqueda: "{searchInput.slice(0, 20)}"
                      <button onClick={() => setSearchInput("")} aria-label="Quitar filtro">
                        <X size={12} />
                      </button>
                    </span>
                  ) : null}
                  {advancedFilters.oficina ? (
                    <span className="expFilterChip">
                      Oficina: {advancedFilters.oficina}
                      <button
                        onClick={() =>
                          setAdvancedFilters((f) => ({ ...f, oficina: "" }))
                        }
                        aria-label="Quitar filtro"
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ) : null}
                  {advancedFilters.estante ? (
                    <span className="expFilterChip">
                      Estante: {advancedFilters.estante}
                      <button
                        onClick={() =>
                          setAdvancedFilters((f) => ({ ...f, estante: "" }))
                        }
                        aria-label="Quitar filtro"
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ) : null}
                  {advancedFilters.tipoDocumento ? (
                    <span className="expFilterChip">
                      Tipo: {advancedFilters.tipoDocumento}
                      <button
                        onClick={() =>
                          setAdvancedFilters((f) => ({ ...f, tipoDocumento: "" }))
                        }
                        aria-label="Quitar filtro"
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ) : null}
                  {statusFilter !== "todos" ? (
                    <span className="expFilterChip">
                      Estado: {STATUS_PILLS.find((p) => p.id === statusFilter)?.label}
                      <button onClick={() => setStatusFilter("todos")} aria-label="Quitar filtro">
                        <X size={12} />
                      </button>
                    </span>
                  ) : null}
                  <button
                    type="button"
                    className="expBtn expBtn-ghost expBtn-small"
                    onClick={clearFilters}
                  >
                    <X size={12} /> Limpiar todos
                  </button>
                </div>
              ) : null}

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
                    aria-label="Filtrar por oficina"
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
                    aria-label="Filtrar por estante"
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
                    aria-label="Filtrar por tipo de documento"
                  />
                </div>
                <button
                  type="button"
                  className="expBtn expBtn-ghost"
                  onClick={clearFilters}
                  disabled={!hasActiveFilters()}
                >
                  <X size={14} /> Limpiar
                </button>
              </div>

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

              {loadingList ? (
                <>
                  <SkeletonStats />
                  <SkeletonList count={5} />
                </>
              ) : filteredExps.length === 0 ? (
                <div className="expEmpty">
                  <div className="expEmptyIllustration">
                    <FileText size={28} />
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
              ) : (
                <>
                  {viewMode === "lista" ? (
                    <div className="expList" role="list">
                      {filteredExps.map((exp) => (
                        <article
                          key={exp.id}
                          className="expListItem"
                          onClick={() => setOpenExp(exp)}
                          role="listitem"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setOpenExp(exp);
                            }
                          }}
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
                  ) : (
                    <TarjetasExpedientes
                      exps={filteredExps}
                      onOpen={setOpenExp}
                      formatBytes={formatBytes}
                      statusLabel={statusLabel}
                    />
                  )}

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginTop: 16,
                      padding: "12px 14px",
                      background: "var(--exp-line-soft)",
                      borderRadius: "var(--exp-radius)",
                      fontSize: 12,
                      color: "var(--exp-muted)",
                    }}
                  >
                    <span>
                      Mostrando <strong>{filteredExps.length}</strong> de{" "}
                      {expedientes.length} expediente{expedientes.length === 1 ? "" : "s"}
                    </span>
                    {hasActiveFilters() ? (
                      <button
                        type="button"
                        className="expBtn expBtn-ghost expBtn-small"
                        onClick={resetPreferences}
                      >
                        <History size={12} /> Restablecer preferencias
                      </button>
                    ) : null}
                  </div>

                  {pagination.totalPages > 1 ? (
                    <Pagination
                      pagination={pagination}
                      onPageChange={(page) => void loadExpedientes(page)}
                    />
                  ) : null}
                </>
              )}
            </>
          ) : null}
        </div>
      ) : null}

      {tab === "subir" && canManage ? (
        <div className="expTabContent">
          <form onSubmit={uploadExpediente}>
            <div className="expWizard">
              <div className="expWizardProgress" role="tablist" aria-label="Pasos del wizard">
                {WIZARD_STEPS.map((step, idx) => {
                  const isActive = wizardStep === idx;
                  const isDone = wizardStep > idx;
                  return (
                    <>
                      <button
                        key={step.id}
                        type="button"
                        role="tab"
                        aria-selected={isActive}
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
                        <div key={`conn-${idx}`} className="expWizardStepConnector" />
                      ) : null}
                    </>
                  );
                })}
              </div>
              <div
                style={{
                  display: "flex",
                  gap: 6,
                  alignItems: "center",
                  fontSize: 12,
                  color: "var(--exp-muted)",
                }}
              >
                <Info size={12} />
                <span>{WIZARD_STEPS[wizardStep].hint}</span>
              </div>
            </div>

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
                            setExtractedData(null);
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

                  {/* Botón para extraer datos automáticamente del PDF */}
                  {file && canManage ? (
                    <div className="expExtractSection">
                      <button
                        type="button"
                        className="expBtn expBtn-secondary expExtractBtn"
                        onClick={extractFromPdf}
                        disabled={extracting}
                        aria-label="Obtener datos del PDF automaticamente"
                      >
                        {extracting ? (
                          <>
                            <Loader2 size={16} className="expSpin" />
                            Analizando PDF con IA...
                          </>
                        ) : (
                          <>
                            <Sparkles size={16} />
                            Obtener datos del PDF
                          </>
                        )}
                      </button>
                      <span className="expHelpText" style={{ marginTop: 0 }}>
                        <Info size={12} />
                        Usa OCR + IA para extraer número, fecha, materia, asunto y resumen.
                        No modifica el archivo ni indexa nada.
                      </span>
                    </div>
                  ) : null}

                  {/* Preview de datos extraídos (editables) */}
                  {extractedData ? (
                    <div
                      className="expExtractedPreview"
                      role="region"
                      aria-label="Datos extraídos del PDF (editables)"
                    >
                      <div className="expExtractedHeader">
                        <div>
                          <strong>
                            <Sparkles size={12} /> Datos detectados en el PDF
                            <span className="expExtractedBadge">editables</span>
                          </strong>
                          <span className="expHelpText" style={{ marginTop: 0 }}>
                            Edita o elimina los campos antes de aplicar. Solo
                            se rellenan los campos vacíos del formulario.
                          </span>
                        </div>
                        {extractedData.extractionMethod ? (
                          <span
                            className={`expStatus expStatus-${
                              extractedData.extractionMethod === "ai"
                                ? "indexed"
                                : extractedData.extractionMethod === "deterministic"
                                  ? "uploaded"
                                  : "processing"
                            }`}
                          >
                            {extractedData.extractionMethod === "ai"
                              ? "IA"
                              : extractedData.extractionMethod === "deterministic"
                                ? "Automático"
                                : extractedData.extractionMethod === "hybrid"
                                  ? "Híbrido"
                                  : "Sin datos"}
                          </span>
                        ) : null}
                      </div>
                      <div className="expExtractedChips">
                        <EditableExtractedField
                          label="SGD"
                          icon={<FileText size={11} />}
                          value={extractedData.numeroExpediente ?? ""}
                          onChange={(v) =>
                            setExtractedData((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    numeroExpediente: v.trim() || null,
                                  }
                                : prev,
                            )
                          }
                          onRemove={() =>
                            setExtractedData((prev) =>
                              prev
                                ? { ...prev, numeroExpediente: null }
                                : prev,
                            )
                          }
                          placeholder="Número SGD"
                        />
                        <EditableExtractedField
                          label="Serie"
                          icon={<FileText size={11} />}
                          value={extractedData.numeroDocumento ?? ""}
                          onChange={(v) =>
                            setExtractedData((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    numeroDocumento: v.trim() || null,
                                  }
                                : prev,
                            )
                          }
                          onRemove={() =>
                            setExtractedData((prev) =>
                              prev
                                ? { ...prev, numeroDocumento: null }
                                : prev,
                            )
                          }
                          placeholder="Serie documental"
                        />
                        <EditableExtractedField
                          label="Año"
                          icon={<History size={11} />}
                          value={extractedData.anio?.toString() ?? ""}
                          onChange={(v) =>
                            setExtractedData((prev) => {
                              if (!prev) return prev;
                              const year = v.trim()
                                ? Number.parseInt(v.trim(), 10)
                                : null;
                              return {
                                ...prev,
                                anio: year && !Number.isNaN(year) ? year : null,
                              };
                            })
                          }
                          onRemove={() =>
                            setExtractedData((prev) =>
                              prev ? { ...prev, anio: null } : prev,
                            )
                          }
                          placeholder="2024"
                          type="number"
                        />
                        <EditableExtractedField
                          label="Fecha"
                          icon={<History size={11} />}
                          value={extractedData.fecha ?? ""}
                          onChange={(v) =>
                            setExtractedData((prev) =>
                              prev
                                ? { ...prev, fecha: v.trim() || null }
                                : prev,
                            )
                          }
                          onRemove={() =>
                            setExtractedData((prev) =>
                              prev ? { ...prev, fecha: null } : prev,
                            )
                          }
                          placeholder="YYYY-MM-DD"
                          type="date"
                        />
                        <EditableExtractedField
                          label="Materia"
                          icon={<Info size={11} />}
                          value={extractedData.materia ?? ""}
                          onChange={(v) =>
                            setExtractedData((prev) =>
                              prev
                                ? { ...prev, materia: v.trim() || null }
                                : prev,
                            )
                          }
                          onRemove={() =>
                            setExtractedData((prev) =>
                              prev ? { ...prev, materia: null } : prev,
                            )
                          }
                          placeholder="Materia del documento"
                        />
                        <EditableExtractedField
                          label="Asunto"
                          icon={<Info size={11} />}
                          value={extractedData.asunto ?? ""}
                          onChange={(v) =>
                            setExtractedData((prev) =>
                              prev
                                ? { ...prev, asunto: v.trim() || null }
                                : prev,
                            )
                          }
                          onRemove={() =>
                            setExtractedData((prev) =>
                              prev ? { ...prev, asunto: null } : prev,
                            )
                          }
                          placeholder="Asunto o sumilla"
                        />
                        <EditableExtractedField
                          label="Remitente"
                          icon={<Info size={11} />}
                          value={extractedData.remitente ?? ""}
                          onChange={(v) =>
                            setExtractedData((prev) =>
                              prev
                                ? { ...prev, remitente: v.trim() || null }
                                : prev,
                            )
                          }
                          onRemove={() =>
                            setExtractedData((prev) =>
                              prev ? { ...prev, remitente: null } : prev,
                            )
                          }
                          placeholder="Quién emite"
                        />
                        <EditableExtractedField
                          label="Destinatario"
                          icon={<Info size={11} />}
                          value={extractedData.destinatario ?? ""}
                          onChange={(v) =>
                            setExtractedData((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    destinatario: v.trim() || null,
                                  }
                                : prev,
                            )
                          }
                          onRemove={() =>
                            setExtractedData((prev) =>
                              prev
                                ? { ...prev, destinatario: null }
                                : prev,
                            )
                          }
                          placeholder="A quién se dirige"
                        />
                        <EditableExtractedField
                          label="Folios"
                          icon={<FileText size={11} />}
                          value={extractedData.nroFolios?.toString() ?? ""}
                          onChange={(v) =>
                            setExtractedData((prev) => {
                              if (!prev) return prev;
                              const n = v.trim()
                                ? Number.parseInt(v.trim(), 10)
                                : null;
                              return {
                                ...prev,
                                nroFolios: n && !Number.isNaN(n) ? n : null,
                              };
                            })
                          }
                          onRemove={() =>
                            setExtractedData((prev) =>
                              prev ? { ...prev, nroFolios: null } : prev,
                            )
                          }
                          placeholder="Nº folios"
                          type="number"
                        />
                        <EditableExtractedField
                          label="Resumen"
                          icon={<FileText size={11} />}
                          value={extractedData.resumen ?? ""}
                          onChange={(v) =>
                            setExtractedData((prev) =>
                              prev
                                ? { ...prev, resumen: v.trim() || null }
                                : prev,
                            )
                          }
                          onRemove={() =>
                            setExtractedData((prev) =>
                              prev ? { ...prev, resumen: null } : prev,
                            )
                          }
                          placeholder="Resumen ejecutivo"
                          fullWidth
                          multiline
                        />
                      </div>
                      <div className="expExtractedActions">
                        <button
                          type="button"
                          className="expBtn expBtn-ghost expBtn-small"
                          onClick={dismissExtractedData}
                        >
                          <X size={14} /> Descartar todos
                        </button>
                        <button
                          type="button"
                          className="expBtn expBtn-primary"
                          onClick={applyExtractedData}
                        >
                          <Check size={14} /> Aplicar al formulario
                        </button>
                      </div>
                    </div>
                  ) : null}
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
                      <label className="expField-label">Serie documental</label>
                      <input
                        value={form.serieDocumento}
                        onChange={(e) => setField("serieDocumento", e.target.value)}
                        placeholder="Resolución, Oficio, Informe…"
                        className="expField-input"
                      />
                    </div>
                    <div className="expField">
                      <label className="expField-label">Tipo de documento</label>
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
                        <label className="expField-label">Especificar tipo</label>
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
                      <span className="expHelpText">
                        <Info size={12} /> El título se mostrará en los resultados de búsqueda.
                      </span>
                    </div>
                  </div>
                </div>
              </>
            ) : null}

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
                    showConfirm({
                      title: "¿Cancelar subida?",
                      message:
                        "Se perderán los datos del formulario y el PDF seleccionado. ¿Estás seguro?",
                      variant: "warning",
                      onConfirm: () => {
                        setForm(EMPTY_FORM);
                        setFile(null);
                        setWizardStep(0);
                        showToast("Subida cancelada", "info");
                      },
                    });
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
                  className="expBtn expBtn-primary expBtn-large"
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

          {/* Lista de expedientes subidos (recientes) */}
          {canManage ? (
            <div className="expRecentUploads" aria-label="Expedientes subidos recientemente">
              <div className="expFormSectionHeader" style={{ marginTop: 32 }}>
                <h3 className="expFormSectionTitle">
                  <FileUp size={16} /> Expedientes subidos recientemente
                  <span className="expFormSectionHint">
                    {recentUploads.length} de los últimos subidos
                  </span>
                </h3>
                {recentUploads.length > 0 ? (
                  <button
                    type="button"
                    className="expBtn expBtn-ghost expBtn-small"
                    onClick={refreshRecentUploads}
                    disabled={loadingRecent}
                    aria-label="Actualizar lista de recientes"
                  >
                    {loadingRecent ? (
                      <Loader2 size={12} className="expSpin" />
                    ) : (
                      <RefreshCw size={12} />
                    )}
                    Actualizar
                  </button>
                ) : null}
              </div>

              {loadingRecent && recentUploads.length === 0 ? (
                <SkeletonList count={3} />
              ) : recentUploads.length === 0 ? (
                <div className="expRecentEmpty">
                  <FileText size={20} />
                  <p>
                    Aún no has subido expedientes. Completa el wizard de arriba
                    para empezar.
                  </p>
                </div>
              ) : (
                <div className="expRecentList">
                  {recentUploads.map((exp) => (
                    <article
                      key={exp.id}
                      className={
                        "expRecentItem" +
                        (exp.status === "processing" || exp.status === "uploaded"
                          ? " expRecentItemPending"
                          : "") +
                        (exp.status === "error" ? " expRecentItemError" : "")
                      }
                    >
                      <div className="expRecentItemIcon">
                        <FileText size={16} />
                      </div>
                      <div className="expRecentItemBody">
                        <div className="expRecentItemHeader">
                          <strong>{exp.title}</strong>
                          <span
                            className={`expStatus expStatus-${exp.status}`}
                            data-status={exp.status}
                          >
                            {statusLabel(exp.status)}
                          </span>
                        </div>
                        <div className="expRecentItemMeta">
                          {exp.serie_documento ? (
                            <span>N° {exp.serie_documento}</span>
                          ) : (
                            <span>Sin número</span>
                          )}
                          {exp.anio ? <span>· {exp.anio}</span> : null}
                          {exp.oficina ? <span>· {exp.oficina}</span> : null}
                          <span>· {formatBytes(exp.file_size)}</span>
                          <span>· {new Date(exp.created_at).toLocaleDateString("es-PE")}</span>
                        </div>
                        {exp.metadata?.chunkCount ? (
                          <div className="expRecentItemMeta">
                            <span>
                              {exp.metadata.pageCount ?? 0} páginas · {exp.metadata.chunkCount} fragmentos
                            </span>
                          </div>
                        ) : null}
                        {exp.error_message ? (
                          <div className="expRecentItemError">
                            {exp.error_message}
                          </div>
                        ) : null}
                      </div>
                      <div
                        className="expRecentItemActions"
                        onClick={(e) => e.stopPropagation()}
                      >
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
                      </div>
                    </article>
                  ))}
                  {recentUploads.length >= 10 ? (
                    <button
                      type="button"
                      className="expBtn expBtn-secondary expRecentViewAll"
                      onClick={() => setTab("buscar")}
                    >
                      Ver todos los expedientes
                      <ArrowRight size={14} />
                    </button>
                  ) : null}
                </div>
              )}
            </div>
          ) : null}
        </div>
      ) : tab === "subir" && !canManage ? (
        <div className="expTabContent">
          <div className="expEmpty">
            <div className="expEmptyIllustration">
              <Lock size={28} />
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

      {confirm ? (
        <div className="expConfirm" onClick={closeConfirm}>
          <div
            className="expConfirmDialog"
            onClick={(e) => e.stopPropagation()}
            role="alertdialog"
            aria-labelledby="expConfirmTitle"
            aria-describedby="expConfirmBody"
          >
            <div className="expConfirmHeader">
              <div
                className={`expConfirmIcon ${confirm.variant === "danger" ? "danger" : "warning"}`}
              >
                {confirm.variant === "danger" ? (
                  <Trash2 size={20} />
                ) : (
                  <AlertCircle size={20} />
                )}
              </div>
              <h3 className="expConfirmTitle" id="expConfirmTitle">
                {confirm.title}
              </h3>
            </div>
            <p className="expConfirmBody" id="expConfirmBody">
              {confirm.message}
            </p>
            <div className="expConfirmFooter">
              <button type="button" className="expBtn expBtn-ghost" onClick={closeConfirm}>
                Cancelar
              </button>
              <button
                type="button"
                className={`expBtn ${confirm.variant === "danger" ? "expBtn-danger" : "expBtn-primary"}`}
                onClick={() => {
                  void confirm.onConfirm();
                }}
              >
                {confirm.variant === "danger" ? "Eliminar" : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <OnboardingTour
        steps={TOUR_STEPS}
        open={tour.open}
        onClose={tour.close}
        onComplete={tour.complete}
      />

      <UndoToasts stack={undoStack} onExecute={executeUndo} onDismiss={dismissUndo} />

      <button
        type="button"
        className="expFab"
        onClick={() => (canManage ? setTab("subir") : tour.restart())}
        aria-label={canManage ? "Subir nuevo expediente" : "Ver tutorial"}
        title={canManage ? "Subir nuevo expediente" : "Ver tutorial"}
      >
        {canManage ? <PlusCircle size={22} /> : <Compass size={22} />}
      </button>

      <div aria-live="polite" aria-atomic="true" className="expSrOnly">
        {toasts.map((t) => (
          <span key={t.id}>{t.message}</span>
        ))}
      </div>

      <div>
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
