// Resuelve los VALORES reales de un expediente para su plantilla de bases
// (lib/bases-plantillas.ts), cruzando cada CampoBases contra los hitos A1-A9
// ya registrados o contra el dato de la entidad contratante. No inventa nada:
// un campo sin dato queda `resuelto: false` con `valor: ""`, igual que la
// plantilla oficial deja `[...]` sin completar (lib/bases-docx.ts, Task 4, lo
// imprime así).

import { plantillaDeProceso } from "./bases-plantillas";
import type { HitosMap } from "./procurement-fases";

export type ValorBases = { ruta: string; label: string; valor: string; resuelto: boolean };

function txt(v: unknown): string {
  return typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "";
}

export function resolverBases(
  proceso: string,
  hitos: HitosMap,
  entidad: { nombre: string; ruc: string },
): ValorBases[] | null {
  const plantilla = plantillaDeProceso(proceso);
  if (!plantilla) return null;

  return plantilla.seccionEspecifica.map((campo): ValorBases => {
    if (campo.origen === "libre") {
      return { label: campo.label, resuelto: false, ruta: campo.ruta, valor: "" };
    }
    if (campo.origen === "entidad") {
      // Nombre/RUC de la entidad contratante: no viven en ningún hito, sino en
      // Configuración → Municipalidad (entity_settings). El llamador los trae y
      // los pasa aquí ya resueltos (ver la ruta de exportación, Task 4).
      const valor = campo.ruta === "cap1.entidad.ruc" ? entidad.ruc.trim() : entidad.nombre.trim();
      return { label: campo.label, resuelto: valor !== "", ruta: campo.ruta, valor };
    }
    // origen === "literal"
    const data = (hitos[campo.hito!]?.data ?? {}) as Record<string, unknown>;
    const valor = txt(data[campo.campoHito!]);
    return { label: campo.label, resuelto: valor !== "", ruta: campo.ruta, valor };
  });
}
