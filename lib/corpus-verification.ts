import { searchLegalSources } from "@/lib/legal-chat";
import {
  assessProcedureSourceCoverage,
  procedureEntries,
  procedureSourceRequirements,
} from "@/lib/procedure-catalog";
import { supabaseRest } from "@/lib/supabase-server";

type DocumentRow = {
  id: string;
  title: string;
  document_type: string;
  process_type: string | null;
  status: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

type ChunkRow = {
  id: string;
  document_id: string;
  page_start: number | null;
  page_end: number | null;
  metadata: Record<string, unknown>;
  pinecone_vector_id: string | null;
};

type CorpusRequirement = {
  code: string;
  label: string;
  pass: boolean;
  detail: string;
};

const requiredDocumentTypes = ["ley", "reglamento", "directiva", "opinion"] as const;

const requiredNormativeTargets = [
  {
    code: "NORM-LEY-32069",
    documentType: "ley",
    label: "Ley 32069 cargada e indexada",
    patterns: ["32069", "ley general de contrataciones"],
  },
  {
    code: "NORM-REG-009-2025",
    documentType: "reglamento",
    label: "Reglamento D.S. 009-2025-EF cargado e indexado",
    patterns: ["009-2025", "reglamento"],
  },
  {
    code: "NORM-MOD-001-2026",
    documentType: "reglamento",
    label: "Modificatoria D.S. 001-2026-EF considerada",
    patterns: ["001-2026", "modifica", "modificatoria"],
  },
  {
    code: "NORM-DIR-SIE",
    documentType: "directiva",
    label: "Directiva SIE cargada e indexada",
    patterns: ["subasta inversa", "006-2019", "sie"],
  },
] as const;

function metadataString(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];
  return typeof value === "string" ? value : null;
}

