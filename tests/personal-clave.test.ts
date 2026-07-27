import { describe, expect, it } from "vitest";
import { componerExperienciaPersonalClave, huecosPersonalClavePendientes } from "@/lib/personal-clave";
import { FICHA_SECCIONES } from "@/lib/necesidad-ficha-secciones";
import { LIMITES_TEXTO, necesidadUpdateSchema } from "@/lib/necesidades";

/**
 * «Experiencia del personal clave» (Art. 72.3.b, capacidad técnica y profesional).
 * El formato fija la frase y deja tres huecos; se compone con ellos, como la
 * forma de pago.
 */
describe("la frase del requisito sale con los tres huecos dentro", () => {
  it("con datos, en el orden del formato", () => {
    expect(
      componerExperienciaPersonalClave({
        tiempo: "tres (3) años",
        trabajos: "supervisión de montaje de estructuras metálicas",
        puesto: "Ingeniero residente",
      }),
    ).toBe(
      "tres (3) años en supervisión de montaje de estructuras metálicas del personal clave requerido desempeñándose como Ingeniero residente.",
    );
  });

  it("un hueco sin rellenar conserva su corchete", () => {
    // El requerimiento se firma: lo que falta tiene que verse.
    const t = componerExperienciaPersonalClave({ tiempo: "dos (2) años", puesto: "Supervisor" });
    expect(t).toContain("dos (2) años en [CONSIGNAR LOS TRABAJOS O PRESTACIONES EN LA ACTIVIDAD REQUERIDA] del");
    expect(t).toContain("desempeñándose como Supervisor.");
  });

  it("sin nada, salen los tres corchetes del formato", () => {
    const t = componerExperienciaPersonalClave({});
    expect((t.match(/\[CONSIGNAR/g) ?? []).length).toBe(3);
    expect(t).toContain("del personal clave requerido desempeñándose como");
  });

  it("los espacios en blanco no cuentan como relleno", () => {
    expect(componerExperienciaPersonalClave({ tiempo: "   " })).toContain(
      "[CONSIGNAR EL TIEMPO DE EXPERIENCIA MÍNIMO] en",
    );
  });
});

describe("cuántos huecos faltan", () => {
  it("los cuenta para avisar antes de firmar", () => {
    expect(huecosPersonalClavePendientes({})).toBe(3);
    expect(huecosPersonalClavePendientes({ tiempo: "3 años", trabajos: "x", puesto: "y" })).toBe(0);
    expect(huecosPersonalClavePendientes({ tiempo: "3 años", puesto: "  " })).toBe(2);
  });
});

describe("está en la ficha, en 3.5.1, y se guarda como columnas", () => {
  const seccion = FICHA_SECCIONES.find((s) => s.title === "3.5.1 Requisitos de calificación obligatorios")!;
  const APIS = ["personalClaveTiempo", "personalClaveTrabajos", "personalClavePuesto", "personalClaveExperiencia"];

  it("los cuatro campos existen en 3.5.1", () => {
    for (const api of APIS) expect(seccion.fields.map((f) => f.api), api).toContain(api);
  });

  it("son OCULTOS: no se pintan sueltos, los renderiza el editor de requisitos", () => {
    // La entidad los pide DENTRO de la experiencia del postor; el editor los
    // pinta ahí. Siguen en FICHA_SECCIONES para que se carguen y se guarden.
    for (const api of APIS) {
      const f = seccion.fields.find((x) => x.api === api)!;
      expect(f.oculto, api).toBe(true);
    }
  });

  it("el esquema los acepta: sin esto el guardado responde 400", () => {
    const r = necesidadUpdateSchema.safeParse({
      personalClaveTiempo: "tres (3) años",
      personalClaveTrabajos: "supervisión de montaje",
      personalClavePuesto: "Ingeniero residente",
      personalClaveExperiencia: componerExperienciaPersonalClave({ tiempo: "3", trabajos: "x", puesto: "y" }),
    });
    expect(r.success, r.success ? "" : JSON.stringify(r.error.issues)).toBe(true);
  });

  it("el texto con los tres corchetes cabe en el tope del campo", () => {
    // Con los huecos vacíos el texto es el MÁS largo: los corchetes del formato
    // son más largos que casi cualquier valor real.
    expect(componerExperienciaPersonalClave({}).length).toBeLessThanOrEqual(LIMITES_TEXTO.personalClaveExperiencia);
  });

  it("el editor de requisitos lo compone dentro de la experiencia del postor", async () => {
    // Se vigila el fuente porque el suite no monta React. El bloque va en la
    // tarjeta de experiencia del postor y compone con «componerExperienciaPersonalClave».
    const { readFileSync } = await import("node:fs");
    const fuente = readFileSync("app/components/requisitos-calificacion-editor.tsx", "utf-8");
    expect(fuente).toContain("componerExperienciaPersonalClave");
    expect(fuente).toContain('tipo.key === "experiencia_postor" && estado !== "no" && onCampoFicha');
    expect(fuente).toContain('onCampoFicha("personalClaveExperiencia"');
    // Y escribe los tres huecos por su api.
    for (const api of ["personalClaveTiempo", "personalClaveTrabajos", "personalClavePuesto"]) {
      expect(fuente, api).toContain(`onCampoFicha("${api}"`);
    }
  });
});
