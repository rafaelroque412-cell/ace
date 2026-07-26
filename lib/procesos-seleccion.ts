// Catálogo del "Tipo de proceso de selección" que el ÁREA USUARIA anticipa en la
// ficha de Necesidad (referencia inicial, no vinculante: la DEC lo confirma en la
// Estrategia A4, Art. 46.1.a). Se comparte entre el cliente (desplegable de la
// ficha) y el servidor (copiloto): cada procedimiento apunta a sus PDF-modelo de
// requerimiento (`pdfs`), que la unidad de abastecimiento sube en Configuración →
// Procesos de contratación y que quedan indexados en el RAG. Ese puente
// procedimiento → modelo es el que usa el copiloto para redactar con el formato
// propio de la entidad.
//
// LA LISTA ES LA DEL REGLAMENTO, no una lista propia. El Reglamento enumera los
// procedimientos en tres tablas con las columnas «Tipo de procedimiento»,
// «Modalidad» y «Condiciones para su uso»:
//
//   Art. 93 — Licitación Pública (bienes y obras) ......... 9 tipos
//   Art. 94 — Concurso Público (servicios y consultorías) . 6 tipos
//   Art. 95 — Otras modalidades diferenciadas ............. 5 tipos
//   Art. 55 de la Ley 32069 — no competitivo .............. 1 tipo
//                                                          ── 21 ──
//
// Antes esta lista tenía 18 entradas sacadas de los NOMBRES DE LOS PDF-MODELO,
// que son plantillas operativas y no la tipología legal. Eso partía una sola fila
// del Art. 94 —«Concurso público para consultorías y servicios de mantenimiento
// vial»— en seis entradas (consultoría en general, consultoría de obra y
// mantenimiento vial, cada una con su abreviado), y dejaba fuera ocho tipos que
// el Reglamento sí lista: bienes especializados, obras con precalificación,
// licitación con diálogo competitivo, obras con negociación, MDA, concurso con
// precalificación, concurso con diálogo competitivo y el concurso abreviado para
// expertos y gerentes de proyectos.
//
// Por eso `pdfs` es una LISTA y puede repetirse entre procedimientos: la
// tipología legal es más gruesa que las plantillas, así que un procedimiento
// puede tener varios modelos base y un modelo puede servir a varios
// procedimientos.

/** Tipos de objeto de contratación a los que aplica un campo. */
export type ObjetoFilter = "bienes" | "servicios" | "obras" | "consultoria_obra";

/** Columna «Modalidad» de las tablas de los Arts. 93 y 94. */
export type ModalidadProceso = "sm" | "abreviada" | "diferenciada";

export type ProcesoSeleccion = {
  value: string;
  label: string;
  objetos: ObjetoFilter[];
  /** Vacío en las del Art. 95 y en el no competitivo, que no llevan esa columna. */
  modalidad?: ModalidadProceso;
  /** Artículo que lo establece, tal cual se cita. */
  articulo: string;
  /** Resumen de la columna «Condiciones para su uso». */
  condiciones: string;
  /** Modelos base (nombre EXACTO tal como está en `documents.file_name`). */
  pdfs?: string[];
};

const ART_93 = "Reglamento, Art. 93 · licitación pública (Ley 32069, Art. 54.1.a).";
const ART_94 = "Reglamento, Art. 94 · concurso público (Ley 32069, Art. 54.1.b).";
const ART_95 = "Reglamento, Art. 95 · otras modalidades diferenciadas (Ley 32069, Art. 54.2).";

