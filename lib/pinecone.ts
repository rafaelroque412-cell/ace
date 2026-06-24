import { embeddingDimensions, embeddingModel, getOpenAIClient } from "./openai-server";

type PineconeIndexInfo = {
  host: string;
  name: string;
  embed?: {
    field_map?: Record<string, string>;
  };
};

export type PineconeRecord = {
  _id: string;
  text: string;
  document_id: string;
  chunk_id: string;
  chunk_index: number;
  document_type: string;
  document_number?: string;
  hierarchy_rank?: number;
  page_end?: number;
  page_start?: number;
  process_type?: string;
  article?: string;
  section_title?: string;
  status?: string;
  title: string;
  source_entity?: string;
  source_role?: string;
  topic?: string;
  vigencia?: string;
  year?: number;
};

type PineconeSearchHit = {
  _id: string;
  _score: number;
  fields?: {
    article?: string;
    chunk_id?: string;
    chunk_index?: number;
    document_id?: string;
    document_number?: string;
    document_type?: string;
    hierarchy_rank?: number;
    page_end?: number;
    page_start?: number;
    process_type?: string;
    section_title?: string;
    source_entity?: string;
    source_role?: string;
    status?: string;
    text?: string;
    title?: string;
    topic?: string;
    vigencia?: string;
    year?: number;
  };
  article?: string;
  chunk_id?: string;
  chunk_index?: number;
  document_id?: string;
  document_number?: string;
  document_type?: string;
  hierarchy_rank?: number;
  page_end?: number;
  page_start?: number;
  process_type?: string;
  section_title?: string;
  source_entity?: string;
  source_role?: string;
  status?: string;
  text?: string;
  title?: string;
  topic?: string;
  vigencia?: string;
  year?: number;
};

const pineconeApiVersion = "2026-04";
const defaultNamespace = "legal-documents";
const maxUpsertBatchSize = 25;
const upsertRetryDelayMs = 65000;
const maxUpsertRetries = 3;

export type SearchFilters = {
  article?: string;
  documentId?: string;
  documentType?: string;
  sourceEntity?: string;
  status?: string;
  topic?: string;
  processType?: string;
  vigencia?: string;
  year?: number;
};

function compactFilter(filters?: SearchFilters) {
  if (!filters) {
    return undefined;
  }

  const clauses: Record<string, { $eq: string | number }> = {};

  if (filters.article) {
    clauses.article = { $eq: filters.article };
  }

  if (filters.documentId) {
    clauses.document_id = { $eq: filters.documentId };
  }

  if (filters.documentType) {
    clauses.document_type = { $eq: filters.documentType };
  }

  if (filters.sourceEntity) {
    clauses.source_entity = { $eq: filters.sourceEntity };
  }

  if (filters.status) {
    clauses.status = { $eq: filters.status };
  }

  if (filters.topic) {
    clauses.topic = { $eq: filters.topic };
  }

  if (filters.processType) {
    clauses.process_type = { $eq: filters.processType };
  }

  if (filters.vigencia) {
    clauses.vigencia = { $eq: filters.vigencia };
  }

  if (filters.year) {
    clauses.year = { $eq: filters.year };
  }

  return Object.keys(clauses).length > 0 ? clauses : undefined;
}

export function getPineconeConfig() {
  const apiKey = process.env.PINECONE_API_KEY;
  const indexName = process.env.PINECONE_INDEX_NAME;
  const namespace = process.env.PINECONE_NAMESPACE ?? defaultNamespace;

  if (!apiKey || !indexName) {
    throw new Error("Falta PINECONE_API_KEY o PINECONE_INDEX_NAME");
  }

  return { apiKey, indexName, namespace };
}

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

const maxEmbeddingBatchSize = 96;

// Calcula embeddings con OpenAI (reemplaza el modelo integrado de Pinecone para no
// depender de su cuota mensual de tokens). Devuelve un vector por texto, en orden.
async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) {
    return [];
  }

  const client = getOpenAIClient();
  const vectors: number[][] = [];

  for (let start = 0; start < texts.length; start += maxEmbeddingBatchSize) {
    const batch = texts.slice(start, start + maxEmbeddingBatchSize).map((text) => text.slice(0, 8000));
    const response = await client.embeddings.create({
      model: embeddingModel,
      input: batch,
      dimensions: embeddingDimensions,
    });
    for (const item of response.data) {
      vectors.push(item.embedding as number[]);
    }
  }

  return vectors;
}

