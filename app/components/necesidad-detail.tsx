"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  AlertTriangle,
  Briefcase,
  CheckCircle2,
  CircleDot,
  Download,
  FileText,
  Loader,
  Pencil,
  ShieldCheck,
  Sparkles,
  Trash2,
  UploadCloud,
  UserRound,
  WandSparkles,
  Wallet,
  X,
} from "lucide-react";
import {
  objectTypeLabel,
} from "@/lib/legal-taxonomy";
// Desde el modulo de topes, NO desde lib/necesidades: ese arrastra los 31
// esquemas de zod al navegador para nada.
import {
  type ObjetoFilter,
  PROCESO_SELECCION_OPCIONES,
} from "@/lib/procesos-seleccion";
import { resumenNecesidad } from "@/lib/necesidad-verificacion";
import {
  BLOQUES_FICHA,
  MODO_POR_DEFECTO,
  type ModoFicha,
  modoParaSeccion,
  panelesDelModo,
} from "@/lib/necesidad-modos";
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
import {
  Alert,
  Badge,
  Button,
  EmptyState,
  IconButton,
} from "./ui";
import { cn } from "@/lib/utils";
import {
  FICHA_CTRL,
  FICHA_CTRL_H,
} from "./necesidad/ficha-estilos";
import { AccionesFlujo } from "./necesidad/acciones-flujo";
import { PanelDerivacion } from "./necesidad/panel-derivacion";
import { toStr, useFichaForm } from "./necesidad/usar-ficha-form";
import { CAMPO_LABEL } from "./necesidad/campos-etiquetas";
/**
 * El formulario completo se descarga al abrirlo, no al abrir la pagina.
 *
 * MEDIDO: la carga inicial de /necesidades/[id] pasa de 107,5 a 88,3 KB brotli
 * —19,2 KB menos, un 18 %— porque casi mil quinientas lineas de formulario solo
 * las necesita quien pulsa «Editar». Quien entra a LEER una necesidad no las
 * descargaba para nada.
 *
 * `ssr: false` porque este bloque nunca sale en el HTML inicial: exige una
 * interaccion previa. El `loading` evita que el panel parpadee vacio mientras
 * llega el trozo, y `precargarFicha` lo trae al pasar el raton por «Editar»,
 * asi que en la practica ya esta cuando se pulsa.
 */
