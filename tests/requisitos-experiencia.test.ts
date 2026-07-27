import { describe, expect, it } from "vitest";
import {
  HUECO_MONTO_EXPERIENCIA,
  HUECO_SIMILARES,
  componerExperienciaPostor,
  importeConLetras,
  montoDeExperiencia,
  similaresDeExperiencia,
} from "@/lib/requisitos-experiencia";
import { numeroALetras, nombreMoneda } from "@/lib/numero-a-letras";

/**
 * «Experiencia del postor en la especialidad» (Art. 72.3.c). El formato fija el
 * texto entero y deja un hueco: el monto facturado. Se compone con él, y de él
 * salen la cifra y su versión en letras, en la moneda de la convocatoria.
 */
describe("el número a letras respeta la moneda", () => {
  it("por defecto, soles (no rompe a los llamadores de siempre)", () => {
    expect(numeroALetras("180000.00")).toBe("CIENTO OCHENTA MIL CON 00/100 SOLES");
  });

  it("en dólares lo dice", () => {
    expect(numeroALetras("250000.50", "USD")).toBe("DOSCIENTOS CINCUENTA MIL CON 50/100 DÓLARES AMERICANOS");
  });

  it("reconoce la moneda por código, etiqueta o símbolo", () => {
    expect(nombreMoneda("PEN")).toBe("SOLES");
    expect(nombreMoneda("USD · Dólares americanos ($)")).toBe("DÓLARES AMERICANOS");
    expect(nombreMoneda("US$")).toBe("DÓLARES AMERICANOS");
    expect(nombreMoneda(null)).toBe("SOLES");
  });
});

describe("la cifra se escribe con su símbolo y sus letras", () => {
  it("soles", () => {
    expect(importeConLetras("180000", "PEN")).toBe("S/ 180,000.00 (CIENTO OCHENTA MIL CON 00/100 SOLES)");
  });

  it("dólares, con decimales", () => {
    expect(importeConLetras("250000.50", "USD")).toBe(
      "US$ 250,000.50 (DOSCIENTOS CINCUENTA MIL CON 50/100 DÓLARES AMERICANOS)",
    );
  });

  it("acepta un número, no solo texto", () => {
    expect(importeConLetras(180000, "PEN")).toContain("S/ 180,000.00");
  });

  it("sin monto, conserva el corchete del formato", () => {
    // En un documento que se firma, lo que falta tiene que verse.
    expect(importeConLetras("", "PEN")).toBe(`[${HUECO_MONTO_EXPERIENCIA}]`);
    expect(importeConLetras("0", "PEN")).toBe(`[${HUECO_MONTO_EXPERIENCIA}]`);
    expect(importeConLetras("-5", "PEN")).toBe(`[${HUECO_MONTO_EXPERIENCIA}]`);
  });
});

describe("el requisito completo es el del formato", () => {
  const t = componerExperienciaPostor({ monto: "180000", moneda: "PEN", objeto: "servicios" });

  it("abre con la fórmula exacta y el monto dentro", () => {
    expect(t).toContain(
      "El postor debe acreditar un monto facturado acumulado equivalente a S/ 180,000.00 (CIENTO OCHENTA MIL CON 00/100 SOLES),",
    );
  });

  it("cierra con los quince años y el cómputo del formato", () => {
    expect(t).toContain(
      "durante los quince (15) años anteriores a la fecha de la presentación de ofertas que se computa desde la fecha de la conformidad o emisión del comprobante de pago, según corresponda.",
    );
  });

  it("el objeto de la frase sigue al objeto de la contratación", () => {
    const p = (objeto: string) => componerExperienciaPostor({ monto: "1", moneda: "PEN", objeto });
    expect(componerExperienciaPostor({ monto: "180000", objeto: "bienes" })).toContain("por la contratación de bienes iguales o similares");
    expect(t).toContain("por la contratación de servicios iguales o similares");
    expect(p("obras")).toContain("por la contratación de obras iguales o similares");
    expect(p("consultoria_obra")).toContain("por la contratación de consultoría de obras iguales o similares");
    // Objeto desconocido: cae en servicios, que es el caso más común.
    expect(p("")).toContain("por la contratación de servicios iguales o similares");
  });

  it("sin monto, el requisito sigue saliendo con su corchete", () => {
    const vacio = componerExperienciaPostor({ moneda: "PEN", objeto: "servicios" });
    expect(vacio).toContain(`[${HUECO_MONTO_EXPERIENCIA}]`);
    expect(vacio).toContain("por la contratación de servicios iguales o similares");
  });
});

describe("la segunda frase: qué se considera similar", () => {
  it("acompaña siempre al requisito, con lo registrado dentro", () => {
    const t = componerExperienciaPostor({
      monto: "180000",
      moneda: "PEN",
      objeto: "servicios",
      similares: "mantenimiento de áreas verdes y jardinería",
    });
    expect(t).toContain(
      "Se consideran servicios similares a los siguientes: mantenimiento de áreas verdes y jardinería.",
    );
  });

  it("sin registrar, conserva el corchete del formato", () => {
    const t = componerExperienciaPostor({ monto: "180000", objeto: "servicios" });
    expect(t).toContain(`Se consideran servicios similares a los siguientes: [${HUECO_SIMILARES}].`);
  });

  it("la palabra del objeto es la misma en las dos frases", () => {
    const t = componerExperienciaPostor({ monto: "1", objeto: "bienes", similares: "equipos de cómputo" });
    expect(t).toContain("por la contratación de bienes iguales o similares");
    expect(t).toContain("Se consideran bienes similares a los siguientes: equipos de cómputo.");
  });

  it("se relee del detalle, y el corchete no cuenta como valor", () => {
    const conValor = componerExperienciaPostor({ monto: "1", objeto: "servicios", similares: "jardinería y afines" });
    expect(similaresDeExperiencia(conValor)).toBe("jardinería y afines");
    const sinValor = componerExperienciaPostor({ monto: "1", objeto: "servicios" });
    expect(similaresDeExperiencia(sinValor)).toBe("");
    expect(similaresDeExperiencia("texto sin la frase")).toBe("");
  });
});

describe("el monto se relee del detalle al reabrir", () => {
  it("porque no tiene columna propia: es la fuente de verdad", () => {
    const detalle = componerExperienciaPostor({ monto: "180000", moneda: "PEN", objeto: "servicios" });
    expect(montoDeExperiencia(detalle)).toBe("180000");
  });

  it("sin importe en el texto, devuelve vacío", () => {
    expect(montoDeExperiencia("El postor debe acreditar experiencia.")).toBe("");
    expect(montoDeExperiencia("")).toBe("");
    expect(montoDeExperiencia(null)).toBe("");
  });
});

describe("cabe en el tope del campo de requisitos", () => {
  it("el detalle compuesto no rebasa el esquema", async () => {
    // El requisito viaja dentro del texto canónico de `requisitos_calificacion`.
    const { necesidadUpdateSchema } = await import("@/lib/necesidades");
    const detalle = componerExperienciaPostor({ monto: "999999999", moneda: "USD", objeto: "consultoria_obra" });
    // Se guarda como parte del texto de requisitos; aquí basta con que un
    // requisito solo quepa de sobra en el tope de esa columna.
    expect(necesidadUpdateSchema.safeParse({ requisitosCalificacion: detalle }).success).toBe(true);
  });
});
