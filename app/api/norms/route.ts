import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { supabaseRest } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type NormRow = {
  id: string;
  title: string;
  document_type: string;
  source_entity: string | null;
  process_type: string | null;
  status: string;
  metadata: Record<string, unknown>;
  created_at: string;
  norma_articulos: Array<{ count: number }>;
};

const normTypes = ["ley", "reglamento", "directiva"];
const jurisprudenceTypes = ["resolucion", "opinion"];

function typeFilter(category: string | null) {
  if (category === "normas") {
    return `&document_type=in.(${normTypes.join(",")})`;
  }

  if (category === "jurisprudencia") {
    return `&document_type=in.(${jurisprudenceTypes.join(",")})`;
  }

  return "";
}

export async function GET(request: Request) {
  try {
    const auth = await requireUser();
    if ("error" in auth) {
      return auth.error;
    }

    const category = new URL(request.url).searchParams.get("category");
    const rows = await supabaseRest<NormRow[]>(
      `documents?select=id,title,document_type,source_entity,process_type,status,metadata,created_at,norma_articulos(count)` +
        `&status=eq.indexed${typeFilter(category)}&order=document_type.asc,created_at.desc&limit=200`,
    );

    const norms = rows.map((row) => {
      const metadata = row.metadata ?? {};
      return {
        id: row.id,
        title: row.title,
        documentType: row.document_type,
        sourceEntity: row.source_entity,
        processType: row.process_type,
        status: row.status,
        articleCount: row.norma_articulos?.[0]?.count ?? 0,
        documentNumber:
          typeof metadata.documentNumber === "string"
            ? metadata.documentNumber
            : typeof metadata.number === "string"
              ? metadata.number
              : null,
        vigencia: typeof metadata.vigencia === "string" ? metadata.vigencia : null,
        topic: typeof metadata.topic === "string" ? metadata.topic : null,
        year: typeof metadata.year === "number" ? metadata.year : null,
        amends: typeof metadata.amends === "string" ? metadata.amends : null,
        createdAt: row.created_at,
      };
    });

    return NextResponse.json({ norms });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "No se pudieron listar las normas",
        norms: [],
      },
      { status: 500 },
    );
  }
}
