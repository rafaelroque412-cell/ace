import { NextResponse } from "next/server";
import { buildStoragePath, normalizeDocumentType } from "@/lib/documents";
import {
  type DocumentRecord,
  getSupabaseServerConfig,
  supabaseRest,
  uploadPdfToStorage,
} from "@/lib/supabase-server";
import { processPdfForSearch } from "@/lib/pdf-processing";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const maxPdfSize = 50 * 1024 * 1024;

export async function GET() {
  try {
    getSupabaseServerConfig();

    const documents = await supabaseRest<DocumentRecord[]>(
      "documents?select=id,title,file_name,file_size,mime_type,storage_bucket,storage_path,document_type,source_entity,status,error_message,metadata,created_at,updated_at&order=created_at.desc&limit=30",
    );

    return NextResponse.json({ documents });
  } catch (error) {
    return NextResponse.json(
      {
        documents: [],
        error: error instanceof Error ? error.message : "No se pudieron listar documentos",
        setupRequired: true,
      },
      { status: 503 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Debes adjuntar un archivo PDF" }, { status: 400 });
    }

    if (file.type !== "application/pdf") {
      return NextResponse.json({ error: "Solo se permiten archivos PDF" }, { status: 400 });
    }

    if (file.size > maxPdfSize) {
      return NextResponse.json(
        { error: "El PDF supera el limite de 50 MB" },
        { status: 400 },
      );
    }

    const { storageBucket } = getSupabaseServerConfig();
    const storagePath = buildStoragePath(file.name);
    const titleValue = formData.get("title");
    const sourceEntityValue = formData.get("sourceEntity");
    const title =
      typeof titleValue === "string" && titleValue.trim() ? titleValue.trim() : file.name;
    const sourceEntity =
      typeof sourceEntityValue === "string" && sourceEntityValue.trim()
        ? sourceEntityValue.trim()
        : null;
    const documentType = normalizeDocumentType(formData.get("documentType"));

    await uploadPdfToStorage(storagePath, file);

    const inserted = await supabaseRest<DocumentRecord[]>("documents", {
      body: JSON.stringify({
        document_type: documentType,
        file_name: file.name,
        file_size: file.size,
        metadata: {
          originalLastModified: file.lastModified || null,
          uploadSource: "web",
        },
        mime_type: file.type,
        source_entity: sourceEntity,
        status: "uploaded",
        storage_bucket: storageBucket,
        storage_path: storagePath,
        title,
      }),
      method: "POST",
    });

    const indexing = await processPdfForSearch(inserted[0], file);

    return NextResponse.json(
      {
        document: indexing.document,
        indexing: {
          chunkCount: indexing.chunkCount,
          pageCount: indexing.pageCount,
          textLength: indexing.textLength,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "No se pudo subir el documento",
      },
      { status: 500 },
    );
  }
}
