import { describe, expect, it } from "vitest";
import {
  componerRecepcionConformidad,
  huecosDePlantilla,
  plantillaPara,
} from "@/lib/recepcion-conformidad";

/**
 * El apartado de recepción y conformidad (Art. 144 del Reglamento) NO es el
 * mismo para bienes que para servicios, y la diferencia es de fondo:
 *
 *   * en bienes hay DOS actos —la recepción, que da almacén, y la conformidad,
 *     que da el área usuaria—;
 *   * en servicios solo hay conformidad, y el apartado ni siquiera se titula
 *     igual.
 *
 * Un texto único con frases condicionales daba un apartado que no era ninguno de
 * los dos formatos, así que se elige la plantilla por objeto.
 */
const HUECOS = {
  areaConformidad: "Sub Gerencia de Desarrollo Económico",
  areaRecepcion: "Unidad de Almacén Central",
  plazoConformidad: "siete (7)",
  plazoSubsanacion: "cinco (5) días hábiles",
};

describe("bienes: recepción Y conformidad", () => {
  const texto = componerRecepcionConformidad("bienes", HUECOS)!;

  it("se titula con los dos actos", () => {
    expect(texto).toContain("RECEPCIÓN Y CONFORMIDAD DE LA PRESTACIÓN");
  });

  it("nombra quién recibe y quién da la conformidad, que son distintos", () => {
    expect(texto).toContain("La recepción será otorgada por Unidad de Almacén Central");
    expect(texto).toContain("la conformidad será otorgada por Sub Gerencia de Desarrollo Económico");
  });

  it("el 30% de subsanación va fijo, no es un hueco", () => {
    // En el formato de bienes esa cifra está escrita en el texto; solo en
    // servicios se deja para consignar.
    expect(texto).toContain("no debe ser mayor al 30% del plazo del entregable correspondiente");
    expect(texto).not.toContain("[CONSIGNAR EL PLAZO EL CUAL NO DEBE SER MAYOR");
  });

  it("el último párrafo habla de bienes", () => {
    expect(texto).toContain("cuando los bienes manifiestamente no cumplan");
  });

  it("cita el Reglamento sin el decreto, como el formato de bienes", () => {
    expect(texto).toContain("Reglamento de la Ley N° 32069");
    expect(texto).not.toContain("Decreto Supremo N° 009-2025-EF");
  });
});

describe("servicios: solo conformidad", () => {
  const texto = componerRecepcionConformidad("servicios", HUECOS)!;

  it("se titula solo con la conformidad", () => {
    expect(texto).toContain("CONFORMIDAD DE LA PRESTACIÓN");
    expect(texto).not.toContain("RECEPCIÓN Y CONFORMIDAD");
  });

  it("no menciona al almacén: en servicios no hay recepción que dar", () => {
    expect(texto).not.toContain("ALMACÉN");
    expect(texto).not.toContain("Unidad de Almacén Central");
  });

  it("el plazo de subsanación SÍ es un hueco aquí", () => {
    expect(texto).toContain("otorgándole un plazo para subsanar, cinco (5) días hábiles.");
  });

  it("cita el decreto que aprueba el Reglamento, como el formato de servicios", () => {
    expect(texto).toContain("Decreto Supremo N° 009-2025-EF");
  });

  it("el último párrafo habla de servicios", () => {
    expect(texto).toContain("cuando los servicios manifiestamente no cumplan");
  });
});

describe("la consultoría de obra sigue el formato de servicios", () => {
  it("porque es un servicio", () => {
    expect(plantillaPara("consultoria_obra")).toBe("servicios");
    expect(componerRecepcionConformidad("consultoria_obra", HUECOS)).toContain("CONFORMIDAD DE LA PRESTACIÓN");
  });
});

describe("obras no se inventa", () => {
  it("devuelve null en vez de un texto aproximado", () => {
    // La recepción de obra tiene su propio procedimiento —comisión de recepción,
    // pliego de observaciones— y el formato facilitado no lo cubre. Escribir
    // algo parecido en un documento que se firma sería peor que no escribirlo.
    expect(componerRecepcionConformidad("obras", HUECOS)).toBeNull();
    expect(plantillaPara("obras")).toBeNull();
    expect(huecosDePlantilla("obras")).toEqual([]);
  });

  it("sin objeto tampoco", () => {
    expect(componerRecepcionConformidad("", HUECOS)).toBeNull();
    expect(componerRecepcionConformidad(null, HUECOS)).toBeNull();
  });
});

describe("los huecos sin rellenar se VEN", () => {
  it("conservan el corchete del formato", () => {
    const t = componerRecepcionConformidad("bienes", {})!;
    expect(t).toContain("[CONSIGNAR EL ÁREA O UNIDAD ORGÁNICA DE ALMACÉN O LA QUE HAGA SUS VECES]");
    expect(t).toContain("[CONSIGNAR EL ÁREA O UNIDAD ORGÁNICA QUE OTORGA LA CONFORMIDAD]");
    expect((t.match(/\[CONSIGNAR/g) ?? []).length).toBe(3);
  });

  it("servicios también tiene tres", () => {
    const t = componerRecepcionConformidad("servicios", {})!;
    expect((t.match(/\[CONSIGNAR/g) ?? []).length).toBe(3);
  });
});

describe("cada objeto pide sus huecos y no los del otro", () => {
  it("bienes pide el área de almacén; servicios, el plazo de subsanación", () => {
    expect(huecosDePlantilla("bienes")).toEqual(["areaRecepcion", "areaConformidad", "plazoConformidad"]);
    expect(huecosDePlantilla("servicios")).toEqual([
      "areaConformidad",
      "plazoConformidad",
      "plazoSubsanacion",
    ]);
  });
});
