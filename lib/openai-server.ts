import OpenAI from "openai";

export function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("Falta OPENAI_API_KEY");
  }

  return new OpenAI({ apiKey });
}

export const legalAnswerModel = process.env.OPENAI_LEGAL_MODEL ?? "gpt-4.1-mini";
export const pdfOcrModel = process.env.OPENAI_PDF_OCR_MODEL ?? "gpt-4o-mini";
// Embeddings propios (reemplazan el modelo integrado de Pinecone para no depender
// de su cuota mensual). text-embedding-3-small = 1536 dimensiones.
export const embeddingModel = process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small";
export const embeddingDimensions = Number.parseInt(process.env.OPENAI_EMBEDDING_DIMENSIONS ?? "1536", 10);
// Reranking con LLM (reemplaza el reranker integrado de Pinecone, que tiene tope
// mensual). Modelo pequeño y rapido; corre con la misma cuota de OpenAI.
export const rerankModel = process.env.OPENAI_RERANK_MODEL ?? "gpt-4o-mini";