const MODELO_BIENES = "REQUERIMIENTO LICITACION PUBICA PARA BIENES.pdf";
const MODELO_BIENES_ABREV = "REQUERIMIENTO LICITACIÓN PÚBLICA ABREVIADA PARA BIENES.pdf";
const MODELO_OBRAS = "REQUERIMIENTO LICITACIÓN PÚBLICA DE OBRAS.pdf";
const MODELO_OBRAS_ABREV = "REQUERIMIENTO LICITACION PUBLICA ABREVIADA DE OBRAS.pdf";
const MODELO_SERVICIOS = "REQUERIMIENTO-CONCURSO PUBLICO DE SERVICIOS.pdf";
// El Art. 94 junta consultorías y mantenimiento vial en un solo procedimiento; la
// entidad tiene una plantilla por cada uno, y las tres le sirven.
const MODELOS_CONSULTORIA_VIAL = [
  "REQUERIMIENTO CONCURSO PÚBLICO PARA CONSULTORÍA EN GENERAL.pdf",
  "REQUERIMIENTO CONCURSO PÚBLICO PARA CONSULTORÍA DE OBRA.pdf",
  "REQUERIMIENTO CONCURSO PÚBLICO PARA SERVICIO DE MANTENIMIENTO VIAL.pdf",
];
const MODELOS_CONCURSO_ABREVIADO = [
  "REQUERIMIENTO CONCURSO PÚBLICO ABREVIADO DE SERVICIOS.pdf",
  "REQUERIMEINTO CONCURSO PÚBLICO ABREVIADO PARA CONSULTORÍA EN GENERAL.pdf",
  "REQUERIMIENTO CONCURSO PÚBLICO ABREVIADO PARA CONSULTORÍA DE OBRA.pdf",
  "requerimiento CONCURSO PÚBLICO ABREVIADO PARA SERVICIO DE MANTENIMIENTO VIAL.pdf",
];

