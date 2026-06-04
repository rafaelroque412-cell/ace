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

const defaultRerankModel = "bge-reranker-v2-m3";
const maxRerankDocuments = 30;

function getRerankConfig() {
  return {
    enabled: (process.env.PINECONE_RERANK_ENABLED ?? "true") !== "false",
    model: process.env.PINECONE_RERANK_MODEL || defaultRerankModel,
  };
}

type RerankInput = { id: string; text: string };

// Reordena documentos por relevancia con un modelo de reranking dedicado
// (inference API de Pinecone). Devuelve [{ id, score }] ordenado; si falla o
// esta deshabilitado, devuelve null para que el llamador conserve su orden.
export async function rerankWithModel(
  query: string,
  documents: RerankInput[],
  topN?: number,
): Promise<Array<{ id: string; score: number }> | null> {
  const { enabled, model } = getRerankConfig();

  if (!enabled || documents.length === 0) {
    return null;
  }

  const { apiKey } = getPineconeConfig();
  const pool = documents.slice(0, maxRerankDocuments);

  try {
    const response = await fetch("https://api.pinecone.io/rerank", {
      body: JSON.stringify({
        documents: pool.map((document) => ({ text: document.text.slice(0, 4000) })),
        model,
        parameters: { truncate: "END" },
        query: query.slice(0, 4000),
        rank_fields: ["text"],
        return_documents: false,
        top_n: Math.min(topN ?? pool.length, pool.length),
      }),
      headers: {
        Accept: "application/json",
        "Api-Key": apiKey,
        "Content-Type": "application/json",
        "X-Pinecone-API-Version": pineconeApiVersion,
      },
      method: "POST",
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as {
      data?: Array<{ index: number; score: number }>;
    };

    return (payload.data ?? [])
      .filter((hit) => typeof hit.index === "number" && pool[hit.index])
      .map((hit) => ({ id: pool[hit.index].id, score: hit.score }));
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

export async function describePineconeIndex(): Promise<PineconeIndexInfo> {
  const { apiKey, indexName } = getPineconeConfig();
  const response = await fetch(`https://api.pinecone.io/indexes/${indexName}`, {
    headers: {
      "Api-Key": apiKey,
      "X-Pinecone-API-Version": "2025-04",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Pinecone describe index ${response.status}: ${await response.text()}`);
  }

  return (await response.json()) as PineconeIndexInfo;
}

export async function upsertTextRecords(records: PineconeRecord[]) {
  if (records.length === 0) {
    return;
  }

  validatePineconeRecords(records);

  const { apiKey, namespace } = getPineconeConfig();
  const index = await describePineconeIndex();
  const textField = Object.values(index.embed?.field_map ?? {})[0] ?? "text";

  for (let indexStart = 0; indexStart < records.length; indexStart += maxUpsertBatchSize) {
    const batch = records.slice(indexStart, indexStart + maxUpsertBatchSize);
    const body = batch
      .map((record) =>
        JSON.stringify({
          ...record,
          [textField]: record.text,
        }),
      )
      .join("\n");
    let response: Response | null = null;

    for (let attempt = 0; attempt <= maxUpsertRetries; attempt += 1) {
      response = await fetch(`https://${index.host}/records/namespaces/${encodeURIComponent(namespace)}/upsert`, {
        body,
        headers: {
          "Api-Key": apiKey,
          "Content-Type": "application/x-ndjson",
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

  return { batches: Math.ceil(records.length / maxUpsertBatchSize), upserted: records.length };
}

export async function verifyDocumentIndexedInPinecone(input: {
  documentId: string;
  expectedMinRecords: number;
  query: string;
}) {
  const maxAttempts = 5;
  let lastHitCount = 0;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const hits = await searchTextRecords(input.query, Math.min(10, Math.max(1, input.expectedMinRecords)), {
      documentId: input.documentId,
    }).catch(() => []);

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

export async function searchTextRecords(query: string, topK = 6, filters?: SearchFilters) {
  const { apiKey, namespace } = getPineconeConfig();
  const index = await describePineconeIndex();
  const filter = compactFilter(filters);
  const response = await fetch(
    `https://${index.host}/records/namespaces/${encodeURIComponent(namespace)}/search`,
    {
      body: JSON.stringify({
        query: {
          ...(filter ? { filter } : {}),
          inputs: {
            text: query,
          },
          top_k: topK,
        },
        fields: [
          "text",
          "document_id",
          "chunk_id",
          "chunk_index",
          "document_number",
          "document_type",
          "hierarchy_rank",
          "page_start",
          "page_end",
          "process_type",
          "article",
          "section_title",
          "title",
          "source_entity",
          "source_role",
          "status",
          "topic",
          "vigencia",
          "year",
        ],
      }),
      headers: {
        "Api-Key": apiKey,
        "Content-Type": "application/json",
        "X-Pinecone-API-Version": pineconeApiVersion,
      },
      method: "POST",
    },
  );

  if (!response.ok) {
    throw new Error(`Pinecone search ${response.status}: ${await response.text()}`);
  }

  const payload = (await response.json()) as { result?: { hits?: PineconeSearchHit[] } };

  return (payload.result?.hits ?? []).map((hit) => ({
    ...hit,
    ...hit.fields,
  }));
}

export async function deleteRecords(ids: string[]) {
  if (ids.length === 0) {
    return { deleted: 0 };
  }

  const { apiKey, namespace } = getPineconeConfig();
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
