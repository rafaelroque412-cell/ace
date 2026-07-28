import { describe, expect, it } from "vitest";
import { componerFormacionAcademica, parseFormacionAcademica } from "@/lib/formacion-academica";
import { FICHA_SECCIONES } from "@/lib/necesidad-ficha-secciones";
import { necesidadUpdateSchema } from "@/lib/necesidades";

/**
 * Formación académica del personal clave (Art. 72.3.b, C.2.1). Frase del formato
 * con dos huecos: el grado/título y el puesto del que se acredita.
 */
describe("compone la frase con los dos huecos", () => {
  it("con datos, en el orden del formato", () => {
    expect(
      componerFormacionAcademica({ grado: "Título profesional de Ingeniero Civil", puesto: "Ingeniero residente" }),
    ).toBe("Título profesional de Ingeniero Civil del personal clave requerido como Ingeniero residente.");
  });

  it("un hueco sin rellenar conserva su corchete", () => {
    const t = componerFormacionAcademica({ grado: "Bachiller en Contabilidad" });
    expect(t).toContain("Bachiller en Contabilidad del personal clave requerido como [CONSIGNAR EL PERSONAL CLAVE REQUERIDO");
  });

  it("sin nada, salen los dos corchetes del formato", () => {
    const t = componerFormacionAcademica({});
    expect((t.match(/\[CONSIGNAR/g) ?? []).length).toBe(2);
    expect(t).toContain("del personal clave requerido como");
  });

  it("los espacios en blanco no cuentan como relleno", () => {
    expect(componerFormacionAcademica({ grado: "  ", puesto: "Residente" })).toContain(
      "[CONSIGNAR EL GRADO DE BACHILLER O TÍTULO PROFESIONAL",
    );
  });
});

describe("relee los huecos del requisito ya compuesto", () => {
  it("recupera grado y puesto", () => {
    const t = componerFormacionAcademica({ grado: "Título de Arquitecto", puesto: "Jefe de proyecto" });
    expect(parseFormacionAcademica(t)).toEqual({ grado: "Título de Arquitecto", puesto: "Jefe de proyecto" });
  });

  it("el corchete no cuenta como valor", () => {
    expect(parseFormacionAcademica(componerFormacionAcademica({}))).toEqual({ grado: "", puesto: "" });
    expect(parseFormacionAcademica(componerFormacionAcademica({ puesto: "Residente" })).grado).toBe("");
  });

  it("un texto que no es del formato no aporta huecos", () => {
    expect(parseFormacionAcademica("una frase suelta")).toEqual({ grado: "", puesto: "" });
    expect(parseFormacionAcademica("")).toEqual({ grado: "", puesto: "" });
  });
});

describe("está en la ficha, en 3.5.1, oculta y editada por el editor", () => {
  const campo = FICHA_SECCIONES.find((s) => s.title === "3.5.1 Requisitos de calificación obligatorios")!
    .fields.find((f) => f.api === "formacionAcademica");

  it("existe, oculta, kind textarea", () => {
    expect(campo?.oculto).toBe(true);
    expect(campo?.kind).toBe("textarea");
  });

  it("el esquema acepta el requisito compuesto", () => {
    const r = necesidadUpdateSchema.safeParse({
      formacionAcademica: componerFormacionAcademica({ grado: "Bachiller", puesto: "Residente" }),
    });
    expect(r.success, r.success ? "" : JSON.stringify(r.error.issues)).toBe(true);
  });

  it("el editor lo compone con «Redactar con IA» y lo escribe por api", async () => {
    const { readFileSync } = await import("node:fs");
    const editor = readFileSync("app/components/requisitos-calificacion-editor.tsx", "utf-8");
    expect(editor).toContain("componerFormacionAcademica");
    expect(editor).toContain('onCampoFicha("formacionAcademica"');
    expect(editor).toContain("Calificaciones del personal clave");
  });
});
