import { describe, expect, it } from "vitest";
import { extractExactCodes } from "@/lib/expedientes-archivo-search";

describe("extractExactCodes", () => {
  it("extrae un numero de 3+ cifras mencionado en la consulta", () => {
    expect(extractExactCodes("busca el pdf de comprobante de pago nro 2956")).toEqual(["2956"]);
  });

  it("extrae varios codigos distintos sin duplicarlos", () => {
    expect(extractExactCodes("compara el 2956 con el 2967 y otra vez el 2956")).toEqual([
      "2956",
      "2967",
    ]);
  });

  it("ignora numeros cortos (paginas, articulos sueltos)", () => {
    expect(extractExactCodes("el articulo 46 de la ley")).toEqual([]);
  });

  it("devuelve vacio sin ningun numero", () => {
    expect(extractExactCodes("expedientes de la oficina de presupuesto")).toEqual([]);
  });
});
