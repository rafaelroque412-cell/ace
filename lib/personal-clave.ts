/**
 * Redacta la «Experiencia del personal clave» (Art. 72.3.b, capacidad técnica y
 * profesional), como requisito de calificación adicional.
 *
 * El formato de las bases estándar fija la frase y deja tres huecos: el tiempo
 * mínimo, los trabajos o prestaciones en la actividad requerida y el puesto que
 * ocupa ese personal. Se compone, como la forma de pago o la recepción —texto
 * reglamentario con huecos, no prosa que redactar—; un hueco vacío conserva su
 * corchete para que lo que falta se vea en un documento que se firma.
 */

const HUECO_TIEMPO = "CONSIGNAR EL TIEMPO DE EXPERIENCIA MÍNIMO";
const HUECO_TRABAJOS = "CONSIGNAR LOS TRABAJOS O PRESTACIONES EN LA ACTIVIDAD REQUERIDA";
const HUECO_PUESTO =
  "CONSIGNAR LA DENOMINACIÓN DEL PUESTO, CARGO Y/O POSICIÓN QUE OCUPA EL PERSONAL CLAVE REQUERIDO PARA " +
  "EJECUTAR LA PRESTACIÓN OBJETO DE LA CONVOCATORIA RESPECTO DEL CUAL SE DEBE ACREDITAR ESTE REQUISITO";

export type HuecosPersonalClave = {
  /** Tiempo de experiencia mínimo exigido. Ej. «tres (3) años». */
  tiempo: string;
  /** Trabajos o prestaciones en la actividad requerida. */
  trabajos: string;
  /** Denominación del puesto, cargo o posición del personal clave. */
  puesto: string;
};

function hueco(valor: string, textoOriginal: string): string {
  return valor.trim() || `[${textoOriginal}]`;
}

/** ¿Cuántos de los tres huecos siguen sin rellenar? Para avisar antes de firmar. */
export function huecosPersonalClavePendientes(h: Partial<HuecosPersonalClave>): number {
  return [h.tiempo, h.trabajos, h.puesto].filter((v) => !(v ?? "").trim()).length;
}

/**
 * La frase del requisito, con los tres huecos dentro.
 *
 * «{tiempo} en {trabajos} del personal clave requerido desempeñándose como
 * {puesto}.». Los espacios en blanco no cuentan como relleno: un hueco con solo
 * espacios conserva su corchete.
 */
export function componerExperienciaPersonalClave(h: Partial<HuecosPersonalClave>): string {
  return (
    `${hueco(h.tiempo ?? "", HUECO_TIEMPO)} en ${hueco(h.trabajos ?? "", HUECO_TRABAJOS)} ` +
    `del personal clave requerido desempeñándose como ${hueco(h.puesto ?? "", HUECO_PUESTO)}.`
  );
}
