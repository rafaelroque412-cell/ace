"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Building2,
  Download,
  FileSpreadsheet,
  FileUp,
  Loader2,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";

const TIPOS = ["OFICIO", "INFORME", "CARTA", "MEMORANDUM"] as const;

type Counter = { tipo: string; siguiente: number; preview: string };
type Oficina = {
  id: string;
  nombre: string;
  entidad: string | null;
  ruc: string | null;
  responsable_nombre: string | null;
  responsable_cargo: string | null;
  sufijo: string | null;
  ancho: number;
  activo: boolean;
  membrete: boolean;
  counters: Counter[];
};

const API = "/api/configuracion/oficinas";

type PreviewRow = {
  _row: number;
  nombre: string;
  entidad: string | null;
  ruc: string | null;
  responsable_nombre: string | null;
  responsable_cargo: string | null;
  sufijo: string | null;
  ancho: number;
  activo: boolean;
};

type PreviewError = { row: number; error: string };

type DryRunResponse = {
  dryRun: true;
  preview: PreviewRow[];
  errors: PreviewError[];
  total: number;
  mode: string;
  detectedFormat?: "siaf" | "simple";
  cachedEntidad?: string | null;
  cachedRuc?: string | null;
};

type ImportResponse = {
  ok: boolean;
  mode: string;
  summary: {
    totalRows: number;
    created: number;
    updated: number;
    failed: number;
    errors: PreviewError[];
  };
};

type ImportState =
  | { kind: "idle" }
  | { kind: "loading-preview"; fileName: string }
  | { kind: "preview"; fileName: string; mode: "merge" | "replace"; data: DryRunResponse }
  | { kind: "importing"; fileName: string; mode: "merge" | "replace" }
  | { kind: "done"; data: ImportResponse }
  | { kind: "error"; message: string };

