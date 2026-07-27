/**
 * Experiencia del personal clave (Art. 72.3.b, capacidad técnica y profesional),
 * dentro de los requisitos de calificación.
 *
 * Puede haber VARIOS puestos —un residente, un especialista en estructuras…—,
 * cada uno con su actividad, la cantidad requerida, su tiempo de experiencia
 * mínimo, la actividad en la que se exige y el cargo. Por eso es una LISTA, no un
 * texto suelto, y en el requerimiento sale como un cuadro.
 *
 * Se guarda serializado en una sola columna de texto, con parse/compose
 * reversibles, igual que «otras penalidades»: el editor compone al escribir y
 * vuelve a leer al abrir, sin migración por fila, y el Word lo pinta como tabla.
 */

export type FilaPersonalClave = {
  /** Actividad general a la que corresponde el personal. */
  actividad: string;
  /** Cantidad de personal requerido de ese puesto. */
  cantidad: string;
  /** Tiempo de experiencia mínimo. Ej. «tres (3) años». */
  tiempo: string;
  /** Trabajos o prestaciones en la actividad requerida. */
  trabajos: string;
  /** Puesto, cargo o posición del personal clave. */
  puesto: string;
};

/** Una fila vacía, para el estado inicial y el botón «Agregar». */
export const FILA_PERSONAL_CLAVE_VACIA: FilaPersonalClave = {
  actividad: "",
  cantidad: "",
  tiempo: "",
  trabajos: "",
  puesto: "",
};

// Etiquetas explícitas, no un separador suelto: son campos de texto libre que
// pueden traer guiones o puntos, y así la línea se sigue leyendo si alguien abre
// la columna a mano. «Prestaciones» —no «Actividad»— para los trabajos, porque
// ahora hay una columna «Actividad» propia y dos etiquetas iguales romperían el
// parseo.
const LINEA =
  /^\s*\d+\.\s*Actividad:\s*(.*?)\s*·\s*Cantidad:\s*(.*?)\s*·\s*Tiempo:\s*(.*?)\s*·\s*Prestaciones:\s*(.*?)\s*·\s*Puesto:\s*(.*?)\s*$/;

function algoEscrito(f: FilaPersonalClave): boolean {
  return Boolean(f.actividad.trim() || f.cantidad.trim() || f.tiempo.trim() || f.trabajos.trim() || f.puesto.trim());
}

export function parsePersonalClave(texto: string | null | undefined): FilaPersonalClave[] {
  if (!texto) return [];
  const salida: FilaPersonalClave[] = [];
  for (const linea of texto.split(/\r?\n/)) {
    const m = linea.match(LINEA);
    if (!m) continue;
    const fila: FilaPersonalClave = {
      actividad: m[1].trim(),
      cantidad: m[2].trim(),
      tiempo: m[3].trim(),
      trabajos: m[4].trim(),
      puesto: m[5].trim(),
    };
    if (algoEscrito(fila)) salida.push(fila);
  }
  return salida;
}

/** Operación inversa de `parsePersonalClave`. El par debe seguir siendo reversible. */
export function formatPersonalClave(filas: FilaPersonalClave[]): string {
  const utiles = filas.filter(algoEscrito);
  if (utiles.length === 0) return "";
  const g = (v: string) => v.trim() || "[POR DEFINIR]";
  return utiles
    .map(
      (f, k) =>
        `${k + 1}. Actividad: ${g(f.actividad)} · Cantidad: ${g(f.cantidad)} · Tiempo: ${g(f.tiempo)} · ` +
        `Prestaciones: ${g(f.trabajos)} · Puesto: ${g(f.puesto)}`,
    )
    .join("\n");
}

/**
 * Filas a medio declarar: tienen algo pero les falta el núcleo del requisito.
 *
 * No bloquea, pero un puesto sin tiempo mínimo, sin prestaciones o sin cargo no
 * es un requisito acreditable. La actividad y la cantidad no se exigen aquí: son
 * el encuadre, no lo que se acredita. Devuelve el número de fila (1-based).
 */
export function personalClaveIncompletas(filas: FilaPersonalClave[]): number[] {
  return filas
    .map((f, i) => {
      const completa = f.tiempo.trim() && f.trabajos.trim() && f.puesto.trim();
      return algoEscrito(f) && !completa ? i + 1 : 0;
    })
    .filter((n) => n > 0);
}
