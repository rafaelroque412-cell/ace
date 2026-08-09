"use client";

import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileText,
  Lightbulb,
  Scale,
  X,
} from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import type { AnalisisTecnico } from "@/lib/expedientes-archivo-actions";

type Props = {
  analisis: AnalisisTecnico | null;
  onDismiss?: () => void;
};

// Banner principal del resumen tecnico del PDF.
// Se muestra PROMINENTE en la parte superior de la pestana Responder.
// El objetivo es que el usuario tenga claro de que se trata el documento
// que subio, sin tener que hacer scroll ni buscar.
export function ResumenTecnicoBanner({ analisis, onDismiss }: Props) {
  const [collapsed, setCollapsed] = useState(false);

  if (!analisis) return null;

  // Si el analisis no tiene contenido util, no mostrar nada.
  const hasContent = Boolean(
    analisis.materia || analisis.puntosClave || analisis.tipoDocumento,
  );
  if (!hasContent) return null;

  return (
    <section
      role="region"
      aria-label="Resumen tecnico del documento PDF"
      style={{
        background: "linear-gradient(180deg, #f0f9ff 0%, #e0f2fe 100%)",
        border: "1px solid #7dd3fc",
        borderLeft: "4px solid #0ea5e9",
        borderRadius: 10,
        padding: "14px 16px",
        marginBottom: 16,
        boxShadow: "0 1px 2px rgba(14, 165, 233, 0.05)",
      }}
    >
      {/* Cabecera: tipo + materia + boton colapsar */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 10,
          marginBottom: collapsed ? 0 : 12,
        }}
      >
        <div
          style={{
            background: "#0ea5e9",
            color: "#fff",
            borderRadius: 8,
            width: 36,
            height: 36,
            display: "grid",
            placeItems: "center",
            flexShrink: 0,
          }}
        >
          <BookOpen size={18} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: "#0c4a6e",
              textTransform: "uppercase",
              letterSpacing: 0.4,
              marginBottom: 2,
            }}
          >
            Resumen tecnico del PDF
          </div>
          {analisis.tipoDocumento ? (
            <div
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: "#0c4a6e",
                lineHeight: 1.3,
                marginBottom: 2,
              }}
            >
              {analisis.tipoDocumento}
            </div>
          ) : null}
          {analisis.materia ? (
            <div
              style={{
                fontSize: 13,
                color: "#0f172a",
                lineHeight: 1.4,
              }}
            >
              {analisis.materia}
            </div>
          ) : null}
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            className="iconButton"
            aria-label={collapsed ? "Expandir resumen" : "Colapsar resumen"}
            title={collapsed ? "Expandir resumen" : "Colapsar resumen"}
          >
            {collapsed ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
          </button>
          {onDismiss ? (
            <button
              type="button"
              onClick={onDismiss}
              className="iconButton"
              aria-label="Cerrar resumen"
              title="Cerrar resumen"
            >
              <X size={15} />
            </button>
          ) : null}
        </div>
      </div>

      {!collapsed ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 10,
            fontSize: 12,
            lineHeight: 1.5,
            color: "#0f172a",
          }}
        >
          {analisis.partes ? (
            <ResumenItem icon={<FileText size={13} />} label="Partes" value={analisis.partes} />
          ) : null}
          {analisis.normativaIdentificada ? (
            <ResumenItem
              icon={<Scale size={13} />}
              label="Normativa que aplica"
              value={analisis.normativaIdentificada}
            />
          ) : null}
        </div>
      ) : null}

      {!collapsed && analisis.puntosClave ? (
        <div
          style={{
            marginTop: 10,
            background: "#fff",
            border: "1px solid #bae6fd",
            borderRadius: 8,
            padding: "10px 12px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 11,
              fontWeight: 700,
              color: "#0c4a6e",
              textTransform: "uppercase",
              letterSpacing: 0.3,
              marginBottom: 6,
            }}
          >
            <CheckCircle2 size={13} /> Puntos clave a responder
          </div>
          <div
            style={{
              fontSize: 13,
              color: "#0f172a",
              lineHeight: 1.55,
              whiteSpace: "pre-wrap",
            }}
          >
            {analisis.puntosClave}
          </div>
        </div>
      ) : null}

      {!collapsed &&
      analisis.consultasSugeridas &&
      analisis.consultasSugeridas.length > 0 ? (
        <div
          style={{
            marginTop: 10,
            background: "#fffbeb",
            border: "1px solid #fde68a",
            borderRadius: 8,
            padding: "10px 12px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 11,
              fontWeight: 700,
              color: "#92400e",
              textTransform: "uppercase",
              letterSpacing: 0.3,
              marginBottom: 6,
            }}
          >
            <Lightbulb size={13} /> Consultas sugeridas para la biblioteca
          </div>
          <ul
            style={{
              margin: 0,
              paddingLeft: 18,
              fontSize: 12,
              color: "#78350f",
              lineHeight: 1.5,
            }}
          >
            {analisis.consultasSugeridas.map((q, i) => (
              <li key={i} style={{ marginBottom: 2 }}>
                {q}
              </li>
            ))}
          </ul>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 11,
              color: "#92400e",
              marginTop: 8,
              padding: "6px 8px",
              background: "#fef3c7",
              borderRadius: 6,
            }}
          >
            <AlertCircle size={12} style={{ flexShrink: 0 }} />
            <span>
              Pega estas consultas en la <strong>Biblioteca de normativa</strong>{" "}
              (boton “Biblioteca” abajo). Si no aparece, puedes activar la
              busqueda en internet en la generacion.
            </span>
          </div>
        </div>
      ) : null}

      {!collapsed && analisis.tipoRespuestaEsperada ? (
        <div
          style={{
            marginTop: 10,
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 10px",
            background: "rgba(255,255,255,0.6)",
            borderRadius: 6,
            fontSize: 11,
            color: "#0c4a6e",
          }}
        >
          <span style={{ fontWeight: 600 }}>Tipo de respuesta sugerido:</span>
          <span
            style={{
              background: "#0ea5e9",
              color: "#fff",
              padding: "2px 8px",
              borderRadius: 4,
              fontWeight: 700,
            }}
          >
            {analisis.tipoRespuestaEsperada}
          </span>
        </div>
      ) : null}
    </section>
  );
}

function ResumenItem({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          fontSize: 10,
          fontWeight: 700,
          color: "#0c4a6e",
          textTransform: "uppercase",
          letterSpacing: 0.3,
          marginBottom: 2,
        }}
      >
        {icon}
        {label}
      </div>
      <div style={{ color: "#0f172a" }}>{value}</div>
    </div>
  );
}
