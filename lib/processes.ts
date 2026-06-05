import { z } from "zod";

// Tipos y validacion del Expediente (procurement_processes) y sus documentos.
export type ProcurementProcess = {
  id: string;
  nomenclature: string;
  object_type: "bienes" | "servicios" | "obras" | "consultoria";
  procedure_type: string | null;
  amount: number | null;
  entity: string | null;
  status: string;
  summary: string | null;
  created_at: string;
  updated_at: string;
};

export type ProcessDocument = {
  id: string;
  process_id: string;
  library_document_id?: string | null;
  kind: string;
  bidder_name: string | null;
  title: string;
  file_name: string | null;
  storage_bucket: string | null;
  storage_path: string | null;
  mime_type: string | null;
  status: "uploaded" | "processing" | "ready" | "error";
  error_message: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export const processCreateSchema = z.object({
  nomenclature: z.string().trim().min(3).max(200),
  objectType: z.enum(["bienes", "servicios", "obras", "consultoria"]).default("servicios"),
  procedureType: z.string().trim().max(80).optional().or(z.literal("")),
  amount: z.coerce.number().nonnegative().optional().or(z.literal("")),
  entity: z.string().trim().max(160).optional().or(z.literal("")),
  summary: z.string().trim().max(2000).optional().or(z.literal("")),
});

export const processUpdateSchema = z.object({
  nomenclature: z.string().trim().min(3).max(200).optional(),
  procedureType: z.string().trim().max(80).optional(),
  amount: z.coerce.number().nonnegative().optional(),
  entity: z.string().trim().max(160).optional(),
  status: z
    .enum(["en_preparacion", "en_evaluacion", "otorgado", "desierto", "en_ejecucion", "cerrado"])
    .optional(),
  summary: z.string().trim().max(2000).optional(),
});

export const processDocKinds = [
  "bases",
  "bases_integradas",
  "oferta",
  "contrato",
  "acta",
  "requerimiento",
  "tdr",
  "ee_tt",
  "informe",
  "carta",
  "generado",
  "otros",
] as const;
