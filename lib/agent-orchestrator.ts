import { z } from "zod";
import { evaluateProcurementRules, procurementRuleInputSchema } from "./procurement-rules";
import { searchLegalSources } from "./legal-chat";
import {
  assessProcedureSourceCoverage,
  inferProcedureType as inferCatalogProcedureType,
} from "./procedure-catalog";

export const orchestratorRequestSchema = z.object({
  context: z
    .object({
      amount: z.coerce.number().nonnegative().optional().or(z.literal("")),
      objectType: z.enum(["bienes", "servicios", "obras", "consultoria"]).optional(),
      procedureType: z.string().trim().optional().or(z.literal("")),
      standardized: z.boolean().optional(),
      validOffers: z.coerce.number().int().nonnegative().optional().or(z.literal("")),
      directCause: z.string().trim().optional().or(z.literal("")),
      hasTechnicalFile: z.boolean().optional(),
      marketPlurality: z.boolean().optional(),
    })
    .optional(),
  processId: z.string().uuid().optional().or(z.literal("")),
  query: z.string().trim().min(5),
});

export type AgentPlan = {
  agents: Array<
    | "legal_search"
    | "document_agent"
    | "evaluation_agent"
    | "contract_agent"
    | "drafting_agent"
    | "tribunal_agent"
    | "risk_detection"
    | "rules_engine"
  >;
  intent:
    | "consulta_normativa"
    | "revision_documental"
    | "evaluacion_oferta"
    | "contrato"
    | "redaccion"
    | "jurisprudencia"
    | "riesgos"
    | "procedimiento";
  reason: string;
};

function normalize(text: string) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function inferObjectType(query: string) {
  const text = normalize(query);

  if (text.includes("obra")) return "obras" as const;
  if (text.includes("consultoria")) return "consultoria" as const;
  if (text.includes("bien") || text.includes("bienes")) return "bienes" as const;
  if (text.includes("servicio")) return "servicios" as const;

  return undefined;
}

