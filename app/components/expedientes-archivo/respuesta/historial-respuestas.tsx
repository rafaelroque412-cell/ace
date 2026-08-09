"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Copy, FileText, GitCompare, History, Loader2, Search, X } from "lucide-react";
import { useState } from "react";
import {
  nuevaVersionRespuesta,
  type SavedRespuesta,
} from "@/lib/expedientes-archivo-actions";
import { Pagination } from "../pagination";

const PAGE_SIZE = 8;

type Props = {
  onOpen: (r: SavedRespuesta) => void;
  saved: SavedRespuesta[];
  loading?: boolean;
  onVersionCreated?: (id: string) => void;
  showToast: (msg: string, kind?: "success" | "error" | "warning" | "info") => void;
};

// Seccion 5: Historial de respuestas archivadas con:
// - Busqueda local (asunto, destinatario, nro de oficio, contenido)
// - Paginacion
// - Chip de version (v2, v3, ...)
// - Boton "Nueva version" que clona y abre en el editor
export function HistorialRespuestas({
  onOpen,
  saved,
  loading,
  onVersionCreated,
  showToast,
}: Props) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [creatingVersionFor, setCreatingVersionFor] = useState<string | null>(null);
  const [compare, setCompare] = useState<SavedRespuesta | null>(null);

  const filtered = (() => {
    const term = query.trim().toLowerCase();
    if (!term) return saved;
    return saved.filter((r) => {
      return (
        (r.asunto ?? "").toLowerCase().includes(term) ||
        (r.destinatario ?? "").toLowerCase().includes(term) ||
        (r.nro_oficio ?? "").toLowerCase().includes(term) ||
        (r.cuerpo ?? "").toLowerCase().includes(term)
      );
    });
  })();

  const total = filtered.length;
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  async function handleNewVersion(r: SavedRespuesta) {
    setCreatingVersionFor(r.id);
    try {
      const result = await nuevaVersionRespuesta(r.id);
      showToast(
        `Nueva version creada (v${result.version}). Abriendola en el editor...`,
        "success",
      );
      onVersionCreated?.(result.id);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "No se pudo crear la nueva version",
        "error",
      );
    } finally {
      setCreatingVersionFor(null);
    }
  }

  if (loading) {
    return (
      <div className="expFormSection" style={{ marginTop: 16 }}>
        <div className="expFormSectionHeader">
          <h3 className="expFormSectionTitle">
            <History size={16} /> Respuestas archivadas
          </h3>
        </div>
        <p style={{ color: "var(--muted, #667)" }}>
          <Loader2 size={14} className="expSpin" /> Cargando historial...
        </p>
      </div>
    );
  }

  if (saved.length === 0) {
    return null;
  }

  return (
    <div className="expFormSection" style={{ marginTop: 16 }}>
      <div className="expFormSectionHeader">
        <h3 className="expFormSectionTitle">
          <History size={16} /> Respuestas archivadas
          <span className="expFormSectionHint">
            {total} de {saved.length} — click para reabrir
          </span>
        </h3>
      </div>

      <div className="expField" style={{ marginBottom: 8 }}>
        <label className="expField-label" htmlFor="historial-search">
          <Search size={12} /> Buscar
        </label>
        <input
          id="historial-search"
          className="expField-input"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(1);
          }}
          placeholder="Asunto, destinatario, nro de oficio, contenido..."
        />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {pageItems.length === 0 ? (
          <p style={{ color: "var(--muted, #667)", fontSize: 13, margin: 0 }}>
            Ninguna respuesta coincide con la busqueda.
          </p>
        ) : (
          pageItems.map((r) => (
            <div
              key={r.id}
              className="expResultCard"
              style={{
                gridTemplateColumns: "1fr auto auto",
                textAlign: "left",
                alignItems: "center",
                gap: 8,
              }}
            >
              <button
                type="button"
                onClick={() => onOpen(r)}
                style={{
                  background: "transparent",
                  border: 0,
                  textAlign: "left",
                  cursor: "pointer",
                  padding: 0,
                  color: "inherit",
                }}
              >
                <div className="expResultBody">
                  <h4 className="expResultTitle">
                    {r.nro_oficio || r.asunto || "Respuesta"}
                    {r.version && r.version > 1 ? (
                      <span
                        style={{
                          marginLeft: 8,
                          background: "#fef3c7",
                          color: "#92400e",
                          fontSize: 10,
                          fontWeight: 700,
                          padding: "1px 6px",
                          borderRadius: 4,
                          verticalAlign: "middle",
                        }}
                      >
                        v{r.version}
                      </span>
                    ) : null}
                    {r.parent_version_id ? (
                      <span
                        style={{
                          marginLeft: 4,
                          fontSize: 10,
                          color: "var(--muted, #667)",
                        }}
                        title="Es una revision de otra respuesta"
                      >
                        (revision)
                      </span>
                    ) : null}
                  </h4>
                  <div className="expResultMeta">
                    {r.tipo_documento ? (
                      <span className="expResultMetaItem">{r.tipo_documento}</span>
                    ) : null}
                    {r.asunto ? (
                      <span className="expResultMetaItem">{r.asunto}</span>
                    ) : null}
                    {r.destinatario ? (
                      <span className="expResultMetaItem">→ {r.destinatario}</span>
                    ) : null}
                    <span className="expResultMetaItem">
                      {new Date(r.created_at).toLocaleDateString("es-PE")}
                    </span>
                    {r.antecedente_id ? (
                      <span
                        className="expResultMetaItem"
                        style={{
                          background: "#ecfeff",
                          color: "#155e75",
                          fontWeight: 600,
                        }}
                      >
                        <FileText size={11} /> PDF
                      </span>
                    ) : null}
                  </div>
                </div>
              </button>
              {r.parent_version_id && saved.some((s) => s.id === r.parent_version_id) ? (
                <button
                  type="button"
                  className="iconButton"
                  aria-label="Comparar con la version anterior"
                  title="Comparar con la version anterior"
                  onClick={() => setCompare(r)}
                  style={{ color: "var(--muted, #667)" }}
                >
                  <GitCompare size={15} />
                </button>
              ) : null}
              <button
                type="button"
                className="iconButton"
                aria-label="Nueva version"
                title="Crear nueva version (revisar)"
                onClick={() => handleNewVersion(r)}
                disabled={creatingVersionFor === r.id}
                style={{ color: "var(--brand, #0f766e)" }}
              >
                {creatingVersionFor === r.id ? (
                  <Loader2 size={15} className="expSpin" />
                ) : (
                  <Copy size={15} />
                )}
              </button>
            </div>
          ))
        )}
      </div>

      {compare ? (
        <CompareModal
          actual={compare}
          anterior={saved.find((s) => s.id === compare.parent_version_id) ?? null}
          onClose={() => setCompare(null)}
          onOpen={(r) => {
            setCompare(null);
            onOpen(r);
          }}
        />
      ) : null}

      {totalPages > 1 ? (
        <div style={{ display: "flex", justifyContent: "center", marginTop: 12 }}>
          <Pagination
            pagination={{ limit: PAGE_SIZE, page, total, totalPages }}
            onPageChange={setPage}
          />
        </div>
      ) : null}
    </div>
  );
}

