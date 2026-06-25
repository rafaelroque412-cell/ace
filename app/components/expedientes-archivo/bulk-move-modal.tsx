"use client";

import { useState } from "react";
import { X, Save } from "lucide-react";
import type { BulkMoveModalProps } from "./types";

export function BulkMoveModal({ count, onClose, onApply }: BulkMoveModalProps) {
  const [oficina, setOficina] = useState("");
  const [nroEstante, setNroEstante] = useState("");
  const [nroPiso, setNroPiso] = useState("");
  const [nroLocal, setNroLocal] = useState("");
  const [nroArchivador, setNroArchivador] = useState("");
  const [color, setColor] = useState("");

  // Contar cuántos campos tienen valor (para habilitar el botón)
  const filledCount = [oficina, nroEstante, nroPiso, nroLocal, nroArchivador, color]
    .filter((v) => v.trim().length > 0).length;

  function apply() {
    const updates: Record<string, unknown> = {};
    if (oficina.trim()) updates.oficina = oficina.trim();
    if (nroEstante.trim()) updates.nroEstante = nroEstante.trim();
    if (nroPiso.trim()) updates.nroPiso = nroPiso.trim();
    if (nroLocal.trim()) updates.nroLocal = nroLocal.trim();
    if (nroArchivador.trim()) updates.nroArchivador = nroArchivador.trim();
    if (color) updates.colorArchivador = color;
    onApply(updates);
  }

  return (
    <div className="subirSlideOverOverlay" onClick={onClose}>
      <aside
        className="subirSlideOver subirSlideOverModal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Mover o reasignar expedientes"
      >
        <header className="subirSlideOverHead">
          <div>
            <strong>Mover / reasignar {count} expediente(s)</strong>
            <span>Solo se aplican los campos con valor. El resto se preserva.</span>
          </div>
          <button
            type="button"
            className="subirSlideOverClose"
            onClick={onClose}
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </header>
        <div className="subirSlideOverBody">
          <div className="formGrid">
            <label className="fullSpan">
              <span>Oficina</span>
              <input
                value={oficina}
                onChange={(e) => setOficina(e.target.value)}
                placeholder="Si lo dejas vacío no se cambia"
              />
            </label>
            <label>
              <span>Estante</span>
              <input
                value={nroEstante}
                onChange={(e) => setNroEstante(e.target.value)}
                placeholder="Ej. 3"
              />
            </label>
            <label>
              <span>Piso</span>
              <input
                value={nroPiso}
                onChange={(e) => setNroPiso(e.target.value)}
                placeholder="Ej. 2"
              />
            </label>
            <label>
              <span>Local / ambiente</span>
              <input
                value={nroLocal}
                onChange={(e) => setNroLocal(e.target.value)}
                placeholder="Ej. A-1"
              />
            </label>
            <label>
              <span>Nº archivador</span>
              <input
                value={nroArchivador}
                onChange={(e) => setNroArchivador(e.target.value)}
                placeholder="Opcional"
              />
            </label>
            <label>
              <span>Color</span>
              <select value={color} onChange={(e) => setColor(e.target.value)}>
                <option value="">— Sin cambio —</option>
                <option value="rojo">Rojo</option>
                <option value="azul">Azul</option>
                <option value="verde">Verde</option>
                <option value="amarillo">Amarillo</option>
                <option value="naranja">Naranja</option>
                <option value="celeste">Celeste</option>
                <option value="negro">Negro</option>
                <option value="blanco">Blanco</option>
                <option value="plomo">Plomo</option>
                <option value="otros">Otros</option>
              </select>
            </label>
          </div>
          <div className="subirSlideOverActions">
            <button type="button" className="subirGhostBtn" onClick={onClose}>
              Cancelar
            </button>
            <button
              type="button"
              className="primaryButton"
              onClick={apply}
              disabled={filledCount === 0}
              title={filledCount === 0 ? "Completa al menos un campo" : `Aplicar ${filledCount} campo(s)`}
            >
              <Save size={16} /> Aplicar a {count} expediente(s) ({filledCount} campo{filledCount === 1 ? "" : "s"})
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}
