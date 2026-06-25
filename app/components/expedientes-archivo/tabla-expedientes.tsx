"use client";

import { RefreshCw, Download, Replace, Trash2, FileText } from "lucide-react";
import type { TablaExpedientesProps } from "./types";

export function TablaExpedientes({
  exps,
  canManage,
  selectedIds,
  onToggle,
  onSelectAll,
  onOpen,
  onDelete,
  onDownload,
  onReplace,
  sortBy,
  sortDir,
  onSort,
  reindexingId,
  deletingId,
  reindex,
  formatBytes,
  statusLabel,
}: TablaExpedientesProps) {
  const arrow = (col: string) => (sortBy === col ? (sortDir === "asc" ? " ↑" : " ↓") : "");

  return (
    <div className="subirTablaWrap">
      <table className="subirTabla">
        <thead>
          <tr>
            {canManage ? (
              <th style={{ width: 36 }}>
                <input
                  type="checkbox"
                  checked={exps.length > 0 && exps.every((e) => selectedIds.has(e.id))}
                  onChange={onSelectAll}
                  aria-label="Seleccionar todos"
                />
              </th>
            ) : null}
            <th>
              <button type="button" className="subirSortBtn" onClick={() => onSort("title")}>
                Título{arrow("title")}
              </button>
            </th>
            <th>
              <button type="button" className="subirSortBtn" onClick={() => onSort("anio")}>
                Año{arrow("anio")}
              </button>
            </th>
            <th>Ubicación</th>
            <th>
              <button type="button" className="subirSortBtn" onClick={() => onSort("file_size")}>
                Tamaño{arrow("file_size")}
              </button>
            </th>
            <th>
              <button type="button" className="subirSortBtn" onClick={() => onSort("status")}>
                Status{arrow("status")}
              </button>
            </th>
            {canManage ? <th style={{ width: 140 }}>Acciones</th> : null}
          </tr>
        </thead>
        <tbody>
          {exps.map((exp) => (
            <tr key={exp.id} className={selectedIds.has(exp.id) ? "selected" : ""}>
              {canManage ? (
                <td>
                  <input
                    type="checkbox"
                    checked={selectedIds.has(exp.id)}
                    onChange={() => onToggle(exp.id)}
                    aria-label={`Seleccionar ${exp.title}`}
                  />
                </td>
              ) : null}
              <td>
                <button type="button" className="subirTablaTitle" onClick={() => onOpen(exp)}>
                  <strong>{exp.title}</strong>
                </button>
                <div className="subirTablaSub">
                  {exp.anio ? `${exp.anio}` : ""}
                  {exp.oficina ? ` · ${exp.oficina}` : ""}
                </div>
              </td>
              <td>{exp.anio ?? "—"}</td>
              <td className="subirTablaUbicacion">
                {[exp.nro_estante && `E${exp.nro_estante}`, exp.nro_piso && `P${exp.nro_piso}`, exp.nro_local]
                  .filter(Boolean)
                  .join(" / ") || "—"}
              </td>
              <td>{formatBytes(exp.file_size)}</td>
              <td>
                <span className={`subirStatusBadge subirStatus_${exp.status}`} data-status={exp.status}>
                  {statusLabel(exp.status)}
                </span>
              </td>
              {canManage ? (
                <td>
                  <div className="subirRowActions">
                    <button
                      type="button"
                      className="subirRowActionBtn"
                      title="Reindexar"
                      onClick={() => void reindex(exp.id)}
                      disabled={reindexingId === exp.id}
                    >
                      <RefreshCw size={14} className={reindexingId === exp.id ? "spin" : ""} />
                    </button>
                    <button
                      type="button"
                      className="subirRowActionBtn"
                      title="Descargar"
                      onClick={() => onDownload(exp)}
                    >
                      <Download size={14} />
                    </button>
                    <button
                      type="button"
                      className="subirRowActionBtn"
                      title="Reemplazar PDF"
                      onClick={() => onReplace(exp)}
                    >
                      <Replace size={14} />
                    </button>
                    <button
                      type="button"
                      className="subirRowActionBtn subirRowActionDanger"
                      title="Eliminar"
                      onClick={() => onDelete(exp)}
                      disabled={reindexingId === exp.id || deletingId === exp.id}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
      {exps.length === 0 ? (
        <div className="emptyState">
          <FileText size={20} />
          <p>No hay expedientes que coincidan con los filtros aplicados.</p>
        </div>
      ) : null}
    </div>
  );
}
