"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  ClipboardCheck,
  Download,
  FileText,
  Loader,
  MessageSquare,
  Pencil,
  Plus,
  ShieldAlert,
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
  NECESIDAD_DOC_KINDS,
  OBJECT_TYPES,
  necesidadDocKindLabel,
  objectTypeLabel,
} from "@/lib/legal-taxonomy";
// Desde el modulo de topes, NO desde lib/necesidades: ese arrastra los 31
// esquemas de zod al navegador para nada.
import { LIMITES_TEXTO, NOMBRE_MAX } from "@/lib/necesidades-limites";
import { filasTextarea } from "@/lib/textarea-alto";
import {
  etiquetas,
  OPCIONES_MODALIDAD_PAGO,
  OPCIONES_MONEDA,
  OPCIONES_SISTEMA_ENTREGA,
} from "@/lib/opciones-contratacion";
import {
  type ObjetoFilter,
  OBJETOS_POR_PROCEDIMIENTO,
  PROCESO_SELECCION_OPCIONES,
} from "@/lib/procesos-seleccion";
import { resumenNecesidad } from "@/lib/necesidad-verificacion";
import { REQUERIMIENTO_GUIA } from "@/lib/requerimiento-guia";
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
import { contarAdmisibilidad, type AdmisibilidadEstado } from "@/lib/necesidad-admisibilidad";
import { tarjetasCoherencia } from "@/lib/necesidad-coherencia";
import { DiffNoObjecion } from "./diff-no-objecion";
import { useSettingsCatalog } from "./use-settings-catalog";
import { PORCENTAJE_LINEA_CORTE, soles } from "@/lib/segmentacion-parametros";
import { useYear } from "@/lib/year-context";
import { ConfirmDialog } from "./confirm-dialog";
import type { NecesidadItem } from "@/lib/necesidad-items";
import { NecesidadEettCampo } from "./necesidad-eett-campo";
import { NecesidadItemsEditor } from "./necesidad-items-editor";
import { componerControversias, parseInstituciones } from "@/lib/instituciones-arbitrales";
import { InstitucionesArbitralesEditor } from "./instituciones-arbitrales-editor";
import { OtrasPenalidadesEditor } from "./otras-penalidades-editor";
import { SubcontratacionEditor } from "./subcontratacion-editor";
import { RequisitosCalificacionEditor } from "./requisitos-calificacion-editor";
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
  InfoPopover,
  buttonClasses,
} from "./ui";
import { cn } from "@/lib/utils";
import {
  type AccionDef,
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

// Configuración de la ficha editable: cada campo mapea la columna (snake_case,
// para leer) con la clave del PATCH (camelCase) y su tipo de control.
type FichaFieldKind = "text" | "number" | "textarea" | "date" | "requisitos" | "controversias" | "penalidades" | "subcontratacion" | "select";

// Catálogo del "Tipo de proceso de selección" (referencia inicial del área
// usuaria) y su puente al PDF-modelo. Vive en lib/ para compartirse con el
// copiloto del servidor: al elegir un proceso, el copiloto ancla el RAG al
// modelo de requerimiento correspondiente (campo `pdf`).

export type FichaField = {
  col: keyof Necesidad;
  api: string;
  label: string;
  kind?: FichaFieldKind;
  /**
   * Valor con el que arranca un desplegable cuando no hay nada guardado.
   *
   * Se usa donde la norma YA impone una opcion y «sin definir» no es un estado
   * legitimo: el computo del plazo es en dias calendario salvo excepcion (Art.
   * 105.3), asi que dejarlo vacio solo invita a que cada cual lo interprete.
   * Con `porDefecto`, el desplegable no ofrece la opcion vacia.
   */
  porDefecto?: string;
  /**
   * Este campo se muestra siempre que se muestre AQUEL (por su `api`).
   *
   * Para pares que el modelo presenta juntos y que no tiene sentido separar:
   * «Otras penalidades» empieza literalmente por «Adicionalmente a la penalidad
   * por mora…». Sin esto quedaba escondida tras «Mostrar N campos opcionales»,
   * porque no es obligatoria ni la exige el modelo, y quien la buscaba no la
   * encontraba. No infla el modo «Solo obligatorios» con campos sueltos: solo
   * acompaña a uno que ya estaba en pantalla.
   */
  juntoA?: string;
  wide?: boolean;
  /** Campo booleano (checkbox) */
  checkbox?: boolean;
  /**
   * Opciones del desplegable (solo `kind: "select"`).
   *
   * El `value` que se GUARDA es la etiqueta legible, no una clave: la siembra de
   * A3 (`normalizarModalidadPago`) reconoce el texto del área usuaria buscando
   * expresiones como "suma alzada", y una clave con guion bajo no casa.
   */
  opciones?: Array<{ value: string; label: string }>;
  /** Referencia legal (artículo de Ley/Reglamento) que sustenta el campo */
  baseLegal?: string;
  /** Ejemplo concreto para orientar al usuario no técnico */
  ejemplo?: string;
  /**
   * Fórmula de redacción, mostrada DENTRO del campo vacío.
   *
   * Distinta de `ejemplo`, que es una muestra corta y vive en el globo de
   * ayuda: la plantilla enseña las PARTES que el texto debe tener y en qué
   * orden, con los huecos entre corchetes. Se usa donde la norma impone una
   * estructura y un ejemplo suelto no basta para reproducirla.
   */
  plantilla?: string;
  /** Si se define, el campo solo se muestra para estos tipos de objeto */
  mostrarPara?: ObjetoFilter[];
  /**
   * Campo que se guarda pero no se muestra ni se valida: su valor lo aporta otro
   * campo por espejo (p. ej. Centro de costo = Área usuaria). Evita pedir dos
   * veces el mismo dato sin perder la columna en la base.
   */
  oculto?: boolean;
  /** Si es true, el campo es obligatorio según la Guía (Art. 154.1 para obras/consultoría) */
  obligatorio?: boolean;
  /**
   * Obligatorio SOLO para estos objetos (obligatorio condicional). P. ej.
   * "Sistema de entrega" se exige en obras/consultoría de obra pero no en
   * servicios, donde el formato de requerimiento no lo pide. Si el objeto
   * efectivo del proceso cae aquí, el campo se trata como obligatorio.
   */
  obligatorioPara?: ObjetoFilter[];
  /**
   * Si se define, el campo solo se muestra para ESTOS procedimientos (valores de
   * PROCESOS_SELECCION). Es un eje distinto del objeto: hay datos que solo
   * existen en un procedimiento concreto y no en su objeto entero. P. ej. el
   * código de catálogo solo tiene sentido en la Subasta Inversa Electrónica, que
   * se convoca sobre bienes comunes con ficha técnica del Listado; pedirlo en
   * toda contratación de bienes es ruido.
   *
   * Sin este eje, un campo que solo aplica a un procedimiento parece "muerto"
   * cuando se mira el consumo global, y se acaba borrando algo que sí se usa.
   */
  mostrarEnProceso?: string[];
  /** Obligatorio SOLO en estos procedimientos (obligatorio condicional por proceso). */
  obligatorioEnProceso?: string[];
  /**
   * Deja de exigirse cuando el requerimiento está desagregado en ítems.
   *
   * "Cantidad" y "Unidad de medida" en la cabecera solo tienen sentido con una
   * prestación. Desagregado, cada ítem lleva la suya y el dato de cabecera no
   * existe: sumar 500 bolsas de cemento con 300 varillas de fierro no da nada.
   * Seguir exigiéndolos obligaría a inventarse una cifra para poder guardar.
   */
  noExigibleConItems?: boolean;
  /**
   * Contenido del requerimiento que el Art. 44.2 exige "como mínimo, de
   * corresponder": no es obligatorio (por eso no bloquea el guardado), pero
   * tampoco es un extra de relleno. Se muestra SIEMPRE, incluso en el modo
   * "solo obligatorios": si se oculta, el área usuaria nunca propone y la
   * cadena propuesta → estrategia (Art. 44.7) queda muerta.
   */
  recomendado?: boolean;
  /**
   * Subgrupo por literal legal: varios campos comparten un mismo inciso del Art.
   * 44.2 (p. ej. 44.2.a agrupa alcance + condiciones + plazo). Se pone el MISMO
   * título en todos los campos del grupo; el render lo pinta UNA vez como
   * subtítulo, en lugar de repetir "a)"/"c)" en cada label —que se leía como un
   * error de numeración—. Es robusto ante campos ocultos: el subtítulo sale
   * antes del primer campo VISIBLE del grupo.
   */
  subgrupo?: string;
};

/**
 * Objetos efectivos de un requerimiento: si el procedimiento acota objetos,
 * manda ese ámbito (afinado al objeto declarado si cae dentro, Art. 44.10); si
 * no, el objeto declarado.
 *
 * Estaba copiado en cuatro sitios (medidor de avance, filtrado del formulario,
 * obligatorio condicional y campos objetivo de la IA). Cuatro copias de la misma
 * regla es cómo el medidor acaba contando campos que el formulario no enseña.
 */
export function objetosEfectivosDe(proceso: string, objeto?: ObjetoFilter): ObjetoFilter[] {
  const objetosProc = proceso ? OBJETOS_POR_PROCEDIMIENTO[proceso] : undefined;
  if (objetosProc) return objeto && objetosProc.includes(objeto) ? [objeto] : objetosProc;
  return objeto ? [objeto] : [];
}


/**
 * Etiqueta de un campo NO obligatorio pero que sí es contenido del
 * requerimiento.
 *
 * Estaba fija en "contenido del requerimiento (Art. 44.2)" para todo campo
 * `recomendado`. Al pasar a recomendados el problema identificado, el beneficio
 * esperado y la población beneficiaria —que son sustento de la finalidad
 * pública, Art. 44.1— la ficha empezó a atribuirles un artículo que no es el
 * suyo. Se toma el artículo de su PROPIA base legal.
 */
export function etiquetaRecomendado(f: FichaField): string {
  const art = f.baseLegal?.match(/Art\.\s*[\d.]+/)?.[0];
  return art ? `contenido del requerimiento (${art})` : "recomendado";
}

/** ¿El campo aplica al objeto y al procedimiento efectivos? (no mira `oculto`) */
export function campoAplica(f: FichaField, efectivos: ObjetoFilter[], proceso: string): boolean {
  // El eje de proceso es el más específico: si el campo lo declara y el proceso
  // ya está elegido, decide él. Con el proceso sin definir no se filtra: quien
  // aún no lo eligió debe poder ver el campo.
  if (f.mostrarEnProceso && proceso && !f.mostrarEnProceso.includes(proceso)) return false;
  if (!f.mostrarPara) return true;
  // Sin objeto ni proceso no hay con qué acotar: se muestra.
  if (efectivos.length === 0) return true;
  return f.mostrarPara.some((o) => efectivos.includes(o));
}

/** ¿El campo es obligatorio para ese objeto/procedimiento? */
export function campoObligatorio(f: FichaField, efectivos: ObjetoFilter[], proceso: string): boolean {
  if (f.obligatorio) return true;
  if (proceso && f.obligatorioEnProceso?.includes(proceso)) return true;
  return Boolean(f.obligatorioPara?.some((o) => efectivos.includes(o)));
}
/**
 * Asistente de la denominación (Art. 44.1 / 44.6 / 44.10).
 *
 * Propone el nombre con las piezas YA registradas en la ficha y señala las que
 * faltan, con la sección donde se rellenan. No completa huecos por su cuenta:
 * el nombre viaja al expediente y acaba impreso en el Anexo N° 2.
 */

/**
 * Todos los campos de la ficha que APLICAN al proceso/objeto, sin filtrar por
 * tipo. Es lo que se le pasa al modelo para que diga cuáles exige.
 *
 * Vive FUERA del componente porque no depende de su estado: solo de
 * FICHA_SECCIONES y del objeto efectivo. Dentro se declaraba después de su
 * primer uso y se recreaba en cada render.
 */
function catalogoCampos(
  proceso: string,
  objeto?: string | null,
): Array<{ api: string; label: string; seccion: string }> {
  const efectivos = objetosEfectivosDe(proceso, (objeto ?? undefined) as ObjetoFilter | undefined);
  const out: Array<{ api: string; label: string; seccion: string }> = [];
  for (const section of FICHA_SECCIONES) {
    for (const f of section.fields) {
      if (f.oculto || !campoAplica(f, efectivos, proceso)) continue;
      out.push({ api: f.api, label: f.label, seccion: section.title });
    }
  }
  return out;
}

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

type FichaSection = {
  title: string;
  fields: FichaField[];
  preliminar?: boolean;
  nota?: string;
  /**
   * Resumen de UNA frase en lenguaje llano (sin artículos ni jerga), para
   * orientar a quien no es técnico. Se muestra siempre como entradilla; en
   * "Modo simple" reemplaza a la nota legal.
   */
  resumenLlano?: string;
  simple?: boolean;
  /** Si se define, la sección solo se muestra para estos tipos de objeto */
  mostrarPara?: ObjetoFilter[];
};

// Orden de la ficha, alineado con el Art. 44 del Reglamento.
//
// La Necesidad ES el requerimiento del área usuaria, así que el recorrido sigue
// el del artículo: primero POR QUÉ (44.1 finalidad pública), luego QUÉ (44.10
// objeto, 126.1 EETT/TDR), luego EN QUÉ CONDICIONES (44.2), y al final lo
// administrativo. Antes la Justificación iba quinta, detrás de quince campos de
// presupuesto: quien formula tenía que atravesar rubros y clasificadores antes
// de poder decir para qué lo necesita.
export const FICHA_SECCIONES: FichaSection[] = [
  {
    title: "Identificación",
    resumenLlano: "Quién pide la contratación y datos básicos de la entidad y el año.",
    simple: true,
    fields: [
      { col: "area_usuaria", api: "areaUsuaria", label: "Área usuaria (y centro de costo)", obligatorio: true, baseLegal: "Art. 20.a Reglamento · el área usuaria formula su requerimiento en coordinación con la DEC, y ese requerimiento debe estar previsto en el CMN. Luego se lo remite (Art. 44.2).", ejemplo: "Oficina de Logística" },
      { col: "entidad", api: "entidad", label: "Entidad", obligatorio: true, baseLegal: "Ley 32069, Art. 4", ejemplo: "Ministerio de Vivienda" },
      { col: "unidad_ejecutora", api: "unidadEjecutora", label: "Unidad ejecutora", baseLegal: "Unidad ejecutora del pliego a la que se imputa la contratación. Identifica a la entidad contratante junto con su denominación y RUC.", obligatorio: true, ejemplo: "UE 001" },
      // Centro de costo = Área usuaria (siempre espejado). Se guarda pero no se
      // muestra: pedirlo aparte era registrar dos veces el mismo dato.
      // Espejo del área usuaria: se guarda pero no se muestra. Estaba marcado
      // `obligatorio` a la vez que `oculto`, dos cosas que se contradicen — no
      // hay forma de rellenar un campo que no se enseña.
      { col: "centro_costo", api: "centroCosto", label: "Centro de costo", oculto: true, ejemplo: "CC-1234" },
      { col: "responsable", api: "responsable", label: "Responsable", baseLegal: "Art. 20.a Reglamento · formular adecuadamente el requerimiento es función del área usuaria; quien firma responde de su contenido.", obligatorio: true, ejemplo: "Nombre del jefe de área" },
      { col: "anio_fiscal", api: "anioFiscal", label: "Año fiscal", kind: "number", obligatorio: true, baseLegal: "Ejercicio presupuestal al que corresponde la necesidad, según el CMN.", ejemplo: "2026" },
    ],
  },
  {
    title: "Programación y presupuesto",
    resumenLlano: "Cuánto cuesta aproximadamente, con qué fondos se paga y para cuándo se necesita.",
    simple: true,
    fields: [
      // Eran 19 campos en fila corrida. Se agrupan siguiendo el recorrido de quien
      // rellena: dónde está programada la necesidad, a qué inversión se imputa, con
      // qué fuente se paga, cuánto vale y para cuándo se necesita. El periodo del CMN
      // vivia en Identificación, que no es donde se busca.
      { subgrupo: "a) Programación en el CMN y el PAC", col: "periodo_programacion", api: "periodoProgramacion", label: "Periodo de programación", baseLegal: "Art. 20.a Reglamento · el requerimiento debe estar previsto en el CMN; aquí va el periodo multianual al que corresponde.", ejemplo: "2026-I" },
      { subgrupo: "a) Programación en el CMN y el PAC", col: "meta_presupuestal", api: "metaPresupuestal", label: "Meta presupuestal", obligatorio: true, baseLegal: "Meta del presupuesto institucional que financia la contratación.", ejemplo: "Meta 001" },
      { subgrupo: "a) Programación en el CMN y el PAC", col: "trimestre", api: "trimestre", label: "Trimestre", kind: "number", baseLegal: "Trimestre en que el PAC prevé ejecutar la contratación (1 a 4).", ejemplo: "1" },
      { subgrupo: "a) Programación en el CMN y el PAC", col: "mes_programado", api: "mesProgramado", label: "Mes programado", kind: "number", baseLegal: "Mes previsto en el PAC (1 a 12).", ejemplo: "3" },
      { subgrupo: "b) Inversión a la que se imputa", col: "cui", api: "cui", label: "Código Único de Inversión (CUI)", recomendado: true, baseLegal: "Art. 46.1.c Reglamento · lo pide la variable c) del Formato de Estrategia. Viene de act_proy del pedido SIGA.", ejemplo: "2661009" },
      { subgrupo: "b) Inversión a la que se imputa", col: "cadena_funcional", api: "cadenaFuncional", label: "Cadena funcional", baseLegal: "Cadena funcional programática del SIGA; su 4.º segmento lleva el CUI.", ejemplo: "21-046-0102-2656190-4000129" },
      { subgrupo: "b) Inversión a la que se imputa", col: "clasificador_gasto", api: "clasificadorGasto", label: "Clasificador de gasto", baseLegal: "Clasificador de gastos del SIAF; va a la solicitud de certificación presupuestal.", ejemplo: "2.3.1.1.1" },
      { subgrupo: "b) Inversión a la que se imputa", col: "proyecto_inversion", api: "proyectoInversion", label: "Proyecto de inversión (nombre)", kind: "textarea", wide: true, baseLegal: "Art. 46.1.c Reglamento · declaración de viabilidad del proyecto de inversión.", ejemplo: "186 MEJORAMIENTO Y AMPLIACION DE LOS SERVICIOS DE AGUA POTABLE Y SANEAMIENTO BASICO EN LAS LOCALIDADES DE …, DISTRITO DE CHALLHUAHUACHO, PROVINCIA DE COTABAMBAS, DEPARTAMENTO DE APURIMAC" },
      { subgrupo: "b) Inversión a la que se imputa", col: "ioarr", api: "ioarr", label: "IOARR", baseLegal: "Art. 46.1.c Reglamento · aprobación de la IOARR.", ejemplo: "IOARR-5678" },
      { subgrupo: "c) Financiamiento", col: "fuente_financiamiento", api: "fuenteFinanciamiento", label: "Fuente de financiamiento", obligatorio: true, baseLegal: "Fuente de financiamiento del clasificador del MEF con la que se atiende la necesidad.", ejemplo: "Recursos Ordinarios" },
      { subgrupo: "c) Financiamiento", col: "rubro", api: "rubro", label: "Rubro", obligatorio: true, baseLegal: "Rubro de financiamiento del SIGA (col. `fuente_fto` del pedido).", ejemplo: "18" },
      { subgrupo: "c) Financiamiento", col: "moneda", api: "moneda", label: "Moneda", kind: "select", opciones: OPCIONES_MONEDA, baseLegal: "Moneda del requerimiento; determina cómo se expresa la cuantía (Art. 47.1).", ejemplo: "PEN" },
      { subgrupo: "d) Valor estimado", col: "monto_estimado", api: "montoEstimado", label: "Monto estimado (S/)", kind: "number", obligatorio: true, baseLegal: "Ley 32069, Art. 48 · la entidad establece la CUANTÍA de la contratación para gestionar los recursos presupuestales. Art. 47.1 Reglamento · el valor definitivo lo fija la interacción con el mercado; esta es la estimación de partida.", ejemplo: "50000" },
      { subgrupo: "d) Valor estimado", col: "costo_unitario", api: "costoUnitario", label: "Costo unitario (S/)", kind: "number", baseLegal: "Art. 47.1 Reglamento · base de la cuantía en Subasta Inversa y Comparación de Precios, donde se compara por unitario.", ejemplo: "12.50", obligatorioEnProceso: ["Subasta Inversa Electrónica", "Comparación de Precios"] },
      { subgrupo: "d) Valor estimado", col: "costo_total", api: "costoTotal", label: "Costo total (S/)", kind: "number", baseLegal: "Se calcula automáticamente (cant. × costo unitario)", ejemplo: "6250" },
      { subgrupo: "d) Valor estimado", col: "anio_referencia", api: "anioReferencia", label: "Año de referencia", kind: "number", ejemplo: "2026", obligatorioEnProceso: ["Comparación de Precios", "Subasta Inversa Electrónica"], baseLegal: "Art. 47.1 Reglamento · año del precio de referencia con el que se actualiza la cuantía." },
      { subgrupo: "e) Fechas del requerimiento", col: "fecha_requerida", api: "fechaRequerida", label: "Fecha requerida", kind: "date", baseLegal: "Fecha para la que se necesita; la DEC estima contra ella el cronograma (Art. 46.1.o).", obligatorio: true, ejemplo: "2026-03-15" },
      { subgrupo: "e) Fechas del requerimiento", col: "fecha_remision_dec", api: "fechaRemisionDec", label: "Fecha de recepción por la DEC", kind: "date", obligatorio: true, baseLegal: "Art. 44.2 Reglamento · El área usuaria remite el requerimiento a la DEC", ejemplo: "2026-03-16" },
      { subgrupo: "e) Fechas del requerimiento", col: "fecha_version_dos", api: "fechaVersionDos", label: "Fecha de la 2ª versión del requerimiento", kind: "date", baseLegal: "Art. 44.7 Reglamento · Ciclo de no objeción (mejora del requerimiento)", ejemplo: "2026-03-20" },
      { subgrupo: "e) Fechas del requerimiento", col: "fecha_version_n", api: "fechaVersionN", label: "Fecha de la \"n\" versión del requerimiento", kind: "date", baseLegal: "Art. 44.7 Reglamento · Última iteración del requerimiento", ejemplo: "2026-03-27" },
      ],
    },
    {
    title: "3.1 Finalidad pública de la contratación",
    resumenLlano: "Explica para qué se necesita esta contratación: qué problema resuelve y a quién beneficia.",
    simple: true,
    nota: "El requerimiento atiende una necesidad para el cumplimiento de la finalidad pública, promoviendo el valor por dinero (Art. 44.1 del Reglamento · Bases Estándar, Cap. III · 3.1).",
    // El sustento de la finalidad (problema, objetivo, beneficio, población) se
    // retiró: no lo consumía ninguna fase, ya no se imprime en ningún documento
    // desde que se quitó la Ficha en Word, y su único uso era dar contexto a la
    // IA. Lo que el Art. 44.1 exige es la finalidad pública, que sí se conserva.
    fields: [
      // La fórmula sale LITERALMENTE del Art. 44.1 del Reglamento: "atienden una
      // NECESIDAD para el cumplimiento de la FINALIDAD PÚBLICA, promoviendo el
      // VALOR POR DINERO". Esas tres piezas, en ese orden, son la estructura que
      // el texto debe reproducir; el cierre recoge los términos con que la Ley
      // 32069 define el valor por dinero (Art. 5.1.c: eficiencia, eficacia y
      // economía). No se cita otra normativa a propósito: el requerimiento se
      // sustenta en la Ley 32069 y su Reglamento, y meter aquí normas generales
      // desplaza el fundamento propio de la contratación.
      {
        col: "finalidad_publica",
        api: "finalidadPublica",
        label: "Finalidad pública",
        kind: "textarea",
        wide: true,
        obligatorio: true,
        baseLegal:
          "Reglamento Art. 44.1 · el requerimiento atiende una NECESIDAD para el cumplimiento de la FINALIDAD PÚBLICA, promoviendo el VALOR POR DINERO.\n" +
          "Ley 32069 Art. 5.1.c · el valor por dinero maximiza lo obtenido en términos de eficiencia, eficacia y economía.\n" +
          "Ley 32069 Art. 27.2 · la decisión debe ser la más conveniente para alcanzar la finalidad pública del contrato.",
        plantilla:
          "La contratación de [OBJETO] atiende la necesidad de [NECESIDAD CONCRETA DEL ÁREA USUARIA], " +
          "para el cumplimiento de la finalidad pública de [COMPETENCIA O SERVICIO PÚBLICO A CARGO DE LA ENTIDAD], " +
          "promoviendo el valor por dinero en términos de eficiencia, eficacia y economía.",
        ejemplo:
          "La contratación del servicio de mantenimiento de vías vecinales atiende la necesidad de transitabilidad " +
          "segura en el distrito, para el cumplimiento de la finalidad pública de conservar la infraestructura vial " +
          "a cargo de la municipalidad, promoviendo el valor por dinero en términos de eficiencia, eficacia y economía.",
      },
    ],
  },
  {
    title: "3.2 Descripción general del requerimiento",
    resumenLlano: "Di qué es lo que se va a contratar, en cuánta cantidad y con qué unidad de medida.",
    simple: true,
    nota: "Describe el requerimiento en conjunto e incluye los ítems o paquetes —el cuadro de abajo los desagrega— y, si la prestación principal las conlleva, las prestaciones accesorias. El objeto se determina por la naturaleza de la contratación; con varias prestaciones, manda la de mayor costo (Art. 44.10). La descripción TÉCNICA detallada (EETT/TDR) NO va aquí: es el 3.4.",
    fields: [
      { col: "especialidad", api: "especialidad", label: "Especialidad", obligatorioPara: ["obras", "consultoria_obra"], mostrarPara: ["obras", "consultoria_obra"], baseLegal: "Art. 72.3.b Reglamento · en obras y consultoría de obras la experiencia del personal clave corresponde a la especialidad y subespecialidad (Art. 157).", ejemplo: "Bienes comunes" },
      { col: "subespecialidad", api: "subespecialidad", label: "Subespecialidad", mostrarPara: ["obras", "consultoria_obra"], baseLegal: "Art. 157 Reglamento · subespecialidad de la experiencia en obras y consultoría de obras.", ejemplo: "Útiles de oficina" },
      // El código de catálogo se registra AHORA POR ÍTEM, en el cuadro de la
      // sección 3.2: un pedido de varias líneas trae un código por prestación y
      // aquí solo cabía uno. Se guarda pero no se muestra —la columna sigue viva
      // y las necesidades antiguas conservan su valor—. La exigencia de la
      // Subasta Inversa (bienes comunes con FICHA TÉCNICA del Listado) se cumple
      // ahora en la columna del cuadro, que es donde está el dato.
      { col: "codigo_catalogo", api: "codigoCatalogo", label: "Código de catálogo", oculto: true, ejemplo: "CAT-00123" },
      // A fila completa: al importar recibe el motivo del pedido (col. S), que es
      // una frase larga y en un campo estrecho se leía a trozos.
      // Lo que el 3.2 del modelo pide de verdad: «INDICAR LA DESCRIPCIÓN GENERAL
      // DEL REQUERIMIENTO, INCLUYENDO LOS ÍTEMS O PAQUETES, DE SER EL CASO. EN CASO
      // LA PRESTACIÓN PRINCIPAL CONLLEVE PRESTACIONES ACCESORIAS, CONSIGNARLAS».
      // No existía: la ficha tenía el nombre de catálogo y el cuadro de ítems, pero
      // ningún sitio donde describir el requerimiento en conjunto.
      { col: "descripcion_general", api: "descripcionGeneral", label: "Descripción general del requerimiento", kind: "textarea", wide: true, obligatorio: true, baseLegal: "Art. 44.2 Reglamento · el requerimiento describe la prestación; el cuadro de ítems de abajo la desagrega cuando son varias (Arts. 52 y 53.3).", plantilla: "Se requiere [OBJETO] para [FINALIDAD OPERATIVA]. Comprende [NÚMERO] ítem(es) o paquete(s), detallados en el cuadro. La prestación principal es [PRESTACIÓN] y conlleva las prestaciones accesorias de [ACCESORIAS, si las hay].", ejemplo: "Se requiere el servicio de mantenimiento de vías vecinales para asegurar la transitabilidad. Comprende 3 ítems, detallados en el cuadro." },
      { col: "prestaciones_accesorias", api: "prestacionesAccesorias", label: "Prestaciones accesorias de la prestación principal", kind: "textarea", wide: true, baseLegal: "Art. 44.4 Reglamento · se evalúa la necesidad de prestaciones accesorias —mantenimiento preventivo y correctivo, operación— considerando el ciclo de vida del activo. El formato pide consignarlas aquí cuando la prestación principal las conlleve; su detalle técnico va en el 3.4.", ejemplo: "Mantenimiento preventivo semestral durante los dos primeros años." },
      { col: "descripcion_catalogo", api: "descripcionCatalogo", label: "Descripción de catálogo", kind: "textarea", wide: true, recomendado: true, baseLegal: "Art. 44.6 Reglamento · Es el qué del nombre de la contratación, en términos genéricos: no debe referir marca, fabricante ni patente. Al importar se toma del motivo del pedido (col. S), así que conviene revisarlo.", ejemplo: "Papel bond A4" },
      // "Cantidad" y "Unidad de medida" YA NO ESTÁN aquí: describían una sola
      // prestación y el cuadro de ítems las lleva por línea (Art. 44.10 · 52).
      // Las columnas siguen en la base —hay necesidades antiguas con esos datos
      // y los exportables los leen— pero no se piden en el formulario: pedir un
      // dato de cabecera que contradice al desagregado solo genera descuadres.
      { col: "frecuencia", api: "frecuencia", label: "Frecuencia", baseLegal: "Art. 126.2 Reglamento · en provisión continua o periódica el plazo no puede ser menor a un año.", ejemplo: "Mensual" },
    ],
  },
  {
    // Los cinco literales del 44.2, juntos. Antes estaban repartidos entre
    // "Objeto" y una sección llamada "Estrategia de contratación", que es otro
    // artefacto: la estrategia la hace la DEC en el expediente (Art. 46), no el
    // área usuaria en su requerimiento.
    title: "3.3 Condiciones de contratación",
    resumenLlano: "Cómo se ejecutará: plazo, forma de pago, entrega y demás condiciones. Lo obligatorio ya viene marcado.",
    simple: false,
    nota: "Condiciones de contratación (Art. 44.2 · Bases Estándar, Cap. III · 3.3): modalidad de pago, sistema de entrega, plazo y lugar de prestación, adelantos, subcontratación y fórmula de reajuste. La DEC las decide después en la Estrategia (A4); si las cambia, requiere la no objeción del área usuaria (Art. 44.7). Los requisitos de calificación van en la sección 3.5.",
    fields: [
      // Los apartados van en el ORDEN Y CON LAS LETRAS del requerimiento modelo
      // (3.3, apartados a-j). Antes se rotulaban con las letras del Art. 44.2 del
      // Reglamento —a) alcance, c) modalidad de pago, e) fórmula de reajuste—, que
      // son otra numeración distinta: quien trasladaba la ficha al documento tenía
      // que reordenar de cabeza. La cita del 44.2 sigue en la base legal de cada
      // campo, que es donde corresponde.
      { col: "modalidad_pago", api: "modalidadPago", label: "Propuesta de modalidad de pago", subgrupo: "a) Modalidad de pago", kind: "select", opciones: etiquetas(OPCIONES_MODALIDAD_PAGO), recomendado: true, baseLegal: "Art. 44.2.c Reglamento · la modalidad de pago es contenido mínimo del requerimiento: el área usuaria la propone y la DEC la determina en la estrategia (Art. 46.1.h). Las modalidades posibles son las siete del Art. 130: suma alzada, precios unitarios, esquema mixto, tarifas, porcentajes, honorario fijo más comisión de éxito y pago por consumo.", ejemplo: "Suma alzada" },
      { col: "sistema_entrega", api: "sistemaEntrega", label: "Propuesta de sistema de entrega", subgrupo: "b) Sistema de entrega", kind: "select", opciones: etiquetas(OPCIONES_SISTEMA_ENTREGA), obligatorioPara: ["obras", "consultoria_obra"], baseLegal: "Art. 44.2.c Reglamento · el sistema de entrega es contenido mínimo del requerimiento: el área usuaria lo propone y la DEC lo determina en la estrategia (Art. 46.1.i). Los sistemas posibles son los del Art. 129; si no se prevé ninguno, se elige «No aplica».", ejemplo: "Llave en mano", mostrarPara: ["servicios", "obras", "consultoria_obra"] },
      { col: "plazo_ejecucion", api: "plazoEjecucion", label: "Plazo de ejecución o prestación (días)", subgrupo: "c) Plazo de prestación", kind: "number", obligatorio: true, baseLegal: "Art. 126.2 Reglamento · En bienes y servicios rutinarios u operacionales de provisión continua, no puede ser menor a un año.", ejemplo: "60" },
      { col: "plazo_ejecucion_unidad", api: "plazoEjecucionUnidad", label: "Cómputo del plazo", subgrupo: "c) Plazo de prestación", kind: "select", obligatorio: true, porDefecto: "calendario", opciones: [{ value: "calendario", label: "Días calendario" }, { value: "habiles", label: "Días hábiles" }], baseLegal: "Art. 105.3 Reglamento · durante la ejecución contractual los plazos se cuentan en días CALENDARIO, salvo que el Reglamento indique lo contrario; supletoriamente rigen los Arts. 183 y 184 del Código Civil.", ejemplo: "Días calendario" },
      { subgrupo: "d) Lugar de prestación", col: "departamento", api: "departamento", label: "Departamento", recomendado: true, baseLegal: "Art. 44.2 Reglamento · lugar de entrega o de prestación, de corresponder.", ejemplo: "Lima" },
      { subgrupo: "d) Lugar de prestación", col: "provincia", api: "provincia", label: "Provincia", recomendado: true, baseLegal: "Art. 44.2 Reglamento · lugar de entrega o de prestación, de corresponder.", ejemplo: "Lima" },
      { subgrupo: "d) Lugar de prestación", col: "distrito", api: "distrito", label: "Distrito", recomendado: true, baseLegal: "Art. 44.2 Reglamento · lugar de entrega o de prestación, de corresponder.", ejemplo: "San Isidro" },
      { subgrupo: "d) Lugar de prestación", col: "lugar_entrega", api: "lugarEntrega", label: "Lugar de prestación o entrega", kind: "textarea", wide: true, recomendado: true, baseLegal: "Art. 44.2 Reglamento · lugar concreto de entrega o de prestación.", ejemplo: "Av. Principal 123" },
      { subgrupo: "e) Adelanto directo", col: "adelanto_directo", api: "adelantoDirecto", label: "Adelanto directo", kind: "textarea", wide: true, recomendado: true, baseLegal: "Art. 137 Reglamento · en bienes y servicios solo se otorga adelanto directo en los supuestos que ahí se tasan.", plantilla: "La entidad contratante otorgará [NÚMERO] adelanto(s) directo(s) por el [PORCENTAJE, no mayor al 30% en conjunto] del monto del contrato original. El contratista debe solicitarlos dentro de los [PLAZO] días siguientes al perfeccionamiento del contrato.", ejemplo: "Hasta 30% del monto del contrato" },
      { subgrupo: "f) Penalidades", col: "penalidad_mora", api: "penalidadMora", label: "Penalidad por mora", kind: "textarea", wide: true, recomendado: true, baseLegal: "Art. 120 Reglamento · penalidad por mora ante retraso injustificado; el Art. 119 exige que el contrato la establezca junto con las demás penalidades.", ejemplo: "0.10 × monto / (F × plazo en días)" },
      // El Art. 119.1 pide que el contrato establezca la penalidad por mora Y OTRAS
      // penalidades. El apartado f) del modelo trae un cuadro para ellas (supuesto,
      // forma de calculo y procedimiento de verificacion) que la ficha no recogia.
      { subgrupo: "f) Penalidades", col: "otras_penalidades", api: "otrasPenalidades", label: "Otras penalidades", juntoA: "penalidadMora", kind: "penalidades", wide: true, baseLegal: "Arts. 119.1 y 119.2 Reglamento · el contrato establece la penalidad por mora Y otras penalidades ante el incumplimiento injustificado de las obligaciones contractuales.", ejemplo: "No presentar el informe mensual en plazo · 0.5 UIT por informe · acta del área usuaria." },
      { subgrupo: "g) Subcontratación", col: "subcontratacion", api: "subcontratacion", label: "Subcontratación", kind: "subcontratacion", wide: true, baseLegal: "Art. 108.1 Reglamento · se subcontrata hasta el 40% del monto del contrato vigente; las bases pueden excluir prestaciones esenciales o, si así se evaluó en la estrategia de contratación Y con el sustento correspondiente, prohibirla.", mostrarPara: ["servicios", "obras", "consultoria_obra"], ejemplo: "Prohibida / Permitida hasta 40%" },
      { subgrupo: "h) Fórmula de reajuste", col: "formula_reajuste", api: "formulaReajuste", label: "Fórmula de reajuste", plantilla: "[DE SER EL CASO, CONSIGNAR LAS FÓRMULAS DE REAJUSTE CORRESPONDIENTES Y EL PROCEDIMIENTO, DE ACUERDO CON LO PREVISTO EN EL NUMERAL 136.2 DEL ARTÍCULO 136 DEL REGLAMENTO]", kind: "textarea", wide: true, recomendado: true, baseLegal: "Art. 136.2 Reglamento · solo en contratos de ejecución PERIÓDICA O CONTINUADA; el reajuste sigue la variación del IPC nacional o de Lima Metropolitana del mes de pago, según dónde se ejecute la prestación. Se incluye a propuesta del área usuaria y previa validación en la estrategia de contratación.", ejemplo: "Fórmula polinómica basada en el índice de precios del INEI" },
      { subgrupo: "i) Solución de controversias contractuales", col: "solucion_controversias", api: "solucionControversias", label: "Solución de controversias contractuales", kind: "controversias", wide: true, recomendado: true, baseLegal: "Arts. 330 y 331 Reglamento · conciliación y arbitraje; el arbitraje institucional se inicia ante la Institución Arbitral elegida entre las designadas (Art. 331.2). El Art. 224, que citaba antes este campo, es de contratos estandarizados de ingeniería y construcción de uso internacional.", ejemplo: "Cámara de Comercio de Lima — RUC 20112273922" },
      { subgrupo: "j) Plazo para respuestas entre las partes", col: "plazo_respuestas", api: "plazoRespuestas", label: "Plazo máximo de respuesta entre las partes (días calendario)", kind: "number", baseLegal: "Apartado j) del formato de requerimiento · plazo en que las partes se responden durante la ejecución. No lo fija el Reglamento: es una condición del modelo.", ejemplo: "Cinco (5) días hábiles desde la recepción de la comunicación." },

      // Lo que el Art. 44.2 exige y el modelo no numera en su 3.3. Va detrás y con
      // rótulo propio para que no se confunda con la lista de letras.
      { col: "alcance", api: "alcance", label: "Alcance de la contratación", subgrupo: "Alcance y condiciones de ejecución (Art. 44.2.a)", kind: "textarea", wide: true, recomendado: true, obligatorioPara: ["obras", "consultoria_obra"], baseLegal: "Art. 44.2.a Reglamento · el alcance y las condiciones de ejecución se definen en función del desempeño y la funcionalidad.", ejemplo: "Suministro a nivel nacional" },
      { col: "condiciones_ejecucion", api: "condicionesEjecucion", label: "Condiciones de ejecución", subgrupo: "Alcance y condiciones de ejecución (Art. 44.2.a)", kind: "textarea", wide: true, recomendado: true, baseLegal: "Art. 44.2.a Reglamento · En función del desempeño y la funcionalidad.", ejemplo: "Entrega en 30 días calendario" },
      { col: "equipamiento_minimo", api: "equipamientoMinimo", label: "Equipamiento mínimo", subgrupo: "Equipamiento y habilitaciones (Art. 44.2.d)", kind: "textarea", wide: true, baseLegal: "Art. 44.2.d Reglamento · Recursos que el contratista necesita para ejecutar la contratación.", ejemplo: "2 camionetas, 1 almacén" },
      { col: "habilitaciones", api: "habilitaciones", label: "Habilitaciones y permisos", subgrupo: "Equipamiento y habilitaciones (Art. 44.2.d)", kind: "textarea", wide: true, baseLegal: "Art. 44.2.d Reglamento", ejemplo: "Licencia municipal, RNP" },
      { subgrupo: "Otras condiciones del contrato", col: "garantias", api: "garantias", label: "Garantías (fiel cumplimiento, etc.)", kind: "textarea", wide: true, recomendado: true, baseLegal: "Art. 138 Reglamento · garantía de fiel cumplimiento en bienes y servicios; el Art. 139 fija las excepciones y el Art. 113 los tipos de garantía.", ejemplo: "Garantía de fiel cumplimiento 10% del contrato" },
      { subgrupo: "Otras condiciones del contrato", col: "recepcion_conformidad", api: "recepcionConformidad", label: "Recepción y conformidad de la prestación", kind: "textarea", wide: true, recomendado: true, baseLegal: "Art. 144 Reglamento · el área usuaria es responsable de brindar la conformidad de bienes y servicios.", ejemplo: "Conformidad otorgada por el área usuaria en 10 días hábiles" },
      { subgrupo: "Otras condiciones del contrato", col: "gestion_riesgos", api: "gestionRiesgos", label: "Gestión de riesgos", kind: "textarea", wide: true, recomendado: true, baseLegal: "Art. 44.3 Reglamento · al elaborar el requerimiento se inicia la identificación y evaluación de riesgos y su asignación a alguna de las partes, que es insumo de la estrategia de contratación.", ejemplo: "Matriz de riesgos y asignación entre las partes" },
      { subgrupo: "Obras y consultoría de obras (Art. 154.1)", col: "metas_fisicas", api: "metasFisicas", label: "Metas físicas / objetivos funcionales", kind: "textarea", wide: true, recomendado: true, baseLegal: "Art. 154 Reglamento · requerimiento de obras y consultoría de obras; las metas físicas concretan el alcance del Art. 44.2.a.", mostrarPara: ["obras", "consultoria_obra"], ejemplo: "Construcción de 1,200 m² de pavimento rígido" },
      { subgrupo: "Obras y consultoría de obras (Art. 154.1)", col: "disponibilidad_terreno", api: "disponibilidadTerreno", label: "Disponibilidad física del terreno", kind: "textarea", wide: true, recomendado: true, baseLegal: "Art. 154.1.e Reglamento · Sustento de la disponibilidad del terreno, según corresponda", mostrarPara: ["obras"], ejemplo: "Terreno saneado, libre de interferencias (acta adjunta)" },
      { subgrupo: "Obras y consultoría de obras (Art. 154.1)", col: "seguros", api: "seguros", label: "Seguros", kind: "textarea", wide: true, recomendado: true, baseLegal: "Formato de las bases estándar de obras · seguros (CAR, responsabilidad civil). El Art. 154.1 no lo enumera: es una condición del modelo, no una exigencia del Reglamento.", mostrarPara: ["obras"], ejemplo: "Seguro CAR y de responsabilidad civil durante la ejecución" },
      { subgrupo: "Obras y consultoría de obras (Art. 154.1)", col: "metodologia_bim", api: "metodologiaBim", label: "Metodologías colaborativas (BIM)", kind: "textarea", wide: true, baseLegal: "Art. 154.1.b Reglamento · Necesidad de emplear BIM", mostrarPara: ["obras", "consultoria_obra"], ejemplo: "Uso de BIM en la etapa de ejecución (SNPMGI)" },
      { subgrupo: "Obras y consultoría de obras (Art. 154.1)", col: "gestion_calidad", api: "gestionCalidad", label: "Gestión de la calidad", kind: "textarea", wide: true, recomendado: true, baseLegal: "Formato de las bases estándar de obras · plan de gestión de la calidad. El Art. 154.1 no lo enumera.", mostrarPara: ["obras", "consultoria_obra"], ejemplo: "Plan de aseguramiento y control de calidad" },
      { subgrupo: "Obras y consultoría de obras (Art. 154.1)", col: "anexos_tecnicos", api: "anexosTecnicos", label: "Anexos técnicos", kind: "textarea", wide: true, baseLegal: "Formato de las bases estándar de obras y consultoría de obras · anexos técnicos. El Art. 154.1 no los enumera.", mostrarPara: ["obras", "consultoria_obra"], ejemplo: "Planos, estudios básicos, memoria descriptiva" },
      ],
    },
    {
    title: "3.4 Términos de referencia",
    resumenLlano: "Describe con detalle las características técnicas de lo que se contrata (el «cómo debe ser»).",
    simple: false,
    nota: "Características técnicas y condiciones de ejecución, de preferencia por desempeño y funcionalidad antes que por rasgos meramente descriptivos (Art. 126.1 · principio de valor por dinero). AQUÍ NO van los requisitos de calificación del proveedor: esos son el 3.5. Sí cabe listar el personal, equipamiento o infraestructura NO clave que se necesite para prestar el servicio, pero sin exigir su acreditación en la selección: son condiciones de la ejecución.",
    fields: [
      { col: "descripcion_detallada", api: "descripcionDetallada", label: "Términos de referencia / Especificaciones técnicas", kind: "textarea", wide: true, obligatorio: true, baseLegal: "Art. 126.1 Reglamento · Especificaciones técnicas (bienes) o términos de referencia (servicios)", ejemplo: "Servicio de X con las siguientes características técnicas…" },
      // Lo demás que el 3.4 del modelo exige y la ficha no recogía. Va detrás del
      // TDR porque son precisiones SOBRE él, no descripciones alternativas.
      { col: "ficha_tecnica_identificacion", api: "fichaTecnicaIdentificacion", label: "Ficha técnica u homologación aplicable", baseLegal: "Art. 260 Reglamento · las fichas técnicas y de homologación aprobadas son de uso OBLIGATORIO con independencia del monto; cuando se usan, el requerimiento debe identificarlas.", ejemplo: "Ficha técnica N° 0001-2025-PERUCOMPRAS · Papel bond A4 75 g" },
      { col: "normas_tecnicas", api: "normasTecnicas", label: "Normas técnicas y metrológicas aplicables", kind: "textarea", wide: true, baseLegal: "Art. 44.5 Reglamento · el requerimiento incluye lo previsto en leyes, reglamentos, normas metrológicas y normas técnicas OBLIGATORIAS. Las voluntarias solo caben si se sustentan en la estrategia y cumplen las cuatro condiciones del 44.5.", ejemplo: "NTP 350.043-1 · extintores portátiles" },
      { col: "compatibilizacion", api: "compatibilizacion", label: "Documento de compatibilización del requerimiento", baseLegal: "Art. 44.6 Reglamento · solo cabe referir marca, fabricante, patente u origen si la autoridad de la gestión administrativa aprobó la compatibilización; entonces hay que consignar el documento que la aprueba.", ejemplo: "Resolución de Gerencia Municipal N° 045-2026-GM-MDCH" },
    ],
  },
  {
    // Bases Estándar, Cap. III · 3.5.1: requisitos OBLIGATORIOS (capacidad legal
    // + experiencia del postor). El área usuaria PROPONE; la DEC los establece
    // en la Estrategia (Art. 72.1).
    title: "3.5.1 Requisitos de calificación obligatorios",
    resumenLlano: "Qué debe acreditar el proveedor para poder participar (habilitación y experiencia). Tú lo propones; la DEC lo confirma.",
    simple: false,
    nota: "Dos requisitos obligatorios, según el formato: A) capacidad legal —solo si la normativa del objeto exige habilitación para la actividad; si no la exige, se omite— y B) experiencia del postor en la especialidad. Cada uno lleva su REQUISITO y cómo se ACREDITA. Dos topes del formato: el monto facturado acumulado no puede superar TRES VECES la cuantía de la contratación o del ítem, y se cuenta en los QUINCE años anteriores a la presentación de ofertas. En consorcio, cada integrante comprometido con el objeto acredita el requisito. El área usuaria PROPONE; la DEC los establece en la estrategia (Art. 72.1).",
    fields: [
      // 3.5.1 del formato de requerimiento: los requisitos de calificación son
      // OBLIGATORIOS en los 15 procesos (todos los modelos incluyen esta sección).
      // El área usuaria PROPONE; la DEC los establece (Art. 72.1), pero la
      // propuesta debe existir en el requerimiento.
      { col: "requisitos_calificacion", api: "requisitosCalificacion", label: "Propuesta de requisitos de calificación / precalificación", kind: "requisitos", wide: true, obligatorio: true, baseLegal: "Art. 44.2.b / 72.3 Reglamento · Sección 3.5.1 (obligatoria). El área usuaria PROPONE; la DEC los establece en la Estrategia (Art. 72.1). Los 5 tipos son los del Art. 72.3.", ejemplo: "Capacidad legal; Experiencia del postor en la especialidad" },
      // CONSOLIDADO en la Propuesta de requisitos de calificación (editor): la
      // "Experiencia del postor en la especialidad" es uno de los 5 tipos del
      // Art. 72.3 que gestiona el editor. Se mantiene la columna (oculta) como
      // respaldo del dato heredado; su contenido se migra al tipo
      // `experiencia_postor` del editor al abrir la ficha.
    ],
  },
  {
    // Bases Estándar, Cap. III · 3.5.2: requisitos ADICIONALES (capacidad
    // técnica y profesional / personal clave), de corresponder.
    title: "3.5.2 Requisitos de calificación adicionales",
    simple: false,
    nota: "Facultativos: solo se incluyen si así se determina en la estrategia de contratación. El típico es la capacidad técnica y profesional —calificaciones y experiencia del personal clave, Art. 72.3.b—. Aviso del formato sobre la formación académica: como requisito de calificación solo puede exigirse el GRADO o título, no cursos ni especializaciones.",
    fields: [
      // CONSOLIDADO en la Propuesta de requisitos de calificación (editor): la
      // "Capacidad técnica y profesional (personal clave)" es el tipo
      // `capacidad_tecnica` del Art. 72.3 que gestiona el editor. Columna oculta
      // como respaldo; su contenido se migra a ese tipo al abrir la ficha.
      //
      // La sección se había quedado SIN campos visibles al consolidar el personal
      // clave, y `seccionesVisibles` descarta las secciones vacías: el 3.5.2
      // desaparecía de la ficha aunque el requerimiento modelo lo trae. Los
      // adicionales no son solo personal clave: son los facultativos que la DEC
      // decida en la estrategia.
      { col: "requisitos_adicionales", api: "requisitosAdicionales", label: "Requisitos de calificación adicionales", kind: "textarea", wide: true, baseLegal: "Art. 72.1 Reglamento · los requisitos de calificación se establecen en la estrategia de contratación; el área usuaria propone los adicionales que correspondan.", ejemplo: "Capacidad técnica y profesional: experiencia del personal clave en servicios similares." },
    ],
  },
  {
    title: "Planeamiento (PEI / POI)",
    simple: false,
    nota: "Articulación con el planeamiento institucional. Ni el PEI ni el POI aparecen en la Ley 32069 o su Reglamento —vienen del planeamiento de la entidad—, y por eso estos tres campos no citan artículo. Lo que sí exige la norma es que el requerimiento esté previsto en el CMN (Art. 20.a), y el CMN se arma a partir de estas actividades: rellenarlos es lo que permite rastrear la necesidad hasta el plan que la justifica.",
    fields: [
      { col: "pei_objetivo", api: "peiObjetivo", label: "PEI · Objetivo", baseLegal: "Objetivo estratégico institucional con el que se articula la necesidad.", ejemplo: "OE.01 Mejorar la gestión" },
      { col: "pei_accion", api: "peiAccion", label: "PEI · Acción", baseLegal: "Acción estratégica del PEI con la que se articula la necesidad.", ejemplo: "AE.01.01" },
      { col: "poi_actividad", api: "poiActividad", label: "POI · Actividad", baseLegal: "Actividad operativa del POI que financia la necesidad.", ejemplo: "Actividad 500123" },
    ],
  },
  {
    title: "Verificaciones DEC (Art. 14 Reglamento)",
    simple: false,
    nota: "La DEC participa en la elaboración y revisión del requerimiento SOLO en cuanto al cumplimiento de la normativa: los aspectos TÉCNICOS de la necesidad son responsabilidad del área usuaria (Art. 14.2.b). Estas cuatro casillas son las verificaciones del Art. 14.2 que tocan al requerimiento —c) CMN, d) ficha técnica o acuerdo marco, e) almacén y patrimonio, j) certificación presupuestal—. La del CMN se resuelve además con las acciones del flujo (aprobar / solicitar no objeción).",
    fields: [
      // El CMN es una verificación del 14.2.c, no un dato de identificación.
      { col: "version_cmn", api: "versionCmn", label: "Versión del CMN", baseLegal: "Art. 14.2.c Reglamento · La necesidad debe constar en el CMN aprobado del año fiscal o su modificatoria (Art. 54.3)", ejemplo: "CMN 2026 v2" },
      { col: "verificacion_ficha_tecnica", api: "verificacionFichaTecnica", label: "Verificación de ficha técnica, homologación o acuerdo marco", checkbox: true, baseLegal: "Art. 14.2.d Reglamento · la DEC verifica si la necesidad está definida en una ficha técnica, en una ficha de homologación O EN EL CATÁLOGO ELECTRÓNICO DE ACUERDOS MARCO. Las fichas aprobadas son de uso obligatorio con independencia del monto (Art. 260); el acuerdo marco es otra vía de contratación." },
      { col: "verificacion_almacen", api: "verificacionAlmacen", label: "Verificación de almacén / patrimonio", checkbox: true, baseLegal: "Art. 14.2.e Reglamento · DEC verifica si la necesidad puede cubrirse con existencias disponibles o bienes patrimoniales sin asignar" },
      { col: "certificacion_presupuestal", api: "certificacionPresupuestal", label: "Certificación / previsión presupuestal", baseLegal: "Art. 14.2.j Reglamento · DEC solicita a la oficina de presupuesto la certificación o previsión presupuestal" },
    ],
  },
  {
    title: "Resumen",
    simple: true,
    fields: [{ col: "summary", api: "summary", label: "Resumen / descripción", baseLegal: "Resumen interno de la necesidad; viaja al expediente como `summary`.", kind: "textarea", wide: true, ejemplo: "Resumen ejecutivo de la contratación" }],
  },
];

// El botón "Redactar con IA" solo aporta en campos de prosa (finalidad,
// alcance, condiciones…). En Identificación y Programación y presupuesto los
// campos son datos factuales (entidad, meta, monto, fechas), así que se omite.
const CAMPOS_SIN_REDACCION_IA: ReadonlySet<string> = new Set([
  ...FICHA_SECCIONES.filter(
    (s) => s.title === "Identificación" || s.title === "Programación y presupuesto",
  ).flatMap((s) => s.fields.map((f) => f.api)),
  // Estos cuatro son de prosa pero NO se redactan: su contenido tiene una
  // fuente externa que la IA no puede sustituir sin inventarse el dato.
  //
  //  * catálogo (código y descripción): salen del CUBSO/SIGA. Redactarlos sería
  //    describir un bien con palabras que no están en el catálogo, y el Art.
  //    44.6 prohíbe orientar la contratación hacia una marca o fabricante.
  //  * EETT/TDR: las escribe el área usuaria, o llegan del PDF por el traslado
  //    con visto bueno. Ese es el circuito, y tiene control de calidad.
  //  * Lugar de entrega: es un domicilio, no un texto.
  "codigoCatalogo",
  "descripcionCatalogo",
  "descripcionDetallada",
  "lugarEntrega",
]);

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

// Clases compartidas de los controles del formulario de la ficha (misma identidad
// que los primitivos de UI). `FICHA_CTRL_ERR` se añade cuando el campo tiene error.
const FICHA_CTRL =
  "w-full rounded-[10px] border border-line bg-panel px-3 text-sm text-ink outline-none " +
  "transition-[border-color,box-shadow] duration-150 placeholder:text-muted/55 " +
  "focus:border-brand focus:shadow-[var(--shadow-focus)] disabled:bg-surface disabled:opacity-70";
const FICHA_CTRL_H = "h-10";
// El alto lo fija `rows` con filasTextarea, que cuenta cuanto envuelve cada
// linea. Se probo `field-sizing:content` —que en teoria ajusta al contenido sin
// estimar— y MEDIDO en Chrome daba 40px y cortaba el texto, mientras que las
// filas calculadas daban 349px sin cortar. Descartado por eso, no por gusto.
const FICHA_CTRL_AREA = "min-h-[80px] resize-y py-2.5 leading-relaxed";
const FICHA_CTRL_ERR = "!border-danger focus:!border-danger focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--danger)_20%,transparent)]";
const FICHA_LABEL = "mb-1.5 flex flex-wrap items-center gap-1.5 text-[12.5px] font-semibold text-ink";
const FICHA_REQ = "rounded-full bg-brand-soft px-1.5 py-px text-[10px] font-bold uppercase tracking-wide text-brand";
const FICHA_OPT = "rounded-full bg-ink/[0.06] px-1.5 py-px text-[10px] font-bold uppercase tracking-wide text-muted";
const FICHA_IA = "inline-flex items-center gap-0.5 rounded-full bg-accent/10 px-1.5 py-px text-[10px] font-bold text-accent";

/** Nivel de un riesgo → tono de la insignia. Antes vivía en `.riesgo-*` sueltas. */
function tonoRiesgo(nivel: string): "exito" | "atencion" | "peligro" | "neutral" {
  const v = nivel.toLowerCase();
  if (v.startsWith("baj")) return "exito";
  if (v.startsWith("med")) return "atencion";
  if (v.startsWith("alt")) return "peligro";
  return "neutral";
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
  const [kind, setKind] = useState("requerimiento");
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Workflow: acción pendiente de confirmar (cuando requiere sustento).
  const [pendingAction, setPendingAction] = useState<AccionDef | null>(null);
  const [sustento, setSustento] = useState("");
  const [mecanismo, setMecanismo] = useState("");
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
  const [runningAction, setRunningAction] = useState(false);

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

  // Matriz de riesgos: formulario de alta y borrado por fila.
  const [riesgoTexto, setRiesgoTexto] = useState("");
  const [riesgoProb, setRiesgoProb] = useState("");
  const [riesgoImpacto, setRiesgoImpacto] = useState("");
  const [riesgoMitigacion, setRiesgoMitigacion] = useState("");
  const [riesgoResponsable, setRiesgoResponsable] = useState("");
  const [savingRiesgo, setSavingRiesgo] = useState(false);
  const [deletingRiesgoId, setDeletingRiesgoId] = useState<string | null>(null);
  const [confirmDeleteDocId, setConfirmDeleteDocId] = useState<string | null>(null);
  const [confirmDeleteRiesgoId, setConfirmDeleteRiesgoId] = useState<string | null>(null);
  const [confirmDeleteNecesidad, setConfirmDeleteNecesidad] = useState(false);
  const [deletingNecesidad, setDeletingNecesidad] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadingFile, setUploadingFile] = useState(false);
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
  const [riesgoEditId, setRiesgoEditId] = useState<string | null>(null);
  const [riesgoEditTexto, setRiesgoEditTexto] = useState("");
  const [riesgoEditProb, setRiesgoEditProb] = useState("");
  const [riesgoEditImpacto, setRiesgoEditImpacto] = useState("");
  const [riesgoEditMitigacion, setRiesgoEditMitigacion] = useState("");
  const [riesgoEditResponsable, setRiesgoEditResponsable] = useState("");

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
  const [avisoAdmisibilidad, setAvisoAdmisibilidad] = useState<{ accion: AccionDef; faltan: number; total: number } | null>(null);
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

  async function addRiesgo(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (riesgoTexto.trim().length < 3) {
      setError("Describe el riesgo con más detalle.");
      return;
    }
    if (riesgos.some((r) => r.riesgo.toLowerCase() === riesgoTexto.trim().toLowerCase())) {
      setError("Ya existe un riesgo con ese nombre.");
      return;
    }
    setSavingRiesgo(true);
    setError("");
    try {
      const response = await fetch(`/api/necesidades/${necesidadId}/riesgos`, {
        body: JSON.stringify({
          riesgo: riesgoTexto,
          probabilidad: riesgoProb || undefined,
          impacto: riesgoImpacto || undefined,
          mitigacion: riesgoMitigacion || undefined,
          responsable: riesgoResponsable || undefined,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "No se pudo registrar el riesgo.");
        return;
      }
      setRiesgoTexto("");
      setRiesgoProb("");
      setRiesgoImpacto("");
      setRiesgoMitigacion("");
      setRiesgoResponsable("");
      await reload();
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setSavingRiesgo(false);
    }
  }

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

  async function runAction(accion: AccionDef, conSustento: string, conMecanismo: string) {
    setRunningAction(true);
    setError("");
    try {
      const response = await fetch(`/api/necesidades/${necesidadId}/transicion`, {
        body: JSON.stringify({ action: accion.action, sustento: conSustento, mecanismo: conMecanismo }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "No se pudo ejecutar la acción.");
        return;
      }
      setPendingAction(null);
      setSustento("");
      setMecanismo("");
      setHistRecarga((n) => n + 1); // pone al día la línea de tiempo
      await reload();
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setRunningAction(false);
    }
  }

  // Lanza la acción por su vía normal (con o sin sustento).
  function ejecutarAccion(accion: AccionDef) {
    if (accion.requiereSustento) {
      setPendingAction(accion);
      setSustento("");
      setMecanismo("");
    } else {
      void runAction(accion, "", "");
    }
  }

  async function onClickAccion(accion: AccionDef) {
    // Aviso suave antes del conforme: si quedan puntos de admisibilidad sin
    // marcar, se pregunta. El conforme NO los exige, pero conviene ser
    // consciente. Si el checklist está completo (o el fetch falla), no estorba.
    if (accion.action === "aprobar_conforme") {
      try {
        const r = await fetch(`/api/necesidades/${necesidadId}/admisibilidad`, { cache: "no-store" });
        if (r.ok) {
          const d = await r.json();
          const { done, total } = contarAdmisibilidad(d?.items ?? {});
          if (total - done > 0) {
            setAvisoAdmisibilidad({ accion, faltan: total - done, total });
            return;
          }
        }
      } catch { /* sin checklist accesible: no se estorba el conforme */ }
    }
    ejecutarAccion(accion);
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

  async function uploadDocumento(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError("Selecciona un PDF.");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setError("El archivo no puede superar los 20 MB.");
      return;
    }
    setUploading(true);
    setUploadingFile(true);
    setUploadProgress(0);
    const interval = setInterval(() => {
      setUploadProgress((prev) => Math.min(prev + 15, 85));
    }, 300);
    try {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("kind", kind);
      const response = await fetch(`/api/necesidades/${necesidadId}/documentos`, { body: formData, method: "POST" });
      clearInterval(interval);
      setUploadProgress(100);
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "No se pudo subir el documento.");
        return;
      }
      if (fileRef.current) {
        fileRef.current.value = "";
      }
      setError("");
      await reload();
    } catch {
      clearInterval(interval);
      setError("No se pudo conectar con el servidor.");
    } finally {
      setUploading(false);
      setUploadingFile(false);
      setUploadProgress(0);
    }
  }

  async function deleteDocumento(documentoId: string) {
    setDeletingId(documentoId);
    try {
      const response = await fetch(`/api/necesidades/${necesidadId}/documentos?documentoId=${documentoId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        setError(payload.error ?? "No se pudo eliminar el documento.");
        return;
      }
      await reload();
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setDeletingId(null);
      setConfirmDeleteDocId(null);
    }
  }

  async function deleteRiesgoWithConfirm(riesgoId: string) {
    setDeletingRiesgoId(riesgoId);
    try {
      const response = await fetch(`/api/necesidades/${necesidadId}/riesgos?riesgoId=${riesgoId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        setError(payload.error ?? "No se pudo eliminar el riesgo.");
        return;
      }
      await reload();
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setDeletingRiesgoId(null);
      setConfirmDeleteRiesgoId(null);
      setRiesgoEditId((prev) => prev === riesgoId ? null : prev);
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
  const obsPendientesPorCampo = new Map<string, ObservacionNecesidad[]>();
  for (const o of observaciones) {
    if (o.resuelto) continue;
    obsPendientesPorCampo.set(o.campo, [...(obsPendientesPorCampo.get(o.campo) ?? []), o]);
  }
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
        {[
          // El mismo orden en que aparecen al bajar: un indice que no coincide con la
          // pagina desorienta mas de lo que ayuda.
          { id: "sec-flujo", label: "Flujo y estado" },
          { id: "sec-eett", label: "EETT / TDR" },
          { id: "sec-ficha", label: "Ficha del requerimiento" },
          { id: "sec-adjuntos", label: "Adjuntos" },
          ...(riesgosAplica ? [{ id: "sec-riesgos", label: "Riesgos" }] : []),
          { id: "sec-derivacion", label: "Derivación" },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            className="rounded-full border border-line bg-panel px-3 py-1 text-[12.5px] font-medium text-muted transition hover:border-brand/40 hover:bg-brand-soft hover:text-brand"
            onClick={() => document.getElementById(t.id)?.scrollIntoView({ behavior: "smooth", block: "start" })}
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

        {/* Remitir a la DEC es una AFIRMACIÓN: dice que el requerimiento está
            formulado. Por eso es lo único que se condiciona — escribir y guardar
            a medias sigue siendo trabajo legítimo. */}
        {permisos.manage && acciones.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {acciones.map((accion) => {
              const frenado = accion.action === "remitir" && !verificacion.lista;
              return (
                <Button
                  variant={accion.variante === "primary" ? "primary" : "secondary"}
                  destructive={accion.variante === "danger"}
                  disabled={runningAction || frenado}
                  key={accion.action}
                  onClick={() => onClickAccion(accion)}
                  title={
                    frenado
                      ? `Antes de remitir hay ${verificacion.bloquean === 1 ? "una cosa" : `${verificacion.bloquean} cosas`} que resolver. Míralas en «¿Está lista para el expediente?».`
                      : accion.ayuda
                  }
                  type="button"
                >
                  {runningAction ? <Loader size={14} /> : <ArrowRightCircle size={14} />}
                  {accion.label}
                </Button>
              );
            })}
          </div>
        ) : permisos.manage ? (
          <p className="text-xs font-semibold text-muted">
            No hay acciones disponibles para tu rol en este estado (
            {estado?.actor === "dec" ? "corresponde a la DEC" : "corresponde al área usuaria"}).
          </p>
        ) : null}

        {pendingAction ? (
          <div className="grid gap-2 rounded-[10px] border border-dashed border-brand/30 bg-surface p-3 [&_label]:grid [&_label]:gap-1 [&_label]:text-[12.5px] [&_label]:text-muted [&_input]:rounded-lg [&_input]:border [&_input]:border-line [&_input]:bg-panel [&_input]:px-[9px] [&_input]:py-[7px] [&_input]:text-[13px] [&_textarea]:rounded-lg [&_textarea]:border [&_textarea]:border-line [&_textarea]:bg-panel [&_textarea]:px-[9px] [&_textarea]:py-[7px] [&_textarea]:text-[13px]">
            <label>
              <span>Sustento de “{pendingAction.label}”</span>
              <textarea onChange={(e) => setSustento(e.target.value)} rows={3} value={sustento} />
            </label>
            <label>
              <span>Mecanismo (memorando / correo / proveído)</span>
              <input onChange={(e) => setMecanismo(e.target.value)} placeholder="Memorando N°…" value={mecanismo} />
            </label>
            <div className="flex gap-2">
              <Button
                variant="primary"
                disabled={runningAction || sustento.trim().length < 3}
                onClick={() => void runAction(pendingAction, sustento, mecanismo)}
                type="button"
              >
                {runningAction ? <Loader size={14} /> : <CheckCircle2 size={14} />}
                Confirmar
              </Button>
              <Button onClick={() => setPendingAction(null)} type="button">
                Cancelar
              </Button>
            </div>
          </div>
        ) : null}

        {/* Aviso suave de admisibilidad al dar conforme (no bloquea). Por eso es
            `role="alert"` y no `alertdialog`: informa sin atrapar el foco ni
            exigir respuesta, y el conforme sigue disponible. */}
        {avisoAdmisibilidad ? (
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2.5 text-[12.5px] leading-[1.45] text-ink" role="alert">
            <p className="m-0 flex items-start gap-2 text-[13px] leading-[1.45] text-ink [&_svg]:mt-0.5 [&_svg]:flex-none [&_svg]:text-warning">
              <ClipboardCheck size={15} aria-hidden />
              <span>
                Quedan <strong>{avisoAdmisibilidad.faltan} de {avisoAdmisibilidad.total}</strong> puntos de
                admisibilidad sin marcar. El conforme no los exige, pero conviene revisarlos antes de aprobar.
              </span>
            </p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              <Button
                onClick={() => {
                  setAvisoAdmisibilidad(null);
                  document.querySelector(".admisPanel")?.scrollIntoView({ behavior: "smooth", block: "center" });
                }}
                type="button"
              >
                Revisar checklist
              </Button>
              <Button
                variant="primary"
                disabled={runningAction}
                onClick={() => { const a = avisoAdmisibilidad.accion; setAvisoAdmisibilidad(null); ejecutarAccion(a); }}
                type="button"
              >
                {runningAction ? <Loader size={14} /> : <CheckCircle2 size={14} />}
                Dar conforme igual
              </Button>
            </div>
          </div>
        ) : null}

      </Panel>

      {/* ===== EETT / TDR (1.ª versión del área usuaria) ===== */}
      {permisos.manage ? (
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
            {!fichaEdit ? (
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

          {fichaEdit ? (() => {
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
              const val = fichaForm[field.api] ?? "";
              const hasError = Boolean(fieldErrors[field.api]);
              // Geografía por catálogo de la entidad (si está configurada).
              const geoKey = CAMPO_GEO_ENTIDAD[field.api];
              const geoValorEntidad = geoKey ? (configuredEntity?.[geoKey] ?? "").trim() : "";
              const limpiarError = () => {
                if (fieldErrors[field.api]) setFieldErrors((prev) => { const n = { ...prev }; delete n[field.api]; return n; });
              };
              /** Al escribir: se anota el campo como tocado y se retira su error. */
              const alEscribir = () => {
                if (!camposTocados.has(field.api)) setCamposTocados((prev) => new Set(prev).add(field.api));
                limpiarError();
              };
              /**
               * Validacion al salir del campo. Antes solo se validaba al pulsar
               * Guardar: se rellenaban nueve secciones y el fallo aparecia al final,
               * lejos de donde se cometio. Solo actua sobre campos ya tocados (o que
               * ya estaban en error), para no senalar lo que nadie ha tocado todavia.
               */
              const validarAlSalir = () => {
                if (!campoEsObligatorio(field)) return;
                if (!camposTocados.has(field.api) && !fieldErrors[field.api]) return;
                const vacio = !String(fichaForm[field.api] ?? "").trim();
                setFieldErrors((prev) => {
                  // Mismo objeto si nada cambia: evita un render y no despierta al
                  // efecto que lleva el foco, que escucha a `fieldErrors`.
                  if (vacio === Boolean(prev[field.api])) return prev;
                  const n = { ...prev };
                  if (vacio) n[field.api] = "Campo obligatorio";
                  else delete n[field.api];
                  return n;
                });
              };
              // Marcas de accesibilidad del control. Sin ellas el error solo existe
              // en rojo: `aria-invalid` hace que el lector de pantalla anuncie el
              // campo como invalido, y `aria-describedby` le engancha el texto del
              // motivo, que hasta ahora era un <span> suelto sin relacion con el
              // control. Se declaran una vez y se reparten a los seis controles
              // para que no puedan divergir.
              const errorId = `err-${field.api}`;
              const marcasError = {
                "aria-describedby": hasError ? errorId : undefined,
                "aria-invalid": hasError || undefined,
              } as const;
              // Botón ✨ "Redactar con IA" reutilizable (solo para editores). No
              // se ofrece en Identificación ni en Programación y presupuesto: sus
              // campos son datos factuales, no prosa que redactar.
              const botonRedactarIA = permisos.manage && !CAMPOS_SIN_REDACCION_IA.has(field.api) ? (
                <button
                  className="mb-1.5 inline-flex w-fit items-center gap-1 rounded-md bg-accent/10 px-2 py-1 text-[11px] font-semibold text-accent transition hover:bg-accent/20"
                  onClick={(e) => { e.preventDefault(); pedirRedactarIA(field.api); }}
                  title="Redactar este campo con el copiloto IA (Ley 32069)"
                  type="button"
                >
                  <Sparkles size={12} /> Redactar con IA
                </button>
              ) : null;
              // Base legal del campo. El disparador y el globo los pone Radix: teclado,
              // Escape, reposicionamiento y ARIA salen de serie.
              const tooltipNode = !modoSimple && field.baseLegal ? (
                <InfoPopover etiqueta={`Base legal de ${field.label}`}>
                  {field.baseLegal}
                  {field.ejemplo ? `
Ej: ${field.ejemplo}` : ""}
                </InfoPopover>
              ) : null;

              if (field.checkbox) {
                return (
                  // data-campo: la verificación («¿Está lista?») salta hasta aquí.
                  <label
                    className={cn(
                      "flex items-center gap-2.5 rounded-[10px] border border-line bg-surface px-3 py-2.5",
                      field.wide && "col-span-full",
                    )}
                    data-campo={field.api}
                    key={field.api}
                  >
                    <input
                      checked={val === "true"}
                      onChange={(e) => { setFichaField(field.api, e.target.checked ? "true" : "false"); }}
                      type="checkbox"
                      className="size-4 shrink-0 accent-brand"
                    />
                    <span className="text-[13px] font-semibold text-ink">{field.label}</span>
                    {tooltipNode}
                  </label>
                );
              }

              // El EETT/TDR es un ADJUNTO, no un texto: se redacta fuera, en
              // Word o PDF, con sus tablas y su formato. Transcribirlo a un
              // textarea perdía la maqueta y creaba una segunda versión que no
              // coincidía con la que se firma. Los documentos son los del módulo
              // EETT/TDR; esto es su puerta de entrada desde el campo.
              if (field.api === "descripcionDetallada") {
                return (
                  <div className="col-span-full" data-campo={field.api} key={field.api}>
                    <span className={FICHA_LABEL}>
                      {field.label}
                      {campoEsObligatorio(field) ? (
                        <span className={FICHA_REQ}>obligatorio</span>
                      ) : (
                        <span className={FICHA_OPT}>{field.recomendado ? etiquetaRecomendado(field) : "opcional"}</span>
                      )}
                    </span>
                    <NecesidadEettCampo
                      docs={eettDocs.map((d) => ({
                        file_name: d.file_name,
                        id: d.id,
                        status: d.status,
                        title: d.title,
                      }))}
                      necesidadId={necesidadId}
                      onAbrir={(docId) => {
                        const doc = eettDocs.find((d) => d.id === docId);
                        if (doc) abrirEett(doc);
                      }}
                      onSubir={(archivo, tipo) => void subirEett(archivo, tipo)}
                      readOnly={!fichaEdit || !permisos.manage}
                      subiendo={eettUploading}
                    />
                    {!modoSimple && field.baseLegal ? <small className="mt-1 block text-[11.5px] text-muted">{field.baseLegal}</small> : null}
                  </div>
                );
              }

              // Editor estructurado (varios inputs): fuera de <label>.
              if (field.kind === "requisitos") {
                return (
                  <div className={field.wide ? "col-span-full" : undefined} data-campo={field.api} key={field.api}>
                    <span className={FICHA_LABEL}>
                      {field.label}
                      {campoEsObligatorio(field) ? (
                        <span className={FICHA_REQ}>obligatorio</span>
                      ) : (
                        <span className={FICHA_OPT}>{field.recomendado ? etiquetaRecomendado(field) : "opcional"}</span>
                      )}
                      {camposDeIA.has(field.api) ? (
                        <span
                          className={FICHA_IA}
                          title={`Propuesto por la IA desde el EETT/TDR y aprobado en el traslado el ${new Date(camposDeIA.get(field.api)!).toLocaleString("es-PE")}. Revísalo antes de firmar.`}
                        >
                          ✦ propuesto por IA
                        </span>
                      ) : null}
                    </span>
                    <RequisitosCalificacionEditor
                      // Sin la cuantía no se puede comprobar el tope de 3x del modelo, y sin el
                      // procedimiento no se sabe si cabe la capacidad económica (Art. 72.3.e).
                      montoEstimado={Number(fichaForm.montoEstimado) || null}
                      tipoProceso={fichaForm.tipoProcesoSeleccion ?? necesidad?.tipo_proceso_seleccion ?? null}
                      objeto={fichaForm.tipoObjeto}
                      onChange={(next) => setFichaField(field.api, next)}
                      value={val}
                    />
                    {!modoSimple && field.baseLegal ? <small className="mt-1 block text-[11.5px] text-muted">{field.baseLegal}</small> : null}
                  </div>
                );
              }

              // Cuadro de instituciones arbitrales: varios inputs, fuera de <label>.
              if (field.kind === "controversias") {
                return (
                  <div className={field.wide ? "col-span-full" : undefined} data-campo={field.api} key={field.api}>
                    <span className={FICHA_LABEL}>
                      {field.label}
                      {campoEsObligatorio(field) ? (
                        <span className={FICHA_REQ}>obligatorio</span>
                      ) : (
                        <span className={FICHA_OPT}>{field.recomendado ? etiquetaRecomendado(field) : "opcional"}</span>
                      )}
                      {camposDeIA.has(field.api) ? (
                        <span
                          className={FICHA_IA}
                          title={`Propuesto por la IA desde el EETT/TDR y aprobado en el traslado el ${new Date(camposDeIA.get(field.api)!).toLocaleString("es-PE")}. Revísalo antes de firmar.`}
                        >
                          ✦ propuesto por IA
                        </span>
                      ) : null}
                    </span>
                    {/* La IA no reescribe el apartado: aporta las condiciones adicionales
                        (sede, plazos…). El párrafo y el cuadro los compone el editor. */}
                    {botonRedactarIA}
                    <InstitucionesArbitralesEditor
                      onChange={(next) => setFichaField(field.api, next)}
                      value={val}
                    />
                    {!modoSimple && field.baseLegal ? <small className="mt-1 block text-[11.5px] text-muted">{field.baseLegal}</small> : null}
                  </div>
                );
              }

              // Cuadro de otras penalidades: varios inputs, fuera de <label>.
              if (field.kind === "penalidades") {
                return (
                  <div className={field.wide ? "col-span-full" : undefined} data-campo={field.api} key={field.api}>
                    <span className={FICHA_LABEL}>
                      {field.label}
                      {campoEsObligatorio(field) ? (
                        <span className={FICHA_REQ}>obligatorio</span>
                      ) : (
                        <span className={FICHA_OPT}>{field.recomendado ? etiquetaRecomendado(field) : "opcional"}</span>
                      )}
                      {camposDeIA.has(field.api) ? (
                        <span
                          className={FICHA_IA}
                          title={`Propuesto por la IA desde el EETT/TDR y aprobado en el traslado el ${new Date(camposDeIA.get(field.api)!).toLocaleString("es-PE")}. Revísalo antes de firmar.`}
                        >
                          ✦ propuesto por IA
                        </span>
                      ) : null}
                    </span>
                    {/* La IA no reescribe el apartado: aporta las condiciones adicionales
                        (sede, plazos…). El párrafo y el cuadro los compone el editor. */}
                    {botonRedactarIA}
                    <OtrasPenalidadesEditor
                      onChange={(next) => setFichaField(field.api, next)}
                      value={val}
                    />
                    {!modoSimple && field.baseLegal ? <small className="mt-1 block text-[11.5px] text-muted">{field.baseLegal}</small> : null}
                  </div>
                );
              }

              // Cuadro de subcontratación: varios inputs, fuera de <label>.
              if (field.kind === "subcontratacion") {
                return (
                  <div className={field.wide ? "col-span-full" : undefined} data-campo={field.api} key={field.api}>
                    <span className={FICHA_LABEL}>
                      {field.label}
                      {campoEsObligatorio(field) ? (
                        <span className={FICHA_REQ}>obligatorio</span>
                      ) : (
                        <span className={FICHA_OPT}>{field.recomendado ? etiquetaRecomendado(field) : "opcional"}</span>
                      )}
                      {camposDeIA.has(field.api) ? (
                        <span
                          className={FICHA_IA}
                          title={`Propuesto por la IA desde el EETT/TDR y aprobado en el traslado el ${new Date(camposDeIA.get(field.api)!).toLocaleString("es-PE")}. Revísalo antes de firmar.`}
                        >
                          ✦ propuesto por IA
                        </span>
                      ) : null}
                    </span>
                    {/* La IA no reescribe el apartado: aporta las condiciones adicionales
                        (sede, plazos…). El párrafo y el cuadro los compone el editor. */}
                    {botonRedactarIA}
                    <SubcontratacionEditor
                      onChange={(next) => setFichaField(field.api, next)}
                      value={val}
                    />
                    {!modoSimple && field.baseLegal ? <small className="mt-1 block text-[11.5px] text-muted">{field.baseLegal}</small> : null}
                  </div>
                );
              }

              return (
                <label className={cn("flex min-w-0 flex-col", field.wide && "col-span-full")} data-campo={field.api} key={field.api}>
                  <span className={FICHA_LABEL}>
                    {field.label}
                    {campoEsObligatorio(field) ? (
                      <span className={FICHA_REQ}>obligatorio</span>
                    ) : (
                      <span className={FICHA_OPT}>{field.recomendado ? etiquetaRecomendado(field) : "opcional"}</span>
                    )}
                    {camposDeIA.has(field.api) ? (
                      <span
                        className={FICHA_IA}
                        title={`Propuesto por la IA desde el EETT/TDR y aprobado en el traslado el ${new Date(camposDeIA.get(field.api)!).toLocaleString("es-PE")}. Revísalo antes de firmar.`}
                      >
                        ✦ propuesto por IA
                      </span>
                    ) : null}
                    {exigidosModelo.has(field.api) ? (
                      <span className="text-[11px] font-medium text-brand" title="El requerimiento de este proceso de selección exige este campo">
                        · exige el proceso
                      </span>
                    ) : null}
                    {obsPendientesPorCampo.has(field.api) ? (
                      <span
                        className="inline-flex items-center gap-0.5 rounded-full bg-warning-soft px-1.5 py-px text-[10px] font-bold text-warning"
                        title={obsPendientesPorCampo
                          .get(field.api)!
                          .map((o) => `Observación (${o.autor_referencia ?? "—"}): ${o.comentario}`)
                          .join("\n")}
                      >
                        <MessageSquare size={11} aria-hidden /> {obsPendientesPorCampo.get(field.api)!.length}
                      </span>
                    ) : null}
                    {tooltipNode}
                  </span>
                  {geoKey && geoValorEntidad ? (
                    // Desplegable con la ubicación de la entidad. Preserva un
                    // valor previo distinto para no borrarlo en silencio.
                    <select
                      className={cn(FICHA_CTRL, FICHA_CTRL_H, hasError && FICHA_CTRL_ERR)}
                      {...marcasError}
                      onBlur={validarAlSalir}
                      onChange={(e) => { setFichaField(field.api, e.target.value); alEscribir(); }}
                      value={val || field.porDefecto || ""}
                    >
                      {field.porDefecto ? null : <option value="">— Sin definir —</option>}
                      {val && val !== geoValorEntidad ? <option value={val}>{val} — valor actual</option> : null}
                      <option value={geoValorEntidad}>{geoValorEntidad}</option>
                    </select>
                  ) : field.api === "areaUsuaria" ? (
                    // Texto con autocompletado de las áreas ya registradas: sugiere
                    // la grafía existente sin cerrar la lista a un catálogo rígido.
                    <>
                      <input
                        className={cn(FICHA_CTRL, FICHA_CTRL_H, hasError && FICHA_CTRL_ERR)}
                        {...marcasError}
                        list="areas-usuarias-sugeridas"
                        maxLength={LIMITES_TEXTO[field.api]}
                        onBlur={validarAlSalir}
                        onChange={(e) => { setFichaField(field.api, e.target.value); alEscribir(); }}
                        type="text"
                        value={val}
                      />
                      {areasSugeridas.length > 0 ? (
                        <datalist id="areas-usuarias-sugeridas">
                          {areasSugeridas.map((a) => <option key={a} value={a} />)}
                        </datalist>
                      ) : null}
                    </>
                  ) : field.kind === "textarea" ? (
                    <>
                      {botonRedactarIA}
                      <textarea
                        className={cn(FICHA_CTRL, FICHA_CTRL_AREA, hasError && FICHA_CTRL_ERR)}
                        {...marcasError}
                        maxLength={LIMITES_TEXTO[field.api]}
                        onBlur={validarAlSalir}
                        onChange={(e) => { setFichaField(field.api, e.target.value); alEscribir(); }}
                        // La fórmula se ve al redactar, no escondida en el globo
                        // de ayuda: es la estructura que el texto debe seguir.
                        placeholder={field.plantilla}
                        rows={filasTextarea(val, field.wide)}
                        value={val}
                      />
                      <span className={cn("mt-1 text-[11px]", val.length > 1800 ? "font-semibold text-warning" : "text-muted")}>
                        {val.length} caracteres
                      </span>
                    </>
                  ) : field.kind === "select" ? (
                    <select
                      className={cn(FICHA_CTRL, FICHA_CTRL_H, hasError && FICHA_CTRL_ERR)}
                      {...marcasError}
                      onBlur={validarAlSalir}
                      onChange={(e) => { setFichaField(field.api, e.target.value); alEscribir(); }}
                      value={val}
                    >
                      <option value="">— Sin definir —</option>
                      {/* Un valor guardado antes de que el campo fuera una lista
                          cerrada no está entre las opciones. Se añade como
                          primera opción para NO perderlo al guardar. */}
                      {val && !(field.opciones ?? []).some((o) => o.value === val) ? (
                        <option value={val}>{val} — valor actual</option>
                      ) : null}
                      {(field.opciones ?? []).map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  ) : field.kind === "number" || field.kind === "date" ? (
                    <input
                      className={cn(FICHA_CTRL, FICHA_CTRL_H, hasError && FICHA_CTRL_ERR)}
                      {...marcasError}
                      onBlur={validarAlSalir}
                      onChange={(e) => { setFichaField(field.api, e.target.value); alEscribir(); }}
                      type={field.kind === "number" ? "number" : "date"}
                      value={val}
                    />
                  ) : (
                    <>
                      {botonRedactarIA}
                      <input
                        className={cn(FICHA_CTRL, FICHA_CTRL_H, hasError && FICHA_CTRL_ERR)}
                        {...marcasError}
                        maxLength={LIMITES_TEXTO[field.api]}
                        onBlur={validarAlSalir}
                        onChange={(e) => { setFichaField(field.api, e.target.value); alEscribir(); }}
                        type="text"
                        value={val}
                      />
                    </>
                  )}
                  {hasError ? <span className="mt-1 text-[12px] font-medium text-danger" id={errorId}>{fieldErrors[field.api]}</span> : null}
                </label>
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

          <section id="sec-adjuntos" className="grid grid-cols-[minmax(0,1fr)] content-start gap-3 rounded-[14px] border border-line bg-panel p-3.5 shadow-card">
            <div className="flex flex-wrap items-center gap-2 text-ink">
              <FileText size={17} />
              <h3 className="panelTitle">Adjuntos</h3>
            </div>

            {puedeAdjuntar ? (
              <form className="flex flex-wrap items-center gap-2 rounded-[10px] border border-dashed border-line p-2.5 [&_input]:rounded-lg [&_input]:border [&_input]:border-line [&_input]:bg-panel [&_input]:px-[9px] [&_input]:py-[7px] [&_input]:text-[13px] [&_select]:rounded-lg [&_select]:border [&_select]:border-line [&_select]:bg-panel [&_select]:px-[9px] [&_select]:py-[7px] [&_select]:text-[13px]" onSubmit={uploadDocumento}>
                <select onChange={(event) => setKind(event.target.value)} value={kind}>
                  {NECESIDAD_DOC_KINDS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
                <input accept="application/pdf,.pdf" ref={fileRef} type="file" />
                <Button variant="primary" disabled={uploading} type="submit">
                  {uploading ? <Loader size={15} /> : <UploadCloud size={15} />}
                  {uploading ? "Subiendo..." : "Adjuntar PDF"}
                </Button>
                {uploadingFile ? (
                  <div className="h-1 w-full overflow-hidden rounded-full bg-line">
                    <div className="h-full bg-brand transition-[width] duration-200" style={{ width: `${uploadProgress}%` }} />
                  </div>
                ) : null}
              </form>
            ) : null}

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

            {documentos.length === 0 ? (
              <p className="text-xs font-semibold text-muted">
                {puedeAdjuntar
                  ? "Sin adjuntos. Carga el requerimiento, TDR, ET, cotizaciones u otros sustentos."
                  : "Sin adjuntos."}
              </p>
            ) : (
              <ul className="m-0 grid list-none gap-2 p-0">
                {documentos.map((doc) => (
                  <li className="flex items-start gap-2.5 rounded-[14px] border border-line bg-panel px-3 py-2.5 shadow-card [&>svg]:mt-0.5 [&>svg]:text-brand" key={doc.id}>
                    <FileText size={16} />
                    <div className="grid flex-1 gap-0.5 [&_strong]:text-[13.5px] [&_strong]:text-ink [&_small]:text-[11.5px] [&_small]:text-muted">
                      <strong>{doc.title}</strong>
                      <small>{necesidadDocKindLabel(doc.kind)}</small>
                    </div>
                    {puedeAdjuntar ? (
                      <button
                        aria-label="Eliminar adjunto"
                        
                        disabled={deletingId === doc.id}
                        onClick={() => setConfirmDeleteDocId(doc.id)}
                        type="button"
                      >
                        {deletingId === doc.id ? <Loader size={15} /> : <Trash2 size={15} />}
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>

      {/* ===== Matriz de riesgos de la contratación ===== */}
      {riesgosAplica ? (
      <section id="sec-riesgos" className="grid grid-cols-[minmax(0,1fr)] content-start gap-3 rounded-[14px] border border-line bg-panel p-3.5 shadow-card">
        <div className="flex flex-wrap items-center gap-2 text-ink">
          <ShieldAlert size={17} />
          <h3 className="panelTitle">Matriz de riesgos</h3>
          <span className="text-xs font-semibold text-muted">{riesgos.length} registrado{riesgos.length === 1 ? "" : "s"}</span>
        </div>

        {riesgos.length === 0 ? (
          <p className="text-xs font-semibold text-muted">
            Sin riesgos registrados. {puedeAdjuntar ? "Identifica riesgos de la contratación y su mitigación." : ""}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[12.5px] [&_th]:whitespace-nowrap [&_th]:border-b [&_th]:border-line [&_th]:px-2.5 [&_th]:py-1.5 [&_th]:text-left [&_th]:font-semibold [&_th]:text-muted [&_td]:border-b [&_td]:border-line [&_td]:px-2.5 [&_td]:py-2 [&_td]:align-top [&_td]:text-ink [&_tr:last-child_td]:border-b-0">
              <thead>
                <tr>
                  <th>Riesgo</th>
                  <th>Prob.</th>
                  <th>Impacto</th>
                  <th>Mitigación</th>
                  <th>Responsable</th>
                  {puedeAdjuntar ? <th aria-label="Acciones" /> : null}
                </tr>
              </thead>
              <tbody>
                {riesgos.map((r) => {
                  const editing = riesgoEditId === r.id;
                  const isDuplicate = riesgoTexto.trim().length >= 3 && !editing &&
                    riesgos.some((other) => other.id !== r.id && other.riesgo.toLowerCase() === r.riesgo.toLowerCase());
                  return (
                    <tr key={r.id} className={isDuplicate ? "riesgoDuplicate" : undefined}>
                      {editing ? (
                        <>
                          <td>
                            <input className={cn(FICHA_CTRL, FICHA_CTRL_H)} value={riesgoEditTexto} onChange={(e) => setRiesgoEditTexto(e.target.value)} />
                          </td>
                          <td>
                            <select className={cn(FICHA_CTRL, FICHA_CTRL_H)} value={riesgoEditProb} onChange={(e) => setRiesgoEditProb(e.target.value)}>
                              <option value="">—</option>
                              <option value="baja">Baja</option>
                              <option value="media">Media</option>
                              <option value="alta">Alta</option>
                            </select>
                          </td>
                          <td>
                            <select className={cn(FICHA_CTRL, FICHA_CTRL_H)} value={riesgoEditImpacto} onChange={(e) => setRiesgoEditImpacto(e.target.value)}>
                              <option value="">—</option>
                              <option value="bajo">Bajo</option>
                              <option value="medio">Medio</option>
                              <option value="alto">Alto</option>
                            </select>
                          </td>
                          <td>
                            <input className={cn(FICHA_CTRL, FICHA_CTRL_H)} value={riesgoEditMitigacion} onChange={(e) => setRiesgoEditMitigacion(e.target.value)} />
                          </td>
                          <td>
                            <input value={riesgoEditResponsable} onChange={(e) => setRiesgoEditResponsable(e.target.value)} />
                          </td>
                          <td>
                            <div className="flex items-center gap-1.5 [&_input]:rounded-lg [&_input]:border [&_input]:border-line [&_input]:bg-panel [&_input]:px-[9px] [&_input]:py-[7px] [&_input]:text-[13px] [&_select]:rounded-lg [&_select]:border [&_select]:border-line [&_select]:bg-panel [&_select]:px-[9px] [&_select]:py-[7px] [&_select]:text-[13px]">
                              <Button variant="primary"
                                onClick={async () => {
                                  setSavingRiesgo(true);
                                  try {
                                    const res = await fetch(`/api/necesidades/${necesidadId}/riesgos?riesgoId=${r.id}`, {
                                      method: "PATCH",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({
                                        riesgo: riesgoEditTexto,
                                        probabilidad: riesgoEditProb || undefined,
                                        impacto: riesgoEditImpacto || undefined,
                                        mitigacion: riesgoEditMitigacion || undefined,
                                        responsable: riesgoEditResponsable || undefined,
                                      }),
                                    });
                                    if (res.ok) {
                                      setRiesgoEditId(null);
                                      await reload();
                                    } else {
                                      const p = await res.json();
                                      setError(p.error ?? "No se pudo actualizar.");
                                    }
                                  } catch {
                                    setError("Error de conexión.");
                                  } finally {
                                    setSavingRiesgo(false);
                                  }
                                }}
                                type="button">Guardar</Button>
                              <Button
                                onClick={() => setRiesgoEditId(null)} type="button">Cancelar</Button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td>{r.riesgo}</td>
                          <td>
                            {r.probabilidad ? (
                              <Badge tone={tonoRiesgo(r.probabilidad)} className="capitalize">{r.probabilidad}</Badge>
                            ) : "—"}
                          </td>
                          <td>
                            {r.impacto ? (
                              <Badge tone={tonoRiesgo(r.impacto)} className="capitalize">{r.impacto}</Badge>
                            ) : "—"}
                          </td>
                          <td>{r.mitigacion ?? "—"}</td>
                          <td>{r.responsable ?? "—"}</td>
                          {puedeAdjuntar ? (
                            <td>
                              <div style={{ display: "flex", gap: 4 }}>
                                <button aria-label="Editar riesgo" 
                                  onClick={() => {
                                    setRiesgoEditId(r.id);
                                    setRiesgoEditTexto(r.riesgo);
                                    setRiesgoEditProb(r.probabilidad ?? "");
                                    setRiesgoEditImpacto(r.impacto ?? "");
                                    setRiesgoEditMitigacion(r.mitigacion ?? "");
                                    setRiesgoEditResponsable(r.responsable ?? "");
                                  }} type="button"><Pencil size={13} /></button>
                                <button aria-label="Eliminar riesgo" 
                                  disabled={deletingRiesgoId === r.id}
                                  onClick={() => setConfirmDeleteRiesgoId(r.id)} type="button">
                                  {deletingRiesgoId === r.id ? <Loader size={15} /> : <Trash2 size={15} />}
                                </button>
                              </div>
                            </td>
                          ) : null}
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {puedeAdjuntar ? (
          <form className="grid grid-cols-4 gap-2.5 rounded-[10px] border border-dashed border-brand/30 bg-surface p-3 [&_label]:grid [&_label]:gap-1 [&_label]:text-[12.5px] [&_label]:text-muted [&_input]:rounded-lg [&_input]:border [&_input]:border-line [&_input]:bg-panel [&_input]:px-[9px] [&_input]:py-[7px] [&_input]:text-[13px] [&_select]:rounded-lg [&_select]:border [&_select]:border-line [&_select]:bg-panel [&_select]:px-[9px] [&_select]:py-[7px] [&_select]:text-[13px]" onSubmit={addRiesgo}>
            <label className="col-span-2">
              <span>Riesgo identificado</span>
              <input
                onChange={(e) => setRiesgoTexto(e.target.value)}
                placeholder="Ej. Demora en la entrega por escasez del bien"
                value={riesgoTexto}
              />
            </label>
            <label>
              <span>Probabilidad</span>
              <select onChange={(e) => setRiesgoProb(e.target.value)} value={riesgoProb}>
                <option value="">—</option>
                <option value="baja">Baja</option>
                <option value="media">Media</option>
                <option value="alta">Alta</option>
              </select>
            </label>
            <label>
              <span>Impacto</span>
              <select onChange={(e) => setRiesgoImpacto(e.target.value)} value={riesgoImpacto}>
                <option value="">—</option>
                <option value="bajo">Bajo</option>
                <option value="medio">Medio</option>
                <option value="alto">Alto</option>
              </select>
            </label>
            <label className="col-span-2">
              <span>Mitigación</span>
              <input
                onChange={(e) => setRiesgoMitigacion(e.target.value)}
                placeholder="Medida para reducir el riesgo"
                value={riesgoMitigacion}
              />
            </label>
            <label>
              <span>Responsable</span>
              <input
                onChange={(e) => setRiesgoResponsable(e.target.value)}
                placeholder="Área / cargo"
                value={riesgoResponsable}
              />
            </label>
            <div className="col-span-full flex justify-end">
              <Button variant="primary" disabled={savingRiesgo || riesgoTexto.trim().length < 3} type="submit">
                {savingRiesgo ? <Loader size={15} /> : <Plus size={15} />}
                Agregar riesgo
              </Button>
            </div>
          </form>
        ) : null}
      </section>
      ) : null}

      {/* Cierre del ciclo: los dos actos de la DEC sobre algo ya redactado.
          Estaban en la cabecera y en el lateral de la ficha, es decir, antes
          y al lado del trabajo que juzgan. */}
      {/* Checklist de admisibilidad de la DEC (P3): visible una vez remitida;
          editable por la DEC mientras revisa. Es un apoyo, no bloquea el conforme. */}
      {necesidad.status !== "borrador" ? (
        <div id="sec-admisibilidad">
          <AdmisibilidadDec
            necesidadId={necesidadId}
            inicial={admisibilidadInicial}
            puedeEditar={lado.esDec && (necesidad.status === "remitido_dec" || necesidad.status === "en_revision_dec")}
          />
        </div>
      ) : null}

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

      <div id="sec-historial">
        <HistorialNecesidad necesidadId={necesidadId} recarga={histRecarga} />
      </div>


      <ConfirmDialog
        open={confirmDeleteDocId !== null}
        title="Eliminar adjunto"
        message="¿Estás seguro de eliminar este documento? No se puede deshacer."
        tone="danger"
        confirmLabel="Eliminar"
        onConfirm={() => { if (confirmDeleteDocId) void deleteDocumento(confirmDeleteDocId); }}
        onCancel={() => setConfirmDeleteDocId(null)}
      />
      <ConfirmDialog
        open={confirmDeleteRiesgoId !== null}
        title="Eliminar riesgo"
        message="¿Estás seguro de eliminar este riesgo de la matriz?"
        tone="warning"
        confirmLabel="Eliminar"
        onConfirm={() => { if (confirmDeleteRiesgoId) void deleteRiesgoWithConfirm(confirmDeleteRiesgoId); }}
        onCancel={() => setConfirmDeleteRiesgoId(null)}
      />
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
