// ¿Está lista la Necesidad para remitirse a la DEC?
//
// La Necesidad ES el requerimiento del Art. 44. Hoy se rellenan 59 campos y se
// pulsa "remitir" sin que nada diga si lo que hay dentro se sostiene: los fallos
// aparecen después, en el expediente o en el Excel firmado.
//
// Se agrupa POR ARTÍCULO y no por sección del formulario a propósito: así quien
// formula aprende de dónde sale la exigencia mientras trabaja. Un grupo llamado
// "Campos pendientes" no enseña nada.
//
// Tres niveles, y la diferencia importa:
//   stop → no debería poder remitirse. Es una afirmación que alguien firma.
//   warn → conviene mirarlo, pero puede haber un motivo legítimo.
//   ok   → conforme.
//
// Ojo con el Art. 44.2: enumera las condiciones de contratación "como mínimo lo
// siguiente, DE CORRESPONDER". No son obligatorias todas siempre — por eso casi
// todo ahí es `warn` y no `stop`. Tratarlas como obligatorias sería inventarse
// una exigencia que la norma no hace.

import type { Necesidad } from "./necesidades";

export type NivelVerificacion = "ok" | "warn" | "stop";

export type ItemVerificacion = {
  /** Lo que se comprueba, en las palabras del usuario. */
  etiqueta: string;
  nivel: NivelVerificacion;
  /** Por qué importa y qué pasa si se deja así. Solo cuando no está conforme. */
  porque?: string;
  /** Clave `api` del campo, para llevar al usuario hasta él. */
  campo?: string;
};

export type GrupoVerificacion = {
  /** El artículo que exige esto: "Art. 44.1 · Finalidad pública". */
  articulo: string;
  items: ItemVerificacion[];
};

const vacio = (v: unknown) => !(typeof v === "string" ? v.trim() : v);

