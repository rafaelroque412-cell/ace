import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    documents: [],
    nextStep:
      "Conectar Supabase Storage para PDFs, PostgreSQL para metadata y Pinecone para fragmentos indexados.",
  });
}
