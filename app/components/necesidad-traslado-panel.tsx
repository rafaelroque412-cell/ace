"use client";

import { CheckCircle2, ClipboardCheck, Loader } from "lucide-react";

// Panel de traslado de la propuesta IA a la ficha de necesidad.
//
// Vive aparte del modal por dos razones: el modal ya era largo, y este panel es
// la pieza donde se decide qué se escribe en la ficha —conviene poder mirarla y
// probarla sola—.
//
// Regla que sostiene todo el diseño: NADA se traslada sin visto bueno explícito
// de la sección. El traslado PISA lo que el área usuaria redactó, así que la
// aprobación es del usuario, no del modelo.

export type CampoTraslado = {
  api: string;
  label: string;
  /** Valor propuesto, extraído literalmente de la propuesta. */
  valor: string;
  /** Valor que la ficha tiene hoy (vacío si no tiene). */
  actual: string;
  /** true si trasladar reemplazaría un valor ya escrito. */
  pisa: boolean;
};

export type GrupoTraslado = { seccion: string; campos: CampoTraslado[] };

/**
 * Primer número que aparece en un texto, o undefined si no hay ninguno.
 *
 * La extracción devuelve TODO como texto, pero `cantidad` y `plazoEjecucion` son
 * columnas numéricas y su schema las rechaza con "expected number, received
 * string". Se toma el PRIMER grupo de dígitos y no todos: la IA suele devolver
 * el número limpio, pero ante un "Treinta (30) días calendario" concatenar
 * dígitos daría un valor inventado.
 */
export function numeroDesdeTexto(valor: string): number | undefined {
  const m = valor.match(/-?\d[\d.,]*/);
  if (!m) return undefined;
  // Separador de miles fuera; el decimal se conserva.
  const n = Number(m[0].replace(/,/g, ""));
  return Number.isFinite(n) ? n : undefined;
}

export function TrasladoPanel({
  grupos,
  seccionesOk,
  camposExcluidos,
  aprobados,
  trasladando,
  onToggleSeccion,
  onToggleCampo,
  onTrasladar,
  onDescartar,
}: {
  grupos: GrupoTraslado[];
  seccionesOk: Set<string>;
  camposExcluidos: Set<string>;
  /** Nº de campos que se trasladarían con la selección actual. */
  aprobados: number;
  trasladando: boolean;
  onToggleSeccion: (seccion: string) => void;
  onToggleCampo: (api: string) => void;
  onTrasladar: () => void;
  onDescartar: () => void;
}) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, fontSize: 13, marginBottom: 6 }}>
        <ClipboardCheck size={15} style={{ color: "var(--accent, #7c3aed)" }} /> Traslado a la ficha · da el visto bueno por
        sección
      </div>
      <p style={{ fontSize: 12, color: "var(--muted, #64748b)", margin: "0 0 10px" }}>
        Nada se escribe hasta que apruebes la sección. Los campos marcados{" "}
        <strong style={{ color: "var(--warning, #d97706)" }}>reemplazan</strong> lo que ya hay en la ficha.
      </p>

      {grupos.map((grupo) => {
        const aprobada = seccionesOk.has(grupo.seccion);
        const pisaAlguno = grupo.campos.some((c) => c.pisa);
        return (
          <div
            key={grupo.seccion}
            style={{
              borderRadius: 8,
              marginBottom: 10,
              overflow: "hidden",
              border: `1px solid color-mix(in srgb, var(--${aprobada ? "success, #16a34a" : "muted, #64748b"}) ${aprobada ? 40 : 18}%, transparent)`,
              background: aprobada ? "color-mix(in srgb, var(--success, #16a34a) 6%, transparent)" : "var(--panel, #fff)",
            }}
          >
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 10px",
                fontWeight: 700,
                fontSize: 12.5,
                cursor: "pointer",
              }}
            >
              <input type="checkbox" checked={aprobada} onChange={() => onToggleSeccion(grupo.seccion)} />
              <span style={{ flex: 1 }}>{grupo.seccion}</span>
              {pisaAlguno ? (
                <span
                  style={{
                    fontSize: 10.5,
                    fontWeight: 600,
                    padding: "1px 6px",
                    borderRadius: 999,
                    color: "var(--warning, #d97706)",
                    background: "color-mix(in srgb, var(--warning, #d97706) 14%, transparent)",
                  }}
                >
                  reemplaza contenido
                </span>
              ) : null}
              <span style={{ fontWeight: 400, color: "var(--muted, #64748b)" }}>
                {grupo.campos.length} campo{grupo.campos.length === 1 ? "" : "s"}
              </span>
            </label>

            {/* Los campos solo se detallan cuando la sección está aprobada: en
                una propuesta completa son ~25 y, todos abiertos a la vez, el
                panel deja de leerse. Plegado, el usuario recorre secciones. */}
            {aprobada
              ? grupo.campos.map((c) => {
                  const excluido = camposExcluidos.has(c.api);
                  return (
                    <div
                      key={c.api}
                      style={{
                        padding: "6px 10px 10px 30px",
                        opacity: excluido ? 0.5 : 1,
                        borderTop: "1px solid color-mix(in srgb, var(--muted, #64748b) 12%, transparent)",
                      }}
                    >
                      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, cursor: "pointer" }}>
                        <input type="checkbox" checked={!excluido} onChange={() => onToggleCampo(c.api)} />
                        <strong>{c.label}</strong>
                        {c.pisa ? (
                          <span
                            style={{
                              fontSize: 10.5,
                              padding: "1px 6px",
                              borderRadius: 999,
                              color: "var(--warning, #d97706)",
                              background: "color-mix(in srgb, var(--warning, #d97706) 14%, transparent)",
                            }}
                          >
                            reemplaza
                          </span>
                        ) : (
                          <span style={{ fontSize: 10.5, color: "var(--muted, #64748b)" }}>vacío en la ficha</span>
                        )}
                      </label>
                      {c.pisa ? (
                        <p
                          style={{
                            margin: "4px 0 2px",
                            fontSize: 11.5,
                            color: "var(--muted, #64748b)",
                            textDecoration: "line-through",
                          }}
                        >
                          {c.actual.slice(0, 180)}
                          {c.actual.length > 180 ? "…" : ""}
                        </p>
                      ) : null}
                      <p style={{ margin: "2px 0 0", fontSize: 12, lineHeight: 1.45, whiteSpace: "pre-wrap" }}>
                        {c.valor.slice(0, 400)}
                        {c.valor.length > 400 ? "…" : ""}
                      </p>
                    </div>
                  );
                })
              : null}
          </div>
        );
      })}

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10, flexWrap: "wrap" }}>
        <button className="primaryButton compactButton" type="button" onClick={onTrasladar} disabled={trasladando || aprobados === 0}>
          {trasladando ? <Loader size={14} /> : <CheckCircle2 size={14} />} Trasladar {aprobados} campo
          {aprobados === 1 ? "" : "s"}
        </button>
        <button className="secondaryButton compactButton" type="button" onClick={onDescartar}>
          Descartar
        </button>
        {aprobados === 0 ? (
          <span style={{ fontSize: 11.5, color: "var(--muted, #64748b)" }}>Aprueba al menos una sección para trasladar.</span>
        ) : null}
      </div>
    </div>
  );
}
