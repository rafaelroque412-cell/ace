import { NextResponse } from "next/server";
import { deleteRecords } from "@/lib/pinecone";
import {
  type DocumentRecord,
  deleteStorageObjects,
  getSupabaseServerConfig,
  supabaseRest,
} from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type DocumentChunkVector = {
  pinecone_vector_id: string | null;
};

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    getSupabaseServerConfig();

    const { id } = await context.params;

    if (!id) {
      return NextResponse.json({ error: "Falta id del documento" }, { status: 400 });
    }

    const documents = await supabaseRest<DocumentRecord[]>(
      `documents?id=eq.${id}&select=id,title,storage_bucket,storage_path`,
    );

    const document = documents[0];

    if (!document) {
      return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });
    }

    const chunks = await supabaseRest<DocumentChunkVector[]>(
      `document_chunks?document_id=eq.${id}&select=pinecone_vector_id`,
    );
    const vectorIds = chunks
      .map((chunk) => chunk.pinecone_vector_id)
      .filter((vectorId): vectorId is string => Boolean(vectorId));

    await deleteRecords(vectorIds);
    await deleteStorageObjects(document.storage_bucket, [document.storage_path]);
    await supabaseRest(`documents?id=eq.${id}`, {
      method: "DELETE",
    });

    return NextResponse.json({
      deleted: {
        chunks: chunks.length,
        documentId: id,
        storagePath: document.storage_path,
        vectors: vectorIds.length,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "No se pudo eliminar el documento",
      },
      { status: 500 },
    );
  }
}
