"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bot,
  Briefcase,
  FileText,
  Lock,
  MapPin,
  RefreshCw,
  Search,
  Trash2,
  UploadCloud,
} from "lucide-react";
import {
  ARCHIVO_AMBIENTES,
  ARCHIVO_COLORES,
  CONTENEDOR_TIPOS,
  CONTENEDOR_TIPO_LABELS,
} from "@/lib/expedientes-archivo";
import { maxPdfSizeBytes, maxPdfSizeLabel } from "@/lib/upload-limits";

type ExpedienteItem = {
  id: string;
  numero_documento: string | null;
  numero_expediente: string | null;
  fecha: string | null;
  anio: number | null;
  asunto: string | null;
  materia: string | null;
  title: string;
  tipo_contenedor: string;
  nro_caja: string | null;
  nro_archivador: string | null;
  color: string | null;
  ubicacion: string | null;
  nro_folios: number | null;
  file_size: number;
  status: "uploaded" | "processing" | "indexed" | "error";
  error_message: string | null;
  metadata: { chunkCount?: number; pageCount?: number } | null;
  created_at: string;
};

type Ubicacion = {
  tipoContenedorLabel: string;
  nroCaja: string | null;
  nroArchivador: string | null;
  color: string | null;
  ubicacion: string | null;
  codigoUbicacion: string | null;
  nroFolios: number | null;
};

type SearchResult = {
  expedienteId: string;
  numeroDocumento: string | null;
  title: string;
  asunto: string | null;
  materia: string | null;
  fecha: string | null;
  pageStart: number | null;
  excerpt: string;
  citation: string;
  ubicacionResumen: string;
  ubicacion: Ubicacion;
};

type ChatAnswer = { answer: string; sufficient: boolean; sources: SearchResult[] };

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function statusLabel(status: ExpedienteItem["status"]) {
  return { error: "Error", indexed: "Indexado", processing: "Procesando", uploaded: "Subido" }[status];
}