// Gestión de OFICINAS emisoras (admin): cada una con su responsable que firma,
// siglas, numeración correlativa por tipo y hoja membretada. La pestaña Responder
// solo elige la oficina y usa esta configuración.
export function OficinasSettings() {
  const [oficinas, setOficinas] = useState<Oficina[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importState, setImportState] = useState<ImportState>({ kind: "idle" });
  const membreteRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const importFileRef = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(API, { cache: "no-store" });
      const data = await res.json();
      setOficinas(data.oficinas ?? []);
      setError(data.error ?? null);
    } catch {
      setError("No se pudo cargar las oficinas");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function patch(id: string, p: Partial<Oficina>) {
    setOficinas((prev) => prev.map((o) => (o.id === id ? { ...o, ...p } : o)));
  }
  function patchCounter(id: string, tipo: string, siguiente: number) {
    setOficinas((prev) =>
      prev.map((o) =>
        o.id === id ? { ...o, counters: o.counters.map((c) => (c.tipo === tipo ? { ...c, siguiente } : c)) } : o,
      ),
    );
  }

  async function addOficina() {
    setBusyId("new");
    try {
      const res = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: "Nueva oficina" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setOficinas(data.oficinas ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo crear");
    } finally {
      setBusyId(null);
    }
  }

  async function saveOficina(o: Oficina) {
    setBusyId(o.id);
    try {
      const res = await fetch(API, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: o.id,
          nombre: o.nombre,
          entidad: o.entidad,
          ruc: o.ruc,
          responsable_nombre: o.responsable_nombre,
          responsable_cargo: o.responsable_cargo,
          sufijo: o.sufijo,
          ancho: o.ancho,
          activo: o.activo,
          counters: o.counters.map((c) => ({ tipo: c.tipo, siguiente: c.siguiente })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setOficinas(data.oficinas ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setBusyId(null);
    }
  }

  async function deleteOficina(id: string) {
    if (!confirm("¿Eliminar esta oficina y su numeración?")) return;
    setBusyId(id);
    try {
      const res = await fetch(`${API}?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setOficinas(data.oficinas ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo eliminar");
    } finally {
      setBusyId(null);
    }
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
      patch(id, { membrete: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo subir la hoja membretada");
    } finally {
      setBusyId(null);
    }
  }

  async function onImportFile(file: File, mode: "merge" | "replace") {
    setImportState({ kind: "loading-preview", fileName: file.name });
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("mode", mode);
      fd.append("dryRun", "true");
      const res = await fetch(`${API}/import`, { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al analizar el archivo");
      setImportState({
        kind: "preview",
        fileName: file.name,
        mode,
        data: data as DryRunResponse,
      });
    } catch (e) {
      setImportState({
        kind: "error",
        message: e instanceof Error ? e.message : "No se pudo leer el archivo",
      });
    }
  }

  async function confirmImport() {
    if (importState.kind !== "preview") return;
    const file = importFileRef.current?.files?.[0];
    if (!file) {
      setImportState({ kind: "error", message: "Vuelve a seleccionar el archivo" });
      return;
    }
    setImportState({ kind: "importing", fileName: file.name, mode: importState.mode });
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("mode", importState.mode);
      const res = await fetch(`${API}/import`, { method: "POST", body: fd });
      const data = (await res.json()) as ImportResponse & { error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Error al importar");
      setImportState({ kind: "done", data });
      void load();
    } catch (e) {
      setImportState({
        kind: "error",
        message: e instanceof Error ? e.message : "No se pudo importar",
      });
    }
  }

  function closeImportModal() {
    setImportState({ kind: "idle" });
    if (importFileRef.current) importFileRef.current.value = "";
  }

  return (
    <section className="toolPanel" style={{ marginTop: 24 }}>
      <div
        className="userSectionTitle"
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}
      >
        <div>
          <h2>
            <Building2 size={18} style={{ verticalAlign: "-3px" }} /> Oficinas y numeración
          </h2>
          <p style={{ color: "var(--muted, #667)", fontSize: 13, margin: "4px 0 0" }}>
            Cada oficina emite con su responsable, sus siglas, su numeración por tipo y su hoja membretada.
            La pestaña "Responder" usa esta configuración.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <a
            className="secondaryButton"
            href={`${API}/template`}
            download="plantilla-oficinas.xlsx"
            style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <Download size={16} /> Plantilla .xlsx
          </a>
          <button
            className="secondaryButton"
            type="button"
            onClick={() => importFileRef.current?.click()}
          >
            <FileSpreadsheet size={16} /> Cargar Excel
          </button>
          <input
            ref={importFileRef}
            type="file"
            accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            style={{ display: "none" }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void onImportFile(file, "merge");
            }}
          />
          <button className="primaryButton" onClick={addOficina} type="button" disabled={busyId === "new"}>
            {busyId === "new" ? <Loader2 size={16} className="expSpin" /> : <Plus size={16} />} Añadir oficina
          </button>
        </div>
      </div>

      {error ? <p style={{ color: "#c0392b", fontSize: 13 }}>{error}</p> : null}
      {loading ? (
        <p style={{ color: "var(--muted, #667)" }}>
          <Loader2 size={14} className="expSpin" /> Cargando…
        </p>
      ) : oficinas.length === 0 ? (
        <p style={{ color: "var(--muted, #667)", fontSize: 13 }}>
          Aún no hay oficinas. Añade la primera o{" "}
          <a href={`${API}/template`} download="plantilla-oficinas.xlsx">
            descarga la plantilla Excel
          </a>{" "}
          para cargarlas todas de una vez.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 12 }}>
          {oficinas.map((o) => (
            <div key={o.id} style={{ border: "1px solid var(--line, #e2e4ea)", borderRadius: 12, padding: 16 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                <label className="formField">
                  <span>Nombre de la oficina</span>
                  <input
                    value={o.nombre}
                    onChange={(e) => patch(o.id, { nombre: e.target.value })}
                    placeholder="Gerencia Municipal"
                  />
                </label>
                <label className="formField">
                  <span>Entidad</span>
                  <input
                    value={o.entidad ?? ""}
                    onChange={(e) => patch(o.id, { entidad: e.target.value })}
                    placeholder="Municipalidad de…"
                  />
                </label>
                <label className="formField">
                  <span>RUC</span>
                  <input
                    value={o.ruc ?? ""}
                    onChange={(e) => patch(o.id, { ruc: e.target.value })}
                    placeholder="20XXXXXXXXX"
                  />
                </label>
                <label className="formField">
                  <span>Responsable (firma)</span>
                  <input
                    value={o.responsable_nombre ?? ""}
                    onChange={(e) => patch(o.id, { responsable_nombre: e.target.value })}
                    placeholder="Nombre del responsable"
                  />
                </label>
                <label className="formField">
                  <span>Cargo del responsable</span>
                  <input
                    value={o.responsable_cargo ?? ""}
                    onChange={(e) => patch(o.id, { responsable_cargo: e.target.value })}
                    placeholder="Gerente Municipal"
                  />
                </label>
                <label className="formField">
                  <span>Siglas (sufijo del nº)</span>
                  <input
                    value={o.sufijo ?? ""}
                    onChange={(e) => patch(o.id, { sufijo: e.target.value })}
                    placeholder="2026-MDCH/GM"
                  />
                </label>
              </div>

              <div style={{ marginTop: 12 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--muted, #667)" }}>
                  Numeración por tipo (nº inicial; luego autoincrementa)
                </span>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginTop: 6 }}>
                  {TIPOS.map((t) => {
                    const c = o.counters.find((x) => x.tipo === t);
                    return (
                      <label key={t} className="formField">
                        <span>{t}</span>
                        <input
                          type="number"
                          min={1}
                          value={c?.siguiente ?? 1}
                          onChange={(e) =>
                            patchCounter(o.id, t, Math.max(1, parseInt(e.target.value, 10) || 1))
                          }
                        />
                        <small style={{ color: "var(--muted, #889)", fontSize: 11 }}>{c?.preview}</small>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: 10,
                  marginTop: 14,
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <button
                  className="primaryButton"
                  onClick={() => saveOficina(o)}
                  type="button"
                  disabled={busyId === o.id}
                >
                  {busyId === o.id ? <Loader2 size={16} className="expSpin" /> : <Save size={16} />} Guardar
                </button>
                <button
                  className="secondaryButton"
                  type="button"
                  onClick={() => membreteRefs.current[o.id]?.click()}
                  disabled={busyId === o.id}
                >
                  <FileUp size={16} /> {o.membrete ? "Reemplazar hoja membretada" : "Subir hoja membretada"}
                </button>
                {o.membrete ? (
                  <span style={{ fontSize: 12, color: "#1f9d55" }}>✓ Membrete cargado</span>
                ) : null}
                <input
                  ref={(el) => {
                    membreteRefs.current[o.id] = el;
                  }}
                  type="file"
                  accept="application/pdf"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    void uploadMembrete(o.id, e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
                <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                  <input
                    type="checkbox"
                    checked={o.activo}
                    onChange={(e) => patch(o.id, { activo: e.target.checked })}
                  />{" "}
                  Activa
                </label>
                <button
                  className="secondaryButton"
                  type="button"
                  onClick={() => deleteOficina(o.id)}
                  disabled={busyId === o.id}
                  style={{ marginLeft: "auto", color: "#c0392b" }}
                >
                  <Trash2 size={16} /> Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {importState.kind !== "idle" ? (
        <ImportModal
          state={importState}
          onClose={closeImportModal}
          onConfirm={confirmImport}
          onChangeMode={(mode) => {
            if (importState.kind === "preview") {
              setImportState({ ...importState, mode });
            }
          }}
        />
      ) : null}
    </section>
  );
}

function ImportModal({
  state,
  onClose,
  onConfirm,
  onChangeMode,
}: {
  state: ImportState;
  onClose: () => void;
  onConfirm: () => void;
  onChangeMode: (mode: "merge" | "replace") => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,23,42,0.55)",
        display: "grid",
        placeItems: "center",
        zIndex: 1000,
        padding: 16,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: "var(--panel, #fff)",
          borderRadius: 12,
          maxWidth: 880,
          width: "100%",
          maxHeight: "90vh",
          overflow: "auto",
          padding: 20,
          boxShadow: "0 20px 50px rgba(0,0,0,0.25)",
        }}
      >
        <div
          style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}
        >
          <h3 style={{ margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
            <FileSpreadsheet size={18} /> Carga masiva de oficinas
          </h3>
          <button
            type="button"
            aria-label="Cerrar"
            onClick={onClose}
            style={{ background: "transparent", border: 0, cursor: "pointer" }}
          >
            <X size={18} />
          </button>
        </div>

        {state.kind === "loading-preview" ? (
          <p>
            <Loader2 size={14} className="expSpin" /> Analizando <strong>{state.fileName}</strong>…
          </p>
        ) : null}

        {state.kind === "error" ? (
          <div
            role="alert"
            style={{
              background: "#fee2e2",
              color: "#991b1b",
              padding: 12,
              borderRadius: 8,
              fontSize: 14,
            }}
          >
            <strong>Error:</strong> {state.message}
          </div>
        ) : null}

        {state.kind === "preview" ? <PreviewView state={state} onChangeMode={onChangeMode} /> : null}

        {state.kind === "importing" ? (
          <p>
            <Loader2 size={14} className="expSpin" /> Importando oficinas de <strong>{state.fileName}</strong>…
          </p>
        ) : null}

        {state.kind === "done" ? (
          <div
            style={{
              background: "#d1fae5",
              color: "#065f46",
              padding: 12,
              borderRadius: 8,
              fontSize: 14,
            }}
          >
            <strong>Importación completa.</strong> Creadas: {state.data.summary.created} ·
            Actualizadas: {state.data.summary.updated} ·
            Con error: {state.data.summary.failed}
          </div>
        ) : null}

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
            marginTop: 16,
            paddingTop: 12,
            borderTop: "1px solid var(--line, #e2e4ea)",
          }}
        >
          {state.kind === "preview" ? (
            <>
              <button type="button" className="secondaryButton" onClick={onClose}>
                Cancelar
              </button>
              <button type="button" className="primaryButton" onClick={onConfirm}>
                <FileUp size={14} /> Confirmar importación
              </button>
            </>
          ) : state.kind === "done" || state.kind === "error" ? (
            <button type="button" className="primaryButton" onClick={onClose}>
              Cerrar
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function PreviewView({
  state,
  onChangeMode,
}: {
  state: { kind: "preview"; fileName: string; mode: "merge" | "replace"; data: DryRunResponse };
  onChangeMode: (mode: "merge" | "replace") => void;
}) {
  const { data, mode, fileName } = state;
  const ok = data.preview;
  const errs = data.errors;
  return (
    <div>
      <p style={{ marginTop: 0, color: "var(--muted, #667)", fontSize: 13 }}>
        <strong>{fileName}</strong>: {data.total} fila{data.total === 1 ? "" : "s"} válida
        {data.total === 1 ? "" : "s"}
        {errs.length > 0 ? ` · ${errs.length} con error` : ""}
        {data.detectedFormat ? (
          <>
            {" · "}
            <span
              style={{
                background: data.detectedFormat === "siaf" ? "#dbeafe" : "#dcfce7",
                color: data.detectedFormat === "siaf" ? "#1e40af" : "#166534",
                padding: "1px 8px",
                borderRadius: 999,
                fontSize: 11,
                fontWeight: 600,
              }}
            >
              Formato {data.detectedFormat === "siaf" ? "SIAF/MEF" : "simple"}
            </span>
          </>
        ) : null}
      </p>

      {data.detectedFormat === "siaf" && (data.cachedEntidad || data.cachedRuc) ? (
        <div
          style={{
            background: "#eff6ff",
            color: "#1e3a8a",
            padding: 8,
            borderRadius: 6,
            marginBottom: 12,
            fontSize: 12,
          }}
        >
          <strong>Entidad detectada (de la fila tipo 1):</strong>{" "}
          {data.cachedEntidad ?? "—"}
          {data.cachedRuc ? ` · RUC ${data.cachedRuc}` : ""}
        </div>
      ) : null}

      <fieldset
        style={{
          border: "1px solid var(--line, #e2e4ea)",
          borderRadius: 8,
          padding: 12,
          marginBottom: 12,
        }}
      >
        <legend style={{ fontSize: 12, fontWeight: 600, padding: "0 6px" }}>Modo de importación</legend>
        <label style={{ display: "block", marginBottom: 6, fontSize: 13 }}>
          <input
            type="radio"
            name="importMode"
            checked={mode === "merge"}
            onChange={() => onChangeMode("merge")}
          />{" "}
          <strong>Fusionar (merge)</strong> — Crea nuevas oficinas y actualiza las existentes
          (mismo nombre).
        </label>
        <label style={{ display: "block", fontSize: 13 }}>
          <input
            type="radio"
            name="importMode"
            checked={mode === "replace"}
            onChange={() => onChangeMode("replace")}
          />{" "}
          <strong>Reemplazar (replace)</strong> — Elimina TODAS las oficinas actuales y carga las
          del archivo.
        </label>
      </fieldset>

      {errs.length > 0 ? (
        <div
          style={{
            background: "#fef3c7",
            color: "#92400e",
            padding: 10,
            borderRadius: 6,
            marginBottom: 12,
            fontSize: 13,
          }}
        >
          <strong>{errs.length} fila(s) con error (se omitirán al importar):</strong>
          <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
            {errs.slice(0, 8).map((e) => (
              <li key={e.row}>
                Fila {e.row}: {e.error}
              </li>
            ))}
            {errs.length > 8 ? <li>…y {errs.length - 8} más</li> : null}
          </ul>
        </div>
      ) : null}

      <div style={{ overflowX: "auto", maxHeight: 320 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ background: "var(--bg, #f8fafc)", position: "sticky", top: 0 }}>
              <th style={th}>#</th>
              <th style={th}>Nombre</th>
              <th style={th}>Entidad</th>
              <th style={th}>RUC</th>
              <th style={th}>Responsable</th>
              <th style={th}>Cargo</th>
              <th style={th}>Sufijo</th>
              <th style={th}>Ancho</th>
              <th style={th}>Activo</th>
            </tr>
          </thead>
          <tbody>
            {ok.map((r) => (
              <tr key={r._row} style={{ borderTop: "1px solid var(--line, #e2e4ea)" }}>
                <td style={td}>{r._row}</td>
                <td style={td}>
                  <strong>{r.nombre}</strong>
                </td>
                <td style={td}>{r.entidad ?? "—"}</td>
                <td style={td}>{r.ruc ?? "—"}</td>
                <td style={td}>{r.responsable_nombre ?? "—"}</td>
                <td style={td}>{r.responsable_cargo ?? "—"}</td>
                <td style={td}>{r.sufijo ?? "—"}</td>
                <td style={td}>{r.ancho}</td>
                <td style={td}>{r.activo ? "Sí" : "No"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "8px 10px",
  fontWeight: 600,
  borderBottom: "1px solid var(--line, #e2e4ea)",
};
const td: React.CSSProperties = { padding: "8px 10px", verticalAlign: "top" };
