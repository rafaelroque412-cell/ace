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
  title: string;
  source_entity?: string;
};

type PineconeSearchHit = {
  _id: string;
  _score: number;
  chunk_id?: string;
  chunk_index?: number;
  document_id?: string;
  document_type?: string;
  source_entity?: string;
  text?: string;
  title?: string;
};

const pineconeApiVersion = "2026-04";
const defaultNamespace = "legal-documents";

export function getPineconeConfig() {
  const apiKey = process.env.PINECONE_API_KEY;
  const indexName = process.env.PINECONE_INDEX_NAME;
  const namespace = process.env.PINECONE_NAMESPACE ?? defaultNamespace;

  if (!apiKey || !indexName) {
    throw new Error("Falta PINECONE_API_KEY o PINECONE_INDEX_NAME");
  }

  return { apiKey, indexName, namespace };
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

  const { apiKey, namespace } = getPineconeConfig();
  const index = await describePineconeIndex();
  const textField = Object.values(index.embed?.field_map ?? {})[0] ?? "text";
  const body = records
    .map((record) =>
      JSON.stringify({
        ...record,
        [textField]: record.text,
      }),
    )
    .join("\n");

  const response = await fetch(
    `https://${index.host}/records/namespaces/${encodeURIComponent(namespace)}/upsert`,
    {
      body,
      headers: {
        "Api-Key": apiKey,
        "Content-Type": "application/x-ndjson",
        "X-Pinecone-API-Version": pineconeApiVersion,
      },
      method: "POST",
    },
  );

  if (!response.ok) {
    throw new Error(`Pinecone upsert ${response.status}: ${await response.text()}`);
  }

  const text = await response.text();

  if (!text) {
    return { upserted: records.length };
  }

  return JSON.parse(text) as unknown;
}

export async function searchTextRecords(query: string, topK = 6) {
  const { apiKey, namespace } = getPineconeConfig();
  const index = await describePineconeIndex();
  const response = await fetch(
    `https://${index.host}/records/namespaces/${encodeURIComponent(namespace)}/search`,
    {
      body: JSON.stringify({
        query: {
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
          "document_type",
          "title",
          "source_entity",
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

  return payload.result?.hits ?? [];
}