export const PROCESOS_SELECCION: ProcesoSeleccion[] = [
  {
    articulo: "",
    condiciones: "",
    label: "— Por definir (lo confirma la DEC en A4) —",
    objetos: [],
    value: "",
  },

  // ── Art. 93 · Licitación Pública (bienes y obras) ──────────────────────────
  {
    articulo: ART_93,
    condiciones: "Adquisición de bienes según la cuantía de la Ley de Presupuesto del año fiscal.",
    label: "Licitación Pública para bienes",
    modalidad: "sm",
    objetos: ["bienes"],
    pdfs: [MODELO_BIENES],
    value: "Licitación Pública para bienes",
  },
  {
    articulo: ART_93,
    condiciones:
      "Bienes bajo el sistema de entrega llave en mano o llave en mano con mantenimiento, con cuantía mayor a S/ 2 000 000,00. Incluye precalificación.",
    label: "Licitación Pública para bienes especializados",
    modalidad: "diferenciada",
    objetos: ["bienes"],
    pdfs: [MODELO_BIENES],
    value: "Licitación Pública para bienes especializados",
  },
  {
    articulo: ART_93,
    condiciones:
      "Bienes según cuantía; bienes homologados; rehabilitación y reconstrucción posterior a emergencias y desastres; segunda convocatoria; insumos de empresas del Estado (7.ª DCF de la Ley).",
    label: "Licitación Pública abreviada para bienes",
    modalidad: "abreviada",
    objetos: ["bienes"],
    pdfs: [MODELO_BIENES_ABREV],
    value: "Licitación Pública abreviada para bienes",
  },
  {
    articulo: ART_93,
    condiciones:
      "Obras bajo los sistemas de entrega solo construcción, diseño y construcción, o diseño, construcción, operación y mantenimiento, con cuantía menor a S/ 79 000 000,00.",
    label: "Licitación Pública de obras",
    modalidad: "sm",
    objetos: ["obras"],
    pdfs: [MODELO_OBRAS],
    value: "Licitación Pública de obras",
  },
  {
    articulo: ART_93,
    condiciones: "Los mismos sistemas de entrega que la licitación de obras, con cuantía igual o mayor a S/ 79 000 000,00.",
    label: "Licitación Pública de obras con precalificación",
    modalidad: "diferenciada",
    objetos: ["obras"],
    pdfs: [MODELO_OBRAS],
    value: "Licitación Pública de obras con precalificación",
  },
  {
    articulo: ART_93,
    condiciones:
      "Obras de solo construcción o diseño y construcción según cuantía; rehabilitación y reconstrucción posterior a emergencias y desastres; segunda convocatoria.",
    label: "Licitación Pública abreviada de obras",
    modalidad: "abreviada",
    objetos: ["obras"],
    pdfs: [MODELO_OBRAS_ABREV],
    value: "Licitación Pública abreviada de obras",
  },
  {
    articulo: ART_93,
    condiciones:
      "La entidad sustenta en la estrategia que no puede definir por sí misma el requerimiento: bienes altamente sofisticados de cuantía mayor a S/ 2 000 000,00, u obras por entrega integrada de proyecto o alianza que incluyan la formulación, de cuantía igual o mayor a S/ 79 000 000,00.",
    label: "Licitación Pública con diálogo competitivo",
    modalidad: "diferenciada",
    objetos: ["bienes", "obras"],
    value: "Licitación Pública con diálogo competitivo",
  },
  {
    articulo: ART_93,
    condiciones:
      "Obras bajo los sistemas de entrega integrada de proyecto o alianza, gestión del diseño y construcción al riesgo, y gestión del diseño y construcción de agencia.",
    label: "Licitación Pública de obras con negociación",
    modalidad: "diferenciada",
    objetos: ["obras"],
    pdfs: [MODELO_OBRAS],
    value: "Licitación Pública de obras con negociación",
  },
  {
    articulo: ART_93,
    condiciones:
      "Tecnologías sanitarias para diagnóstico y tratamiento de enfermedades raras o huérfanas, oncológicas y de alto costo, y tecnologías sanitarias innovadoras.",
    label: "Licitación Pública para mecanismos diferenciados de adquisición (MDA)",
    modalidad: "diferenciada",
    objetos: ["bienes"],
    value: "Licitación Pública para mecanismos diferenciados de adquisición (MDA)",
  },

  // ── Art. 94 · Concurso Público (servicios y consultorías) ──────────────────
  {
    articulo: ART_94,
    condiciones: "Servicios en general, según la cuantía de la Ley de Presupuesto del año fiscal.",
    label: "Concurso Público de servicios",
    modalidad: "sm",
    objetos: ["servicios"],
    pdfs: [MODELO_SERVICIOS],
    value: "Concurso Público de servicios",
  },
  {
    articulo: ART_94,
    condiciones:
      "Consultorías, consultorías de obra o servicios de mantenimiento vial, según la cuantía de la Ley de Presupuesto del año fiscal.",
    label: "Concurso Público para consultorías y servicios de mantenimiento vial",
    modalidad: "sm",
    objetos: ["servicios", "consultoria_obra"],
    pdfs: MODELOS_CONSULTORIA_VIAL,
    value: "Concurso Público para consultorías y servicios de mantenimiento vial",
  },
  {
    articulo: ART_94,
    condiciones:
      "Servicios o consultorías de obra según cuantía; servicios homologados; rehabilitación y reconstrucción posterior a emergencias y desastres; segunda convocatoria; insumos de empresas del Estado (7.ª DCF de la Ley).",
    label: "Concurso Público abreviado",
    modalidad: "abreviada",
    objetos: ["servicios", "consultoria_obra"],
    pdfs: MODELOS_CONCURSO_ABREVIADO,
    value: "Concurso Público abreviado",
  },
  {
    articulo: ART_94,
    condiciones:
      "Consultorías de obra, servicios de mantenimiento vial o servicio especializado de gestión de instalaciones, con cuantía mayor a S/ 2 000 000,00.",
    label: "Concurso Público con precalificación",
    modalidad: "diferenciada",
    objetos: ["servicios", "consultoria_obra"],
    pdfs: MODELOS_CONSULTORIA_VIAL,
    value: "Concurso Público con precalificación",
  },
  {
    articulo: ART_94,
    condiciones:
      "La entidad sustenta en la estrategia que no puede definir por sí misma el requerimiento: ASISTE, servicio especializado de gestión de instalaciones o de mantenimiento vial, o consultorías de obra bajo el sistema de entrega formulación y diseño.",
    label: "Concurso Público con diálogo competitivo",
    modalidad: "diferenciada",
    objetos: ["servicios", "consultoria_obra"],
    value: "Concurso Público con diálogo competitivo",
  },
  {
    articulo: ART_94,
    condiciones:
      "Gerentes de proyecto para los contratos estandarizados del Art. 223, según cuantía; y evaluadores expertos del Art. 57, con cuantía menor a S/ 100 000,00.",
    label: "Concurso Público abreviado para la contratación de expertos y gerentes de proyectos",
    modalidad: "abreviada",
    objetos: ["servicios"],
    value: "Concurso Público abreviado para la contratación de expertos y gerentes de proyectos",
  },

  // ── Art. 95 · Otras modalidades diferenciadas ──────────────────────────────
  // Las CINCO que el Reglamento enumera en su tabla, ni una más.
  {
    articulo: ART_95,
    condiciones:
      "Soluciones innovadoras que comprenden investigación y desarrollo (I+D) y la creación de prototipos o sus primeras pruebas, con independencia de su cuantía.",
    label: "Compra Pública Precomercial",
    objetos: ["bienes", "servicios"],
    value: "Compra Pública Precomercial",
  },
  {
    articulo: ART_95,
    condiciones:
      "Soluciones innovadoras que no están en el mercado —o que, estándolo, admiten ajuste, adaptación o mejora—, comprendiendo el I+D y la contratación de la solución, con independencia de su cuantía.",
    label: "Asociación para la Innovación",
    objetos: ["bienes", "servicios"],
    value: "Asociación para la Innovación",
  },
  {
    articulo: ART_95,
    condiciones: "Bienes o servicios comunes que cuenten con ficha técnica, con independencia de su cuantía.",
    label: "Subasta Inversa Electrónica",
    objetos: ["bienes", "servicios"],
    pdfs: ["REQUERIMIENTO SUBASTA INVERSA ELECTRÓNICA.pdf"],
    value: "Subasta Inversa Electrónica",
  },
  {
    articulo: ART_95,
    condiciones:
      "Bienes o servicios de oferta estándar entregables en un máximo de cinco días hábiles sin fabricarse a medida, o incluidos en el Listado de la DGA, con cuantía de hasta S/ 100 000,00.",
    label: "Comparación de Precios",
    objetos: ["bienes", "servicios"],
    pdfs: ["REQUERIMIENTO COMPARACIÓN DE PRECIOS.pdf"],
    value: "Comparación de Precios",
  },
  {
    articulo: ART_95,
    condiciones:
      "Consultorías de obra bajo los sistemas de entrega de solo diseño o de formulación y diseño, u obras bajo diseño y construcción para obras urbanas, edificaciones y afines, previo sustento del área usuaria. Evalúa un jurado.",
    label: "Concurso de Proyectos Arquitectónicos y Urbanísticos",
    objetos: ["obras", "consultoria_obra"],
    value: "Concurso de Proyectos Arquitectónicos y Urbanísticos",
  },

  // ── Art. 55 de la Ley · No competitivo ─────────────────────────────────────
  // UNO solo, no uno por causal. El Art. 55.1 lista once supuestos (a-k) para
  // contratar directamente —otra entidad, emergencia, desabastecimiento,
  // proveedor único, servicios personalísimos, medios de comunicación, I+D+i,
  // inmuebles, defensa legal de funcionarios, defensa de la entidad en arbitraje
  // o juicio, y continuación de un contrato resuelto o nulo—, pero son CAUSALES
  // de un mismo procedimiento, no procedimientos distintos.
  {
    articulo: "Ley 32069, Art. 55 · supuestos tasados de contratación directa.",
    condiciones: "Alguno de los once supuestos tasados del Art. 55.1 (a-k), debidamente sustentado.",
    label: "Procedimiento de Selección No Competitivo",
    objetos: ["bienes", "servicios", "obras", "consultoria_obra"],
    pdfs: ["REQUERIMIENTO PROCEDIMIENTO DE SELECCIÓN NO COMPETITIVO.pdf"],
    value: "Procedimiento de Selección No Competitivo",
  },
];

