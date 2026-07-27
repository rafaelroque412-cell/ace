// Requerimiento de la contratación en Word (Módulo 1), a partir de la Ficha de
// Necesidad. Reproduce la estructura del Art. 44 de la Ley 32069 / Reglamento:
// finalidad pública, objeto, descripción (EETT/TDR), alcance y condiciones,
// requisitos de calificación (Art. 72.3), lugar de entrega y datos
// presupuestales. Es el documento que el ÁREA USUARIA remite a la DEC.
//
// Mismo cimiento que los demás .docx de la app (docx + Arial 10pt): un documento
// que se firma, no una vista paralela.

import {
  AlignmentType,
  Document,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import { cuantiaPorSumatoria, importeItem, type NecesidadItem } from "./necesidad-items";
import type { ObjetoFilter } from "./procesos-seleccion";
import { parseOtrasPenalidades, textoLibrePenalidades } from "./otras-penalidades";
import { parseRequisitos } from "./requisitos-calificacion";
import {
  type CampoRequerimiento,
  estructuraDelRequerimiento,
} from "./requerimiento-estructura";

const FUENTE = "Arial";
const TAM = 21; // 10,5 pt
const TAM_TITULO = 26; // 13 pt

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

export type RequerimientoDocInput = {
  /** Apartados que trae el MODELO del procedimiento, en su orden. */
  apartados?: readonly string[];
  /** Valores de la ficha por api. */
  ficha?: Record<string, string>;
  /** Objeto contractual; descarta los campos que no aplican. */
  objeto?: ObjetoFilter | "";
  /** Procedimiento de seleccion; acota igual que el objeto. */
  proceso?: string;
  codigo: string;
  entidad: string;
  areaUsuaria: string;
  responsable: string;
  /** Ciudad (Configuración → Municipalidad), para la fecha del pie. */
  lugar: string;
  /** ISO aaaa-mm-dd de emisión (hoy). */
  fecha: string;
  nombre: string;
  finalidadPublica: string;
  objetoLabel: string;
  descripcionDetallada: string;
  cantidad: string;
  unidadMedida: string;
  /**
   * Desagregado del requerimiento (Art. 52). Cuando lo hay, sustituye a la línea
   * "Cantidad": un requerimiento de varias prestaciones no cabe en un renglón, y
   * la cuantía que corresponde es la sumatoria (Art. 53.3).
   */
  items?: NecesidadItem[];
  alcance: string;
  condicionesEjecucion: string;
  plazoEjecucion: string;
  modalidadPago: string;
  sistemaEntrega: string;
  garantias: string;
  penalidadMora: string;
  adelantoDirecto: string;
  subcontratacion: string;
  formulaReajuste: string;
  recepcionConformidad: string;
  requisitosCalificacion: string;
  departamento: string;
  provincia: string;
  distrito: string;
  lugarEntrega: string;
  metaPresupuestal: string;
  fuenteFinanciamiento: string;
  clasificadorGasto: string;
  montoEstimado: string;
};

const texto = (v: string | null | undefined) => (v ?? "").trim();

/** Para comparar un titulo con una etiqueta: sin acentos, sin letra de orden. */
function normalizar(v: string): string {
  return v
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/^[a-z]\)\s*/, "")
    .replace(/[^a-z0-9]/g, "");
}

function run(text: string, opts?: { bold?: boolean; italics?: boolean; size?: number }): TextRun {
  return new TextRun({ text, bold: opts?.bold, italics: opts?.italics, font: FUENTE, size: opts?.size ?? TAM });
}

/** Párrafo justificado con aire debajo. */
function p(children: TextRun[], align: (typeof AlignmentType)[keyof typeof AlignmentType] = AlignmentType.JUSTIFIED): Paragraph {
  return new Paragraph({ alignment: align, spacing: { after: 140, line: 276 }, children });
}

/** Encabezado de sección numerado ("1. FINALIDAD PÚBLICA"). */
/**
 * Titulo de apartado.
 *
 * La ficha ya numera las suyas —«3.1 Finalidad publica»— asi que anteponerles un
 * contador daba «4. 3.1 FINALIDAD PUBLICA». Cuando el titulo ya empieza por un
 * numero, se respeta el suyo.
 */