// Comparación lado a lado de una versión con su anterior. Los párrafos que
// no están en la otra versión se resaltan (nuevo en verde, quitado en rojo).
function CompareModal({
  actual,
  anterior,
  onClose,
  onOpen,
}: {
  actual: SavedRespuesta;
  anterior: SavedRespuesta | null;
  onClose: () => void;
  onOpen: (r: SavedRespuesta) => void;
}) {
  const parrafos = (texto: string) =>
    texto
      .split(/\r?\n+/)
      .map((p) => p.trim())
      .filter(Boolean);
  const pAnterior = parrafos(anterior?.cuerpo ?? "");
  const pActual = parrafos(actual.cuerpo ?? "");
  const setAnterior = new Set(pAnterior);
  const setActual = new Set(pActual);

  const columna = (titulo: string, items: string[], otros: Set<string>, highlight: string) => (
    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
      <strong style={{ fontSize: 13 }}>{titulo}</strong>
      <div
        style={{
          border: "1px solid var(--line, #e2e4ea)",
          borderRadius: 8,
          padding: 10,
          fontSize: 12.5,
          lineHeight: 1.55,
          overflowY: "auto",
          flex: 1,
        }}
      >
        {items.length === 0 ? (
          <em style={{ color: "var(--muted, #667)" }}>Sin contenido.</em>
        ) : (
          items.map((p, i) => (
            <p
              key={i}
              style={{
                margin: "0 0 8px",
                textAlign: "justify",
                ...(otros.has(p) ? {} : { background: highlight, borderRadius: 4, padding: "2px 4px" }),
              }}
            >
              {p}
            </p>
          ))
        )}
      </div>
    </div>
  );

  // Escape, foco atrapado y bloqueo de scroll los aporta Radix.
  return (
    <Dialog.Root
      open
      onOpenChange={(abierto) => {
        if (!abierto) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="visorModalFondo" />
        <Dialog.Content className="diffVersiones">
          <div className="diffVersionesHead">
            <Dialog.Title asChild>
              <h3 className="diffVersionesTitulo">
                Comparando v{actual.version ?? 2} con la versión anterior
                {actual.nro_oficio ? ` — ${actual.nro_oficio}` : ""}
              </h3>
            </Dialog.Title>
            <Dialog.Close asChild>
              <button aria-label="Cerrar comparación" className="visorModalCerrar" type="button">
                <X size={18} />
              </button>
            </Dialog.Close>
          </div>
          <span className="diffVersionesPista">
            Los párrafos resaltados en rojo se quitaron; los verdes son nuevos o cambiaron.
          </span>
          <div className="diffVersionesCols">
            {columna(
              anterior ? `Versión anterior (v${anterior.version ?? 1})` : "Versión anterior",
              pAnterior,
              setActual,
              "#fee2e2",
            )}
            {columna(`Esta versión (v${actual.version ?? 2})`, pActual, setAnterior, "#d1fae5")}
          </div>
          <div className="diffVersionesPie">
            {anterior ? (
              <button type="button" className="secondaryButton" onClick={() => onOpen(anterior)}>
                Restaurar la anterior en el editor
              </button>
            ) : null}
            <button type="button" className="primaryButton" onClick={() => onOpen(actual)}>
              Abrir esta versión
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