/** Hoy en ISO, inyectable para poder testear sin depender del reloj. */
function hoyISO(hoy?: string): string {
  if (hoy) return hoy;
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function art441(n: Necesidad): GrupoVerificacion {
  const items: ItemVerificacion[] = [];
  items.push(
    vacio(n.finalidad_publica)
      ? {
          etiqueta: "Finalidad pública",
          nivel: "stop",
          porque:
            "El Art. 44.1 es la razón de ser del requerimiento: la contratación atiende una necesidad para cumplir una finalidad pública. Sin ella no hay nada que contratar.",
          campo: "finalidadPublica",
        }
      : { etiqueta: "Finalidad pública declarada", nivel: "ok" },
  );
  // El "objetivo de la contratación" se retiró de la ficha: era sustento de la
  // finalidad pública y no lo consumía ninguna fase. Lo que el Art. 44.1 exige
  // —y lo único que se comprueba— es la finalidad pública.
  return { articulo: "Art. 44.1 · Finalidad pública", items };
}

function art4410(n: Necesidad): GrupoVerificacion {
  const items: ItemVerificacion[] = [];
  items.push(
    vacio(n.tipo_objeto)
      ? { etiqueta: "Objeto de la contratación", nivel: "stop", porque: "El Art. 44.10 determina el objeto según la naturaleza de la contratación. De él dependen el procedimiento (Art. 54.1) y los requisitos.", campo: "tipoObjeto" }
      : { etiqueta: "Objeto de la contratación", nivel: "ok" },
  );
  items.push(
    vacio(n.descripcion_detallada)
      ? {
          etiqueta: "Especificaciones técnicas o TDR",
          nivel: "stop",
          porque:
            "El Art. 126.1 exige describir qué se contrata. Sin esto, el expediente no puede elaborar bases ni el mercado puede cotizar.",
          campo: "descripcionDetallada",
        }
      : { etiqueta: "Especificaciones técnicas o TDR", nivel: "ok" },
  );
  const sinCantidad = !Number(n.cantidad) || vacio(n.unidad_medida);
  items.push(
    sinCantidad
      ? { etiqueta: "Cantidad y unidad de medida", nivel: "warn", porque: "Sin cantidad, el mercado no puede cotizar y la cuantía no se sostiene.", campo: "cantidad" }
      : { etiqueta: "Cantidad y unidad de medida", nivel: "ok" },
  );
  return { articulo: "Art. 44.10 · Objeto y descripción", items };
}

/**
 * Art. 44.2: las condiciones de contratación se incluyen "como mínimo lo
 * siguiente, DE CORRESPONDER". La norma no las hace obligatorias todas, así que
 * aquí se avisa; no se bloquea.
 */
function art442(n: Necesidad): GrupoVerificacion {
  const items: ItemVerificacion[] = [];
  items.push(
    vacio(n.alcance)
      ? { etiqueta: "a) Alcance y condiciones de ejecución", nivel: "warn", porque: "El Art. 44.2.a lo pide en función del desempeño y la funcionalidad. En obras y consultoría de obras es obligatorio (Art. 154.1).", campo: "alcance" }
      : { etiqueta: "a) Alcance y condiciones de ejecución", nivel: "ok" },
  );
  items.push(
    vacio(n.requisitos_calificacion)
      ? { etiqueta: "b) Propuesta de requisitos de calificación", nivel: "warn", porque: "Si no propones ninguno, la DEC los fijará sola (Art. 72.1) y el expediente saldrá sin tu criterio.", campo: "requisitosCalificacion" }
      : { etiqueta: "b) Propuesta de requisitos de calificación", nivel: "ok" },
  );
  items.push(
    vacio(n.modalidad_pago)
      ? { etiqueta: "c) Propuesta de modalidad de pago", nivel: "warn", porque: "De corresponder. Si no aplica, déjalo dicho: en blanco no se distingue de «no lo he mirado».", campo: "modalidadPago" }
      : { etiqueta: "c) Propuesta de modalidad de pago", nivel: "ok" },
  );
  items.push(
    vacio(n.sistema_entrega)
      ? { etiqueta: "c) Propuesta de sistema de entrega", nivel: "warn", porque: "De corresponder. Si no aplica, déjalo dicho: en blanco no se distingue de «no lo he mirado».", campo: "sistemaEntrega" }
      : { etiqueta: "c) Propuesta de sistema de entrega", nivel: "ok" },
  );
  return { articulo: "Art. 44.2 · Condiciones de contratación (de corresponder)", items };
}

/**
 * Art. 44.6: el requerimiento no incluye exigencias desproporcionadas e
 * innecesarias que limiten la concurrencia.
 *
 * "Desproporcionado" es un juicio y no lo hace un programa. Lo que sí es un
 * hecho es la PAREJA: pedir S/ 200,000 de experiencia para una compra de
 * S/ 90,000. Se enseñan los dos números y decide la persona.
 */
function art446(n: Necesidad): ItemVerificacion | null {
  const monto = Number(n.monto_estimado);
  const texto = typeof n.requisitos_calificacion === "string" ? n.requisitos_calificacion : "";
  if (!Number.isFinite(monto) || monto <= 0 || !texto.trim()) return null;
  // Importes en soles dentro del texto de los requisitos.
  const importes = [...texto.matchAll(/S\/\.?\s*([\d,]+(?:\.\d+)?)/g)]
    .map((m) => Number(m[1].replace(/,/g, "")))
    .filter((v) => Number.isFinite(v) && v > 0);
  const mayor = importes.length ? Math.max(...importes) : 0;
  if (mayor <= monto) return null;
  const veces = (mayor / monto).toFixed(1);
  return {
    etiqueta: "Requisitos proporcionados al monto",
    nivel: "warn",
    porque: `Los requisitos exigen hasta S/ ${mayor.toLocaleString("en-US")} y la contratación se estima en S/ ${monto.toLocaleString("en-US")} (${veces}×). El Art. 44.6 prohíbe exigencias desproporcionadas que limiten la concurrencia. Si es intencionado, ignóralo.`,
    campo: "requisitosCalificacion",
  };
}

/**
 * Lo que el EXPEDIENTE va a exigir (Arts. 54.2 y 54.3), comprobado aquí.
 *
 * Estos dos datos no bloquean remitir —y no deben hacerlo—, pero sí impiden
 * APROBAR el expediente más adelante (`lib/expediente-contenido.ts`). Hasta
 * ahora el aviso saltaba allí: en otra pantalla, en otra fase y ante otra
 * persona, cuando quien podía resolverlo era el área usuaria. Se comprueban en
 * la ficha para que el impedimento se conozca antes de remitir, no después.
 *
 * Se avisa, no se bloquea, por dos razones distintas:
 *   - CMN: el Art. 42.3 contempla la contratación NO PROGRAMADA, que se segmenta
 *     tras recibir el requerimiento. Exigir el CMN para remitir cerraría una vía
 *     que la norma abre.
 *   - Estandarizado: el 54.2.a pide DECLARARLO, no que lo esté. Una casilla sin
 *     marcar puede ser una declaración legítima ("no está estandarizado").
 */
function art54(n: Necesidad): GrupoVerificacion {
  const items: ItemVerificacion[] = [];

  items.push(
    n.cmn_verificado === true
      ? { etiqueta: "La necesidad consta en el CMN", nivel: "ok" }
      : {
          etiqueta: "La necesidad aún no consta en el CMN",
          nivel: "warn",
          porque:
            "El Art. 54.3 impide APROBAR el expediente si la necesidad no está prevista en el CMN aprobado del año fiscal o en su modificatoria. Puedes remitir igualmente —el Art. 42.3 permite la contratación no programada, que se segmenta después—, pero el expediente se quedará atascado en ese punto hasta resolverlo.",
          campo: "cmnVerificado",
        },
  );

  // El 54.2.a exige "el requerimiento final, INDICANDO SI ESTÁ ESTANDARIZADO".
  // La precarga solo siembra la declaración en A3 cuando la casilla está
  // marcada; sin marcar, A3 llega sin declaración y el expediente no se puede
  // aprobar hasta que alguien la complete allí.
  items.push(
    n.verificacion_ficha_tecnica === true
      ? { etiqueta: "Verificado si hay ficha técnica u homologación", nivel: "ok" }
      : {
          etiqueta: "Sin verificar si el requerimiento está estandarizado",
          nivel: "warn",
          porque:
            "El Art. 54.2.a exige que el expediente indique SI el requerimiento está estandarizado. Si la casilla queda sin marcar, esa declaración no viaja al expediente y habrá que rellenarla allí antes de aprobarlo. Si ya comprobaste que NO hay ficha técnica ni homologación, déjalo dicho en el requerimiento: en blanco no se distingue de «no lo he mirado».",
          campo: "verificacionFichaTecnica",
        },
  );

  return { articulo: "Arts. 54.2 y 54.3 · Lo que exigirá el expediente", items };
}

function coherencia(n: Necesidad, hoy?: string): GrupoVerificacion {
  const items: ItemVerificacion[] = [];
  const hoyStr = hoyISO(hoy);

  const requerida = typeof n.fecha_requerida === "string" ? n.fecha_requerida : "";
  if (!requerida) {
    items.push({
      etiqueta: "Fecha para la que se necesita",
      nivel: "warn",
      porque: "Sin ella, el expediente no puede avisar de que su cronograma llega tarde.",
      campo: "fechaRequerida",
    });
  } else if (requerida < hoyStr) {
    // No bloquea: el Art. 44.2 no exige una "fecha requerida" entre los
    // contenidos del requerimiento, y una fecha de necesidad vencida no lo
    // invalida ni prohíbe contratar. El cronograma (Art. 46.1.o) es un estimado
    // que elabora la DEC después, en la estrategia; una fecha pasada solo
    // desfasa ese estimado. Por eso es aviso, no impedimento.
    items.push({
      etiqueta: "La fecha requerida ya pasó",
      nivel: "warn",
      porque: `Se pidió para el ${requerida}, que ya pasó. Actualízala a una fecha factible: la DEC estimará el cronograma del proceso (Art. 46.1.o) contra ella. No impide remitir.`,
      campo: "fechaRequerida",
    });
  } else {
    items.push({ etiqueta: "Fecha para la que se necesita", nivel: "ok" });
  }

  const monto = Number(n.monto_estimado);
  items.push(
    Number.isFinite(monto) && monto > 0
      ? { etiqueta: "Monto estimado", nivel: "ok" }
      : {
          etiqueta: "Monto estimado",
          nivel: "warn",
          porque: "El valor definitivo lo fija el mercado (Art. 47.1), pero sin una estimación de partida no hay con qué contrastarlo.",
          campo: "montoEstimado",
        },
  );

  const desproporcion = art446(n);
  if (desproporcion) items.push(desproporcion);

  // El CMN NO se comprueba aquí: es una exigencia del expediente (Art. 54.3),
  // así que vive en el grupo del Art. 54 junto al resto de lo que bloqueará
  // allí. Tenerlo en "coherencia" lo presentaba como un descuido de la ficha y
  // no como lo que es: un impedimento aguas abajo.

  return { articulo: "Coherencia de la ficha", items };
}

/**
 * Los grupos, en el orden del Art. 44: por qué → qué → en qué condiciones, y al
 * final lo que mirará el expediente (Art. 54) y la coherencia de la ficha.
 */
export function verificarNecesidad(n: Necesidad, hoy?: string): GrupoVerificacion[] {
  return [art441(n), art4410(n), art442(n), art54(n), coherencia(n, hoy)];
}

export type ResumenVerificacion = {
  grupos: GrupoVerificacion[];
  total: number;
  conformes: number;
  /** Cuántas cosas impiden remitir. */
  bloquean: number;
  /** ¿Puede remitirse a la DEC? */
  lista: boolean;
};

export function resumenNecesidad(n: Necesidad, hoy?: string): ResumenVerificacion {
  const grupos = verificarNecesidad(n, hoy);
  const items = grupos.flatMap((g) => g.items);
  const bloquean = items.filter((i) => i.nivel === "stop").length;
  return {
    grupos,
    total: items.length,
    conformes: items.filter((i) => i.nivel === "ok").length,
    bloquean,
    lista: bloquean === 0,
  };
}
