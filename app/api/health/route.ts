import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    ok: true,
    service: "ace-ia-juridica",
    modules: ["documents", "chat", "search", "contracts"],
  });
}
