// Utilidades puras de normalizacion de texto extraido de PDFs.

// Repara ligaduras tipograficas (ﬁ ﬂ ﬀ ﬃ ﬄ) que pdf-parse suele extraer como
// "fi"/"fl"/... seguidas de un espacio espurio que parte la palabra
// ("modifi cacion" -> "modificacion", "defi nitiva" -> "definitiva",
// "para fi nes" -> "para fines"). Estrategia segura: solo une la ligadura con la
// palabra de la DERECHA (la siguiente letra minuscula). Nunca quita el espacio
// previo, para no fusionar la palabra anterior ("para fi nes" no se vuelve
// "parafines"). Como "fi"/"fl"/"ff" no son palabras en espanol, unir " fi X" es
// seguro salvo casos rarisimos (p. ej. "wifi"), inexistentes en texto legal.
export function repairLigatures(text: string) {
  return text
    .replace(/ﬃ/g, "ffi")
    .replace(/ﬄ/g, "ffl")
    .replace(/ﬀ/g, "ff")
    .replace(/ﬁ/g, "fi")
    .replace(/ﬂ/g, "fl")
    .replace(/(ffi|ffl|ff|fi|fl) ([a-záéíóúüñ])/g, "$1$2");
}