const importarFichaEditable = () => import("./necesidad/ficha-editable");
const FichaEditable = dynamic(() => importarFichaEditable().then((m) => m.FichaEditable), {
  loading: () => (
    <div className="grid gap-3" aria-busy="true">
      <div className="h-10 animate-pulse rounded-[10px] bg-line/70" />
      <div className="h-64 animate-pulse rounded-[10px] bg-line/70" />
    </div>
  ),
  ssr: false,
});
import { FichaLectura } from "./necesidad/ficha-lectura";
import { PanelAdjuntos } from "./necesidad/panel-adjuntos";
import { PanelRiesgos } from "./necesidad/panel-riesgos";
import { useCallbackEstable } from "./necesidad/usar-callback-estable";
import {
  NO_OBJECION_LABEL,
  type NoObjecionEstado,
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
import { direccionDeLaEntidad } from "@/lib/configuracion-types";
import { componerFormaPago } from "@/lib/forma-pago";
import { componerPlazoRespuestas } from "@/lib/plazo-respuestas";
import { areaQueOtorgaLaConformidad, componerRecepcionConformidad } from "@/lib/recepcion-conformidad";





const API_TO_COL: Record<string, keyof Necesidad> = (() => {
  const m: Record<string, keyof Necesidad> = { nombre: "nombre", summary: "summary" };
  for (const s of FICHA_SECCIONES) for (const f of s.fields) m[f.api] = f.col;
  return m;
})();

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
  // Campo al que llevar el foco tras un guardado fallido. En una ref y no en
  // estado: es un dato de un solo uso que no debe provocar un render por si
  // mismo. Quien dispara el efecto es `fieldErrors`, que cambia de identidad en
  // cada intento fallido.

  // Los catalogos suben aqui porque el ciclo de vida del formulario los
  // necesita al abrir la ficha: siembra la entidad, la unidad ejecutora y el
  // ejercicio en los campos que aun no tienen valor.
  const { entity: configuredEntity, processTypes: procesosEntidad } = useSettingsCatalog();
  const { year } = useYear();

  /**
   * Todo el formulario: abrirlo, escribir, autoguardar, validar y guardar.
   *
   * Se desestructura con los nombres de siempre para no reescribir el centenar
   * de referencias que hay repartidas por el JSX. Los predicados del catalogo se
   * pasan envueltos en flechas a proposito: dependen de los ejes, que a su vez
   * se derivan de `fichaForm`, que sale de aqui. La vuelta se rompe porque el
   * hook solo los invoca al guardar, cuando ya hay valores.
   */
  const {
    autoguardado,
    camposBorrador,
    camposTocados,
    conflictoGuardado,
    descartarBorrador,
    empezarEdicion: startFichaEdit,
    fichaEdit,
    fichaForm,
    fieldErrors,
    focoPendiente,
    guardar: saveFicha,
    savingFicha,
    setCamposTocados,
    setFichaEdit,
    setFichaField,
    setFieldErrors,
    superarConflicto,
  } = useFichaForm({
    campoEsObligatorio: (f) => campoEsObligatorio(f),
    camposParaObjeto: (fs) => camposParaObjeto(fs),
    entidad: configuredEntity,
    items,
    itemsGuardados,
    necesidad,
    necesidadId,
    onAntesDeEditar: () => cambiarModo("redactar"),
    onError: setError,
    onRecargar: () => reload(),
    onSalirDelPasoAPaso: () => setWizardMode(false),
    year,
  });
  // Campos en los que el usuario ha escrito. Sirve para que la validacion al
  // salir del campo NO pinte de rojo lo que solo se ha recorrido con el
  // tabulador: en una ficha de nueve secciones, tabular para ver que hay
  // encenderia el formulario entero sin que nadie se haya equivocado.
  //
  // En estado y no en una ref (que seria lo natural para un dato que no pinta
  // nada) porque los manejadores se crean durante el render y leer `.current`
  // ahi es justo lo que prohibe react-hooks/refs. No cuesta renders: se anota
  // al escribir, y escribir ya provoca uno con `setFichaField`.
  // Áreas usuarias ya registradas: alimentan el autocompletado del campo, para
  // que la próxima "SUB GERENCIA…" reutilice la grafía existente en vez de
  // crear una variante nueva (mismo criterio que la geografía por catálogo).
  const [areasSugeridas, setAreasSugeridas] = useState<string[]>([]);

  // Edición de la Ficha de Necesidad (todos los campos del PATCH).
  // Campos que el borrador de este navegador cambia respecto a lo guardado.
  // El borrador se restaura al abrir "Editar ficha", así que sin avisar parece
  // que el trabajo está registrado cuando solo vive en localStorage.
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
    // FORMA DE PAGO no pasa por el copiloto: su texto lo fija el Art. 67 de la
    // Ley y solo tiene cinco huecos, asi que se COMPONE con los datos que el
    // area usuaria ya registro. Pedirselo a un modelo de lenguaje seria
    // arriesgarse a que parafrasee un articulo de la Ley en un documento que se
    // firma, y ademas tardaria y costaria para dar una respuesta que ya
    // conocemos exacta.
    if (api === "formaPago") {
      // La direccion exacta sale de Configuracion → Datos de la entidad si aun
      // no se escribio aqui. Es el domicilio de la propia municipalidad: no hay
      // motivo para teclearlo en cada requerimiento, y es asi como acaban
      // conviviendo tres direcciones distintas de la misma entidad.
      const direccion =
        (fichaForm.formaPagoDireccion ?? "").trim() || direccionDeLaEntidad(configuredEntity);
      if (direccion && direccion !== (fichaForm.formaPagoDireccion ?? "").trim()) {
        // Se escribe en el campo, no solo en el texto: lo que va al documento
        // tiene que poder verse y corregirse en la ficha.
        setFichaField("formaPagoDireccion", direccion);
      }
      setFichaField(
        "formaPago",
        componerFormaPago({
          // Quien firma la conformidad que el pago exige es el mismo que la
          // otorga en el Art. 144: si hay un residente registrado, es el.
          areaConformidad: areaQueOtorgaLaConformidad(fichaForm.tipoObjeto, {
            areaConformidad: fichaForm.formaPagoAreaConformidad ?? "",
            areaRecepcion: fichaForm.recepcionArea ?? "",
          }),
          // El proyecto de inversion y su CUI no son huecos del formato: se
          // traen de «b) Inversion a la que se imputa» para decir contra que
          // inversion firma la conformidad esa area, que otorga varias.
          cui: fichaForm.cui ?? "",
          // El formato mete el tipo y su detalle en un solo corchete; en la
          // ficha son dos campos porque uno se elige y el otro se escribe.
          detallePagosACuenta: fichaForm.formaPagoDetalle ?? "",
          direccion,
          documentacionAdicional: fichaForm.formaPagoDocumentacion ?? "",
          lugarPresentacion: fichaForm.formaPagoLugar ?? "",
          proyectoInversion: fichaForm.proyectoInversion ?? "",
          tipoPago: fichaForm.formaPagoTipo ?? "",
        }),
      );
      return;
    }
    // Apartado j): texto fijo del formato con UN hueco, el plazo. Se compone.
    if (api === "plazoRespuestasTexto") {
      // El plazo vive en su campo NUMERICO y el texto en el suyo: no compiten
      // por la misma columna, asi que recomponer no puede anidar el apartado
      // dentro de si mismo ni perder el numero.
      const dias = (fichaForm.plazoRespuestas ?? "").trim();
      setFichaField(
        "plazoRespuestasTexto",
        componerPlazoRespuestas(dias ? `${dias} días calendario` : ""),
      );
      return;
    }
    // Recepcion y conformidad (Art. 144). Se COMPONE con el texto del formato,
    // como la forma de pago: la entidad facilito el literal con sus huecos entre
    // corchetes, y lo que tiene una respuesta exacta no se le pide a un modelo
    // de lenguaje. Paso una temporada yendo al copiloto y el resultado
    // parafraseaba el articulo del Reglamento en un documento que se firma.
    //
    // OBRAS no tiene plantilla —su recepcion se rige por otro procedimiento, con
    // comision de recepcion y pliego de observaciones, que el formato facilitado
    // no cubre—: ahi `componerRecepcionConformidad` devuelve null y se sigue al
    // copiloto en vez de escribir algo aproximado.
    if (api === "recepcionConformidad") {
      const subsanacion = (fichaForm.conformidadPlazoSubsanacion ?? "").trim();
      const texto = componerRecepcionConformidad(fichaForm.tipoObjeto, {
        // En SERVICIOS no hay recepcion que dar, asi que «Area que efectua la
        // recepcion» dice quien firma de verdad la conformidad —el residente de
        // la inversion, no la sub gerencia que tramita el pago—. En bienes no se
        // sustituye: alli son dos actos y dos areas.
        areaConformidad: areaQueOtorgaLaConformidad(fichaForm.tipoObjeto, {
          areaConformidad: fichaForm.formaPagoAreaConformidad ?? "",
          areaRecepcion: fichaForm.recepcionArea ?? "",
        }),
        areaRecepcion: fichaForm.recepcionArea ?? "",
        plazoConformidad: (fichaForm.conformidadPlazo ?? "").trim(),
        // El campo es un NUMERO de dias y el hueco pide una frase: el texto dice
        // «otorgandole un plazo para subsanar, ___», y un «5» suelto ahi no se
        // lee. El de la conformidad no lo necesita: su frase ya trae el «dias».
        plazoSubsanacion: subsanacion ? `de ${subsanacion} días hábiles` : "",
      });
      if (texto) {
        setFichaField("recepcionConformidad", texto);
        return;
      }
    }
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
  // Trae el formulario antes de que haga falta: al pasar el raton por «Editar»
  // o al enfocarlo con el teclado. Si ya esta, no hace nada.
  const precargarFicha = useCallback(() => {
    void importarFichaEditable();
  }, []);
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
  // El formulario tiene cambios del usuario (no solo la carga inicial). Sin
  // esto, abrir la ficha dispararía un autoguardado sin que nadie escriba.
  // Bloqueo optimista: sello `updated_at` de la versión cargada. Se envía en cada
  // guardado; el servidor rechaza (409) si otro actor guardó en medio. Es un ref
  // porque el autoguardado NO recarga, y debe avanzar tras su propio guardado
  // para no chocar consigo mismo en la siguiente pulsación.
  // Aviso suave de admisibilidad: si la DEC da conforme con puntos sin marcar, se
  // pregunta antes de continuar (no bloquea; solo hace consciente el salto).
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
  // Tipos de requisito de calificacion que declara el modelo del procedimiento.
  const [requisitosModelo, setRequisitosModelo] = useState<ReadonlySet<string>>(new Set());
  const extractFileRef = useRef<HTMLInputElement | null>(null);


  /**
   * Los DOS campos que deciden QUE ficha se pinta: cuales aplican, cuales son
   * obligatorios y cuales exige el modelo del proceso. Del borrador si se esta
   * editando, y de lo guardado si no.
   *
   * Estaban recalculados en CUATRO sitios y no coincidian: `objetosEfectivos`
   * cruzaba el proceso del BORRADOR con el objeto GUARDADO, mientras que
   * `campoExigible` y `obligatoriosDelProceso` tomaban los dos del borrador. Al
   * cambiar el Tipo de objeto sin guardar, la misma pantalla marcaba unos campos
   * como obligatorios segun el objeto viejo y otros segun el nuevo —y las dos
   * respuestas se usan en el MISMO filtro de `camposVisibles`—.
   */
  const ejeProceso = fichaForm.tipoProcesoSeleccion ?? necesidad?.tipo_proceso_seleccion ?? "";
  const ejeObjeto = (fichaForm.tipoObjeto ?? necesidad?.tipo_objeto ?? "") as ObjetoFilter | "";
  /** Objetos que el procedimiento admite (Art. 44.10), acotados por el elegido. */
  const objetosEfectivos = objetosEfectivosDe(ejeProceso, ejeObjeto || undefined);


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
    const proceso = ejeProceso;
    const objeto = ejeObjeto;
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
        if (cancelado) return;
        if (Array.isArray(payload.exigidos)) setExigidosModelo(new Set(payload.exigidos));
        // Tipos del Art. 72.3 que el modelo declara. No se filtra por ellos: el
        // articulo los permite todos y la entidad puede sustentar uno que su
        // formato no liste. Solo se DICE cual pide el formato.
        if (Array.isArray(payload.requisitos)) setRequisitosModelo(new Set(payload.requisitos));
      } catch {
        /* sin modelo la ficha sigue funcionando con su criterio por objeto */
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [ejeProceso, ejeObjeto]);


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

  /** ¿El campo es obligatorio para el objeto/proceso actual? Contempla el
   *  obligatorio incondicional, el condicional por objeto (`obligatorioPara`) y
   *  el condicional por procedimiento (`obligatorioEnProceso`). */
  function campoEsObligatorio(field: FichaField): boolean {
    // Con el requerimiento desagregado, los campos que describen UNA prestación
    // dejan de exigirse: el dato vive en cada ítem. Se comprueba antes que nada
    // porque manda sobre cualquier otro criterio de obligatoriedad.
    if (field.noExigibleConItems && items.length > 0) return false;
    return campoObligatorio(field, objetosEfectivos, ejeProceso);
  }

  function camposParaObjeto(fields: FichaField[]): FichaField[] {
    // Los `oculto` (p. ej. Centro de costo) no se muestran ni se validan; su
    // valor se guarda igual desde `construirPayload`, que recorre section.fields.
    // El procedimiento ACOTA los objetos posibles (Art. 44.10) y además puede
    // acotar campos concretos por sí mismo (`mostrarEnProceso`).
    const efectivos = objetosEfectivos;
    const proc = ejeProceso;
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
    const efectivos = objetosEfectivos;
    return campoObligatorio(field, efectivos, ejeProceso) || exigidosModelo.has(field.api);
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
    const efectivos = objetosEfectivos;
    const items: FichaField[] = [];
    for (const section of FICHA_SECCIONES) {
      if (section.mostrarPara && !(ejeObjeto && section.mostrarPara.includes(ejeObjeto as ObjetoFilter))) continue;
      for (const f of section.fields) {
        if (f.oculto || !campoAplica(f, efectivos, ejeProceso)) continue;
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
    const proceso = ejeProceso;
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
    // Mismos ejes que el resto de la ficha: el traslado escribe en el
    // formulario ABIERTO, asi que debe ofrecer los campos del objeto y el
    // proceso que hay ahora en pantalla, no los de la ultima vez que se guardo.
    const efectivos = objetosEfectivos;
    const out: Array<{ api: string; label: string; seccion: string; kind?: string }> = [];
    for (const section of FICHA_SECCIONES) {
      if (!SECCIONES_TRASLADABLES.some((p) => section.title.startsWith(p))) continue;
      for (const f of section.fields) {
        if (f.oculto || f.checkbox || f.kind === "date") continue;
        if (!campoAplica(f, efectivos, ejeProceso)) continue;
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
              <Button variant="primary" size="sm" onClick={startFichaEdit} onFocus={precargarFicha} onMouseEnter={precargarFicha} className="shrink-0">
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
                <Button className="ml-auto" onClick={startFichaEdit} onFocus={precargarFicha} onMouseEnter={precargarFicha} type="button">
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

          {fichaEditable ? (
            <FichaEditable
              campo={{ areasSugeridas, cambiarCampo, marcarError, marcarTocado, redactarConIA }}
              catalogo={{
                avanceRequerimiento,
                campoEsObligatorio,
                campoExigible,
                camposDeIA,
                camposParaObjeto,
                camposVisibles,
                ejeObjeto,
                ejeProceso,
                exigidosModelo,
                obsPendientesPorCampo,
                opcionesProcesoAgrupadas,
                requisitosModelo,
                panelObligatorios: renderPanelObligatorios("edicion"),
                tieneValor,
                tipoObj,
              }}
              copiloto={{
                abierto: copilotoAbierto,
                montado: copilotoMontado,
                redactar: copilotoRedactar,
                setAbierto: setCopilotoAbierto,
                setMontado: setCopilotoMontado,
              }}
              eett={{ abrir: abrirEettEstable, docs: eettDocs, subiendo: eettUploading, subir: subirEettEstable }}
              ficha={{
                autoguardado,
                camposBorrador,
                camposTocados,
                conflictoGuardado,
                descartarBorrador,
                fichaEdit,
                fichaForm,
                fieldErrors,
                guardar: saveFicha,
                savingFicha,
                setFichaEdit,
                setFichaField,
                superarConflicto,
              }}
              items={items}
              necesidad={necesidad}
              necesidadId={necesidadId}
              onError={setError}
              onRecargar={recargar}
              permisos={permisos}
              setItems={setItems}
              uitValor={uitValor}
              vista={{
                cambiarModo,
                modo,
                modoSimple,
                obligatoriosOnly,
                seccionEnVista,
                setObligatoriosOnly,
                setOptionalExpanded,
                setWizardMode,
                setWizardStep,
                toggleModoSimple,
                wizardMode,
                wizardStep,
              }}
            />
          ) : (
            <FichaLectura
              camposDeIA={camposDeIA}
              necesidad={necesidad}
              panelObligatorios={renderPanelObligatorios("lectura")}
              tipoObj={tipoObj}
            />
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
        <PanelDerivacion
          necesidadId={necesidadId}
          onCambio={recargar}
          onError={setError}
          processId={necesidad.process_id ?? null}
          puedeDerivar={permisos.derivar}
          siguienteAccionLabel={siguienteAccion?.label ?? null}
          status={necesidad.status}
        />
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
