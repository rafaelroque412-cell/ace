"use client";

import { FileText, MapPin } from "lucide-react";
import type { TarjetasExpedientesProps } from "./types";

export function TarjetasExpedientes({ exps, onOpen, formatBytes, statusLabel }: TarjetasExpedientesProps) {
  return (
    <div className="subirTarjetasGrid">
      {exps.map((exp) => (
        <button key={exp.id} type="button" className="subirTarjeta" onClick={() => onOpen(exp)}>
          <div className="subirTarjetaHead">
            <FileText size={28} />
            <small data-status={exp.status}>{statusLabel(exp.status)}</small>
          </div>
          <strong>{exp.title}</strong>
          <span className="subirTarjetaMeta">
            {exp.anio ? `${exp.anio} · ` : ""}
            {formatBytes(exp.file_size)}
          </span>
          <span className="subirTarjetaMeta">{exp.oficina ?? "Sin oficina"}</span>
          <span className="subirTarjetaMeta subirTarjetaUbicacion">
            <MapPin size={11} />{" "}
            {[exp.nro_estante && `E${exp.nro_estante}`, exp.nro_piso && `P${exp.nro_piso}`, exp.nro_local]
              .filter(Boolean)
              .join(" / ") || "Sin ubicación"}
          </span>
        </button>
      ))}
    </div>
  );
}
