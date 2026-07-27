import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * El autoguardado se tragaba el motivo del fallo.
 *
 * La ruta `PATCH /api/necesidades/[id]` responde a un 400 diciendo QUÉ campo
 * falla y por qué —se mejoró justo para eso, porque con setenta campos un
 * «Solicitud inválida» a secas deja al usuario sin nada que hacer salvo
 * adivinar—. El autoguardado descartaba esa respuesta y solo mostraba «No se
 * pudo autoguardar».
 *
 * Ocurrió dos veces en el mismo día: la primera con «Cómputo del plazo», y la
 * segunda quedó sin diagnosticar precisamente porque el mensaje no llegaba.
 *
 * La distinción importa: un 400 es de validación, no se arregla solo y va a
 * fallar en cada tecla. Un fallo de red es pasajero, y anunciarlo mientras se
 * escribe sería ruido.
 */
const FUENTE = readFileSync("app/components/necesidad/usar-ficha-form.ts", "utf-8");

function cuerpoDe(nombre: string): string {
  const i = FUENTE.indexOf(nombre);
  expect(i, `no se encontró ${nombre}`).toBeGreaterThan(-1);
  return FUENTE.slice(i, FUENTE.indexOf("\n  }", i));
}

describe("el autoguardado dice por qué falló", () => {
  const cuerpo = cuerpoDe("async function autoguardarFicha");

  it("distingue el 400 del resto de fallos", () => {
    expect(cuerpo).toContain("response.status === 400");
  });

  it("y en ese caso surfacea el mensaje de la ruta", () => {
    // `onError` es lo que pinta el aviso de la página. Sin esta llamada, el
    // usuario no puede saber qué campo corregir.
    const i400 = cuerpo.indexOf("response.status === 400");
    const tramo = cuerpo.slice(i400, i400 + 400);
    expect(tramo).toContain("onError");
  });

  it("los fallos de red siguen callados: son pasajeros", () => {
    // El catch del final no debe anunciar nada: dispara mientras se teclea.
    const catchFinal = cuerpo.slice(cuerpo.lastIndexOf("} catch"));
    expect(catchFinal).not.toContain("onError");
  });
});

describe("el guardado explícito ya lo decía", () => {
  it("sigue mostrando el motivo", () => {
    // No se toca: es la referencia de la que se copia el comportamiento.
    const cuerpo = cuerpoDe("async function saveFicha");
    expect(cuerpo).toContain("onError(data.error");
  });
});
