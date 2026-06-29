"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Building2,
  Download,
  FileSignature,
  History,
  Library,
  Loader2,
  MapPin,
  Save,
  ScrollText,
  Settings,
  Sparkles,
  UploadCloud,
} from "lucide-react";
import {
  DOC_TIPOS,
  type DocTipo,
  exportRespuestaDocx,
  generateRespuesta,
  leerDocumentoPdf,
  listOficinas,
  listRespuestas,
  type OficinaOption,
  saveRespuesta,
  type RespuestaAntecedente,
  type RespuestaResult,
  type RespuestaTokenUsage,
  type SavedRespuesta,
} from "@/lib/expedientes-archivo-actions";
import { maxPdfSizeBytes, maxPdfSizeLabel } from "@/lib/upload-limits";

type ToastKind = "success" | "error" | "warning" | "info";
type BaseLegalItem = { referencia: string; texto: string };

function formatCost(u: RespuestaTokenUsage | undefined): string | null {
  if (!u) return null;
  const total = u.inputTokens + u.outputTokens;
  return `${total.toLocaleString("es-PE")} tokens${u.estimatedCostUsd > 0 ? ` · ~$${u.estimatedCostUsd.toFixed(4)}` : ""}`;
}

// Panel "mesa de partes". El PDF recibido es antecedente; el usuario elige la
// OFICINA emisora (configurada por el admin), escribe qué responder y la IA
// redacta el cuerpo. La numeración, firma y hoja membretada salen de la oficina.
export function RespuestaPanel({
  showToast,
}: {
  showToast: (message: string, kind?: ToastKind) => void;
}) {
  // Documento recibido (antecedente)
  const [documentoTexto, setDocumentoTexto] = useState("");
  const [remitenteDoc, setRemitenteDoc] = useState("");
  const [asunto, setAsunto] = useState("");
  const [reading, setReading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Tu respuesta
  const [oficinas, setOficinas] = useState<OficinaOption[]>([]);
  const [oficinaId, setOficinaId] = useState("");
  const [tipoDocumento, setTipoDocumento] = useState<DocTipo>("OFICIO");
  const [intencion, setIntencion] = useState("");
  const [tone, setTone] = useState<"cercano" | "formal" | "tecnico">("formal");
  const [length, setLength] = useState<"concisa" | "media" | "detallada">("media");
  const [includeAntecedentes, setIncludeAntecedentes] = useState(true);

  // Resultado / edición
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<RespuestaResult | null>(null);
  const [cuerpo, setCuerpo] = useState("");
  const [baseLegal, setBaseLegal] = useState<BaseLegalItem[]>([]);
  const [antecedentes, setAntecedentes] = useState<RespuestaAntecedente[]>([]);
  const [genUsage, setGenUsage] = useState<RespuestaTokenUsage | undefined>(undefined);

  // Export
  const [nroOficio, setNroOficio] = useState("");
  const [nroAsignado, setNroAsignado] = useState(false);
  const [destinatario, setDestinatario] = useState("");
  const [cargoDestinatario, setCargoDestinatario] = useState("");
  const [exportFormat, setExportFormat] = useState<"pdf" | "docx">("pdf");
  const [exporting, setExporting] = useState(false);
  const [savingRespuesta, setSavingRespuesta] = useState(false);

  const [saved, setSaved] = useState<SavedRespuesta[]>([]);

  const reloadSaved = useCallback(() => {
    void listRespuestas(20).then(setSaved).catch(() => undefined);
  }, []);
  const reloadOficinas = useCallback(() => {
    void listOficinas()
      .then((list) => {
        setOficinas(list);
        setOficinaId((prev) => prev || list[0]?.id || "");
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    reloadOficinas();
    reloadSaved();
  }, [reloadOficinas, reloadSaved]);

  const oficina = oficinas.find((o) => o.id === oficinaId) ?? null;
  const previewNumero = oficina?.previews?.[tipoDocumento] ?? "";
  const numeroEfectivo = nroOficio.trim() || previewNumero;

  const handleFile = useCallback(
    async (file: File | null | undefined) => {
      if (!file) return;
      if (file.type !== "application/pdf") return showToast("Solo se permiten archivos PDF.", "warning");
      if (file.size > maxPdfSizeBytes) return showToast(`El PDF supera ${maxPdfSizeLabel}.`, "warning");
      setReading(true);
      try {
        const res = await leerDocumentoPdf(file);
        setDocumentoTexto(res.texto);
        if (res.asunto) setAsunto((prev) => prev || res.asunto || "");
        if (res.remitente) setRemitenteDoc((prev) => prev || res.remitente || "");
        showToast("PDF leído como antecedente. Ahora escribe qué quieres responder.", "success");
      } catch (err) {
        showToast(err instanceof Error ? err.message : "No se pudo leer el PDF", "error");
      } finally {
        setReading(false);
      }
    },
    [showToast],
  );

  async function handleGenerate() {
    if (intencion.trim().length < 10) return showToast("Escribe qué quieres responder (mín. 10 caracteres).", "warning");
    setGenerating(true);
    try {
      const res = await generateRespuesta({
        intencion: intencion.trim(),
        tipoDocumento,
        documentoTexto: documentoTexto.trim() || undefined,
        remitente: remitenteDoc.trim() || undefined,
        asunto: asunto.trim() || undefined,
        tone,
        length,
        includeAntecedentes,
      });
      setResult(res);
      setCuerpo(res.respuesta);
      setBaseLegal((res.sources ?? []).map((s) => ({ referencia: s.citation || s.title, texto: s.excerpt })));
      setAntecedentes(res.antecedentes ?? []);
      setGenUsage(res.tokenUsage);
      const partes = [
        res.sources.length > 0 ? `${res.sources.length} norma(s)` : "sin normativa directa",
        (res.antecedentes?.length ?? 0) > 0 ? `${res.antecedentes?.length} antecedente(s)` : null,
      ].filter(Boolean);
      showToast(`Cuerpo generado (${partes.join(", ")}). Revísalo antes de emitir.`, res.sources.length === 0 ? "warning" : "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "No se pudo generar la respuesta", "error");
    } finally {
      setGenerating(false);
    }
  }

  async function handleSaveRespuesta() {
    if (!cuerpo.trim()) return showToast("No hay cuerpo de respuesta para guardar.", "warning");
    if (!oficinaId) return showToast("Elige la oficina emisora.", "warning");
    setSavingRespuesta(true);
    try {
      const res = await saveRespuesta({
        nroOficio: numeroEfectivo || undefined,
        tipoDocumento,
        oficinaId,
        assignNumber: !nroAsignado,
        anio: new Date().getFullYear(),
        asunto: asunto.trim() || undefined,
        destinatario: destinatario.trim() || remitenteDoc.trim() || undefined,
        cargoDestinatario: cargoDestinatario.trim() || undefined,
        remitente: oficina?.responsableNombre ?? undefined,
        documentoTexto: documentoTexto.trim() || undefined,
        cuerpo: cuerpo.trim(),
        baseLegal,
        antecedentes,
        entity: { name: oficina?.entidad ?? "", ruc: oficina?.ruc ?? "" },
        expedienteId: antecedentes[0]?.expedienteId ?? null,
        tone,
        length,
        tokenUsage: genUsage,
      });
      if (res.nroOficio) {
        setNroOficio(res.nroOficio);
        setNroAsignado(true);
      }
      showToast(`Respuesta archivada${res.nroOficio ? ` como ${res.nroOficio}` : ""}.`, "success");
      reloadSaved();
      reloadOficinas();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "No se pudo guardar la respuesta", "error");
    } finally {
      setSavingRespuesta(false);
    }
  }

  async function handleExport() {
    if (!cuerpo.trim()) return showToast("No hay cuerpo de respuesta para exportar.", "warning");
    if (!oficinaId) return showToast("Elige la oficina emisora.", "warning");
    setExporting(true);
    try {
      await exportRespuestaDocx({
        format: exportFormat,
        oficinaId,
        entity: { name: oficina?.entidad ?? "", ruc: oficina?.ruc ?? "" },
        nroOficio: numeroEfectivo || undefined,
        destinatario: destinatario.trim() || remitenteDoc.trim() || undefined,
        cargoDestinatario: cargoDestinatario.trim() || undefined,
        asunto: asunto.trim() || "Respuesta a su solicitud",
        cuerpo: cuerpo.trim(),
        baseLegal,
        remitente: oficina?.responsableNombre ?? undefined,
        cargoRemitente: oficina?.responsableCargo ?? undefined,
      });
      showToast(`Documento .${exportFormat} descargado.`, "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "No se pudo exportar el documento", "error");
    } finally {
      setExporting(false);
    }
  }

  function openSaved(r: SavedRespuesta) {
    setCuerpo(r.cuerpo);
    setBaseLegal(Array.isArray(r.base_legal) ? r.base_legal : []);
    setAntecedentes(Array.isArray(r.antecedentes) ? r.antecedentes : []);
    setAsunto(r.asunto ?? "");
    setRemitenteDoc(r.remitente ?? "");
    setNroOficio(r.nro_oficio ?? "");
    setNroAsignado(Boolean(r.nro_oficio));
    setDestinatario(r.destinatario ?? "");
    if (r.tipo_documento && DOC_TIPOS.includes(r.tipo_documento as DocTipo)) setTipoDocumento(r.tipo_documento as DocTipo);
    setGenUsage(r.token_usage ?? undefined);
    setResult({ respuesta: r.cuerpo, sources: [], antecedentes: r.antecedentes });
    showToast("Respuesta cargada en el editor.", "info");
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="expTabContent">
      {oficinas.length === 0 ? (
        <div className="expMessage expMessage-info" role="status" style={{ marginBottom: 12 }}>
          <Settings size={16} />
          <span>No hay oficinas configuradas. Pídele al administrador que las cree en <strong>Configuración → Oficinas y numeración</strong>.</span>
        </div>
      ) : null}

      {/* 1) Documento recibido (antecedente) */}
      <div className="expFormSection">
        <div className="expFormSectionHeader">
          <h3 className="expFormSectionTitle">
            <ScrollText size={16} /> Documento recibido (antecedente)
            <span className="expFormSectionHint">Sube el PDF: la IA lo usa como referencia. Opcional.</span>
          </h3>
        </div>
        <label
          className={"expFilePicker" + (isDragging ? " dragging" : "")}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => { e.preventDefault(); setIsDragging(false); void handleFile(e.dataTransfer.files?.[0]); }}
          style={{ marginBottom: 12 }}
        >
          <div className="expFilePickerIcon">
            {reading ? <Loader2 size={22} className="expSpin" /> : <UploadCloud size={22} />}
          </div>
          <p className="expFilePickerTitle">
            {reading ? "Leyendo el PDF…" : isDragging ? "Suelta el PDF aquí" : "Arrastra el PDF recibido o haz clic"}
          </p>
          <p className="expFilePickerSub">Se lee con OCR como antecedente. Máx {maxPdfSizeLabel}.</p>
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf"
            onChange={(e) => { void handleFile(e.target.files?.[0]); if (inputRef.current) inputRef.current.value = ""; }}
          />
        </label>
        {documentoTexto ? (
          <div className="expField">
            <label className="expField-label" htmlFor="resp-doc">Texto del documento recibido</label>
            <textarea id="resp-doc" className="expField-input" value={documentoTexto} onChange={(e) => setDocumentoTexto(e.target.value)} rows={5} />
          </div>
        ) : null}
      </div>

      {/* 2) Tu respuesta */}
      <div className="expFormSection" style={{ marginTop: 16 }}>
        <div className="expFormSectionHeader">
          <h3 className="expFormSectionTitle">
            <FileSignature size={16} /> Tu respuesta
            <span className="expFormSectionHint">Oficina emisora, tipo y qué quieres responder</span>
          </h3>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <div className="expField">
            <label className="expField-label" htmlFor="resp-oficina"><Building2 size={12} /> Oficina emisora</label>
            <select
              id="resp-oficina"
              className="expField-select"
              value={oficinaId}
              onChange={(e) => { setOficinaId(e.target.value); setNroAsignado(false); }}
            >
              {oficinas.length === 0 ? <option value="">— Sin oficinas —</option> : null}
              {oficinas.map((o) => (
                <option key={o.id} value={o.id}>{o.nombre}</option>
              ))}
            </select>
          </div>
          <div className="expField">
            <label className="expField-label" htmlFor="resp-tipo">Tipo de documento</label>
            <select
              id="resp-tipo"
              className="expField-select"
              value={tipoDocumento}
              onChange={(e) => { setTipoDocumento(e.target.value as DocTipo); setNroAsignado(false); }}
            >
              {DOC_TIPOS.map((t) => <option key={t} value={t}>{t.charAt(0) + t.slice(1).toLowerCase()}</option>)}
            </select>
          </div>
          <div className="expField">
            <label className="expField-label">Nº a asignar</label>
            <input className="expField-input" value={previewNumero || "Configura la numeración (admin)"} readOnly />
          </div>
        </div>

        {oficina ? (
          <span className="expHelpText" style={{ marginTop: 4 }}>
            Firma: <strong>{oficina.responsableNombre || "—"}</strong>{oficina.responsableCargo ? ` · ${oficina.responsableCargo}` : ""}
            {oficina.tieneMembrete ? " · ✓ hoja membretada" : " · sin hoja membretada"}
          </span>
        ) : null}

        <div className="expField" style={{ marginTop: 8 }}>
          <label className="expField-label" htmlFor="resp-intencion">¿Qué quieres responder?</label>
          <textarea
            id="resp-intencion"
            className="expField-input"
            value={intencion}
            onChange={(e) => setIntencion(e.target.value)}
            rows={5}
            placeholder="Ej. Comunicar que la solicitud de licencia procede, otorgar plazo de 5 días para subsanar, etc. La IA lo convierte en el cuerpo formal."
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div className="expField">
            <label className="expField-label" htmlFor="resp-rem">Dirigido a</label>
            <input id="resp-rem" className="expField-input" value={remitenteDoc} onChange={(e) => setRemitenteDoc(e.target.value)} placeholder="Destinatario de la respuesta" />
          </div>
          <div className="expField">
            <label className="expField-label" htmlFor="resp-asunto">Asunto</label>
            <input id="resp-asunto" className="expField-input" value={asunto} onChange={(e) => setAsunto(e.target.value)} placeholder="Sumilla" />
          </div>
          <div className="expField">
            <label className="expField-label" htmlFor="resp-tone">Tono</label>
            <select id="resp-tone" className="expField-select" value={tone} onChange={(e) => setTone(e.target.value as typeof tone)}>
              <option value="formal">Formal e institucional</option>
              <option value="cercano">Cercano y didáctico</option>
              <option value="tecnico">Técnico-jurídico</option>
            </select>
          </div>
          <div className="expField">
            <label className="expField-label" htmlFor="resp-length">Extensión</label>
            <select id="resp-length" className="expField-select" value={length} onChange={(e) => setLength(e.target.value as typeof length)}>
              <option value="concisa">Concisa</option>
              <option value="media">Media</option>
              <option value="detallada">Detallada</option>
            </select>
          </div>
        </div>

        <label className="expCheckRow" style={{ marginTop: 12 }}>
          <input type="checkbox" checked={includeAntecedentes} onChange={(e) => setIncludeAntecedentes(e.target.checked)} />
          <span><Library size={13} /> Buscar <strong>antecedentes</strong> en los expedientes archivados.</span>
        </label>

        <button type="button" className="expBtn expBtn-primary expBtn-large" onClick={handleGenerate} disabled={generating || reading} style={{ marginTop: 12 }}>
          {generating ? <Loader2 size={16} className="expSpin" /> : <Sparkles size={16} />}
          {generating ? "Generando cuerpo…" : "Generar cuerpo del documento"}
        </button>
        <span className="expHelpText">
          <Sparkles size={12} /> La IA redacta el cuerpo a partir de tu intención, fundamentado en normativa{includeAntecedentes ? " y antecedentes" : ""}.
        </span>
      </div>

      {/* 3) Borrador */}
      {result ? (
        <div className="expFormSection" style={{ marginTop: 16 }}>
          <div className="expFormSectionHeader">
            <h3 className="expFormSectionTitle">
              <FileSignature size={16} /> Borrador
              <span className="expFormSectionHint">Edita antes de exportar</span>
            </h3>
            {genUsage ? (
              <span className="expHelpText" style={{ marginTop: 0 }} title="Tokens de IA consumidos">
                <Sparkles size={12} /> {formatCost(genUsage)}
              </span>
            ) : null}
          </div>
          <div className="expField">
            <textarea className="expField-input" value={cuerpo} onChange={(e) => setCuerpo(e.target.value)} rows={14} />
          </div>

          {baseLegal.length > 0 ? (
            <div className="expField">
              <label className="expField-label">Base legal citada ({baseLegal.length})</label>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "var(--exp-muted)" }}>
                {baseLegal.map((s, i) => <li key={i} style={{ marginBottom: 4 }}><strong>{s.referencia}</strong>: {s.texto}</li>)}
              </ul>
            </div>
          ) : null}

          {antecedentes.length > 0 ? (
            <div className="expField">
              <label className="expField-label">Antecedentes del archivo ({antecedentes.length})</label>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "var(--exp-muted)" }}>
                {antecedentes.map((a) => (
                  <li key={a.expedienteId} style={{ marginBottom: 4 }}>
                    <strong>{a.title}</strong>{a.serie ? ` (${a.serie})` : ""}{a.anio ? `, ${a.anio}` : ""} · <MapPin size={11} /> {a.ubicacion}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <button type="button" className="expBtn expBtn-ghost" onClick={handleSaveRespuesta} disabled={savingRespuesta} style={{ marginTop: 12 }}>
            {savingRespuesta ? <Loader2 size={16} className="expSpin" /> : <Save size={16} />}
            {savingRespuesta ? "Guardando…" : "Guardar y numerar"}
          </button>
        </div>
      ) : null}

      {/* 4) Datos del documento + exportar */}
      {result ? (
        <div className="expFormSection" style={{ marginTop: 16 }}>
          <div className="expFormSectionHeader">
            <h3 className="expFormSectionTitle">
              <Building2 size={16} /> Datos del documento
              <span className="expFormSectionHint">Nº, destinatario y formato</span>
            </h3>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div className="expField">
              <label className="expField-label">Nº de documento</label>
              <input className="expField-input" value={numeroEfectivo} onChange={(e) => setNroOficio(e.target.value)} placeholder={previewNumero} />
            </div>
            <div className="expField">
              <label className="expField-label">Destinatario</label>
              <input className="expField-input" value={destinatario} onChange={(e) => setDestinatario(e.target.value)} placeholder={remitenteDoc || "Nombre"} />
            </div>
            <div className="expField">
              <label className="expField-label">Cargo del destinatario</label>
              <input className="expField-input" value={cargoDestinatario} onChange={(e) => setCargoDestinatario(e.target.value)} placeholder="Opcional" />
            </div>
            <div className="expField">
              <label className="expField-label">Formato de salida</label>
              <select className="expField-select" value={exportFormat} onChange={(e) => setExportFormat(e.target.value as "pdf" | "docx")}>
                <option value="pdf">PDF (sobre hoja membretada de la oficina)</option>
                <option value="docx">Word (.docx)</option>
              </select>
            </div>
          </div>

          <button type="button" className="expBtn expBtn-primary expBtn-large" onClick={handleExport} disabled={exporting} style={{ marginTop: 12 }}>
            {exporting ? <Loader2 size={16} className="expSpin" /> : <Download size={16} />}
            {exporting ? "Generando…" : `Descargar (.${exportFormat})`}
          </button>
          {exportFormat === "pdf" && oficina && !oficina.tieneMembrete ? (
            <span className="expHelpText"><Settings size={12} /> Esta oficina no tiene hoja membretada cargada (config admin); el PDF saldrá en blanco.</span>
          ) : null}
        </div>
      ) : null}

      {/* 5) Historial */}
      {saved.length > 0 ? (
        <div className="expFormSection" style={{ marginTop: 16 }}>
          <div className="expFormSectionHeader">
            <h3 className="expFormSectionTitle">
              <History size={16} /> Respuestas archivadas
              <span className="expFormSectionHint">Haz clic para reabrir y reexportar</span>
            </h3>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {saved.map((r) => (
              <button key={r.id} type="button" className="expResultCard" style={{ gridTemplateColumns: "1fr auto", textAlign: "left" }} onClick={() => openSaved(r)}>
                <div className="expResultBody">
                  <h4 className="expResultTitle">{r.nro_oficio || r.asunto || "Respuesta"}</h4>
                  <div className="expResultMeta">
                    {r.tipo_documento ? <span className="expResultMetaItem">{r.tipo_documento}</span> : null}
                    {r.asunto ? <span className="expResultMetaItem">{r.asunto}</span> : null}
                    {r.destinatario ? <span className="expResultMetaItem">→ {r.destinatario}</span> : null}
                    <span className="expResultMetaItem">{new Date(r.created_at).toLocaleDateString("es-PE")}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
