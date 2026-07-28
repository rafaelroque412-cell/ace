"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Plus, Trash2 } from "lucide-react";
import {
  FILA_FORMACION_VACIA,
  type FilaFormacion,
  componerRequisitoFormacion,
  formacionIncompletas,
  formatFilasFormacion,
  parseFilasFormacion,
} from "@/lib/formacion-academica";

/**
 * Cuadro de formación académica del personal clave (Art. 72.3.b, C.2.1).
 *
 * Una fila por puesto: el grado o título requerido y el personal clave del que se
 * acredita. Se añaden y se quitan con el botón. La columna «Requisito» es de solo
 * lectura: se compone con los dos campos de la fila y es lo que va al documento.
 *
 * Igual que el cuadro del personal clave: guarda lo TECLEADO y solo re-sincroniza
 * cuando el valor cambia por FUERA (recarga de la ficha).
 */
export function FormacionAcademicaEditor({
  value,
  onChange,
  readOnly = false,
}: {
  value: string;
  onChange: (next: string) => void;
  readOnly?: boolean;
}) {
  const [filas, setFilas] = useState<FilaFormacion[]>(() => parseFilasFormacion(value));
  const emitido = useRef(value);

  useEffect(() => {
    if (value === emitido.current) return;
    setFilas(parseFilasFormacion(value));
    emitido.current = value;
  }, [value]);

  function propagar(siguientes: FilaFormacion[]) {
    if (readOnly) return;
    setFilas(siguientes);
    const texto = formatFilasFormacion(siguientes);
    emitido.current = texto;
    onChange(texto);
  }

  const editar = (i: number, cambio: Partial<FilaFormacion>) =>
    propagar(filas.map((f, k) => (k === i ? { ...f, ...cambio } : f)));

  const incompletas = formacionIncompletas(filas);
  const celda =
    "w-full rounded-md border border-line bg-panel px-2 py-1 text-[12.5px] leading-relaxed text-ink " +
    "outline-none focus:border-brand focus:shadow-[var(--shadow-focus)]";

  return (
    <div className="flex flex-col gap-2.5">
      {filas.length > 0 ? (
        <div className="overflow-x-auto rounded-[10px] border border-line">
          <table className="w-full border-collapse text-[12.5px] [&_th]:border-b [&_th]:border-line [&_th]:px-2.5 [&_th]:py-1.5 [&_th]:text-left [&_th]:font-semibold [&_th]:text-muted [&_td]:border-b [&_td]:border-line [&_td]:px-2.5 [&_td]:py-1.5 [&_td]:align-top [&_tr:last-child_td]:border-b-0">
            <thead>
              <tr>
                <th scope="col">N.º</th>
                <th scope="col">Grado de bachiller o título profesional requerido</th>
                <th scope="col">Personal clave del cual acreditar el requisito</th>
                <th scope="col">Requisito</th>
                {readOnly ? null : <th scope="col"><span className="sr-only">Quitar</span></th>}
              </tr>
            </thead>
            <tbody>
              {filas.map((fila, i) => (
                <tr key={i}>
                  <td className="text-muted tabular-nums">{i + 1}</td>
                  <td className="min-w-[170px]">
                    <textarea
                      aria-label={`Grado o título del personal clave ${i + 1}`}
                      className={celda}
                      disabled={readOnly}
                      onChange={(e) => editar(i, { grado: e.target.value })}
                      placeholder="Título profesional de Ingeniero Civil"
                      rows={2}
                      value={fila.grado}
                    />
                  </td>
                  <td className="min-w-[150px]">
                    <textarea
                      aria-label={`Personal clave del cual acreditar ${i + 1}`}
                      className={celda}
                      disabled={readOnly}
                      onChange={(e) => editar(i, { puesto: e.target.value })}
                      placeholder="Ingeniero residente"
                      rows={2}
                      value={fila.puesto}
                    />
                  </td>
                  {/* Se redacta solo con los dos campos de la fila. */}
                  <td className="min-w-[190px] text-muted">{componerRequisitoFormacion(fila)}</td>
                  {readOnly ? null : (
                    <td>
                      <button
                        aria-label={`Quitar el requisito ${i + 1}`}
                        className="rounded-md p-1 text-muted transition hover:bg-danger/10 hover:text-danger"
                        onClick={() => propagar(filas.filter((_, k) => k !== i))}
                        type="button"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {incompletas.length > 0 ? (
        <p className="m-0 flex items-start gap-1.5 text-[11.5px] leading-[1.45] text-warning" role="status">
          <AlertTriangle aria-hidden className="mt-0.5 shrink-0" size={12} />
          <span>
            {incompletas.length === 1
              ? `Al requisito ${incompletas[0]} le falta el grado o el puesto.`
              : `A los requisitos ${incompletas.join(", ")} les falta el grado o el puesto.`}
          </span>
        </p>
      ) : null}

      {readOnly ? null : (
        <button
          className="inline-flex w-fit items-center gap-1.5 rounded-lg px-1 text-[12.5px] font-semibold text-brand hover:underline"
          onClick={() => propagar([...filas, { ...FILA_FORMACION_VACIA }])}
          type="button"
        >
          <Plus size={13} /> Agregar formación académica
        </button>
      )}
    </div>
  );
}
