/**
 * Reparto de los bloques de la ficha entre los dos modos de trabajo.
 *
 * La pantalla apila once bloques y molesta por cuatro sitios a la vez:
 * desplazamiento, no saber que falta, ruido de lo que no toca ahora, y lentitud.
 * Dos modos —Redactar y Revisar— separan el trabajo del juicio sobre el trabajo,
 * que es la division que ya existe en la organizacion: el area usuaria redacta,
 * la DEC revisa.
 *
 * El reparto vive AQUI y no dentro del JSX por una razon concreta: el suite no
 * renderiza React (`environment: "node"`, solo `.test.ts`). Con el reparto
 * disperso en el markup no se podria comprobar lo unico que hundiria la idea
 * —un bloque que quede fuera de los dos modos y desaparezca sin que nadie lo
 * note—. Aqui es una lista, y una lista se prueba.
 *
 * Diseño: docs/superpowers/specs/2026-07-26-estructura-ficha-necesidad-design.md
 */

export type ModoFicha = "redactar" | "revisar";

/**
 * Con que modo se abre la ficha cuando no hay nada recordado.
 *
 * Redactar, porque a lo que se vuelve es a seguir rellenando: 10 de las 11
 * necesidades se editaron en un dia distinto al de su creacion.
 */
export const MODO_POR_DEFECTO: ModoFicha = "redactar";

const AMBOS: readonly ModoFicha[] = ["redactar", "revisar"];
const SOLO_REDACTAR: readonly ModoFicha[] = ["redactar"];
const SOLO_REVISAR: readonly ModoFicha[] = ["revisar"];

/**
 * Los once bloques, en el orden en que se pintan.
 *
 * `label` es el que usa la navegacion rapida, asi que cambiarlo cambia la
 * pantalla: no es documentacion suelta.
 */
export const BLOQUES_FICHA: ReadonlyArray<{
  id: string;
  label: string;
  modos: readonly ModoFicha[];
}> = [
  // El flujo orienta en los dos modos. El diff de no objecion viaja dentro,
  // porque explica el punto en que esta.
  { id: "sec-flujo", label: "Flujo y estado", modos: AMBOS },
  // El EETT/TDR es el INSUMO de la ficha, asi que va antes que ella.
  { id: "sec-eett", label: "EETT / TDR", modos: SOLO_REDACTAR },
  // La ficha se lee en los dos; lo que cambia es si es editable.
  { id: "sec-ficha", label: "Ficha del requerimiento", modos: AMBOS },
  // Los diagnosticos no cambian de contenido, cambian de sitio: al lateral
  // mientras se redacta, al centro cuando se revisa.
  { id: "sec-verificacion", label: "¿Está lista?", modos: AMBOS },
  { id: "sec-coherencia", label: "Coherencia", modos: AMBOS },
  { id: "sec-observaciones", label: "Observaciones", modos: AMBOS },
  { id: "sec-adjuntos", label: "Adjuntos", modos: SOLO_REDACTAR },
  // Los riesgos son contenido del requerimiento (Art. 44.3), no un apendice.
  { id: "sec-riesgos", label: "Riesgos", modos: SOLO_REDACTAR },
  // Los dos actos de la DEC sobre algo ya redactado.
  { id: "sec-admisibilidad", label: "Admisibilidad (DEC)", modos: SOLO_REVISAR },
  { id: "sec-derivacion", label: "Derivación", modos: SOLO_REVISAR },
  { id: "sec-historial", label: "Historial", modos: SOLO_REVISAR },
];

/** Ids de los bloques de un modo, en el orden en que se pintan. */
export function panelesDelModo(modo: ModoFicha): string[] {
  return BLOQUES_FICHA.filter((b) => b.modos.includes(modo)).map((b) => b.id);
}

/**
 * A que modo hay que cambiar para ver ese bloque.
 *
 * `null` cuando el bloque esta en los dos —no hace falta cambiar— y tambien
 * cuando el id es desconocido. En ambos casos el llamador hace lo mismo: no
 * cambiar de modo e intentar el desplazamiento. Degradar asi es mejor que
 * lanzar y dejar la pantalla a medias por un id mal escrito.
 */
export function modoParaSeccion(id: string): ModoFicha | null {
  const bloque = BLOQUES_FICHA.find((b) => b.id === id);
  if (!bloque || bloque.modos.length !== 1) return null;
  return bloque.modos[0];
}
