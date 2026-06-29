"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  Check,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Download,
  Eye,
  FileText,
  FileSignature,
  Filter,
  Grid3x3,
  HelpCircle,
  Info,
  List as ListIcon,
  Loader2,
  Lock,
  MapPin,
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
  FileUp,
  History,
  BookOpen,
  Compass,
  PlusCircle,
  Maximize2,
  Minimize2,
  ArrowRight,
  Lightbulb,
  Pencil,
  Save,
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
  DuplicateMatch,
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
  WorkspaceTab,
} from "./expedientes-archivo/types";
import { ChatPanel } from "./expedientes-archivo/chat-panel";
import { CommandPalette } from "./expedientes-archivo/command-palette";
import { TablaExpedientes } from "./expedientes-archivo/tabla-expedientes";
import { TarjetasExpedientes } from "./expedientes-archivo/tarjetas-expedientes";
import { BulkMoveModal } from "./expedientes-archivo/bulk-move-modal";
import { ReplaceFileModal } from "./expedientes-archivo/replace-file-modal";
import { BatchUpload } from "./expedientes-archivo/batch-upload";
import { RespuestaPanel } from "./expedientes-archivo/respuesta-panel";
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
  fetchExpedienteById,
  searchExpedientes,
  updateExpediente as updateExpedienteAction,
  autoFillFromPdf as autoFillFromPdfAction,
  detectDuplicates as detectDuplicatesAction,
  fetchUbicacionSugerida,
  type ExpedienteCounts,
  type UbicacionSugerida,
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

