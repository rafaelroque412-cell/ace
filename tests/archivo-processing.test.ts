import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ExpedienteArchivo } from "../lib/expedientes-archivo";
const mocks = vi.hoisted(() => ({ rest: vi.fn(), extract: vi.fn(), ai: vi.fn(), upsert: vi.fn(), verify: vi.fn(), remove: vi.fn() }));
vi.mock("../lib/supabase-server", () => ({ supabaseRest: mocks.rest, writeAuditLog: async () => undefined }));
vi.mock("../lib/openai-server", () => ({ legalAnswerModel: "test", getOpenAIClient: () => ({ responses: { create: mocks.ai } }) }));
vi.mock("../lib/pdf-processing", () => ({ extractPdfText: mocks.extract, chunkPages: () => [{ index: 0, content: "contenido ".repeat(40), pageStart: 1, pageEnd: 1 }] }));
vi.mock("../lib/pinecone", () => ({ upsertTextRecords: mocks.upsert, verifyDocumentIndexedInPinecone: mocks.verify, deleteRecords: mocks.remove }));
import { extractExpedienteInventory, processExpedienteDocument } from "../lib/expedientes-archivo-processing";

const expediente = { id: "00000000-0000-4000-8000-000000000001", expediente_id: "00000000-0000-4000-8000-000000000002", title: "Prueba", metadata: {}, status: "indexed", updated_at: "2026-09-18T00:00:00Z" } as ExpedienteArchivo;
const file = new File(["%PDF-prueba"], "prueba.pdf", { type: "application/pdf" });
beforeEach(() => {
  vi.resetAllMocks();
  mocks.rest.mockImplementation(async (path: string) => path === "rpc/archivo_publicar_indice" ? { oldVectorIds: ["old-vector"] } : []);
  mocks.extract.mockResolvedValue({ text: "contenido ".repeat(40), pages: [{ pageNumber: 1, text: "contenido" }], pageCount: 1, ocrPartial: false, extractionMethod: "pdf-text" });
  mocks.ai.mockResolvedValue({ output_text: '{"resumen":"Resumen"}' });
  mocks.upsert.mockResolvedValue({ upserted: 1 });
  mocks.verify.mockResolvedValue({ verified: true });
  mocks.remove.mockResolvedValue(undefined);
});
describe("autocompletado honesto", () => {
  it("propaga el fallo de IA sin perder datos básicos", async () => {
    mocks.ai.mockRejectedValue(new Error("provider unavailable"));
    const result = await extractExpedienteInventory(file);
    expect(result.warnings?.join(" ")).toContain("IA no pudo");
    expect(result.extractionMethod).not.toBe("ai");
    expect(result.nroFolios).toBe(1);
  });
  it("informa límites de páginas y texto", async () => {
    mocks.extract.mockResolvedValue({ text: "x".repeat(15000), pages: [{ pageNumber: 1, text: "texto" }], pageCount: 30, ocrPartial: true, extractionMethod: "pdf-text" });
    const result = await extractExpedienteInventory(file);
    expect(result.ocrPartial).toBe(true);
    expect(result.analysisPartial).toBe(true);
    expect(result.warnings).toHaveLength(2);
  });
});
describe("reindexación segura", () => {
  it("conserva el índice anterior cuando falla el OCR", async () => {
    mocks.extract.mockRejectedValue(new Error("worker missing"));
    await expect(processExpedienteDocument(expediente, file)).rejects.toThrow();
    expect(mocks.rest.mock.calls.some(([, init]) => init?.method === "DELETE")).toBe(false);
    expect(mocks.rest.mock.calls.some(([path]) => path === "rpc/archivo_publicar_indice")).toBe(false);
    const last = mocks.rest.mock.calls.at(-1)!;
    expect(JSON.parse(last[1].body).status).toBe("indexed");
    expect(last[0]).toContain("updated_at=eq.");
  });
  it("publica antes de eliminar vectores anteriores y verifica la generación nueva", async () => {
    await processExpedienteDocument(expediente, file);
    const record = mocks.upsert.mock.calls[0][0][0];
    expect(record._id).toContain(record.index_generation);
    expect(mocks.verify.mock.calls[0][0].indexGeneration).toBe(record.index_generation);
    const index = mocks.rest.mock.calls.findIndex(([path]) => path === "rpc/archivo_publicar_indice");
    expect(mocks.rest.mock.invocationCallOrder[index]).toBeLessThan(mocks.remove.mock.invocationCallOrder[0]);
    expect(mocks.remove).toHaveBeenCalledWith(["old-vector"], expect.any(String));
  });
  it("no elimina vectores nuevos cuando el resultado del commit es incierto", async () => {
    mocks.rest.mockImplementation(async (path: string) => {
      if (path === "rpc/archivo_publicar_indice") throw new Error("connection reset after commit");
      return [];
    });
    await expect(processExpedienteDocument(expediente, file)).rejects.toThrow();
    expect(mocks.remove).not.toHaveBeenCalled();
  });
});
