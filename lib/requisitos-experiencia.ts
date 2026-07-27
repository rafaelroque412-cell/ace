/**
 * Redacta el detalle de «Experiencia del postor en la especialidad» (Art. 72.3.c).
 *
 * El formato de las bases estándar fija el texto entero y deja UN hueco: el
 * monto facturado acumulado que se exige. Se compone en vez de generarse, por el
 * mismo motivo que la forma de pago o la recepción: es texto reglamentario con
 * un solo dato variable, y parafrasearlo en un documento que se firma sería un
 * defecto. El monto sí se registra —es un número con decimales— y de él sale
 * tanto la cifra como su versión en letras, en la moneda de la convocatoria.
 *
 * El formato pone además un tope: ese monto no puede superar TRES VECES la
 * cuantía de la contratación o del ítem. Eso NO se comprueba aquí —lo avisa
 * `avisosDeTopes` (lib/requisitos-topes.ts), que ya lee la cuantía— para no
 * partir en dos la misma regla.
 */

import { nombreMoneda, numeroALetras } from "./numero-a-letras";
import { importesDelTexto } from "./requisitos-topes";

/** El corchete del formato, cuando aún no se ha registrado el monto. */
export const HUECO_MONTO_EXPERIENCIA =
  "CONSIGNAR EL MONTO DE FACTURACIÓN EXPRESADO EN NÚMEROS Y LETRAS EN LA MONEDA DE LA " +
  "CONVOCATORIA, MONTO QUE NO PODRÁ SER MAYOR A TRES VECES LA CUANTÍA DE LA CONTRATACIÓN O DEL ÍTEM";

/** Símbolo con el que se escribe la cifra: «S/» o «US$». */
function simboloMoneda(moneda?: string | null): string {
  return nombreMoneda(moneda) === "DÓLARES AMERICANOS" ? "US$" : "S/";
}

/**
 * El objeto en la frase «por la contratación de ___ iguales o similares».
 *
 * En bienes y servicios es directo. En obras y consultoría de obras la
 * experiencia se mide por especialidad y subespecialidad (Art. 157) y el texto
 * base difiere; se deja «obras»/«consultoría de obras» para no inventar la
 * redacción de un formato que ese objeto no usa igual.
 */
function objetoConvocatoria(objeto?: string | null): string {
  switch ((objeto ?? "").toLowerCase()) {
    case "bienes":
      return "bienes";
    case "obras":
      return "obras";
    case "consultoria_obra":
    case "consultoria_obras":
      return "consultoría de obras";
    default:
      return "servicios";
  }
}

/**
 * La cifra con su versión en letras: «S/ 180,000.00 (CIENTO OCHENTA MIL CON
 * 00/100 SOLES)».
 *
 * Sin monto —o con uno que no es un número positivo— conserva el corchete del
 * formato: en un documento que se firma, lo que falta tiene que verse.
 */
export function importeConLetras(monto: string | number | null | undefined, moneda?: string | null): string {
  // Se conserva un signo «-» inicial: sin él, «-5» se limpiaría a «5» y un
  // monto negativo pasaría por positivo en vez de caer en el corchete.
  const bruto = typeof monto === "number" ? monto : Number.parseFloat(String(monto ?? "").replace(/(?!^-)[^0-9.,]/g, "").replace(/,/g, "."));
  if (!Number.isFinite(bruto) || bruto <= 0) return `[${HUECO_MONTO_EXPERIENCIA}]`;
  const enNumeros = `${simboloMoneda(moneda)} ${bruto.toLocaleString("es-PE", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;
  return `${enNumeros} (${numeroALetras(bruto.toFixed(2), moneda)})`;
}

/**
 * El texto completo del requisito, con el monto dentro.
 *
 * El plazo son QUINCE años, que es lo que el formato fija para la experiencia
 * del postor (mismo tope que vigila `avisosDeTopes`).
 */
export function componerExperienciaPostor(args: {
  monto?: string | number | null;
  moneda?: string | null;
  objeto?: string | null;
}): string {
  return (
    `El postor debe acreditar un monto facturado acumulado equivalente a ${importeConLetras(args.monto, args.moneda)}, ` +
    `por la contratación de ${objetoConvocatoria(args.objeto)} iguales o similares al objeto de la convocatoria, ` +
    "durante los quince (15) años anteriores a la fecha de la presentación de ofertas que se computa desde la fecha " +
    "de la conformidad o emisión del comprobante de pago, según corresponda."
  );
}

/**
 * Rescata el monto de un detalle ya redactado, para volver a mostrarlo en el
 * campo numérico al reabrir la ficha.
 *
 * El detalle es la fuente de verdad —no hay columna aparte para el monto—, así
 * que se relee de él. `importesDelTexto` descarta lo que no es un importe
 * (plazos, cantidades); el primero es el monto exigido.
 */
export function montoDeExperiencia(detalle: string | null | undefined): string {
  const [primero] = importesDelTexto(detalle ?? "");
  return primero ? String(primero) : "";
}
