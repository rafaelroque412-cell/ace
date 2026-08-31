// ============================================================================
// "Mi Yo" — el asistente único de ACE.
// ----------------------------------------------------------------------------
// Antes de esto, ACE tenía varios copilotos sueltos: el chat legal
// (lib/legal-chat.ts), el copiloto de necesidad (lib/necesidad-copiloto.ts),
// el copiloto de expediente en ejecución (lib/expediente-copiloto.ts) y
// "Preguntar a la IA" del archivo (lib/expedientes-archivo-search.ts). Cada
// uno con su propio prompt, sin memoria entre sesiones y sin saber qué pasaba
// en los demás módulos.
//
// "Mi Yo" no reemplaza esa lógica: la reutiliza. Este archivo es un
// ORQUESTADOR liviano — clasifica la intención del mensaje y despacha a la
// función ya existente que sabe resolverla, o responde directo si es una
// pregunta general (saludo, ayuda, orientación). Lo nuevo es la MEMORIA
// persistente (asistente_conversaciones/asistente_mensajes, ver
// docs/supabase/asistente-mi-yo.sql) y un único punto de entrada para
// cualquier módulo.
//
// El copiloto de Necesidad (necesidad-copiloto.ts) y el de Expediente
// (expediente-copiloto.ts) SÍ se enchufan aquí como la herramienta "registro",
// pero solo cuando el widget manda con qué registro está el usuario (está
// viendo /necesidades/{id} o /expedientes/{id}) — sin eso no hay forma de
// saber a qué necesidad o expediente se refiere una pregunta suelta. A
// diferencia del copiloto embebido en esas páginas, aquí NO se dispone del
// estado vivo del formulario (campos aún sin guardar): se reconstruye el
// contexto desde lo que ya está persistido en la fila de la BD. Ver
// responderRegistroNecesidad/responderRegistroExpediente más abajo.
// ============================================================================

import { type SessionUser } from "@/lib/auth";
import { getArchivoScopeLevel, getOfficeFilter } from "@/lib/auth";
import { chatExpediente, resumenEstadoExpediente } from "@/lib/expediente-copiloto";
import { answerExpedienteQuestion, type ExpedienteSearchResult } from "@/lib/expedientes-archivo-search";
import { answerLegalQuestion, type LegalSource } from "@/lib/legal-chat";
import { streamCopiloto } from "@/lib/necesidad-copiloto";
import { getOpenAIClient, legalAnswerModel } from "@/lib/openai-server";
import { roleHasCapability } from "@/lib/permisos-contratacion";
import type { HitosMap } from "@/lib/procurement-fases";
import { supabaseRest, supabaseUserRest, writeAuditLog } from "@/lib/supabase-server";

export type MiYoIntent = "legal" | "archivo" | "actividad" | "registro" | "general";

// Con qué registro está el usuario en pantalla (lo manda el widget según la
// ruta actual — ver mi-yo-widget.tsx). Sin esto, "registro" no es una
// categoría válida de clasificación: no hay a qué necesidad/expediente
// referirse.
export type MiYoContexto = { tipo: "necesidad" | "expediente"; id: string };

export type MiYoSource = {
  title: string;
  citation: string;
  ubicacionResumen?: string;
};

export type MiYoResult = {
  answer: string;
  intent: MiYoIntent;
  conversationId: string;
  sources: MiYoSource[];
};

type ConversacionRow = { id: string };
type MensajeRow = { role: "user" | "assistant"; content: string };

const NUCLEO_MI_YO = [
  'Eres "Mi Yo", el asistente personal del sistema ACE (contratación pública peruana, Ley N.° 32069 y su Reglamento).',
  "Acompañas al usuario en todos los módulos: Necesidades, Expedientes/Contratos, el Archivo documental y la normativa.",
  "Hablas en español, cercano pero profesional, sin rodeos. Si no sabes algo o no tienes el dato, dilo — nunca inventes cifras, artículos, fechas ni datos de expedientes.",
  "Puedes: saludar, explicar qué es ACE y cómo usarlo, orientar sobre qué módulo conviene para cada tarea, y conversar sobre el trabajo del usuario en general.",
  "No debes: inventar una respuesta normativa específica (artículos, plazos, montos) tú mismo. Si te preguntan algo así, dilo con claridad e invita a reformular para buscarlo en la normativa indexada.",
].join(" ");

