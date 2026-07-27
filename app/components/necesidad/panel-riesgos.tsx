"use client";

import { memo, useState } from "react";
import { Loader, Pencil, Plus, ShieldAlert, Trash2 } from "lucide-react";
import type { RiesgoNecesidad } from "@/lib/necesidades";
import { cn } from "@/lib/utils";
import { Badge, Button } from "../ui";
import { ConfirmDialog } from "../confirm-dialog";
import { FICHA_CTRL, FICHA_CTRL_H } from "./ficha-estilos";

/**
 * Matriz de riesgos de la contratación.
 *
 * Salió de `necesidad-detail.tsx` con sus quince variables de estado. Allí el
 * alta y la edición de un riesgo vivían en el mismo componente que la ficha, así
 * que **escribir en cualquiera de los dos volvía a pintar el otro**: la ficha
 * tiene más de mil líneas de formulario y la matriz una tabla, y cada pulsación
 * de tecla las recorría las dos.
 *
 * Por eso va envuelto en `memo`. No es adorno: sin él seguiría repintándose con
 * cada letra que se escribe en la ficha, y la extracción solo habría movido el
 * problema de fichero. Para que sirva, quien lo usa debe pasarle props estables
 * —`onCambio` con identidad fija, no una función nueva por render—.
 *
 * La lista se queda fuera a propósito. Llega en la petición combinada que ya
 * carga la necesidad entera, y duplicarla aquí con un fetch propio añadiría una
 * ida y vuelta y una segunda copia que podría quedar desfasada.
 */
