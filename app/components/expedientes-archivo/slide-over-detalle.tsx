"use client";

import { Download, Loader2, Pencil, RefreshCw, Save, Sparkles } from "lucide-react";
import { ARCHIVO_COLORES, CONTENEDOR_TIPOS, CONTENEDOR_TIPO_LABELS } from "@/lib/expedientes-archivo";
import { ExpSlideOver } from "./slide-over-shell";
import type { ExpedienteItem } from "./types";

export type SlideOverDetalleProps = {
  openExp: ExpedienteItem;
  editMode: boolean;
  editForm: Record<string, unknown>;
  savingEdit: boolean;
  isAdmin: boolean;
  canManage: boolean;
  formatBytes: (n: number) => string;
  onClose: () => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSetEditField: (key: string, value: unknown) => void;
  onSaveEdits: () => void;
  onReplace: (exp: ExpedienteItem) => void;
};

export function ExpedienteSlideOver({
  openExp,
  editMode,
  editForm,
  savingEdit,
  isAdmin,
  canManage,
  formatBytes,
  onClose,
  onStartEdit,
  onCancelEdit,
  onSetEditField,
  onSaveEdits,
  onReplace,
}: SlideOverDetalleProps) {
  // Escape, foco atrapado y bloqueo de scroll los aporta ExpSlideOver (Radix).
  return (
    <ExpSlideOver
      onClose={onClose}
      subtitulo={
        <>
          {openExp.serie_documento ?? "Sin número"} · {openExp.anio ?? "s/f"} ·{" "}
          {formatBytes(openExp.file_size)}
        </>
      }
      titulo={openExp.title}
    >
        <div className="expSlideOver-body">
          <iframe
            title="Vista previa"
            src={`/api/expedientes-archivo/${openExp.id}`}
            style={{ width: "100%", height: "70vh", border: 0 }}
          />
          {openExp.metadata?.tokenUsage ? (
            <div
              className="expHelpText"
              style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}
              title="Tokens de OpenAI consumidos al procesar este expediente (OCR + análisis). Coste estimado."
            >
              <Sparkles size={12} />
              Consumo IA: {openExp.metadata.tokenUsage.totalTokens.toLocaleString("es-PE")} tokens
              {openExp.metadata.tokenUsage.estimatedCostUsd > 0
                ? ` · ~$${openExp.metadata.tokenUsage.estimatedCostUsd.toFixed(4)}`
                : ""}
              {openExp.metadata.tokenUsage.ocr
                ? ` · OCR ${openExp.metadata.tokenUsage.ocr.model}${
                    openExp.metadata.tokenUsage.ocr.fromCache ? " (reutilizado)" : ""
                  }`
                : ""}
              {openExp.metadata.tokenUsage.analysis
                ? ` · análisis ${openExp.metadata.tokenUsage.analysis.model}`
                : ""}
            </div>
          ) : null}
          {editMode ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
                marginTop: 16,
              }}
            >
              <div className="expField" style={{ gridColumn: "1 / -1" }}>
                <label className="expField-label">Título</label>
                <input
                  className="expField-input"
                  value={String(editForm.title ?? "")}
                  onChange={(e) => onSetEditField("title", e.target.value)}
                />
              </div>
              <div className="expField">
                <label className="expField-label">Nº SGD</label>
                <input
                  className="expField-input"
                  value={String(editForm.sgd_expediente ?? "")}
                  onChange={(e) => onSetEditField("sgd_expediente", e.target.value)}
                />
              </div>
              <div className="expField">
                <label className="expField-label">Serie documental</label>
                <input
                  className="expField-input"
                  value={String(editForm.serie_documento ?? "")}
                  onChange={(e) => onSetEditField("serie_documento", e.target.value)}
                />
              </div>
              <div className="expField">
                <label className="expField-label">Año</label>
                <input
                  type="number"
                  className="expField-input"
                  value={String(editForm.anio ?? "")}
                  onChange={(e) => onSetEditField("anio", e.target.value)}
                />
              </div>
              <div className="expField">
                <label className="expField-label">Tipo de documento</label>
                <input
                  className="expField-input"
                  value={String(editForm.tipo_documento ?? "")}
                  onChange={(e) => onSetEditField("tipo_documento", e.target.value)}
                />
              </div>
              <div className="expField" style={{ gridColumn: "1 / -1" }}>
                <label className="expField-label">Oficina</label>
                <input
                  className="expField-input"
                  value={String(editForm.oficina ?? "")}
                  onChange={(e) => onSetEditField("oficina", e.target.value)}
                  readOnly={!isAdmin}
                  title={!isAdmin ? "Solo un administrador puede cambiar la oficina" : undefined}
                />
              </div>
              <div className="expField" style={{ gridColumn: "1 / -1" }}>
                <label className="expField-label">Materia</label>
                <input
                  className="expField-input"
                  value={String(editForm.materia ?? "")}
                  onChange={(e) => onSetEditField("materia", e.target.value)}
                />
              </div>
              <div className="expField" style={{ gridColumn: "1 / -1" }}>
                <label className="expField-label">Asunto</label>
                <textarea
                  className="expField-input"
                  rows={2}
                  value={String(editForm.asunto ?? "")}
                  onChange={(e) => onSetEditField("asunto", e.target.value)}
                />
              </div>
              <div className="expField" style={{ gridColumn: "1 / -1" }}>
                <label className="expField-label">Resumen</label>
                <textarea
                  className="expField-input"
                  rows={3}
                  value={String(editForm.resumen ?? "")}
                  onChange={(e) => onSetEditField("resumen", e.target.value)}
                />
              </div>
              <div className="expField" style={{ gridColumn: "1 / -1" }}>
                <label className="expField-label">Observaciones</label>
                <textarea
                  className="expField-input"
                  rows={2}
                  value={String(editForm.observaciones ?? "")}
                  onChange={(e) => onSetEditField("observaciones", e.target.value)}
                />
              </div>
              <div className="expField">
                <label className="expField-label">Tipo de persona</label>
                <select
                  className="expField-select"
                  value={String(editForm.persona_tipo ?? "")}
                  onChange={(e) => onSetEditField("persona_tipo", e.target.value)}
                >
                  <option value="">— Sin persona —</option>
                  <option value="natural">Natural</option>
                  <option value="juridica">Jurídica</option>
                </select>
              </div>
              <div className="expField">
                <label className="expField-label">Documento de la persona</label>
                <input
                  className="expField-input"
                  value={String(editForm.persona_documento ?? "")}
                  onChange={(e) => onSetEditField("persona_documento", e.target.value)}
                />
              </div>
              <div className="expField" style={{ gridColumn: "1 / -1" }}>
                <label className="expField-label">Nombre / razón social</label>
                <input
                  className="expField-input"
                  value={String(editForm.persona_nombre ?? "")}
                  onChange={(e) => onSetEditField("persona_nombre", e.target.value)}
                />
              </div>
              <div className="expField">
                <label className="expField-label">Tipo de contenedor</label>
                <select
                  className="expField-select"
                  value={String(editForm.tipo_almacenamiento ?? "")}
                  onChange={(e) => onSetEditField("tipo_almacenamiento", e.target.value)}
                >
                  {CONTENEDOR_TIPOS.map((t) => (
                    <option key={t} value={t}>
                      {CONTENEDOR_TIPO_LABELS[t]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="expField">
                <label className="expField-label">Color</label>
                <select
                  className="expField-select"
                  value={String(editForm.color_archivador ?? "")}
                  onChange={(e) => onSetEditField("color_archivador", e.target.value)}
                >
                  <option value="">— Sin color —</option>
                  {ARCHIVO_COLORES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div className="expField">
                <label className="expField-label">Nº de archivador</label>
                <input
                  className="expField-input"
                  value={String(editForm.nro_archivador ?? "")}
                  onChange={(e) => onSetEditField("nro_archivador", e.target.value)}
                />
              </div>
              <div className="expField">
                <label className="expField-label">Nº de paquete</label>
                <input
                  className="expField-input"
                  value={String(editForm.nro_paquete ?? "")}
                  onChange={(e) => onSetEditField("nro_paquete", e.target.value)}
                />
              </div>
              <div className="expField">
                <label className="expField-label">Empastado</label>
                <select
                  className="expField-select"
                  value={String(editForm.empastado ?? "")}
                  onChange={(e) => onSetEditField("empastado", e.target.value)}
                >
                  <option value="">— Sin dato —</option>
                  <option value="si">Sí</option>
                  <option value="no">No</option>
                </select>
              </div>
              <div className="expField">
                <label className="expField-label">Folio</label>
                <input
                  className="expField-input"
                  value={String(editForm.folio ?? "")}
                  onChange={(e) => onSetEditField("folio", e.target.value)}
                />
              </div>
              <div className="expField">
                <label className="expField-label">Estante</label>
                <input
                  className="expField-input"
                  value={String(editForm.nro_estante ?? "")}
                  onChange={(e) => onSetEditField("nro_estante", e.target.value)}
                />
              </div>
              <div className="expField">
                <label className="expField-label">Piso</label>
                <input
                  className="expField-input"
                  value={String(editForm.nro_piso ?? "")}
                  onChange={(e) => onSetEditField("nro_piso", e.target.value)}
                />
              </div>
              <div className="expField" style={{ gridColumn: "1 / -1" }}>
                <label className="expField-label">Local / ambiente</label>
                <input
                  className="expField-input"
                  value={String(editForm.nro_local ?? "")}
                  onChange={(e) => onSetEditField("nro_local", e.target.value)}
                />
              </div>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
              {openExp.materia ? (
                <div className="expField">
                  <label className="expField-label">Materia</label>
                  <div>{openExp.materia}</div>
                </div>
              ) : null}
              {openExp.asunto ? (
                <div className="expField">
                  <label className="expField-label">Asunto</label>
                  <div>{openExp.asunto}</div>
                </div>
              ) : null}
              {(openExp.nro_estante || openExp.nro_piso || openExp.nro_local) ? (
                <div className="expField">
                  <label className="expField-label">Ubicación física</label>
                  <div>
                    {[openExp.nro_estante && `Estante ${openExp.nro_estante}`, openExp.nro_piso && `Piso ${openExp.nro_piso}`, openExp.nro_local]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>
        {canManage ? (
          <div className="expSlideOver-footer">
            {editMode ? (
              <>
                <button
                  type="button"
                  className="expBtn expBtn-ghost"
                  onClick={onCancelEdit}
                  disabled={savingEdit}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="expBtn expBtn-primary"
                  onClick={() => void onSaveEdits()}
                  disabled={savingEdit}
                >
                  {savingEdit ? <Loader2 size={14} className="expSpin" /> : <Save size={14} />}
                  {savingEdit ? "Guardando…" : "Guardar cambios"}
                </button>
              </>
            ) : (
              <>
                <button type="button" className="expBtn expBtn-ghost" onClick={onStartEdit}>
                  <Pencil size={14} /> Editar datos
                </button>
                <button
                  type="button"
                  className="expBtn expBtn-ghost"
                  onClick={() => {
                    onReplace(openExp);
                    onClose();
                  }}
                >
                  <RefreshCw size={14} /> Reemplazar PDF
                </button>
                <a
                  href={`/api/expedientes-archivo/${openExp.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="expBtn expBtn-secondary"
                >
                  <Download size={14} /> Descargar
                </a>
                <button
                  type="button"
                  className="expBtn expBtn-primary"
                  onClick={onClose}
                >
                  Cerrar
                </button>
              </>
            )}
          </div>
        ) : null}
    </ExpSlideOver>
  );
}