function metadataNumber(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeComparable(text: string) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\w\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function documentSearchText(document: DocumentRow) {
  return normalizeComparable(
    [
      document.title,
      document.document_type,
      document.process_type ?? "",
      metadataString(document.metadata, "summary") ?? "",
      metadataString(document.metadata, "topic") ?? "",
      metadataString(document.metadata, "amends") ?? "",
      metadataString(document.metadata, "documentNumber") ?? "",
      metadataString(document.metadata, "number") ?? "",
    ].join(" "),
  );
}

function chunkArticle(chunk: ChunkRow) {
  return metadataString(chunk.metadata, "article") ?? metadataString(chunk.metadata, "articulo");
}

function verificationPass(document: DocumentRow) {
  const pinecone = document.metadata?.pinecone;
  if (!pinecone || typeof pinecone !== "object") {
    return false;
  }
  const verification = (pinecone as Record<string, unknown>).verification;
  if (!verification || typeof verification !== "object") {
    return false;
  }
  return (verification as Record<string, unknown>).verified === true;
}

function documentSummary(documents: DocumentRow[], chunks: ChunkRow[]) {
  return requiredDocumentTypes.map((documentType) => {
    const docs = documents.filter((document) => document.document_type === documentType);
    const indexed = docs.filter((document) => document.status === "indexed");
    const docIds = new Set(docs.map((document) => document.id));
    const docChunks = chunks.filter((chunk) => docIds.has(chunk.document_id));
    const chunksWithPage = docChunks.filter((chunk) => chunk.page_start || chunk.page_end).length;
    const chunksWithArticle = docChunks.filter((chunk) => chunkArticle(chunk)).length;

    return {
      documentType,
      documents: docs.length,
      indexed: indexed.length,
      chunks: docChunks.length,
      chunksWithArticle,
      chunksWithPage,
      pineconeVerified: indexed.filter(verificationPass).length,
    };
  });
}

function buildRequirements(documents: DocumentRow[], chunks: ChunkRow[]): CorpusRequirement[] {
  const requirements: CorpusRequirement[] = [];
  const summaries = documentSummary(documents, chunks);

  for (const summary of summaries) {
    requirements.push({
      code: `DOC-${summary.documentType.toUpperCase()}`,
      detail: `${summary.indexed}/${summary.documents} documento(s) indexado(s), ${summary.chunks} fragmento(s).`,
      label: `Existe ${summary.documentType} indexado`,
      pass: summary.indexed > 0,
    });
  }

  const chunksWithPage = chunks.filter((chunk) => chunk.page_start || chunk.page_end).length;
  const chunksWithArticle = chunks.filter((chunk) => chunkArticle(chunk)).length;
  const chunksWithVector = chunks.filter((chunk) => chunk.pinecone_vector_id).length;

  requirements.push({
    code: "TRACE-PAGE",
    detail: `${chunksWithPage}/${chunks.length} fragmento(s) con pagina.`,
    label: "Fragmentos con pagina",
    pass: chunks.length > 0 && chunksWithPage / chunks.length >= 0.8,
  });
  requirements.push({
    code: "TRACE-ARTICLE",
    detail: `${chunksWithArticle}/${chunks.length} fragmento(s) con articulo detectado.`,
    label: "Fragmentos con articulo",
    pass: chunks.length > 0 && chunksWithArticle > 0,
  });
  requirements.push({
    code: "PINECONE-VECTORS",
    detail: `${chunksWithVector}/${chunks.length} fragmento(s) enlazado(s) a Pinecone.`,
    label: "Vectores Pinecone registrados",
    pass: chunks.length > 0 && chunksWithVector / chunks.length >= 0.95,
  });

  for (const target of requiredNormativeTargets) {
    const matches = documents.filter((document) => {
      if (document.document_type !== target.documentType || document.status !== "indexed") {
        return false;
      }
      const searchText = documentSearchText(document);
      return target.patterns.some((pattern) => searchText.includes(normalizeComparable(pattern)));
    });

    requirements.push({
      code: target.code,
      detail: matches.length
        ? `${matches.length} documento(s) coincidente(s): ${matches.slice(0, 3).map((document) => document.title).join("; ")}.`
        : "No se encontró documento indexado que coincida con este objetivo normativo.",
      label: target.label,
      pass: matches.length > 0,
    });
  }

  return requirements;
}

async function runCriticalSearches() {
  const specificCases = [
    {
      code: "CP-ART-144",
      expected: "Reglamento articulo 144",
      query: "requisitos comparacion de precios articulo 144 reglamento",
      requiredArticle: "144",
      requiredDocumentType: "reglamento",
      processType: "comparacion_precios",
    },
    {
      code: "CP-MOD-001-2026",
      expected: "Modificatoria vigente D.S. 001-2026-EF sobre articulo 144",
      query: "Decreto Supremo 001-2026-EF modifica articulo 144 comparacion de precios reglamento",
      requiredArticle: "144",
      requiredDocumentType: "reglamento",
      requiredText: "001-2026",
      processType: "comparacion_precios",
    },
    {
      code: "SIE-DIRECTIVA",
      expected: "Directiva aplicable a subasta inversa electronica",
      query: "especificaciones tecnicas subasta inversa electronica ficha tecnica directiva",
      requiredDocumentType: "directiva",
      processType: "subasta_inversa_electronica",
    },
  ];
  const procedureCases = procedureEntries
    .filter((entry) => entry.value !== "otros")
    .flatMap((entry) =>
      procedureSourceRequirements(entry.value)
        .filter((requirement) => !requirement.optional || requirement.critical)
        .map((requirement) => ({
          code: `PROC-${entry.value.toUpperCase()}-${requirement.documentType.toUpperCase()}-${requirement.article ?? "REQ"}`,
          expected: `${requirement.label} para ${entry.label}`,
          query: [
            entry.anchors[0] ?? `${entry.label} procedimiento de seleccion normativa vigente requisitos`,
            requirement.label,
            requirement.article ? `articulo ${requirement.article}` : null,
            ...(requirement.titleIncludes ?? []),
          ]
            .filter(Boolean)
            .join(" "),
          requiredArticle: requirement.article,
          requiredDocumentType: requirement.documentType,
          processType: entry.value,
        })),
    );
  const cases = [...specificCases, ...procedureCases];

  return Promise.all(
    cases.map(async (item) => {
      const result = await searchLegalSources({
        filters: { processType: item.processType },
        query: item.query,
        topK: 8,
      });
      const pass = result.sources.some((source) => {
        if ("requiredDocumentType" in item && item.requiredDocumentType && source.documentType !== item.requiredDocumentType) {
          return false;
        }
        if ("requiredArticle" in item && item.requiredArticle && !(source.article ?? "").includes(item.requiredArticle)) {
          return false;
        }
        if ("requiredText" in item && item.requiredText) {
          const haystack = normalizeComparable(`${source.documentTitle} ${source.excerpt}`);
          if (!haystack.includes(normalizeComparable(item.requiredText))) {
            return false;
          }
        }
        return (
          ["ley", "reglamento", "directiva", "opinion"].includes(source.documentType) &&
          source.vigencia !== "derogado" &&
          (source.processType === item.processType || source.processType === "todos" || !source.processType)
        );
      }) || assessProcedureSourceCoverage(item.processType, result.sources).missing.length === 0;

      return {
        code: item.code,
        expected: item.expected,
        pass,
        query: item.query,
        recovered: result.sources.slice(0, 5).map((source) => ({
          article: source.article,
          documentTitle: source.documentTitle,
          documentType: source.documentType,
          pageStart: source.pageStart,
          processType: source.processType,
          score: source.score,
        })),
      };
    }),
  );
}

export async function verifyCorpusReadiness() {
  const [documents, chunks] = await Promise.all([
    supabaseRest<DocumentRow[]>(
      "documents?select=id,title,document_type,process_type,status,metadata,created_at&order=created_at.desc&limit=1000",
    ),
    supabaseRest<ChunkRow[]>(
      "document_chunks?select=id,document_id,page_start,page_end,metadata,pinecone_vector_id&limit=5000",
    ),
  ]);
  const requirements = buildRequirements(documents, chunks);
  const criticalSearches = await runCriticalSearches();
  const summaries = documentSummary(documents, chunks);
  const flowReady =
    documents.some((document) => document.status === "indexed" && verificationPass(document)) &&
    chunks.some((chunk) => chunk.page_start || chunk.page_end) &&
    chunks.some((chunk) => chunk.pinecone_vector_id);

  return {
    checkedAt: new Date().toISOString(),
    corpusReady: requirements.every((item) => item.pass) && criticalSearches.every((item) => item.pass),
    criticalSearches,
    documents: {
      total: documents.length,
      indexed: documents.filter((document) => document.status === "indexed").length,
      byType: summaries,
      newest: documents.slice(0, 8).map((document) => ({
        createdAt: document.created_at,
        pageCount: metadataNumber(document.metadata, "pageCount"),
        pineconeVerified: verificationPass(document),
        processType: document.process_type,
        status: document.status,
        title: document.title,
        type: document.document_type,
      })),
    },
    flow: {
      ready: flowReady,
      detail: flowReady
        ? "Hay documentos indexados, fragmentos con pagina y vectores registrados."
        : "Falta al menos un documento indexado, paginas detectadas o vectores Pinecone.",
    },
    requirements,
  };
}
