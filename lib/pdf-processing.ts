import pdfParse from "pdf-parse/lib/pdf-parse";
import { type DocumentRecord, supabaseRest } from "./supabase-server";
import { upsertTextRecords } from "./pinecone";

type ChunkInsert = {
  document_id: string;
  chunk_index: number;
  content: string;
  pinecone_vector_id: string;
  metadata: Record<string, unknown>;
};

const chunkSize = 2600;
const chunkOverlap = 350;
const maxChunksPerDocument = 120;

function normalizeText(text: string) {
  return text
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function chunkText(text: string) {
  const chunks: string[] = [];
  let cursor = 0;

  while (cursor < text.length && chunks.length < maxChunksPerDocument) {
    const end = Math.min(cursor + chunkSize, text.length);
    const rawChunk = text.slice(cursor, end).trim();

    if (rawChunk.length > 80) {
      chunks.push(rawChunk);
    }

    if (end === text.length) {
      break;
    }

    cursor = Math.max(end - chunkOverlap, cursor + 1);
  }

  return chunks;
}

export async function processPdfForSearch(document: DocumentRecord, file: File) {
  await supabaseRest(`documents?id=eq.${document.id}`, {
    body: JSON.stringify({
      error_message: null,
      status: "processing",
    }),
    method: "PATCH",
  });

  try {
    const pdf = await pdfParse(Buffer.from(await file.arrayBuffer()));
    const text = normalizeText(pdf.text);

    if (!text) {
      throw new Error("No se pudo extraer texto del PDF");
    }

    const chunks = chunkText(text);

    if (chunks.length === 0) {
      throw new Error("El PDF no contiene suficiente texto para indexar");
    }

    const chunkRows: ChunkInsert[] = chunks.map((content, index) => ({
      chunk_index: index,
      content,
      document_id: document.id,
      metadata: {
        pageCount: pdf.numpages,
      },
      pinecone_vector_id: `${document.id}::${index}`,
    }));

    const insertedChunks = await supabaseRest<
      Array<ChunkInsert & { id: string; pinecone_vector_id: string }>
    >("document_chunks", {
      body: JSON.stringify(chunkRows),
      method: "POST",
    });

    await upsertTextRecords(
      insertedChunks.map((chunk) => ({
        _id: chunk.pinecone_vector_id,
        chunk_id: chunk.id,
        chunk_index: chunk.chunk_index,
        document_id: document.id,
        document_type: document.document_type,
        source_entity: document.source_entity ?? undefined,
        text: chunk.content,
        title: document.title,
      })),
    );

    const [updated] = await supabaseRest<DocumentRecord[]>(`documents?id=eq.${document.id}`, {
      body: JSON.stringify({
        metadata: {
          ...document.metadata,
          chunkCount: chunks.length,
          pageCount: pdf.numpages,
          textLength: text.length,
        },
        status: "indexed",
      }),
      method: "PATCH",
    });

    return {
      chunkCount: chunks.length,
      document: updated,
      pageCount: pdf.numpages,
      textLength: text.length,
    };
  } catch (error) {
    await supabaseRest(`documents?id=eq.${document.id}`, {
      body: JSON.stringify({
        error_message: error instanceof Error ? error.message : "Error procesando PDF",
        status: "error",
      }),
      method: "PATCH",
    });

    throw error;
  }
}
