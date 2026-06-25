"use client";

import { memo } from "react";
import { RefreshCw, Download, Replace, Trash2, FileText, MapPin } from "lucide-react";
import type { TablaExpedientesProps } from "./types";

function StatusBadge({ status, label }: { status: string; label: string }) {
  return (
    <span className={`expStatus expStatus-${status}`} data-status={status}>
      {label}
    </span>
  );
}

// Componente a nivel de módulo (no dentro del render) para no resetear estado
// en cada render — react-hooks/static-components.
function SortBtn({
  col,
  children,
  sortBy,
  sortDir,
  onSort,
}: {
  col: string;
  children: React.ReactNode;
  sortBy: string;
  sortDir: string;
  onSort: (col: string) => void;
}) {
  const arrow = sortBy === col ? (sortDir === "asc" ? " ↑" : " ↓") : "";
  return (
    <button
      type="button"
      className={`expTableSortBtn ${sortBy === col ? "activeSort" : ""}`}
      onClick={() => onSort(col)}
    >
      {children}
      {arrow}
    </button>
  );
}

export const TablaExpedientes = memo(function TablaExpedientes({
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
  return (
    <div className="expTableWrap">
      <table className="expTable">
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
              <SortBtn col="title" sortBy={sortBy} sortDir={sortDir} onSort={onSort}>
                Título
              </SortBtn>
            </th>
            <th>
              <SortBtn col="anio" sortBy={sortBy} sortDir={sortDir} onSort={onSort}>
                Año
              </SortBtn>
            </th>
            <th>Ubicación</th>
            <th>
              <SortBtn col="file_size" sortBy={sortBy} sortDir={sortDir} onSort={onSort}>
                Tamaño
              </SortBtn>
            </th>
            <th>
              <SortBtn col="status" sortBy={sortBy} sortDir={sortDir} onSort={onSort}>
                Estado
              </SortBtn>
            </th>
            {canManage ? <th style={{ width: 140 }}>Acciones</th> : null}
          </tr>
        </thead>
        <tbody>
          {exps.map((exp) => (
            <tr
              key={exp.id}
              className={selectedIds.has(exp.id) ? "selected" : ""}
            >
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
                <button
                  type="button"
                  className="expTableTitle"
                  onClick={() => onOpen(exp)}
                >
                  {exp.title}
                </button>
                <div className="expTableSub">
                  {exp.anio ? `${exp.anio}` : ""}
                  {exp.oficina ? ` · ${exp.oficina}` : ""}
                </div>
              </td>
              <td>{exp.anio ?? "—"}</td>
              <td>
                <span className="expTableUbicacion">
                  <MapPin size={11} style={{ display: "inline", marginRight: 4 }} />
                  {[exp.nro_estante && `E${exp.nro_estante}`, exp.nro_piso && `P${exp.nro_piso}`, exp.nro_local]
                    .filter(Boolean)
                    .join(" / ") || "—"}
                </span>
              </td>
              <td>{formatBytes(exp.file_size)}</td>
              <td>
                <StatusBadge status={exp.status} label={statusLabel(exp.status)} />
              </td>
              {canManage ? (
                <td>
                  <div className="expListItemActions" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => void reindex(exp.id)}
                      disabled={reindexingId === exp.id}
                      className="expIconButton"
                      title="Reindexar"
                      aria-label="Reindexar"
                    >
                      <RefreshCw
                        size={14}
                        className={reindexingId === exp.id ? "expSpin" : ""}
                      />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDownload(exp)}
                      className="expIconButton"
                      title="Descargar"
                      aria-label="Descargar"
                    >
                      <Download size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => onReplace(exp)}
                      className="expIconButton"
                      title="Reemplazar PDF"
                      aria-label="Reemplazar PDF"
                    >
                      <Replace size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(exp)}
                      disabled={reindexingId === exp.id || deletingId === exp.id}
                      className="expIconButton danger"
                      title="Eliminar"
                      aria-label="Eliminar"
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
        <div className="expEmpty" style={{ borderRadius: 0, border: 0 }}>
          <div className="expEmpty-icon">
            <FileText size={24} />
          </div>
          <h3 className="expEmpty-title">Sin resultados</h3>
          <p className="expEmpty-desc">
            No hay expedientes que coincidan con los filtros aplicados.
          </p>
        </div>
      ) : null}
    </div>
  );
});