// Metadata de Pinecone: solo campos definidos (Pinecone rechaza null/undefined) y
// sin el texto (el contenido se lee de Supabase; el vector solo guarda filtros).
function buildVectorMetadata(record: PineconeRecord): Record<string, string | number> {
  const metadata: Record<string, string | number> = {};
  const entries: Array<[string, string | number | undefined]> = [
    ["document_id", record.document_id],
    ["chunk_id", record.chunk_id],
    ["chunk_index", record.chunk_index],
    ["document_type", record.document_type],
    ["document_number", record.document_number],
    ["hierarchy_rank", record.hierarchy_rank],
    ["page_start", record.page_start],
    ["page_end", record.page_end],
    ["process_type", record.process_type],
    ["article", record.article],
    ["section_title", record.section_title],
    ["status", record.status],
    ["title", record.title],
    ["source_entity", record.source_entity],
    ["source_role", record.source_role],
    ["topic", record.topic],
    ["vigencia", record.vigencia],
    ["year", record.year],
  ];
  for (const [key, value] of entries) {
    if (value !== undefined && value !== null && value !== "") {
      metadata[key] = value;
    }
  }
  return metadata;
}

const maxRerankDocuments = 30;
const defaultCohereRerankModel = "rerank-v3.5";

function getRerankConfig() {
  return {
    enabled: (process.env.RERANK_ENABLED ?? process.env.PINECONE_RERANK_ENABLED ?? "true") !== "false",
    cohereApiKey: process.env.COHERE_API_KEY,
    cohereModel: process.env.COHERE_RERANK_MODEL || defaultCohereRerankModel,
  };
}

type RerankInput = { id: string; text: string };

// Reordena documentos por relevancia con el reranker dedicado de Cohere (rapido,
// ~100ms; reemplaza el reranker integrado de Pinecone, que tiene tope mensual).
// Si no hay COHERE_API_KEY o falla, devuelve null y el llamador conserva su orden
// (ordenamiento heuristico por evidenceQuality: semantico + lexical + jerarquia).
export async function rerankWithModel(
  query: string,
  documents: RerankInput[],
  topN?: number,
): Promise<Array<{ id: string; score: number }> | null> {
  const { enabled, cohereApiKey, cohereModel } = getRerankConfig();

  if (!enabled || !cohereApiKey || documents.length === 0) {
    return null;
  }

  const pool = documents.slice(0, maxRerankDocuments);

  try {
    const response = await fetch("https://api.cohere.com/v2/rerank", {
      body: JSON.stringify({
        model: cohereModel,
        query: query.slice(0, 4000),
        documents: pool.map((document) => document.text.slice(0, 4000)),
        top_n: Math.min(topN ?? pool.length, pool.length),
      }),
      headers: {
        Authorization: `Bearer ${cohereApiKey}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as {
      results?: Array<{ index: number; relevance_score: number }>;
    };

    return (payload.results ?? [])
      .filter((hit) => typeof hit.index === "number" && pool[hit.index])
      .map((hit) => ({ id: pool[hit.index].id, score: hit.relevance_score }));
  } catch {
    return null;
  }
}

function validatePineconeRecords(records: PineconeRecord[]) {
  const ids = new Set<string>();

  for (const record of records) {
    if (!record._id.trim()) {
      throw new Error("Pinecone record sin _id");
    }

    if (ids.has(record._id)) {
      throw new Error(`Pinecone record duplicado: ${record._id}`);
    }

    ids.add(record._id);

    if (!record.document_id || !record.chunk_id || typeof record.chunk_index !== "number") {
      throw new Error(`Pinecone record ${record._id} no tiene metadata minima de documento/chunk`);
    }

    if (!record.text || record.text.trim().length < 80) {
      throw new Error(`Pinecone record ${record._id} tiene texto insuficiente para embedding`);
    }
  }
}

// El host del indice es estable, pero describePineconeIndex se llamaba en cada
// search/upsert/delete (un round-trip extra a la API por operacion). Cacheamos el
// descriptor en memoria del modulo con TTL para no pagar esa latencia cada vez.
const describeCacheTtlMs = 10 * 60 * 1000;
let describeCache: { value: PineconeIndexInfo; expiresAt: number } | null = null;

export async function describePineconeIndex(): Promise<PineconeIndexInfo> {
  if (describeCache && describeCache.expiresAt > Date.now()) {
    return describeCache.value;
  }

  const { apiKey, indexName } = getPineconeConfig();
  const response = await fetch(`https://api.pinecone.io/indexes/${indexName}`, {
    headers: {
      "Api-Key": apiKey,
      "X-Pinecone-API-Version": pineconeApiVersion,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Pinecone describe index ${response.status}: ${await response.text()}`);
  }

  const value = (await response.json()) as PineconeIndexInfo;
  describeCache = { value, expiresAt: Date.now() + describeCacheTtlMs };
  return value;
}

export async function upsertTextRecords(records: PineconeRecord[], namespaceOverride?: string) {
  if (records.length === 0) {
    return;
  }

  validatePineconeRecords(records);

  const config = getPineconeConfig();
  const apiKey = config.apiKey;
  const namespace = namespaceOverride ?? config.namespace;
  const index = await describePineconeIndex();

  // Embeddings con OpenAI (no con el modelo integrado de Pinecone).
  const embeddings = await embedTexts(records.map((record) => record.text));
  const vectors = records.map((record, position) => ({
    id: record._id,
    values: embeddings[position],
    metadata: buildVectorMetadata(record),
  }));

  for (let indexStart = 0; indexStart < vectors.length; indexStart += maxUpsertBatchSize) {
    const batch = vectors.slice(indexStart, indexStart + maxUpsertBatchSize);
    const body = JSON.stringify({ namespace, vectors: batch });
    let response: Response | null = null;

    for (let attempt = 0; attempt <= maxUpsertRetries; attempt += 1) {
      response = await fetch(`https://${index.host}/vectors/upsert`, {
        body,
        headers: {
          "Api-Key": apiKey,
          "Content-Type": "application/json",
          "X-Pinecone-API-Version": pineconeApiVersion,
        },
        method: "POST",
      });

      if (response.status !== 429 || attempt === maxUpsertRetries) {
        break;
      }

      await sleep(upsertRetryDelayMs);
    }

    if (!response) {
      throw new Error("Pinecone upsert no devolvio respuesta");
    }

    if (!response.ok) {
      throw new Error(`Pinecone upsert ${response.status}: ${await response.text()}`);
    }

    await response.text();
  }

  return { batches: Math.ceil(vectors.length / maxUpsertBatchSize), upserted: vectors.length };
}

export async function verifyDocumentIndexedInPinecone(input: {
  documentId: string;
  expectedMinRecords: number;
  query: string;
  namespace?: string;
}) {
  const maxAttempts = 5;
  let lastHitCount = 0;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const hits = await searchTextRecords(
      input.query,
      Math.min(10, Math.max(1, input.expectedMinRecords)),
      { documentId: input.documentId },
      input.namespace,
    ).catch(() => []);

    lastHitCount = hits.length;

    if (hits.length > 0) {
      return {
        attempts: attempt + 1,
        hitCount: hits.length,
        verified: true,
      };
    }

    await sleep(1000 * 2 ** attempt);
  }

  return {
    attempts: maxAttempts,
    hitCount: lastHitCount,
    verified: false,
  };
}

