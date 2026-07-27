/**
 * Experiencia del personal clave (Art. 72.3.b, capacidad técnica y profesional),
 * dentro de los requisitos de calificación.
 *
 * Puede haber VARIOS puestos —un residente, un especialista en estructuras…—,
 * cada uno con su tiempo de experiencia mínimo, la actividad en la que se exige
 * y el cargo. Por eso es una LISTA, no un texto suelto, y en el requerimiento
 * sale como un cuadro.
 *
 * Se guarda serializado en una sola columna de texto, con parse/compose
 * reversibles, igual que «otras penalidades»: el editor compone al escribir y
 * vuelve a leer al abrir, sin migración por fila, y el Word lo pinta como tabla.
 */

export type FilaPersonalClave = {
  /** Tiempo de experiencia mínimo. Ej. «tres (3) años». */
  tiempo: string;
  /** Trabajos o prestaciones en la actividad requerida. */
  trabajos: string;
  /** Puesto, cargo o posición del personal clave. */
  puesto: string;
};

// Etiquetas explícitas, no un separador suelto: son tres campos de texto libre
// que pueden traer guiones o puntos, y así la línea se sigue leyendo si alguien
// abre la columna a mano.
const LINEA = /^\s*\d+\.\s*Tiempo:\s*(.*?)\s*·\s*Actividad:\s*(.*?)\s*·\s*Puesto:\s*(.*?)\s*$/;

export function parsePersonalClave(texto: string | null | undefined): FilaPersonalClave[] {
  if (!texto) return [];
  const salida: FilaPersonalClave[] = [];
  for (const linea of texto.split(/\r?\n/)) {
    const m = linea.match(LINEA);
    if (!m) continue;
    const fila = { tiempo: m[1].trim(), trabajos: m[2].trim(), puesto: m[3].trim() };
    // Una fila totalmente vacía no es una fila; con algo escrito, se conserva.
    if (fila.tiempo || fila.trabajos || fila.puesto) salida.push(fila);
  }
  return salida;
}

/** Operación inversa de `parsePersonalClave`. El par debe seguir siendo reversible. */
export function formatPersonalClave(filas: FilaPersonalClave[]): string {
  const utiles = filas.filter((f) => f.tiempo.trim() || f.trabajos.trim() || f.puesto.trim());
  if (utiles.length === 0) return "";
  return utiles
    .map(
      (f, k) =>
        `${k + 1}. Tiempo: ${f.tiempo.trim() || "[POR DEFINIR]"} · ` +
        `Actividad: ${f.trabajos.trim() || "[POR DEFINIR]"} · ` +
        `Puesto: ${f.puesto.trim() || "[POR DEFINIR]"}`,
    )
    .join("\n");
}

/**
 * Filas a medio declarar: tienen algo pero les falta un campo.
 *
 * No bloquea, pero un puesto sin tiempo mínimo, o sin actividad, no es un
 * requisito acreditable. Devuelve el número de fila (1-based) de cada una.
 */
export function personalClaveIncompletas(filas: FilaPersonalClave[]): number[] {
  return filas
    .map((f, i) => {
      const algo = f.tiempo.trim() || f.trabajos.trim() || f.puesto.trim();
      const completa = f.tiempo.trim() && f.trabajos.trim() && f.puesto.trim();
      return algo && !completa ? i + 1 : 0;
    })
    .filter((n) => n > 0);
}
