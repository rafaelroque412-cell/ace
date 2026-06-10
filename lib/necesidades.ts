import { z } from "zod";

// Modulo 1: Gestion de Necesidades. La Necesidad es el inicio del ciclo de la
// contratacion: el area usuaria (o ATE) registra la necesidad publica, genera
// la Ficha de Necesidad con codigo unico y, tras la validacion, se deriva a un
// Expediente de Contratacion.

export type NecesidadStatus = "borrador" | "registrada" | "observada" | "aprobada" | "derivada";

export type Necesidad = {
  id: string;
  codigo: string | null;
  nombre: string;
  finalidad_publica: string | null;
  objetivo: string | null;
  centro_costo: string | null;
  meta_presupuestal: string | null;
  proyecto_inversion: string | null;
  tipo_contratacion: "bienes" | "servicios" | "obras" | "consultoria";
  area_usuaria: string | null;
  status: NecesidadStatus;
  summary: string | null;
  process_id: string | null;
  owner_id: string;
  entity: string | null;
  created_at: string;
  updated_at: string;
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
  "otros",
] as const;

const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));

export const necesidadCreateSchema = z.object({
  nombre: z.string().trim().min(3).max(200),
  tipoContratacion: z.enum(["bienes", "servicios", "obras", "consultoria"]).default("bienes"),
  finalidadPublica: optionalText(2000),
  objetivo: optionalText(2000),
  centroCosto: optionalText(120),
  metaPresupuestal: optionalText(120),
  proyectoInversion: optionalText(160),
  areaUsuaria: optionalText(160),
  summary: optionalText(2000),
});

export const necesidadUpdateSchema = z.object({
  nombre: z.string().trim().min(3).max(200).optional(),
  tipoContratacion: z.enum(["bienes", "servicios", "obras", "consultoria"]).optional(),
  finalidadPublica: optionalText(2000),
  objetivo: optionalText(2000),
  centroCosto: optionalText(120),
  metaPresupuestal: optionalText(120),
  proyectoInversion: optionalText(160),
  areaUsuaria: optionalText(160),
  summary: optionalText(2000),
  status: z.enum(["borrador", "registrada", "observada", "aprobada", "derivada"]).optional(),
});