export const PROCESO_SELECCION_OPCIONES = PROCESOS_SELECCION.map(({ value, label }) => ({ value, label }));

// Cada procedimiento acota los objetos aplicables; el requerimiento (secciones
// 3.1–3.5) solo registra los campos de esos objetos, según su requerimiento
// oficial. Ej: "Concurso Público de servicios" → servicios (oculta campos de obras).
export const OBJETOS_POR_PROCEDIMIENTO: Record<string, ObjetoFilter[]> = Object.fromEntries(
  PROCESOS_SELECCION.filter((p) => p.value && p.objetos.length > 0).map((p) => [p.value, p.objetos]),
);

/** Valor del catálogo que declara, ya en la ficha, un procedimiento no competitivo. */
export const PROCESO_NO_COMPETITIVO = "Procedimiento de Selección No Competitivo";

/**
 * ¿El tipo de proceso anticipado en la ficha es no competitivo?
 *
 * Sirve para adelantar el efecto del Art. 101.1 (sin segmentación ni interacción
 * con el mercado) al momento en que se abre el expediente, sin esperar a que A1
 * registre la causal del Art. 55. Sigue siendo una REFERENCIA del área usuaria:
 * quien lo confirma es la DEC, por eso solo se avisa, nunca se bloquea.
 */
