import { APARTADOS_MODELO } from "./modelo-apartados";
import { FICHA_SECCIONES } from "./necesidad-ficha-secciones";

/**
 * Qué apartados lleva el Word del requerimiento, y cómo se pinta cada uno.
 *
 * El documento salía con NUEVE secciones fijas, iguales para una Subasta Inversa
 * de bienes que para una Licitación Pública de obras. Los modelos del OECE no
 * piden lo mismo: los de obras traen metas físicas y fórmulas de reajuste, y el
 * procedimiento no competitivo no trae ni penalidades ni subcontratación.
 *
 * Así que la estructura la manda el MODELO del procedimiento, con los apartados
 * que `modelo-apartados.ts` detecta. Este módulo es la parte pura —de nombres de
 * apartado a secciones con sus campos— para poder probarla sin generar un .docx.
 */

/** Cómo se pinta un campo en el documento. */
export type FormatoCampo = "linea" | "parrafo" | "tabla" | "vinetas";

export type CampoRequerimiento = {
  formato: FormatoCampo;
  /** api del campo en la ficha; el renderizador lo necesita para los estructurados. */
  api: string;
  label: string;
  valor: string;
};

export type SeccionRequerimiento = {
  campos: CampoRequerimiento[];
  /** Cita legal del apartado; va en cursiva, como en los modelos del OECE. */
  nota?: string;
  titulo: string;
};

/** api del campo -> su etiqueta y su `kind` en la ficha. */
const CATALOGO = (() => {
  const m = new Map<string, { baseLegal?: string; kind?: string; label: string }>();
  for (const s of FICHA_SECCIONES) for (const f of s.fields) m.set(f.api, { baseLegal: f.baseLegal, kind: f.kind, label: f.label });
  return m;
})();

/**
 * El `kind` de la ficha ya distingue los campos estructurados, así que el
 * formato se deriva de él en vez de mantener una segunda lista que se
 * desincronice.
 */
function formatoDe(api: string): FormatoCampo {
  const kind = CATALOGO.get(api)?.kind;
  if (kind === "penalidades") return "tabla";
  if (kind === "requisitos") return "vinetas";
  if (kind === "textarea" || kind === "controversias" || kind === "subcontratacion") return "parrafo";
  return "linea";
}

/**
 * Título del apartado tal como va en el documento.
 *
 * Se quita la numeración del modelo («3.5 ») porque el Word numera sus propias
 * secciones, y el «(obras)» de la tabla de apartados, que es una nota para quien
 * lee el código, no parte del nombre oficial.
 */
export function tituloDeApartado(apartado: string): string {
  return apartado
    .replace(/^\d+(?:\.\d+)*\s+/, "")
    .replace(/\s*\((?:obras)\)\s*$/i, "")
    .toUpperCase();
}

/**
 * Estructura de reserva cuando el procedimiento no tiene modelo cargado.
 *
 * Son los apartados que el Art. 44.2 pide en TODO requerimiento, sea cual sea el
 * procedimiento. Degradar así es lo mismo que ya hace la ficha sin modelo: se
 * queda corta, no se rompe.
 */
export const SECCIONES_BASE: ReadonlyArray<{ apis: readonly string[]; titulo: string }> = [
  { apis: ["finalidadPublica"], titulo: "FINALIDAD PÚBLICA" },
  { apis: ["descripcionGeneral"], titulo: "DESCRIPCIÓN GENERAL" },
  { apis: ["descripcionDetallada"], titulo: "ESPECIFICACIONES TÉCNICAS O TÉRMINOS DE REFERENCIA" },
  { apis: ["plazoEjecucion", "plazoEjecucionUnidad"], titulo: "PLAZO DE EJECUCIÓN" },
  { apis: ["lugarEntrega", "departamento", "provincia", "distrito"], titulo: "LUGAR DE ENTREGA O PRESTACIÓN" },
  { apis: ["requisitosCalificacion"], titulo: "REQUISITOS DE CALIFICACIÓN" },
];

function campo(api: string, ficha: Record<string, string>): CampoRequerimiento {
  return {
    api,
    formato: formatoDe(api),
    label: CATALOGO.get(api)?.label ?? api,
    valor: (ficha[api] ?? "").trim(),
  };
}

/**
 * Las secciones del documento, en el orden en que el modelo las trae.
 *
 * Un apartado que el modelo pide y la ficha no rellenó sale IGUAL, vacío: el
 * requerimiento se firma, y un apartado que desaparece sin que nadie lo note es
 * peor que uno en blanco que se ve.
 */
export function estructuraDelRequerimiento(
  apartados: readonly string[],
  ficha: Record<string, string>,
): SeccionRequerimiento[] {
  if (apartados.length === 0) {
    return SECCIONES_BASE.map((s) => ({
      campos: s.apis.map((api) => campo(api, ficha)),
      nota: CATALOGO.get(s.apis[0])?.baseLegal,
      titulo: s.titulo,
    }));
  }
  const secciones: SeccionRequerimiento[] = [];
  for (const nombre of apartados) {
    const entrada = APARTADOS_MODELO.find((a) => a.apartado === nombre);
    if (!entrada) continue;
    const titulo = tituloDeApartado(nombre);
    // Dos apartados del modelo pueden mapear al mismo título (p. ej. «Fórmula de
    // reajuste» y «Fórmulas de reajustes»): se funden en uno.
    const ya = secciones.find((s) => s.titulo === titulo);
    const campos = entrada.apis.map((api) => campo(api, ficha));
    if (ya) {
      for (const c of campos) if (!ya.campos.some((x) => x.api === c.api)) ya.campos.push(c);
    } else {
      secciones.push({ campos, nota: CATALOGO.get(entrada.apis[0])?.baseLegal, titulo });
    }
  }
  return secciones;
}
