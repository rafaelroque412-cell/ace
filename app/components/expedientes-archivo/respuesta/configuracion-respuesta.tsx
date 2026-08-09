"use client";

import { Building2, ChevronDown, ChevronRight, FileSignature, Hash, Library, Mic, MicOff, Settings, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ConfirmDialog } from "../../confirm-dialog";
import { BibliotecaSelector } from "./biblioteca-selector";
import type { AdjuntoResult, OficinaOption } from "@/lib/expedientes-archivo-actions";
import { DOC_TIPOS, type DocTipo } from "@/lib/expedientes-archivo-actions";
import { tipoDocumentoLabel } from "@/lib/document-number";
import { PLANTILLAS_RESPUESTA } from "@/lib/respuesta-plantillas";

type Props = {
  adjuntos: AdjuntoResult[];
  asunto: string;
  clearBorrador: () => void;
  cuerpo: string;
  destinoNumero: string;
  intencion: string;
  isAdminOficinas: boolean;
  length: "concisa" | "media" | "detallada";
  normativaIds: string[];
  oficina: OficinaOption | null;
  oficinaId: string;
  oficinas: OficinaOption[];
  onChangeOficina: (nextId: string) => { hasBody: boolean; previousId: string };
  remitenteDoc: string;
  setAdjuntos: (v: AdjuntoResult[]) => void;
  setIncludeAntecedentes: (v: boolean) => void;
  setIntencion: (v: string) => void;
  setLength: (v: "concisa" | "media" | "detallada") => void;
  setNormativaIds: (v: string[]) => void;
  setTipoDocumento: (v: DocTipo) => void;
  setTone: (v: "cercano" | "formal" | "tecnico") => void;
  setRemitenteDoc: (v: string) => void;
  setAsunto: (v: string) => void;
  includeAntecedentes: boolean;
  tipoDocumento: DocTipo;
  tone: "cercano" | "formal" | "tecnico";
  totalActivas: number;
  userEntity: string | null;
  showToast: (msg: string, kind?: "success" | "error" | "warning" | "info") => void;
  // Emitido a handleGenerate en el padre
  onGenerate: () => void;
  generating: boolean;
};

