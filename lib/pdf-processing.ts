import pdfParse from "pdf-parse/lib/pdf-parse";
import { toFile } from "openai";
import { getOpenAIClient, pdfOcrModel } from "./openai-server";
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
const minExtractedTextLength = 120;
const unusableOcrPatterns = [
  "no puedo procesar",
  "no puedo extraer",
  "no puedo transcribir",
  "puedo ayudarte con un resumen",
  "i can't process",
  "i cannot process",
];

type ExtractedPdfText = {
  extractionMethod: "pdf-text" | "openai-ocr";
  ocrPartial: boolean;
  pageCount: number;
  text: string;
};

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

function getOcrMaxPages() {
  const value = Number.parseInt(process.env.OPENAI_OCR_MAX_PAGES ?? "25", 10);
  return Number.isFinite(value) && value > 0 ? value : 25;
}

function isOpenAiPdfOcrEnabled() {
  return process.env.OPENAI_PDF_OCR_ENABLED === "true";
}

function isUsableExtractedText(text: string) {
  const normalized = text.toLowerCase();
  return (
    text.length >= minExtractedTextLength &&
    !unusableOcrPatterns.some((pattern) => normalized.includes(pattern))
  );
}

async function extractPdfTextWithOpenAI(file: File, pageCount: number): Promise<ExtractedPdfText> {
  const openai = getOpenAIClient();
  const maxPages = getOcrMaxPages();
  const pagesToExtract = Math.min(pageCount || maxPages, maxPages);
  const buffer = Buffer.from(await file.arrayBuffer());
  const uploaded = await openai.files.create({
    file: await toFile(buffer, file.name, { type: "application/pdf" }),
    purpose: "user_data",
  });

  try {
    const response = await openai.responses.create({
      input: [
        {
          content: [
            {
              file_id: uploaded.id,
              type: "input_file",
            },
            {
              text: `Extrae texto OCR legible de este PDF escaneado para indexacion juridica.

Alcance:
- Procesa desde la pagina 1 hasta la pagina ${pagesToExtract}.
- Conserva titulos, articulos, numerales, disposiciones, fechas y nombres de entidades.
- No resumas. Devuelve texto plano.
- Si una pagina no tiene texto legible, escribe "[pagina no legible]".
- Separa paginas con "=== PAGINA N ===".`,
              type: "input_text",
            },
          ],
          role: "user",
        },
      ],
      max_output_tokens: 12000,
      model: pdfOcrModel,
      temperature: 0,
    });

    return {
      extractionMethod: "openai-ocr",
      ocrPartial: Boolean(pageCount && pageCount > pagesToExtract),
      pageCount,
      text: normalizeText(response.output_text),
    };
  } finally {
    await openai.files.delete(uploaded.id).catch(() => undefined);
  }
}

async function extractPdfText(file: File): Promise<ExtractedPdfText> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const pdf = await pdfParse(buffer);
  const text = normalizeText(pdf.text);

  if (text.length >= minExtractedTextLength) {
    return {
      extractionMethod: "pdf-text",
      ocrPartial: false,
      pageCount: pdf.numpages,
      text,
    };
  }

  if (!isOpenAiPdfOcrEnabled()) {
    throw new Error(
      "El PDF no tiene texto seleccionable. Convierte el archivo con OCR o sube una version con texto antes de indexarlo.",
    );
  }

  return extractPdfTextWithOpenAI(file, pdf.numpages);
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
    const extracted = await extractPdfText(file);
    const text = extracted.text;

    if (!isUsableExtractedText(text)) {
      throw new Error(
        extracted.extractionMethod === "openai-ocr"
          ? "El OCR experimental no devolvio texto juridico util. Convierte el PDF con OCR antes de subirlo."
          : "No se pudo extraer texto suficiente del PDF. El archivo parece escaneado o no legible.",
      );
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
        extractionMethod: extracted.extractionMethod,
        ocrPartial: extracted.ocrPartial,
        pageCount: extracted.pageCount,
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
          extractionMethod: extracted.extractionMethod,
          ocrMaxPages: getOcrMaxPages(),
          ocrPartial: extracted.ocrPartial,
          pageCount: extracted.pageCount,
          textLength: text.length,
        },
        status: "indexed",
      }),
      method: "PATCH",
    });

    return {
      chunkCount: chunks.length,
      document: updated,
      pageCount: extracted.pageCount,
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