function seccion(numero: number, titulo: string): Paragraph {
  if (/^\d/.test(titulo)) {
    return new Paragraph({
      spacing: { after: 100, before: 200 },
      children: [run(titulo, { bold: true })],
    });
  }
  return new Paragraph({
    spacing: { before: 200, after: 100 },
    children: [run(`${numero}. ${titulo}`, { bold: true })],
  });
}

/** Texto de contenido; si viene vacío, un guion tenue para no dejar el hueco. */
function contenido(valor: string): Paragraph {
  return p([run(texto(valor) || "—")]);
}

/** Línea "Etiqueta: valor". Devuelve null si el valor está vacío (se omite). */
function linea(etiqueta: string, valor: string): Paragraph | null {
  if (!texto(valor)) return null;
  return p([run(`${etiqueta}: `, { bold: true }), run(texto(valor))], AlignmentType.LEFT);
}

/** Celda de la tabla de ítems. Las cifras a la derecha, el texto a la izquierda. */
function celda(valor: string, opts?: { bold?: boolean; derecha?: boolean; ancho?: number }): TableCell {
  return new TableCell({
    children: [
      p(
        [run(valor, { bold: opts?.bold })],
        opts?.derecha ? AlignmentType.RIGHT : AlignmentType.LEFT,
      ),
    ],
    width: opts?.ancho ? { size: opts.ancho, type: WidthType.PERCENTAGE } : undefined,
  });
}

const importeTexto = (n: number | null): string =>
  n === null ? "" : n.toLocaleString("es-PE", { maximumFractionDigits: 2, minimumFractionDigits: 2 });

/**
 * Cuadro del desagregado (Art. 52): una fila por ítem.
 *
 * Lleva el N° porque el ítem se cita por número en todo lo que viene después
 * —"el ítem 3 se declara desierto"— y sin él la tabla no sirve de referencia.
 */
function tablaItems(items: NecesidadItem[]): Table {
  const cabecera = new TableRow({
    children: [
      celda("N°", { ancho: 6, bold: true }),
      celda("Descripción", { ancho: 46, bold: true }),
      celda("Unidad", { ancho: 12, bold: true }),
      celda("Cantidad", { ancho: 12, bold: true, derecha: true }),
      celda("C. unitario", { ancho: 12, bold: true, derecha: true }),
      celda("Importe", { ancho: 12, bold: true, derecha: true }),
    ],
    tableHeader: true,
  });

  const filas = items.map(
    (item) =>
      new TableRow({
        children: [
          celda(String(item.nro)),
          celda(texto(item.descripcion)),
          celda(texto(item.unidadMedida)),
          celda(item.cantidad === null || item.cantidad === undefined ? "" : String(item.cantidad), {
            derecha: true,
          }),
          celda(importeTexto(item.costoUnitario ?? null), { derecha: true }),
          celda(importeTexto(importeItem(item)), { derecha: true }),
        ],
      }),
  );

  return new Table({
    rows: [cabecera, ...filas],
    width: { size: 100, type: WidthType.PERCENTAGE },
  });
}

function fechaLarga(iso: string, lugar: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "");
  const base = m ? `${Number(m[3])} de ${MESES[Number(m[2]) - 1] ?? ""} del ${m[1]}` : "______________";
  return lugar ? `${lugar}, ${base}` : base;
}


/** Campos que son dinero: se imprimen como importe, no como numero. */
const IMPORTES = new Set(["montoEstimado", "costoUnitario", "costoTotal", "valorEstimado"]);

/** Viñeta de primer nivel. El modelo del OECE lista así los requisitos. */
function vineta(texto_: string): Paragraph {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { after: 40 },
    children: [run(texto_)],
  });
}

/** Cita legal bajo el título, en cursiva como en los modelos del OECE. */
function nota(texto_: string): Paragraph {
  return new Paragraph({ spacing: { after: 80 }, children: [run(texto_, { italics: true })] });
}