// ── Clasificación de intención ───────────────────────────────────────────────

type Clasificacion = { intent: MiYoIntent; queryInterna: string };

const INTENTS_SIN_CONTEXTO: MiYoIntent[] = ["legal", "archivo", "actividad", "general"];
const INTENTS_CON_CONTEXTO: MiYoIntent[] = [...INTENTS_SIN_CONTEXTO, "registro"];

function historialParaPrompt(mensajes: MensajeRow[]): string {
  if (mensajes.length === 0) return "(sin mensajes previos)";
  return mensajes
    .slice(-6)
    .map((m) => `${m.role === "user" ? "Usuario" : "Mi Yo"}: ${m.content.slice(0, 300)}`)
    .join("\n");
}

// Clasifica el mensaje en una de las categorías y, si hace falta, reescribe
// la pregunta como una consulta autónoma (útil cuando el usuario responde con
// algo corto tipo "¿y en el 2023?" que solo tiene sentido con el historial).
// Nunca lanza: si el modelo falla o responde algo que no se puede parsear,
// cae a "general" con el mensaje tal cual (un fallo de clasificación no debe
// tumbar la conversación).
//
// "registro" solo se ofrece como categoría cuando hay `contexto` (el usuario
// está viendo una necesidad o un expediente): sin eso, "esta necesidad" no
// se refiere a nada y clasificar ahí sería inventar un registro.
async function clasificarIntencion(
  mensaje: string,
  historial: MensajeRow[],
  contexto?: MiYoContexto,
): Promise<Clasificacion> {
  try {
    const openai = getOpenAIClient();
    const response = await openai.responses.create({
      model: legalAnswerModel,
      instructions: [
        "Clasificas mensajes de un asistente llamado \"Mi Yo\" dentro de ACE (sistema de contratación pública peruana).",
        "Categorías EXACTAS (elige una sola):",
        "- legal: pregunta sobre normativa de contratación pública (Ley 32069, su Reglamento, directivas, plazos, procedimientos, artículos) SIN referirse al registro abierto.",
        "- archivo: pregunta sobre expedientes/documentos ARCHIVADOS de la entidad (buscar un documento, saber dónde está, de qué trata, quién lo subió) — es la biblioteca documental, no un expediente de contratación en curso.",
        "- actividad: pregunta sobre lo que el propio usuario hizo en el sistema (\"qué hice hoy\", \"en qué estoy trabajando\", \"mis últimas acciones\").",
        contexto
          ? `- registro: pregunta sobre EL ${contexto.tipo === "necesidad" ? "REQUERIMIENTO/NECESIDAD" : "EXPEDIENTE DE CONTRATACIÓN"} que el usuario tiene abierto ahora mismo en pantalla ("esta necesidad", "este expediente", "qué le falta", "revisa esto", o cualquier pregunta sin sujeto explícito que tenga sentido sobre el registro actual).`
          : "",
        "- general: saludo, agradecimiento, pregunta sobre cómo usar ACE, o cualquier cosa que no encaje arriba.",
        `Responde SOLO un objeto JSON: {"intent": "${(contexto ? INTENTS_CON_CONTEXTO : INTENTS_SIN_CONTEXTO).join("|")}", "queryInterna": "..."}.`,
        "\"queryInterna\" es el mensaje reescrito como pregunta autónoma (usa el historial si el mensaje depende de él); si ya es autónomo, cópialo tal cual.",
      ]
        .filter(Boolean)
        .join("\n"),
      input: `Historial reciente:\n${historialParaPrompt(historial)}\n\nMensaje nuevo del usuario: ${mensaje}`,
      temperature: 0,
      max_output_tokens: 200,
    });
    // Sin `response_format`: el tipo de la Responses API real de OpenAI no lo
    // admite (y el shim de Gemini/Z.ai tampoco lo necesita) — se pide JSON por
    // instrucción y se extrae el primer objeto `{...}` de la salida, mismo
    // patrón que ya usa necesidad-copiloto.ts (parseJsonObjeto).
    const texto = (response.output_text ?? "").replace(/```json\s*/gi, "").replace(/```/g, "").trim();
    const ini = texto.indexOf("{");
    const fin = texto.lastIndexOf("}");
    const raw = ini !== -1 && fin > ini ? (JSON.parse(texto.slice(ini, fin + 1)) as { intent?: unknown; queryInterna?: unknown }) : {};
    const validos = contexto ? INTENTS_CON_CONTEXTO : INTENTS_SIN_CONTEXTO;
    const intent = validos.includes(raw.intent as MiYoIntent) ? (raw.intent as MiYoIntent) : "general";
    const queryInterna = typeof raw.queryInterna === "string" && raw.queryInterna.trim() ? raw.queryInterna.trim() : mensaje;
    return { intent, queryInterna };
  } catch {
    return { intent: "general", queryInterna: mensaje };
  }
}

