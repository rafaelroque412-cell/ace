"use client";

import { useMemo } from "react";

type Source = {
  citation?: string;
  documentNumber?: string | null;
  documentTitle?: string;
  excerpt?: string;
  title?: string;
  source: "manual" | "rag" | string;
};

type Props = {
  body: string;
  sources: Source[];
  onChange: (v: string) => void;
  rows?: number;
};

// Editor del cuerpo con marcas [E1], [E2], etc. resaltadas como chips
// que al click hacen scroll al documento citado en la seccion "Base legal".
//
// El sistema prompt del /generate ya instruye al modelo a usar [E1], [E2]
// al final de cada oracion sustantiva. Aqui lo hacemos visible para el
// usuario, con un popover de resumen al hover.
export function CuerpoConMarcas({ body, sources, onChange, rows = 14 }: Props) {
  // Parsea el cuerpo en segmentos: texto normal y marcas [E#].
  const segments = useMemo(() => parsearMarcas(body), [body]);

  return (
    <div>
      <textarea
        className="expField-input"
        value={body}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
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
        {body.length.toLocaleString("es-PE")} caracteres.
        {segments.marcadas > 0 ? (
          <>
            {" "}· {segments.marcadas} marca(s) de cita encontrada(s).
            {segments.marcadas > sources.length ? (
              <span style={{ color: "#dc2626" }}>
                {" "}⚠ Hay {segments.marcadas - sources.length} marca(s) sin fuente.
              </span>
            ) : null}
          </>
        ) : null}
      </small>
    </div>
  );
}

// Devuelve segmentos del cuerpo: texto normal y marcas [E#] separadas.
export function parsearMarcas(body: string): {
  marcadas: number;
  partes: Array<{ type: "text" | "mark"; content: string; index?: number }>;
} {
  const partes: Array<{ type: "text" | "mark"; content: string; index?: number }> = [];
  const regex = /\[E(\d+)\]/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let marcadas = 0;
  while ((match = regex.exec(body)) !== null) {
    if (match.index > lastIndex) {
      partes.push({ type: "text", content: body.slice(lastIndex, match.index) });
    }
    const idx = Number.parseInt(match[1], 10);
    if (!Number.isNaN(idx)) {
      partes.push({ type: "mark", content: match[0], index: idx });
      marcadas += 1;
    }
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < body.length) {
    partes.push({ type: "text", content: body.slice(lastIndex) });
  }
  return { marcadas, partes };
}
