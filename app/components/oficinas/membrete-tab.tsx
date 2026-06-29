"use client";

import {
  CheckCircle2,
  FileUp,
  Loader2,
  Lock,
  ScrollText,
  Trash2,
} from "lucide-react";
import { useRef, useState } from "react";
import type { Oficina } from "./use-oficinas";

const API = "/api/configuracion/oficinas";

export function MembreteTab({
  oficinas,
  setOficinas,
  busyId,
  setBusyId,
  setError,
  reload,
}: {
  oficinas: Oficina[];
  setOficinas: (v: Oficina[]) => void;
  busyId: string | null;
  setBusyId: (v: string | null) => void;
  setError: (v: string | null) => void;
  reload: () => Promise<void>;
}) {
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  if (oficinas.length === 0) {
    return (
      <div
        style={{
          background: "#f1f5f9",
          color: "#475569",
          padding: 16,
          borderRadius: 8,
          fontSize: 14,
        }}
      >
        <strong>No hay oficinas registradas.</strong>
        <p style={{ margin: "6px 0 0", fontSize: 13 }}>
          Primero crea un área en la pestaña anterior. Luego podrás subir aquí la
          hoja membretada (PDF) que se usa de fondo al exportar las respuestas en
          PDF.
        </p>
      </div>
    );
  }

  async function uploadMembrete(id: string, file: File | null | undefined) {
    if (!file) return;
    setBusyId(id);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("oficinaId", id);
      const res = await fetch(`${API}/membrete`, { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await reload();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo subir la hoja membretada",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function deleteMembrete(id: string) {
    if (!confirm("¿Eliminar la hoja membretada de esta oficina?")) return;
    setBusyId(id);
    try {
      const res = await fetch(`${API}/membrete?oficinaId=${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await reload();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo eliminar la hoja membretada",
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div
        style={{
          background: "#fef3c7",
          color: "#92400e",
          padding: 12,
          borderRadius: 8,
          fontSize: 13,
        }}
      >
        <ScrollText size={14} style={{ verticalAlign: "-2px" }} /> La hoja membretada
        es el <strong>PDF de fondo</strong> sobre el cual se redactan las respuestas
        oficiales. Sin membrete, el PDF exportado sale en blanco (solo el texto del
        cuerpo). El documento puede ser de hasta 100&nbsp;MB.
      </div>

      {oficinas.map((o) => (
        <div
          key={o.id}
          style={{
            border: "1px solid var(--line, #e2e4ea)",
            borderRadius: 12,
            padding: 14,
            opacity: o.membrete ? 1 : 1,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              marginBottom: 8,
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            <h4 style={{ margin: 0, fontSize: 15 }}>{o.nombre}</h4>
            {o.membrete ? (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  color: "#1f9d55",
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                <CheckCircle2 size={14} /> Membrete cargado
              </span>
            ) : (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  color: "#94a3b8",
                  fontSize: 12,
                  fontWeight: 500,
                }}
              >
                <Lock size={12} /> Sin membrete
              </span>
            )}
          </div>

          <p
            style={{
              fontSize: 12,
              color: "var(--muted, #667)",
              margin: "0 0 10px",
            }}
          >
            {o.entidad ?? "Sin entidad"}
            {o.sufijo ? ` · ${o.sufijo}` : ""}
          </p>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              className={o.membrete ? "secondaryButton" : "primaryButton"}
              type="button"
              onClick={() => fileRefs.current[o.id]?.click()}
              disabled={busyId === o.id}
            >
              {busyId === o.id ? (
                <Loader2 size={16} className="expSpin" />
              ) : (
                <FileUp size={16} />
              )}{" "}
              {o.membrete ? "Reemplazar membrete" : "Subir PDF membretado"}
            </button>
            {o.membrete ? (
              <button
                className="secondaryButton"
                type="button"
                onClick={() => deleteMembrete(o.id)}
                disabled={busyId === o.id}
                style={{ color: "#c0392b" }}
              >
                <Trash2 size={14} /> Eliminar
              </button>
            ) : null}
            <input
              ref={(el) => {
                fileRefs.current[o.id] = el;
              }}
              type="file"
              accept="application/pdf"
              style={{ display: "none" }}
              onChange={(e) => {
                void uploadMembrete(o.id, e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
