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

describe("está en la ficha, en 3.5.2, y se guarda", () => {
  const seccion = FICHA_SECCIONES.find((s) => s.title === "3.5.2 Requisitos de calificación adicionales")!;
  const SUBGRUPO = "Capacidad técnica y profesional · Experiencia del personal clave (Art. 72.3.b)";

  it("los cuatro campos existen y comparten subgrupo", () => {
    const delBloque = seccion.fields.filter((f) => f.subgrupo === SUBGRUPO).map((f) => f.api);
    expect(delBloque).toEqual([
      "personalClaveTiempo",
      "personalClaveTrabajos",
      "personalClavePuesto",
      "personalClaveExperiencia",
    ]);
  });

  it("el texto compuesto va el último, tras sus huecos", () => {
    const delBloque = seccion.fields.filter((f) => f.subgrupo === SUBGRUPO);
    expect(delBloque.at(-1)!.api).toBe("personalClaveExperiencia");
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

  it("los tres huecos no ofrecen «Redactar con IA»; solo el texto compuesto", async () => {
    const { CAMPOS_SIN_REDACCION_IA } = await import("@/app/components/necesidad/campos-sin-redaccion-ia");
    for (const api of ["personalClaveTiempo", "personalClaveTrabajos", "personalClavePuesto"]) {
      expect(CAMPOS_SIN_REDACCION_IA.has(api), api).toBe(true);
    }
    expect(CAMPOS_SIN_REDACCION_IA.has("personalClaveExperiencia")).toBe(false);
  });

  it("«Redactar con IA» compone el texto, no llama al copiloto", async () => {
    const { readFileSync } = await import("node:fs");
    const fuente = readFileSync("app/components/necesidad-detail.tsx", "utf-8");
    const i = fuente.indexOf("const pedirRedactarIA");
    const cuerpo = fuente.slice(i, fuente.indexOf("\n  };", i));
    expect(cuerpo).toContain('api === "personalClaveExperiencia"');
    expect(cuerpo).toContain("componerExperienciaPersonalClave");
    expect(cuerpo.indexOf("componerExperienciaPersonalClave")).toBeLessThan(cuerpo.indexOf("setCopilotoAbierto"));
  });
});