export function esNoCompetitivo(tipoProceso: string | null | undefined): boolean {
  return (tipoProceso ?? "").trim() === PROCESO_NO_COMPETITIVO;
}

/**
 * Modelos de requerimiento asociados a un procedimiento (nombres tal como están
 * en `documents.file_name`). Son VARIOS porque la tipología del Reglamento es más
 * gruesa que las plantillas: el «Concurso Público para consultorías y servicios de
 * mantenimiento vial» del Art. 94 tiene tres. Vacío si no hay modelo.
 */
export function pdfsModeloDeProceso(value: string): string[] {
  return PROCESOS_SELECCION.find((p) => p.value === value)?.pdfs ?? [];
}

/**
 * ¿Este archivo es uno de los modelos base de ese procedimiento? Compara sin
 * distinguir mayúsculas ni tildes, igual que `procesoDePdfModelo`.
 */
export function esModeloDeProceso(fileName: string | null | undefined, value: string): boolean {
  const clave = normalizarNombreArchivo(fileName ?? "");
  if (!clave) return false;
  return pdfsModeloDeProceso(value).some((f) => normalizarNombreArchivo(f) === clave);
}

/** ¿`value` es un procedimiento del catálogo? El "— Por definir —" no cuenta. */
export function esProcesoValido(value: string | null | undefined): boolean {
  const v = (value ?? "").trim();
  return v !== "" && PROCESOS_SELECCION.some((p) => p.value === v);
}

/**
 * Reverso de `pdfsModeloDeProceso`: a partir del nombre del archivo, el
 * procedimiento cuyo modelo es. Sirve para vincular sin pedir nada al usuario
 * cuando vuelve a subir uno de los modelos oficiales. Compara sin distinguir
 * mayúsculas ni tildes porque los nombres reales del expediente mezclan ambas
 * («REQUERIMIENTO LICITACION PUBICA…» junto a «REQUERIMIENTO LICITACIÓN…»).
 *
 * Un mismo modelo puede servir a varios procedimientos (p. ej. el de obras vale
 * para la licitación de obras, la de precalificación y la de negociación); se
 * devuelve el PRIMERO del catálogo, que es el tipo base de esa familia.
 */
export function procesoDePdfModelo(fileName: string | null | undefined): string | null {
  const clave = normalizarNombreArchivo(fileName ?? "");
  if (!clave) return null;
  return (
    PROCESOS_SELECCION.find((p) => p.pdfs?.some((f) => normalizarNombreArchivo(f) === clave))?.value ?? null
  );
}

function normalizarNombreArchivo(nombre: string): string {
  return nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\.pdf$/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
