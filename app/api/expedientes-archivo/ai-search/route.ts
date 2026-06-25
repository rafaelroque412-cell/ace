import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { type ExpedienteArchivo } from "@/lib/expedientes-archivo";
import { getOpenAIClient, legalAnswerModel } from "@/lib/openai-server";
import { getSupabaseServerConfig, supabaseRest, writeAuditLog } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const schema = z.object({
  query: z.string().trim().min(3).max(500),
  limit: z.number().int().min(1).max(50).optional(),
});

const SELECT =
  "id,sgd_expediente,title,anio,asunto,materia,oficina,tipo_almacenamiento,nro_estante,nro_piso,nro_local,status,created_at";

type ExpedienteResumen = Pick<
  ExpedienteArchivo,
  "id" | "title" | "anio" | "oficina" | "status" | "nro_estante"
> & { matches: string };

// Interpreta una consulta en lenguaje natural del usuario y devuelve un
// subconjunto filtrado de los expedientes del archivo. La IA decide cuáles
// campos matchear (título, oficina, materia, año) basándose en la
// intención del usuario.
export async function POST(request: Request) {
  try {
    const auth = await requireUser();
    if ("error" in auth) {
      return auth.error;
    }
    getSupabaseServerConfig();

    const payload = schema.safeParse(await request.json());
    if (!payload.success) {
      return NextResponse.json({ error: "Solicitud inválida", details: payload.error.flatten() }, { status: 400 });
    }

    const limit = payload.data.limit ?? 20;
    const all = await supabaseRest<ExpedienteArchivo[]>(
      `expedientes_archivo?select=${SELECT}&order=created_at.desc&limit=200`,
    );

    if (all.length === 0) {
      return NextResponse.json({ matches: [], reasoning: "No hay expedientes en el archivo." });
    }

    // Listado compacto para enviar a la IA
    const compact = all.slice(0, 200).map((e) => ({
      id: e.id,
      title: e.title,
      anio: e.anio,
      oficina: e.oficina,
      materia: e.materia,
      asunto: e.asunto,
    }));

    const openai = getOpenAIClient();
    const completion = await openai.chat.completions.create({
      model: legalAnswerModel,
      temperature: 0,
      max_tokens: 1200,
      messages: [
        {
          role: "system",
          content: `Eres un asistente de búsqueda de expedientes archivados.
El usuario hace una consulta en lenguaje natural. Devuelve SOLO JSON válido con este formato:
{
  "matches": [{"id": "uuid-del-expediente", "razon": "por qué coincide con la búsqueda"}],
  "reasoning": "explicación breve de cómo interpretaste la búsqueda"
}

Reglas:
- Devuelve como máximo ${limit} resultados
- Si la búsqueda menciona un año, filtra por anio
- Si menciona una oficina o área, filtra por oficina (case-insensitive, partial match)
- Si menciona un tema o materia (contratación, personal, etc.), filtra por materia o asunto
- Si la búsqueda es ambigua, incluye los más probables y explica por qué
- Si no hay coincidencias claras, devuelve matches: [] y explica por qué
- NO inventes IDs; solo usa los del listado`,
        },
        {
          role: "user",
          content: `Consulta: "${payload.data.query}"

Expedientes disponibles:
${JSON.stringify(compact, null, 0)}`,
        },
      ],
    });

    const text = completion.choices[0]?.message?.content ?? "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const parsed: { matches: { id: string; razon: string }[]; reasoning: string } = jsonMatch
      ? JSON.parse(jsonMatch[0])
      : { matches: [], reasoning: "No pude interpretar la búsqueda." };

    const idToExp = new Map(all.map((e) => [e.id, e]));
    const matches: ExpedienteResumen[] = parsed.matches
      .map((m) => {
        const exp = idToExp.get(m.id);
        if (!exp) return null;
        return {
          id: exp.id,
          title: exp.title,
          anio: exp.anio,
          oficina: exp.oficina,
          status: exp.status,
          nro_estante: exp.nro_estante,
          matches: m.razon,
        };
      })
      .filter((m): m is ExpedienteResumen => m !== null)
      .slice(0, limit);

    await writeAuditLog({
      action: "expedientes.aiSearch",
      actorReference: auth.user.email ?? auth.user.id,
      details: { query: payload.data.query, matches: matches.length },
      entityType: "expediente_search",
      module: "expedientes-archivo",
    });

    return NextResponse.json({ matches, reasoning: parsed.reasoning });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo ejecutar la búsqueda con IA" },
      { status: 500 },
    );
  }
}