// Ajusta los conteos globales del dashboard al añadir (+1) o quitar (-1) un
// expediente, sin tener que refetchear. Mantiene el total, el tamaño y el
// desglose por estado coherentes durante el borrado diferido.
function adjustCounts(c: ExpedienteCounts, exp: ExpedienteItem, delta: number): ExpedienteCounts {
  const next = { ...c };
  next.total = Math.max(0, next.total + delta);
  next.totalBytes = Math.max(0, next.totalBytes + delta * (exp.file_size ?? 0));
  if (exp.status === "indexed") next.indexed = Math.max(0, next.indexed + delta);
  else if (exp.status === "uploaded" || exp.status === "processing")
    next.pending = Math.max(0, next.pending + delta);
  else if (exp.status === "error") next.error = Math.max(0, next.error + delta);
  return next;
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

// La SERIE DOCUMENTAL se arma con el tipo de documento + el numero detectado
// (ej. "Resolución 004-2024-MDCH-A"). El SGD NO se autocompleta: es el N° de
// expediente del sistema de gestion documental EXTERNO y lo asigna el usuario a mano.
function buildSerieDocumental(
  tipoDocumento: string | null | undefined,
  numero: string | number | null | undefined,
): string {
  const tipo = tipoDocumento == null ? "" : String(tipoDocumento).trim();
  const num = numero == null ? "" : String(numero).trim();
  if (!num) return "";
  return [tipo, num].filter(Boolean).join(" ");
}

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

  const [tab, setTab] = useState<WorkspaceTab>(prefs.tab);
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
  const [filterOficina, setFilterOficina] = useState("");
  const [filterMateria, setFilterMateria] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [answer, setAnswer] = useState<ChatAnswer | null>(null);
  const [searchMessage, setSearchMessage] = useState<string | null>(null);
  const activeFilterCount = [filterAnio, filterOficina, filterMateria].filter((v) => v.trim()).length;
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<
    { role: "user" | "ai"; text: string; sources?: SearchResult[] }[]
  >([]);

  const [expedientes, setExpedientes] = useState<ExpedienteItem[]>([]);
  // Conteos globales del archivo (todo, no solo la página) para el dashboard.
  const [counts, setCounts] = useState<ExpedienteCounts | null>(null);
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
  const [reindexingId, setReindexingId] = useState<string | null>(null);
  // Con borrado diferido la fila desaparece al instante (no hay llamada en vuelo
  // durante la ventana de deshacer), así que no se necesita indicador por fila.
  const deletingId: string | null = null;
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [extracting, setExtracting] = useState(false);
  const [extractedData, setExtractedData] = useState<PdfInventory | null>(null);
  const [recentUploads, setRecentUploads] = useState<ExpedienteItem[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(false);
  // Campos rellenados automáticamente (IA/OCR) y aún no editados a mano. Se usa
  // para marcarlos visualmente ("IA") y distinguirlos de lo que escribió el usuario.
  const [autoFilledFields, setAutoFilledFields] = useState<Set<keyof SubirForm>>(new Set());
  // Posibles duplicados detectados al cargar/identificar el PDF o al teclear el SGD.
  const [duplicates, setDuplicates] = useState<DuplicateMatch[]>([]);
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);
  const [dupsDismissed, setDupsDismissed] = useState(false);
  // Firma de la última comprobación de duplicados, para no repetirla (clave por
  // SGD/serie; si no hay, por título). Evita que la detección al teclear y la de
  // la extracción se pisen.
  const lastDupSignatureRef = useRef<string>("");
  // SGD/serie con debounce: disparan la detección de duplicados al teclear a mano.
  const debouncedSgd = useDebouncedValue(form.sgdExpediente, 600);
  const debouncedSerie = useDebouncedValue(form.serieDocumento, 600);
  // Sugerencia de ubicación física basada en lo ya archivado.
  const [ubicacionSugerida, setUbicacionSugerida] = useState<UbicacionSugerida | null>(null);
  const [siguientePaquete, setSiguientePaquete] = useState<string | null>(null);
  // Modo de subida: uno por uno (wizard) o por lotes (varios PDF a la vez).
  const [uploadMode, setUploadMode] = useState<"single" | "batch">("single");

  const [bulkOpen, setBulkOpen] = useState(false);
  const [replaceExp, setReplaceExp] = useState<ExpedienteItem | null>(null);
  const [openExp, setOpenExp] = useState<ExpedienteItem | null>(null);
  // Edición de metadata del expediente abierto (slide-over).
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, unknown>>({});
  const [savingEdit, setSavingEdit] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmDialog | null>(null);

  const [toasts, setToasts] = useState<Toast[]>([]);

  const tour = useTour(TOUR_STEPS, "exp-tour-completed-v1");

  // Contador estable para IDs de toast (evita Date.now()/Math.random() impuros).
  const toastIdRef = useRef(0);
  function showToast(message: string, kind: Toast["kind"] = "info") {
    const id = (toastIdRef.current += 1);
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

  // Expedientes ocultados de la UI mientras corre su ventana de "deshacer"
  // (borrado diferido). Se filtran de cualquier lista que venga del servidor,
  // porque la fila aún existe en BD hasta que se confirma el borrado.
  const pendingDeleteRef = useRef<Map<string, ExpedienteItem>>(new Map());

  const loadExpedientes = useCallback(async (page = 1) => {
    try {
      const result = await loadExpedientesAction({ page, limit: 50 });
      const pending = pendingDeleteRef.current;
      const fetched = (result.expedientes as ExpedienteItem[]) ?? [];
      setExpedientes(pending.size ? fetched.filter((e) => !pending.has(e.id)) : fetched);
      let serverCounts = result.counts;
      if (serverCounts && pending.size) {
        for (const ex of pending.values()) serverCounts = adjustCounts(serverCounts, ex, -1);
      }
      setCounts(serverCounts);
      setPagination(result.pagination);
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
      const pending = pendingDeleteRef.current;
      const fetched = (result.expedientes as ExpedienteItem[]) ?? [];
      setRecentUploads(pending.size ? fetched.filter((e) => !pending.has(e.id)) : fetched);
    } catch {
      // Silenciar
    } finally {
      setLoadingRecent(false);
    }
  }, []);

  // Carga inicial de recientes cuando el usuario abre la pestana Subir
  useEffect(() => {
    if (tab === "subir" && canManage) {
      // Carga de datos al montar/cambiar de tab; el setState ocurre tras await.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void refreshRecentUploads();
    }
  }, [tab, canManage, refreshRecentUploads]);

  const hasPending = useMemo(
    () => expedientes.some((exp) => exp.status === "uploaded" || exp.status === "processing"),
    [expedientes],
  );

  useEffect(() => {
    // Carga inicial de la lista; el setState ocurre tras await.
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

  // Polling de la lista de recientes cuando hay items pendientes
  const hasRecentPending = useMemo(
    () => recentUploads.some((exp) => exp.status === "uploaded" || exp.status === "processing"),
    [recentUploads],
  );
  useEffect(() => {
    if (!hasRecentPending) return;
    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      if (attempts > 75) {
        clearInterval(timer);
        return;
      }
      void refreshRecentUploads();
    }, 4000);
    return () => clearInterval(timer);
  }, [hasRecentPending, refreshRecentUploads]);

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
        else if (openExp) closeSlideOver();
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

  // Cierra el slide-over y sale de modo edición, limpiando el borrador.
  function closeSlideOver() {
    setOpenExp(null);
    setEditMode(false);
    setEditForm({});
  }

  function setField<K extends keyof SubirForm>(key: K, value: SubirForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    // Una edición manual deja de considerarse "rellenado por IA".
    setAutoFilledFields((prev) => {
      if (!prev.has(key)) return prev;
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }

  // Chip "IA" para campos rellenados automáticamente y aún no editados a mano.
  const autoBadge = (key: keyof SubirForm) =>
    autoFilledFields.has(key) ? (
      <span
        title="Autocompletado por IA — revisa el valor"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 3,
          marginLeft: 6,
          padding: "1px 6px",
          borderRadius: 999,
          fontSize: 10,
          fontWeight: 600,
          background: "var(--exp-accent-soft, rgba(99,102,241,0.12))",
          color: "var(--exp-accent, #6366f1)",
        }}
      >
        <Sparkles size={9} /> IA
      </span>
    ) : null;

  // Rellena la ubicación física desde una sugerencia del backend.
  function applyUbicacionSugerida(u: UbicacionSugerida) {
    const map: Array<[keyof SubirForm, string | boolean | null]> = [
      ["tipoAlmacenamiento", u.tipo_almacenamiento],
      ["nroArchivador", u.nro_archivador],
      ["nroPaquete", u.nro_paquete],
      ["empastado", u.empastado === null ? "" : u.empastado ? "si" : "no"],
      ["colorArchivador", u.color_archivador],
      ["nroEstante", u.nro_estante],
      ["nroPiso", u.nro_piso],
      ["nroLocal", u.nro_local],
    ];
    const filled = new Set<keyof SubirForm>();
    setForm((prev) => {
      const next = { ...prev };
      for (const [k, v] of map) {
        const str = v === null || v === undefined ? "" : String(v);
        if (str) {
          next[k] = str as never;
          filled.add(k);
        }
      }
      return next;
    });
    setAutoFilledFields((prev) => {
      const merged = new Set(prev);
      for (const k of filled) merged.add(k);
      return merged;
    });
    showToast("Ubicación física aplicada. Ajusta lo que cambie.", "success");
  }

  function canProceedStep(): { ok: boolean; reason?: string } {
    if (wizardStep === 0) {
      if (!file) return { ok: false, reason: "Selecciona un PDF para continuar" };
    }
    return { ok: true };
  }

  // Abre el slide-over de un expediente desde un resultado de búsqueda. La lista
  // está paginada (50) pero la búsqueda es global, así que el expediente puede no
  // estar cargado: en ese caso se trae su metadata por id.
  async function openExpedienteById(id: string) {
    const loaded = expedientes.find((e) => e.id === id);
    if (loaded) {
      setOpenExp(loaded);
      return;
    }
    try {
      const exp = (await fetchExpedienteById(id)) as ExpedienteItem | null;
      if (exp) {
        setOpenExp(exp);
      } else {
        window.open(`/api/expedientes-archivo/${id}`, "_blank");
      }
    } catch {
      window.open(`/api/expedientes-archivo/${id}`, "_blank");
    }
  }

  async function runSearch(event?: React.FormEvent) {
    event?.preventDefault();
    const minLen = mode === "buscar" ? 2 : 3;
    if (query.trim().length < minLen) {
      setSearchMessage(`Escribe al menos ${minLen} caracteres para ${mode === "buscar" ? "buscar" : "consultar"}.`);
      return;
    }
    setSearching(true);
    setSearchMessage(null);
    setResults(null);
    setAnswer(null);
    try {
      if (mode === "buscar") {
        const data = await searchExpedientes(query.trim(), {
          anio: filterAnio ? Number.parseInt(filterAnio, 10) : undefined,
          oficina: filterOficina.trim() || undefined,
          materia: filterMateria.trim() || undefined,
        });
        setResults(data.results);
        if (data.results.length === 0) {
          setSearchMessage(
            "Sin resultados. Prueba con otros términos, ajusta los filtros o sube el expediente si aún no está en el archivo.",
          );
        }
      } else {
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

  // Cambia el sub-modo de búsqueda y limpia los resultados del modo anterior
  // para no mezclar salidas (resultados vectoriales vs. respuesta de chat).
  function changeMode(next: SearchMode) {
    setMode(next);
    setResults(null);
    setAnswer(null);
    setSearchMessage(null);
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

  // Aplica un inventario extraído al formulario. Solo rellena campos vacíos (no
  // pisa lo que el usuario ya escribió) y marca los rellenados como "IA" para que
  // se distingan visualmente. Devuelve cuántos campos aplicó.
  function applyInventory(data: PdfInventory): number {
    let appliedCount = 0;
    const filled = new Set<keyof SubirForm>();
    setForm((prev) => {
      const next = { ...prev };
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
        filled.add(formKey);
        appliedCount += 1;
      };
      // SGD NO se autocompleta (manual: N° del sistema documental externo). La
      // SERIE DOCUMENTAL es la denominación oficial LITERAL que la IA lee del
      // encabezado (ej. "RESOLUCIÓN DE ALCALDÍA N° 004-2024-MDCH-A"); si no la
      // detectó, se compone como fallback con tipo + número.
      const serieDetectada =
        data.serieDocumental?.trim() || buildSerieDocumental(data.tipoDocumento, data.numeroExpediente);
      tryApply(serieDetectada, "serieDocumento");
      tryApply(data.tipoDocumento, "tipoDocumento");
      tryApply(data.anio, "anio");
      tryApply(data.oficina, "oficina");
      tryApply(data.materia, "materia");
      tryApply(data.asunto, "asunto");
      tryApply(data.personaNombre, "personaNombre");
      tryApply(data.personaTipo, "personaTipo");
      tryApply(data.resumen, "resumen");
      tryApply(data.nroFolios, "folio");
      // Si el titulo esta vacio, usar la serie documental como fallback.
      if (!next.title?.trim() && serieDetectada) {
        next.title = serieDetectada;
        filled.add("title");
        appliedCount += 1;
      }
      return next;
    });
    if (appliedCount > 0) {
      setAutoFilledFields((prev) => {
        const merged = new Set(prev);
        for (const k of filled) merged.add(k);
        return merged;
      });
    }
    return appliedCount;
  }

  // Comprueba si ya existe un expediente igual (por SGD/serie/título) para avisar
  // antes de reprocesar OCR/embeddings en vano.
  const checkDuplicatesFor = useCallback(
    async (params: { title?: string; sgd?: string; serie?: string }) => {
      if (!params.title && !params.sgd && !params.serie) return;
      // Clave por SGD/serie cuando los hay (así la comprobación al teclear y la de
      // la extracción comparten firma y no se duplican); si no, por título.
      const sgd = (params.sgd ?? "").trim();
      const serie = (params.serie ?? "").trim();
      const signature = sgd || serie ? `k:${sgd}|${serie}` : `t:${(params.title ?? "").trim()}`;
      if (signature === lastDupSignatureRef.current) return;
      lastDupSignatureRef.current = signature;
      setCheckingDuplicates(true);
      try {
        const { duplicates: found } = await detectDuplicatesAction(params);
        setDuplicates(found);
        setDupsDismissed(false);
      } catch {
        // La detección es una ayuda; nunca debe romper la subida.
      } finally {
        setCheckingDuplicates(false);
      }
    },
    [],
  );

  // Pide al backend la ubicación física probable (misma caja del lote, siguiente
  // paquete) según lo ya archivado para esta serie/año.
  const loadUbicacionSugeridaFor = useCallback(
    async (params: { serie?: string; anio?: string | number }) => {
      try {
        const res = await fetchUbicacionSugerida(params);
        setUbicacionSugerida(res.ultima);
        setSiguientePaquete(res.siguientePaquete);
      } catch {
        // Silenciar: es solo una sugerencia.
      }
    },
    [],
  );

  // Detección de duplicados al teclear el SGD o la serie a mano (con debounce).
  // La firma en checkDuplicatesFor evita repetir lo ya comprobado por la extracción.
  useEffect(() => {
    if (!canManage || tab !== "subir") return;
    const sgd = debouncedSgd.trim();
    const serie = debouncedSerie.trim();
    if (sgd.length < 3 && serie.length < 3) return;
    // El setState ocurre dentro de checkDuplicatesFor (indicador de carga).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void checkDuplicatesFor({ sgd: sgd || undefined, serie: serie || undefined });
  }, [debouncedSgd, debouncedSerie, canManage, tab, checkDuplicatesFor]);

  // Extrae datos del PDF (OCR + IA). En modo automático aplica los datos al
  // formulario directamente (el usuario solo revisa); en modo manual muestra el
  // preview editable. También dispara la detección de duplicados.
  async function extractFromPdf(opts?: { auto?: boolean; fileArg?: File }) {
    const target = opts?.fileArg ?? file;
    if (!target) {
      showToast("Selecciona un PDF primero", "warning");
      return;
    }
    if (extracting) return;

    setExtracting(true);
    setExtractedData(null);
    try {
      const data = await autoFillFromPdfAction(target, form.title);
      const fieldsFound = Object.entries(data).filter(
        ([key, value]) =>
          key !== "extractionMethod" && value !== null && value !== "" && value !== undefined,
      ).length;

      if (fieldsFound === 0) {
        const method = data.extractionMethod ?? "none";
        const reason =
          method === "none"
            ? "El PDF no tiene texto legible (posible escaneado sin OCR)."
            : method === "deterministic"
              ? "Solo se detectaron datos básicos. La IA no devolvió campos semánticos."
              : "La IA no devolvió campos. Verifica tu API key de OpenAI o intenta con otro PDF.";
        showToast(reason, "warning");
        if (!opts?.auto) setExtractedData(data);
        return;
      }

      if (opts?.auto) {
        // Auto: aplicar directamente para que el usuario solo confirme.
        const applied = applyInventory(data);
        showToast(
          `Analizado con IA: ${applied} campo${applied === 1 ? "" : "s"} autocompletado${applied === 1 ? "" : "s"}. Revisa y ajusta.`,
          "success",
        );
        void checkDuplicatesFor({
          title: data.numeroExpediente ?? target.name,
          serie:
            data.serieDocumental?.trim() ||
            buildSerieDocumental(data.tipoDocumento, data.numeroExpediente) ||
            undefined,
        });
        void loadUbicacionSugeridaFor({ anio: data.anio ?? undefined });
      } else {
        // Manual: mostrar preview editable (comportamiento previo).
        setExtractedData(data);
        showToast(`Se detectaron ${fieldsFound} campos. Revisa y aplica los datos.`, "success");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "No se pudo extraer datos del PDF";
      // En modo automático no interrumpimos con un error rojo: el usuario puede
      // llenar a mano. En modo manual sí avisamos del fallo.
      showToast(opts?.auto ? `No se pudo autocompletar: ${msg}` : `Error: ${msg}`, opts?.auto ? "info" : "error");
      console.error("[expedientes] extractFromPdf fallo:", err);
    } finally {
      setExtracting(false);
    }
  }

  // Aplica los datos del preview manual al formulario.
  function applyExtractedData() {
    if (!extractedData) return;
    const applied = applyInventory(extractedData);
    if (applied === 0) {
      showToast(
        "No se aplicaron datos (el formulario ya tiene esos campos llenos o los datos estaban vacíos)",
        "info",
      );
    } else {
      showToast(
        `Se aplicaron ${applied} campo${applied === 1 ? "" : "s"} al formulario`,
        "success",
      );
      void checkDuplicatesFor({
        title: extractedData.numeroExpediente ?? file?.name,
        serie:
          extractedData.serieDocumental?.trim() ||
          buildSerieDocumental(extractedData.tipoDocumento, extractedData.numeroExpediente) ||
          undefined,
      });
      void loadUbicacionSugeridaFor({ anio: extractedData.anio ?? undefined });
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
        return;
      }

      const uploadedTitle = file.name;
      // Recordar la ubicación física para precargarla en la siguiente subida del lote.
      prefs.setLastUbicacion({
        tipoAlmacenamiento: form.tipoAlmacenamiento,
        nroArchivador: form.nroArchivador,
        nroPaquete: form.nroPaquete,
        empastado: form.empastado,
        colorArchivador: form.colorArchivador,
        nroEstante: form.nroEstante,
        nroPiso: form.nroPiso,
        nroLocal: form.nroLocal,
      });
      setFile(null);
      setForm(EMPTY_FORM);
      setAutoFilledFields(new Set());
      setDuplicates([]);
      setDupsDismissed(false);
      lastDupSignatureRef.current = "";
      setWizardStep(0);
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
        "Tendrás unos segundos para deshacer. Pasada la ventana, el PDF y sus fragmentos indexados se eliminarán de forma definitiva.",
      variant: "danger",
      onConfirm: () => {
        void performDelete(exp);
      },
    });
  }

  // Reintroduce un expediente en la UI (al deshacer o si el borrado falla).
  function restoreExpedienteInUi(exp: ExpedienteItem) {
    pendingDeleteRef.current.delete(exp.id);
    setExpedientes((prev) => [exp, ...prev.filter((e) => e.id !== exp.id)]);
    setCounts((prev) => (prev ? adjustCounts(prev, exp, +1) : prev));
  }

  // Borrado diferido con "deshacer" real: ocultamos el expediente de inmediato y
  // solo ejecutamos el DELETE en el servidor cuando vence la ventana (o el usuario
  // cierra el aviso). Si pulsa "Deshacer", nada se llegó a borrar.
  function performDelete(exp: ExpedienteItem) {
    pendingDeleteRef.current.set(exp.id, exp);
    setExpedientes((prev) => prev.filter((e) => e.id !== exp.id));
    setRecentUploads((prev) => prev.filter((e) => e.id !== exp.id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(exp.id);
      return next;
    });
    if (openExp?.id === exp.id) closeSlideOver();
    setCounts((prev) => (prev ? adjustCounts(prev, exp, -1) : prev));

    pushUndo(
      `Expediente "${exp.title}" eliminado`,
      // Deshacer: restaurar en la UI (no se borró nada en el servidor).
      () => {
        restoreExpedienteInUi(exp);
        showToast(`Se restauró "${exp.title}".`, "success");
      },
      {
        // Confirmar: ejecutar el DELETE real al vencer la ventana o al cerrar el aviso.
        onCommit: async () => {
          try {
            const res = await fetch(`/api/expedientes-archivo/${exp.id}`, { method: "DELETE" });
            if (!res.ok) {
              const payload = await res.json().catch(() => ({}));
              showToast(payload.error ?? `No se pudo eliminar "${exp.title}"`, "error");
              restoreExpedienteInUi(exp);
              return;
            }
            pendingDeleteRef.current.delete(exp.id);
            await Promise.all([loadExpedientes(pagination.page), refreshRecentUploads()]);
          } catch {
            showToast(`No se pudo eliminar "${exp.title}".`, "error");
            restoreExpedienteInUi(exp);
          }
        },
      },
    );
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

  // ── Edición de metadata del expediente abierto (PATCH) ────────────────────
  function strOrNull(value: unknown): string | null {
    const s = value == null ? "" : String(value).trim();
    return s ? s : null;
  }

  function setEditField(key: string, value: unknown) {
    setEditForm((prev) => ({ ...prev, [key]: value }));
  }

  // Inicializa el formulario con los valores actuales del expediente y entra en
  // modo edición. empastado se mapea a "si"/"no"/"" para el <select>.
  function startEdit() {
    if (!openExp) return;
    setEditForm({
      title: openExp.title ?? "",
      sgd_expediente: openExp.sgd_expediente ?? "",
      serie_documento: openExp.serie_documento ?? "",
      anio: openExp.anio ?? "",
      tipo_documento: openExp.tipo_documento ?? "",
      oficina: openExp.oficina ?? "",
      materia: openExp.materia ?? "",
      asunto: openExp.asunto ?? "",
      resumen: openExp.resumen ?? "",
      observaciones: openExp.observaciones ?? "",
      persona_tipo: openExp.persona_tipo ?? "",
      persona_documento: openExp.persona_documento ?? "",
      persona_nombre: openExp.persona_nombre ?? "",
      tipo_almacenamiento: openExp.tipo_almacenamiento ?? "",
      nro_archivador: openExp.nro_archivador ?? "",
      nro_paquete: openExp.nro_paquete ?? "",
      empastado: openExp.empastado === true ? "si" : openExp.empastado === false ? "no" : "",
      color_archivador: openExp.color_archivador ?? "",
      nro_estante: openExp.nro_estante ?? "",
      nro_piso: openExp.nro_piso ?? "",
      nro_local: openExp.nro_local ?? "",
      folio: openExp.folio ?? "",
    });
    setEditMode(true);
  }

  // Construye el ExpedienteItem actualizado a partir del formulario, para reflejar
  // los cambios al instante en el slide-over y la lista (antes del refetch).
  function mergeEditIntoItem(item: ExpedienteItem, form: Record<string, unknown>): ExpedienteItem {
    const anio =
      form.anio === "" || form.anio == null ? null : Number.parseInt(String(form.anio), 10);
    const empastado = form.empastado === "si" ? true : form.empastado === "no" ? false : null;
    const personaTipo = form.persona_tipo === "natural" || form.persona_tipo === "juridica"
      ? form.persona_tipo
      : null;
    return {
      ...item,
      title: strOrNull(form.title) ?? item.title,
      sgd_expediente: strOrNull(form.sgd_expediente),
      serie_documento: strOrNull(form.serie_documento),
      anio: Number.isFinite(anio as number) ? (anio as number) : null,
      tipo_documento: strOrNull(form.tipo_documento),
      oficina: strOrNull(form.oficina),
      materia: strOrNull(form.materia),
      asunto: strOrNull(form.asunto),
      resumen: strOrNull(form.resumen),
      observaciones: strOrNull(form.observaciones),
      persona_tipo: personaTipo,
      persona_documento: strOrNull(form.persona_documento),
      persona_nombre: strOrNull(form.persona_nombre),
      tipo_almacenamiento: strOrNull(form.tipo_almacenamiento) ?? item.tipo_almacenamiento,
      nro_archivador: strOrNull(form.nro_archivador),
      nro_paquete: strOrNull(form.nro_paquete),
      empastado,
      color_archivador: strOrNull(form.color_archivador),
      nro_estante: strOrNull(form.nro_estante),
      nro_piso: strOrNull(form.nro_piso),
      nro_local: strOrNull(form.nro_local),
      folio: strOrNull(form.folio),
    };
  }

  async function saveExpedienteEdits() {
    if (!openExp) return;
    if (!strOrNull(editForm.title)) {
      showToast("El título no puede quedar vacío.", "warning");
      return;
    }
    setSavingEdit(true);
    try {
      const updates: Record<string, unknown> = { ...editForm };
      updates.anio = editForm.anio === "" || editForm.anio == null ? null : editForm.anio;
      await updateExpedienteAction(openExp.id, updates);
      const merged = mergeEditIntoItem(openExp, editForm);
      setOpenExp(merged);
      setExpedientes((prev) => prev.map((e) => (e.id === merged.id ? merged : e)));
      setEditMode(false);
      showToast("Cambios guardados.", "success");
      // Resincroniza desde el servidor (por si normalizó algún valor).
      void loadExpedientes(pagination.page);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "No se pudo guardar", "error");
    } finally {
      setSavingEdit(false);
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

  // Conteos a mostrar: los globales del backend (todo el archivo) si están
  // disponibles; si no, los derivados de la página cargada (fallback).
  const displayStats = counts ?? stats;
  const displayStatusCounts = useMemo(
    () =>
      counts
        ? {
            todos: counts.total,
            pendientes: counts.pending,
            indexados: counts.indexed,
            error: counts.error,
          }
        : statusCounts,
    [counts, statusCounts],
  );

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

  // Precarga la ubicación física con la última usada (mismo lote) si los campos
  // están vacíos. No pisa lo que el usuario ya escribió.
  function prefillLastUbicacion() {
    const last = prefs.lastUbicacion;
    const hasAny = Object.values(last).some((v) => v && String(v).trim());
    if (!hasAny) return;
    const locKeys: (keyof SubirForm)[] = [
      "tipoAlmacenamiento",
      "nroArchivador",
      "nroPaquete",
      "empastado",
      "colorArchivador",
      "nroEstante",
      "nroPiso",
      "nroLocal",
    ];
    const filled = new Set<keyof SubirForm>();
    setForm((prev) => {
      const next = { ...prev };
      for (const k of locKeys) {
        const v = (last as Record<string, string>)[k] ?? "";
        if (v && !(next[k] && String(next[k]).trim())) {
          next[k] = v as never;
          filled.add(k);
        }
      }
      return next;
    });
    if (filled.size > 0) {
      setAutoFilledFields((prev) => {
        const merged = new Set(prev);
        for (const k of filled) merged.add(k);
        return merged;
      });
    }
  }

  // Punto único de entrada al cargar un PDF (selección o drag&drop): valida,
  // precarga la última ubicación y, si está activo, lo analiza con IA al instante.
  function handleNewFile(f: File | null) {
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
    setExtractedData(null);
    setDuplicates([]);
    setDupsDismissed(false);
    lastDupSignatureRef.current = "";
    prefillLastUbicacion();
    if (prefs.autoExtract) {
      void extractFromPdf({ auto: true, fileArg: f });
    } else {
      showToast("PDF cargado. Pulsa “Obtener datos del PDF” o llena los campos.", "info");
    }
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
    handleNewFile(e.dataTransfer.files?.[0] ?? null);
  }

  function onFileSelect(f: File | null) {
    handleNewFile(f);
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
                {displayStatusCounts.pendientes}
              </span>
            ) : null}
          </button>
        ) : null}
        {canManage ? (
          <button
            type="button"
            role="tab"
            aria-selected={tab === "responder"}
            className={tab === "responder" ? "expTab active" : "expTab"}
            onClick={() => setTab("responder")}
          >
            <FileSignature size={15} /> Responder
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
          <div className="expSearchModes" role="tablist" aria-label="Modo de búsqueda">
            <button
              type="button"
              role="tab"
              aria-selected={mode === "buscar"}
              className={"expSearchModeCard" + (mode === "buscar" ? " active" : "")}
              onClick={() => changeMode("buscar")}
            >
              <span className="expSearchModeIcon">
                <Search size={18} />
              </span>
              <span className="expSearchModeText">
                <span className="expSearchModeTitle">Buscar</span>
                <span className="expSearchModeDesc">Por el contenido del documento</span>
              </span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "preguntar"}
              className={"expSearchModeCard" + (mode === "preguntar" ? " active" : "")}
              onClick={() => changeMode("preguntar")}
            >
              <span className="expSearchModeIcon">
                <Bot size={18} />
              </span>
              <span className="expSearchModeText">
                <span className="expSearchModeTitle">Preguntar a la IA</span>
                <span className="expSearchModeDesc">Respuesta y ubicación, en lenguaje natural</span>
              </span>
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
              <button
                type="button"
                className={"expFilterToggle" + (showFilters ? " active" : "")}
                onClick={() => setShowFilters((v) => !v)}
                aria-expanded={showFilters}
                title="Filtros"
              >
                <Filter size={15} /> Filtros
                {activeFilterCount > 0 ? (
                  <span className="expFilterBadge">{activeFilterCount}</span>
                ) : null}
              </button>
            ) : null}
            <button type="submit" disabled={searching} className="expBtn expBtn-primary">
              {searching ? (
                <Loader2 size={16} className="expSpin" />
              ) : mode === "buscar" ? (
                <Search size={16} />
              ) : (
                <Bot size={16} />
              )}
              {searching
                ? mode === "buscar"
                  ? "Buscando..."
                  : "Consultando..."
                : mode === "buscar"
                  ? "Buscar"
                  : "Preguntar"}
            </button>
          </form>

          {mode === "buscar" && showFilters ? (
            <div className="expFilters" aria-label="Filtros de búsqueda">
              <div className="expFilterField">
                <label className="expFilterLabel" htmlFor="filter-anio">Año</label>
                <input
                  id="filter-anio"
                  type="number"
                  value={filterAnio}
                  onChange={(e) => setFilterAnio(e.target.value)}
                  placeholder="Ej. 2024"
                  className="expField-input"
                />
              </div>
              <div className="expFilterField">
                <label className="expFilterLabel" htmlFor="filter-oficina">Oficina</label>
                <input
                  id="filter-oficina"
                  value={filterOficina}
                  onChange={(e) => setFilterOficina(e.target.value)}
                  placeholder="Ej. Subgerencia de Tránsito"
                  className="expField-input"
                />
              </div>
              <div className="expFilterField">
                <label className="expFilterLabel" htmlFor="filter-materia">Materia</label>
                <input
                  id="filter-materia"
                  value={filterMateria}
                  onChange={(e) => setFilterMateria(e.target.value)}
                  placeholder="Ej. contratación"
                  className="expField-input"
                />
              </div>
              {activeFilterCount > 0 ? (
                <button
                  type="button"
                  className="expBtn expBtn-ghost expFilterClear"
                  onClick={() => {
                    setFilterAnio("");
                    setFilterOficina("");
                    setFilterMateria("");
                  }}
                >
                  <X size={14} /> Limpiar
                </button>
              ) : null}
            </div>
          ) : null}

          {displayStats.pending > 0 ? (
            <span className="expHelpText" style={{ marginTop: 8 }}>
              <Loader2 size={12} className="expSpin" /> {displayStats.pending} expediente
              {displayStats.pending === 1 ? "" : "s"} en proceso aún no aparece
              {displayStats.pending === 1 ? "" : "n"} en la búsqueda (se indexa
              {displayStats.pending === 1 ? "" : "n"} en segundo plano).
            </span>
          ) : null}

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
                      onClick={() => void openExpedienteById(source.expedienteId)}
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
                      onClick={() => void openExpedienteById(source.expedienteId)}
                    >
                      <div className="expResultIcon">
                        <FileText size={18} />
                      </div>
                      <div className="expResultBody">
                        <h4 className="expResultTitle">{source.title}</h4>
                        <div className="expResultMeta">
                          {source.serieDocumento ? (
                            <span className="expResultMetaItem">{source.serieDocumento}</span>
                          ) : null}
                          {source.anio ? (
                            <span className="expResultMetaItem">{source.anio}</span>
                          ) : null}
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

          {displayStats.total > 0 ? (
            <div className="expStats" aria-label="Resumen del archivo">
              <div className="expStatCard statBrand">
                <div className="expStatHeader">
                  <span className="expStatLabel">Total</span>
                  <FileText className="expStatIcon" size={16} />
                </div>
                <span className="expStatValue">{displayStats.total}</span>
                <span className="expStatHint">expedientes en el archivo</span>
              </div>
              <div className="expStatCard statSuccess">
                <div className="expStatHeader">
                  <span className="expStatLabel">Indexados</span>
                  <CheckCircle2 className="expStatIcon" size={16} />
                </div>
                <span className="expStatValue">{displayStats.indexed}</span>
                <span className="expStatHint">listos para buscar</span>
              </div>
              <div className="expStatCard statWarning">
                <div className="expStatHeader">
                  <span className="expStatLabel">Pendientes</span>
                  <Loader2 className="expStatIcon" size={16} />
                </div>
                <span className="expStatValue">{displayStats.pending}</span>
                <span className="expStatHint">procesándose ahora</span>
              </div>
              <div className="expStatCard statDanger">
                <div className="expStatHeader">
                  <span className="expStatLabel">Con error</span>
                  <AlertCircle className="expStatIcon" size={16} />
                </div>
                <span className="expStatValue">{displayStats.error}</span>
                <span className="expStatHint">requieren atención</span>
              </div>
              <div className="expStatCard statInfo">
                <div className="expStatHeader">
                  <span className="expStatLabel">Tamaño</span>
                  <FileUp className="expStatIcon" size={16} />
                </div>
                <span className="expStatValue">{formatBytes(displayStats.totalBytes)}</span>
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
                      <span className="expPillCount">{displayStatusCounts[s.id]}</span>
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
                      Búsqueda: &quot;{searchInput.slice(0, 20)}&quot;
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
                                <span>{exp.serie_documento}</span>
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
          {/* Selector de modo: uno por uno vs por lotes */}
          <div
            role="tablist"
            aria-label="Modo de subida"
            style={{ display: "flex", gap: 8, marginBottom: 16 }}
          >
            <button
              type="button"
              role="tab"
              aria-selected={uploadMode === "single"}
              className={uploadMode === "single" ? "expBtn expBtn-primary" : "expBtn expBtn-ghost"}
              onClick={() => setUploadMode("single")}
            >
              <FileText size={15} /> Uno por uno
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={uploadMode === "batch"}
              className={uploadMode === "batch" ? "expBtn expBtn-primary" : "expBtn expBtn-ghost"}
              onClick={() => setUploadMode("batch")}
            >
              <UploadCloud size={15} /> Por lotes
            </button>
          </div>

          {uploadMode === "batch" ? (
            <BatchUpload
              autoExtract={prefs.autoExtract}
              lastUbicacion={prefs.lastUbicacion}
              setLastUbicacion={prefs.setLastUbicacion}
              onUploaded={() => {
                void Promise.all([loadExpedientes(), refreshRecentUploads()]);
              }}
              showToast={showToast}
            />
          ) : (
          <form onSubmit={uploadExpediente}>
            <div className="expWizard">
              <div className="expWizardProgress" role="tablist" aria-label="Pasos del wizard">
                {WIZARD_STEPS.map((step, idx) => {
                  const isActive = wizardStep === idx;
                  const isDone = wizardStep > idx;
                  return (
                    <Fragment key={step.id}>
                      <button
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
                        <div className="expWizardStepConnector" />
                      ) : null}
                    </Fragment>
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

                  {/* Toggle: analizar con IA automáticamente al cargar */}
                  {canManage ? (
                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        fontSize: 13,
                        color: "var(--exp-muted)",
                        cursor: "pointer",
                        marginTop: 10,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={prefs.autoExtract}
                        onChange={(e) => prefs.setAutoExtract(e.target.checked)}
                      />
                      <Sparkles size={13} />
                      Analizar el PDF con IA automáticamente al cargarlo
                    </label>
                  ) : null}

                  {/* Botón para extraer datos manualmente (si el auto está apagado o quieres re-analizar) */}
                  {file && canManage ? (
                    <div className="expExtractSection">
                      <button
                        type="button"
                        className="expBtn expBtn-secondary expExtractBtn"
                        onClick={() => extractFromPdf()}
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
                            {prefs.autoExtract ? "Volver a analizar el PDF" : "Obtener datos del PDF"}
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

                  {/* Aviso proactivo de posibles duplicados */}
                  {duplicates.length > 0 && !dupsDismissed ? (
                    <div
                      role="alert"
                      style={{
                        marginTop: 12,
                        padding: 12,
                        borderRadius: 10,
                        border: "1px solid var(--exp-warn-line, rgba(234,179,8,0.4))",
                        background: "var(--exp-warn-soft, rgba(234,179,8,0.08))",
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600 }}>
                        <AlertCircle size={15} />
                        Posible{duplicates.length === 1 ? "" : "s"} duplicado{duplicates.length === 1 ? "" : "s"} ({duplicates.length})
                      </div>
                      <span className="expHelpText" style={{ marginTop: 0 }}>
                        Ya hay expedientes parecidos archivados. Revisa antes de subir para no duplicar.
                      </span>
                      <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, display: "flex", flexDirection: "column", gap: 2 }}>
                        {duplicates.slice(0, 4).map((d) => (
                          <li key={d.id}>
                            {d.title}
                            {d.anio ? ` · ${d.anio}` : ""} · {d.status}
                          </li>
                        ))}
                      </ul>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          type="button"
                          className="expBtn expBtn-ghost expBtn-small"
                          onClick={() => setDupsDismissed(true)}
                        >
                          Continuar de todos modos
                        </button>
                      </div>
                    </div>
                  ) : checkingDuplicates ? (
                    <span className="expHelpText" style={{ marginTop: 10 }}>
                      <Loader2 size={12} className="expSpin" /> Buscando posibles duplicados…
                    </span>
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
                          label="Tipo"
                          icon={<FileText size={11} />}
                          value={extractedData.tipoDocumento ?? ""}
                          onChange={(v) =>
                            setExtractedData((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    tipoDocumento: v.trim() || null,
                                  }
                                : prev,
                            )
                          }
                          onRemove={() =>
                            setExtractedData((prev) =>
                              prev
                                ? { ...prev, tipoDocumento: null }
                                : prev,
                            )
                          }
                          placeholder="Resolución, Oficio…"
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
                          label="Oficina"
                          icon={<Info size={11} />}
                          value={extractedData.oficina ?? ""}
                          onChange={(v) =>
                            setExtractedData((prev) =>
                              prev ? { ...prev, oficina: v.trim() || null } : prev,
                            )
                          }
                          onRemove={() =>
                            setExtractedData((prev) =>
                              prev ? { ...prev, oficina: null } : prev,
                            )
                          }
                          placeholder="Oficina emisora"
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
                          label="Persona"
                          icon={<Info size={11} />}
                          value={extractedData.personaNombre ?? ""}
                          onChange={(v) =>
                            setExtractedData((prev) =>
                              prev ? { ...prev, personaNombre: v.trim() || null } : prev,
                            )
                          }
                          onRemove={() =>
                            setExtractedData((prev) =>
                              prev
                                ? { ...prev, personaNombre: null, personaTipo: null }
                                : prev,
                            )
                          }
                          placeholder="Persona/empresa interesada"
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
                        placeholder="N° del sistema de gestión documental"
                        className="expField-input"
                      />
                      <span className="expHelpText">
                        N° de expediente del sistema documental externo. Lo asignas tú (no se autocompleta).
                      </span>
                    </div>
                    <div className="expField">
                      <label className="expField-label">Serie documental{autoBadge("serieDocumento")}</label>
                      <input
                        value={form.serieDocumento}
                        onChange={(e) => setField("serieDocumento", e.target.value)}
                        placeholder="Ej. Resolución 004-2024-MDCH-A"
                        className="expField-input"
                      />
                    </div>
                    <div className="expField">
                      <label className="expField-label">Tipo de documento{autoBadge("tipoDocumento")}</label>
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
                        {autoBadge("anio")}
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
                        Folios <span className="optional">(opcional)</span>
                        {autoBadge("folio")}
                      </label>
                      <input
                        value={form.folio}
                        onChange={(e) => setField("folio", e.target.value)}
                        placeholder="Nº de páginas del PDF"
                        className="expField-input"
                      />
                    </div>
                    <div className="expField" style={{ gridColumn: "1 / -1" }}>
                      <label className="expField-label">
                        Oficina <span className="optional">(opcional)</span>
                        {autoBadge("oficina")}
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
                        {autoBadge("title")}
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
                    <label className="expField-label">Materia{autoBadge("materia")}</label>
                    <input
                      value={form.materia}
                      onChange={(e) => setField("materia", e.target.value)}
                      placeholder="Contratación, personal, presupuesto…"
                      className="expField-input"
                    />
                  </div>
                  <div className="expField">
                    <label className="expField-label">Asunto{autoBadge("asunto")}</label>
                    <input
                      value={form.asunto}
                      onChange={(e) => setField("asunto", e.target.value)}
                      placeholder="Asunto o sumilla del documento"
                      className="expField-input"
                    />
                  </div>
                  <div className="expField" style={{ gridColumn: "1 / -1" }}>
                    <label className="expField-label">Resumen{autoBadge("resumen")}</label>
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
                    <label className="expField-label">Nombre{autoBadge("personaNombre")}</label>
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

                {/* Sugerencias inteligentes de ubicación física */}
                {(() => {
                  const last = prefs.lastUbicacion;
                  const hasLast = Object.values(last).some((v) => v && String(v).trim());
                  const hasSugerida = Boolean(
                    ubicacionSugerida &&
                      Object.values(ubicacionSugerida).some((v) => v !== null && v !== ""),
                  );
                  if (!hasLast && !hasSugerida && !siguientePaquete) return null;
                  return (
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 8,
                        marginBottom: 12,
                        alignItems: "center",
                      }}
                    >
                      <span className="expHelpText" style={{ marginTop: 0 }}>
                        <Lightbulb size={12} /> Sugerencias:
                      </span>
                      {hasLast ? (
                        <button
                          type="button"
                          className="expBtn expBtn-secondary expBtn-small"
                          onClick={() => {
                            applyUbicacionSugerida({
                              tipo_almacenamiento: last.tipoAlmacenamiento || null,
                              nro_archivador: last.nroArchivador || null,
                              nro_paquete: last.nroPaquete || null,
                              empastado:
                                last.empastado === "si"
                                  ? true
                                  : last.empastado === "no"
                                    ? false
                                    : null,
                              color_archivador: last.colorArchivador || null,
                              nro_estante: last.nroEstante || null,
                              nro_piso: last.nroPiso || null,
                              nro_local: last.nroLocal || null,
                            });
                          }}
                        >
                          <History size={13} /> Usar última ubicación
                        </button>
                      ) : null}
                      {hasSugerida && ubicacionSugerida ? (
                        <button
                          type="button"
                          className="expBtn expBtn-secondary expBtn-small"
                          onClick={() => applyUbicacionSugerida(ubicacionSugerida)}
                        >
                          <MapPin size={13} /> Misma caja del archivo
                        </button>
                      ) : null}
                      {siguientePaquete ? (
                        <button
                          type="button"
                          className="expBtn expBtn-ghost expBtn-small"
                          onClick={() => setField("nroPaquete", siguientePaquete)}
                          title="Siguiente número de paquete disponible"
                        >
                          <Plus size={13} /> Paquete {siguientePaquete}
                        </button>
                      ) : null}
                    </div>
                  );
                })()}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 12,
                  }}
                >
                  <div className="expField">
                    <label className="expField-label">Tipo de contenedor{autoBadge("tipoAlmacenamiento")}</label>
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
                    <label className="expField-label">Nº de archivador{autoBadge("nroArchivador")}</label>
                    <input
                      value={form.nroArchivador}
                      onChange={(e) => setField("nroArchivador", e.target.value)}
                      placeholder="Ej. 12"
                      className="expField-input"
                    />
                  </div>
                  <div className="expField">
                    <label className="expField-label">Nº de paquete{autoBadge("nroPaquete")}</label>
                    <input
                      value={form.nroPaquete}
                      onChange={(e) => setField("nroPaquete", e.target.value)}
                      placeholder="Opcional"
                      className="expField-input"
                    />
                  </div>
                  <div className="expField">
                    <label className="expField-label">Empastado{autoBadge("empastado")}</label>
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
                    <label className="expField-label">Color{autoBadge("colorArchivador")}</label>
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
                    <label className="expField-label">Estante{autoBadge("nroEstante")}</label>
                    <input
                      value={form.nroEstante}
                      onChange={(e) => setField("nroEstante", e.target.value)}
                      placeholder="Ej. 3"
                      className="expField-input"
                    />
                  </div>
                  <div className="expField">
                    <label className="expField-label">Piso{autoBadge("nroPiso")}</label>
                    <input
                      value={form.nroPiso}
                      onChange={(e) => setField("nroPiso", e.target.value)}
                      placeholder="Ej. 2"
                      className="expField-input"
                    />
                  </div>
                  <div className="expField" style={{ gridColumn: "1 / -1" }}>
                    <label className="expField-label">Local / ambiente{autoBadge("nroLocal")}</label>
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
                        setExtractedData(null);
                        setAutoFilledFields(new Set());
                        setDuplicates([]);
                        setDupsDismissed(false);
                        lastDupSignatureRef.current = "";
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
                <div style={{ display: "flex", gap: 10 }}>
                  {file && !extracting ? (
                    <button
                      type="submit"
                      disabled={uploading}
                      className="expBtn expBtn-ghost"
                      title="Subir ya con los datos actuales (los campos vacíos los completa la IA)"
                    >
                      {uploading ? (
                        <Loader2 size={16} className="expSpin" />
                      ) : (
                        <UploadCloud size={16} />
                      )}
                      Subir ahora
                    </button>
                  ) : null}
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
                </div>
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
          )}

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

              {hasRecentPending ? (
                <div className="expIndexingBanner" role="status">
                  <Loader2 size={14} className="expSpin" />
                  <span>
                    <strong>Indexando con Pinecone...</strong> Los expedientes
                    marcados como &quot;Procesando&quot; están siendo vectorizados y
                    fragmentados. La lista se actualiza automáticamente cada 4s.
                  </span>
                </div>
              ) : null}

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
                            <span>{exp.serie_documento}</span>
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
                            <div style={{ marginTop: 8 }}>
                              <button
                                type="button"
                                className="expBtn expBtn-secondary expBtn-small"
                                onClick={() => void reindexExpediente(exp.id)}
                                disabled={reindexingId === exp.id}
                                title="Reintenta la extracción con OCR de alta calidad"
                              >
                                {reindexingId === exp.id ? (
                                  <Loader2 size={13} className="expSpin" />
                                ) : (
                                  <RefreshCw size={13} />
                                )}
                                Reintentar con OCR de alta calidad
                              </button>
                            </div>
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

      {tab === "responder" && canManage ? (
        <RespuestaPanel showToast={showToast} />
      ) : null}

      {openExp ? (
        <div className="expSlideOverOverlay" onClick={closeSlideOver}>
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
                onClick={closeSlideOver}
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
              {openExp.metadata?.tokenUsage ? (
                <div
                  className="expHelpText"
                  style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}
                  title="Tokens de OpenAI consumidos al procesar este expediente (OCR + análisis). Coste estimado."
                >
                  <Sparkles size={12} />
                  Consumo IA: {openExp.metadata.tokenUsage.totalTokens.toLocaleString("es-PE")} tokens
                  {openExp.metadata.tokenUsage.estimatedCostUsd > 0
                    ? ` · ~$${openExp.metadata.tokenUsage.estimatedCostUsd.toFixed(4)}`
                    : ""}
                  {openExp.metadata.tokenUsage.ocr
                    ? ` · OCR ${openExp.metadata.tokenUsage.ocr.model}${
                        openExp.metadata.tokenUsage.ocr.fromCache ? " (reutilizado)" : ""
                      }`
                    : ""}
                  {openExp.metadata.tokenUsage.analysis
                    ? ` · análisis ${openExp.metadata.tokenUsage.analysis.model}`
                    : ""}
                </div>
              ) : null}
              {editMode ? (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 12,
                    marginTop: 16,
                  }}
                >
                  <div className="expField" style={{ gridColumn: "1 / -1" }}>
                    <label className="expField-label">Título</label>
                    <input
                      className="expField-input"
                      value={String(editForm.title ?? "")}
                      onChange={(e) => setEditField("title", e.target.value)}
                    />
                  </div>
                  <div className="expField">
                    <label className="expField-label">Nº SGD</label>
                    <input
                      className="expField-input"
                      value={String(editForm.sgd_expediente ?? "")}
                      onChange={(e) => setEditField("sgd_expediente", e.target.value)}
                    />
                  </div>
                  <div className="expField">
                    <label className="expField-label">Serie documental</label>
                    <input
                      className="expField-input"
                      value={String(editForm.serie_documento ?? "")}
                      onChange={(e) => setEditField("serie_documento", e.target.value)}
                    />
                  </div>
                  <div className="expField">
                    <label className="expField-label">Año</label>
                    <input
                      type="number"
                      className="expField-input"
                      value={String(editForm.anio ?? "")}
                      onChange={(e) => setEditField("anio", e.target.value)}
                    />
                  </div>
                  <div className="expField">
                    <label className="expField-label">Tipo de documento</label>
                    <input
                      className="expField-input"
                      value={String(editForm.tipo_documento ?? "")}
                      onChange={(e) => setEditField("tipo_documento", e.target.value)}
                    />
                  </div>
                  <div className="expField" style={{ gridColumn: "1 / -1" }}>
                    <label className="expField-label">Oficina</label>
                    <input
                      className="expField-input"
                      value={String(editForm.oficina ?? "")}
                      onChange={(e) => setEditField("oficina", e.target.value)}
                    />
                  </div>
                  <div className="expField" style={{ gridColumn: "1 / -1" }}>
                    <label className="expField-label">Materia</label>
                    <input
                      className="expField-input"
                      value={String(editForm.materia ?? "")}
                      onChange={(e) => setEditField("materia", e.target.value)}
                    />
                  </div>
                  <div className="expField" style={{ gridColumn: "1 / -1" }}>
                    <label className="expField-label">Asunto</label>
                    <textarea
                      className="expField-input"
                      rows={2}
                      value={String(editForm.asunto ?? "")}
                      onChange={(e) => setEditField("asunto", e.target.value)}
                    />
                  </div>
                  <div className="expField" style={{ gridColumn: "1 / -1" }}>
                    <label className="expField-label">Resumen</label>
                    <textarea
                      className="expField-input"
                      rows={3}
                      value={String(editForm.resumen ?? "")}
                      onChange={(e) => setEditField("resumen", e.target.value)}
                    />
                  </div>
                  <div className="expField" style={{ gridColumn: "1 / -1" }}>
                    <label className="expField-label">Observaciones</label>
                    <textarea
                      className="expField-input"
                      rows={2}
                      value={String(editForm.observaciones ?? "")}
                      onChange={(e) => setEditField("observaciones", e.target.value)}
                    />
                  </div>
                  <div className="expField">
                    <label className="expField-label">Tipo de persona</label>
                    <select
                      className="expField-select"
                      value={String(editForm.persona_tipo ?? "")}
                      onChange={(e) => setEditField("persona_tipo", e.target.value)}
                    >
                      <option value="">— Sin persona —</option>
                      <option value="natural">Natural</option>
                      <option value="juridica">Jurídica</option>
                    </select>
                  </div>
                  <div className="expField">
                    <label className="expField-label">Documento de la persona</label>
                    <input
                      className="expField-input"
                      value={String(editForm.persona_documento ?? "")}
                      onChange={(e) => setEditField("persona_documento", e.target.value)}
                    />
                  </div>
                  <div className="expField" style={{ gridColumn: "1 / -1" }}>
                    <label className="expField-label">Nombre / razón social</label>
                    <input
                      className="expField-input"
                      value={String(editForm.persona_nombre ?? "")}
                      onChange={(e) => setEditField("persona_nombre", e.target.value)}
                    />
                  </div>
                  <div className="expField">
                    <label className="expField-label">Tipo de contenedor</label>
                    <select
                      className="expField-select"
                      value={String(editForm.tipo_almacenamiento ?? "")}
                      onChange={(e) => setEditField("tipo_almacenamiento", e.target.value)}
                    >
                      {CONTENEDOR_TIPOS.map((t) => (
                        <option key={t} value={t}>
                          {CONTENEDOR_TIPO_LABELS[t]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="expField">
                    <label className="expField-label">Color</label>
                    <select
                      className="expField-select"
                      value={String(editForm.color_archivador ?? "")}
                      onChange={(e) => setEditField("color_archivador", e.target.value)}
                    >
                      <option value="">— Sin color —</option>
                      {ARCHIVO_COLORES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="expField">
                    <label className="expField-label">Nº de archivador</label>
                    <input
                      className="expField-input"
                      value={String(editForm.nro_archivador ?? "")}
                      onChange={(e) => setEditField("nro_archivador", e.target.value)}
                    />
                  </div>
                  <div className="expField">
                    <label className="expField-label">Nº de paquete</label>
                    <input
                      className="expField-input"
                      value={String(editForm.nro_paquete ?? "")}
                      onChange={(e) => setEditField("nro_paquete", e.target.value)}
                    />
                  </div>
                  <div className="expField">
                    <label className="expField-label">Empastado</label>
                    <select
                      className="expField-select"
                      value={String(editForm.empastado ?? "")}
                      onChange={(e) => setEditField("empastado", e.target.value)}
                    >
                      <option value="">— Sin dato —</option>
                      <option value="si">Sí</option>
                      <option value="no">No</option>
                    </select>
                  </div>
                  <div className="expField">
                    <label className="expField-label">Folio</label>
                    <input
                      className="expField-input"
                      value={String(editForm.folio ?? "")}
                      onChange={(e) => setEditField("folio", e.target.value)}
                    />
                  </div>
                  <div className="expField">
                    <label className="expField-label">Estante</label>
                    <input
                      className="expField-input"
                      value={String(editForm.nro_estante ?? "")}
                      onChange={(e) => setEditField("nro_estante", e.target.value)}
                    />
                  </div>
                  <div className="expField">
                    <label className="expField-label">Piso</label>
                    <input
                      className="expField-input"
                      value={String(editForm.nro_piso ?? "")}
                      onChange={(e) => setEditField("nro_piso", e.target.value)}
                    />
                  </div>
                  <div className="expField" style={{ gridColumn: "1 / -1" }}>
                    <label className="expField-label">Local / ambiente</label>
                    <input
                      className="expField-input"
                      value={String(editForm.nro_local ?? "")}
                      onChange={(e) => setEditField("nro_local", e.target.value)}
                    />
                  </div>
                </div>
              ) : (
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
              )}
            </div>
            {canManage ? (
              <div className="expSlideOver-footer">
                {editMode ? (
                  <>
                    <button
                      type="button"
                      className="expBtn expBtn-ghost"
                      onClick={() => setEditMode(false)}
                      disabled={savingEdit}
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      className="expBtn expBtn-primary"
                      onClick={() => void saveExpedienteEdits()}
                      disabled={savingEdit}
                    >
                      {savingEdit ? <Loader2 size={14} className="expSpin" /> : <Save size={14} />}
                      {savingEdit ? "Guardando…" : "Guardar cambios"}
                    </button>
                  </>
                ) : (
                  <>
                    <button type="button" className="expBtn expBtn-ghost" onClick={startEdit}>
                      <Pencil size={14} /> Editar datos
                    </button>
                    <button
                      type="button"
                      className="expBtn expBtn-ghost"
                      onClick={() => {
                        setReplaceExp(openExp);
                        closeSlideOver();
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
                      onClick={closeSlideOver}
                    >
                      Cerrar
                    </button>
                  </>
                )}
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
          onOpenExpediente={(id) => void openExpedienteById(id)}
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
                  // Cerrar primero para que el aviso de "deshacer" quede visible.
                  const action = confirm.onConfirm;
                  closeConfirm();
                  void action();
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
