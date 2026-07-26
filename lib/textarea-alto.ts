/**
 * Alto de un textarea en filas, proporcional a lo que contiene.
 *
 * Los formularios de la necesidad tenían todos los textarea con un alto fijo
 * (`rows={2}` en la ficha, `rows={3}` en el editor de requisitos). Con eso no se
 * lee ni un párrafo: desde que la sección 3.4 puede recibir el EETT/TDR completo
 * y el traslado de la propuesta IA rellena las condiciones y los requisitos del
 * Art. 72.3, revisar lo que se va a firmar obligaba a desplazarse dentro de una
 * caja de dos o tres líneas.
 *
 * Vive en `lib` y no junto a un componente porque lo usan dos que se importan
 * entre sí: la ficha (`necesidad-detail`) importa el editor de requisitos, así
 * que el editor no puede importar de la ficha sin cerrar un ciclo.
 */
export function filasTextarea(valor: string, wide?: boolean): number {
  const texto = valor ?? "";
  const min = wide ? 4 : 2;
  const max = wide ? 18 : 12;
  if (!texto) return min;
  // Se estima por saltos de línea Y por longitud: un párrafo corrido sin saltos
  // también necesita alto.
  const porSaltos = texto.split(/\r?\n/).length;
  const porLargo = Math.ceil(texto.length / (wide ? 105 : 52));
  // Con tope, para que un campo enorme no empuje el resto del formulario fuera
  // de la pantalla: a partir de ahí manda el scroll interno.
  return Math.min(max, Math.max(min, Math.max(porSaltos, porLargo) + 1));
}
