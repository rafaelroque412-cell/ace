import { describe, expect, it } from "vitest";
import { repairLigatures } from "@/lib/text-normalization";

describe("repairLigatures", () => {
  it("une la ligadura pegada a la izquierda con la palabra de la derecha", () => {
    expect(repairLigatures("defi nitiva")).toBe("definitiva");
    expect(repairLigatures("Defi niciones")).toBe("Definiciones");
    expect(repairLigatures("modifi cacion del contrato")).toBe("modificacion del contrato");
    expect(repairLigatures("especifi caciones tecnicas")).toBe("especificaciones tecnicas");
  });

  it("une la ligadura aislada con la palabra de la derecha, sin tocar la previa", () => {
    // "para" es palabra completa: solo se une "fi"+"nes"; "para" queda intacto.
    expect(repairLigatures("para fi nes del procedimiento")).toBe("para fines del procedimiento");
  });

  it("convierte ligaduras unicode a ASCII", () => {
    expect(repairLigatures("deﬁnitiva")).toBe("definitiva");
    expect(repairLigatures("conﬂicto")).toBe("conflicto");
  });

  it("NO fusiona palabras legitimas separadas", () => {
    expect(repairLigatures("la final del proceso")).toBe("la final del proceso");
    expect(repairLigatures("su filosofia de compra")).toBe("su filosofia de compra");
    expect(repairLigatures("el flujo de caja")).toBe("el flujo de caja");
    expect(repairLigatures("de fiscalizacion")).toBe("de fiscalizacion");
  });

  it("nunca fusiona la palabra previa a la ligadura", () => {
    // Regresion: la version insegura convertia esto en "parafines".
    expect(repairLigatures("para fi nes")).not.toContain("parafines");
  });

  it("deja intacto el texto sin ligaduras rotas", () => {
    const clean = "Articulo 4. Comparacion de precios es un procedimiento competitivo.";
    expect(repairLigatures(clean)).toBe(clean);
  });
});