// ── "Actividad": resumen determinista desde audit_logs (sin LLM) ───────────
// audit_logs no tiene RLS abierta al token del usuario (igual que ya
// documentan notificaciones/timeline de procesos), así que se consulta con
// service-role, pero el filtro por `actor_reference` ya viene fijado al
// usuario autenticado — nunca es un valor que llegue del cliente.

type AuditRow = { action: string; details: Record<string, unknown> | null; created_at: string };

const ETIQUETAS_ACCION: Record<string, string> = {
  "necesidad.create": "creaste una necesidad",
  "necesidad.update": "actualizaste una necesidad",
  "necesidad.derivar": "derivaste una necesidad",
  "necesidad.admisibilidad": "evaluaste la admisibilidad de una necesidad",
  "necesidad.observacion_campo": "observaste un campo de una necesidad",
  "expedientes.upload": "subiste un documento al archivo",
  "expedientes.chat": "le preguntaste algo a la biblioteca de expedientes",
  "expedientes.search": "buscaste en el archivo de expedientes",
  "expedientes.extract": "extrajiste datos de un PDF con IA",
  "respuesta.generate": "generaste una respuesta con IA",
  "contratos.sie.crear": "creaste un contrato (SIE)",
  "contratos.sie.actualizar": "actualizaste un contrato (SIE)",
  "contratos.cp.crear": "creaste un contrato (procedimiento clásico)",
  "process.create": "creaste un proceso de selección",
  "fase1.cronograma_listo": "completaste el cronograma de la Fase 1",
  "chat.message": "consultaste al chat legal",
};

function etiquetaAccion(action: string): string {
  return ETIQUETAS_ACCION[action] ?? `hiciste "${action.replace(/\./g, " › ")}"`;
}