/** Cuadro de penalidades distintas a la mora (Art. 119.2). */
function tablaPenalidades(filas: ReturnType<typeof parseOtrasPenalidades>): Table {
  const cabecera = new TableRow({
    children: [
      celda("N°", { ancho: 6, bold: true }),
      celda("Supuesto de aplicación", { ancho: 40, bold: true }),
      celda("Forma de cálculo", { ancho: 27, bold: true }),
      celda("Procedimiento", { ancho: 27, bold: true }),
    ],
    tableHeader: true,
  });
  return new Table({
    rows: [
      cabecera,
      ...filas.map((f, i) =>
        new TableRow({
          children: [
            celda(String(i + 1)),
            celda(f.supuesto ?? ""),
            celda(f.calculo ?? ""),
            celda(f.verificacion ?? ""),
          ],
        }),
      ),
    ],
    width: { size: 100, type: WidthType.PERCENTAGE },
  });
}

/**
 * Pinta un campo según lo que es, no según lo que parece.
 *
 * Los tres estructurados —requisitos, penalidades adicionales y el resto— se
 * guardan serializados en una columna de texto. Volcarlos tal cual metía JSON
 * crudo en un documento que se firma.
 */
function pintarCampo(c: CampoRequerimiento, solo: boolean): Array<Paragraph | Table> {
  if (!c.valor) return [contenido("")];

  if (c.formato === "tabla") {
    const filas = parseOtrasPenalidades(c.valor);
    const libre = textoLibrePenalidades(c.valor);
    const out: Array<Paragraph | Table> = [];
    if (filas.length > 0) out.push(tablaPenalidades(filas));
    if (libre) out.push(contenido(libre));
    return out.length > 0 ? out : [contenido(c.valor)];
  }

  if (c.formato === "vinetas") {
    const r = parseRequisitos(c.valor);
    const out: Array<Paragraph | Table> = [];
    if (r.obligatorios.length > 0) {
      out.push(new Paragraph({ spacing: { after: 40 }, children: [run("Obligatorios:", { bold: true })] }));
      // Los obligatorios son cadenas: los fija la norma y no se sustentan.
      for (const req of r.obligatorios) out.push(vineta(req));
    }
    if (r.facultativos.length > 0) {
      out.push(new Paragraph({ spacing: { before: 80, after: 40 }, children: [run("Facultativos:", { bold: true })] }));
      for (const req of r.facultativos) {
        out.push(vineta(req.sustento ? `${req.nombre}: ${req.sustento}` : req.nombre));
      }
    }
    return out.length > 0 ? out : [contenido(c.valor)];
  }

  // Los importes se formatean: «75920» en un documento que se firma no es una
  // cifra, es un numero suelto.
  if (IMPORTES.has(c.api)) {
    const n = Number(c.valor.replace(/,/g, ""));
    const v = Number.isFinite(n) ? importeTexto(n) : c.valor;
    return [solo ? p([run(v)]) : (linea(c.label, v) ?? contenido(""))];
  }

  if (c.formato === "linea") {
    // Con un solo campo, el titulo del apartado YA dice que es: repetir la
    // etiqueta daba «8. PLAZO DE PRESTACION» y debajo «Plazo de prestacion: 52
    // dias», que es la pantalla copiada, no un documento.
    const l = solo ? p([run(c.valor)]) : linea(c.label, c.valor);
    return l ? [l] : [contenido("")];
  }

  // Párrafo: una linea del campo, un parrafo del documento. Las que empiezan por
  // guion o punto se convierten en viñeta, que es como el area usuaria las
  // escribe y como el modelo las pide.
  return c.valor.split(/\r?\n/).filter((x) => x.trim()).map((x) => {
    const limpio = x.trim();
    return /^[-•*]\s+/.test(limpio) ? vineta(limpio.replace(/^[-•*]\s+/, "")) : contenido(limpio);
  });
}

