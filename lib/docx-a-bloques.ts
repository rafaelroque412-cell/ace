// Lee un .docx ya generado y lo devuelve como párrafos con formato.
//
// ── Por qué extraer del archivo y no componer aparte ──────────────────────────
//
// Para la vista previa de A6 (los tres documentos de designación de evaluadores)
// la fidelidad tiene que ser total: son formatos que se firman. La forma más
// segura de garantizarla es que la previa SEA el archivo —no una segunda
// composición que podría desviarse—, así que se genera el .docx con el mismo
// `buildEvaluadorDoc` que la descarga y se lee de vuelta.
//
// Se lee el XML de `word/document.xml`, que es lo que Word abre. Un .docx es un
// ZIP; se descomprime con `jszip`, la misma librería que `docx` usa para
// escribirlo (declarada como dependencia directa para no depender de un árbol
// transitivo en runtime).

import JSZip from "jszip";

/** Fragmento con su énfasis, tal como está en el documento. */
export type FragmentoDocx = {
  texto: string;
  negrita: boolean;
  cursiva: boolean;
  subrayado: boolean;
};

export type ParrafoDocx = {
  /** "left" | "center" | "right" | "both" (justificado), o "" si no se declara. */
  alineacion: string;
  fragmentos: FragmentoDocx[];
};

/** Quita las etiquetas XML de un fragmento y decodifica las entidades básicas. */
function limpiar(xml: string): string {
  return xml
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

/**
 * Un `<w:r>` (run) → fragmento con su formato.
 *
 * El texto puede venir en varios `<w:t>` y llevar `<w:tab/>` o `<w:br/>` en
 * medio, que se traducen a una tabulación y un salto de línea para que la previa
 * respete la maqueta del documento.
 */
function leerRun(runXml: string): FragmentoDocx {
  const props = runXml.match(/<w:rPr>[\s\S]*?<\/w:rPr>/)?.[0] ?? "";
  let texto = "";
  for (const m of runXml.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>|<w:tab\s*\/>|<w:br\s*\/>/g)) {
    if (m[0].startsWith("<w:tab")) texto += "\t";
    else if (m[0].startsWith("<w:br")) texto += "\n";
    else texto += limpiar(m[1] ?? "");
  }
  return {
    // `<w:b/>` marca negrita; `<w:b w:val="false"/>` la desmarca.
    cursiva: /<w:i\s*\/>|<w:i\s+w:val="(?:true|1|on)"/.test(props),
    negrita: /<w:b\s*\/>|<w:b\s+w:val="(?:true|1|on)"/.test(props),
    subrayado: /<w:u\b/.test(props) && !/<w:u\s+w:val="none"/.test(props),
    texto,
  };
}

/**
 * `.docx` (buffer) → lista de párrafos con formato.
 *
 * Los párrafos vacíos se conservan: en estos formatos el espaciado en blanco
 * (líneas de firma, separaciones) es parte de la maqueta, no ruido.
 */
export async function leerDocx(buffer: Buffer | Uint8Array): Promise<ParrafoDocx[]> {
  const zip = await JSZip.loadAsync(buffer);
  const xml = (await zip.file("word/document.xml")?.async("string")) ?? "";

  const parrafos: ParrafoDocx[] = [];
  // `<w:p …>…</w:p>` o `<w:p/>` autocerrado (un párrafo vacío de la maqueta).
  for (const p of xml.matchAll(/<w:p\b[^>]*\/>|<w:p\b[\s\S]*?<\/w:p>/g)) {
    const bloque = p[0];
    const alineacion = bloque.match(/<w:jc\s+w:val="([^"]+)"/)?.[1] ?? "";
    const fragmentos: FragmentoDocx[] = [];
    for (const r of bloque.matchAll(/<w:r\b[\s\S]*?<\/w:r>/g)) {
      const frag = leerRun(r[0]);
      if (frag.texto) fragmentos.push(frag);
    }
    parrafos.push({ alineacion, fragmentos });
  }
  return parrafos;
}
