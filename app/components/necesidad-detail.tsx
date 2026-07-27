"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  AlertTriangle,
  ArrowRightCircle,
  Briefcase,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleDot,
  Download,
  FileText,
  Loader,
  Pencil,
  Plus,
  ShieldCheck,
  Sparkles,
  Trash2,
  UploadCloud,
  UserRound,
  WandSparkles,
  Wallet,
  X,
} from "lucide-react";
import { decidirSiembra, detectarMarca, GEMELO } from "@/lib/necesidad-denominacion";
import {
  OBJECT_TYPES,
  objectTypeLabel,
} from "@/lib/legal-taxonomy";
// Desde el modulo de topes, NO desde lib/necesidades: ese arrastra los 31
// esquemas de zod al navegador para nada.
import { LIMITES_TEXTO, NOMBRE_MAX } from "@/lib/necesidades-limites";
import {
  type ObjetoFilter,
  PROCESO_SELECCION_OPCIONES,
} from "@/lib/procesos-seleccion";
import { resumenNecesidad } from "@/lib/necesidad-verificacion";
import { REQUERIMIENTO_GUIA } from "@/lib/requerimiento-guia";
import {
  BLOQUES_FICHA,
  MODO_POR_DEFECTO,
  type ModoFicha,
  modoParaSeccion,
  panelesDelModo,
} from "@/lib/necesidad-modos";
import type { CopilotoCampo } from "./necesidad-copiloto";
import { cuiDeCadenaFuncional } from "@/lib/pedido-compra-import";
import { HITO_STATUS_META, type HitosMap, hitosDeFase, progresoDeFase } from "@/lib/procurement-fases";
import type { Necesidad, NecesidadDocumento, ObservacionNecesidad, RiesgoNecesidad } from "@/lib/necesidades";
import { VerificacionNecesidad } from "./necesidad-verificacion-panel";
import { HistorialNecesidad } from "./historial-necesidad";
import { ObservacionesNecesidad } from "./observaciones-necesidad";
import { AdmisibilidadDec } from "./admisibilidad-dec";
import { CoherenciaNecesidad } from "./coherencia-necesidad";
import { FlujoStepper } from "./flujo-stepper";
import type { AdmisibilidadEstado } from "@/lib/necesidad-admisibilidad";
import { tarjetasCoherencia } from "@/lib/necesidad-coherencia";
import { DiffNoObjecion } from "./diff-no-objecion";
import { useSettingsCatalog } from "./use-settings-catalog";
import { PORCENTAJE_LINEA_CORTE, soles } from "@/lib/segmentacion-parametros";
import { useYear } from "@/lib/year-context";
import { ConfirmDialog } from "./confirm-dialog";
import type { NecesidadItem } from "@/lib/necesidad-items";
import { NecesidadItemsEditor } from "./necesidad-items-editor";
import { componerControversias, parseInstituciones } from "@/lib/instituciones-arbitrales";
import type { EettPropuesta, EettRevision, EettTdrDoc } from "./necesidad-eett-tdr-modal";

/**
 * Los dos paneles pesados de la ficha se cargan cuando hacen falta, no al abrir
 * la pagina. El modal de EETT/TDR son 963 lineas que solo ve quien sube un
 * documento, y el copiloto 345 que solo ve quien lo despliega.
 *
 * `ssr: false` porque ninguno de los dos aporta nada al HTML inicial: el modal
 * arranca cerrado y el copiloto oculto. Los tipos se importan aparte con
 * `import type`, que se borra al compilar y no arrastra el modulo.
 */
const EettTdrModal = dynamic(
  () => import("./necesidad-eett-tdr-modal").then((m) => m.EettTdrModal),
  { ssr: false },
);
const NecesidadCopiloto = dynamic(
  () => import("./necesidad-copiloto").then((m) => m.NecesidadCopiloto),
  { ssr: false },
);
import {
  Alert,
  Badge,
  Button,
  EmptyState,
  IconButton,
  buttonClasses,
} from "./ui";
import { cn } from "@/lib/utils";
import {
  FICHA_CTRL,
  FICHA_CTRL_H,
  FICHA_IA,
  FICHA_LABEL,
} from "./necesidad/ficha-estilos";
import { AccionesFlujo } from "./necesidad/acciones-flujo";
import { PanelAdjuntos } from "./necesidad/panel-adjuntos";
import { PanelRiesgos } from "./necesidad/panel-riesgos";
import { CampoFicha } from "./necesidad/campo-ficha";
import { useCallbackEstable } from "./necesidad/usar-callback-estable";
import {
  NO_OBJECION_LABEL,
  type NoObjecionEstado,
  TIPO_AREA_OPCIONES,
  accionesDisponibles,
  estadoNecesidad,
  ladoDeRol,
  necesidadStatusLabel,
  necesidadStatusTono,
  tipoAreaLabel,
} from "@/lib/necesidad-workflow";

// La ficha usa el tipo completo de la necesidad: el GET de la API devuelve las
// ~60 columnas, así que el formulario de edición puede exponerlas todas.
type NecesidadExt = Necesidad;

type Permisos = { manage: boolean; derivar: boolean };

import {
  campoAplica,
  campoObligatorio,
  catalogoCampos,
  FICHA_SECCIONES,
  type FichaField,
  type FichaSection,
  objetosEfectivosDe,
} from "@/lib/necesidad-ficha-secciones";

function DenominacionAsistente({ form }: { form: Record<string, string> }) {
  const marcas = useMemo(() => detectarMarca(form.nombre ?? ""), [form.nombre]);
  const largo = (form.nombre ?? "").trim().length;

  // Solo avisos: si el nombre no menciona marca (Art. 44.6) ni pasa del máximo,
  // no hay nada que mostrar. (Va tras los hooks: no altera su orden.)
  if (marcas.length === 0 && largo <= NOMBRE_MAX) return null;

  return (
    <div className="mt-2 flex flex-col gap-2">
      {marcas.length > 0 ? (
        <Alert tone="warning">
          El nombre menciona <strong>{marcas.map((m) => m.termino).join(", ")}</strong>. El Art. 44.6 prohíbe
          referir marca, fabricante u origen, o describir orientando hacia ellos, salvo compatibilización
          aprobada por la AGA. Descríbelo por desempeño y funcionalidad.
        </Alert>
      ) : null}

      {largo > NOMBRE_MAX ? (
        <Alert tone="danger">
          El nombre tiene <strong>{largo}</strong> caracteres y el máximo es {NOMBRE_MAX}. No se podrá guardar.
          Suele pasar cuando la descripción de catálogo o la población beneficiaria arrastran texto de más:
          acórtalas y recompón el nombre.
        </Alert>
      ) : null}
    </div>
  );
}



// Lookups derivados de FICHA_SECCIONES para el autocompletado con IA.
const CAMPO_LABEL: Record<string, string> = (() => {
  const m: Record<string, string> = { nombre: "Nombre de la contratación", summary: "Resumen / descripción" };
  for (const s of FICHA_SECCIONES) for (const f of s.fields) m[f.api] = f.label;
  return m;
})();

const API_TO_COL: Record<string, keyof Necesidad> = (() => {
  const m: Record<string, keyof Necesidad> = { nombre: "nombre", summary: "summary" };
  for (const s of FICHA_SECCIONES) for (const f of s.fields) m[f.api] = f.col;
  return m;
})();

function Row({
  label,
  value,
  deIA,
}: {
  label: string;
  value: string | number | boolean | null | undefined;
  /** Fecha ISO del traslado si el valor vino de la propuesta IA. */
  deIA?: string;
}) {
  const display = (() => {
    if (typeof value === "boolean") {
      return value ? "✅ Sí" : "❌ No";
    }
    if (value !== null && value !== undefined && String(value).trim() !== "") {
      return String(value);
    }
    return "—";
  })();
  return (
    <div className="grid grid-cols-[minmax(140px,34%)_1fr] items-start gap-3 border-b border-line/70 py-2 last:border-b-0">
      <span className="flex flex-wrap items-center gap-1.5 text-[12.5px] font-semibold text-muted">
        {label}
        {deIA ? (
          <span
            className="inline-flex items-center gap-0.5 rounded-full bg-accent/10 px-1.5 py-px text-[10px] font-bold text-accent"
            title={`Propuesto por la IA desde el EETT/TDR y aprobado en el traslado el ${new Date(deIA).toLocaleString("es-PE")}. Revísalo antes de firmar.`}
          >
            ✦ IA
          </span>
        ) : null}
      </span>
      <span className="text-[13.5px] leading-relaxed text-ink">{display}</span>
    </div>
  );
}

/** Sección-panel de la ficha (tarjeta de superficie con la nueva identidad). */
function Panel({
  id,
  className,
  children,
}: {
  id?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className={cn("flex flex-col gap-4 rounded-[14px] border border-line bg-panel p-5 shadow-card", className)}
    >
      {children}
    </section>
  );
}

/** Cabecera de un panel: icono en pastilla teal + título + contenido extra a la derecha. */
function PanelHead({
  icon,
  title,
  extra,
  className,
}: {
  icon: React.ReactNode;
  title: React.ReactNode;
  extra?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2.5", className)}>
      <span className="grid size-8 shrink-0 place-items-center rounded-[9px] bg-brand-soft text-brand">{icon}</span>
      <h3 className="m-0 text-[15px] font-bold tracking-tight text-ink">{title}</h3>
      {extra ? <span className="ml-auto">{extra}</span> : null}
    </div>
  );
}

/** Color del punto de estado de una sección (índice de navegación de la ficha). */
const NAV_DOT: Record<string, string> = {
  completo: "bg-success",
  pendiente: "bg-warning",
  parcial: "bg-muted/60",
  vacio: "bg-line",
};

/**
 * Pestaña del índice de secciones de la ficha.
 *
 * La tira es horizontal y desplazable, así que la sección en pantalla puede
 * quedar fuera de la vista: cuando esta pestaña pasa a ser la actual se
 * autocentra. Se mueve SOLO el scroll horizontal del contenedor —calculado a
 * mano en vez de `scrollIntoView`, que además arrastraría la página entera
 * mientras el usuario está leyendo.
 */
function SectionNavItem({
  actual,
  estado,
  label,
  count,
  onClick,
}: {
  actual: boolean;
  estado: string;
  label: string;
  count?: string;
  onClick: () => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!actual) return;
    const el = ref.current;
    const tira = el?.parentElement;
    if (!el || !tira) return;
    const destino = el.offsetLeft - tira.offsetLeft - (tira.clientWidth - el.clientWidth) / 2;
    tira.scrollTo({ behavior: "smooth", left: Math.max(0, destino) });
  }, [actual]);
  return (
    <button
      ref={ref}
      type="button"
      title={label}
      aria-current={actual ? "location" : undefined}
      onClick={onClick}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-[12.5px] transition",
        actual
          ? "border-brand bg-brand font-semibold text-white"
          : "border-line bg-surface text-muted hover:border-brand/40 hover:text-ink",
      )}
    >
      <span
        className={cn(
          "size-1.5 shrink-0 rounded-full",
          actual ? "bg-white/70" : (NAV_DOT[estado] ?? "bg-line"),
        )}
      />
      {label}
      {count ? (
        <span className={cn("text-[11px] font-semibold tabular-nums", actual ? "text-white/75" : "text-muted")}>
          {count}
        </span>
      ) : null}
    </button>
  );
}

// Palabras que NO se capitalizan en un título (salvo al inicio). Para volver
// legible un nombre en MAYÚSCULAS sin romper la lectura.
const TITULO_MINUS = new Set([
  "de", "del", "la", "las", "el", "los", "y", "o", "u", "en", "a", "para", "por",
  "con", "al", "e", "the",
]);

/**
 * Convierte un nombre en MAYÚSCULAS a mayúscula/minúscula legible. Solo actúa si
 * el texto está casi todo en mayúsculas (>80% de las letras), para no alterar
 * títulos ya escritos con formato. El original se conserva intacto donde importa
 * (exportaciones, nomenclatura); esto es solo para MOSTRAR.
 */
function tituloLegible(nombre: string | null | undefined): string {
  const s = (nombre ?? "").trim();
  if (!s) return s;
  const soloLetras = s.replace(/[^A-Za-zÁÉÍÓÚÑáéíóúñ]/g, "");
  const mayus = (s.match(/[A-ZÁÉÍÓÚÑ]/g) ?? []).length;
  if (soloLetras.length === 0 || mayus / soloLetras.length < 0.8) return s;
  let primeraPalabra = true;
  return s.toLowerCase().replace(/[a-záéíóúñ]+/g, (w) => {
    const cap = primeraPalabra || !TITULO_MINUS.has(w);
    primeraPalabra = false;
    return cap ? w.charAt(0).toUpperCase() + w.slice(1) : w;
  });
}

// Campos geográficos que se resuelven contra la ubicación configurada de la
// entidad (Configuración → Municipalidad), en vez de escribirse a mano. Es la
// raíz del problema de grafías divergentes (APURIMAC/Apurímac/Apurimac): la
// entidad tiene UNA ubicación, así que el campo es un desplegable, no texto.
const CAMPO_GEO_ENTIDAD: Record<string, "department" | "province" | "city"> = {
  departamento: "department",
  provincia: "province",
  distrito: "city",
};


