/**
 * Redacta el apartado FORMA DE PAGO a partir de lo que registra el área usuaria.
 *
 * El texto NO es libre: lo fija el Art. 67 de la Ley y el formato del OECE, y
 * solo tiene cinco huecos. Por eso se compone con una plantilla y no se le pide
 * a un modelo de lenguaje: parafrasear un artículo de la Ley en un documento que
 * se firma es un defecto, no una ayuda. Igual que con los apartados del modelo,
 * lo que tiene una respuesta exacta se calcula, no se genera.
 *
 * Este apartado no está en los PDF-modelo cargados; lo pide la entidad.
 */

/** Los cinco huecos del formato, en el orden en que aparecen en el texto. */
export type HuecosFormaPago = {
  /** Área que otorga la conformidad de la prestación. */
  areaConformidad: string;
  /** Dirección exacta de la dependencia donde se presenta la documentación. */
  direccion: string;
  /** Otra documentación exigible para el pago, además de los dos fijos. */
  documentacionAdicional: string;
  /** Dependencia donde se presenta: mesa de partes u otra. */
  lugarPresentacion: string;
  /** Pago único o pagos a cuenta, con su detalle. */
  tipoPago: string;
};

/** De dónde sale el área que otorga la conformidad, ya registrado en la ficha. */
export type DatosAreaConformidad = {
  /** «Área que otorga la conformidad» del Art. 144, en Otras condiciones. */
  area: string;
  /** Código Único de Inversión, de «b) Inversión a la que se imputa». */
  cui: string;
  /** Nombre del proyecto de inversión, del mismo subgrupo. */
  proyectoInversion: string;
};

/**
 * El área que otorga la conformidad, con la inversión a la que pertenece.
 *
 * Este dato ya está registrado tres veces en la ficha —el área en el apartado
 * del Art. 144, y el proyecto y su CUI en «b) Inversión a la que se imputa»—,
 * así que se trae de ahí en vez de pedir que se teclee otra vez en la forma de
 * pago.
 *
 * Y se trae ENTERO, no solo el nombre del área: la misma sub gerencia otorga
 * conformidades de varios proyectos a la vez, y quien paga necesita saber
 * contra cuál se firma esta.
 *
 * Sin área no se compone nada: el hueco del formato tiene que seguir viéndose
 * como lo que es. El proyecto y el CUI se añaden por separado —una ficha puede
 * tener el nombre del proyecto y aún no el código, o al revés—.
 */
export function componerAreaConformidad(d: Partial<DatosAreaConformidad>): string {
  const area = (d.area ?? "").trim();
  if (!area) return "";
  const partes = [area];
  const proyecto = (d.proyectoInversion ?? "").trim();
  if (proyecto) partes.push(`del proyecto de inversión «${proyecto}»`);
  const cui = (d.cui ?? "").trim();
  if (cui) partes.push(`con CUI ${cui}`);
  return partes.join(", ");
}

/**
 * Lo que se deja escrito cuando un hueco sigue vacío.
 *
 * Se conserva el corchete del formato original a propósito: el requerimiento se
 * firma, y un hueco sin rellenar tiene que verse como lo que es —algo que falta—
 * y no disolverse en una frase que parece completa.
 */
function hueco(valor: string, textoOriginal: string): string {
  const v = valor.trim();
  return v || `[${textoOriginal}]`;
}

/** ¿Queda algún hueco sin rellenar? Para avisar antes de firmar. */
export function huecosPendientes(h: Partial<HuecosFormaPago>): number {
  return [h.tipoPago, h.areaConformidad, h.documentacionAdicional, h.lugarPresentacion, h.direccion]
    .filter((v) => !(v ?? "").trim())
    .length;
}

/**
 * El texto completo del apartado.
 *
 * Los dos primeros párrafos y los dos documentos fijos son literales de la Ley y
 * del formato: no dependen de nada que el área usuaria escriba, así que no se
 * dejan a su criterio.
 */
export function componerFormaPago(h: Partial<HuecosFormaPago>): string {
  const lineas = [
    "El pago se realiza de conformidad con lo establecido en el artículo 67 de la Ley.",
    "",
    "La entidad contratante paga las contraprestaciones pactadas a favor del contratista dentro de los diez días hábiles siguientes de otorgada la conformidad por parte del área usuaria y es prorrogable, previa justificación de la demora, por cinco días hábiles.",
    "",
    "En el caso que se haya suscrito contrato con un consorcio, el pago se realiza, a quien corresponda, de acuerdo con lo que se indique en el contrato de consorcio.",
    "",
    `La entidad contratante realiza el pago de la contraprestación pactada a favor del contratista en ${hueco(h.tipoPago ?? "", "CONSIGNAR SI SE TRATA DE PAGO ÚNICO O PAGOS A CUENTA, ASÍ COMO EL DETALLE QUE CORRESPONDE EN EL CASO DE PAGO A CUENTA")}.`,
    "",
    "Para efectos del pago de las contraprestaciones ejecutadas por el contratista, la entidad contratante debe contar con la siguiente documentación:",
    `- Documento en el que conste la conformidad de la prestación efectuada suscrita por el servidor responsable del ${hueco(h.areaConformidad ?? "", "REGISTRAR LA DENOMINACIÓN DEL ÁREA RESPONSABLE DE OTORGAR LA CONFORMIDAD")}.`,
    "- Comprobante de pago.",
    `- ${hueco(h.documentacionAdicional ?? "", "CONSIGNAR OTRA DOCUMENTACIÓN NECESARIA A SER PRESENTADA PARA EL PAGO ÚNICO O LOS PAGOS A CUENTA, SEGÚN CORRESPONDA")}.`,
    "",
    `Salvo los documentos de conformidad, el contratista debe presentar la documentación restante en ${hueco(h.lugarPresentacion ?? "", "CONSIGNAR MESA DE PARTES O LA DEPENDENCIA ESPECÍFICA DE LA ENTIDAD CONTRATANTE DONDE SE DEBE PRESENTAR LA DOCUMENTACIÓN")}, sito en ${hueco(h.direccion ?? "", "CONSIGNAR LA DIRECCIÓN EXACTA")}.`,
  ];
  return lineas.join("\n");
}