export async function generarRequerimientoDocx(input: RequerimientoDocInput): Promise<Buffer> {
  // Párrafos y, desde el desagregado del Art. 52, también tablas.
  const children: Array<Paragraph | Table> = [];

  // Encabezado.
  children.push(
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: [run("REQUERIMIENTO", { bold: true, size: TAM_TITULO })] }),
  );
  if (texto(input.entidad)) {
    children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 }, children: [run(texto(input.entidad), { bold: true })] }));
  }
  if (texto(input.codigo)) {
    children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 160 }, children: [run(texto(input.codigo))] }));
  }

  // Cabecera de identificación.
  for (const [et, val] of [
    ["Área usuaria", input.areaUsuaria],
    ["Responsable", input.responsable],
  ] as const) {
    const l = linea(et, val);
    if (l) children.push(l);
  }

  // 1. Denominación.
  // 1. Denominacion: la cabecera del requerimiento, en todos los modelos.
  children.push(seccion(1, "DENOMINACIÓN DE LA CONTRATACIÓN"));
  children.push(contenido(input.nombre));

  // El resto lo manda el MODELO del procedimiento. Antes eran nueve secciones
  // fijas, iguales para una Subasta Inversa de bienes que para una Licitacion de
  // obras; los modelos del OECE no piden lo mismo. Sin modelo cargado se cae a
  // la estructura base del Art. 44.2, que se queda corta pero no se rompe.
  let numero = 2;
  for (const s of estructuraDelRequerimiento(input.apartados ?? [], input.ficha ?? {}, {
    objeto: input.objeto,
    proceso: input.proceso,
  })) {
    children.push(seccion(numero, s.titulo));
    numero += 1;
    if (s.nota) children.push(nota(s.nota));
    let subgrupoActual: string | undefined;
    for (const c of s.campos) {
      // El subgrupo de la ficha —«a) Modalidad de pago»— es el mismo apartado
      // con letra del modelo del OECE, asi que encabeza sus campos igual que
      // alli. Solo cuando cambia: repetirlo por campo seria ruido.
      if (c.subgrupo && c.subgrupo !== subgrupoActual) {
        children.push(
          new Paragraph({
            spacing: { after: 40, before: 120 },
            children: [run(c.subgrupo, { bold: true })],
          }),
        );
        subgrupoActual = c.subgrupo;
      }
      // La etiqueta se omite solo si el encabezado de arriba YA dice que es.
      // «a) Modalidad de pago» + «SUMA ALZADA» se lee; «a) Programacion en el
      // CMN y el PAC» + «168» no dice nada.
      const unicoDelGrupo =
        Boolean(c.subgrupo) && s.campos.filter((x) => x.subgrupo === c.subgrupo).length === 1;
      const encabezadoLoDice =
        unicoDelGrupo && normalizar(c.subgrupo ?? "").includes(normalizar(c.label));
      const soloEnSuGrupo = encabezadoLoDice || (s.campos.length === 1 && !c.subgrupo);
      // Con etiqueta propia se rotula; si el subgrupo o el titulo ya lo dicen, no.
      if (!soloEnSuGrupo && c.formato !== "linea" && s.campos.length > 1) {
        children.push(
          new Paragraph({
            spacing: { after: 40, before: 60 },
            children: [run(`${c.label}:`, { bold: true })],
          }),
        );
      }
      children.push(...pintarCampo(c, soloEnSuGrupo));
      // El desagregado del Art. 52 va donde va la descripcion, que es lo que
      // desagrega.
      if (c.api === "descripcionDetallada" && (input.items ?? []).length > 0) {
        children.push(tablaItems(input.items ?? []));
        const cuantia = cuantiaPorSumatoria(input.items ?? []);
        if (cuantia !== null) {
          children.push(
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              spacing: { before: 60 },
              children: [run(`Valor estimado por sumatoria: ${importeTexto(cuantia)}`, { bold: true })],
            }),
          );
        }
      }
    }
  }

  // Pie: fecha y firma.
  children.push(new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { before: 300, after: 300 }, children: [run(fechaLarga(input.fecha, input.lugar))] }));
  children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [run("_______________________________")] }));
  children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [run(texto(input.responsable) || "Responsable del área usuaria", { bold: true })] }));
  if (texto(input.areaUsuaria)) {
    children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [run(texto(input.areaUsuaria))] }));
  }

  const doc = new Document({
    styles: { default: { document: { run: { font: FUENTE, size: TAM } } } },
    sections: [{ properties: { page: { margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } }, children }],
  });
  return Buffer.from(await Packer.toBuffer(doc));
}
