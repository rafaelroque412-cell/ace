import { describe, expect, it } from "vitest";
import {
  formatPersonalClave,
  parsePersonalClave,
  personalClaveIncompletas,
} from "@/lib/personal-clave";
import { FICHA_SECCIONES } from "@/lib/necesidad-ficha-secciones";
import { LIMITES_TEXTO, necesidadUpdateSchema } from "@/lib/necesidades";

/**
 * Experiencia del personal clave (Art. 72.3.b). Es una LISTA de puestos —cada
 * uno con su tiempo mínimo, la actividad y el cargo—, serializada en una columna
 * y pintada como cuadro, igual que «otras penalidades».
 */
const FILAS = [
  { tiempo: "tres (3) años", trabajos: "supervisión de montaje de estructuras metálicas", puesto: "Ingeniero residente" },
  { tiempo: "dos (2) años", trabajos: "control de calidad de soldadura", puesto: "Supervisor de calidad" },
];

describe("la lista se serializa y se vuelve a leer sin perder nada", () => {
  it("el par parse/format es reversible", () => {
    expect(parsePersonalClave(formatPersonalClave(FILAS))).toEqual(FILAS);
  });

  it("numera las filas y etiqueta cada campo", () => {
    const t = formatPersonalClave(FILAS);
    expect(t).toContain("1. Tiempo: tres (3) años · Actividad: supervisión de montaje de estructuras metálicas · Puesto: Ingeniero residente");
    expect(t).toContain("2. Tiempo: dos (2) años ·");
  });

  it("sin filas útiles no compone nada: el requisito puede no aplicar", () => {
    expect(formatPersonalClave([])).toBe("");
    expect(formatPersonalClave([{ tiempo: "", trabajos: "", puesto: "" }])).toBe("");
    expect(parsePersonalClave("")).toEqual([]);
    expect(parsePersonalClave(null)).toEqual([]);
  });

  it("una fila con algo escrito se conserva, con corchete donde falta", () => {
    const t = formatPersonalClave([{ tiempo: "un (1) año", trabajos: "", puesto: "" }]);
    expect(t).toContain("Tiempo: un (1) año · Actividad: [POR DEFINIR] · Puesto: [POR DEFINIR]");
  });

  it("un texto que no es del formato no aporta filas", () => {
    expect(parsePersonalClave("una frase suelta cualquiera")).toEqual([]);
  });
});

describe("filas a medio declarar", () => {
  it("se cuentan para avisar, sin bloquear", () => {
    expect(personalClaveIncompletas(FILAS)).toEqual([]);
    expect(personalClaveIncompletas([{ tiempo: "3 años", trabajos: "", puesto: "Residente" }])).toEqual([1]);
    expect(personalClaveIncompletas([{ tiempo: "", trabajos: "", puesto: "" }])).toEqual([]);
  });
});

describe("está en la ficha, en 3.5.1, oculta y como cuadro", () => {
  const seccion = FICHA_SECCIONES.find((s) => s.title === "3.5.1 Requisitos de calificación obligatorios")!;
  const campo = seccion.fields.find((f) => f.api === "personalClaveExperiencia");

  it("existe, es oculta y su kind la pinta como cuadro", () => {
    // Oculta: no se pinta suelta; el editor de requisitos la pinta dentro de la
    // tarjeta de experiencia del postor. `kind: "personalClave"` → tabla en Word.
    expect(campo?.oculto).toBe(true);
    expect(campo?.kind).toBe("personalClave");
  });

  it("los tres huecos de una sola fila ya no existen: ahora es una lista", () => {
    for (const api of ["personalClaveTiempo", "personalClaveTrabajos", "personalClavePuesto"]) {
      expect(FICHA_SECCIONES.flatMap((s) => s.fields).map((f) => f.api), api).not.toContain(api);
    }
  });

  it("el esquema acepta la lista serializada: sin esto el guardado responde 400", () => {
    const r = necesidadUpdateSchema.safeParse({ personalClaveExperiencia: formatPersonalClave(FILAS) });
    expect(r.success, r.success ? "" : JSON.stringify(r.error.issues)).toBe(true);
  });

  it("un cuadro razonable cabe en el tope del campo", () => {
    const muchas = Array.from({ length: 8 }, () => FILAS[0]);
    expect(formatPersonalClave(muchas).length).toBeLessThanOrEqual(LIMITES_TEXTO.personalClaveExperiencia);
  });

  it("el editor lo pinta dentro de la experiencia del postor, con «Agregar»", async () => {
    // Se vigila el fuente porque el suite no monta React.
    const { readFileSync } = await import("node:fs");
    const editor = readFileSync("app/components/requisitos-calificacion-editor.tsx", "utf-8");
    expect(editor).toContain("PersonalClaveEditor");
    expect(editor).toContain('tipo.key === "experiencia_postor" && estado !== "no" && onCampoFicha');
    const comp = readFileSync("app/components/personal-clave-editor.tsx", "utf-8");
    expect(comp).toContain("Agregar personal clave");
  });
});