function inferAmount(query: string) {
  const normalized = query.replace(/,/g, "");
  const match = normalized.match(/(?:s\/\.?|soles?)\s*([0-9]+(?:\.[0-9]+)?)/i) ?? normalized.match(/\b([0-9]{4,}(?:\.[0-9]+)?)\b/);

  if (!match) {
    return undefined;
  }

  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function inferProcedureType(query: string) {
  return inferCatalogProcedureType(query) ?? undefined;
}

function inferValidOffers(query: string) {
  const text = normalize(query);
  const match = text.match(/([0-9]+)\s+ofertas?\s+validas?/);
  if (!match) {
    return undefined;
  }

  const parsed = Number.parseInt(match[1], 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function inferStandardized(query: string) {
  const text = normalize(query);

  if (text.includes("no estandarizado") || text.includes("no comparable")) {
    return false;
  }

  if (text.includes("estandarizado") || text.includes("estandarizable") || text.includes("ficha tecnica")) {
    return true;
  }

  return undefined;
}

function inferTechnicalFile(query: string) {
  const text = normalize(query);

  if (text.includes("sin ficha tecnica") || text.includes("no tiene ficha tecnica")) {
    return false;
  }

  if (text.includes("ficha tecnica")) {
    return true;
  }

  return undefined;
}

function inferMarketPlurality(query: string) {
  const text = normalize(query);

  if (text.includes("sin pluralidad") || text.includes("proveedor unico")) {
    return false;
  }

  if (text.includes("pluralidad") || text.includes("varios proveedores")) {
    return true;
  }

  return undefined;
}

export function planAgents(query: string): AgentPlan {
  const text = normalize(query);

  if (text.includes("oferta") || text.includes("postor") || text.includes("cumple") || text.includes("calificacion")) {
    return {
      agents: ["document_agent", "evaluation_agent", "legal_search", "rules_engine"],
      intent: "evaluacion_oferta",
      reason: "La consulta requiere comparar requisitos/documentos de postor contra bases y normativa.",
    };
  }

  if (text.includes("informe") || text.includes("acta") || text.includes("carta") || text.includes("memorando")) {
    return {
      agents: ["drafting_agent", "legal_search", "risk_detection"],
      intent: "redaccion",
      reason: "La consulta solicita generar o estructurar un documento administrativo.",
    };
  }

  if (text.includes("riesgo") || text.includes("nulidad") || text.includes("direccionamiento")) {
    return {
      agents: ["risk_detection", "legal_search", "tribunal_agent"],
      intent: "riesgos",
      reason: "La consulta busca identificar vicios, nulidad o riesgos juridicos.",
    };
  }

  if (text.includes("contrato") || text.includes("penalidad") || text.includes("garantia") || text.includes("ampliacion")) {
    return {
      agents: ["contract_agent", "legal_search", "rules_engine"],
      intent: "contrato",
      reason: "La consulta se relaciona con perfeccionamiento o ejecucion contractual.",
    };
  }

  if (text.includes("comparacion de precios") || text.includes("subasta") || text.includes("procedimiento")) {
    return {
      agents: ["legal_search", "rules_engine", "risk_detection"],
      intent: "procedimiento",
      reason: "La consulta requiere validar procedencia de un procedimiento de seleccion.",
    };
  }

  return {
    agents: ["legal_search"],
    intent: "consulta_normativa",
    reason: "La consulta principal es normativa y requiere busqueda con fuentes.",
  };
}

export async function orchestrateProcurementQuery(input: z.infer<typeof orchestratorRequestSchema>) {
  const plan = planAgents(input.query);
  const inferredContext = {
    amount: input.context?.amount || inferAmount(input.query) || "",
    objectType: input.context?.objectType ?? inferObjectType(input.query),
    procedureType: input.context?.procedureType || inferProcedureType(input.query) || "",
    standardized: input.context?.standardized ?? inferStandardized(input.query),
    validOffers: input.context?.validOffers || inferValidOffers(input.query) || "",
    directCause: input.context?.directCause || "",
    hasTechnicalFile: input.context?.hasTechnicalFile ?? inferTechnicalFile(input.query),
    marketPlurality: input.context?.marketPlurality ?? inferMarketPlurality(input.query),
  };
  const rulesInput = procurementRuleInputSchema.parse(inferredContext);
  const rules = plan.agents.includes("rules_engine") ? evaluateProcurementRules(rulesInput) : null;
  const legal = plan.agents.includes("legal_search")
    ? await searchLegalSources({
        filters: {
          processType: inferredContext.procedureType || "",
        },
        query: input.query,
        topK: 8,
      })
    : null;
  const critical = assessCriticalSources(inferredContext.procedureType || "", legal?.sources ?? []);
  const finalRules =
    rules && !critical.ok
      ? {
          ...rules,
          conclusion: rules.conclusion === "no_procede" ? rules.conclusion : ("requiere_revision" as const),
          findings: [
            {
              action: "Completar el corpus o abrir la fuente critica antes de usar esta validacion como sustento.",
              basis: critical.required.join(", "),
              code: "FUENTE-CRITICA-001",
              level: "alto" as const,
              message: critical.warning ?? "Faltan fuentes criticas para el procedimiento.",
              status: "requiere_dato" as const,
            },
            ...rules.findings,
          ],
          nextSteps: [
            `Completar fuente critica: ${critical.missing.join(", ") || critical.required.join(", ")}.`,
            ...rules.nextSteps,
          ],
        }
      : rules;

  return {
    critical,
    inferredContext,
    legal,
    plan,
    rules: finalRules,
  };
}

function assessCriticalSources(procedureType: string, sources: Array<{ article: string | null; documentType: string; processType: string | null }>) {
  const coverage = assessProcedureSourceCoverage(procedureType, sources);
  return {
    missing: coverage.missing,
    ok: coverage.ok,
    required: coverage.required,
    warning:
      coverage.missingCritical.length || coverage.missing.length
        ? `Faltan fuentes criticas o requeridas: ${[
            ...coverage.missingCritical,
            ...coverage.missing.filter((item) => !coverage.missingCritical.includes(item)),
          ].join(", ")}.`
        : coverage.warnings.join(" ") || null,
  };
}