export async function searchTextRecords(
  query: string,
  topK = 6,
  filters?: SearchFilters,
  namespaceOverride?: string,
) {
  const config = getPineconeConfig();
  const apiKey = config.apiKey;
  const namespace = namespaceOverride ?? config.namespace;
  const index = await describePineconeIndex();
  const filter = compactFilter(filters);
  const [vector] = await embedTexts([query]);

  const response = await fetch(`https://${index.host}/query`, {
    body: JSON.stringify({
      namespace,
      topK,
      vector,
      includeMetadata: true,
      includeValues: false,
      ...(filter ? { filter } : {}),
    }),
    headers: {
      "Api-Key": apiKey,
      "Content-Type": "application/json",
      "X-Pinecone-API-Version": pineconeApiVersion,
    },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(`Pinecone search ${response.status}: ${await response.text()}`);
  }

  const payload = (await response.json()) as {
    matches?: Array<{ id: string; score: number; metadata?: Record<string, unknown> }>;
  };

  // Normaliza al shape previo: _id, _score y los campos de metadata aplanados.
  return (payload.matches ?? []).map((match) => ({
    _id: match.id,
    _score: match.score,
    ...(match.metadata ?? {}),
  })) as unknown as Array<PineconeSearchHit & Record<string, unknown>>;
}

export async function deleteRecords(ids: string[], namespaceOverride?: string) {
  if (ids.length === 0) {
    return { deleted: 0 };
  }

  const config = getPineconeConfig();
  const apiKey = config.apiKey;
  const namespace = namespaceOverride ?? config.namespace;
  const index = await describePineconeIndex();
  const response = await fetch(`https://${index.host}/vectors/delete`, {
    body: JSON.stringify({
      ids,
      namespace,
    }),
      headers: {
        "Api-Key": apiKey,
        "Content-Type": "application/json",
        "X-Pinecone-API-Version": pineconeApiVersion,
      },
      method: "POST",
  });

  if (!response.ok) {
    throw new Error(`Pinecone delete ${response.status}: ${await response.text()}`);
  }

  const text = await response.text();

  if (!text) {
    return { deleted: ids.length };
  }

  return JSON.parse(text) as unknown;
}