export function ExpedientesArchivoWorkspace({ canManage }: { canManage: boolean }) {
  // Consulta
  const [mode, setMode] = useState<"buscar" | "preguntar">("buscar");
  const [query, setQuery] = useState("");
  const [filterAnio, setFilterAnio] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [answer, setAnswer] = useState<ChatAnswer | null>(null);
  const [searchMessage, setSearchMessage] = useState<string | null>(null);

  // Gestion
  const [expedientes, setExpedientes] = useState<ExpedienteItem[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [form, setForm] = useState({
    title: "",
    numeroDocumento: "",
    numeroExpediente: "",
    fecha: "",
    anio: "",
    materia: "",
    asunto: "",
    remitente: "",
    destinatario: "",
    // Ubicación física (catálogo fijo)
    tipoContenedor: "caja",
    nroCaja: "",
    nroArchivador: "",
    color: "",
    ubicacion: "",
    codigoUbicacion: "",
    nroFolios: "",
    observaciones: "",
  });
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [reindexingId, setReindexingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function setField(key: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const loadExpedientes = useCallback(async () => {
    const response = await fetch("/api/expedientes-archivo", { cache: "no-store" });
    const payload = await response.json();
    if (response.ok) {
      setExpedientes(payload.expedientes ?? []);
    }
  }, []);

  const hasPending = useMemo(
    () => expedientes.some((exp) => exp.status === "uploaded" || exp.status === "processing"),
    [expedientes],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadExpedientes();
  }, [loadExpedientes]);

  useEffect(() => {
    if (!hasPending) {
      return;
    }
    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      if (attempts > 75) {
        clearInterval(timer);
        return;
      }
      void loadExpedientes();
    }, 4000);
    return () => clearInterval(timer);
  }, [hasPending, loadExpedientes]);

  async function runSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (query.trim().length < 2) {
      setSearchMessage("Escribe al menos 2 caracteres.");
      return;
    }

    setSearching(true);
    setSearchMessage(null);
    setResults(null);
    setAnswer(null);

    const body = JSON.stringify({
      query: query.trim(),
      anio: filterAnio ? Number.parseInt(filterAnio, 10) : undefined,
    });

    try {
      const endpoint = mode === "buscar" ? "/api/expedientes-archivo/search" : "/api/expedientes-archivo/chat";
      const response = await fetch(endpoint, {
        body,
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = await response.json();
      if (!response.ok) {
        setSearchMessage(payload.error ?? "No se pudo consultar.");
        return;
      }
      if (mode === "buscar") {
        setResults(payload.results ?? []);
        if ((payload.results ?? []).length === 0) {
          setSearchMessage("Sin resultados en la biblioteca de expedientes.");
        }
      } else {
        setAnswer(payload as ChatAnswer);
      }
    } catch {
      setSearchMessage("No se pudo conectar con el servidor.");
    } finally {
      setSearching(false);
    }
  }

  async function uploadExpediente(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      setUploadMessage("Selecciona un archivo PDF antes de subir.");
      return;
    }
    if (file.size > maxPdfSizeBytes) {
      setUploadMessage(`El PDF supera el limite de ${maxPdfSizeLabel}.`);
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    for (const [key, value] of Object.entries(form)) {
      formData.append(key, value);
    }

    setUploading(true);
    setUploadMessage("Subiendo PDF...");

    try {
      const response = await fetch("/api/expedientes-archivo", { body: formData, method: "POST" });
      const payload = await response.json();
      if (!response.ok) {
        setUploadMessage(payload.error ?? "No se pudo subir el expediente");
        return;
      }
      setFile(null);
      setForm((prev) => ({
        ...prev,
        title: "",
        numeroDocumento: "",
        numeroExpediente: "",
        fecha: "",
        anio: "",
        materia: "",
        asunto: "",
        remitente: "",
        destinatario: "",
        nroCaja: "",
        nroArchivador: "",
        codigoUbicacion: "",
        nroFolios: "",
        observaciones: "",
      }));
      setUploadMessage("PDF subido. Procesando, OCR e indexando en segundo plano...");
      await loadExpedientes();
    } catch {
      setUploadMessage("No se pudo conectar con el servidor.");
    } finally {
      setUploading(false);
    }
  }

  async function reindexExpediente(id: string) {
    setReindexingId(id);
    setUploadMessage("Reindexando expediente...");
    try {
      const response = await fetch(`/api/expedientes-archivo/${id}`, { method: "POST" });
      const payload = await response.json();
      if (!response.ok) {
        setUploadMessage(payload.error ?? "No se pudo reindexar");
        return;
      }
      setUploadMessage("Reindexado iniciado en segundo plano...");
      await loadExpedientes();
    } catch {
      setUploadMessage("No se pudo conectar con el servidor.");
    } finally {
      setReindexingId(null);
    }
  }

  async function deleteExpediente(id: string) {
    setDeletingId(id);
    setUploadMessage("Eliminando expediente...");
    try {
      const response = await fetch(`/api/expedientes-archivo/${id}`, { method: "DELETE" });
      const payload = await response.json();
      if (!response.ok) {
        setUploadMessage(payload.error ?? "No se pudo eliminar");
        return;
      }
      setUploadMessage("Expediente eliminado.");
      await loadExpedientes();
    } catch {
      setUploadMessage("No se pudo conectar con el servidor.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="uploadPanel" id="expedientes-archivo">
      <div className="panelHeader">
        <div>
          <p className="eyebrow">Biblioteca de expedientes archivados</p>
          <h2>Busca el contenido y localiza dónde está el expediente físico</h2>
        </div>
        <Briefcase size={22} />
      </div>

      <form className="documentForm" onSubmit={runSearch}>
        <div className="styleSelectors">
          <div className="styleSelectorGroup">
            <span className="styleSelectorsTitle">Modo</span>
            <div className="pillGroup">
              <button
                className={mode === "buscar" ? "pill active" : "pill"}
                onClick={() => setMode("buscar")}
                type="button"
              >
                <Search size={15} /> Buscar
              </button>
              <button
                className={mode === "preguntar" ? "pill active" : "pill"}
                onClick={() => setMode("preguntar")}
                type="button"
              >
                <Bot size={15} /> Preguntar a la IA
              </button>
            </div>
          </div>
        </div>

        <div className="formGrid">
          <label className="fullSpan">
            <span>{mode === "buscar" ? "Buscar en el contenido" : "Pregunta en lenguaje natural"}</span>
            <input
              onChange={(event) => setQuery(event.target.value)}
              placeholder={
                mode === "buscar"
                  ? "Ej. número 2024-0345, licencia de funcionamiento, predio..."
                  : "Ej. ¿Dónde está el expediente de la licencia 2024-0345?"
              }
              value={query}
            />
          </label>
          <label>
            <span>Año (opcional)</span>
            <input
              onChange={(event) => setFilterAnio(event.target.value)}
              placeholder="Ej. 2024"
              type="number"
              value={filterAnio}
            />
          </label>
        </div>

        <div className="formActions">
          <button className="primaryButton" disabled={searching} type="submit">
            {mode === "buscar" ? <Search size={17} /> : <Bot size={17} />}
            {searching ? "Consultando..." : mode === "buscar" ? "Buscar" : "Preguntar"}
          </button>
        </div>
        {searchMessage ? <p className="formMessage">{searchMessage}</p> : null}
      </form>

      {answer ? (
        <section className="archivoAnswer">
          <div className="documentSectionTitle">
            <div>
              <strong>Respuesta</strong>
              <span>Fundamentada en los expedientes archivados. Las citas [E#] corresponden a las fuentes.</span>
            </div>
          </div>
          <p className="archivoAnswerText">{answer.answer}</p>
          {answer.sources.length > 0 ? (
            <div className="archivoSources">
              {answer.sources.map((source, index) => (
                <article className="documentItem" key={`${source.expedienteId}-${index}`}>
                  <div className="documentIcon">
                    <FileText size={18} />
                  </div>
                  <div>
                    <strong>
                      [E{index + 1}] {source.title}
                    </strong>
                    <span>{source.citation}</span>
                    <span className="expedienteUbicacion">
                      <MapPin size={13} /> {source.ubicacionResumen}
                    </span>
                    {source.excerpt ? <p>{source.excerpt}</p> : null}
                  </div>
                  <div className="documentActions">
                    <a href={`/api/expedientes-archivo/${source.expedienteId}`} target="_blank" rel="noreferrer" title="Abrir PDF">
                      <FileText size={16} />
                    </a>
                  </div>
                </article>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      {results ? (
        <section className="archivoResults">
          <div className="documentSectionTitle">
            <div>
              <strong>Resultados</strong>
              <span>{results.length} coincidencia(s) en la biblioteca de expedientes</span>
            </div>
          </div>
          {results.length === 0 ? (
            <div className="emptyState">Sin resultados.</div>
          ) : (
            results.map((source, index) => (
              <article className="documentItem" key={`${source.expedienteId}-${index}`}>
                <div className="documentIcon">
                  <FileText size={18} />
                </div>
                <div>
                  <strong>{source.title}</strong>
                  <span>
                    {source.numeroDocumento ? `N° ${source.numeroDocumento}` : "Sin número"}
                    {source.materia ? ` · ${source.materia}` : ""}
                    {source.fecha ? ` · ${source.fecha}` : ""}
                    {source.pageStart ? ` · pág. ${source.pageStart}` : ""}
                  </span>
                  <span className="expedienteUbicacion">
                    <MapPin size={13} /> {source.ubicacionResumen}
                  </span>
                  {source.asunto ? <span>Asunto: {source.asunto}</span> : null}
                  {source.excerpt ? <p>{source.excerpt}</p> : null}
                </div>
                <div className="documentActions">
                  <a href={`/api/expedientes-archivo/${source.expedienteId}`} target="_blank" rel="noreferrer" title="Abrir PDF">
                    <FileText size={16} />
                  </a>
                </div>
              </article>
            ))
          )}
        </section>
      ) : null}

      {canManage ? (
        <>
          <form className="documentForm" onSubmit={uploadExpediente}>
            <div className="documentSectionTitle">
              <div>
                <strong>Subir expediente al archivo</strong>
                <span>El PDF se escanea con OCR y se indexa para ubicar número, fecha, asunto y contenido.</span>
              </div>
            </div>
            <label className="filePicker">
              <UploadCloud size={28} />
              <strong>{file ? `${file.name} · ${formatBytes(file.size)}` : "Selecciona un PDF (puede ser escaneado)"}</strong>
              <span>Expedientes y documentos terminados. Máximo {maxPdfSizeLabel}.</span>
              <input
                accept="application/pdf"
                onChange={(event) => {
                  const selected = event.target.files?.[0] ?? null;
                  if (selected && selected.size > maxPdfSizeBytes) {
                    setFile(null);
                    setUploadMessage(`El PDF supera el limite de ${maxPdfSizeLabel}.`);
                    event.target.value = "";
                    return;
                  }
                  setUploadMessage(null);
                  setFile(selected);
                }}
                type="file"
              />
            </label>

            <div className="formGrid">
              <label>
                <span>Nº de expediente (opcional)</span>
                <input onChange={(event) => setField("numeroExpediente", event.target.value)} value={form.numeroExpediente} />
              </label>
              <label>
                <span>Nº de documento (opcional)</span>
                <input
                  onChange={(event) => setField("numeroDocumento", event.target.value)}
                  placeholder="Si lo dejas vacío se detecta"
                  value={form.numeroDocumento}
                />
              </label>
              <label>
                <span>Fecha (opcional)</span>
                <input onChange={(event) => setField("fecha", event.target.value)} type="date" value={form.fecha} />
              </label>
              <label>
                <span>Año (opcional)</span>
                <input onChange={(event) => setField("anio", event.target.value)} placeholder="2024" type="number" value={form.anio} />
              </label>
              <label>
                <span>Materia (opcional)</span>
                <input onChange={(event) => setField("materia", event.target.value)} placeholder="Si lo dejas vacío se detecta con IA" value={form.materia} />
              </label>
              <label>
                <span>Título (opcional)</span>
                <input onChange={(event) => setField("title", event.target.value)} placeholder="Si lo dejas vacío se usa el nombre del archivo" value={form.title} />
              </label>
              <label className="fullSpan">
                <span>Asunto / sumilla (opcional)</span>
                <input onChange={(event) => setField("asunto", event.target.value)} placeholder="Si lo dejas vacío se detecta con IA" value={form.asunto} />
              </label>
            </div>

            <div className="documentSectionTitle">
              <div>
                <strong>Ubicación física</strong>
                <span>Dónde se encuentra el expediente en papel (catálogo fijo).</span>
              </div>
            </div>
            <div className="formGrid">
              <label>
                <span>Tipo de contenedor</span>
                <select onChange={(event) => setField("tipoContenedor", event.target.value)} value={form.tipoContenedor}>
                  {CONTENEDOR_TIPOS.map((tipo) => (
                    <option key={tipo} value={tipo}>
                      {CONTENEDOR_TIPO_LABELS[tipo]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Nº de caja</span>
                <input onChange={(event) => setField("nroCaja", event.target.value)} placeholder="Ej. 045" value={form.nroCaja} />
              </label>
              <label>
                <span>Nº de archivador</span>
                <input onChange={(event) => setField("nroArchivador", event.target.value)} placeholder="Ej. 12" value={form.nroArchivador} />
              </label>
              <label>
                <span>Color</span>
                <select onChange={(event) => setField("color", event.target.value)} value={form.color}>
                  <option value="">— Sin color —</option>
                  {ARCHIVO_COLORES.map((color) => (
                    <option key={color} value={color}>
                      {color}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Ambiente / ubicación</span>
                <select onChange={(event) => setField("ubicacion", event.target.value)} value={form.ubicacion}>
                  <option value="">— Sin ambiente —</option>
                  {ARCHIVO_AMBIENTES.map((amb) => (
                    <option key={amb} value={amb}>
                      {amb}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Código de ubicación</span>
                <input onChange={(event) => setField("codigoUbicacion", event.target.value)} placeholder="Ej. AMB2-EST3-CAJA045" value={form.codigoUbicacion} />
              </label>
              <label>
                <span>Nº de folios</span>
                <input onChange={(event) => setField("nroFolios", event.target.value)} placeholder="Ej. 120" type="number" value={form.nroFolios} />
              </label>
              <label className="fullSpan">
                <span>Observaciones</span>
                <input onChange={(event) => setField("observaciones", event.target.value)} value={form.observaciones} />
              </label>
            </div>

            <div className="formActions">
              <button className="secondaryButton" onClick={() => void loadExpedientes()} type="button">
                <RefreshCw size={17} /> Actualizar
              </button>
              <button className="primaryButton" disabled={uploading} type="submit">
                <UploadCloud size={18} /> {uploading ? "Subiendo..." : "Subir al archivo"}
              </button>
            </div>
            {uploadMessage ? <p className="formMessage">{uploadMessage}</p> : null}
          </form>

          <div className="documentList">
            <div className="documentSectionTitle">
              <div>
                <strong>Expedientes del archivo</strong>
                <span>{expedientes.length} expediente(s)</span>
              </div>
            </div>
            {expedientes.length === 0 ? (
              <div className="emptyState">Aún no hay expedientes en el archivo.</div>
            ) : (
              expedientes.map((exp) => (
                <article className="documentItem" key={exp.id}>
                  <div className="documentIcon">
                    <FileText size={18} />
                  </div>
                  <div>
                    <strong>{exp.title}</strong>
                    <span>
                      {exp.numero_documento ? `N° ${exp.numero_documento}` : "Sin número"}
                      {exp.materia ? ` · ${exp.materia}` : ""}
                      {exp.fecha ? ` · ${exp.fecha}` : ""} · {formatBytes(exp.file_size)}
                    </span>
                    <span className="expedienteUbicacion">
                      <MapPin size={13} />{" "}
                      {[
                        CONTENEDOR_TIPO_LABELS[exp.tipo_contenedor as keyof typeof CONTENEDOR_TIPO_LABELS] ?? "Otros",
                        exp.nro_caja ?? exp.nro_archivador,
                        exp.color ? `(${exp.color})` : null,
                        exp.ubicacion,
                        exp.nro_folios ? `${exp.nro_folios} folios` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                    {exp.asunto ? <span>Asunto: {exp.asunto}</span> : null}
                    {exp.metadata?.chunkCount ? (
                      <span>
                        {exp.metadata.pageCount ?? 0} páginas · {exp.metadata.chunkCount} fragmentos
                      </span>
                    ) : null}
                    {exp.error_message ? <span className="documentError">{exp.error_message}</span> : null}
                  </div>
                  <div className="documentActions">
                    <small data-status={exp.status}>{statusLabel(exp.status)}</small>
                    <a href={`/api/expedientes-archivo/${exp.id}`} target="_blank" rel="noreferrer" title="Abrir PDF">
                      <FileText size={16} />
                    </a>
                    <button
                      disabled={reindexingId === exp.id || deletingId === exp.id}
                      onClick={() => void reindexExpediente(exp.id)}
                      title="Reindexar"
                      type="button"
                    >
                      <RefreshCw size={16} />
                    </button>
                    <button
                      disabled={deletingId === exp.id}
                      onClick={() => void deleteExpediente(exp.id)}
                      title="Eliminar"
                      type="button"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        </>
      ) : (
        <div className="emptyState">
          <Lock size={20} />
          <p>
            La carga y gestión de expedientes requiere rol DEC/Editor o administrador. Puedes buscar
            y consultar todos los expedientes indexados.
          </p>
        </div>
      )}
    </div>
  );
}
