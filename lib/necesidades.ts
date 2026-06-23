import { z } from "zod";

// Modulo 1: Gestion de Necesidades. La Necesidad es el inicio del ciclo de la
// contratacion: el area usuaria (o ATE) registra la necesidad publica, genera
// la Ficha de Necesidad con codigo unico y, tras la validacion, se deriva a un
// Expediente de Contratacion.

export type NecesidadStatus = "borrador" | "pendiente_revision" | "observado" | "subsanado" | "aprobado_area_usuaria" | "enviado_dec" | "incorporado_cmn";

export type RiesgoNecesidad = {
  id: string;
  necesidad_id: string;
  riesgo: string;
  probabilidad: "baja" | "media" | "alta" | null;
  impacto: "bajo" | "medio" | "alto" | null;
  mitigacion: string | null;
  responsable: string | null;
  created_at: string;
};

export type Necesidad = {
  id: string;
  codigo: string | null;
  anio_fiscal: number | null;
  periodo_programacion: string | null;
  version_cmn: string | null;
  entidad: string | null;
  unidad_ejecutora: string | null;
  area_usuaria: string | null;
  centro_costo: string | null;
  responsable: string | null;
  nombre: string;
  finalidad_publica: string | null;
  problema_identificado: string | null;
  objetivo_contratacion: string | null;
  beneficio_esperado: string | null;
  poblacion_beneficiaria: string | null;
  pei_objetivo: string | null;
  pei_accion: string | null;
  poi_actividad: string | null;
  meta_presupuestal: string | null;
  proyecto_inversion: string | null;
  ioarr: string | null;
  tipo_objeto: "bienes" | "servicios" | "obras" | "consultoria_obra";
  especialidad: string | null;
  subespecialidad: string | null;
  codigo_catalogo: string | null;
  descripcion_catalogo: string | null;
  descripcion_detallada: string | null;
  cantidad: number | null;
  unidad_medida: string | null;
  frecuencia: string | null;
  fecha_requerida: string | null;
  trimestre: number | null;
  mes_programado: number | null;
  fuente_financiamiento: string | null;
  rubro: string | null;
  cadena_funcional: string | null;
  clasificador_gasto: string | null;
  monto_estimado: number | null;
  costo_unitario: number | null;
  costo_total: number | null;
  anio_referencia: number | null;
  departamento: string | null;
  provincia: string | null;
  distrito: string | null;
  lugar_entrega: string | null;
  alcance: string | null;
  condiciones_ejecucion: string | null;
  modalidad_pago: string | null;
  sistema_entrega: string | null;
  plazo_ejecucion: number | null;
  experiencia_requerida: string | null;
  personal_clave: string | null;
  equipamiento_minimo: string | null;
  habilitaciones: string | null;
  status: NecesidadStatus;
  summary: string | null;
  process_id: string | null;
  owner_id: string;
  created_at: string;
  updated_at: string;
  riesgos?: RiesgoNecesidad[];
};

export type NecesidadDocumento = {
  id: string;
  necesidad_id: string;
  kind: string;
  title: string;
  file_name: string | null;
  storage_bucket: string | null;
  storage_path: string | null;
  mime_type: string | null;
  status: "uploaded" | "processing" | "ready" | "error";
  error_message: string | null;
  created_at: string;
};

export const necesidadDocKinds = [
  "requerimiento",
  "tdr",
  "ee_tt",
  "expediente_tecnico",
  "memoria_descriptiva",
  "informe_necesidad",
  "cotizacion",
  "otros",
] as const;

const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));

export const necesidadCreateSchema = z.object({
  nombre: z.string().trim().min(3).max(200),
  tipoObjeto: z.enum(["bienes", "servicios", "obras", "consultoria_obra"]).default("bienes"),
  anioFiscal: z.number().int().optional(),
  periodoProgramacion: optionalText(50),
  versionCmn: optionalText(50),
  entidad: optionalText(160),
  unidadEjecutora: optionalText(160),
  areaUsuaria: optionalText(160),
  centroCosto: optionalText(120),
  responsable: optionalText(160),
  finalidadPublica: optionalText(2000),
  problemaIdentificado: optionalText(2000),
  objetivoContratacion: optionalText(2000),
  beneficioEsperado: optionalText(2000),
  poblacionBeneficiaria: optionalText(500),
  peiObjetivo: optionalText(120),
  peiAccion: optionalText(120),
  poiActividad: optionalText(120),
  metaPresupuestal: optionalText(120),
  proyectoInversion: optionalText(160),
  ioarr: optionalText(160),
  especialidad: optionalText(120),
  subespecialidad: optionalText(120),
  codigoCatalogo: optionalText(50),
  descripcionCatalogo: optionalText(500),
  descripcionDetallada: optionalText(2000),
  cantidad: z.number().optional(),
  unidadMedida: optionalText(50),
  frecuencia: optionalText(50),
  fechaRequerida: optionalText(20),
  trimestre: z.number().int().min(1).max(4).optional(),
  mesProgramado: z.number().int().min(1).max(12).optional(),
  fuenteFinanciamiento: optionalText(120),
  rubro: optionalText(120),
  cadenaFuncional: optionalText(120),
  clasificadorGasto: optionalText(120),
  montoEstimado: z.number().optional(),
  costoUnitario: z.number().optional(),
  costoTotal: z.number().optional(),
  anioReferencia: z.number().int().optional(),
  departamento: optionalText(100),
  provincia: optionalText(100),
  distrito: optionalText(100),
  lugarEntrega: optionalText(500),
  alcance: optionalText(2000),
  condicionesEjecucion: optionalText(2000),
  modalidadPago: optionalText(500),
  sistemaEntrega: optionalText(100),
  plazoEjecucion: z.number().int().optional(),
  experienciaRequerida: optionalText(1000),
  personalClave: optionalText(1000),
  equipamientoMinimo: optionalText(1000),
  habilitaciones: optionalText(1000),
  summary: optionalText(2000),
});

export const necesidadUpdateSchema = necesidadCreateSchema.extend({
  nombre: z.string().trim().min(3).max(200).optional(),
  tipoObjeto: z.enum(["bienes", "servicios", "obras", "consultoria_obra"]).optional(),
  status: z.enum(["borrador", "pendiente_revision", "observado", "subsanado", "aprobado_area_usuaria", "enviado_dec", "incorporado_cmn"]).optional(),
});
