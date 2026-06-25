"use client";

import { FileText, MapPin } from "lucide-react";
import type { TarjetasExpedientesProps } from "./types";

export function TarjetasExpedientes({ exps, onOpen, formatBytes, statusLabel }: TarjetasExpedientesProps) {
  return (
    <div className="expCardsGrid">
      {exps.map((exp) => (
        <button key={exp.id} type="button" className="expCard" onClick={() => onOpen(exp)}>
          <div className="expCardHeader">
            <div className="expCardIcon">
              <FileText size={16} />
            </div>
            <span
              className={`expStatus expStatus-${exp.status}`}
              data-status={exp.status}
            >
              {statusLabel(exp.status)}
            </span>
          </div>
          <h3 className="expCardTitle">{exp.title}</h3>
          <div className="expCardMeta">
            <span>
              {exp.anio ? `${exp.anio} · ` : ""}
              {formatBytes(exp.file_size)}
            </span>
            <span>{exp.oficina ?? "Sin oficina"}</span>
          </div>
          {exp.nro_estante || exp.nro_piso || exp.nro_local ? (
            <div className="expCardUbicacion">
              <MapPin size={12} />
              {[exp.nro_estante && `E${exp.nro_estante}`, exp.nro_piso && `P${exp.nro_piso}`, exp.nro_local]
                .filter(Boolean)
                .join(" / ")}
            </div>
          ) : (
            <div className="expCardUbicacion" style={{ color: "var(--exp-muted)" }}>
              <MapPin size={12} />
              Sin ubicación
            </div>
          )}
        </button>
      ))}
    </div>
  );
}