function formatearFecha(iso: string): string {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return "";
  return fecha.toLocaleDateString("es-PE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

// Pura y exportada para poder probarla sin red (tests/mi-yo.test.ts).
export function formatearResumenActividad(rows: AuditRow[]): string[] {
  return rows.map((r) => `${formatearFecha(r.created_at)} — ${etiquetaAccion(r.action)}`);
}

async function resumenActividad(user: SessionUser): Promise<string> {
  const actor = encodeURIComponent(user.email ?? user.id);
  let rows: AuditRow[] = [];
  try {
    rows = await supabaseRest<AuditRow[]>(
      `audit_logs?actor_reference=eq.${actor}&select=action,details,created_at&order=created_at.desc&limit=12`,
    );
  } catch {
    rows = [];
  }
  if (rows.length === 0) {
    return "Todavía no tengo registrada ninguna acción tuya en ACE. En cuanto uses el sistema (crear una necesidad, subir un documento, generar un contrato...), podré contártelo aquí.";
  }
  const lineas = formatearResumenActividad(rows);
  return ["Esto es lo último que hiciste en ACE:", ...lineas.map((l) => `- ${l}`)].join("\n");
}

// ── "Archivo": biblioteca de expedientes, mismo scope que /expedientes-archivo ─

async function responderArchivo(user: SessionUser, query: string): Promise<{ answer: string; sources: MiYoSource[] }> {
  const scope = getArchivoScopeLevel(user);
  const result = await answerExpedienteQuestion({
    query,
    oficina: scope === "oficina" ? getOfficeFilter(user) ?? undefined : undefined,
    uploadedBy: scope === "own" ? user.id : undefined,
  });
  const sources: MiYoSource[] = result.sources
    .slice(0, 5)
    .map((s: ExpedienteSearchResult) => ({ title: s.title, citation: s.citation, ubicacionResumen: s.ubicacionResumen }));
  return { answer: result.answer, sources };
}

// ── "Registro": la necesidad o el expediente que el usuario tiene abierto ──
// A diferencia del copiloto embebido en esas páginas, aquí NO hay formulario
// vivo en memoria: el contexto se reconstruye desde lo YA GUARDADO en la fila
// (tipo de objeto/procedimiento, hitos, valor estimado). Si el usuario tiene
// cambios sin guardar, el copiloto de la propia página los conoce mejor que
// "Mi Yo" — coherente con que ambos reusan la MISMA lógica de fondo.

type NecesidadRow = { tipo_objeto: string | null; tipo_proceso_seleccion: string | null; descripcion_catalogo: string | null };

async function responderRegistroNecesidad(
  user: SessionUser,
  necesidadId: string,
  pregunta: string,
  historial: MensajeRow[],
): Promise<{ answer: string; sources: MiYoSource[] }> {
  const rows = await supabaseUserRest<NecesidadRow[]>(
    user.accessToken,
    `necesidades?id=eq.${necesidadId}&select=tipo_objeto,tipo_proceso_seleccion,descripcion_catalogo&limit=1`,
  );
  const necesidad = rows[0];
  if (!necesidad) {
    return { answer: "No encontré esa necesidad, o no tienes acceso a ella.", sources: [] };
  }

  const eventos = streamCopiloto(
    {
      accion: "chat",
      tipoObjeto: necesidad.tipo_objeto ?? "",
      tipoProcesoSeleccion: necesidad.tipo_proceso_seleccion ?? "",
      necesidadId,
      campoObjetivo: undefined,
      pregunta,
      camposLlenos: [],
      faltantes: [],
      historial: historial.slice(-6).map((m) => ({ role: m.role, content: m.content })),
    },
    { entity: user.entity },
  );

  let answer = "";
  const sources: MiYoSource[] = [];
  for await (const evento of eventos) {
    if (evento.type === "delta") answer += evento.text;
    else if (evento.type === "fuentes") {
      sources.push(...evento.fuentes.map((f) => ({ title: f.citation, citation: f.article ? `Art. ${f.article}` : f.documentType })));
    }
  }
  return { answer: answer.trim() || "No pude generar una respuesta para esta necesidad.", sources };
}

type ProcesoRow = { valor_estimado: number | string | null; hitos: HitosMap | null };

function num(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

async function pacBienesServicios(): Promise<number | null> {
  const rows = await supabaseRest<Array<{ pac_monto_bienes_servicios: number | string | null }>>(
    "entity_settings?id=eq.default&select=pac_monto_bienes_servicios&limit=1",
  ).catch(() => []);
  return num(rows[0]?.pac_monto_bienes_servicios);
}

async function responderRegistroExpediente(
  user: SessionUser,
  expedienteId: string,
  pregunta: string,
): Promise<{ answer: string; sources: MiYoSource[] }> {
  const [rows, pac] = await Promise.all([
    supabaseUserRest<ProcesoRow[]>(
      user.accessToken,
      `procurement_processes?id=eq.${expedienteId}&select=valor_estimado,hitos`,
    ),
    pacBienesServicios(),
  ]);
  const proceso = rows[0];
  if (!proceso) {
    return { answer: "No encontré ese expediente, o no tienes acceso a él.", sources: [] };
  }
  const resumen = resumenEstadoExpediente(proceso.hitos ?? {}, num(proceso.valor_estimado), pac);
  const { answer, sources } = await chatExpediente(pregunta, resumen);
  return { answer, sources: sources.map((s) => ({ title: s.documentTitle, citation: s.citation })) };
}

// ── "Legal": la misma búsqueda + veracidad del chat legal, sin ensuciar el
// historial de la página de Chat (persist: false — Mi Yo tiene su propia
// memoria en asistente_mensajes) ────────────────────────────────────────────

async function responderLegal(user: SessionUser, query: string): Promise<{ answer: string; sources: MiYoSource[] }> {
  const result = await answerLegalQuestion(
    { question: query, mode: "tecnica", tone: "formal", length: "media" },
    {
      accessToken: user.accessToken,
      actorReference: user.email ?? user.id,
      entity: user.entity,
      ownerId: user.id,
      persist: false,
      role: user.role,
    },
  );
  const sources: MiYoSource[] = result.sources
    .slice(0, 5)
    .map((s: LegalSource) => ({ title: s.documentTitle, citation: s.citation ?? s.documentTitle }));
  return { answer: result.answer, sources };
}

// ── "General": conversación directa con el núcleo de Mi Yo, sin RAG ────────

async function responderGeneral(mensaje: string, historial: MensajeRow[]): Promise<string> {
  const openai = getOpenAIClient();
  const response = await openai.responses.create({
    model: legalAnswerModel,
    instructions: NUCLEO_MI_YO,
    input: [
      ...historial.slice(-6).map((m) => ({ role: m.role, content: m.content })),
      { role: "user" as const, content: mensaje },
    ],
    temperature: 0.4,
    max_output_tokens: 500,
  });
  return response.output_text?.trim() || "No pude generar una respuesta. Intenta de nuevo en un momento.";
}

// ── Memoria: conversación única por usuario ──────────────────────────────────

async function obtenerOCrearConversacion(user: SessionUser, conversationId?: string): Promise<string> {
  if (conversationId) return conversationId;
  const existentes = await supabaseUserRest<ConversacionRow[]>(
    user.accessToken,
    `asistente_conversaciones?user_id=eq.${user.id}&select=id&order=updated_at.desc&limit=1`,
  );
  if (existentes[0]) return existentes[0].id;
  const creada = await supabaseUserRest<ConversacionRow[]>(user.accessToken, "asistente_conversaciones", {
    method: "POST",
    body: JSON.stringify({ user_id: user.id }),
  });
  return creada[0].id;
}

async function cargarHistorial(user: SessionUser, conversationId: string): Promise<MensajeRow[]> {
  const rows = await supabaseUserRest<MensajeRow[]>(
    user.accessToken,
    `asistente_mensajes?conversacion_id=eq.${conversationId}&select=role,content&order=created_at.desc&limit=10`,
  );
  return rows.reverse();
}

async function guardarMensaje(
  user: SessionUser,
  conversationId: string,
  role: "user" | "assistant",
  content: string,
  intent?: MiYoIntent,
): Promise<void> {
  await supabaseUserRest(user.accessToken, "asistente_mensajes", {
    method: "POST",
    body: JSON.stringify({ conversacion_id: conversationId, user_id: user.id, role, content, intent: intent ?? null }),
  });
}

// ── Punto de entrada único ───────────────────────────────────────────────────

export async function responderMiYo(
  user: SessionUser,
  mensaje: string,
  conversationId?: string,
  contexto?: MiYoContexto,
): Promise<MiYoResult> {
  const idConversacion = await obtenerOCrearConversacion(user, conversationId);
  const historial = await cargarHistorial(user, idConversacion);

  await guardarMensaje(user, idConversacion, "user", mensaje);

  const { intent, queryInterna } = await clasificarIntencion(mensaje, historial, contexto);

  let answer: string;
  let sources: MiYoSource[] = [];

  try {
    if (intent === "legal") {
      const r = await responderLegal(user, queryInterna);
      answer = r.answer;
      sources = r.sources;
    } else if (intent === "archivo") {
      const r = await responderArchivo(user, queryInterna);
      answer = r.answer;
      sources = r.sources;
    } else if (intent === "actividad") {
      answer = await resumenActividad(user);
    } else if (intent === "registro" && contexto) {
      // Misma capacidad que exige el copiloto embebido de cada página: sin
      // ella, "Mi Yo" no debe usar IA sobre ese registro aunque RLS le deje
      // leer la fila (ver el mismo criterio en las rutas /copiloto/chat).
      const capacidad = contexto.tipo === "necesidad" ? "necesidad.manage" : "expediente.manage";
      if (!roleHasCapability(user.role, capacidad)) {
        answer = "Tu rol no tiene permiso para usar IA sobre este registro.";
      } else if (contexto.tipo === "necesidad") {
        const r = await responderRegistroNecesidad(user, contexto.id, queryInterna, historial);
        answer = r.answer;
        sources = r.sources;
      } else {
        const r = await responderRegistroExpediente(user, contexto.id, queryInterna);
        answer = r.answer;
        sources = r.sources;
      }
    } else {
      answer = await responderGeneral(mensaje, historial);
    }
  } catch (error) {
    answer = `No pude completar eso: ${error instanceof Error ? error.message : "error desconocido"}. Intenta de nuevo en un momento.`;
  }

  await guardarMensaje(user, idConversacion, "assistant", answer, intent);

  await writeAuditLog({
    action: "asistente.mensaje",
    actorReference: user.email ?? user.id,
    details: { intent, contexto: contexto ?? null },
    entityId: idConversacion,
    entityType: "asistente",
    module: "asistente",
  });

  return { answer, conversationId: idConversacion, intent, sources };
}