// Seccion 2: Tu respuesta - oficina + tipo + intencion + normativa + generar
export function ConfiguracionRespuesta({
  adjuntos,
  asunto,
  clearBorrador,
  cuerpo,
  destinoNumero,
  intencion,
  isAdminOficinas,
  length,
  normativaIds,
  oficina,
  oficinaId,
  oficinas,
  onChangeOficina,
  remitenteDoc,
  setAdjuntos,
  setIncludeAntecedentes,
  setIntencion,
  setLength,
  setNormativaIds,
  setTipoDocumento,
  setTone,
  setRemitenteDoc,
  setAsunto,
  includeAntecedentes,
  tipoDocumento,
  tone,
  totalActivas,
  userEntity,
  showToast,
  onGenerate,
  generating,
}: Props) {
  const [confirmCambioOficina, setConfirmCambioOficina] = useState<{
    onConfirm: () => void;
  } | null>(null);
  // Opciones avanzadas (normativa, tono, extension, archivo) plegadas por
  // defecto: el usuario no tecnico genera sin tocarlas.
  const [mostrarApoyos, setMostrarApoyos] = useState(false);

  // Tipos que emite la oficina seleccionada (Configuracion → Numeracion).
  const tiposDisponibles: readonly DocTipo[] =
    oficina && oficina.tipos.length > 0 ? oficina.tipos : DOC_TIPOS;

  // Si el tipo seleccionado no lo emite esta oficina, saltar al primero valido.
  useEffect(() => {
    if (!tiposDisponibles.includes(tipoDocumento)) {
      setTipoDocumento(tiposDisponibles[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [oficinaId, tiposDisponibles.join("|")]);

  // Si hay borrador, se confirma ANTES de aplicar el cambio: asi "cancelar"
  // de verdad no cambia nada (antes la oficina ya habia cambiado).
  function handleSelectOficina(nextId: string) {
    if (nextId === oficinaId) return;
    if (cuerpo.trim()) {
      setConfirmCambioOficina({
        onConfirm: () => {
          onChangeOficina(nextId);
          clearBorrador();
          showToast("Oficina cambiada y borrador limpiado.", "info");
          setConfirmCambioOficina(null);
        },
      });
      return;
    }
    onChangeOficina(nextId);
  }

  return (
    <div className="expFormSection" style={{ marginTop: 16 }}>
      <div className="expFormSectionHeader">
        <h3 className="expFormSectionTitle">
          <FileSignature size={16} /> Tu respuesta
          <span className="expFormSectionHint">
            Oficina emisora, tipo y que quieres responder
          </span>
        </h3>
      </div>

      {oficinas.length === 0 ? (
        <div className="expMessage expMessage-info" role="status" style={{ marginBottom: 12 }}>
          <Building2 size={16} />
          {isAdminOficinas ? (
            <span>
              No hay oficinas activas. Crea la primera en{" "}
              <strong>Configuracion → Oficinas y numeracion → Areas</strong>.
            </span>
          ) : (
            <span>
              No tienes una oficina asignada. Tu entidad es{" "}
              <strong>{userEntity ?? "(sin entidad)"}</strong>. Pidele al
              administrador que cree la oficina con esa entidad o que te vincule.
              {totalActivas > 0
                ? ` Hay ${totalActivas} oficina(s) activa(s) en el sistema.`
                : ""}
            </span>
          )}
        </div>
      ) : isAdminOficinas && totalActivas > oficinas.length ? (
        <div className="expMessage expMessage-info" role="status" style={{ marginBottom: 12 }}>
          <Building2 size={16} />
          <span>
            Eres administrador: ves <strong>{oficinas.length}</strong> oficina(s)
            de tu entidad. Hay <strong>{totalActivas}</strong> activas en total.
          </span>
        </div>
      ) : null}

      <Grupo
        titulo="¿Quién emite el documento?"
        hint="Oficina, tipo de documento y número que le tocará"
      >
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        <div className="expField">
          <label className="expField-label" htmlFor="resp-oficina">
            <Building2 size={12} /> Oficina emisora
          </label>
          <select
            id="resp-oficina"
            className="expField-select"
            value={oficinaId}
            onChange={(e) => handleSelectOficina(e.target.value)}
          >
            {oficinas.length === 0 ? <option value="">— Sin oficinas —</option> : null}
            {oficinas.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="expField">
          <label className="expField-label" htmlFor="resp-tipo">Tipo de documento</label>
          <select
            id="resp-tipo"
            className="expField-select"
            value={tipoDocumento}
            onChange={(e) => setTipoDocumento(e.target.value as DocTipo)}
          >
            {tiposDisponibles.map((t) => (
              <option key={t} value={t}>
                {tipoDocumentoLabel(t)}
              </option>
            ))}
          </select>
          <small style={{ color: "var(--muted, #667)", fontSize: 11 }}>
            Solo los tipos que emite esta oficina (Configuración → Numeración).
          </small>
        </div>
        <div className="expField">
          <label className="expField-label">Nº a asignar</label>
          <input
            className="expField-input"
            value={destinoNumero || "Configura la numeracion (admin)"}
            readOnly
          />
          <small style={{ color: "var(--brand, #0f766e)", fontSize: 11, fontWeight: 500 }}>
            {destinoNumero ? `Preview: ${destinoNumero}` : "Configura en Configuracion → Numeracion"}
          </small>
        </div>
      </div>

      {oficina ? (
        <>
          <span className="expHelpText" style={{ marginTop: 4 }}>
            Responsable: <strong>{oficina.responsableNombre || "—"}</strong>
            {oficina.responsableCargo ? ` · ${oficina.responsableCargo}` : ""}
            {oficina.tieneMembrete ? " · ✓ hoja membretada" : " · sin hoja membretada"}
            {" "}(no se imprime: el documento queda con espacio para firma y sello)
          </span>
          {!oficina.tieneMembrete || !destinoNumero ? (
            <div className="expMessage expMessage-warning" role="status" style={{ marginTop: 6, marginBottom: 0 }}>
              <Settings size={14} />
              <span>
                {!oficina.tieneMembrete && !destinoNumero
                  ? "Esta oficina no tiene hoja membretada ni numeración configurada. El PDF saldrá en blanco y el Nº será genérico."
                  : !oficina.tieneMembrete
                    ? "Esta oficina no tiene hoja membretada. El PDF saldrá sin membrete."
                    : "Esta oficina no tiene numeración configurada. El Nº del documento será genérico."}
                {" "}Configúralo en <strong>Configuración → Oficinas y numeración</strong>.
              </span>
            </div>
          ) : null}
        </>
      ) : null}
      </Grupo>

      <Grupo
        titulo="¿Qué vas a responder?"
        hint="Elige un caso típico o cuéntale a la IA con tus palabras"
      >
      {/* Plantillas de casos frecuentes: 1 clic pre-llena la intencion */}
      <div className="expField" style={{ marginTop: 8 }}>
        <label className="expField-label" htmlFor="resp-plantilla">
          Caso frecuente <span style={{ fontWeight: 400, color: "var(--muted, #667)" }}>(opcional, pre-llena lo demás)</span>
        </label>
        <select
          id="resp-plantilla"
          className="expField-select"
          value=""
          onChange={(e) => {
            const p = PLANTILLAS_RESPUESTA.find((x) => x.id === e.target.value);
            if (!p) return;
            setIntencion(p.intencion);
            if (tiposDisponibles.includes(p.tipoSugerido)) {
              setTipoDocumento(p.tipoSugerido);
            }
            showToast(
              "Plantilla aplicada: completa los datos entre [CORCHETES] y genera.",
              "info",
            );
          }}
        >
          <option value="">— Elegir un caso típico… —</option>
          {PLANTILLAS_RESPUESTA.map((p) => (
            <option key={p.id} value={p.id} title={p.descripcion}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      <div className="expField" style={{ marginTop: 8 }}>
        <label className="expField-label" htmlFor="resp-intencion" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          ¿Que quieres responder?
          <DictadoButton
            onTexto={(t) => setIntencion(intencion ? `${intencion.trim()} ${t}` : t)}
            showToast={showToast}
          />
        </label>
        <textarea
          id="resp-intencion"
          className="expField-input"
          value={intencion}
          onChange={(e) => setIntencion(e.target.value)}
          rows={5}
          placeholder="Ej. Comunicar que la solicitud de licencia procede, otorgar plazo de 5 dias para subsanar, etc. La IA lo convierte en el cuerpo formal. También puedes dictarlo con el micrófono."
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div className="expField">
          <label className="expField-label" htmlFor="resp-rem">Dirigido a</label>
          <input
            id="resp-rem"
            className="expField-input"
            value={remitenteDoc}
            onChange={(e) => setRemitenteDoc(e.target.value)}
            placeholder="Destinatario de la respuesta"
          />
        </div>
        <div className="expField">
          <label className="expField-label" htmlFor="resp-asunto">Asunto</label>
          <input
            id="resp-asunto"
            className="expField-input"
            value={asunto}
            onChange={(e) => setAsunto(e.target.value)}
            placeholder="Sumilla"
          />
        </div>
      </div>
      </Grupo>

      {/* Opciones avanzadas plegadas: normativa de apoyo, estilo y archivo.
          El usuario no técnico puede generar sin abrirlas nunca. */}
      <div
        style={{
          border: "1px solid var(--line, #e2e4ea)",
          borderRadius: 10,
          marginTop: 12,
          overflow: "hidden",
        }}
      >
        <button
          type="button"
          onClick={() => setMostrarApoyos((v) => !v)}
          aria-expanded={mostrarApoyos}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "transparent",
            border: 0,
            cursor: "pointer",
            padding: "10px 12px",
            fontSize: 13,
            fontWeight: 600,
            color: "inherit",
            textAlign: "left",
          }}
        >
          {mostrarApoyos ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
          Normativa de apoyo y estilo
          <span style={{ fontWeight: 400, color: "var(--muted, #667)", fontSize: 12 }}>
            (opcional) —{" "}
            {[
              normativaIds.length > 0 ? `${normativaIds.length} norma(s)` : null,
              adjuntos.length > 0 ? `${adjuntos.length} adjunto(s)` : null,
              includeAntecedentes ? "con expedientes del archivo" : null,
              tone !== "formal" ? `tono ${tone}` : null,
              length !== "media" ? `extensión ${length}` : null,
            ]
              .filter(Boolean)
              .join(" · ") || "por defecto: normativa automática, tono formal"}
          </span>
        </button>

        {mostrarApoyos ? (
          <div style={{ padding: "0 12px 12px" }}>
            <BibliotecaSelector
              normativaIds={normativaIds}
              adjuntosIds={adjuntos.map((a) => a.documentId)}
              onChange={setNormativaIds}
              onAdjuntosChange={setAdjuntos}
            />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div className="expField">
                <label className="expField-label" htmlFor="resp-tone">Tono</label>
                <select
                  id="resp-tone"
                  className="expField-select"
                  value={tone}
                  onChange={(e) => setTone(e.target.value as "cercano" | "formal" | "tecnico")}
                >
                  <option value="formal">Formal e institucional</option>
                  <option value="cercano">Cercano y didactico</option>
                  <option value="tecnico">Tecnico-juridico</option>
                </select>
              </div>
              <div className="expField">
                <label className="expField-label" htmlFor="resp-length">Extension</label>
                <select
                  id="resp-length"
                  className="expField-select"
                  value={length}
                  onChange={(e) => setLength(e.target.value as "concisa" | "media" | "detallada")}
                >
                  <option value="concisa">Concisa</option>
                  <option value="media">Media</option>
                  <option value="detallada">Detallada</option>
                </select>
              </div>
            </div>

            <label className="expCheckRow" style={{ marginTop: 12 }}>
              <input
                type="checkbox"
                checked={includeAntecedentes}
                onChange={(e) => setIncludeAntecedentes(e.target.checked)}
              />
              <span>
                <Library size={13} /> Buscar además <strong>expedientes relacionados</strong> en la
                biblioteca del archivo (pestaña Subir). El antecedente principal siempre es el PDF
                que cargaste arriba.
              </span>
            </label>
          </div>
        ) : null}
      </div>

      <button
        type="button"
        className="primaryButton"
        onClick={onGenerate}
        disabled={generating}
        style={{ marginTop: 12 }}
      >
        {generating ? (
          <span style={{ display: "inline-block", width: 16, height: 16 }} className="expSpin" />
        ) : (
          <Sparkles size={16} />
        )}{" "}
        {generating ? "Generando cuerpo..." : "Generar cuerpo del documento"}
      </button>
      <span className="expHelpText">
        <Hash size={12} /> La IA redacta el cuerpo a partir de tu intencion, fundamentado en normativa
        {includeAntecedentes ? " y antecedentes" : ""}.
      </span>

      {confirmCambioOficina ? (
        <ConfirmDialog
          open={true}
          title="¿Cambiar la oficina emisora?"
          message="El borrador actual fue generado para esta oficina. Al cambiar de oficina se limpiara el borrador y el correlativo se reiniciara. ¿Quieres continuar?"
          tone="warning"
          confirmLabel="Cambiar y limpiar"
          cancelLabel="Quedarme en esta oficina"
          onConfirm={confirmCambioOficina.onConfirm}
          onCancel={() => setConfirmCambioOficina(null)}
        />
      ) : null}
    </div>
  );
}

// ── Grupo visual de campos con titulo en lenguaje llano ─────────────────
function Grupo({
  titulo,
  hint,
  children,
}: {
  titulo: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        border: "1px solid var(--line, #e2e4ea)",
        borderRadius: 10,
        padding: "10px 12px 12px",
        marginTop: 12,
      }}
    >
      <div style={{ marginBottom: 8 }}>
        <strong style={{ fontSize: 13 }}>{titulo}</strong>
        {hint ? (
          <span style={{ fontSize: 12, color: "var(--muted, #667)", marginLeft: 8 }}>{hint}</span>
        ) : null}
      </div>
      {children}
    </div>
  );
}

// ── Dictado por voz (Web Speech API, es-PE) ─────────────────────────────
// Las secretarias dictan más rápido de lo que tipean. Si el navegador no
// soporta reconocimiento de voz, el botón no se muestra.
type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>>; resultIndex: number }) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
};

function getSpeechRecognition(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function DictadoButton({
  onTexto,
  showToast,
}: {
  onTexto: (texto: string) => void;
  showToast: (msg: string, kind?: "success" | "error" | "warning" | "info") => void;
}) {
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const Ctor = getSpeechRecognition();
  if (!Ctor) return null;

  function stop() {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setListening(false);
  }

  function start() {
    if (!Ctor) return;
    try {
      const rec = new Ctor();
      rec.lang = "es-PE";
      rec.continuous = true;
      rec.interimResults = false;
      rec.onresult = (event) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i]?.[0]?.transcript?.trim();
          if (transcript) onTexto(transcript);
        }
      };
      rec.onend = () => setListening(false);
      rec.onerror = (e) => {
        setListening(false);
        if (e.error === "not-allowed") {
          showToast("Permite el acceso al micrófono para dictar.", "warning");
        }
      };
      recognitionRef.current = rec;
      rec.start();
      setListening(true);
      showToast("Dictado activo: habla y tu texto aparecerá abajo.", "info");
    } catch {
      setListening(false);
      showToast("No se pudo iniciar el dictado en este navegador.", "warning");
    }
  }

  return (
    <button
      type="button"
      className="secondaryButton"
      onClick={() => (listening ? stop() : start())}
      title={listening ? "Detener dictado" : "Dictar con el micrófono"}
      aria-pressed={listening}
      style={{
        fontSize: 11.5,
        padding: "2px 10px",
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        ...(listening ? { background: "#fee2e2", color: "#991b1b", borderColor: "#fecaca" } : {}),
      }}
    >
      {listening ? <MicOff size={13} /> : <Mic size={13} />}
      {listening ? "Detener" : "Dictar"}
    </button>
  );
}
