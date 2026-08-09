"use client";

import { BookOpen, FileSignature, Info, Loader2, Save, Sparkles, ThumbsDown, ThumbsUp, Wand2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { enviarFeedbackRespuesta } from "@/lib/expedientes-archivo-actions";

type Props = {
  antecedentes: Array<{ anio: number | null; excerpt: string; expedienteId: string; serie: string | null; title: string; ubicacion: string }>;
  baseLegal: Array<{ referencia: string; texto: string }>;
  cuerpo: string;
  genUsage?: { inputTokens: number; outputTokens: number; estimatedCostUsd: number };
  // Contexto para la evaluacion del borrador (feedback por oficina).
  intencion: string;
  oficinaId: string;
  refining: boolean;
  savingRespuesta: boolean;
  setBaseLegal: (v: Array<{ referencia: string; texto: string }>) => void;
  setCuerpo: (v: string) => void;
  showToast: (msg: string, kind?: "success" | "error" | "warning" | "info") => void;
  tipoDocumento: string;
  onRefine: (instruccion: string) => Promise<void>;
  onSave: () => void;
};

// Ajustes de un clic sobre el borrador (refinamiento conversacional).
const AJUSTES_RAPIDOS: Array<{ label: string; instruccion: string }> = [
  { label: "Mejorar redacción", instruccion: "Mejora la redacción: fluidez, conectores, precisión y elegancia institucional, conservando el contenido, los datos y las citas legales." },
  { label: "Más corto", instruccion: "Haz el documento más corto y directo, conservando los datos y citas legales." },
  { label: "Más formal", instruccion: "Eleva la formalidad del lenguaje al registro institucional protocolar." },
  { label: "Lenguaje sencillo", instruccion: "Simplifica el lenguaje para que un ciudadano sin formación legal lo entienda, sin perder precisión." },
  { label: "Más detallado", instruccion: "Amplía el desarrollo con más detalle y fundamentación, sin inventar hechos ni normas nuevas." },
];

// Seccion 3: Borrador - cuerpo editable + ajustes con IA + base legal + antecedentes
export function BorradorEditor({
  antecedentes,
  baseLegal,
  cuerpo,
  genUsage,
  intencion,
  oficinaId,
  refining,
  savingRespuesta,
  setCuerpo,
  showToast,
  tipoDocumento,
  onRefine,
  onSave,
}: Props) {
  const total = genUsage?.inputTokens ?? 0;
  const cost = genUsage?.estimatedCostUsd ?? 0;
  const [instruccion, setInstruccion] = useState("");
  // Evaluacion del borrador: like/dislike que alimenta al generador de la oficina.
  const [rated, setRated] = useState<"like" | "dislike" | null>(null);
  const [sendingRating, setSendingRating] = useState(false);
  const [askComment, setAskComment] = useState(false);
  const [comentario, setComentario] = useState("");

  async function applyCustom() {
    const t = instruccion.trim();
    if (t.length < 3) {
      showToast("Escribe el cambio que quieres, ej. «agrega un párrafo sobre el plazo».", "warning");
      return;
    }
    await onRefine(t);
    setInstruccion("");
  }

  async function sendFeedback(rating: "like" | "dislike", comment?: string) {
    setSendingRating(true);
    try {
      await enviarFeedbackRespuesta({
        oficinaId: oficinaId || undefined,
        tipoDocumento,
        rating,
        comentario: comment?.trim() || undefined,
        cuerpo,
        intencion: intencion.trim() || undefined,
      });
      setRated(rating);
      setAskComment(false);
      setComentario("");
      showToast(
        rating === "like"
          ? "Gracias: este borrador servirá de ejemplo para futuros documentos de tu oficina."
          : "Gracias: la observación se usará para mejorar la redacción de tu oficina.",
        "success",
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : "No se pudo guardar la evaluación", "error");
    } finally {
      setSendingRating(false);
    }
  }

  return (
    <div className="expFormSection" style={{ marginTop: 16 }}>
      <div className="expFormSectionHeader">
        <h3 className="expFormSectionTitle">
          <FileSignature size={16} /> Borrador
          <span className="expFormSectionHint">Edita antes de guardar</span>
        </h3>
        {genUsage ? (
          <span className="expHelpText" style={{ marginTop: 0 }} title="Tokens de IA consumidos">
            <Sparkles size={12} /> {total.toLocaleString("es-PE")} tokens
            {cost > 0 ? ` · ~$${cost.toFixed(4)}` : ""}
          </span>
        ) : null}
      </div>

      <div className="expField">
        <textarea
          className="expField-input"
          value={cuerpo}
          onChange={(e) => setCuerpo(e.target.value)}
          rows={14}
          placeholder="Aqui aparecera el cuerpo generado por la IA. Podras editarlo antes de guardar."
        />
        <small
          style={{
            color: "var(--muted, #667)",
            fontSize: 11,
            marginTop: 2,
            display: "block",
          }}
        >
          {cuerpo.length.toLocaleString("es-PE")} caracteres.
        </small>
      </div>

      {/* Ajustes con IA: aplica SOLO el cambio pedido, sin regenerar de cero */}
      {cuerpo.trim() ? (
        <div
          style={{
            border: "1px dashed var(--line, #d7dae0)",
            borderRadius: 10,
            padding: "10px 12px",
            marginBottom: 12,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <span style={{ fontSize: 12.5, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
            <Wand2 size={14} style={{ color: "var(--brand, #0f766e)" }} />
            Ajustar con IA
            <span style={{ fontWeight: 400, color: "var(--muted, #667)" }}>
              — cambia solo lo que pidas, sin rehacer el resto
            </span>
          </span>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {AJUSTES_RAPIDOS.map((a) => (
              <button
                key={a.label}
                type="button"
                className="secondaryButton"
                disabled={refining}
                onClick={() => void onRefine(a.instruccion)}
                style={{ fontSize: 12, padding: "4px 10px" }}
              >
                {a.label}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <input
              className="expField-input"
              value={instruccion}
              onChange={(e) => setInstruccion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !refining) void applyCustom();
              }}
              placeholder="Pide un cambio… ej. «agrega un párrafo indicando el plazo de 5 días»"
              disabled={refining}
              style={{ flex: 1 }}
            />
            <button
              type="button"
              className="secondaryButton"
              onClick={() => void applyCustom()}
              disabled={refining}
            >
              {refining ? <Loader2 size={15} className="expSpin" /> : <Sparkles size={15} />}{" "}
              {refining ? "Aplicando…" : "Aplicar"}
            </button>
          </div>

          {/* Evaluacion del borrador: alimenta la redaccion futura de la oficina */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
              borderTop: "1px dashed var(--line, #e2e4ea)",
              paddingTop: 8,
            }}
          >
            <span style={{ fontSize: 12, color: "var(--muted, #667)" }}>
              ¿La redacción está bien? Tu evaluación enseña a la IA de tu oficina:
            </span>
            <button
              type="button"
              className="secondaryButton"
              disabled={sendingRating || rated === "like"}
              onClick={() => void sendFeedback("like")}
              title="Marcar como redacción correcta (servirá de ejemplo)"
              style={{
                fontSize: 12,
                padding: "3px 10px",
                ...(rated === "like" ? { background: "#d1fae5", color: "#065f46", borderColor: "#a7f3d0" } : {}),
              }}
            >
              <ThumbsUp size={13} /> {rated === "like" ? "Marcada correcta" : "Correcta"}
            </button>
            <button
              type="button"
              className="secondaryButton"
              disabled={sendingRating || rated === "dislike"}
              onClick={() => setAskComment((v) => !v)}
              title="Marcar como redacción incorrecta e indicar qué mejorar"
              style={{
                fontSize: 12,
                padding: "3px 10px",
                ...(rated === "dislike" ? { background: "#fee2e2", color: "#991b1b", borderColor: "#fecaca" } : {}),
              }}
            >
              <ThumbsDown size={13} /> {rated === "dislike" ? "Marcada incorrecta" : "Incorrecta"}
            </button>
            {sendingRating ? <Loader2 size={14} className="expSpin" /> : null}
          </div>
          {askComment && rated !== "dislike" ? (
            <div style={{ display: "flex", gap: 6 }}>
              <input
                className="expField-input"
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !sendingRating) void sendFeedback("dislike", comentario);
                }}
                placeholder="¿Qué estuvo mal? ej. «demasiado extenso», «no cita la norma correcta»…"
                disabled={sendingRating}
                style={{ flex: 1 }}
              />
              <button
                type="button"
                className="secondaryButton"
                onClick={() => void sendFeedback("dislike", comentario)}
                disabled={sendingRating}
                style={{ fontSize: 12 }}
              >
                Enviar
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {baseLegal.length > 0 ? (
        <div className="expField">
          <SectionHeader
            icon={<BookOpen size={14} />}
            title={`Base legal consultada (${baseLegal.length})`}
          />
          <div
            style={{
              background: "#f0f9ff",
              border: "1px solid #bae6fd",
              borderRadius: 6,
              padding: "6px 10px",
              fontSize: 11,
              color: "#0c4a6e",
              display: "flex",
              gap: 6,
              alignItems: "flex-start",
              marginBottom: 8,
            }}
          >
            <Info size={13} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>
              Esta base legal se uso para redactar el cuerpo.{" "}
              <strong>No aparecera en el documento descargado</strong>.
            </span>
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "var(--muted, #667)" }}>
            {baseLegal.map((s, i) => (
              <li key={i} style={{ marginBottom: 4 }}>
                <strong>{s.referencia}</strong>: {s.texto}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {antecedentes.length > 0 ? (
        <div className="expField">
          <SectionHeader
            icon={<BookOpen size={14} />}
            title="Expedientes relacionados de la biblioteca (búsqueda opcional)"
          />
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "var(--muted, #667)" }}>
            {antecedentes.map((a) => (
              <li key={a.expedienteId} style={{ marginBottom: 4 }}>
                <strong>{a.title}</strong>
                {a.serie ? ` (${a.serie})` : ""}
                {a.anio ? `, ${a.anio}` : ""} · {a.ubicacion}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <button
        type="button"
        className="primaryButton"
        onClick={onSave}
        disabled={savingRespuesta}
        style={{ marginTop: 12 }}
      >
        {savingRespuesta ? (
          <span style={{ display: "inline-block", width: 16, height: 16 }} className="expSpin" />
        ) : (
          <Save size={16} />
        )}{" "}
        {savingRespuesta ? "Guardando..." : "Guardar y numerar"}
      </button>
    </div>
  );
}

function SectionHeader({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
      <span style={{ color: "var(--brand, #0f766e)" }}>{icon}</span>
      <strong style={{ fontSize: 13 }}>{title}</strong>
    </div>
  );
}
