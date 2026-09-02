import { describe, expect, it } from "vitest";
import { resolverBases } from "@/lib/bases-elaboracion";
import type { HitosMap } from "@/lib/procurement-fases";

describe("resolverBases", () => {
  it("proceso sin plantilla devuelve null", () => {
    expect(resolverBases("Concurso Público con diálogo competitivo", {}, { nombre: "X", ruc: "1" })).toBeNull();
  });

  it("resuelve los campos literales desde los hitos correspondientes", () => {
    const hitos: HitosMap = {
      A3: {
        status: "hecho",
        data: { finalidad_publica: "Mejorar la atención al ciudadano.", descripcion: "Adquisición de mobiliario." },
      },
      A4: {
        status: "hecho",
        data: { var_h_modalidad_pago: "pago_unico", var_i_sistema_entrega: "" },
      },
    };
    const valores = resolverBases("Licitación Pública para bienes", hitos, { nombre: "MUNICIPALIDAD X", ruc: "20123456789" });
    expect(valores).not.toBeNull();
    const porRuta = Object.fromEntries(valores!.map((v) => [v.ruta, v]));
    expect(porRuta["cap1.entidad.nombre"].valor).toBe("MUNICIPALIDAD X");
    expect(porRuta["cap1.entidad.ruc"].valor).toBe("20123456789");
    expect(porRuta["cap3.finalidadPublica"].valor).toBe("Mejorar la atención al ciudadano.");
    expect(porRuta["cap3.finalidadPublica"].resuelto).toBe(true);
    expect(porRuta["cap3.descripcionRequerimiento"].valor).toBe("Adquisición de mobiliario.");
    expect(porRuta["cap3.modalidadPago"].valor).toBe("pago_unico");
  });

  it("un campo sin dato en su hito queda sin resolver, no se inventa", () => {
    const valores = resolverBases("Licitación Pública para bienes", {}, { nombre: "MUNICIPALIDAD X", ruc: "20123456789" });
    const porRuta = Object.fromEntries(valores!.map((v) => [v.ruta, v]));
    expect(porRuta["cap3.finalidadPublica"].resuelto).toBe(false);
    expect(porRuta["cap3.finalidadPublica"].valor).toBe("");
  });

  it("un campo origen 'libre' nunca se marca resuelto, aunque el hito exista", () => {
    // cap1.anioFiscal es "libre": A1 no tiene ese dato, así que jamás debe
    // fabricarse un valor para él, ni siquiera si el hito A1 está "hecho".
    const hitos: HitosMap = { A1: { status: "hecho", data: { situacion_pac: "programado" } } };
    const valores = resolverBases("Licitación Pública para bienes", hitos, { nombre: "X", ruc: "1" });
    const anioFiscal = valores!.find((v) => v.ruta === "cap1.anioFiscal")!;
    expect(anioFiscal.resuelto).toBe(false);
    expect(anioFiscal.valor).toBe("");
  });

  it("nombre y RUC de la entidad se resuelven de 'entidad', no de un hito", () => {
    const sinEntidad = resolverBases("Licitación Pública para bienes", {}, { nombre: "", ruc: "" });
    const porRuta = Object.fromEntries(sinEntidad!.map((v) => [v.ruta, v]));
    expect(porRuta["cap1.entidad.nombre"].resuelto).toBe(false);
    expect(porRuta["cap1.entidad.ruc"].resuelto).toBe(false);
  });

  it("resuelve un número (plazo_dias) convirtiéndolo a texto, sin inventar decimales", () => {
    const hitos: HitosMap = { A3: { status: "hecho", data: { plazo_dias: 30 } } };
    const valores = resolverBases("Licitación Pública para bienes", hitos, { nombre: "X", ruc: "1" });
    const plazo = valores!.find((v) => v.ruta === "cap3.plazoEntrega")!;
    expect(plazo.valor).toBe("30");
    expect(plazo.resuelto).toBe(true);
  });
});
