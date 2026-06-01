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