export const PanelRiesgos = memo(function PanelRiesgos({
  necesidadId,
  onCambio,
  onError,
  puedeEditar,
  riesgos,
}: {
  necesidadId: string;
  /** Se llama tras alta, edición o borrado para que el padre recargue la lista. */
  onCambio: () => Promise<void> | void;
  onError: (mensaje: string) => void;
  puedeEditar: boolean;
  riesgos: RiesgoNecesidad[];
}) {
  const [riesgoTexto, setRiesgoTexto] = useState("");
  const [riesgoProb, setRiesgoProb] = useState("");
  const [riesgoImpacto, setRiesgoImpacto] = useState("");
  const [riesgoMitigacion, setRiesgoMitigacion] = useState("");
  const [riesgoResponsable, setRiesgoResponsable] = useState("");
  const [savingRiesgo, setSavingRiesgo] = useState(false);
  const [deletingRiesgoId, setDeletingRiesgoId] = useState<string | null>(null);
  const [confirmDeleteRiesgoId, setConfirmDeleteRiesgoId] = useState<string | null>(null);
  const [riesgoEditId, setRiesgoEditId] = useState<string | null>(null);
  const [riesgoEditTexto, setRiesgoEditTexto] = useState("");
  const [riesgoEditProb, setRiesgoEditProb] = useState("");
  const [riesgoEditImpacto, setRiesgoEditImpacto] = useState("");
  const [riesgoEditMitigacion, setRiesgoEditMitigacion] = useState("");
  const [riesgoEditResponsable, setRiesgoEditResponsable] = useState("");

  async function addRiesgo(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (riesgoTexto.trim().length < 3) {
      onError("Describe el riesgo con más detalle.");
      return;
    }
    if (riesgos.some((r) => r.riesgo.toLowerCase() === riesgoTexto.trim().toLowerCase())) {
      onError("Ya existe un riesgo con ese nombre.");
      return;
    }
    setSavingRiesgo(true);
    try {
      const response = await fetch(`/api/necesidades/${necesidadId}/riesgos`, {
        body: JSON.stringify({
          riesgo: riesgoTexto,
          probabilidad: riesgoProb || undefined,
          impacto: riesgoImpacto || undefined,
          mitigacion: riesgoMitigacion || undefined,
          responsable: riesgoResponsable || undefined,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        onError(payload.error ?? "No se pudo registrar el riesgo.");
        return;
      }
      setRiesgoTexto("");
      setRiesgoProb("");
      setRiesgoImpacto("");
      setRiesgoMitigacion("");
      setRiesgoResponsable("");
      await onCambio();
    } catch {
      onError("No se pudo conectar con el servidor.");
    } finally {
      setSavingRiesgo(false);
    }
  }

  async function borrarRiesgo(riesgoId: string) {
    setDeletingRiesgoId(riesgoId);
    try {
      const response = await fetch(
        `/api/necesidades/${necesidadId}/riesgos?riesgoId=${riesgoId}`,
        { method: "DELETE" },
      );
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        onError(payload.error ?? "No se pudo eliminar el riesgo.");
        return;
      }
      await onCambio();
    } catch {
      onError("No se pudo conectar con el servidor.");
    } finally {
      setDeletingRiesgoId(null);
      setConfirmDeleteRiesgoId(null);
      setRiesgoEditId((prev) => (prev === riesgoId ? null : prev));
    }
  }

  async function guardarEdicion(riesgoId: string) {
    setSavingRiesgo(true);
    try {
      const res = await fetch(`/api/necesidades/${necesidadId}/riesgos?riesgoId=${riesgoId}`, {
        body: JSON.stringify({
          riesgo: riesgoEditTexto,
          probabilidad: riesgoEditProb || undefined,
          impacto: riesgoEditImpacto || undefined,
          mitigacion: riesgoEditMitigacion || undefined,
          responsable: riesgoEditResponsable || undefined,
        }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      });
      if (res.ok) {
        setRiesgoEditId(null);
        await onCambio();
      } else {
        const p = await res.json();
        onError(p.error ?? "No se pudo actualizar.");
      }
    } catch {
      onError("Error de conexión.");
    } finally {
      setSavingRiesgo(false);
    }
  }

  return (
    <section id="sec-riesgos" className="grid grid-cols-[minmax(0,1fr)] content-start gap-3 rounded-[14px] border border-line bg-panel p-3.5 shadow-card">
      <div className="flex flex-wrap items-center gap-2 text-ink">
        <ShieldAlert size={17} />
        <h3 className="panelTitle">Matriz de riesgos</h3>
        <span className="text-xs font-semibold text-muted">{riesgos.length} registrado{riesgos.length === 1 ? "" : "s"}</span>
      </div>

      {riesgos.length === 0 ? (
        <p className="text-xs font-semibold text-muted">
          Sin riesgos registrados. {puedeEditar ? "Identifica riesgos de la contratación y su mitigación." : ""}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[12.5px] [&_th]:whitespace-nowrap [&_th]:border-b [&_th]:border-line [&_th]:px-2.5 [&_th]:py-1.5 [&_th]:text-left [&_th]:font-semibold [&_th]:text-muted [&_td]:border-b [&_td]:border-line [&_td]:px-2.5 [&_td]:py-2 [&_td]:align-top [&_td]:text-ink [&_tr:last-child_td]:border-b-0">
            <thead>
              <tr>
                <th>Riesgo</th>
                <th>Prob.</th>
                <th>Impacto</th>
                <th>Mitigación</th>
                <th>Responsable</th>
                {puedeEditar ? <th aria-label="Acciones" /> : null}
              </tr>
            </thead>
            <tbody>
              {riesgos.map((r) => {
                const editing = riesgoEditId === r.id;
                const isDuplicate = riesgoTexto.trim().length >= 3 && !editing &&
                  riesgos.some((other) => other.id !== r.id && other.riesgo.toLowerCase() === r.riesgo.toLowerCase());
                return (
                  <tr key={r.id} className={isDuplicate ? "riesgoDuplicate" : undefined}>
                    {editing ? (
                      <>
                        <td>
                          <input className={cn(FICHA_CTRL, FICHA_CTRL_H)} value={riesgoEditTexto} onChange={(e) => setRiesgoEditTexto(e.target.value)} />
                        </td>
                        <td>
                          <select className={cn(FICHA_CTRL, FICHA_CTRL_H)} value={riesgoEditProb} onChange={(e) => setRiesgoEditProb(e.target.value)}>
                            <option value="">—</option>
                            <option value="baja">Baja</option>
                            <option value="media">Media</option>
                            <option value="alta">Alta</option>
                          </select>
                        </td>
                        <td>
                          <select className={cn(FICHA_CTRL, FICHA_CTRL_H)} value={riesgoEditImpacto} onChange={(e) => setRiesgoEditImpacto(e.target.value)}>
                            <option value="">—</option>
                            <option value="bajo">Bajo</option>
                            <option value="medio">Medio</option>
                            <option value="alto">Alto</option>
                          </select>
                        </td>
                        <td>
                          <input className={cn(FICHA_CTRL, FICHA_CTRL_H)} value={riesgoEditMitigacion} onChange={(e) => setRiesgoEditMitigacion(e.target.value)} />
                        </td>
                        <td>
                          <input value={riesgoEditResponsable} onChange={(e) => setRiesgoEditResponsable(e.target.value)} />
                        </td>
                        <td>
                          <div className="flex items-center gap-1.5 [&_input]:rounded-lg [&_input]:border [&_input]:border-line [&_input]:bg-panel [&_input]:px-[9px] [&_input]:py-[7px] [&_input]:text-[13px] [&_select]:rounded-lg [&_select]:border [&_select]:border-line [&_select]:bg-panel [&_select]:px-[9px] [&_select]:py-[7px] [&_select]:text-[13px]">
                            <Button variant="primary" onClick={() => void guardarEdicion(r.id)} type="button">Guardar</Button>
                            <Button onClick={() => setRiesgoEditId(null)} type="button">Cancelar</Button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td>{r.riesgo}</td>
                        <td>
                          {r.probabilidad ? (
                            <Badge tone={tonoRiesgo(r.probabilidad)} className="capitalize">{r.probabilidad}</Badge>
                          ) : "—"}
                        </td>
                        <td>
                          {r.impacto ? (
                            <Badge tone={tonoRiesgo(r.impacto)} className="capitalize">{r.impacto}</Badge>
                          ) : "—"}
                        </td>
                        <td>{r.mitigacion ?? "—"}</td>
                        <td>{r.responsable ?? "—"}</td>
                        {puedeEditar ? (
                          <td>
                            <div style={{ display: "flex", gap: 4 }}>
                              <button aria-label="Editar riesgo"
                                onClick={() => {
                                  setRiesgoEditId(r.id);
                                  setRiesgoEditTexto(r.riesgo);
                                  setRiesgoEditProb(r.probabilidad ?? "");
                                  setRiesgoEditImpacto(r.impacto ?? "");
                                  setRiesgoEditMitigacion(r.mitigacion ?? "");
                                  setRiesgoEditResponsable(r.responsable ?? "");
                                }} type="button"><Pencil size={13} /></button>
                              <button aria-label="Eliminar riesgo"
                                disabled={deletingRiesgoId === r.id}
                                onClick={() => setConfirmDeleteRiesgoId(r.id)} type="button">
                                {deletingRiesgoId === r.id ? <Loader size={15} /> : <Trash2 size={15} />}
                              </button>
                            </div>
                          </td>
                        ) : null}
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {puedeEditar ? (
        <form className="grid grid-cols-4 gap-2.5 rounded-[10px] border border-dashed border-brand/30 bg-surface p-3 [&_label]:grid [&_label]:gap-1 [&_label]:text-[12.5px] [&_label]:text-muted [&_input]:rounded-lg [&_input]:border [&_input]:border-line [&_input]:bg-panel [&_input]:px-[9px] [&_input]:py-[7px] [&_input]:text-[13px] [&_select]:rounded-lg [&_select]:border [&_select]:border-line [&_select]:bg-panel [&_select]:px-[9px] [&_select]:py-[7px] [&_select]:text-[13px]" onSubmit={addRiesgo}>
          <label className="col-span-2">
            <span>Riesgo identificado</span>
            <input
              onChange={(e) => setRiesgoTexto(e.target.value)}
              placeholder="Ej. Demora en la entrega por escasez del bien"
              value={riesgoTexto}
            />
          </label>
          <label>
            <span>Probabilidad</span>
            <select onChange={(e) => setRiesgoProb(e.target.value)} value={riesgoProb}>
              <option value="">—</option>
              <option value="baja">Baja</option>
              <option value="media">Media</option>
              <option value="alta">Alta</option>
            </select>
          </label>
          <label>
            <span>Impacto</span>
            <select onChange={(e) => setRiesgoImpacto(e.target.value)} value={riesgoImpacto}>
              <option value="">—</option>
              <option value="bajo">Bajo</option>
              <option value="medio">Medio</option>
              <option value="alto">Alto</option>
            </select>
          </label>
          <label className="col-span-2">
            <span>Mitigación</span>
            <input
              onChange={(e) => setRiesgoMitigacion(e.target.value)}
              placeholder="Medida para reducir el riesgo"
              value={riesgoMitigacion}
            />
          </label>
          <label>
            <span>Responsable</span>
            <input
              onChange={(e) => setRiesgoResponsable(e.target.value)}
              placeholder="Área / cargo"
              value={riesgoResponsable}
            />
          </label>
          <div className="col-span-full flex justify-end">
            <Button variant="primary" disabled={savingRiesgo || riesgoTexto.trim().length < 3} type="submit">
              {savingRiesgo ? <Loader size={15} /> : <Plus size={15} />}
              Agregar riesgo
            </Button>
          </div>
        </form>
      ) : null}

      <ConfirmDialog
        open={confirmDeleteRiesgoId !== null}
        title="Eliminar riesgo"
        message="¿Estás seguro de eliminar este riesgo de la matriz?"
        tone="warning"
        confirmLabel="Eliminar"
        onConfirm={() => { if (confirmDeleteRiesgoId) void borrarRiesgo(confirmDeleteRiesgoId); }}
        onCancel={() => setConfirmDeleteRiesgoId(null)}
      />
    </section>
  );
});

/** Nivel de un riesgo → tono de la insignia. Antes vivía en `.riesgo-*` sueltas. */
function tonoRiesgo(nivel: string): "exito" | "atencion" | "peligro" | "neutral" {
  const v = nivel.toLowerCase();
  if (v.startsWith("baj")) return "exito";
  if (v.startsWith("med")) return "atencion";
  if (v.startsWith("alt")) return "peligro";
  return "neutral";
}
