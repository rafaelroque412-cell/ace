import { describe, expect, it } from "vitest";
import { componerFormaPago, huecosPendientes } from "@/lib/forma-pago";

/**
 * El apartado FORMA DE PAGO no está en los PDF-modelo cargados: lo pide la
 * entidad. Su texto lo fija el Art. 67 de la Ley y solo tiene cinco huecos, así
 * que se compone con una plantilla en vez de generarse: parafrasear un artículo
 * de la Ley en un documento que se firma es un defecto, no una ayuda.
 */
const COMPLETO = {
  areaConformidad: "Sub Gerencia de Desarrollo Económico",
  direccion: "Av. Arenas 121, Abancay",
  documentacionAdicional: "Acta de entrega de los bienes",
  lugarPresentacion: "Mesa de Partes de la Municipalidad",
  tipoPago: "un pago único contra conformidad",
};

describe("el texto que fija la Ley sale literal", () => {
  it("cita el artículo 67 y los plazos de la norma", () => {
    const t = componerFormaPago(COMPLETO);
    expect(t).toContain("artículo 67 de la Ley");
    expect(t).toContain("dentro de los diez días hábiles siguientes de otorgada la conformidad");
    expect(t).toContain("prorrogable, previa justificación de la demora, por cinco días hábiles");
  });

  it("incluye el párrafo del consorcio, que no depende de nada que se escriba", () => {
    expect(componerFormaPago({})).toContain("se haya suscrito contrato con un consorcio");
  });

  it("los dos documentos fijos van siempre", () => {
    const t = componerFormaPago(COMPLETO);
    expect(t).toContain("conformidad de la prestación efectuada");
    expect(t).toContain("- Comprobante de pago.");
  });
});

describe("los cinco huecos se rellenan con lo registrado", () => {
  it("cada valor aparece en su sitio", () => {
    const t = componerFormaPago(COMPLETO);
    expect(t).toContain("a favor del contratista en un pago único contra conformidad.");
    expect(t).toContain("servidor responsable del Sub Gerencia de Desarrollo Económico.");
    expect(t).toContain("- Acta de entrega de los bienes.");
    expect(t).toContain("restante en Mesa de Partes de la Municipalidad, sito en Av. Arenas 121, Abancay.");
  });

  it("ya no queda ningún corchete cuando están los cinco", () => {
    expect(componerFormaPago(COMPLETO)).not.toMatch(/\[[A-ZÁÉÍÓÚ]/);
  });
});

describe("un hueco sin rellenar se VE", () => {
  it("conserva el corchete del formato en vez de disolverse", () => {
    // El requerimiento se firma: un hueco vacío tiene que parecer lo que es
    // —algo que falta— y no una frase que ya está completa.
    const t = componerFormaPago({ ...COMPLETO, direccion: "" });
    expect(t).toContain("[CONSIGNAR LA DIRECCIÓN EXACTA]");
  });

  it("sin nada registrado salen los cinco corchetes", () => {
    const t = componerFormaPago({});
    expect((t.match(/\[[A-ZÁÉÍÓÚ][^\]]*\]/g) ?? []).length).toBe(5);
  });

  it("los espacios en blanco no cuentan como relleno", () => {
    expect(componerFormaPago({ ...COMPLETO, tipoPago: "   " })).toContain("[CONSIGNAR SI SE TRATA DE PAGO ÚNICO");
  });
});

describe("cuántos huecos faltan", () => {
  it("los cuenta para poder avisar antes de firmar", () => {
    expect(huecosPendientes({})).toBe(5);
    expect(huecosPendientes(COMPLETO)).toBe(0);
    expect(huecosPendientes({ ...COMPLETO, direccion: "", tipoPago: "  " })).toBe(2);
  });
});

describe("el apartado está en la ficha y se guarda", () => {
  it("los seis campos existen en 3.3 Condiciones de contratación", async () => {
    const { FICHA_SECCIONES } = await import("@/lib/necesidad-ficha-secciones");
    const seccion = FICHA_SECCIONES.find((s) => s.title === "3.3 Condiciones de contratación")!;
    const apis = seccion.fields.map((f) => f.api);
    for (const api of [
      "formaPago", "formaPagoTipo", "formaPagoAreaConformidad",
      "formaPagoDocumentacion", "formaPagoLugar", "formaPagoDireccion",
    ]) {
      expect(apis, api).toContain(api);
    }
  });

  it("el esquema los acepta: sin esto el guardado responde 400", async () => {
    const { necesidadUpdateSchema } = await import("@/lib/necesidades");
    const r = necesidadUpdateSchema.safeParse({
      formaPago: componerFormaPago(COMPLETO),
      formaPagoAreaConformidad: COMPLETO.areaConformidad,
      formaPagoDireccion: COMPLETO.direccion,
      formaPagoDocumentacion: COMPLETO.documentacionAdicional,
      formaPagoLugar: COMPLETO.lugarPresentacion,
      formaPagoTipo: COMPLETO.tipoPago,
    });
    expect(r.success, r.success ? "" : JSON.stringify(r.error.issues)).toBe(true);
  });

  it("el texto compuesto cabe en el tope del campo", () => {
    // Con los cinco huecos vacios el texto es el MAS largo: los corchetes del
    // formato son mas largos que casi cualquier valor real.
    expect(componerFormaPago({}).length).toBeLessThan(6000);
  });

  it("«Redactar con IA» compone el texto, no llama al copiloto", async () => {
    // Se vigila el fuente porque el suite no monta React. Lo que importa es que
    // este campo NO pase por el modelo de lenguaje: su texto es literal de la
    // Ley y parafrasearlo en un documento que se firma seria un defecto.
    const { readFileSync } = await import("node:fs");
    const fuente = readFileSync("app/components/necesidad-detail.tsx", "utf-8");
    // Se acota por el CIERRE de la función, no por un número de caracteres: la
    // primera versión de esta prueba cortaba a 1 400 y empezó a fallar sola en
    // cuanto se añadió un segundo atajo al mismo manejador.
    const i = fuente.indexOf("const pedirRedactarIA");
    const cuerpo = fuente.slice(i, fuente.indexOf("\n  };", i));
    expect(cuerpo).toContain('api === "formaPago"');
    expect(cuerpo).toContain("componerFormaPago");
    // y el atajo va ANTES de abrir el copiloto
    expect(cuerpo.indexOf("componerFormaPago")).toBeLessThan(cuerpo.indexOf("setCopilotoAbierto"));
  });
});
