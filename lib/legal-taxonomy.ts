// Fuente unica de verdad para las opciones de tipo documental y tipo de proceso
// usadas en los selectores de Chat, Consultas y Documentos.
// Los `value` deben mantenerse alineados con `allowedDocumentTypes` y
// `allowedProcessTypes` de `lib/documents.ts`.

export type TaxonomyOption = {
  label: string;
  value: string;
};

export const DOCUMENT_TYPES: TaxonomyOption[] = [
  { label: "Ley", value: "ley" },
  { label: "Reglamento", value: "reglamento" },
  { label: "Opinion", value: "opinion" },
  { label: "Directiva", value: "directiva" },
  { label: "Bases integradas", value: "bases_integradas" },
  { label: "Resolucion", value: "resolucion" },
  { label: "Contrato", value: "contrato" },
  { label: "Expediente", value: "expediente" },
  { label: "Otros", value: "otros" },
];

// Tipos documentales que el chat puede usar como fundamento de una respuesta.
export const ANSWERABLE_DOCUMENT_TYPES = ["ley", "reglamento", "opinion", "directiva"];

export const ANSWERABLE_DOCUMENT_TYPE_OPTIONS = DOCUMENT_TYPES.filter((item) =>
  ANSWERABLE_DOCUMENT_TYPES.includes(item.value),
);

export const PROCESS_TYPES: TaxonomyOption[] = [
  { label: "Todos los procesos", value: "todos" },
  { label: "Licitacion publica", value: "licitacion_publica" },
  { label: "Concurso publico", value: "concurso_publico" },
  { label: "Adjudicacion simplificada", value: "adjudicacion_simplificada" },
  { label: "Subasta inversa electronica", value: "subasta_inversa_electronica" },
  { label: "Comparacion de precios", value: "comparacion_precios" },
  { label: "Contratacion directa", value: "contratacion_directa" },
  { label: "Acuerdo marco", value: "acuerdo_marco" },
  { label: "Seleccion de consultores individuales", value: "seleccion_consultores_individuales" },
  { label: "Procedimiento especial", value: "procedimiento_especial" },
  { label: "Otros", value: "otros" },
];

// Expedientes (SDD): tipo de objeto, estado y clases de documento de trabajo.
export const OBJECT_TYPES: TaxonomyOption[] = [
  { label: "Bienes", value: "bienes" },
  { label: "Servicios", value: "servicios" },
  { label: "Obras", value: "obras" },
  { label: "Consultoría", value: "consultoria" },
];

export const PROCESS_STATUSES: TaxonomyOption[] = [
  { label: "En preparación", value: "en_preparacion" },
  { label: "En evaluación", value: "en_evaluacion" },
  { label: "Otorgado", value: "otorgado" },
  { label: "Desierto", value: "desierto" },
  { label: "En ejecución", value: "en_ejecucion" },
  { label: "Cerrado", value: "cerrado" },
];

export const PROCESS_DOC_KINDS: TaxonomyOption[] = [
  { label: "Bases", value: "bases" },
  { label: "Bases integradas", value: "bases_integradas" },
  { label: "Oferta de postor", value: "oferta" },
  { label: "Contrato", value: "contrato" },
  { label: "Acta", value: "acta" },
  { label: "Requerimiento", value: "requerimiento" },
  { label: "Términos de referencia", value: "tdr" },
  { label: "Especificaciones técnicas", value: "ee_tt" },
  { label: "Informe", value: "informe" },
  { label: "Carta", value: "carta" },
  { label: "Documento generado", value: "generado" },
  { label: "Otros", value: "otros" },
];

const documentTypeLabels = new Map(DOCUMENT_TYPES.map((item) => [item.value, item.label]));
const processTypeLabels = new Map(PROCESS_TYPES.map((item) => [item.value, item.label]));
const objectTypeLabels = new Map(OBJECT_TYPES.map((item) => [item.value, item.label]));
const processStatusLabels = new Map(PROCESS_STATUSES.map((item) => [item.value, item.label]));
const processDocKindLabels = new Map(PROCESS_DOC_KINDS.map((item) => [item.value, item.label]));

export function objectTypeLabel(value?: string | null): string {
  if (!value) return "Sin objeto";
  return objectTypeLabels.get(value) ?? value;
}

export function processStatusLabel(value?: string | null): string {
  if (!value) return "Sin estado";
  return processStatusLabels.get(value) ?? value;
}

export function processDocKindLabel(value?: string | null): string {
  if (!value) return "Otros";
  return processDocKindLabels.get(value) ?? value;
}

export function documentTypeLabel(value?: string | null): string {
  if (!value) {
    return "Sin tipo";
  }

  return documentTypeLabels.get(value) ?? value;
}

export function processTypeLabel(value?: string | null): string | null {
  if (!value) {
    return null;
  }

  return processTypeLabels.get(value) ?? null;
}
