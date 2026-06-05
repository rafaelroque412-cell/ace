import { PROCESS_TYPES, documentTypeLabel, processTypeLabel } from "@/lib/legal-taxonomy";
import { supabaseRest } from "@/lib/supabase-server";

type DocumentRow = {
  id: string;
  title: string;
  document_type: string;
  process_type: string | null;
  status: string;
  metadata: Record<string, unknown>;
};

type ChunkRow = {
  document_id: string;
  page_start: number | null;
  page_end: number | null;
  pinecone_vector_id: string | null;
  metadata: Record<string, unknown>;
};

const relevantDocumentTypes = ["ley", "reglamento", "directiva", "opinion", "bases_integradas"] as const;

function chunkArticle(chunk: ChunkRow) {
  const value = chunk.metadata.article ?? chunk.metadata.articulo;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isPineconeVerified(document: DocumentRow) {
  const pinecone = document.metadata?.pinecone;
  if (!pinecone || typeof pinecone !== "object") {
    return false;
  }
  const verification = (pinecone as Record<string, unknown>).verification;
  return Boolean(
    verification &&
      typeof verification === "object" &&
      (verification as Record<string, unknown>).verified === true,
  );
}

function documentAppliesToProcess(document: DocumentRow, processType: string) {
  return document.process_type === processType || document.process_type === "todos" || !document.process_type;
}

export async function getCorpusQualityByProcedure() {
  const [documents, chunks] = await Promise.all([
    supabaseRest<DocumentRow[]>(
      "documents?select=id,title,document_type,process_type,status,metadata&limit=2000",
    ),
    supabaseRest<ChunkRow[]>(
      "document_chunks?select=document_id,page_start,page_end,pinecone_vector_id,metadata&limit=10000",
    ),
  ]);
  const chunksByDocument = new Map<string, ChunkRow[]>();

  for (const chunk of chunks) {
    chunksByDocument.set(chunk.document_id, [...(chunksByDocument.get(chunk.document_id) ?? []), chunk]);
  }

  const procedures = PROCESS_TYPES.filter((item) => item.value !== "todos").map((procedure) => {
    const typeCoverage = relevantDocumentTypes.map((documentType) => {
      const docs = documents.filter(
        (document) =>
          document.document_type === documentType &&
          document.status === "indexed" &&
          documentAppliesToProcess(document, procedure.value),
      );
      const docChunks = docs.flatMap((document) => chunksByDocument.get(document.id) ?? []);
      const chunksWithPage = docChunks.filter((chunk) => chunk.page_start || chunk.page_end).length;
      const chunksWithArticle = docChunks.filter(chunkArticle).length;
      const chunksWithVector = docChunks.filter((chunk) => chunk.pinecone_vector_id).length;
      const ready =
        docs.length > 0 &&
        docChunks.length > 0 &&
        chunksWithVector / docChunks.length >= 0.9 &&
        (documentType === "bases_integradas" || chunksWithPage > 0);

      return {
        chunks: docChunks.length,
        chunksWithArticle,
        chunksWithPage,
        chunksWithVector,
        documentType,
        documentTypeLabel: documentTypeLabel(documentType),
        documents: docs.length,
        pineconeVerified: docs.filter(isPineconeVerified).length,
        ready,
      };
    });
    const normativeReady = ["ley", "reglamento", "directiva"].every((type) =>
      typeCoverage.some((item) => item.documentType === type && item.ready),
    );
    const operationalReady = typeCoverage.some((item) => item.documentType === "bases_integradas" && item.ready);
    const score = Math.round((typeCoverage.filter((item) => item.ready).length / typeCoverage.length) * 100);
    const missingDocumentTypes = typeCoverage
      .filter((item) => !item.ready)
      .map((item) => ({
        documentType: item.documentType,
        documentTypeLabel: item.documentTypeLabel,
        reason:
          item.documents === 0
            ? "No hay documento indexado para este procedimiento."
            : item.chunks === 0
              ? "El documento existe, pero no tiene fragmentos procesados."
              : item.chunksWithVector / Math.max(item.chunks, 1) < 0.9
                ? "Faltan vectores en Pinecone."
                : item.documentType !== "bases_integradas" && item.chunksWithPage === 0
                  ? "Faltan paginas identificadas para citas exactas."
                  : "Requiere revision de indexacion.",
      }));

    return {
      missingDocumentTypes,
      operationalReady,
      processType: procedure.value,
      processTypeLabel: processTypeLabel(procedure.value) ?? procedure.label,
      score,
      status: normativeReady ? "listo" : operationalReady ? "operativo_sin_norma_completa" : "incompleto",
      typeCoverage,
    };
  });

  return {
    checkedAt: new Date().toISOString(),
    procedures,
  };
}