export function NecesidadDetail({
  necesidadId,
  permisos,
  role,
}: {
  necesidadId: string;
  permisos: Permisos;
  role: string;
}) {
  const [necesidad, setNecesidad] = useState<NecesidadExt | null>(null);
  // Avance de la Fase 1 del expediente derivado, para verlo sin abrirlo.
  const [avanceFase1, setAvanceFase1] = useState<{
    completados: number;
    total: number;
    porcentaje: number;
    pasos: Array<{ code: string; label: string; status: string; statusLabel: string }>;
  } | null>(null);
  const [documentos, setDocumentos] = useState<NecesidadDocumento[]>([]);
  const [riesgos, setRiesgos] = useState<RiesgoNecesidad[]>([]);

  // Módulo EETT/TDR: PDFs de especificaciones técnicas / términos de referencia
  // subidos a la necesidad (indexados en RAG) + modal de revisión/edición.
  type EettDocRow = {
    id: string;
    title: string;
    file_name: string;
    status: string;
    metadata?: {
      tipo?: "eett" | "tdr";
      contenidoHtml?: string;
      textoExtraido?: string;
      /** Propuesta generada y persistida por el endpoint `generar`. */
      propuesta?: EettPropuesta;
      /** api del campo → fecha ISO en que se trasladó desde la propuesta IA. */
      trasladados?: Record<string, string>;
      revision?: EettRevision;
    };
    created_at: string;
  };
  const [eettDocs, setEettDocs] = useState<EettDocRow[]>([]);
  const [eettUploading, setEettUploading] = useState(false);
  const [eettTipo, setEettTipo] = useState<"eett" | "tdr">("tdr");
  const [eettModal, setEettModal] = useState<{
    doc: EettTdrDoc;
    initialText: string;
    initialHtml?: string;
    initialRevision?: EettRevision | null;
    initialPropuesta?: EettPropuesta | null;
  } | null>(null);
  const eettFileRef = useRef<HTMLInputElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deriving, setDeriving] = useState(false);

  // Se incrementa tras cada transición para refrescar el historial (timeline).
  const [histRecarga, setHistRecarga] = useState(0);
  // Observaciones por campo (D2): la DEC comenta un campo, el área usuaria subsana.
  const [observaciones, setObservaciones] = useState<ObservacionNecesidad[]>([]);
  // Snapshots de versión (D3): para el diff del ciclo de no objeción.
  const [versiones, setVersiones] = useState<
    Array<{ transicion: string | null; snapshot: Record<string, unknown>; created_at: string }>
  >([]);
  // Admisibilidad (P3) sembrada por la carga combinada, para que el panel no haga
  // su propio fetch al abrir. Null mientras carga.
  const [admisibilidadInicial, setAdmisibilidadInicial] = useState<{ items: AdmisibilidadEstado; actualizadoPor: string | null } | null>(null);
  // Fechas de cada hito del flujo (C), desde audit_logs; para el stepper.
  const [hitosEstado, setHitosEstado] = useState<Record<string, string>>({});
  // Ítems del requerimiento (sección 3.2). Viven en su propia tabla, no en una
  // columna de `necesidades`, así que se guardan aparte del resto de la ficha.
  const [items, setItems] = useState<NecesidadItem[]>([]);
  const [itemsGuardados, setItemsGuardados] = useState<string>("[]");
  // UIT del ejercicio: sin ella no se puede juzgar el tope del contrato menor.
  // Se pide a `parametros-segmentacion`, que la expone a cualquier autenticado
  // (entity_settings es solo-admin por RLS y quien formula no lo es).
  const [uitValor, setUitValor] = useState<number | null>(null);
  useEffect(() => {
    let cancelado = false;
    void (async () => {
      try {
        const r = await fetch("/api/configuracion/parametros-segmentacion", { cache: "no-store" });
        const d = await r.json();
        if (!cancelado && r.ok) setUitValor(typeof d.uitValor === "number" ? d.uitValor : null);
      } catch {
        // Sin UIT el cuadro lo dice y no bloquea nada.
      }
    })();
    return () => {
      cancelado = true;
    };
  }, []);

  /**
   * Campos de la ficha que se rellenaron desde la propuesta IA, con la fecha
   * del traslado. Se acumulan los de TODOS los EETT/TDR subidos: puede haber
   * uno por lote o una versión corregida, y el origen sigue siendo la IA.
   *
   * Resaltarlos no es decoración: una vez aplicado el traslado, la ficha se ve
   * igual la escriba quien la escriba, y quien la revisa antes de firmar no
   * puede distinguir lo redactado por el área usuaria de lo propuesto por un
   * modelo. Esa distinción es justo la que hay que mirar con más cuidado.
   */
  // Memoizado: se pasa a cada campo memoizado, y un Map nuevo por render
  // devolveria arrays nuevos y anularia su memo.
  const obsPendientesPorCampo = useMemo(() => {
    const m = new Map<string, ObservacionNecesidad[]>();
    for (const o of observaciones) {
      if (o.resuelto) continue;
      m.set(o.campo, [...(m.get(o.campo) ?? []), o]);
    }
    return m;
  }, [observaciones]);

  const camposDeIA = useMemo(() => {
    const out = new Map<string, string>();
    for (const d of eettDocs) {
      for (const [api, fecha] of Object.entries(d.metadata?.trasladados ?? {})) {
        const previa = out.get(api);
        if (!previa || fecha > previa) out.set(api, fecha);
      }
    }
    return out;
  }, [eettDocs]);

  /**
   * La matriz de riesgos aplica a TODA contratación.
   *
   * Estuvo limitada a obras porque no se le encontraba anclaje normativo. Lo
   * tiene, y es directo — Art. 44.3, literal: "Al elaborar el requerimiento se
   * inicia la identificación y evaluación de riesgos asociados al proceso de
   * contratación, así como su asignación a alguna de las partes, lo cual sirve
   * de insumo para la elaboración de la estrategia de contratación". El
   * artículo no distingue por objeto, así que la ficha tampoco.
   *
   * (El campo de texto `gestion_riesgos` sí sigue siendo de obras: ese pertenece
   * a las condiciones específicas de obra de las bases estándar, no al 44.3.)
   */
  const riesgosAplica = Boolean(necesidad);

  const [confirmDeleteNecesidad, setConfirmDeleteNecesidad] = useState(false);
  const [deletingNecesidad, setDeletingNecesidad] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  // Campo al que llevar el foco tras un guardado fallido. En una ref y no en
  // estado: es un dato de un solo uso que no debe provocar un render por si
  // mismo. Quien dispara el efecto es `fieldErrors`, que cambia de identidad en
  // cada intento fallido.
  const focoPendiente = useRef<string | null>(null);
  // Campos en los que el usuario ha escrito. Sirve para que la validacion al
  // salir del campo NO pinte de rojo lo que solo se ha recorrido con el
  // tabulador: en una ficha de nueve secciones, tabular para ver que hay
  // encenderia el formulario entero sin que nadie se haya equivocado.
  //
  // En estado y no en una ref (que seria lo natural para un dato que no pinta
  // nada) porque los manejadores se crean durante el render y leer `.current`
  // ahi es justo lo que prohibe react-hooks/refs. No cuesta renders: se anota
  // al escribir, y escribir ya provoca uno con `setFichaField`.
  const [camposTocados, setCamposTocados] = useState<Set<string>>(new Set());
  // Áreas usuarias ya registradas: alimentan el autocompletado del campo, para
  // que la próxima "SUB GERENCIA…" reutilice la grafía existente en vez de
  // crear una variante nueva (mismo criterio que la geografía por catálogo).
  const [areasSugeridas, setAreasSugeridas] = useState<string[]>([]);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  // Edición de la Ficha de Necesidad (todos los campos del PATCH).
  const [fichaEdit, setFichaEdit] = useState(false);
  // Campos que el borrador de este navegador cambia respecto a lo guardado.
  // El borrador se restaura al abrir "Editar ficha", así que sin avisar parece
  // que el trabajo está registrado cuando solo vive en localStorage.
  const [camposBorrador, setCamposBorrador] = useState<string[]>([]);
  const [fichaForm, setFichaForm] = useState<Record<string, string>>({});
  // Panel del copiloto IA del requerimiento (redactar/revisar campos).
  const [copilotoAbierto, setCopilotoAbierto] = useState(false);
  // Se queda en true tras la primera apertura y ya no vuelve atras: es lo que
  // permite cargar el modulo bajo demanda SIN desmontar el panel al cerrarlo,
  // que se llevaria por delante el borrador que el usuario tenga a medias.
  const [copilotoMontado, setCopilotoMontado] = useState(false);
  /**
   * Sección que el usuario está mirando, para marcarla en el índice.
   *
   * Con el índice en columna a la izquierda se veían todas las entradas a la vez
   * y bastaba con el punto de completitud. En una barra horizontal fija, que
   * además se desplaza de lado, hace falta un «aquí estás»: si no, es una fila
   * de botones sin referencia.
   */
  const [seccionEnVista, setSeccionEnVista] = useState<string>("");
  // Solicitud de "redactar campo" disparada desde el botón ✨ de un campo.
  // El nonce hace que pulsar el mismo campo dos veces vuelva a disparar.
  const [copilotoRedactar, setCopilotoRedactar] = useState<{ key: string; nonce: number } | null>(null);
  const pedirRedactarIA = (api: string) => {
    setCopilotoAbierto(true);
    setCopilotoMontado(true);
    setCopilotoRedactar((prev) => ({ key: api, nonce: (prev?.nonce ?? 0) + 1 }));
  };

  // Manejadores de identidad fija para <CampoFicha>, que esta memoizado. Una
  // funcion nueva por render seria una prop nueva por render, y el campo se
  // repintaria igual: la memo solo sirve si TODAS las props aguantan.
  const cambiarCampo = useCallbackEstable((api: string, valor: string) => setFichaField(api, valor));
  const redactarConIA = useCallbackEstable((api: string) => pedirRedactarIA(api));
  const abrirEettEstable = useCallbackEstable((doc: { id: string }) => {
    const encontrado = eettDocs.find((d) => d.id === doc.id);
    if (encontrado) abrirEett(encontrado);
  });
  const subirEettEstable = useCallbackEstable((archivo: File, tipo: "eett" | "tdr") => {
    void subirEett(archivo, tipo);
  });
  const marcarTocado = useCallback((api: string) => {
    setCamposTocados((prev) => (prev.has(api) ? prev : new Set(prev).add(api)));
  }, []);
  /** `null` retira el error. */
  const marcarError = useCallback((api: string, mensaje: string | null) => {
    setFieldErrors((prev) => {
      // Mismo objeto si nada cambia: evita un render y no despierta al efecto
      // que lleva el foco, que escucha a `fieldErrors`.
      if (mensaje === null ? !prev[api] : prev[api] === mensaje) return prev;
      const n = { ...prev };
      if (mensaje === null) delete n[api];
      else n[api] = mensaje;
      return n;
    });
  }, []);
  // Campos que se están copiando de su gemelo y que nadie ha tocado a mano.
  const [sembrados, setSembrados] = useState<ReadonlySet<string>>(new Set());
  // El formulario tiene cambios del usuario (no solo la carga inicial). Sin
  // esto, abrir la ficha dispararía un autoguardado sin que nadie escriba.
  const [formSucio, setFormSucio] = useState(false);
  const [autoguardado, setAutoguardado] = useState<"" | "guardando" | "guardado" | "error">("");
  // Bloqueo optimista: sello `updated_at` de la versión cargada. Se envía en cada
  // guardado; el servidor rechaza (409) si otro actor guardó en medio. Es un ref
  // porque el autoguardado NO recarga, y debe avanzar tras su propio guardado
  // para no chocar consigo mismo en la siguiente pulsación.
  const baseUpdatedAtRef = useRef<string | null>(null);
  const [conflictoGuardado, setConflictoGuardado] = useState(false);
  // Aviso suave de admisibilidad: si la DEC da conforme con puntos sin marcar, se
  // pregunta antes de continuar (no bloquea; solo hace consciente el salto).
  const [savingFicha, setSavingFicha] = useState(false);
  // Enfocar el registro en los datos obligatorios (Ley 32069). Los opcionales
  // se revelan por sección o cambiando a "Todos los campos".
  const [obligatoriosOnly, setObligatoriosOnly] = useState(true);
  const [optionalExpanded, setOptionalExpanded] = useState<Set<string>>(new Set());
  const [wizardMode, setWizardMode] = useState(true);

  /**
   * Marca en el índice la sección que se está viendo.
   *
   * Se observan los contenedores por su id (`ficha-datos-principales` y los
   * `ficha-sec-*`) en vez de una lista de secciones: esa lista se calcula dentro
   * del render y aquí no llega. `rootMargin` recorta la parte de arriba para que
   * la sección activa sea la que está bajo la barra (que mide ~44 px y se pega
   * arriba del todo: la app no tiene cabecera fija que la tape).
   */
  useEffect(() => {
    if (!fichaEdit || wizardMode) return;
    const nodos = Array.from(
      document.querySelectorAll<HTMLElement>('#ficha-datos-principales, [id^="ficha-sec-"]'),
    );
    if (nodos.length === 0) return;
    const visibles = new Set<string>();
    const observador = new IntersectionObserver(
      (entradas) => {
        for (const e of entradas) {
          if (e.isIntersecting) visibles.add(e.target.id);
          else visibles.delete(e.target.id);
        }
        // La primera en orden de documento entre las visibles: al bajar, la
        // marca avanza cuando la anterior termina de salir.
        const actual = nodos.find((n) => visibles.has(n.id))?.id ?? "";
        setSeccionEnVista((previa) => (previa === actual ? previa : actual));
      },
      { rootMargin: "-72px 0px -55% 0px", threshold: 0 },
    );
    for (const n of nodos) observador.observe(n);
    return () => observador.disconnect();
  }, [fichaEdit, wizardMode, obligatoriosOnly]);
  const [wizardStep, setWizardStep] = useState(0);
  // "Modo simple": oculta citas de artículos y notas legales, dejando solo el
  // texto en lenguaje llano. Pensado para el área usuaria no técnica. Se recuerda
  // por navegador.
  // Modo de trabajo. Arranca en Redactar y recuerda el ultimo usado, por
  // navegador. Eso reparte por rol SIN una tabla de roles: quien trabaja en la
  // DEC acabara abriendo en Revisar porque es donde trabaja.
  const [modo, setModo] = useState<ModoFicha>(MODO_POR_DEFECTO);
  useEffect(() => {
    try {
       
      const guardado = localStorage.getItem("ficha-modo-trabajo");
      if (guardado === "redactar" || guardado === "revisar") setModo(guardado);
    } catch { /* ignora */ }
  }, []);
  
  function cambiarModo(siguiente: ModoFicha) {
    setModo(siguiente);
    try { localStorage.setItem("ficha-modo-trabajo", siguiente); } catch { /* ignora */ }
  }

  // En Revisar la ficha es de SOLO LECTURA: quien revisa necesita leer lo que
  // juzga, no editarlo. Se deriva del estado en vez de duplicarlo, para que no
  // puedan quedar en desacuerdo.
  const fichaEditable = fichaEdit && modo === "redactar";
  
  const [modoSimple, setModoSimple] = useState(false);
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setModoSimple(localStorage.getItem("ficha-modo-simple") === "1");
    } catch { /* ignora */ }
  }, []);

  // El sello base sigue a la necesidad cargada (carga inicial, reload, transición).
  // Los guardados que no recargan (autoguardado) lo avanzan por su cuenta.
  useEffect(() => {
    baseUpdatedAtRef.current = necesidad?.updated_at ?? null;
  }, [necesidad?.updated_at]);

  // Catálogo de áreas usuarias en uso (facetas del listado). Falla en silencio:
  // sin sugerencias el campo sigue siendo un texto libre normal.
  useEffect(() => {
    let vivo = true;
    fetch("/api/necesidades/facetas", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { areas?: Array<{ valor: string }> } | null) => {
        if (vivo && d?.areas) setAreasSugeridas(d.areas.map((a) => a.valor).filter(Boolean));
      })
      .catch(() => { /* sin sugerencias */ });
    return () => { vivo = false; };
  }, []);
  function toggleModoSimple() {
    setModoSimple((v) => {
      const next = !v;
      try { localStorage.setItem("ficha-modo-simple", next ? "1" : "0"); } catch { /* ignora */ }
      return next;
    });
  }

  // Autocompletado con IA desde EETT/TDR.
  const [extracting, setExtracting] = useState(false);
  const [extractResult, setExtractResult] = useState<
    {
      campos: Record<string, string | number>;
      // Origen del resultado: documento subido (EETT/TDR) o modelo del proceso.
      origen?: "documento" | "modelo";
      // Campos que el proceso EXIGE (solo origen "modelo"), para marcarlos.
      exigidos?: string[];
      resumen?: string | null;
      method?: string;
      extractionMethod?: string;
      pageCount?: number;
      textLength?: number;
      textPreview?: string;
    } | null
  >(null);
  const [extractSelected, setExtractSelected] = useState<Set<string>>(new Set());
  const [applyingExtract, setApplyingExtract] = useState(false);
  const [completandoModelo, setCompletandoModelo] = useState(false);
  // Campos que el requerimiento del proceso elegido EXIGE (derivado del modelo).
  // Es una marca de sesión (hint visual), no bloquea el guardado.
  const [exigidosModelo, setExigidosModelo] = useState<ReadonlySet<string>>(new Set());
  const extractFileRef = useRef<HTMLInputElement | null>(null);

  /**
   * Campos que EXIGE el modelo de requerimiento del proceso elegido.
   *
   * La ficha tiene ~70 campos y ningún procedimiento los pide todos. En vez de
   * que el área usuaria decida campo por campo si le toca, se le pregunta al
   * MODELO OFICIAL cargado en Configuración → Unidad de abastecimiento, que es
   * quien ya responde eso. La respuesta se cachea en el propio PDF-modelo, así
   * que solo la primera necesidad de cada proceso paga la consulta.
   *
   * Si no hay modelo cargado, la lista queda vacía y la ficha vuelve a su
   * criterio por objeto: se degrada, no se rompe.
   */
  useEffect(() => {
    // Reactivo al FORMULARIO: si el usuario cambia el Tipo de objeto o el Tipo de
    // proceso en la ficha, se recargan los campos que exige ESE proceso. En
    // lectura (fichaForm aún vacío) manda el dato guardado de la necesidad.
    const proceso = fichaForm.tipoProcesoSeleccion ?? necesidad?.tipo_proceso_seleccion ?? "";
    const objeto = fichaForm.tipoObjeto ?? necesidad?.tipo_objeto ?? "";
    let cancelado = false;
    void (async () => {
      // El vaciado va dentro del bloque asíncrono, no en el cuerpo del efecto:
      // un setState síncrono ahí encadena renders.
      if (!proceso || !objeto) {
        if (!cancelado) setExigidosModelo(new Set());
        return;
      }
      try {
        const res = await fetch("/api/necesidades/campos-exigidos", {
          body: JSON.stringify({
            camposObjetivo: catalogoCampos(proceso, objeto),
            tipoObjeto: objeto,
            tipoProcesoSeleccion: proceso,
          }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        });
        if (!res.ok || cancelado) return;
        const payload = await res.json();
        if (!cancelado && Array.isArray(payload.exigidos)) setExigidosModelo(new Set(payload.exigidos));
      } catch {
        /* sin modelo la ficha sigue funcionando con su criterio por objeto */
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [
    fichaForm.tipoProcesoSeleccion,
    fichaForm.tipoObjeto,
    necesidad?.tipo_proceso_seleccion,
    necesidad?.tipo_objeto,
  ]);

  const { entity: configuredEntity, processTypes: procesosEntidad } = useSettingsCatalog();
  const { year } = useYear();

  // Asociación blanda con los "Procesos de contratación" que la unidad de
  // abastecimiento tiene activos (Configuración). El desplegable de la ficha
  // conserva su catálogo por objeto (con PDF y guía del copiloto) y NO se
  // restringe —el tipo de proceso del área usuaria es una referencia
  // anticipada, no vinculante (la DEC lo confirma en A4)—, pero ordena primero
  // los procedimientos que la entidad efectivamente realiza.
  //
  // Los dos catálogos usan taxonomías distintas (la config es por procedimiento
  // legal: "Licitación Pública"; la ficha es por objeto: "Licitación Pública
  // para Bienes"), así que el emparejamiento es por prefijo normalizado: una
  // opción de la ficha se considera "que realiza la entidad" si algún proceso
  // activo de la config es prefijo de su nombre.
  const opcionesProcesoAgrupadas = useMemo(() => {
    const norm = (s: string) =>
      s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
    const activos = procesosEntidad
      .filter((p) => p.active)
      .map((p) => norm(p.label))
      .filter(Boolean);
    const realiza: typeof PROCESO_SELECCION_OPCIONES = [];
    const otros: typeof PROCESO_SELECCION_OPCIONES = [];
    for (const opt of PROCESO_SELECCION_OPCIONES) {
      if (!opt.value) continue; // "— Por definir —" se pinta aparte, siempre primero
      const on = norm(opt.value);
      (activos.some((a) => on.startsWith(a)) ? realiza : otros).push(opt);
    }
    return { realiza, otros };
  }, [procesosEntidad]);
  const lado = ladoDeRol(role);
  // La ficha permanece EDITABLE aunque la necesidad ya esté vinculada a un
  // expediente. El área usuaria mantiene el requerimiento como fuente viva y el
  // expediente lo vuelve a incorporar con "Traer datos" (que solo rellena
  // huecos, no pisa lo decidido por la DEC).
  //
  // Antes se congelaba al derivar (process_id ⇒ ficha bloqueada), para que el
  // expediente no citara un requerimiento que cambió después. Ese bloqueo se
  // reemplazó por un AVISO no bloqueante (ver más abajo): editar una necesidad
  // vinculada puede exigir volver a traer los datos al expediente o la no
  // objeción del área usuaria (Art. 44.7), pero ya no impide guardar.
  const necesidadVinculada = Boolean(necesidad?.process_id);

  // Cargar el avance de la Fase 1 cuando la necesidad está derivada. Si el
  // fetch falla se queda en null y el panel simplemente no muestra la barra:
  // el enlace al expediente sigue funcionando igual.
  useEffect(() => {
    const pid = necesidad?.process_id;
    let cancelado = false;
    if (!pid) {
      // Limpieza diferida: evita el setState síncrono dentro del efecto (la
      // regla react-hooks/set-state-in-effect) sin cambiar el comportamiento.
      queueMicrotask(() => {
        if (!cancelado) setAvanceFase1(null);
      });
      return () => {
        cancelado = true;
      };
    }
    void (async () => {
      try {
        const res = await fetch(`/api/processes/${pid}/hitos`);
        if (!res.ok) return;
        const payload = (await res.json()) as { hitos?: HitosMap };
        if (cancelado || !payload.hitos) return;
        const progreso = progresoDeFase("F1", payload.hitos);
        const pasos = hitosDeFase("F1").map((h) => {
          const st = payload.hitos?.[h.code]?.status ?? "pendiente";
          return { code: h.code, label: h.label, status: st, statusLabel: HITO_STATUS_META[st].label };
        });
        setAvanceFase1({ completados: progreso.completados, pasos, porcentaje: progreso.porcentaje, total: progreso.total });
      } catch {
        /* sin barra; el enlace sigue */
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [necesidad?.process_id]);
  const puedeAdjuntar = permisos.manage;
  const tipoObj = necesidad?.tipo_objeto;

  // --- Módulo EETT/TDR ---
  async function loadEett() {
    try {
      const res = await fetch(`/api/necesidades/${necesidadId}/eett-tdr`, { cache: "no-store" });
      const data = await res.json();
      if (res.ok) setEettDocs(data.documents ?? []);
    } catch {
      /* la lista simplemente no se muestra */
    }
  }
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadEett();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [necesidadId]);

  // Observaciones y versiones llegan en la carga combinada (reload). Tras una
  // transición, runAction ya llama a reload() —que refresca los snapshots—, así
  // que no hace falta un efecto aparte; histRecarga solo avisa a la línea de tiempo.

  // `tipo` explícito: el campo de la sección 3.4 tiene su propio selector, y
  // depender del estado compartido hacía que subir desde un sitio usara el tipo
  // elegido en el otro.
  async function subirEett(file: File, tipo: "eett" | "tdr" = eettTipo) {
    setEettUploading(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("tipo", tipo);
      const res = await fetch(`/api/necesidades/${necesidadId}/eett-tdr`, { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "No se pudo subir el EETT/TDR.");
        return;
      }
      await loadEett();
      // Abre el modal con el texto extraído del PDF para revisarlo/editarlo.
      setEettModal({
        doc: { id: data.document.id, tipo: data.document.tipo, file_name: data.document.file_name },
        initialText: data.text ?? "",
      });
    } catch {
      setError("No se pudo conectar para subir el EETT/TDR.");
    } finally {
      setEettUploading(false);
      if (eettFileRef.current) eettFileRef.current.value = "";
    }
  }

  function abrirEett(d: EettDocRow) {
    setEettModal({
      doc: { id: d.id, tipo: d.metadata?.tipo === "eett" ? "eett" : "tdr", file_name: d.file_name },
      // Prioridad del contenido del editor: (1) lo editado y guardado (HTML), si
      // no (2) el TEXTO EXTRAÍDO del PDF del EETT/TDR — nunca la descripción del
      // pedido, que es de la ficha, no del documento subido.
      initialText: d.metadata?.textoExtraido ?? "",
      initialHtml: d.metadata?.contenidoHtml,
      initialRevision: d.metadata?.revision ?? null,
      // Propuesta ya generada: se reabre sin volver a llamar a la IA.
      initialPropuesta: d.metadata?.propuesta ?? null,
    });
  }

  async function borrarEett(docId: string) {
    setError("");
    try {
      const res = await fetch(`/api/necesidades/${necesidadId}/eett-tdr?docId=${docId}`, { method: "DELETE" });
      if (res.ok) await loadEett();
      else setError("No se pudo eliminar el EETT/TDR.");
    } catch {
      setError("No se pudo conectar para eliminar el EETT/TDR.");
    }
  }

  /**
   * Filtra los campos del requerimiento según lo elegido. Manda el TIPO DE
   * PROCEDIMIENTO (referencia inicial): solo se registran los campos aplicables
   * a los objetos de ese procedimiento (según sus Bases Estándar). Si no se ha
   * elegido procedimiento, cae al filtro por tipo de objeto.
   */
  /**
   * Objetos efectivos del requerimiento: si el proceso acota objetos, manda ese
   * ámbito (afinado al objeto del expediente si cae dentro); si no, el objeto
   * declarado. Es la base tanto del filtrado de campos como del obligatorio
   * condicional (`obligatorioPara`).
   */
  function objetosEfectivos(): ObjetoFilter[] {
    return objetosEfectivosDe(fichaForm.tipoProcesoSeleccion, tipoObj);
  }

  /** ¿El campo es obligatorio para el objeto/proceso actual? Contempla el
   *  obligatorio incondicional, el condicional por objeto (`obligatorioPara`) y
   *  el condicional por procedimiento (`obligatorioEnProceso`). */
  function campoEsObligatorio(field: FichaField): boolean {
    // Con el requerimiento desagregado, los campos que describen UNA prestación
    // dejan de exigirse: el dato vive en cada ítem. Se comprueba antes que nada
    // porque manda sobre cualquier otro criterio de obligatoriedad.
    if (field.noExigibleConItems && items.length > 0) return false;
    return campoObligatorio(field, objetosEfectivos(), fichaForm.tipoProcesoSeleccion);
  }

  function camposParaObjeto(fields: FichaField[]): FichaField[] {
    // Los `oculto` (p. ej. Centro de costo) no se muestran ni se validan; su
    // valor se guarda igual desde `construirPayload`, que recorre section.fields.
    // El procedimiento ACOTA los objetos posibles (Art. 44.10) y además puede
    // acotar campos concretos por sí mismo (`mostrarEnProceso`).
    const efectivos = objetosEfectivos();
    const proc = fichaForm.tipoProcesoSeleccion;
    return fields.filter((f) => !f.oculto && campoAplica(f, efectivos, proc));
  }

  /** ¿El campo tiene un valor capturado en el formulario? */
  function tieneValor(field: FichaField): boolean {
    const v = fichaForm[field.api];
    return v !== undefined && v !== null && String(v).trim() !== "" && v !== "false";
  }

  /** Prioridad de orden: obligatorio (0) → recomendado (1) → opcional (2). */
  function prioridadCampo(f: FichaField): number {
    return campoEsObligatorio(f) ? 0 : f.recomendado ? 1 : 2;
  }

  /** Campos a mostrar en una sección según el modo (obligatorios vs todos).
   *  Se ordenan SIEMPRE con los obligatorios primero (luego recomendados y por
   *  último opcionales); el orden es estable, así se conserva la secuencia de
   *  las Bases dentro de cada grupo. En modo "solo obligatorios" se conservan
   *  además los opcionales ya rellenados para no ocultar datos del usuario. */
  function camposVisibles(section: FichaSection): { visibles: FichaField[]; ocultosOpcionales: number } {
    // Los SUBGRUPOS no se reordenan: son los apartados a), b), c)… del modelo
    // oficial, y su orden es el del documento que se va a firmar. Antes se
    // ordenaba la seccion entera por prioridad, y eso los partia: «Penalidad por
    // mora» (recomendado) se iba con los recomendados y «Otras penalidades»
    // (opcional) al final, con lo que «f) Penalidades» se pintaba DOS veces y el
    // apartado quedaba roto en dos trozos distantes.
    //
    // Dentro de cada subgrupo si manda la prioridad, que es lo que se buscaba:
    // primero lo obligatorio. `sort` es estable, asi que a igual prioridad se
    // conserva la secuencia de las Bases.
    const declarados = camposParaObjeto(section.fields);
    const posSubgrupo = new Map<string, number>();
    declarados.forEach((f, idx) => {
      const clave = f.subgrupo ?? "";
      if (!posSubgrupo.has(clave)) posSubgrupo.set(clave, idx);
    });
    const all = [...declarados].sort((a, b) => {
      const sa = posSubgrupo.get(a.subgrupo ?? "") ?? 0;
      const sb = posSubgrupo.get(b.subgrupo ?? "") ?? 0;
      return sa !== sb ? sa - sb : prioridadCampo(a) - prioridadCampo(b);
    });
    if (!obligatoriosOnly || optionalExpanded.has(section.title)) {
      return { visibles: all, ocultosOpcionales: 0 };
    }
    // Con el MODELO del proceso cargado, manda el modelo: enseña exactamente lo
    // que ese procedimiento exige para ese objeto, ni un campo más. Es la
    // respuesta que el formato oficial ya da, y ahorra al área usuaria decidir
    // campo por campo si le toca.
    //
    // Sin modelo (no hay PDF cargado para ese proceso) se cae al criterio por
    // objeto: obligatorios + el contenido que el Art. 44.2 pide en todo
    // requerimiento. Degradar así es mejor que enseñar los ~70 campos.
    //
    // En ambos casos se conserva lo YA RELLENADO: ocultar un dato que alguien
    // escribió sería hacerlo desaparecer sin avisar.
    const visibles =
      exigidosModelo.size > 0
        ? all.filter((f) => campoEsObligatorio(f) || exigidosModelo.has(f.api) || tieneValor(f))
        : all.filter((f) => campoEsObligatorio(f) || f.recomendado || tieneValor(f));
    // Los acompañantes entran con su pareja, no por su cuenta.
    const apisVisibles = new Set(visibles.map((f) => f.api));
    const conAcompanantes = all.filter(
      (f) => apisVisibles.has(f.api) || (f.juntoA ? apisVisibles.has(f.juntoA) : false),
    );
    return { visibles: conAcompanantes, ocultosOpcionales: all.length - conAcompanantes.length };
  }

  /**
   * Los campos obligatorios del proceso actual (Tipo de objeto + Tipo de proceso).
   * Con modelo cargado manda el MODELO (lista exigida del PDF de requerimiento);
   * sin modelo, el criterio por objeto de la app. Reactivo al formulario: al
   * cambiar objeto/proceso, la lista cambia.
   */
  /**
   * ¿Este requerimiento tiene que llevar este campo?
   *
   * UNICA definicion de «exigible»: lo que la ficha declara obligatorio MAS lo que
   * el PDF-modelo del procedimiento anade. Antes cada sitio la reimplementaba y la
   * pantalla acababa enseñando tres numeros a la vez —«88% · faltan 2», «17/23» y
   * «14/16 obligatorios»—, sobre conjuntos distintos y sin nada que los separara.
   */
  function campoExigible(field: FichaField): boolean {
    const procesoActual = fichaForm.tipoProcesoSeleccion ?? necesidad?.tipo_proceso_seleccion ?? "";
    const objetoActual = (fichaForm.tipoObjeto ?? necesidad?.tipo_objeto ?? "") as ObjetoFilter | "";
    const efectivos = objetosEfectivosDe(procesoActual, (objetoActual || undefined) as ObjetoFilter | undefined);
    return campoObligatorio(field, efectivos, procesoActual) || exigidosModelo.has(field.api);
  }

  /**
   * Avance del requerimiento: UN numero para toda la pantalla.
   *
   * `modo` solo cambia de donde se lee el valor —del formulario mientras se edita,
   * del dato guardado al leer—, nunca QUE se cuenta. Asi la cabecera, el panel de
   * obligatorios y la barra de edicion no pueden discrepar entre si.
   */
  function avanceRequerimiento(modo: "edicion" | "lectura") {
    const campos = obligatoriosDelProceso();
    const hecho = (f: FichaField) => {
      if (modo === "edicion") return tieneValor(f);
      const v = necesidad?.[f.col];
      return v !== null && v !== undefined && String(v).trim() !== "" && v !== false;
    };
    const total = campos.length;
    const done = campos.filter(hecho).length;
    return { done, faltan: total - done, pct: total > 0 ? Math.round((done / total) * 100) : 0, total };
  }


  function obligatoriosDelProceso(): FichaField[] {
    const procesoActual = fichaForm.tipoProcesoSeleccion ?? necesidad?.tipo_proceso_seleccion ?? "";
    const objetoActual = (fichaForm.tipoObjeto ?? necesidad?.tipo_objeto ?? "") as ObjetoFilter | "";
    const efectivos = objetosEfectivosDe(procesoActual, (objetoActual || undefined) as ObjetoFilter | undefined);
    const items: FichaField[] = [];
    for (const section of FICHA_SECCIONES) {
      if (section.mostrarPara && !(objetoActual && section.mostrarPara.includes(objetoActual as ObjetoFilter))) continue;
      for (const f of section.fields) {
        if (f.oculto || !campoAplica(f, efectivos, procesoActual)) continue;
        // El modelo SUMA, no resta. La lista que sale del PDF marca lo que ese
        // procedimiento exige DE MÁS; no puede degradar un campo que la ficha —y con
        // ella la norma— ya declara obligatorio. Antes la sustituía por completo: con
        // el modelo cargado, «Finalidad pública» o «Área usuaria» dejaban de contar
        // como obligatorios si la IA no los había listado.
        if (campoExigible(f)) items.push(f);
      }
    }
    return items;
  }

  /**
   * Panel-resumen de los obligatorios del proceso: separa la atención sin ocultar
   * nada (las secciones completas siguen debajo). `modo` decide de dónde sale el
   * "hecho": del formulario en edición, del dato guardado en lectura. Al pulsar un
   * chip se salta al campo (abre la ficha y lo enfoca).
   */
  function renderPanelObligatorios(modo: "edicion" | "lectura"): React.ReactNode {
    const items = obligatoriosDelProceso();
    if (items.length === 0) return null;
    const hechoDe = (f: FichaField): boolean => {
      if (modo === "edicion") return tieneValor(f);
      const v = necesidad?.[f.col];
      return v !== null && v !== undefined && String(v).trim() !== "" && v !== false;
    };
    // Del calculo compartido: el panel no puede contar distinto que la cabecera.
    const { done } = avanceRequerimiento(modo);
    const proceso = fichaForm.tipoProcesoSeleccion ?? necesidad?.tipo_proceso_seleccion ?? "";
    return (
      // La franja izquierda pasa de marca a éxito cuando no queda nada: el cambio
      // de color es la señal, no hace falta un mensaje aparte.
      <div
        className={cn(
          "mb-3 flex flex-col gap-2 rounded-[10px] border border-l-[3px] border-line p-3",
          done >= items.length ? "border-l-success bg-success-soft" : "border-l-brand bg-brand-soft",
        )}
      >
        <div className="flex items-center gap-[7px] text-[13px] text-ink">
          <CheckCircle2 size={15} />
          <strong className="font-semibold">Obligatorios de este proceso</strong>
          <span
            className={cn(
              "ml-auto text-xs font-semibold tabular-nums",
              done >= items.length ? "text-success" : "text-brand",
            )}
          >
            {done}/{items.length}
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {items.map((f) => {
            const hecho = hechoDe(f);
            return (
              <button
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border py-[3px] pl-2 pr-2.5 text-xs",
                  "outline-none transition-colors focus-visible:shadow-[var(--shadow-focus)]",
                  hecho
                    ? "border-success/30 bg-success-soft text-success"
                    : "border-line bg-surface text-muted hover:border-brand",
                )}
                key={f.api}
                onClick={() => irACampo(f.api)}
                title={hecho ? "Completado · ir al campo" : "Pendiente · ir al campo"}
                type="button"
              >
                <span className={cn("font-bold leading-none", !hecho && "text-warning")}>
                  {hecho ? "✓" : "○"}
                </span>
                {f.label}
              </button>
            );
          })}
        </div>
        {exigidosModelo.size > 0 && proceso ? (
          <p className="m-0 text-[11px] text-muted">
            Definidos por el modelo de requerimiento de «{proceso}» (Configuración → Unidad de abastecimiento).
          </p>
        ) : null}
      </div>
    );
  }

  async function reload() {
    try {
      // Una sola petición combinada: necesidad + documentos + riesgos +
      // observaciones + versiones + admisibilidad. Antes cada uno tenía su fetch
      // (y su round-trip) al abrir; ahora el servidor los resuelve en paralelo.
      const response = await fetch(`/api/necesidades/${necesidadId}`);
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "No se pudo cargar la necesidad.");
        return;
      }
      setNecesidad(payload.necesidad);
      setDocumentos(payload.documentos ?? []);
      setRiesgos(payload.riesgos ?? []);
      setObservaciones(payload.observaciones ?? []);
      setVersiones(payload.versiones ?? []);
      if (payload.admisibilidad) setAdmisibilidadInicial(payload.admisibilidad);
      setHitosEstado(payload.hitosEstado ?? {});
      const itemsCargados: NecesidadItem[] = payload.items ?? [];
      setItems(itemsCargados);
      // Copia para saber si el cuadro tiene cambios sin guardar.
      setItemsGuardados(JSON.stringify(itemsCargados));
      setError("");
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  }

  // `reload` se declara de nuevo en cada render; los paneles memoizados
  // necesitan una identidad fija.
  const recargar = useCallbackEstable(reload);
  // Tras una transición hay que recargar la necesidad Y refrescar la línea de
  // tiempo: el historial es una petición aparte que no viaja en la recarga.
  const trasTransicion = useCallbackEstable(async () => {
    setHistRecarga((n) => n + 1);
    await reload();
  });

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [necesidadId]);

  function toStr(value: unknown): string {
    return value === null || value === undefined ? "" : String(value);
  }

  const DRAFT_KEY = `ficha-draft-${necesidadId}`;

  /**
   * Los valores tal como están GUARDADOS en la base, sin borrador encima.
   * Es la referencia contra la que se detecta qué sigue sin guardarse.
   */
  function valoresDeLaBase(n: Necesidad): Record<string, string> {
    const base: Record<string, string> = {
      nombre: toStr(n.nombre),
      tipoObjeto: toStr(n.tipo_objeto),
      tipoProcesoSeleccion: toStr(n.tipo_proceso_seleccion),
      tipoArea: toStr(n.tipo_area),
    };
    for (const section of FICHA_SECCIONES) {
      for (const field of section.fields) {
        base[field.api] = field.checkbox ? String(Boolean(n[field.col])) : toStr(n[field.col]);
      }
    }
    // El CUI de las fichas importadas ANTES de que el parser mapeara `act_proy`
    // vive dentro de la cadena funcional del SIGA
    // ("03-006-0010-2661009-6000008" → el 4.º segmento). El dato nunca se
    // perdió, solo no tenía columna: se rescata en vez de obligar a teclearlo.
    if (!base.cui) base.cui = cuiDeCadenaFuncional(n.cadena_funcional) ?? "";
    return base;
  }


  /**
   * Abre la ficha y lleva al campo que hay que arreglar. Sin esto, la
   * verificación diría "falta la finalidad pública" y dejaría al usuario
   * buscándola entre 59 campos.
   */
  function irACampo(api: string) {
    // La ficha solo es editable en Redactar: sin este cambio, pulsar «ir al
    // campo» desde un diagnostico en Revisar no haria nada visible.
    cambiarModo("redactar");
    startFichaEdit();
    // Formulario completo: en modo "paso a paso" el campo podría estar en otro
    // paso y no existir aún en el DOM. Con todo desplegado el salto siempre acierta.
    setWizardMode(false);
    // Tras el render del formulario: enfocar antes no encuentra el campo.
    requestAnimationFrame(() => {
      const el = document.querySelector<HTMLElement>(`[data-campo="${api}"]`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      el?.querySelector<HTMLElement>("input, textarea, select")?.focus();
    });
  }

  function startFichaEdit() {
    // En Revisar la ficha es de solo lectura.
    cambiarModo("redactar");
    if (!necesidad) return;
    const initial = valoresDeLaBase(necesidad);
    if (!initial.entidad && configuredEntity?.name) initial.entidad = configuredEntity.name;
    if (!initial.unidadEjecutora && configuredEntity?.executingUnit) initial.unidadEjecutora = configuredEntity.executingUnit;
    if (!initial.anioFiscal) initial.anioFiscal = String(year);
    if (initial.areaUsuaria && !initial.centroCosto) initial.centroCosto = initial.areaUsuaria;
    if (initial.centroCosto && !initial.areaUsuaria) initial.areaUsuaria = initial.centroCosto;
    // Cargar borrador local si existe
    const base = valoresDeLaBase(necesidad);
    const delBorrador: string[] = [];
    try {
      const draft = localStorage.getItem(DRAFT_KEY);
      if (draft) {
        const parsed = JSON.parse(draft) as Record<string, string>;
        for (const key of Object.keys(parsed)) {
          if (key in initial || key === "nombre" || key === "tipoObjeto" || key === "tipoArea") {
            initial[key] = parsed[key];
            // Lo que el borrador cambia respecto a la base es, literalmente,
            // trabajo que solo existe en este navegador.
            if ((parsed[key] ?? "") !== (base[key] ?? "")) delBorrador.push(key);
          }
        }
      }
    } catch { /* ignora */ }
    setCamposBorrador(delBorrador);
    // Capar cualquier valor que exceda su tope (p. ej. un borrador con texto de
    // IA demasiado largo): así la ficha se puede guardar y el autoguardado deja
    // de fallar con 400. Sanea el estado atascado en este mismo navegador.
    for (const [key, lim] of Object.entries(LIMITES_TEXTO)) {
      const v = initial[key];
      if (typeof v === "string" && v.length > lim) initial[key] = v.slice(0, lim);
    }
    // Lo que ya está guardado es del usuario: nada se siembra sobre ello.
    setSembrados(new Set());
    setFormSucio(false);
    setAutoguardado("");
    setConflictoGuardado(false);
    baseUpdatedAtRef.current = necesidad.updated_at ?? null;
    setFichaForm(initial);
    setFichaEdit(true);
  }

  /** Descarta el borrador del navegador y recarga lo guardado. */
  function descartarBorrador() {
    try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignora */ }
    if (necesidad) {
      const base = valoresDeLaBase(necesidad);
      if (!base.anioFiscal) base.anioFiscal = String(year);
      setFichaForm(base);
    }
    // Descartar es volver a lo guardado: no hay nada que autoguardar, y la
    // siembra vuelve a partir de cero.
    setFormSucio(false);
    setSembrados(new Set());
    setAutoguardado("");
    setCamposBorrador([]);
    setFieldErrors({});
    setError("");
  }

  function setFichaField(api: string, value: string) {
    // Capado defensivo al tope del schema: evita que un texto largo (típicamente
    // redactado por el copiloto IA en un campo de tope corto) deje la ficha
    // imposible de guardar (PATCH 400). Los campos numéricos no están en el mapa.
    const limite = LIMITES_TEXTO[api];
    if (limite && value.length > limite) value = value.slice(0, limite);
    setFormSucio(true);
    // Nombre ↔ Descripción detallada: siembra, no espejo.
    //
    // No son el mismo dato: el nombre es la DENOMINACIÓN (va al ASUNTO del
    // informe A2, a la matriz y a la nomenclatura del expediente) y la
    // descripción es el Art. 126.1 (especificaciones técnicas o TDR), que
    // además compone el alcance de A3. Encadenarlos en espejo haría que
    // escribir uno destruya el otro.
    //
    // Así que el que está vacío se siembra con el que se escribe, y se sigue
    // sembrando MIENTRAS nadie lo haya tocado a mano (si solo se mirara "está
    // vacío", dejaría de copiar en la segunda pulsación). En cuanto el usuario
    // escribe en él, deja de seguir al otro para siempre.
    //
    // La decisión se toma AQUÍ y no dentro del updater de setFichaForm: ese
    // updater debe ser puro, porque React puede ejecutarlo durante el render y
    // más de una vez.
    const { sembrar, sembrados: proximos } = decidirSiembra({
      api,
      maxNombre: NOMBRE_MAX,
      sembrados,
      value,
      valorGemelo: fichaForm[GEMELO[api] ?? ""] ?? "",
    });
    if (GEMELO[api]) setSembrados(proximos);
    setFichaForm((prev) => {
      const next = { ...prev, [api]: value };
      if (sembrar) next[sembrar] = value;
      // Guardar borrador local
      try { localStorage.setItem(DRAFT_KEY, JSON.stringify(next)); } catch { /* ignora */ }
      // Área usuaria y Centro de costo son el mismo campo
      if (api === "areaUsuaria") next.centroCosto = value;
      if (api === "centroCosto") next.areaUsuaria = value;
      // Auto-calcular costo_total = cantidad × costo_unitario
      if (api === "cantidad" || api === "costoUnitario") {
        const cant = Number(api === "cantidad" ? value : prev.cantidad ?? "0");
        const cu = Number(api === "costoUnitario" ? value : prev.costoUnitario ?? "0");
        if (Number.isFinite(cant) && Number.isFinite(cu) && cant > 0 && cu > 0) {
          next.costoTotal = String(cant * cu);
        } else if (api === "costoUnitario" && (value === "" || value === "0")) {
          next.costoTotal = "";
        }
      }
      return next;
    });
  }

  /** Cuerpo del PATCH a partir del formulario. Lo comparten el guardado
   *  explícito y el autoguardado, para que no puedan divergir. */
  function construirPayload(): Record<string, unknown> {
    const payload: Record<string, unknown> = {
      nombre: (fichaForm.nombre ?? "").trim(),
      tipoObjeto: fichaForm.tipoObjeto || undefined,
      // "" es un valor legítimo ("— Por definir —"): se envía tal cual (no
      // `|| undefined`) para que volver a esa opción limpie la columna (→ null).
      tipoProcesoSeleccion: fichaForm.tipoProcesoSeleccion ?? "",
      tipoArea: fichaForm.tipoArea || undefined,
    };
    for (const section of FICHA_SECCIONES) {
      for (const field of section.fields) {
        const raw = (fichaForm[field.api] ?? "").trim();
        if (field.checkbox) {
          payload[field.api] = raw === "true";
        } else if (field.kind === "number") {
          if (raw === "") continue;
          const num = Number(raw);
          if (Number.isFinite(num)) payload[field.api] = num;
        } else {
          payload[field.api] = raw;
        }
      }
    }
    return payload;
  }

  /**
   * Autoguardado: persiste lo escrito sin cerrar el formulario ni exigir los
   * obligatorios (se guarda a medias a propósito; el estado de la necesidad no
   * cambia hasta "Guardar ficha").
   *
   * En silencio y sin recargar: no toca `error` ni cierra la edición, porque
   * dispara mientras el usuario escribe. Lo único que sí hace es limpiar el
   * borrador local — una vez guardado en la base, el aviso de "sin guardar"
   * sería mentira.
   */
  async function autoguardarFicha() {
    const payload = construirPayload();
    // El schema pide min(3) y max(NOMBRE_MAX): con un nombre a medio escribir
    // se guarda todo lo demás y se deja el nombre para el guardado explícito.
    const nombre = String(payload.nombre ?? "");
    if (nombre.length < 3 || nombre.length > NOMBRE_MAX) delete payload.nombre;
    setAutoguardado("guardando");
    try {
      const response = await fetch(`/api/necesidades/${necesidadId}`, {
        body: JSON.stringify(payload),
        headers: {
          "Content-Type": "application/json",
          ...(baseUpdatedAtRef.current ? { "X-Base-Updated-At": baseUpdatedAtRef.current } : {}),
        },
        method: "PATCH",
      });
      if (response.status === 409) {
        // Otro actor guardó en medio: se detiene el autoguardado y se avisa. El
        // borrador local se conserva para no perder lo tecleado antes de recargar.
        setConflictoGuardado(true);
        setAutoguardado("error");
        return;
      }
      if (!response.ok) {
        setAutoguardado("error");
        return;
      }
      const data = await response.json().catch(() => null);
      if (data?.necesidad?.updated_at) baseUpdatedAtRef.current = data.necesidad.updated_at;
      setAutoguardado("guardado");
      try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignora */ }
      setCamposBorrador([]);
    } catch {
      setAutoguardado("error");
    }
  }

  // Autoguardado: 1,5 s tras la última tecla. El temporizador se reinicia en
  // cada cambio, así que escribiendo seguido no dispara nada; salta al parar.
  //
  // `fichaForm` entero en las dependencias: cualquier cambio del formulario
  // (incluida la siembra del gemelo) debe persistirse.
  useEffect(() => {
    if (!fichaEdit || !formSucio || conflictoGuardado) return;
    const t = setTimeout(() => { void autoguardarFicha(); }, 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fichaForm, fichaEdit, formSucio, conflictoGuardado]);

  /**
   * Lleva el foco al primer campo obligatorio sin completar tras un guardado
   * fallido. Antes el usuario se quedaba donde estaba y tenia que buscar a ojo
   * cual faltaba, que en una ficha de nueve secciones no es poca cosa.
   *
   * El ancla es el `data-campo` que ya llevaba cada <label>. Corre despues del
   * commit, con `saveFicha` habiendo salido ya del modo paso a paso si hacia
   * falta, de modo que el control esta montado.
   */
  useEffect(() => {
    const api = focoPendiente.current;
    if (!api) return;
    focoPendiente.current = null;
    const contenedor = document.querySelector<HTMLElement>(`[data-campo="${CSS.escape(api)}"]`);
    if (!contenedor) return;
    const control = contenedor.querySelector<HTMLElement>("input, select, textarea");
    // `preventScroll` y luego `block: "center"`: el desplazamiento propio del
    // foco dejaba el campo pegado al borde, y ahora hay ademas una barra de
    // secciones fija en la parte de arriba.
    control?.focus({ preventScroll: true });
    (control ?? contenedor).scrollIntoView({ behavior: "smooth", block: "center" });
  }, [fieldErrors]);

  async function saveFicha() {
    if ((fichaForm.nombre ?? "").trim().length < 3) {
      setError("El nombre de la contratación no puede quedar vacío.");
      return;
    }
    const newErrors: Record<string, string> = {};
    for (const section of FICHA_SECCIONES) {
      // Solo se exigen los obligatorios que APLICAN al tipo de objeto: si no se
      // filtra, campos como "Sistema de entrega" (solo servicios/obras) bloquean
      // el guardado de una necesidad de bienes sin estar siquiera visibles.
      for (const field of camposParaObjeto(section.fields)) {
        if (campoEsObligatorio(field) && !(fichaForm[field.api] ?? "").trim()) {
          newErrors[field.api] = `Campo obligatorio`;
        }
      }
    }
    if (Object.keys(newErrors).length > 0) {
      setFieldErrors(newErrors);
      // `newErrors` se llena recorriendo FICHA_SECCIONES y las claves de texto
      // conservan el orden de insercion: la primera ES la primera del formulario.
      const faltan = Object.keys(newErrors);
      const primero = faltan[0];
      const comoSeLlama = CAMPO_LABEL[primero] ?? primero;
      // Se nombra el campo en vez de decir "marcados en rojo": el color no es una
      // senal utilizable por quien no lo distingue ni por un lector de pantalla.
      setError(
        faltan.length === 1
          ? `Falta un campo obligatorio: «${comoSeLlama}».`
          : `Faltan ${faltan.length} campos obligatorios. El primero es «${comoSeLlama}».`,
      );
      focoPendiente.current = primero;
      // El salto al formulario completo se decide AQUI, en respuesta al clic, no
      // dentro del efecto. En "paso a paso" se guarda desde el ultimo paso, asi
      // que el campo que falta casi siempre esta en otro paso y ni siquiera esta
      // montado; ademas el formulario completo ensena todos los errores a la vez
      // y el indice de secciones dice cuantos faltan en cada una.
      if (wizardMode) setWizardMode(false);
      return;
    }
    setFieldErrors({});
    setCamposTocados(new Set());
    setSavingFicha(true);
    setError("");
    try {
      const payload = construirPayload();
      const response = await fetch(`/api/necesidades/${necesidadId}`, {
        body: JSON.stringify(payload),
        headers: {
          "Content-Type": "application/json",
          ...(baseUpdatedAtRef.current ? { "X-Base-Updated-At": baseUpdatedAtRef.current } : {}),
        },
        method: "PATCH",
      });
      const data = await response.json();
      if (response.status === 409) {
        // Conflicto: se mantiene la edición abierta y el borrador, para que el
        // usuario recargue (botón del aviso) y reaplique lo suyo sin perderlo.
        setConflictoGuardado(true);
        setError(data.error ?? "Otro usuario guardó cambios mientras editabas.");
        return;
      }
      if (!response.ok) {
        setError(data.error ?? "No se pudo guardar la ficha.");
        return;
      }
      // Los ítems viven en su propia tabla, así que van en una llamada aparte y
      // SOLO si el cuadro cambió: reemplazar la lista borra y reinserta, y
      // hacerlo en cada guardado gastaría ids nuevos sin motivo.
      if (JSON.stringify(items) !== itemsGuardados) {
        const resItems = await fetch(`/api/necesidades/${necesidadId}/items`, {
          body: JSON.stringify({ items }),
          headers: { "Content-Type": "application/json" },
          method: "PUT",
        });
        if (!resItems.ok) {
          const err = await resItems.json().catch(() => ({}));
          // La ficha SÍ se guardó; decirlo evita que se reintente todo.
          setError(
            `La ficha se guardó, pero los ítems no: ${err.error ?? "error desconocido"}. Vuelve a intentarlo.`,
          );
          return;
        }
      }
      setFichaEdit(false);
      // Guardado con éxito: el borrador ya no representa nada pendiente.
      try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignora */ }
      setCamposBorrador([]);
      await reload();
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setSavingFicha(false);
    }
  }


  // ===== Observaciones por campo (D2) =====
  async function cargarObservaciones() {
    try {
      const r = await fetch(`/api/necesidades/${necesidadId}/observaciones`, { cache: "no-store" });
      const data = await r.json();
      if (r.ok) setObservaciones(data.observaciones ?? []);
    } catch {
      /* silencioso: sin observaciones la ficha sigue funcionando */
    }
  }

  async function agregarObservacion(campo: string, comentario: string) {
    const r = await fetch(`/api/necesidades/${necesidadId}/observaciones`, {
      body: JSON.stringify({ campo, comentario }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    if (r.ok) await cargarObservaciones();
    else setError("No se pudo registrar la observación.");
  }

  async function resolverObservacion(id: string, resuelto: boolean) {
    const r = await fetch(`/api/necesidades/${necesidadId}/observaciones`, {
      body: JSON.stringify({ id, resuelto }),
      headers: { "Content-Type": "application/json" },
      method: "PATCH",
    });
    if (r.ok) await cargarObservaciones();
  }

  async function derivar() {
    setDeriving(true);
    setError("");
    try {
      const response = await fetch(`/api/necesidades/${necesidadId}/derivar`, { method: "POST" });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "No se pudo derivar a expediente.");
        return;
      }
      await reload();
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setDeriving(false);
    }
  }


  async function handleExtract(file: File) {
    setExtracting(true);
    setError("");
    setExtractResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/necesidades/${necesidadId}/documentos/extraer`, { method: "POST", body: fd });
      const payload = await res.json();
      if (!res.ok) {
        setError(payload.error ?? "No se pudo leer el documento con IA.");
        return;
      }
      const campos: Record<string, string | number> = payload.campos ?? {};
      // Marca por defecto los campos que la necesidad tiene vacíos (no pisar lo lleno).
      const sel = new Set<string>();
      for (const key of Object.keys(campos)) {
        const col = API_TO_COL[key];
        const cur = col ? necesidad?.[col] : undefined;
        if (cur === null || cur === undefined || String(cur).trim() === "") sel.add(key);
      }
      setExtractResult(payload);
      setExtractSelected(sel);
    } catch {
      setError("No se pudo conectar para leer el documento.");
    } finally {
      setExtracting(false);
    }
  }

  function toggleExtractSel(key: string) {
    setExtractSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  /**
   * Campos de texto aplicables a un proceso/objeto dados (independiente de
   * `fichaForm`, para poder invocarse desde la vista de solo lectura). Solo
   * texto/textarea: los numéricos, fechas, checkbox y el editor de requisitos
   * no se autocompletan (dato de entidad o control especial). Devuelve api +
   * label + sección + obligatorio, tal como los espera el endpoint.
   */
  function camposObjetivoDelProceso(
    proceso: string,
    objeto?: string | null,
  ): Array<{ api: string; label: string; seccion: string; baseLegal: string; obligatorio: boolean }> {
    const obj = (objeto ?? undefined) as ObjetoFilter | undefined;
    const efectivos = objetosEfectivosDe(proceso, obj);
    const out: Array<{ api: string; label: string; seccion: string; baseLegal: string; obligatorio: boolean }> = [];
    for (const section of FICHA_SECCIONES) {
      for (const f of section.fields) {
        if (f.oculto) continue;
        if (f.checkbox || f.kind === "number" || f.kind === "date" || f.kind === "requisitos") continue;
        if (!campoAplica(f, efectivos, proceso)) continue;
        out.push({
          api: f.api,
          label: f.label,
          seccion: section.title,
          baseLegal: f.baseLegal ?? "",
          obligatorio: campoObligatorio(f, efectivos, proceso),
        });
      }
    }
    return out;
  }

  /**
   * Secciones de la ficha que la propuesta de EETT/TDR PUEDE llenar.
   *
   * Es una lista blanca a propósito. Fuera quedan la identificación, el
   * presupuesto, el planeamiento (PEI/POI) y las verificaciones de la DEC: son
   * hechos del SIGA/PAC o actos de la DEC, no contenido del requerimiento. Si la
   * IA los redactara, los inventaría — y `montoEstimado` en particular alimenta
   * el cálculo del 25% de la cláusula MYPE de la propia propuesta, así que
   * pisarlo corrompería el documento del que sale.
   */
  const SECCIONES_TRASLADABLES = ["3.1", "3.2", "3.3", "3.4", "3.5", "Lugar de entrega"];

  /**
   * Campos que el traslado desde la propuesta puede rellenar, con su sección.
   *
   * A diferencia de `camposObjetivoDelProceso` (que alimenta el autocompletado y
   * excluye numéricos y requisitos), aquí SÍ entran cantidad, plazo y los
   * requisitos del 72.3: la propuesta los redacta y son justo los que hoy se
   * quedaban como prosa dentro de `descripcion_detallada`.
   */
  function camposTrasladables(): Array<{ api: string; label: string; seccion: string; kind?: string }> {
    const proc = necesidad?.tipo_proceso_seleccion ?? "";
    const efectivos = objetosEfectivosDe(proc, (necesidad?.tipo_objeto ?? undefined) as ObjetoFilter | undefined);
    const out: Array<{ api: string; label: string; seccion: string; kind?: string }> = [];
    for (const section of FICHA_SECCIONES) {
      if (!SECCIONES_TRASLADABLES.some((p) => section.title.startsWith(p))) continue;
      for (const f of section.fields) {
        if (f.oculto || f.checkbox || f.kind === "date") continue;
        if (!campoAplica(f, efectivos, proc)) continue;
        // Con el modelo del proceso cargado, solo se traslada lo que ESE
        // procedimiento exige: pedirle a la IA que rellene campos que el
        // formato no pide llena la ficha de contenido que nadie va a usar y
        // encarece la extracción.
        if (exigidosModelo.size > 0 && !exigidosModelo.has(f.api) && !campoEsObligatorio(f)) continue;
        // El `kind` viaja para que el modal convierta los numéricos antes del
        // PATCH: la extracción devuelve todo como texto y el schema los rechaza.
        out.push({ api: f.api, label: f.label, seccion: section.title, kind: f.kind });
      }
    }
    return out;
  }

  /** Valor actual de cada campo trasladable, para que el modal enseñe qué pisa. */
  function valoresActualesTrasladables(): Record<string, string> {
    const out: Record<string, string> = {};
    if (!necesidad) return out;
    for (const c of camposTrasladables()) {
      const col = API_TO_COL[c.api];
      const v = col ? necesidad[col] : undefined;
      if (v !== null && v !== undefined && String(v).trim() !== "") out[c.api] = String(v);
    }
    return out;
  }

  /**
   * Analiza el requerimiento del proceso elegido (PDF-modelo anclado + guía +
   * norma) y propone valores para los campos vacíos aplicables. Reutiliza el
   * panel de revisión del autocompletado: el usuario elige qué aplicar. Además
   * marca los campos que ese proceso EXIGE. Trabaja sobre la necesidad guardada.
   */
  async function completarConModelo() {
    if (!necesidad) return;
    const proceso = toStr(necesidad.tipo_proceso_seleccion);
    if (!proceso) {
      setError("Elige y guarda primero el tipo de proceso de selección en la ficha.");
      return;
    }
    setCompletandoModelo(true);
    setError("");
    setExtractResult(null);
    try {
      const objetivo = camposObjetivoDelProceso(proceso, necesidad.tipo_objeto);
      const camposLlenos = objetivo
        .map((c) => ({ c, col: API_TO_COL[c.api] }))
        .filter(({ col }) => {
          const v = col ? necesidad[col] : undefined;
          return v !== null && v !== undefined && String(v).trim() !== "";
        })
        .map(({ c, col }) => ({ label: c.label, valor: String(necesidad[col!]) }));
      const res = await fetch(`/api/necesidades/${necesidadId}/completar-modelo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipoProcesoSeleccion: proceso,
          tipoObjeto: toStr(necesidad.tipo_objeto),
          camposObjetivo: objetivo,
          camposLlenos,
        }),
      });
      const payload = await res.json();
      if (!res.ok) {
        setError(payload.error ?? "No se pudo completar con el modelo.");
        return;
      }
      const campos: Record<string, string | number> = payload.campos ?? {};
      const exigidos: string[] = payload.exigidos ?? [];
      // Preselecciona solo los campos vacíos, para no pisar lo ya escrito.
      const sel = new Set<string>();
      for (const key of Object.keys(campos)) {
        const col = API_TO_COL[key];
        const cur = col ? necesidad?.[col] : undefined;
        if (cur === null || cur === undefined || String(cur).trim() === "") sel.add(key);
      }
      setExtractResult({ campos, origen: "modelo", exigidos, resumen: null });
      setExtractSelected(sel);
      setExigidosModelo(new Set(exigidos));
    } catch {
      setError("No se pudo conectar para completar con el modelo.");
    } finally {
      setCompletandoModelo(false);
    }
  }

  async function applyExtract() {
    if (!extractResult) return;
    const body: Record<string, unknown> = {};
    for (const key of extractSelected) {
      if (extractResult.campos[key] !== undefined) body[key] = extractResult.campos[key];
    }
    if (Object.keys(body).length === 0) {
      setExtractResult(null);
      return;
    }
    setApplyingExtract(true);
    setError("");
    try {
      const res = await fetch(`/api/necesidades/${necesidadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await res.json();
      if (!res.ok) {
        setError(payload.error ?? "No se pudieron aplicar los campos.");
        return;
      }
      await reload();
      setExtractResult(null);
      setExtractSelected(new Set());
    } catch {
      setError("No se pudo conectar para aplicar los campos.");
    } finally {
      setApplyingExtract(false);
    }
  }

  async function deleteNecesidad() {
    setDeletingNecesidad(true);
    setError("");
    try {
      const res = await fetch(`/api/necesidades/${necesidadId}`, { method: "DELETE" });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        setError(payload.error ?? "No se pudo eliminar la necesidad.");
        setConfirmDeleteNecesidad(false);
        return;
      }
      window.location.href = "/necesidades";
    } catch {
      setError("No se pudo conectar para eliminar la necesidad.");
      setConfirmDeleteNecesidad(false);
    } finally {
      setDeletingNecesidad(false);
    }
  }


  if (loading) {
    return (
      <div className="tw flex flex-col gap-4">
        <div className="h-24 animate-pulse rounded-[14px] bg-line/70" />
        <div className="flex gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 flex-1 animate-pulse rounded-[12px] bg-line/70" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <div className="h-96 animate-pulse rounded-[14px] bg-line/70" />
          <div className="flex flex-col gap-3">
            <div className="h-40 animate-pulse rounded-[14px] bg-line/70" />
            <div className="h-40 animate-pulse rounded-[14px] bg-line/70" />
          </div>
        </div>
      </div>
    );
  }

  if (!necesidad) {
    return (
      <div className="tw">
        <EmptyState
          icon={<AlertTriangle className="size-6" />}
          title="Necesidad no encontrada"
          description={error || "No pudimos cargar esta necesidad. Puede que se haya eliminado o que no tengas acceso."}
          action={
            <Link href="/necesidades">
              <Button variant="secondary">Volver a la lista</Button>
            </Link>
          }
        />
      </div>
    );
  }

  const estado = estadoNecesidad(necesidad.status);
  // ¿Está lista para remitirse? Se calcula sobre lo GUARDADO, no sobre el
  // borrador: remitir envía a la DEC lo que hay en la base, no lo que se ve en
  // pantalla —que puede ser trabajo sin guardar de este navegador—.
  const verificacion = resumenNecesidad(necesidad);
  // Observaciones por campo (D2): lista para el desplegable de alta, mapa de las
  // pendientes por campo (para el badge) y una etiqueta legible por `api`.
  const camposObservables = FICHA_SECCIONES.flatMap((s) => s.fields)
    .filter((f) => !f.oculto)
    .map((f) => ({ api: f.api, label: f.label }));
  const campoLabel = (api: string) => CAMPO_LABEL[api] ?? api;
  // Diff del ciclo de no objeción (D3): última versión remitida por el área
  // usuaria vs la última propuesta de la DEC. Solo campos del requerimiento que
  // cambiaron, con su valor antes y después.
  const valorNorm = (v: unknown) => (v === null || v === undefined ? "" : String(v).trim());
  const versionAntes = [...versiones].reverse().find((v) => v.transicion === "remitir");
  const versionDespues = [...versiones].reverse().find((v) => v.transicion === "solicitar_no_objecion");
  const mostrarDiffNoObjecion =
    necesidad.status === "no_objecion_pendiente" &&
    Boolean(versionAntes) &&
    Boolean(versionDespues) &&
    new Date(versionDespues!.created_at) >= new Date(versionAntes!.created_at);
  const cambiosNoObjecion = mostrarDiffNoObjecion
    ? FICHA_SECCIONES.flatMap((s) => s.fields)
        .filter((f) => !f.oculto)
        .map((f) => ({
          label: f.label,
          antes: valorNorm(versionAntes!.snapshot[f.col]),
          despues: valorNorm(versionDespues!.snapshot[f.col]),
        }))
        .filter((c) => c.antes !== c.despues)
    : [];
  // Avance de los campos obligatorios de la ficha (visible sin entrar a editar).
  // Mismo calculo que el panel y que la barra de edicion. En edicion se mide
  // sobre el formulario, para que el numero avance mientras se escribe.
  const avanceOblig = avanceRequerimiento(fichaEdit ? "edicion" : "lectura");
  // La lista se calcula tambien dentro de <AccionesFlujo>. Es la misma funcion
  // pura con las mismas entradas, y aqui solo se usa para NOMBRAR el siguiente
  // paso; pasarsela como prop le habria dado un array nuevo por render y habria
  // anulado su memoizacion, que es lo que evita repintar el flujo al teclear.
  const acciones = permisos.manage
    ? accionesDisponibles(necesidad.status, lado, { tieneExpediente: Boolean(necesidad.process_id) })
    : [];
  // Acción recomendada para avanzar el requerimiento (la primaria si existe).
  const siguienteAccion = acciones.find((a) => a.variante === "primary") ?? acciones[0];
  const noObjecion = necesidad.no_objecion as NoObjecionEstado;

  // Vínculo con el PAC (Transversal 3): la línea de corte por cuantía (Art. 125.2)
  // es el 10% del PAC de bienes y servicios de la entidad. Comparando el monto de
  // esta necesidad se anticipa si será de ALTA o BAJA cuantía. Es una REFERENCIA:
  // el 10% "puro" vale para lo ya programado; si no está en el PAC, el expediente
  // recalcula sumando su monto. Por eso se rotula como referencia, no decisión.
  const pacBS = configuredEntity?.pacBienesServicios ?? null;
  const lineaCorte = pacBS != null && pacBS > 0 ? Math.round(pacBS * PORCENTAJE_LINEA_CORTE * 100) / 100 : null;
  const montoNec = Number(necesidad.monto_estimado);
  const cuantia =
    lineaCorte != null && Number.isFinite(montoNec) && montoNec > 0
      ? montoNec > lineaCorte
        ? "alta"
        : "baja"
      : null;

  // Orientación de procedimiento por cuantía (Art. 125.2). SOLO para bienes y
  // servicios —obras y consultoría de obra se rigen por los criterios del
  // Art. 153, sin línea de corte— y SOLO cuando el tipo de proceso aún no está
  // definido: es un empujón para no dejar el campo huérfano, no una decisión. La
  // DEC fija el procedimiento en su estrategia (A4).
  const objetoConLineaCorte = necesidad.tipo_objeto === "bienes" || necesidad.tipo_objeto === "servicios";
  const tipoProcesoDefinido = Boolean((necesidad.tipo_proceso_seleccion ?? "").trim());
  const orientacionProceso =
    cuantia && objetoConLineaCorte && !tipoProcesoDefinido
      ? cuantia === "alta"
        ? `un procedimiento competitivo (p. ej. ${necesidad.tipo_objeto === "servicios" ? "Concurso Público" : "Licitación Pública"})`
        : "un procedimiento de menor cuantía (p. ej. Adjudicación Simplificada o Contrato Menor)"
      : null;

  // Torre de coherencia (B): contradicciones cruzadas (cuantía↔proceso,
  // fecha↔plazo) que la verificación por campo no ve. Sobre lo GUARDADO.
  const tarjetasCoh = tarjetasCoherencia(necesidad, { pacBienesServicios: pacBS });

  // Guía de "próximo paso" en lenguaje llano, para orientar a quien no domina la
  // norma: una sola frase clara + un botón. Se apoya en datos ya calculados
  // (verificación de lo guardado + acción recomendada del flujo).
  // El paso siguiente es DATO, no comportamiento: describe qué toca y, si hay
  // algo que hacer, con qué etiqueta. El manejador se resuelve en el JSX.
  //
  // Antes llevaba dentro `fn: startFichaEdit`, y esa función escribe en
  // `baseUpdatedAtRef`. Al construir el objeto durante el render, React daba por
  // leído un ref en render (react-hooks/refs) y avisaba de que el valor podía no
  // actualizarse. Separar el qué del cómo lo resuelve sin trucos.
  const proximoPaso: null | {
    tono: "hacer" | "listo" | "derivado" | "espera";
    texto: string;
    accion?: { label: string; tipo: "completar-ficha" };
  } = (() => {
    if (necesidadVinculada) {
      return {
        tono: "derivado",
        texto: "Este requerimiento ya se derivó a un expediente. Puedes seguir editándolo; si cambias datos, recuerda volver a llevarlos al expediente.",
      };
    }
    if (!permisos.manage) return null;
    if (verificacion.bloquean > 0) {
      const n = verificacion.bloquean;
      return {
        tono: "hacer",
        texto: `Faltan ${n} dato${n === 1 ? "" : "s"} imprescindible${n === 1 ? "" : "s"} para poder enviar este requerimiento a la unidad de abastecimiento (DEC).`,
        accion: { label: "Completar la ficha", tipo: "completar-ficha" },
      };
    }
    if (siguienteAccion?.action === "remitir") {
      return {
        tono: "listo",
        texto: "El requerimiento tiene lo esencial. Revísalo y envíalo a la unidad de abastecimiento (DEC) con el botón de abajo.",
      };
    }
    if (estado?.actor === "dec") {
      return { tono: "espera", texto: "El requerimiento está en manos de la unidad de abastecimiento (DEC). No hay acción pendiente de tu parte por ahora." };
    }
    return null;
  })();
  // Solo el ICONO: el color y el fondo los pone el CSS a partir de `data-tono`.
  // Antes este objeto llevaba tambien `bg` y `border`, asi que la tarjeta se
  // pintaba desde JavaScript y quedaba fuera del sistema de tonos de la hoja.
  const PROXIMO_PASO_ICONO: Record<string, React.ReactNode> = {
    hacer: <AlertTriangle size={16} />,
    listo: <CheckCircle2 size={16} />,
    derivado: <Briefcase size={16} />,
    espera: <CircleDot size={16} />,
  };

  // `grid-cols-[minmax(0,1fr)]` y no `grid` a secas: una cuadricula sin columnas
  // declaradas usa una pista implicita `auto`, cuyo minimo es el min-content.
  // Basta un descendiente ancho —una tabla, un texto sin puntos de corte— para
  // que los hermanos se estiren con el y pinten fuera de la tarjeta. Medido: el
  // hijo pasaba de 622px a 2457px. Los `grid-cols-*` de Tailwind ya usan
  // minmax(0,1fr) justo por esto; el `grid` desnudo, no.
  return (
    <div className="tw grid grid-cols-[minmax(0,1fr)] gap-[18px] py-[22px]">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-bold leading-tight tracking-tight text-ink" title={necesidad.nombre}>
            {tituloLegible(necesidad.nombre)}
          </h2>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-muted">
            <span className="font-mono font-semibold">{necesidad.codigo ?? "Sin código"}</span>
            <span aria-hidden className="text-line">·</span>
            <span>{necesidad.tipo_objeto ? objectTypeLabel(necesidad.tipo_objeto) : "Sin tipo"}</span>
            <span aria-hidden className="text-line">·</span>
            <span>{tipoAreaLabel(necesidad.tipo_area)}</span>
          </div>
          {avanceOblig.total > 0 ? (
            <div
              className="mt-3 flex max-w-md items-center gap-2.5"
              title={`${avanceOblig.done} de ${avanceOblig.total} campos que exige este procedimiento`}
            >
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-line">
                <div
                  className={cn("h-full rounded-full transition-[width] duration-500", avanceOblig.faltan === 0 ? "bg-success" : "bg-brand")}
                  style={{ width: `${avanceOblig.pct}%` }}
                />
              </div>
              <span className={cn("shrink-0 text-[12px] font-semibold", avanceOblig.faltan === 0 ? "text-success" : "text-muted")}>
                {avanceOblig.faltan === 0
                    ? "Requerimiento completo"
                    : `${avanceOblig.done}/${avanceOblig.total} · faltan ${avanceOblig.faltan}`}
              </span>
            </div>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          {/* El estado NO se elige a dedo: se mueve con las acciones del flujo
              (Remitir, Observar, Conforme…), que validan origen, actor y sustento
              contra lib/necesidad-workflow.ts. */}
          <Badge tone={necesidadStatusTono(necesidad.status)} dot className="px-3 py-1 text-[12.5px]">
            {necesidadStatusLabel(necesidad.status)}
          </Badge>
          {/* Veredicto en la cabecera. El panel completo vive ahora en la columna
              lateral, junto a la ficha, porque ahi es donde sirve mientras se
              rellena. Pero quien entra a REVISAR necesita la respuesta sin bajar:
              esto se la da, y lleva al detalle de un clic. */}
          <button
            type="button"
            onClick={() => document.querySelector(".verif")?.scrollIntoView({ behavior: "smooth", block: "center" })}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-semibold transition",
              "outline-none focus-visible:shadow-[var(--shadow-focus)]",
              verificacion.lista
                ? "border-success/35 bg-success-soft text-success hover:border-success/60"
                : "border-warning/40 bg-warning-soft text-warning hover:border-warning/70",
            )}
          >
            {verificacion.lista ? (
              <><CheckCircle2 size={12} aria-hidden /> Lista para remitir</>
            ) : (
              <><AlertTriangle size={12} aria-hidden /> Faltan {verificacion.bloquean} para remitir</>
            )}
          </button>
          {permisos.manage ? (
            necesidad.process_id ? (
              <span className="text-[11.5px] text-muted" title="Elimina primero el expediente derivado.">
                Derivada a un expediente
              </span>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                destructive
                loading={deletingNecesidad}
                onClick={() => setConfirmDeleteNecesidad(true)}
              >
                {!deletingNecesidad ? <Trash2 className="size-3.5" /> : null}
                Eliminar necesidad
              </Button>
            )
          ) : null}
        </div>
      </header>

      {error ? <Alert tone="danger">{error}</Alert> : null}

      {/* Navegación rápida (sticky): salta a cada bloque sin scroll infinito. */}
      <nav
        className="sticky top-0 z-20 -my-1 flex flex-wrap gap-1.5 border-b border-line bg-canvas/85 py-2 backdrop-blur"
        aria-label="Secciones de la necesidad"
      >
        {/* Del catalogo, no de una lista propia: dos listas que dicen lo mismo
            acaban discrepando, y el chip que sobra lleva a un bloque que no existe
            en ese modo. Los riesgos solo cuando aplican. */}
        {BLOQUES_FICHA.filter((t) => t.id !== "sec-riesgos" || riesgosAplica).map((t) => (
          <button
            key={t.id}
            type="button"
            className="rounded-full border border-line bg-panel px-3 py-1 text-[12.5px] font-medium text-muted transition hover:border-brand/40 hover:bg-brand-soft hover:text-brand"
            // El destino puede vivir en el otro modo. Sin esto el clic no haria nada
            // y nadie sabria por que.
            onClick={() => {
              const destino = modoParaSeccion(t.id);
              if (destino) cambiarModo(destino);
              requestAnimationFrame(() => {
                document.getElementById(t.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
              });
            }}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {/* ===== Panel guiado del workflow del Requerimiento ===== */}
      <Panel id="sec-flujo">
        <PanelHead
          icon={<CircleDot className="size-4" />}
          title="Requerimiento · flujo (Ley 32069, Cap. II)"
          extra={
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold",
                estado?.actor === "dec"
                  ? "bg-brand-soft text-brand"
                  : estado?.actor === "area_usuaria"
                    ? "bg-warning-soft text-warning"
                    : "bg-ink/[0.06] text-muted",
              )}
              title={
                estado?.actor === "dec"
                  ? "DEC = Dependencia Encargada de las Contrataciones (unidad de abastecimiento). Le toca revisar."
                  : necesidad.tipo_area === "ate"
                    ? "ATE = Área Técnica Estratégica. Le toca completar/corregir el requerimiento."
                    : "Área usuaria: quien necesita la contratación. Le toca completar el requerimiento."
              }
            >
              {estado?.actor === "dec"
                ? "Turno: DEC"
                : estado?.actor === "area_usuaria"
                  ? `Turno: ${necesidad.tipo_area === "ate" ? "ATE" : "Área usuaria"}`
                  : "Cerrado"}
            </span>
          }
        />

        {/* Stepper del flujo (C): dónde está y desde cuándo, para los tres actores. */}
        <FlujoStepper status={necesidad.status} createdAt={necesidad.created_at ?? null} hitos={hitosEstado} />

        {proximoPaso ? (
          <div
            className={cn(
              "flex items-start gap-3 rounded-[12px] border p-3.5",
              proximoPaso.tono === "hacer" && "border-warning/25 bg-warning-soft",
              proximoPaso.tono === "listo" && "border-success/20 bg-success-soft",
              proximoPaso.tono === "derivado" && "border-brand/20 bg-brand-soft",
              proximoPaso.tono === "espera" && "border-line bg-surface",
            )}
          >
            <span
              className={cn(
                "mt-0.5 shrink-0",
                proximoPaso.tono === "hacer" && "text-warning",
                proximoPaso.tono === "listo" && "text-success",
                proximoPaso.tono === "derivado" && "text-brand",
                proximoPaso.tono === "espera" && "text-muted",
              )}
            >
              {PROXIMO_PASO_ICONO[proximoPaso.tono]}
            </span>
            <p className="min-w-0 flex-1 text-[13.5px] leading-relaxed text-ink">
              <strong className="font-semibold">¿Qué sigue?</strong> {proximoPaso.texto}
            </p>
            {proximoPaso.accion ? (
              <Button variant="primary" size="sm" onClick={startFichaEdit} className="shrink-0">
                {proximoPaso.accion.label}
              </Button>
            ) : null}
          </div>
        ) : null}

        {/* Aquí había un SEGUNDO stepper escrito a mano, justo debajo del
            <FlujoStepper> de arriba: la página mostraba dos veces el mismo
            progreso, y el de la mano solo pintaba el número de paso mientras que
            el componente trae fechas y las ramas (observada / no objeción /
            anulada). Se retira el duplicado. */}

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="grid max-w-[60ch] gap-[3px] [&_strong]:text-[15px] [&_strong]:text-brand-dark [&_p]:mt-0.5 [&_p]:mb-0 [&_p]:text-[12.5px] [&_p]:leading-[1.45] [&_p]:text-ink">
            <span className="text-[11px] uppercase tracking-[0.04em] text-muted">Estado actual</span>
            <strong>{necesidadStatusLabel(necesidad.status)}</strong>
            <p>{estado?.descripcion}</p>
          </div>
          <div className="grid content-start gap-1.5">
            <span
              className="inline-flex items-center gap-1.5 rounded-full border border-line px-[9px] py-[3px] text-[11.5px] text-muted"
              data-ok={necesidad.cmn_verificado}
              title="CMN = Cuadro Multianual de Necesidades. Es la lista anual de contrataciones de la entidad; la necesidad debe constar ahí para avanzar."
            >
              <ShieldCheck size={13} /> CMN {necesidad.cmn_verificado ? "verificado" : "sin verificar"}
            </span>
            <span
              className="inline-flex items-center gap-1.5 rounded-full border border-line px-[9px] py-[3px] text-[11.5px] text-muted"
              data-no={noObjecion}
              title="No objeción: conformidad del área usuaria cuando la DEC propone cambios al requerimiento (Art. 44.7)."
            >
              No objeción: {NO_OBJECION_LABEL[noObjecion] ?? noObjecion}
            </span>
            {/* Cuantía vs línea de corte del PAC (Transversal 3), como referencia. */}
            {cuantia ? (
              <span
                className="inline-flex items-center gap-1.5 rounded-full border border-line px-[9px] py-[3px] text-[11.5px] text-muted"
                data-cuantia={cuantia}
                title={`Monto estimado ${soles(montoNec)} frente a la línea de corte ${soles(lineaCorte!)} (10% del PAC de bienes y servicios de la entidad, Art. 125.2). Es una REFERENCIA: si esta necesidad no está programada en el PAC, el expediente recalcula la línea sumando su monto y otras no programadas.`}
              >
                <Wallet size={13} /> {cuantia === "alta" ? "Alta cuantía" : "Baja cuantía"} (ref.)
              </span>
            ) : lineaCorte === null && Number.isFinite(montoNec) && montoNec > 0 ? (
              <span
                className="inline-flex items-center gap-1.5 rounded-full border border-line px-[9px] py-[3px] text-[11.5px] text-muted"
                title="Para clasificar la cuantía (alta/baja, Art. 125.2) falta el PAC de bienes y servicios en Configuración → Municipalidad."
              >
                <Wallet size={13} /> Cuantía sin referencia (falta PAC)
              </span>
            ) : null}
          </div>
          {/* Orientación de procedimiento por cuantía (P2): solo empuja cuando el
              tipo de proceso está vacío; la DEC lo confirma en A4. */}
          {orientacionProceso ? (
            <p className="mt-2 flex items-start gap-[7px] rounded-lg border border-accent/25 bg-accent/[0.08] px-2.5 py-2 text-xs leading-[1.45] text-ink [&_svg]:mt-0.5 [&_svg]:flex-none [&_svg]:text-accent">
              <Sparkles size={12} aria-hidden />
              <span>
                Referencia por cuantía (Art. 125.2): el monto estimado{" "}
                {cuantia === "alta" ? "supera" : "no supera"} la línea de corte, así que orientativamente
                correspondería {orientacionProceso}. La DEC define el procedimiento en su estrategia (A4); si
                ya lo conoces, regístralo en «Tipo de proceso de selección».
              </span>
            </p>
          ) : null}
        </div>

        {necesidad.no_objecion_sustento ? (
          <p className="m-0 rounded-lg bg-brand-soft px-2.5 py-2 text-xs leading-[1.45] text-ink">
            <UserRound size={12} /> <strong>Sustento:</strong> {necesidad.no_objecion_sustento}
            {necesidad.no_objecion_mecanismo ? ` · (${necesidad.no_objecion_mecanismo})` : ""}
          </p>
        ) : null}

        {/* Diff de la no objeción: qué cambió la DEC, para decidir informado. */}
        {mostrarDiffNoObjecion ? <DiffNoObjecion cambios={cambiosNoObjecion} /> : null}

        <AccionesFlujo
          estadoActor={estado?.actor}
          listaParaRemitir={verificacion.lista}
          necesidadId={necesidadId}
          onCambio={trasTransicion}
          onError={setError}
          pendientesParaRemitir={verificacion.bloquean}
          puedeGestionar={permisos.manage}
          role={role}
          status={necesidad.status}
          tieneExpediente={Boolean(necesidad.process_id)}
        />

      </Panel>

      {/* ===== EETT / TDR (1.ª versión del área usuaria) ===== */}
      {permisos.manage && panelesDelModo(modo).includes("sec-eett") ? (
        <section id="sec-eett" className="grid grid-cols-[minmax(0,1fr)] content-start gap-3 rounded-[14px] border border-line bg-panel p-3.5 shadow-card">
          <div className="flex flex-wrap items-center gap-2 text-ink">
            <FileText size={17} />
            <h3 className="panelTitle">Especificaciones Técnicas (EETT) / Términos de Referencia (TDR)</h3>
          </div>
          <p className="text-xs font-semibold text-muted">
            Sube el PDF del <strong>EETT</strong> (bienes) o <strong>TDR</strong> (servicios) — la 1.ª versión que
            propone el área usuaria. Se indexa en el buscador con IA y podrás <strong>revisarlo contra el modelo
            oficial del OECE</strong> del proceso elegido y editarlo en un editor profesional.
          </p>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <select className={cn(FICHA_CTRL, FICHA_CTRL_H)} value={eettTipo} onChange={(e) => setEettTipo(e.target.value as "eett" | "tdr")}>
              <option value="tdr">TDR — Términos de Referencia (servicios)</option>
              <option value="eett">EETT — Especificaciones Técnicas (bienes)</option>
            </select>
            <input
              ref={eettFileRef}
              type="file"
              accept="application/pdf,.pdf"
              style={{ display: "none" }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void subirEett(f);
              }}
            />
            <Button
              variant="primary"
              type="button"
              disabled={eettUploading}
              onClick={() => eettFileRef.current?.click()}
            >
              {eettUploading ? <Loader size={15} /> : <UploadCloud size={15} />} Subir {eettTipo === "eett" ? "EETT" : "TDR"} (PDF)
            </Button>
          </div>
          {eettDocs.length > 0 ? (
            <ul className="m-0 flex list-none flex-col gap-1.5 p-0" style={{ marginTop: 12 }}>
              {eettDocs.map((d) => (
                <li className="flex items-center gap-2.5 rounded-[9px] border border-line bg-panel px-2.5 py-2" key={d.id}>
                  <FileText size={16} className="flex-none text-brand" />
                  <div className="flex min-w-0 flex-1 flex-col [&_strong]:truncate [&_strong]:text-[13px] [&_strong]:font-semibold [&_strong]:text-ink [&_small]:truncate [&_small]:text-[11px] [&_small]:text-muted" style={{ flex: 1 }}>
                    <strong>{d.metadata?.tipo === "eett" ? "EETT" : "TDR"} · {d.title}</strong>
                    <small>{d.file_name}</small>
                  </div>
                  <Button type="button" onClick={() => abrirEett(d)}>
                    <Pencil size={13} /> Revisar / editar
                  </Button>
                  <IconButton destructive type="button" aria-label="Eliminar" onClick={() => void borrarEett(d.id)}>
                    <Trash2 size={15} />
                  </IconButton>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs font-semibold text-muted" style={{ marginTop: 8 }}>Aún no has subido un EETT/TDR para esta necesidad.</p>
          )}
        </section>
      ) : null}

      {eettModal ? (
        <EettTdrModal
          necesidadId={necesidadId}
          doc={eettModal.doc}
          initialText={eettModal.initialText}
          initialHtml={eettModal.initialHtml}
          initialRevision={eettModal.initialRevision}
          initialPropuesta={eettModal.initialPropuesta}
          tipoProcesoSeleccion={necesidad.tipo_proceso_seleccion ?? ""}
          tipoObjeto={necesidad.tipo_objeto ?? ""}
          camposObjetivo={camposTrasladables()}
          valoresActuales={valoresActualesTrasladables()}
          onClose={() => setEettModal(null)}
          onSaved={() => {
            void reload();
            void loadEett();
          }}
        />
      ) : null}

      <div className={cn("grid gap-5", fichaEdit && !wizardMode ? "grid-cols-1" : "grid-cols-1 xl:grid-cols-[minmax(0,2fr)_minmax(280px,380px)]")}>
        <section id="sec-ficha" className="grid grid-cols-[minmax(0,1fr)] content-start gap-3 rounded-[14px] border border-line bg-panel p-3.5 shadow-card">
          <div className="flex flex-wrap items-center gap-2 text-ink">
            <FileText size={17} />
            <h3 className="panelTitle">Ficha de Necesidad (Ampliada)</h3>
            {!fichaEditable ? (
              permisos.manage ? (
                <Button className="ml-auto" onClick={startFichaEdit} type="button">
                  <Pencil size={14} />
                  Editar ficha
                </Button>
              ) : (
                <span className="flex items-center gap-1.5 rounded-lg bg-brand-soft px-3 py-2 text-xs text-muted">No tienes permisos para editar</span>
              )
            ) : null}
            {/* Descarga el requerimiento (Art. 44) en Word con los datos GUARDADOS. */}
            <a
                            href={`/api/necesidades/${necesidadId}/requerimiento-docx`}
              title="Descargar el requerimiento (Art. 44) en Word, con los datos guardados de la ficha"
            >
              <Download size={14} /> Requerimiento (Word)
            </a>
          </div>

          {necesidadVinculada ? (
            <p className="mt-2.5 flex items-start gap-2 rounded-lg border border-warning/45 bg-warning-soft px-3 py-2.5 text-xs leading-[1.45] text-warning [&_svg]:shrink-0">
              <AlertTriangle size={13} />
              <span>
                Esta necesidad ya está vinculada a un expediente. Puedes editarla, pero si cambias
                el requerimiento, vuelve a pulsar <strong>“Traer datos de la necesidad”</strong> en
                el expediente y valora si el cambio exige la no objeción del área usuaria (Art. 44.7).
              </span>
            </p>
          ) : null}

          {fichaEditable ? (() => {
            const seccionesVisibles = FICHA_SECCIONES.filter((s) => {
              if (s.mostrarPara && !(tipoObj && s.mostrarPara.includes(tipoObj))) return false;
              // Sección sin campos visibles (p. ej. 3.5.2 quedó vacía tras
              // consolidar sus campos en el editor de requisitos): fuera en ambos
              // modos, para no dejar una cabecera huérfana.
              if (camposParaObjeto(s.fields).length === 0) return false;
              // En "solo obligatorios" ocultamos las secciones que no aportan
              // nada exigible: ni campos obligatorios ni contenido del Art. 44.2.
              if (obligatoriosOnly) {
                return camposParaObjeto(s.fields).some((f) => campoEsObligatorio(f) || f.recomendado);
              }
              return true;
            });
            const totalPasos = 1 + seccionesVisibles.length; // Datos principales + secciones

            // Progreso de campos obligatorios (guía al usuario a completar lo mínimo).
            // Antes se recontaba aqui sobre las secciones VISIBLES y solo con los
            // obligatorios de la ficha: al filtrar por «Solo obligatorios» cambiaba el
            // denominador y dejaba de cuadrar con la cabecera.
            const { done: obligDone, total: obligTotal } = avanceRequerimiento("edicion");
            const pasoActual = wizardMode ? Math.min(wizardStep, totalPasos - 1) : -1;

            // Campos redactables por el copiloto: los de texto de las secciones
            // visibles (sin ocultos ni casillas), con su valor actual como contexto.
            const camposCopiloto: CopilotoCampo[] = [];
            const faltantesCopiloto: string[] = [];
            const vistosCopiloto = new Set<string>();
            for (const s of seccionesVisibles) {
              for (const f of camposParaObjeto(s.fields)) {
                // Lo que el copiloto ve como «falta» es lo mismo que cuenta la cabecera: si
                // el modelo exige un campo y esta vacio, tiene que saberlo.
                if (campoExigible(f) && !tieneValor(f)) faltantesCopiloto.push(f.label);
                if (f.oculto || f.checkbox || f.kind === "number" || f.kind === "date") continue;
                if (vistosCopiloto.has(f.api)) continue;
                vistosCopiloto.add(f.api);
                camposCopiloto.push({ key: f.api, label: f.label, valor: fichaForm[f.api] ?? "", baseLegal: f.baseLegal ?? "", seccion: s.title });
              }
            }

            // --- Navegación por secciones + completitud (Fase 4 UX/UI) ---
            const DATOS_PRINCIPALES_ID = "ficha-datos-principales";
            function seccionId(title: string) {
              return `ficha-sec-${title
                .toLowerCase()
                .normalize("NFD")
                .replace(/[̀-ͯ]/g, "")
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/^-|-$/g, "")}`;
            }
            type Completitud = {
              oblig: number;
              obligDone: number;
              llenos: number;
              total: number;
              estado: "completo" | "pendiente" | "parcial" | "vacio";
            };
            function completitudSeccion(section: FichaSection): Completitud {
              const campos = camposParaObjeto(section.fields).filter((f) => !f.oculto && !f.checkbox);
              let oblig = 0;
              let obligDone = 0;
              let llenos = 0;
              for (const f of campos) {
                const con = tieneValor(f);
                if (con) llenos += 1;
                // `campoExigible`, no `campoEsObligatorio`: si las partes cuentan con
                // otro criterio que el total, los chips no suman lo que dice la cabecera.
                if (campoExigible(f)) {
                  oblig += 1;
                  if (con) obligDone += 1;
                }
              }
              const total = campos.length;
              // Los obligatorios mandan: una sección está "lista" cuando no le
              // falta ninguno. Sin obligatorios, se guía por lo relleno.
              let estado: Completitud["estado"];
              if (oblig > 0) {
                estado = obligDone >= oblig ? "completo" : "pendiente";
              } else if (total === 0 || llenos === 0) {
                estado = llenos === 0 ? "vacio" : "parcial";
              } else {
                estado = llenos === total ? "completo" : "parcial";
              }
              return { oblig, obligDone, llenos, total, estado };
            }
            function badgeTexto(c: Completitud) {
              if (c.oblig > 0) return `${c.obligDone}/${c.oblig} oblig.`;
              if (c.total > 0) return `${c.llenos}/${c.total}`;
              return "";
            }
            function scrollASeccion(id: string) {
              document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
            }
            const navSecciones = seccionesVisibles.map((s) => ({
              id: seccionId(s.title),
              title: s.title,
              comp: completitudSeccion(s),
            }));

            function renderFichaField(field: FichaField) {
              // El campo se pinta en su propio componente memoizado. Lo que se le
              // pasa son VALORES de este campo, no las estructuras completas: el
              // formulario y los mapas de avisos cambian de identidad en cada
              // pulsacion y anularian la memo, que es justo lo que se buscaba.
              const geoKey = CAMPO_GEO_ENTIDAD[field.api];
              return (
                <CampoFicha
                  areasSugeridas={areasSugeridas}
                  editable={fichaEdit}
                  eettDocs={eettDocs}
                  eettUploading={eettUploading}
                  error={fieldErrors[field.api]}
                  exigido={exigidosModelo.has(field.api)}
                  fechaIA={camposDeIA.get(field.api) ?? null}
                  field={field}
                  geoValorEntidad={geoKey ? (configuredEntity?.[geoKey] ?? "").trim() : ""}
                  key={field.api}
                  modoSimple={modoSimple}
                  montoEstimado={Number(fichaForm.montoEstimado) || null}
                  necesidadId={necesidadId}
                  obligatorio={campoEsObligatorio(field)}
                  obsPendiente={obsPendientesPorCampo.get(field.api) ?? null}
                  onAbrirEett={abrirEettEstable}
                  onCambio={cambiarCampo}
                  onError={marcarError}
                  onRedactarIA={redactarConIA}
                  onSubirEett={subirEettEstable}
                  onTocar={marcarTocado}
                  puedeGestionar={permisos.manage}
                  tipoObjeto={fichaForm.tipoObjeto}
                  tipoProceso={fichaForm.tipoProcesoSeleccion ?? necesidad?.tipo_proceso_seleccion ?? null}
                  tocado={camposTocados.has(field.api)}
                  valor={fichaForm[field.api] ?? ""}
                />
              );
            }

            function renderDatosPrincipales() {
              return (
                <div className="flex scroll-mt-16 flex-col gap-2.5" id={DATOS_PRINCIPALES_ID}>
                  <h4 className="text-sm font-bold text-ink">Datos principales</h4>
                  <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(min(100%,15rem),1fr))]">
                    <div className="col-span-full min-w-0">
                      <label className="flex flex-col">
                        <span className={FICHA_LABEL}>Nombre de la contratación</span>
                        <input
                          className={cn(FICHA_CTRL, FICHA_CTRL_H)}
                          onChange={(e) => setFichaField("nombre", e.target.value)}
                          value={fichaForm.nombre ?? ""}
                        />
                      </label>
                      <DenominacionAsistente form={fichaForm} />
                    </div>
                    <label className="flex min-w-0 flex-col">
                      <span className={FICHA_LABEL}>Tipo de objeto</span>
                      <select className={cn(FICHA_CTRL, FICHA_CTRL_H)} onChange={(e) => setFichaField("tipoObjeto", e.target.value)} value={fichaForm.tipoObjeto ?? ""}>
                        {OBJECT_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>
                    </label>
                    <label className="flex min-w-0 flex-col" data-campo="tipoProcesoSeleccion">
                      <span className={FICHA_LABEL}>
                        Tipo de proceso de selección <em className="font-normal not-italic text-muted">· referencia inicial</em>
                      </span>
                      <select
                        className={cn(FICHA_CTRL, FICHA_CTRL_H)}
                        onChange={(e) => setFichaField("tipoProcesoSeleccion", e.target.value)}
                        value={fichaForm.tipoProcesoSeleccion ?? ""}
                      >
                        {/* "— Por definir —" siempre primero */}
                        <option value="">{PROCESO_SELECCION_OPCIONES[0].label}</option>
                        {opcionesProcesoAgrupadas.realiza.length > 0 ? (
                          <>
                            <optgroup label="Procesos que realiza tu entidad">
                              {opcionesProcesoAgrupadas.realiza.map((t) => (
                                <option key={t.value} value={t.value}>{t.label}</option>
                              ))}
                            </optgroup>
                            <optgroup label="Otros procedimientos">
                              {opcionesProcesoAgrupadas.otros.map((t) => (
                                <option key={t.value} value={t.value}>{t.label}</option>
                              ))}
                            </optgroup>
                          </>
                        ) : (
                          // Sin procesos configurados (o ninguno empareja): lista
                          // plana, en el orden original del catálogo.
                          opcionesProcesoAgrupadas.otros.map((t) => (
                            <option key={t.value} value={t.value}>{t.label}</option>
                          ))
                        )}
                      </select>
                    </label>
                    <label className="flex min-w-0 flex-col">
                      <span className={FICHA_LABEL}>Tipo de área solicitante</span>
                      <select className={cn(FICHA_CTRL, FICHA_CTRL_H)} onChange={(e) => setFichaField("tipoArea", e.target.value)} value={fichaForm.tipoArea ?? ""}>
                        {TIPO_AREA_OPCIONES.map((t) => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>
              );
            }

            // Guía del requerimiento (advertencias rojas / notas azules del PDF)
            // del tipo de proceso elegido, para la sección dada. Se agrupa por la
            // sección canónica 3.x (ej. "3.5.1" → guía de "3.5").
            const guiaTipo = fichaForm.tipoProcesoSeleccion
              ? (REQUERIMIENTO_GUIA[fichaForm.tipoProcesoSeleccion] ?? [])
              : [];
            function dedupGuia(items: typeof guiaTipo) {
              const vistos = new Set<string>();
              return items.filter((g) => {
                const k = `${g.tipo}|${g.etiqueta ?? ""}|${g.texto}`;
                if (vistos.has(k)) return false;
                vistos.add(k);
                return true;
              });
            }
            function guiaDeSeccion(title: string) {
              const m = title.match(/^(\d+\.\d+)/);
              const key = m ? m[1] : "";
              return key ? dedupGuia(guiaTipo.filter((g) => g.seccion === key)) : [];
            }
            function renderGuiaItems(items: typeof guiaTipo) {
              return (
                <div className="flex flex-col gap-2">
                  {items.map((g, i) => (
                    <div
                      className={cn(
                        "rounded-[10px] border px-3.5 py-2.5 text-[13px] leading-relaxed",
                        g.tipo === "advertencia" ? "border-danger/25 bg-danger-soft text-ink" : "border-brand/20 bg-brand-soft text-ink",
                      )}
                      key={i}
                    >
                      <strong className={cn("block font-semibold", g.tipo === "advertencia" ? "text-danger" : "text-brand")}>
                        {g.tipo === "advertencia" ? "⚠ Advertencia" : "ℹ Importante para la entidad"}
                        {g.etiqueta ? ` · ${g.etiqueta}` : ""}
                      </strong>
                      <span>{g.texto}</span>
                    </div>
                  ))}
                </div>
              );
            }
            function renderGuiaGeneral() {
              const items = dedupGuia(guiaTipo.filter((g) => g.seccion === "general"));
              if (items.length === 0) return null;
              return (
                <details className="group rounded-[10px] border border-line bg-surface p-3">
                  <summary className="cursor-pointer list-none text-[13px] font-semibold text-muted marker:content-none hover:text-brand">
                    ▸ Advertencias y notas generales del tipo de proceso ({items.length})
                  </summary>
                  <div className="mt-2.5">{renderGuiaItems(items)}</div>
                </details>
              );
            }

            function renderSeccion(section: FichaSection) {
              const { visibles, ocultosOpcionales } = camposVisibles(section);
              if (visibles.length === 0 && ocultosOpcionales === 0) return null;
              const guia = guiaDeSeccion(section.title);
              const comp = completitudSeccion(section);
              const badge = badgeTexto(comp);
              return (
                <div
                  className={cn(
                    // scroll-mt: al saltar desde el índice, el título quedaba
                    // debajo de la barra fija y parecía que no había pasado nada.
                    // Medida en el navegador, la barra ocupa 57px; 64 deja holgura.
                    "flex scroll-mt-16 flex-col gap-2.5 border-t border-line pt-4 first:border-t-0 first:pt-0",
                    section.preliminar && "rounded-[12px] border border-dashed border-brand/30 bg-brand-soft/40 p-4",
                  )}
                  id={seccionId(section.title)}
                  key={section.title}
                >
                  <h4 className="flex flex-wrap items-center gap-2 text-sm font-bold text-ink">
                    {section.title}
                    {section.preliminar ? (
                      <span className="rounded-full bg-brand/10 px-1.5 py-px text-[10px] font-bold uppercase tracking-wide text-brand">preliminar</span>
                    ) : null}
                    {badge ? (
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2 py-px text-[11px] font-semibold",
                          comp.estado === "completo" && "bg-success-soft text-success",
                          comp.estado === "pendiente" && "bg-warning-soft text-warning",
                          (comp.estado === "parcial" || comp.estado === "vacio") && "bg-ink/[0.06] text-muted",
                        )}
                      >
                        {comp.estado === "completo" ? <Check size={11} /> : null}
                        {badge}
                      </span>
                    ) : null}
                  </h4>
                  {section.resumenLlano ? (
                    <p className="text-[13px] leading-relaxed text-ink">{section.resumenLlano}</p>
                  ) : null}
                  {!modoSimple && section.nota ? <p className="text-[12.5px] leading-relaxed text-muted">{section.nota}</p> : null}
                  {!modoSimple && guia.length > 0 ? renderGuiaItems(guia) : null}
                  <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(min(100%,15rem),1fr))]">
                    {(() => {
                      // Subtítulo del subgrupo (literal legal) una vez por grupo,
                      // antes de su primer campo VISIBLE.
                      let prevSub: string | undefined;
                      const out: React.ReactNode[] = [];
                      for (const f of visibles) {
                        if (f.subgrupo && f.subgrupo !== prevSub) {
                          out.push(
                            <div className="col-span-full mt-1.5 text-[12px] font-bold uppercase tracking-wide text-muted" key={`sub-${f.subgrupo}`}>
                              {f.subgrupo}
                            </div>,
                          );
                        }
                        prevSub = f.subgrupo;
                        out.push(renderFichaField(f));
                      }
                      return out;
                    })()}
                  </div>
                  {/* El cuadro de ítems no es un campo de `necesidades`: vive en
                      su propia tabla, así que se inyecta en su sección en vez de
                      declararse en FICHA_SECCIONES. */}
                  {section.title.startsWith("3.2") ? (
                    <NecesidadItemsEditor
                      items={items}
                      montoDeclarado={Number(fichaForm.montoEstimado) || null}
                      objetoNecesidad={fichaForm.tipoObjeto || null}
                      onChange={setItems}
                      readOnly={!fichaEdit}
                      tipoProceso={fichaForm.tipoProcesoSeleccion || null}
                      uitValor={uitValor}
                    />
                  ) : null}
                  {ocultosOpcionales > 0 ? (
                    <button
                      className="inline-flex w-fit items-center gap-1.5 rounded-lg px-1 text-[13px] font-semibold text-brand hover:underline"
                      onClick={() => setOptionalExpanded((prev) => new Set(prev).add(section.title))}
                      type="button"
                    >
                      <Plus size={13} /> Mostrar {ocultosOpcionales} campo{ocultosOpcionales > 1 ? "s" : ""} opcional{ocultosOpcionales > 1 ? "es" : ""}
                    </button>
                  ) : null}
                </div>
              );
            }

            return (
              <div className="flex flex-col gap-4">
                {/* Sin esto, el área usuaria ve menos campos que ayer y no sabe
                    por qué: parece que la ficha perdió contenido. */}
                {exigidosModelo.size > 0 && obligatoriosOnly ? (
                  <Alert tone="info" icon={false}>
                    <div className="flex items-start gap-2.5">
                      <FileText size={15} className="mt-0.5 shrink-0" />
                      <div>
                        <strong>
                          Se muestran los {exigidosModelo.size} campos que exige el modelo de{" "}
                          {necesidad.tipo_proceso_seleccion}.
                        </strong>{" "}
                        Salen del PDF-modelo de requerimiento cargado en Configuración → Unidad de abastecimiento,
                        ajustados al objeto <strong>{objectTypeLabel(necesidad.tipo_objeto)}</strong>. Los demás siguen
                        ahí: usa <strong>«Ver todos»</strong> para abrirlos.
                      </div>
                    </div>
                  </Alert>
                ) : null}

                {/* Origen del contenido. Tras el traslado, la ficha se ve igual
                    la escriba quien la escriba: este aviso dice de un vistazo
                    cuántos campos propuso el modelo y cuáles. */}
                {camposDeIA.size > 0 ? (
                  <Alert tone="info" icon={false}>
                    <div className="flex items-start gap-2.5">
                      <WandSparkles size={15} className="mt-0.5 shrink-0" />
                      <div>
                        <strong>
                          {camposDeIA.size} campo{camposDeIA.size === 1 ? "" : "s"} de esta ficha{" "}
                          {camposDeIA.size === 1 ? "proviene" : "provienen"} de la propuesta IA del EETT/TDR.
                        </strong>{" "}
                        Llevan la marca <span className={FICHA_IA}>✦ propuesto por IA</span> junto a su nombre.
                        Revísalos antes de remitir: los redactó un modelo a partir del documento, no una persona.
                        <ul className="mt-1.5 list-inside list-disc">
                          {FICHA_SECCIONES.flatMap((s) => s.fields)
                            .filter((f) => camposDeIA.has(f.api))
                            .map((f) => (
                              <li key={f.api}>{f.label}</li>
                            ))}
                        </ul>
                      </div>
                    </div>
                  </Alert>
                ) : null}

                {/* El formulario restaura el borrador de localStorage al abrirse.
                    Sin este aviso, el trabajo sin guardar reaparece intacto y
                    parece registrado. */}
                {camposBorrador.length > 0 ? (
                  <Alert tone="warning" icon={false}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <strong>Hay cambios sin guardar en este navegador.</strong>
                        <p className="mt-0.5">
                          Estos campos NO están en la base de datos todavía:{" "}
                          {camposBorrador.map((k) => CAMPO_LABEL[k] ?? k).join(" · ")}. Pulsa{" "}
                          <em>Guardar ficha</em> para registrarlos.
                        </p>
                      </div>
                      <Button variant="secondary" size="sm" onClick={() => descartarBorrador()}>
                        Descartar y volver a lo guardado
                      </Button>
                    </div>
                  </Alert>
                ) : null}

                {renderPanelObligatorios("edicion")}

                <div className="flex flex-wrap items-center gap-3">
                  <div className="inline-flex rounded-[10px] border border-line bg-surface p-0.5" role="group" aria-label="Campos a mostrar">
                    <button
                      className={cn("rounded-[8px] px-3 py-1.5 text-[12.5px] font-semibold transition", obligatoriosOnly ? "bg-brand text-white shadow-card" : "text-muted hover:text-brand")}
                      onClick={() => setObligatoriosOnly(true)}
                      type="button"
                    >
                      Solo obligatorios
                    </button>
                    <button
                      className={cn("rounded-[8px] px-3 py-1.5 text-[12.5px] font-semibold transition", !obligatoriosOnly ? "bg-brand text-white shadow-card" : "text-muted hover:text-brand")}
                      onClick={() => setObligatoriosOnly(false)}
                      type="button"
                    >
                      Todos los campos
                    </button>
                  </div>

                  {obligTotal > 0 ? (
                    <div className="flex items-center gap-2" title={`${obligDone} de ${obligTotal} campos obligatorios completos`}>
                      <div className="h-2 w-28 overflow-hidden rounded-full bg-line">
                        <div
                          className={cn("h-full rounded-full", obligDone >= obligTotal ? "bg-success" : "bg-brand")}
                          style={{ width: `${Math.round((obligDone / obligTotal) * 100)}%` }}
                        />
                      </div>
                      <span className="text-[12px] font-semibold text-muted">{obligDone}/{obligTotal} obligatorios</span>
                    </div>
                  ) : null}

                  <div className="ml-auto flex flex-wrap items-center gap-2">
                    <Button variant="secondary" size="sm" onClick={() => { setWizardMode((w) => !w); setWizardStep(0); }}>
                      {wizardMode ? "Formulario completo" : "Paso a paso"}
                    </Button>
                    {/* Interruptor de modo. Mismo patron de grupo de dos botones que
                        «Solo obligatorios / Todos los campos», que ya se entiende. */}
                    <div className="inline-flex rounded-[10px] border border-line bg-surface p-0.5" role="group" aria-label="Modo de trabajo">
                      {([["redactar", "Redactar"], ["revisar", "Revisar"]] as const).map(([valor, etiqueta]) => (
                        <button
                          aria-pressed={modo === valor}
                          className={cn(
                            "rounded-[8px] px-3 py-1.5 text-[12.5px] font-semibold transition",
                            modo === valor ? "bg-brand text-white shadow-card" : "text-muted hover:text-brand",
                          )}
                          key={valor}
                          onClick={() => cambiarModo(valor)}
                          type="button"
                        >
                          {etiqueta}
                        </button>
                      ))}
                    </div>
                    <Button
                      variant={modoSimple ? "subtle" : "secondary"}
                      size="sm"
                      onClick={toggleModoSimple}
                      title={modoSimple
                        ? "Volver a mostrar las referencias legales (artículos, notas)"
                        : "Ocultar artículos y notas legales: deja solo el texto en lenguaje sencillo"}
                    >
                      {modoSimple ? "Mostrar detalle legal" : "Modo simple"}
                    </Button>
                    <Button variant={copilotoAbierto ? "primary" : "secondary"} size="sm" onClick={() => { setCopilotoAbierto((v) => !v); setCopilotoMontado(true); }}>
                      <Sparkles size={13} /> Copiloto IA
                    </Button>
                  </div>
                </div>

                {/* Indicador de pasos en modo wizard */}
                {wizardMode ? (
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { title: "Datos principales" },
                      ...seccionesVisibles.map((s) => ({ title: s.title })),
                    ].map((step, i) => {
                      const activo = i === pasoActual;
                      const hecho = i < pasoActual;
                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setWizardStep(i)}
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-medium transition",
                            activo
                              ? "border-brand bg-brand text-white"
                              : hecho
                                ? "border-success/30 bg-success-soft text-success"
                                : "border-line bg-panel text-muted hover:border-brand/30",
                          )}
                        >
                          <span
                            className={cn(
                              "grid size-4 place-items-center rounded-full text-[10px] font-bold",
                              activo ? "bg-white/25" : hecho ? "bg-success/15" : "bg-ink/[0.06]",
                            )}
                          >
                            {hecho ? <Check size={10} /> : i + 1}
                          </span>
                          {step.title}
                        </button>
                      );
                    })}
                  </div>
                ) : null}

                {/* Solo el paso actual en modo wizard; todo en modo completo */}
                {wizardMode ? (
                  pasoActual === 0 ? (
                    <>
                      {renderDatosPrincipales()}
                      {renderGuiaGeneral()}
                    </>
                  ) : renderSeccion(seccionesVisibles[pasoActual - 1])
                ) : (
                  <div className="flex min-w-0 flex-col gap-5">
                    {/* Índice de secciones, horizontal y fijo bajo la cabecera de la
                        aplicación (56px = top-14). Es NAVEGACIÓN, no pestañas de verdad:
                        al pulsar se salta a la sección y TODAS siguen montadas debajo,
                        así que lleva aria-current="location" y no role="tab" —anunciarlo
                        como pestañas prometería un panel que se sustituye, y no ocurre.
                        Antes era una columna lateral con `hidden lg:flex`: en tablet y
                        móvil, justo donde más falta hace saber por dónde vas, no había
                        índice ninguno.

                        `top-0` y no `top-14`: la aplicación NO tiene cabecera fija (no
                        hay `sticky` ni `fixed` en app-shell), así que los 56px que
                        reservaba la versión lateral solo dejaban pasar contenido por
                        encima. Los márgenes negativos igualan el relleno de la tarjeta
                        (`p-3.5`) para que la barra tape de borde a borde. */}
                    <nav
                      aria-label="Secciones del requerimiento"
                      className="sticky top-0 z-20 -mx-3.5 border-b border-line bg-panel/95 px-3.5 py-2 backdrop-blur-sm"
                    >
                      <div className="flex gap-1.5 overflow-x-auto pb-1">
                        <SectionNavItem
                          actual={seccionEnVista === DATOS_PRINCIPALES_ID}
                          estado="parcial"
                          label="Datos principales"
                          onClick={() => scrollASeccion(DATOS_PRINCIPALES_ID)}
                        />
                        {navSecciones.map((n) => (
                          <SectionNavItem
                            key={n.id}
                            actual={seccionEnVista === n.id}
                            estado={n.comp.estado}
                            label={n.title}
                            count={
                              badgeTexto(n.comp)
                                ? n.comp.oblig > 0
                                  ? `${n.comp.obligDone}/${n.comp.oblig}`
                                  : `${n.comp.llenos}/${n.comp.total}`
                                : undefined
                            }
                            onClick={() => scrollASeccion(n.id)}
                          />
                        ))}
                      </div>
                    </nav>
                    {renderDatosPrincipales()}
                    {renderGuiaGeneral()}
                    {seccionesVisibles.map(renderSeccion)}
                  </div>
                )}

                {/* Navegación del wizard */}
                {wizardMode ? (
                  <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
                    <Button variant="secondary" size="sm" disabled={pasoActual === 0} onClick={() => setWizardStep((s) => Math.max(0, s - 1))}>
                      ← Anterior
                    </Button>
                    <Button variant="ghost" size="sm" disabled={savingFicha} onClick={() => setFichaEdit(false)}>
                      Cancelar
                    </Button>
                    <span className="text-[12px] text-muted">Paso {pasoActual + 1} de {totalPasos}</span>
                    {pasoActual < totalPasos - 1 ? (
                      <Button variant="primary" size="sm" className="ml-auto" onClick={() => setWizardStep((s) => Math.min(totalPasos - 1, s + 1))}>
                        Siguiente →
                      </Button>
                    ) : (
                      <Button variant="primary" size="sm" className="ml-auto" loading={savingFicha} onClick={saveFicha}>
                        {!savingFicha ? <CheckCircle2 size={15} /> : null}
                        Guardar ficha
                      </Button>
                    )}
                  </div>
                ) : null}

                {/* Botones de acción en modo completo */}
                {!wizardMode ? (
                  <>
                    {conflictoGuardado ? (
                      <Alert tone="warning">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <span>
                            Otro usuario guardó cambios en esta necesidad. Recarga para ver su versión antes de
                            volver a guardar (tu borrador se conserva).
                          </span>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => { setConflictoGuardado(false); setError(""); setAutoguardado(""); void reload(); }}
                          >
                            Recargar
                          </Button>
                        </div>
                      </Alert>
                    ) : null}
                    <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
                      <Button variant="primary" disabled={conflictoGuardado} loading={savingFicha} onClick={saveFicha}>
                        {!savingFicha ? <CheckCircle2 size={15} /> : null}
                        Guardar ficha
                      </Button>
                      <Button variant="ghost" disabled={savingFicha} onClick={() => setFichaEdit(false)}>
                        Cancelar
                      </Button>
                      {autoguardado ? (
                        <span
                          className={cn(
                            "text-[12px] font-medium",
                            autoguardado === "error" ? "text-danger" : autoguardado === "guardado" ? "text-success" : "text-muted",
                          )}
                        >
                          {autoguardado === "guardando"
                            ? "Guardando…"
                            : autoguardado === "guardado"
                              ? "Cambios guardados automáticamente"
                              : "No se pudo autoguardar — pulsa Guardar ficha"}
                        </span>
                      ) : null}
                    </div>
                  </>
                ) : null}

                {copilotoMontado ? (
                  <NecesidadCopiloto
                    abierto={copilotoAbierto}
                    campos={camposCopiloto}
                    faltantes={faltantesCopiloto}
                    // La solución de controversias se FUSIONA en vez de sustituirse: su valor
                    // lleva el cuadro de instituciones designadas, y volcar encima el texto de
                    // la IA las borraría. Se conservan y lo redactado pasa a ser el bloque de
                    // condiciones adicionales.
                    onAplicarCampo={(api, valor) =>
                      setFichaField(
                        api,
                        api === "solucionControversias"
                          ? componerControversias(parseInstituciones(fichaForm.solucionControversias ?? ""), valor)
                          : valor,
                      )
                    }
                    onCerrar={() => setCopilotoAbierto(false)}
                    redactarSolicitud={copilotoRedactar}
                    tipoObjeto={tipoObj ? objectTypeLabel(tipoObj) : ""}
                    tipoProcesoSeleccion={fichaForm.tipoProcesoSeleccion ?? ""}
                  />
                ) : null}
              </div>
            );
          }          )(          ) : (
            <>
              <div className="flex flex-col">
                <Row label="Nombre" value={necesidad.nombre} />
                <Row label="Tipo de objeto" value={necesidad.tipo_objeto ? objectTypeLabel(necesidad.tipo_objeto) : null} />
                <Row label="Tipo de área" value={tipoAreaLabel(necesidad.tipo_area)} />
                {renderPanelObligatorios("lectura")}
                <div className="mt-3 flex flex-col gap-2.5">
                  {FICHA_SECCIONES.filter(
                    (s) => !s.mostrarPara || !tipoObj || s.mostrarPara.includes(tipoObj),
                  ).map((section) => {
                    // En la vista previa no se oculta nada que tenga dato guardado:
                    // se muestran los campos que aplican al objeto MÁS los que ya
                    // tienen valor (p. ej. cargados por importación o IA).
                    const campos = section.fields.filter((f) => {
                      if (f.oculto) return false;
                      if (!f.mostrarPara || !tipoObj || f.mostrarPara.includes(tipoObj)) return true;
                      const v = necesidad[f.col];
                      return v !== null && v !== undefined && String(v).trim() !== "";
                    });
                    const filled = campos.filter((f) => {
                      const v = necesidad[f.col];
                      return v !== null && v !== undefined && String(v).trim() !== "";
                    }).length;
                    const complete = filled > 0 && filled >= campos.length;
                    const isCollapsed = collapsedSections.has(section.title);
                    return (
                      <div className="overflow-hidden rounded-[12px] border border-line" key={section.title}>
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 bg-surface px-3.5 py-2.5 text-left text-[13px] font-bold text-ink transition hover:bg-brand-soft/50"
                          onClick={() => {
                            const next = new Set(collapsedSections);
                            if (next.has(section.title)) next.delete(section.title);
                            else next.add(section.title);
                            setCollapsedSections(next);
                          }}
                        >
                          {isCollapsed ? <ChevronDown size={14} className="text-muted" /> : <FileText size={14} className="text-brand" />}
                          {section.title}
                          <span
                            className={cn(
                              "ml-auto rounded-full px-2 py-px text-[11px] font-semibold",
                              complete ? "bg-success-soft text-success" : "bg-ink/[0.06] text-muted",
                            )}
                          >
                            {filled}/{campos.length}
                          </span>
                        </button>
                        {!isCollapsed ? (
                          <div className="px-3.5 py-1">
                            {(() => {
                              // Subtítulo del subgrupo (literal legal) una vez por
                              // grupo, antes de su primer campo del grupo.
                              let prevSub: string | undefined;
                              const out: React.ReactNode[] = [];
                              for (const f of campos) {
                                if (f.subgrupo && f.subgrupo !== prevSub) {
                                  out.push(
                                    <div className="mt-2 pb-1 text-[11px] font-bold uppercase tracking-wide text-muted" key={`sub-${f.subgrupo}`}>
                                      {f.subgrupo}
                                    </div>,
                                  );
                                }
                                prevSub = f.subgrupo;
                                const v = necesidad[f.col];
                                // Valor crudo: Row formatea booleanos como Sí/No y
                                // los vacíos como "—".
                                out.push(
                                  <Row
                                    deIA={camposDeIA.get(f.api)}
                                    key={f.api}
                                    label={f.label}
                                    value={typeof v === "boolean" || typeof v === "number" ? v : (v as string | null)}
                                  />,
                                );
                              }
                              return out;
                            })()}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
                <Row label="Resumen" value={necesidad.summary} />
              </div>
            </>
          )}
        </section>

        {/* Fijo SOLO cuando de verdad hay dos columnas: al editar la ficha el
            diseno pasa a una sola y este bloque cae debajo, donde pegarlo arriba
            no acompanaria nada, solo taparia contenido. */}
        <aside
          className={cn(
            "grid content-start gap-4",
            !(fichaEdit && !wizardMode) &&
              "xl:sticky xl:top-0 xl:max-h-[calc(100dvh-16px)] xl:overflow-y-auto xl:pr-0.5",
          )}
        >
          {/* Los diagnosticos viven AQUI, no en la cabecera: dicen que falta,
              y eso sirve mientras se rellena la ficha, no antes de empezar. La
              columna es fija para que sigan a la vista durante todo el scroll. */}
          {/* La verificación va junto a la decisión de remitir, no al final de la
              ficha: es la respuesta a «¿ya puedo mandar esto?», y esa pregunta se
              hace aquí. Se muestra siempre, también conforme: saber que está lista
              es tan útil como saber que no. */}
          {/* Los bloques anidados llevan `id` propio para ser alcanzables desde la
              navegacion rapida y comprobables por el reparto de modos. */}
          <div id="sec-verificacion">
            <VerificacionNecesidad onIrACampo={permisos.manage ? irACampo : undefined} resumen={verificacion} />
          </div>

          {/* Torre de coherencia (B): contradicciones entre campos que la
              verificación por-campo no ve. Complementa «¿está lista?». */}
          <div id="sec-coherencia">
            <CoherenciaNecesidad tarjetas={tarjetasCoh} onIrACampo={permisos.manage ? irACampo : undefined} />
          </div>

          <div id="sec-observaciones">
            <ObservacionesNecesidad
              campoLabel={campoLabel}
              campos={camposObservables}
              observaciones={observaciones}
              onAgregar={agregarObservacion}
              onIrACampo={irACampo}
              onResolver={resolverObservacion}
              puedeGestionar={permisos.manage}
            />
          </div>

          {panelesDelModo(modo).includes("sec-adjuntos") ? (
            <>
              <PanelAdjuntos
                documentos={documentos}
                necesidadId={necesidadId}
                onCambio={recargar}
                onError={setError}
                puedeEditar={puedeAdjuntar}
              />

              {/* Autocompletado con IA. Compartia recuadro con los adjuntos, y no
                  son lo mismo: aquello guarda ficheros en la necesidad, esto lee un
                  PDF y propone valores para la FICHA. Sin id "sec-*" a proposito:
                  es una herramienta, no un bloque del requerimiento, asi que no
                  entra en el indice de secciones ni en el reparto por modos. */}
              {puedeAdjuntar || extractResult ? (
                <section className="grid grid-cols-[minmax(0,1fr)] content-start gap-3 rounded-[14px] border border-line bg-panel p-3.5 shadow-card">
                  <div className="flex flex-wrap items-center gap-2 text-ink">
                    <WandSparkles size={17} />
                    <h3 className="panelTitle">Autocompletar la ficha</h3>
                  </div>
                  {puedeAdjuntar ? (
                    <>
                      <input
                        ref={extractFileRef}
                        type="file"
                        accept="application/pdf,.pdf"
                        style={{ display: "none" }}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) void handleExtract(f);
                          e.target.value = "";
                        }}
                      />
                      <Button
                        className="mt-2"
                        disabled={extracting}
                        onClick={() => extractFileRef.current?.click()}
                        type="button"
                        title="Lee un PDF de Especificaciones Técnicas o TDR y autocompleta la ficha"
                      >
                        {extracting ? <Loader size={15} /> : <Sparkles size={15} />}
                        {extracting ? "Leyendo con IA…" : "Autocompletar desde EETT/TDR (IA)"}
                      </Button>
                      <Button
                        className="mt-2"
                        disabled={completandoModelo || !necesidad?.tipo_proceso_seleccion}
                        onClick={() => void completarConModelo()}
                        type="button"
                        title={
                          necesidad?.tipo_proceso_seleccion
                            ? `Analiza el requerimiento de «${necesidad.tipo_proceso_seleccion}» y propone valores para los campos`
                            : "Elige y guarda primero el tipo de proceso de selección en la ficha"
                        }
                      >
                        {completandoModelo ? <Loader size={15} /> : <WandSparkles size={15} />}
                        {completandoModelo ? "Analizando el modelo…" : "Completar con el modelo del proceso (IA)"}
                      </Button>
                    </>
                  ) : null}

                  {extractResult ? (
                    <div className="mt-2.5 rounded-[10px] border border-brand/30 bg-brand-soft px-3 py-2.5">
                      <div className="flex items-center gap-[7px] text-[13px] text-ink [&_svg]:text-brand">
                        {extractResult.origen === "modelo" ? <WandSparkles size={14} /> : <Sparkles size={14} />}
                        <strong>
                          {extractResult.origen === "modelo"
                            ? "Propuesta desde el modelo del proceso"
                            : "Datos detectados por IA"}
                        </strong>
                        <IconButton onClick={() => setExtractResult(null)} type="button" aria-label="Cerrar">
                          <X size={14} />
                        </IconButton>
                      </div>
                      {Object.keys(extractResult.campos).length === 0 ? (
                        extractResult.origen === "modelo" ? (
                          <div className="grid gap-1.5">
                            <p className="text-xs font-semibold text-muted" style={{ margin: 0 }}>
                              El modelo no permitió proponer campos automáticamente.
                            </p>
                            <p className="m-0 text-[11.5px] leading-[1.45] text-muted">
                              {extractResult.exigidos && extractResult.exigidos.length > 0
                                ? "Se marcaron los campos que este proceso exige (en la ficha), pero su contenido depende de datos propios de la contratación que debes redactar."
                                : "Redacta los campos con el copiloto o desde un EETT/TDR; el proceso no aportó texto reutilizable."}
                            </p>
                          </div>
                        ) : (
                          <div className="grid gap-1.5">
                            <p className="text-xs font-semibold text-muted" style={{ margin: 0 }}>No se detectaron campos en el documento.</p>
                            <p className="m-0 text-[11.5px] leading-[1.45] text-muted">
                              Lectura: {extractResult.extractionMethod === "pdf-text" ? "texto del PDF" : "OCR (escaneado)"} ·{" "}
                              {extractResult.pageCount} pág · {extractResult.textLength} caracteres.
                            </p>
                            <p className="m-0 text-[11.5px] leading-[1.45] text-muted">
                              {(extractResult.textLength ?? 0) < 200
                                ? "El documento devolvió muy poco texto: probablemente el escaneo es de baja calidad o el OCR no lo leyó bien. Prueba con un PDF de mejor resolución o con texto seleccionable."
                                : "Se leyó texto pero la IA no reconoció datos del requerimiento en él. Revisa la vista previa para confirmar qué se leyó."}
                            </p>
                            {extractResult.textPreview ? (
                              <details className="[&_summary]:cursor-pointer [&_summary]:text-[11.5px] [&_summary]:font-semibold [&_summary]:text-brand [&_pre]:mt-1.5 [&_pre]:max-h-[200px] [&_pre]:overflow-auto [&_pre]:whitespace-pre-wrap [&_pre]:break-words [&_pre]:rounded-lg [&_pre]:border [&_pre]:border-line [&_pre]:bg-surface [&_pre]:px-2.5 [&_pre]:py-2 [&_pre]:text-[11px] [&_pre]:leading-[1.45] [&_pre]:text-ink">
                                <summary>Ver texto leído</summary>
                                <pre>{extractResult.textPreview}</pre>
                              </details>
                            ) : null}
                          </div>
                        )
                      ) : (
                        <>
                          <p className="mx-0 mb-2 mt-1.5 text-[11.5px] leading-snug text-muted">
                            Revisa y marca los campos a aplicar. Los que ya tienen valor vienen desmarcados para no sobrescribirlos.
                          </p>
                          <div className="grid max-h-[320px] gap-1.5 overflow-y-auto">
                            {Object.entries(extractResult.campos).map(([key, val]) => {
                              const col = API_TO_COL[key];
                              const cur = col ? necesidad?.[col] : undefined;
                              const yaTiene = cur !== null && cur !== undefined && String(cur).trim() !== "";
                              return (
                                <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-line bg-surface px-[9px] py-[7px] [&_input]:mt-0.5 [&_input]:flex-none" key={key}>
                                  <input checked={extractSelected.has(key)} onChange={() => toggleExtractSel(key)} type="checkbox" />
                                  <div className="grid min-w-0 gap-0.5">
                                    <span className="flex items-center gap-1.5 text-xs font-semibold text-ink">
                                      {CAMPO_LABEL[key] ?? key}
                                      {extractResult.exigidos?.includes(key) ? (
                                        <em
                                          className="ml-1.5 font-semibold not-italic text-accent"
                                          style={{ color: "var(--accent, #7c3aed)", fontWeight: 600, marginLeft: 6 }}
                                        >
                                          exige este proceso
                                        </em>
                                      ) : null}
                                      {yaTiene ? <em className="text-[10px] font-bold uppercase not-italic tracking-[0.03em] text-warning">ya tiene valor</em> : null}
                                    </span>
                                    <span className="break-words text-xs leading-snug text-muted">{String(val)}</span>
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                          <div className="mt-2.5 flex justify-end gap-2">
                            <Button onClick={() => setExtractResult(null)} type="button">
                              Descartar
                            </Button>
                            <Button
                              variant="primary"
                              disabled={applyingExtract || extractSelected.size === 0}
                              onClick={() => void applyExtract()}
                              type="button"
                            >
                              {applyingExtract ? <Loader size={14} /> : <CheckCircle2 size={14} />}
                              Aplicar {extractSelected.size} a la ficha
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  ) : null}
                </section>
              ) : null}
            </>
          ) : null}
        </aside>
      </div>

      {/* ===== Matriz de riesgos de la contratación ===== */}
      {riesgosAplica && panelesDelModo(modo).includes("sec-riesgos") ? (
        <PanelRiesgos
          necesidadId={necesidadId}
          onCambio={recargar}
          onError={setError}
          puedeEditar={puedeAdjuntar}
          riesgos={riesgos}
        />
      ) : null}

      {/* Cierre del ciclo: los dos actos de la DEC sobre algo ya redactado.
          Estaban en la cabecera y en el lateral de la ficha, es decir, antes
          y al lado del trabajo que juzgan. */}
      {/* Checklist de admisibilidad de la DEC (P3): visible una vez remitida;
          editable por la DEC mientras revisa. Es un apoyo, no bloquea el conforme. */}
      {necesidad.status !== "borrador" && panelesDelModo(modo).includes("sec-admisibilidad") ? (
        <div id="sec-admisibilidad">
          <AdmisibilidadDec
            necesidadId={necesidadId}
            inicial={admisibilidadInicial}
            puedeEditar={lado.esDec && (necesidad.status === "remitido_dec" || necesidad.status === "en_revision_dec")}
          />
        </div>
      ) : null}

      {panelesDelModo(modo).includes("sec-derivacion") ? (
        <section id="sec-derivacion" className="grid grid-cols-[minmax(0,1fr)] content-start gap-3 rounded-[14px] border border-line bg-panel p-3.5 shadow-card">
          <div className="flex flex-wrap items-center gap-2 text-ink">
            <ArrowRightCircle size={17} />
            <h3 className="panelTitle">Derivación a expediente</h3>
          </div>
          {necesidad.process_id ? (
            <>
              <p className="text-xs font-semibold text-muted">Esta necesidad ya fue derivada e incorporada al CMN.</p>
              {/* El avance REAL del expediente, sin tener que abrirlo: antes la
                  necesidad solo decía "derivada" y no contaba nada de la Fase 1. */}
              {avanceFase1 ? (
                <div className="fase1Avance">
                  <div className="h-1.5 overflow-hidden rounded-full bg-line [&>div]:h-full [&>div]:bg-success [&>div]:transition-[width] [&>div]:duration-200">
                    <div style={{ width: `${avanceFase1.porcentaje}%` }} />
                  </div>
                  <small>
                    Actuaciones preparatorias: <strong>{avanceFase1.completados}</strong> de{" "}
                    {avanceFase1.total} pasos
                  </small>
                  <div className="flex flex-wrap gap-1">
                    {avanceFase1.pasos.map((paso) => (
                      <span
                        className="rounded border border-line px-[5px] py-px text-[10px] font-semibold text-muted"
                        data-status={paso.status}
                        key={paso.code}
                        title={`${paso.code} · ${paso.label}: ${paso.statusLabel}`}
                      >
                        {paso.code}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
              <Link className={buttonClasses({ variant: "primary" })} href={`/expedientes/${necesidad.process_id}`}>
                <Briefcase size={15} />
                Abrir expediente
              </Link>
            </>
          ) : (
            <>
              <p className="text-xs font-semibold text-muted">
                Al derivar, la DEC crea el Expediente de Contratación y la necesidad pasa a “Incorporado al CMN”. Requiere que
                el requerimiento esté <strong>conforme</strong>.
              </p>
              <Button
                variant="primary"
                disabled={!permisos.derivar || deriving || necesidad.status !== "conforme"}
                onClick={derivar}
                type="button"
              >
                {deriving ? <Loader size={15} /> : <ArrowRightCircle size={15} />}
                Derivar a expediente
              </Button>
              {!permisos.derivar ? (
                <small className="text-xs font-semibold text-muted">Derivar requiere rol con gestión de expedientes (DEC, AGA, Titular).</small>
              ) : necesidad.status !== "conforme" ? (
                <div className="mt-1 grid gap-1.5 rounded-lg border border-line bg-brand-soft px-2.5 py-2 [&_small]:leading-[1.45]">
                  <span className="inline-flex items-center gap-1.5 text-xs text-muted">
                    Estado actual:{" "}
                    <Badge tone={necesidadStatusTono(necesidad.status)}>
                      {necesidadStatusLabel(necesidad.status)}
                    </Badge>
                  </span>
                  <small className="text-xs font-semibold text-muted">
                    El requerimiento debe estar <strong>Conforme</strong> para derivar.{" "}
                    {siguienteAccion ? (
                      <>
                        Siguiente paso: pulsa <strong>«{siguienteAccion.label}»</strong> en el panel “Requerimiento ·
                        flujo” de arriba y continúa hasta “Conforme”.
                      </>
                    ) : (
                      <>Usa las acciones del panel “Requerimiento · flujo” de arriba para avanzar hasta “Conforme”.</>
                    )}
                  </small>
                </div>
              ) : null}
            </>
          )}
        </section>
      ) : null}

      {panelesDelModo(modo).includes("sec-historial") ? (
        <div id="sec-historial">
          <HistorialNecesidad necesidadId={necesidadId} recarga={histRecarga} />
        </div>
      ) : null}


      <ConfirmDialog
        open={confirmDeleteNecesidad}
        title="Eliminar necesidad"
        message={`¿Eliminar la necesidad "${necesidad.nombre}"? Se borrarán sus adjuntos y riesgos. Esta acción no se puede deshacer.`}
        tone="danger"
        confirmLabel="Eliminar"
        onConfirm={() => void deleteNecesidad()}
        onCancel={() => setConfirmDeleteNecesidad(false)}
      />
    </div>
  );
}
