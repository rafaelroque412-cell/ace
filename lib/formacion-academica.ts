/**
 * Calificaciones del personal clave · FORMACIÓN ACADÉMICA (Art. 72.3.b, C.2.1).
 *
 * El formato fija la frase y deja dos huecos: el grado o título requerido y el
 * puesto del que debe acreditarse. Se compone, como el resto de apartados de
 * formato —texto reglamentario con huecos, no prosa que redactar—; un hueco
 * vacío conserva su corchete para que lo que falta se vea en un documento que se
 * firma.
 *
 * Aviso del propio formato: como requisito de calificación solo cabe exigir el
 * GRADO o el TÍTULO, no cursos, diplomados ni especializaciones.
 */

const HUECO_GRADO =
  "CONSIGNAR EL GRADO DE BACHILLER O TÍTULO PROFESIONAL REQUERIDO, CONSIDERANDO LOS NIVELES " +
  "ESTABLECIDOS POR LA NORMATIVA EN LA MATERIA";
const HUECO_PUESTO =
  "CONSIGNAR EL PERSONAL CLAVE REQUERIDO PARA EJECUTAR LA PRESTACIÓN OBJETO DE LA CONVOCATORIA " +
  "DEL CUAL DEBE ACREDITARSE ESTE REQUISITO";

/** El conector fijo entre los dos huecos. También separa al reparsear. */
const CONECTOR = " del personal clave requerido como ";

export type HuecosFormacion = {
  /** Grado de bachiller o título profesional requerido. */
  grado: string;
  /** Puesto del personal clave del que debe acreditarse. */
  puesto: string;
};

function hueco(valor: string, textoOriginal: string): string {
  return valor.trim() || `[${textoOriginal}]`;
}

/** La frase del requisito, con los dos huecos dentro. */
export function componerFormacionAcademica(h: Partial<HuecosFormacion>): string {
  return `${hueco(h.grado ?? "", HUECO_GRADO)}${CONECTOR}${hueco(h.puesto ?? "", HUECO_PUESTO)}.`;
}

/**
 * Rescata los dos huecos de un requisito ya redactado, para volver a mostrarlos
 * al reabrir la ficha. El corchete sin rellenar no es un valor.
 */
export function parseFormacionAcademica(texto: string | null | undefined): HuecosFormacion {
  const t = (texto ?? "").trim().replace(/\.\s*$/, "");
  const i = t.indexOf(CONECTOR);
  if (i < 0) return { grado: "", puesto: "" };
  const grado = t.slice(0, i).trim();
  const puesto = t.slice(i + CONECTOR.length).trim();
  return {
    grado: grado.startsWith("[") ? "" : grado,
    puesto: puesto.startsWith("[") ? "" : puesto,
  };
}
