"use client";

import {
  CheckCircle2,
  FileUp,
  Library,
  Loader2,
  Scale,
  Search,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  adjuntarNormativa,
  type AdjuntoResult,
  listNormativaBiblioteca,
  type NormativaEntry,
} from "@/lib/expedientes-archivo-actions";
import { ModalShell } from "../../modal-shell";

// Selector de normativa para la pestaña Responder.
// - Permite buscar en la biblioteca de leyes/normas indexadas en Pinecone
// - Permite subir PDFs adicionales como adjuntos para esta generacion
// - Devuelve los documentIds seleccionados al padre via onChange
type AdjuntoAdjunto = AdjuntoResult;

export function BibliotecaSelector({
  normativaIds,
  adjuntosIds,
  onChange,
  onAdjuntosChange,
}: {
  normativaIds: string[];
  adjuntosIds: string[];
  onChange: (ids: string[]) => void;
  onAdjuntosChange: (adjuntos: AdjuntoAdjunto[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [entries, setEntries] = useState<NormativaEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [adjuntos, setAdjuntos] = useState<AdjuntoAdjunto[]>([]);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    const timeout = setTimeout(() => {
      void listNormativaBiblioteca(search, 200)
        .then((data) => {
          setEntries(data.entries);
        })
        .catch((err: unknown) => {
          setError(err instanceof Error ? err.message : "No se pudo cargar la biblioteca");
        })
        .finally(() => setLoading(false));
    }, 200);
    return () => clearTimeout(timeout);
  }, [open, search]);

  // Enfoca el input de busqueda al abrir.
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => searchRef.current?.focus());
    }
  }, [open]);

  const selected = new Set(normativaIds);
  const adjuntoIds = new Set(adjuntosIds);

  function toggle(documentId: string) {
    const next = new Set(selected);
    if (next.has(documentId)) {
      next.delete(documentId);
    } else {
      next.add(documentId);
    }
    onChange(Array.from(next));
  }

  async function handleUpload(file: File) {
    setUploading(true);
    setError(null);
    try {
      const result = await adjuntarNormativa(file, file.name.replace(/\.pdf$/i, ""));
      const updated = [...adjuntos, result];
      setAdjuntos(updated);
      onAdjuntosChange(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo adjuntar el PDF");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function removeAdjunto(id: string) {
    const updated = adjuntos.filter((a) => a.documentId !== id);
    setAdjuntos(updated);
    onAdjuntosChange(updated);
  }

  const totalSelected = normativaIds.length + adjuntos.length;

  return (
    <div className="expField">
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <label
          className="expField-label"
          style={{ display: "flex", alignItems: "center", gap: 6 }}
        >
          <Scale size={13} /> Normativa aplicable
        </label>
        <button
          type="button"
          className="secondaryButton"
          onClick={() => setOpen(true)}
          style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          <Library size={14} /> Biblioteca ({normativaIds.length})
        </button>
        <button
          type="button"
          className="secondaryButton"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          {uploading ? <Loader2 size={14} className="expSpin" /> : <FileUp size={14} />}{" "}
          {uploading ? "Subiendo..." : "Adjuntar PDF"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf"
          style={{ display: "none" }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleUpload(file);
          }}
        />
        {totalSelected > 0 ? (
          <span
            style={{
              fontSize: 12,
              color: "var(--brand, #0f766e)",
              fontWeight: 500,
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <CheckCircle2 size={14} /> {totalSelected} documento(s) adjunto(s)
          </span>
        ) : null}
      </div>

      {adjuntos.length > 0 ? (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
            marginTop: 8,
          }}
        >
          {adjuntos.map((a) => (
            <span
              key={a.documentId}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                background: "#ecfeff",
                color: "#155e75",
                border: "1px solid #67e8f9",
                borderRadius: 999,
                padding: "3px 10px",
                fontSize: 11,
                fontWeight: 500,
              }}
            >
              <FileUp size={11} /> {a.title} ({a.chunkCount} frag.)
              <button
                type="button"
                aria-label="Quitar adjunto"
                onClick={() => removeAdjunto(a.documentId)}
                style={{
                  background: "transparent",
                  border: 0,
                  padding: 0,
                  marginLeft: 4,
                  cursor: "pointer",
                  color: "inherit",
                }}
              >
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
      ) : null}

      {open ? <BibliotecaModal onClose={() => setOpen(false)}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Search size={16} style={{ color: "var(--muted, #667)" }} />
            <input
              ref={searchRef}
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por titulo, numero o fuente..."
              style={{
                flex: 1,
                padding: "8px 10px",
                borderRadius: 8,
                border: "1px solid var(--line, #e2e4ea)",
                fontSize: 13,
              }}
            />
            <button
              type="button"
              className="primaryButton"
              onClick={() => setOpen(false)}
            >
              Listo ({normativaIds.length})
            </button>
          </div>
          {error ? (
            <p
              role="alert"
              style={{
                background: "#fee2e2",
                color: "#991b1b",
                padding: 8,
                borderRadius: 6,
                fontSize: 12,
                margin: 0,
              }}
            >
              {error}
            </p>
          ) : null}
          {loading ? (
            <p style={{ color: "var(--muted, #667)", fontSize: 13, margin: 0 }}>
              <Loader2 size={14} className="expSpin" /> Buscando en la biblioteca...
            </p>
          ) : entries.length === 0 ? (
            <p style={{ color: "var(--muted, #667)", fontSize: 13, margin: 0 }}>
              No hay documentos que coincidan con la busqueda.
            </p>
          ) : (
            <div
              style={{
                maxHeight: 380,
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: 4,
              }}
            >
              {entries.map((entry) => {
                const isSelected = selected.has(entry.documentId);
                return (
                  <button
                    key={entry.documentId}
                    type="button"
                    onClick={() => toggle(entry.documentId)}
                    aria-pressed={isSelected}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 10,
                      padding: "10px 12px",
                      background: isSelected ? "#ecfeff" : "var(--panel, #fff)",
                      border: isSelected
                        ? "1px solid #67e8f9"
                        : "1px solid var(--line, #e2e4ea)",
                      borderRadius: 8,
                      textAlign: "left",
                      cursor: "pointer",
                      color: "inherit",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggle(entry.documentId)}
                      onClick={(e) => e.stopPropagation()}
                      style={{ marginTop: 2 }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>
                        {entry.title}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: "var(--muted, #667)",
                          marginTop: 2,
                          display: "flex",
                          gap: 8,
                          flexWrap: "wrap",
                        }}
                      >
                        {entry.documentNumber ? (
                          <span>N° {entry.documentNumber}</span>
                        ) : null}
                        {entry.documentType ? (
                          <span>{entry.documentType}</span>
                        ) : null}
                        {entry.sourceEntity ? (
                          <span>{entry.sourceEntity}</span>
                        ) : null}
                        {entry.year ? <span>{entry.year}</span> : null}
                        <span>{entry.chunkCount} frag.</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </BibliotecaModal> : null}

      {/* adjuntosIds no se usa directamente aqui pero el linter lo acepta */}
      <span hidden>{adjuntoIds.size}</span>
    </div>
  );
}

function BibliotecaModal({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  // Escape, foco atrapado y bloqueo de scroll los aporta ModalShell (Radix).
  return (
    <ModalShell
      claseTarjeta="bibliotecaNormativaModal"
      onClose={onClose}
      titulo={
        <>
          <Scale size={18} /> Biblioteca de normativa
        </>
      }
    >
      {children}
    </ModalShell>
  );
}
