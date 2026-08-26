"use client";

import { Fragment } from "react";
import {
  idPestana,
  propsPanel,
  propsPestana,
  siguientePestana,
} from "@/lib/pestanas-accesibles";

/** Prefijo de los identificadores de esta lista de pestañas en la página. */
const BASE_SUBIDA = "subida";
const MODOS_SUBIDA = ["single", "batch"] as const;

import {
  AlertCircle,
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  FileText,
  FileUp,
  History,
  Info,
  Lightbulb,
  Loader2,
  Lock,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import {
  ARCHIVO_AMBIENTES,
  ARCHIVO_COLORES,
  CONTENEDOR_TIPOS,
  CONTENEDOR_TIPO_LABELS,
} from "@/lib/expedientes-archivo";
import { maxPdfSizeLabel } from "@/lib/upload-limits";
import type {
  DuplicateMatch,
  ExpedienteItem,
  PdfInventory,
  SubirForm,
  WizardStep,
  WorkspaceTab,
} from "./types";
import type { UbicacionSugerida } from "@/lib/expedientes-archivo-actions";
import type { LastUbicacion } from "./use-preferences";
import { BatchUpload } from "./batch-upload";
import { SkeletonList } from "./skeleton";
import { EXP_SPIN, expBtnClass } from "./estilos";
import { cn } from "@/lib/utils";

export type SubirTabContentProps = {
  // Permissions
  canManage: boolean;
  isAdmin: boolean;

  // Upload mode
  uploadMode: "single" | "batch";
  setUploadMode: (m: "single" | "batch") => void;

  // File handling
  file: File | null;
  setFile: (f: File | null) => void;
  isDragging: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  onFileSelect: (f: File | null) => void;
  setExtractedData: React.Dispatch<React.SetStateAction<PdfInventory | null>>;

  // Form
  form: SubirForm;
  setField: <K extends keyof SubirForm>(key: K, value: SubirForm[K]) => void;
  autoBadge: (key: keyof SubirForm) => React.ReactNode;
  baseForm: SubirForm;
  setForm: React.Dispatch<React.SetStateAction<SubirForm>>;
  setAutoFilledFields: React.Dispatch<React.SetStateAction<Set<keyof SubirForm>>>;

  // Wizard
  wizardStep: WizardStep;
  setWizardStep: React.Dispatch<React.SetStateAction<WizardStep>>;
  canProceedStep: () => { ok: boolean; reason?: string };

  // Upload
  uploading: boolean;
  uploadProgress: number;
  uploadExpediente: (e: React.FormEvent) => void;

  // Extract
  extracting: boolean;
  extractedData: PdfInventory | null;
  extractFromPdf: (opts?: { auto?: boolean; fileArg?: File }) => Promise<void>;
  applyExtractedData: () => void;
  dismissExtractedData: () => void;

  // Duplicates
  duplicates: DuplicateMatch[];
  setDuplicates: React.Dispatch<React.SetStateAction<DuplicateMatch[]>>;
  dupsDismissed: boolean;
  setDupsDismissed: (v: boolean | ((prev: boolean) => boolean)) => void;
  checkingDuplicates: boolean;
  lastDupSignatureRef: React.MutableRefObject<string>;

  // Ubicacion
  ubicacionSugerida: UbicacionSugerida | null;
  siguientePaquete: string | null;
  applyUbicacionSugerida: (u: UbicacionSugerida) => void;

  // Recent uploads
  recentUploads: ExpedienteItem[];
  loadingRecent: boolean;
  hasRecentPending: boolean;
  refreshRecentUploads: () => void;

  // Shared actions
  reindexingId: string | null;
  deletingId: string | null;
  reindexExpediente: (id: string) => Promise<void>;
  deleteExpediente: (exp: ExpedienteItem) => void;
  setOpenExp: (exp: ExpedienteItem) => void;
  setTab: (t: WorkspaceTab) => void;

  // UI helpers
  showToast: (message: string, kind?: "success" | "error" | "warning" | "info") => void;
  showConfirm: (d: { title: string; message: string; variant: "danger" | "warning"; onConfirm: () => void | Promise<void> }) => void;
  formatBytes: (n: number) => string;
  statusLabel: (s: ExpedienteItem["status"]) => string;

  // Preferences
  autoExtract: boolean;
  setAutoExtract: (v: boolean) => void;
  lastUbicacion: LastUbicacion;
  setLastUbicacion: (u: LastUbicacion) => void;

  // Batch upload callback
  onUploaded: () => void;
};

const WIZARD_STEPS = [
  { id: 0, label: "Documento", hint: "Sube el PDF e identifica el documento" },
  { id: 1, label: "Contenido", hint: "Describe el contenido del expediente" },
  { id: 2, label: "Persona", hint: "Quién lo presenta o solicita" },
  { id: 3, label: "Ubicación", hint: "Dónde se encuentra en papel" },
] as const;

/**
 * Campo editable para el preview de datos extraídos del PDF.
 * Permite al usuario revisar, modificar o eliminar cada campo
 * antes de aplicarlo al formulario.
 */
function EditableExtractedField({
  label,
  icon,
  value,
  onChange,
  onRemove,
  placeholder,
  type = "text",
  fullWidth = false,
  multiline = false,
}: {
  label: string;
  icon?: React.ReactNode;
  value: string;
  onChange: (value: string) => void;
  onRemove: () => void;
  placeholder?: string;
  type?: "text" | "number" | "date";
  fullWidth?: boolean;
  multiline?: boolean;
}) {
  const hasValue = value.trim().length > 0;
  return (
    <div
      className={
        "expExtractedField" +
        (fullWidth ? " expExtractedFieldFull" : "") +
        (hasValue ? " expExtractedFieldHasValue" : " expExtractedFieldEmpty")
      }
    >
      <label className="expExtractedFieldLabel">
        {icon}
        <span>{label}</span>
      </label>
      {multiline ? (
        <textarea
          className="expExtractedFieldInput expExtractedFieldTextarea"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={2}
        />
      ) : (
        <input
          className="expExtractedFieldInput"
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
      )}
      <button
        type="button"
        className="expExtractedFieldRemove"
        onClick={onRemove}
        aria-label={`Quitar campo ${label}`}
        title={`Quitar ${label}`}
      >
        <X size={12} />
      </button>
    </div>
  );
}

export function SubirTabContent({
  canManage,
  isAdmin,
  uploadMode,
  setUploadMode,
  file,
  setFile,
  isDragging,
  onDragOver,
  onDragLeave,
  onDrop,
  onFileSelect,
  setExtractedData,
  form,
  setField,
  autoBadge,
  baseForm,
  setForm,
  setAutoFilledFields,
  wizardStep,
  setWizardStep,
  canProceedStep,
  uploading,
  uploadProgress,
  uploadExpediente,
  extracting,
  extractedData,
  extractFromPdf,
  applyExtractedData,
  dismissExtractedData,
  duplicates,
  setDuplicates,
  dupsDismissed,
  setDupsDismissed,
  checkingDuplicates,
  lastDupSignatureRef,
  ubicacionSugerida,
  siguientePaquete,
  applyUbicacionSugerida,
  recentUploads,
  loadingRecent,
  hasRecentPending,
  refreshRecentUploads,
  reindexingId,
  deletingId,
  reindexExpediente,
  deleteExpediente,
  setOpenExp,
  setTab,
  showToast,
  showConfirm,
  formatBytes,
  statusLabel,
  autoExtract,
  setAutoExtract,
  lastUbicacion,
  setLastUbicacion,
  onUploaded,
}: SubirTabContentProps) {
  return canManage ? (
    <div className="expTabContent">
      {/* Selector de modo: uno por uno vs por lotes */}
      {/* Estas SÍ son pestañas: cada una monta un panel completamente distinto
          (el formulario paso a paso o la carga por lotes). */}
      <div
        role="tablist"
        aria-label="Modo de subida"
        className="expSubirModos"
        onKeyDown={(e) => {
          const destino = siguientePestana(MODOS_SUBIDA, uploadMode, e.key);
          if (!destino) return;
          e.preventDefault();
          setUploadMode(destino as typeof uploadMode);
          // Con índice móvil el foco no viaja solo: hay que llevarlo.
          document.getElementById(idPestana(BASE_SUBIDA, destino))?.focus();
        }}
      >
        <button
          type="button"
          {...propsPestana(BASE_SUBIDA, "single", uploadMode)}
          className={expBtnClass(uploadMode === "single" ? "primary" : "ghost")}
          onClick={() => setUploadMode("single")}
        >
          <FileText size={15} /> Uno por uno
        </button>
        <button
          type="button"
          {...propsPestana(BASE_SUBIDA, "batch", uploadMode)}
          className={expBtnClass(uploadMode === "batch" ? "primary" : "ghost")}
          onClick={() => setUploadMode("batch")}
        >
          <UploadCloud size={15} /> Por lotes
        </button>
      </div>

      <div {...propsPanel(BASE_SUBIDA, uploadMode)}>
      {uploadMode === "batch" ? (
        <BatchUpload
          autoExtract={autoExtract}
          lastUbicacion={lastUbicacion}
          setLastUbicacion={setLastUbicacion}
          onUploaded={onUploaded}
          showToast={showToast}
          showConfirm={showConfirm}
        />
      ) : (
      <form onSubmit={uploadExpediente}>
        <div className="expWizard">
          {/* Indicador de pasos, no pestañas: los pasos van en orden y arrastran
              el estado del formulario. `aria-current="step"` es lo que anuncia
              "vas por aquí"; `aria-selected` anunciaba una pestaña elegida. */}
          <div className="expWizardProgress" role="group" aria-label="Pasos del formulario">
            {WIZARD_STEPS.map((step, idx) => {
              const isActive = wizardStep === idx;
              const isDone = wizardStep > idx;
              return (
                <Fragment key={step.id}>
                  <button
                    type="button"
                    aria-current={isActive ? "step" : undefined}
                    onClick={() => setWizardStep(idx as WizardStep)}
                    className={
                      "expWizardStep" +
                      (isActive ? " active" : "") +
                      (isDone ? " done" : "")
                    }
                  >
                    <span className="expWizardStepNumber">
                      {isDone ? <Check size={14} /> : idx + 1}
                    </span>
                    <span className="expWizardStepLabel">{step.label}</span>
                  </button>
                  {idx < WIZARD_STEPS.length - 1 ? (
                    <div className="expWizardStepConnector" />
                  ) : null}
                </Fragment>
              );
            })}
          </div>
          <div
            style={{
              display: "flex",
              gap: 6,
              alignItems: "center",
              fontSize: 12,
              color: "var(--exp-muted)",
            }}
          >
            <Info size={12} />
            <span>{WIZARD_STEPS[wizardStep].hint}</span>
          </div>
        </div>

        {wizardStep === 0 ? (
          <>
            <div className="expFormSection">
              <div className="expFormSectionHeader">
                <h3 className="expFormSectionTitle">
                  <FileUp size={16} /> 1. Carga el PDF
                  <span className="expFormSectionHint">
                    Arrastra un archivo o haz clic para seleccionarlo
                  </span>
                </h3>
                {file ? (
                  <span className="expFormSectionCounter complete">
                    <Check size={12} /> Cargado
                  </span>
                ) : null}
              </div>

              <label
                className={
                  "expFilePicker" +
                  (isDragging ? " dragging" : "") +
                  (file ? " hasFile" : "")
                }
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
              >
                {file ? (
                  <div className="expFilePickerFile">
                    <FileText size={20} />
                    <div>
                      <strong>{file.name}</strong>
                      <span>{formatBytes(file.size)}</span>
                    </div>
                    <button
                      type="button"
                      className={expBtnClass("ghost")}
                      onClick={(e) => {
                        e.preventDefault();
                        setFile(null);
                        setExtractedData(null);
                      }}
                    >
                      <X size={14} /> Quitar
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="expFilePickerIcon">
                      <UploadCloud size={24} />
                    </div>
                    <p className="expFilePickerTitle">
                      {isDragging
                        ? "Suelta el PDF aquí"
                        : "Arrastra un PDF o haz clic"}
                    </p>
                    <p className="expFilePickerSub">
                      Tamaño máximo: {maxPdfSizeLabel}
                    </p>
                  </>
                )}
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => onFileSelect(e.target.files?.[0] ?? null)}
                />
              </label>

              {/* Toggle: analizar con IA automáticamente al cargar */}
              {canManage ? (
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontSize: 13,
                    color: "var(--exp-muted)",
                    cursor: "pointer",
                    marginTop: 10,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={autoExtract}
                    onChange={(e) => setAutoExtract(e.target.checked)}
                  />
                  <Sparkles size={13} />
                  Analizar el PDF con IA automáticamente al cargarlo
                </label>
              ) : null}

              {/* Botón para extraer datos manualmente (si el auto está apagado o quieres re-analizar) */}
              {file && canManage ? (
                <div className="expExtractSection">
                  <button
                    type="button"
                    className={cn(expBtnClass("secondary"), "expExtractBtn")}
                    onClick={() => extractFromPdf()}
                    disabled={extracting}
                    aria-label="Obtener datos del PDF automaticamente"
                  >
                    {extracting ? (
                      <>
                        <Loader2 size={16} className="expSpin" />
                        Analizando PDF con IA...
                      </>
                    ) : (
                      <>
                        <Sparkles size={16} />
                        {autoExtract ? "Volver a analizar el PDF" : "Obtener datos del PDF"}
                      </>
                    )}
                  </button>
                  <span className="expHelpText" style={{ marginTop: 0 }}>
                    <Info size={12} />
                    Usa OCR + IA para extraer número, fecha, materia, asunto y resumen.
                    No modifica el archivo ni indexa nada.
                  </span>
                </div>
              ) : null}

              {/* Aviso proactivo de posibles duplicados */}
              {duplicates.length > 0 && !dupsDismissed ? (
                <div
                  role="alert"
                  style={{
                    marginTop: 12,
                    padding: 12,
                    borderRadius: 10,
                    border: "1px solid var(--exp-warn-line, rgba(234,179,8,0.4))",
                    background: "var(--exp-warn-soft, rgba(234,179,8,0.08))",
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600 }}>
                    <AlertCircle size={15} />
                    Posible{duplicates.length === 1 ? "" : "s"} duplicado{duplicates.length === 1 ? "" : "s"} ({duplicates.length})
                  </div>
                  <span className="expHelpText" style={{ marginTop: 0 }}>
                    Ya hay expedientes parecidos archivados. Revisa antes de subir para no duplicar.
                  </span>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, display: "flex", flexDirection: "column", gap: 2 }}>
                    {duplicates.slice(0, 4).map((d) => (
                      <li key={d.id}>
                        {d.title}
                        {d.anio ? ` · ${d.anio}` : ""} · {d.status}
                      </li>
                    ))}
                  </ul>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      type="button"
                      className={expBtnClass("ghost", "small")}
                      onClick={() => setDupsDismissed(true)}
                    >
                      Continuar de todos modos
                    </button>
                  </div>
                </div>
              ) : checkingDuplicates ? (
                <span className="expHelpText" style={{ marginTop: 10 }}>
                  <Loader2 size={12} className="expSpin" /> Buscando posibles duplicados…
                </span>
              ) : null}

              {/* Preview de datos extraídos (editables) */}
              {extractedData ? (
                <div
                  className="expExtractedPreview"
                  role="region"
                  aria-label="Datos extraídos del PDF (editables)"
                >
                  <div className="expExtractedHeader">
                    <div>
                      <strong>
                        <Sparkles size={12} /> Datos detectados en el PDF
                        <span className="expExtractedBadge">editables</span>
                      </strong>
                      <span className="expHelpText" style={{ marginTop: 0 }}>
                        Edita o elimina los campos antes de aplicar. Solo
                        se rellenan los campos vacíos del formulario.
                      </span>
                    </div>
                    {extractedData.extractionMethod ? (
                      <span
                        className={`expStatus expStatus-${
                          extractedData.extractionMethod === "ai"
                            ? "indexed"
                            : extractedData.extractionMethod === "deterministic"
                              ? "uploaded"
                              : "processing"
                        }`}
                      >
                        {extractedData.extractionMethod === "ai"
                          ? "IA"
                          : extractedData.extractionMethod === "deterministic"
                            ? "Automático"
                            : extractedData.extractionMethod === "hybrid"
                              ? "Híbrido"
                              : "Sin datos"}
                      </span>
                    ) : null}
                  </div>
                  <div className="expExtractedChips">
                    <EditableExtractedField
                      label="SGD"
                      icon={<FileText size={11} />}
                      value={extractedData.numeroExpediente ?? ""}
                      onChange={(v) =>
                        setExtractedData((prev) =>
                          prev
                            ? {
                                ...prev,
                                numeroExpediente: v.trim() || null,
                              }
                            : prev,
                        )
                      }
                      onRemove={() =>
                        setExtractedData((prev) =>
                          prev
                            ? { ...prev, numeroExpediente: null }
                            : prev,
                        )
                      }
                      placeholder="Número SGD"
                    />
                    <EditableExtractedField
                      label="Tipo"
                      icon={<FileText size={11} />}
                      value={extractedData.tipoDocumento ?? ""}
                      onChange={(v) =>
                        setExtractedData((prev) =>
                          prev
                            ? {
                                ...prev,
                                tipoDocumento: v.trim() || null,
                              }
                            : prev,
                        )
                      }
                      onRemove={() =>
                        setExtractedData((prev) =>
                          prev
                            ? { ...prev, tipoDocumento: null }
                            : prev,
                        )
                      }
                      placeholder="Resolución, Oficio…"
                    />
                    <EditableExtractedField
                      label="Año"
                      icon={<History size={11} />}
                      value={extractedData.anio?.toString() ?? ""}
                      onChange={(v) =>
                        setExtractedData((prev) => {
                          if (!prev) return prev;
                          const year = v.trim()
                            ? Number.parseInt(v.trim(), 10)
                            : null;
                          return {
                            ...prev,
                            anio: year && !Number.isNaN(year) ? year : null,
                          };
                        })
                      }
                      onRemove={() =>
                        setExtractedData((prev) =>
                          prev ? { ...prev, anio: null } : prev,
                        )
                      }
                      placeholder="2024"
                      type="number"
                    />
                    <EditableExtractedField
                      label="Oficina"
                      icon={<Info size={11} />}
                      value={extractedData.oficina ?? ""}
                      onChange={(v) =>
                        setExtractedData((prev) =>
                          prev ? { ...prev, oficina: v.trim() || null } : prev,
                        )
                      }
                      onRemove={() =>
                        setExtractedData((prev) =>
                          prev ? { ...prev, oficina: null } : prev,
                        )
                      }
                      placeholder="Oficina emisora"
                    />
                    <EditableExtractedField
                      label="Materia"
                      icon={<Info size={11} />}
                      value={extractedData.materia ?? ""}
                      onChange={(v) =>
                        setExtractedData((prev) =>
                          prev
                            ? { ...prev, materia: v.trim() || null }
                            : prev,
                        )
                      }
                      onRemove={() =>
                        setExtractedData((prev) =>
                          prev ? { ...prev, materia: null } : prev,
                        )
                      }
                      placeholder="Materia del documento"
                    />
                    <EditableExtractedField
                      label="Asunto"
                      icon={<Info size={11} />}
                      value={extractedData.asunto ?? ""}
                      onChange={(v) =>
                        setExtractedData((prev) =>
                          prev
                            ? { ...prev, asunto: v.trim() || null }
                            : prev,
                        )
                      }
                      onRemove={() =>
                        setExtractedData((prev) =>
                          prev ? { ...prev, asunto: null } : prev,
                        )
                      }
                      placeholder="Asunto o sumilla"
                    />
                    <EditableExtractedField
                      label="Persona"
                      icon={<Info size={11} />}
                      value={extractedData.personaNombre ?? ""}
                      onChange={(v) =>
                        setExtractedData((prev) =>
                          prev ? { ...prev, personaNombre: v.trim() || null } : prev,
                        )
                      }
                      onRemove={() =>
                        setExtractedData((prev) =>
                          prev
                            ? { ...prev, personaNombre: null, personaTipo: null }
                            : prev,
                        )
                      }
                      placeholder="Persona/empresa interesada"
                    />
                    <EditableExtractedField
                      label="Folios"
                      icon={<FileText size={11} />}
                      value={extractedData.nroFolios?.toString() ?? ""}
                      onChange={(v) =>
                        setExtractedData((prev) => {
                          if (!prev) return prev;
                          const n = v.trim()
                            ? Number.parseInt(v.trim(), 10)
                            : null;
                          return {
                            ...prev,
                            nroFolios: n && !Number.isNaN(n) ? n : null,
                          };
                        })
                      }
                      onRemove={() =>
                        setExtractedData((prev) =>
                          prev ? { ...prev, nroFolios: null } : prev,
                        )
                      }
                      placeholder="Nº folios"
                      type="number"
                    />
                    <EditableExtractedField
                      label="Resumen"
                      icon={<FileText size={11} />}
                      value={extractedData.resumen ?? ""}
                      onChange={(v) =>
                        setExtractedData((prev) =>
                          prev
                            ? { ...prev, resumen: v.trim() || null }
                            : prev,
                        )
                      }
                      onRemove={() =>
                        setExtractedData((prev) =>
                          prev ? { ...prev, resumen: null } : prev,
                        )
                      }
                      placeholder="Resumen ejecutivo"
                      fullWidth
                      multiline
                    />
                  </div>
                  <div className="expExtractedActions">
                    <button
                      type="button"
                      className={expBtnClass("ghost", "small")}
                      onClick={dismissExtractedData}
                    >
                      <X size={14} /> Descartar todos
                    </button>
                    <button
                      type="button"
                      className={expBtnClass("primary")}
                      onClick={applyExtractedData}
                    >
                      <Check size={14} /> Aplicar al formulario
                    </button>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="expFormSection">
              <div className="expFormSectionHeader">
                <h3 className="expFormSectionTitle">
                  <Info size={16} /> 2. Identifica el documento
                </h3>
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 12,
                }}
              >
                <div className="expField">
                  <label className="expField-label">
                    SGD de expediente <span className="optional">(opcional)</span>
                  </label>
                  <input
                    value={form.sgdExpediente}
                    onChange={(e) => setField("sgdExpediente", e.target.value)}
                    placeholder="N° del sistema de gestión documental"
                    className="expField-input"
                  />
                  <span className="expHelpText">
                    N° de expediente del sistema documental externo. Lo asignas tú (no se autocompleta).
                  </span>
                </div>
                <div className="expField">
                  <label className="expField-label">Serie documental{autoBadge("serieDocumento")}</label>
                  <input
                    value={form.serieDocumento}
                    onChange={(e) => setField("serieDocumento", e.target.value)}
                    placeholder="Ej. Resolución 004-2024-MDCH-A"
                    className="expField-input"
                  />
                </div>
                <div className="expField">
                  <label className="expField-label">Tipo de documento{autoBadge("tipoDocumento")}</label>
                  <select
                    value={form.tipoDocumento}
                    onChange={(e) => setField("tipoDocumento", e.target.value)}
                    className="expField-select"
                  >
                    <option value="">— Selecciona —</option>
                    <option value="Resolución">Resolución</option>
                    <option value="Oficio">Oficio</option>
                    <option value="Decreto">Decreto</option>
                    <option value="Ordenanza">Ordenanza</option>
                    <option value="Informe">Informe</option>
                    <option value="Memorando">Memorando</option>
                    <option value="Carta">Carta</option>
                    <option value="otro">Otro…</option>
                  </select>
                </div>
                {form.tipoDocumento === "otro" ? (
                  <div className="expField">
                    <label className="expField-label">Especificar tipo</label>
                    <input
                      value={form.tipoDocumentoCustom}
                      onChange={(e) => setField("tipoDocumentoCustom", e.target.value)}
                      placeholder="Escribe el tipo de documento"
                      className="expField-input"
                    />
                  </div>
                ) : null}
                <div className="expField">
                  <label className="expField-label">
                    Año <span className="optional">(opcional)</span>
                    {autoBadge("anio")}
                  </label>
                  <input
                    type="number"
                    value={form.anio}
                    onChange={(e) => setField("anio", e.target.value)}
                    placeholder="2024"
                    className="expField-input"
                  />
                </div>
                <div className="expField">
                  <label className="expField-label">
                    Folios <span className="optional">(opcional)</span>
                    {autoBadge("folio")}
                  </label>
                  <input
                    value={form.folio}
                    onChange={(e) => setField("folio", e.target.value)}
                    placeholder="Nº de páginas del PDF"
                    className="expField-input"
                  />
                </div>
                <div className="expField" style={{ gridColumn: "1 / -1" }}>
                  <label className="expField-label">
                    Oficina{" "}
                    {isAdmin ? (
                      <span className="optional">(opcional)</span>
                    ) : (
                      <span className="optional">(asignada a tu oficina)</span>
                    )}
                    {autoBadge("oficina")}
                  </label>
                  <input
                    value={form.oficina}
                    onChange={(e) => setField("oficina", e.target.value)}
                    placeholder="Subgerencia, área, dirección…"
                    className="expField-input"
                    readOnly={!isAdmin}
                    title={!isAdmin ? "La oficina se asigna automáticamente según tu perfil" : undefined}
                  />
                </div>
                <div className="expField" style={{ gridColumn: "1 / -1" }}>
                  <label className="expField-label">
                    Título <span className="optional">(opcional)</span>
                    {autoBadge("title")}
                  </label>
                  <input
                    value={form.title}
                    onChange={(e) => setField("title", e.target.value)}
                    placeholder="Si lo dejas vacío se usa el nombre del archivo"
                    className="expField-input"
                  />
                  <span className="expHelpText">
                    <Info size={12} /> El título se mostrará en los resultados de búsqueda.
                  </span>
                </div>
              </div>
            </div>
          </>
        ) : null}

        {wizardStep === 1 ? (
          <div className="expFormSection">
            <div className="expFormSectionHeader">
              <h3 className="expFormSectionTitle">
                <FileText size={16} /> Describe el contenido
                <span className="expFormSectionHint">
                  Estos campos ayudan a la IA a encontrar el expediente
                </span>
              </h3>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
              }}
            >
              <div className="expField">
                <label className="expField-label">Materia{autoBadge("materia")}</label>
                <input
                  value={form.materia}
                  onChange={(e) => setField("materia", e.target.value)}
                  placeholder="Contratación, personal, presupuesto…"
                  className="expField-input"
                />
              </div>
              <div className="expField">
                <label className="expField-label">Asunto{autoBadge("asunto")}</label>
                <input
                  value={form.asunto}
                  onChange={(e) => setField("asunto", e.target.value)}
                  placeholder="Asunto o sumilla del documento"
                  className="expField-input"
                />
              </div>
              <div className="expField" style={{ gridColumn: "1 / -1" }}>
                <label className="expField-label">Resumen{autoBadge("resumen")}</label>
                <textarea
                  rows={3}
                  value={form.resumen}
                  onChange={(e) => setField("resumen", e.target.value)}
                  placeholder="Resumen ejecutivo (3-5 líneas)"
                  className="expField-textarea"
                />
              </div>
              <div className="expField" style={{ gridColumn: "1 / -1" }}>
                <label className="expField-label">Observaciones</label>
                <textarea
                  rows={2}
                  value={form.observaciones}
                  onChange={(e) => setField("observaciones", e.target.value)}
                  placeholder="Notas adicionales sobre este expediente"
                  className="expField-textarea"
                />
              </div>
            </div>
          </div>
        ) : null}

        {wizardStep === 2 ? (
          <div className="expFormSection">
            <div className="expFormSectionHeader">
              <h3 className="expFormSectionTitle">
                <Info size={16} /> Persona
                <span className="expFormSectionHint">
                  Quién presenta o solicita este documento
                </span>
              </h3>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
              }}
            >
              <div className="expField">
                <label className="expField-label">Tipo de persona</label>
                <select
                  value={form.personaTipo}
                  onChange={(e) =>
                    setField("personaTipo", e.target.value as SubirForm["personaTipo"])
                  }
                  className="expField-select"
                >
                  <option value="">— Sin persona —</option>
                  <option value="natural">Persona natural</option>
                  <option value="juridica">Persona jurídica</option>
                </select>
              </div>
              <div className="expField">
                <label className="expField-label">Documento</label>
                <input
                  value={form.personaDocumento}
                  onChange={(e) => setField("personaDocumento", e.target.value)}
                  placeholder="DNI o RUC"
                  className="expField-input"
                />
              </div>
              <div className="expField" style={{ gridColumn: "1 / -1" }}>
                <label className="expField-label">Nombre{autoBadge("personaNombre")}</label>
                <input
                  value={form.personaNombre}
                  onChange={(e) => setField("personaNombre", e.target.value)}
                  placeholder="Razón social o nombre completo"
                  className="expField-input"
                />
              </div>
            </div>
          </div>
        ) : null}

        {wizardStep === 3 ? (
          <div className="expFormSection">
            <div className="expFormSectionHeader">
              <h3 className="expFormSectionTitle">
                <MapPin size={16} /> Ubicación física
                <span className="expFormSectionHint">
                  Dónde se encuentra el expediente en papel
                </span>
              </h3>
            </div>

            {/* Sugerencias inteligentes de ubicación física */}
            {(() => {
              const last = lastUbicacion;
              const hasLast = Object.values(last).some((v) => v && String(v).trim());
              const hasSugerida = Boolean(
                ubicacionSugerida &&
                  Object.values(ubicacionSugerida).some((v) => v !== null && v !== ""),
              );
              if (!hasLast && !hasSugerida && !siguientePaquete) return null;
              return (
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 8,
                    marginBottom: 12,
                    alignItems: "center",
                  }}
                >
                  <span className="expHelpText" style={{ marginTop: 0 }}>
                    <Lightbulb size={12} /> Sugerencias:
                  </span>
                  {hasLast ? (
                    <button
                      type="button"
                      className={expBtnClass("secondary", "small")}
                      onClick={() => {
                        applyUbicacionSugerida({
                          tipo_almacenamiento: last.tipoAlmacenamiento || null,
                          nro_archivador: last.nroArchivador || null,
                          nro_paquete: last.nroPaquete || null,
                          empastado:
                            last.empastado === "si"
                              ? true
                              : last.empastado === "no"
                                ? false
                                : null,
                          color_archivador: last.colorArchivador || null,
                          nro_estante: last.nroEstante || null,
                          nro_piso: last.nroPiso || null,
                          nro_local: last.nroLocal || null,
                        });
                      }}
                    >
                      <History size={13} /> Usar última ubicación
                    </button>
                  ) : null}
                  {hasSugerida && ubicacionSugerida ? (
                    <button
                      type="button"
                      className={expBtnClass("secondary", "small")}
                      onClick={() => applyUbicacionSugerida(ubicacionSugerida)}
                    >
                      <MapPin size={13} /> Misma caja del archivo
                    </button>
                  ) : null}
                  {siguientePaquete ? (
                    <button
                      type="button"
                      className={expBtnClass("ghost", "small")}
                      onClick={() => setField("nroPaquete", siguientePaquete)}
                      title="Siguiente número de paquete disponible"
                    >
                      <Plus size={13} /> Paquete {siguientePaquete}
                    </button>
                  ) : null}
                </div>
              );
            })()}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
              }}
            >
              <div className="expField">
                <label className="expField-label">Tipo de contenedor{autoBadge("tipoAlmacenamiento")}</label>
                <select
                  value={form.tipoAlmacenamiento}
                  onChange={(e) => setField("tipoAlmacenamiento", e.target.value)}
                  className="expField-select"
                >
                  <option value="">— Sin contenedor —</option>
                  {CONTENEDOR_TIPOS.map((tipo) => (
                    <option key={tipo} value={tipo}>
                      {CONTENEDOR_TIPO_LABELS[tipo]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="expField">
                <label className="expField-label">Nº de archivador{autoBadge("nroArchivador")}</label>
                <input
                  value={form.nroArchivador}
                  onChange={(e) => setField("nroArchivador", e.target.value)}
                  placeholder="Ej. 12"
                  className="expField-input"
                />
              </div>
              <div className="expField">
                <label className="expField-label">Nº de paquete{autoBadge("nroPaquete")}</label>
                <input
                  value={form.nroPaquete}
                  onChange={(e) => setField("nroPaquete", e.target.value)}
                  placeholder="Opcional"
                  className="expField-input"
                />
              </div>
              <div className="expField">
                <label className="expField-label">Empastado{autoBadge("empastado")}</label>
                <select
                  value={form.empastado}
                  onChange={(e) => setField("empastado", e.target.value)}
                  className="expField-select"
                >
                  <option value="">— Sin definir —</option>
                  <option value="si">Sí</option>
                  <option value="no">No</option>
                </select>
              </div>
              <div className="expField">
                <label className="expField-label">Color{autoBadge("colorArchivador")}</label>
                <select
                  value={form.colorArchivador}
                  onChange={(e) => setField("colorArchivador", e.target.value)}
                  className="expField-select"
                >
                  <option value="">— Sin color —</option>
                  {ARCHIVO_COLORES.map((color) => (
                    <option key={color} value={color}>
                      {color}
                    </option>
                  ))}
                </select>
              </div>
              <div className="expField">
                <label className="expField-label">Estante{autoBadge("nroEstante")}</label>
                <input
                  value={form.nroEstante}
                  onChange={(e) => setField("nroEstante", e.target.value)}
                  placeholder="Ej. 3"
                  className="expField-input"
                />
              </div>
              <div className="expField">
                <label className="expField-label">Piso{autoBadge("nroPiso")}</label>
                <input
                  value={form.nroPiso}
                  onChange={(e) => setField("nroPiso", e.target.value)}
                  placeholder="Ej. 2"
                  className="expField-input"
                />
              </div>
              <div className="expField" style={{ gridColumn: "1 / -1" }}>
                <label className="expField-label">Local / ambiente{autoBadge("nroLocal")}</label>
                <select
                  value={form.nroLocal}
                  onChange={(e) => setField("nroLocal", e.target.value)}
                  className="expField-select"
                >
                  <option value="">— Sin ambiente —</option>
                  {ARCHIVO_AMBIENTES.map((amb) => (
                    <option key={amb} value={amb}>
                      {amb}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        ) : null}

        <div
          style={{
            display: "flex",
            gap: 10,
            justifyContent: "space-between",
            marginTop: 24,
            paddingTop: 16,
            borderTop: "1px solid var(--exp-line)",
          }}
        >
          <div style={{ display: "flex", gap: 10 }}>
            {wizardStep > 0 ? (
              <button
                type="button"
                className={expBtnClass("ghost")}
                onClick={() => setWizardStep((s) => (s - 1) as WizardStep)}
              >
                <ChevronLeft size={16} /> Anterior
              </button>
            ) : null}
            <button
              type="button"
              className={expBtnClass("ghost")}
              onClick={() => {
                showConfirm({
                  title: "¿Cancelar subida?",
                  message:
                    "Se perderán los datos del formulario y el PDF seleccionado. ¿Estás seguro?",
                  variant: "warning",
                  onConfirm: () => {
                    setForm(baseForm);
                    setFile(null);
                    setExtractedData(null);
                    setAutoFilledFields(new Set());
                    setDuplicates([]);
                    setDupsDismissed(false);
                    lastDupSignatureRef.current = "";
                    setWizardStep(0);
                    showToast("Subida cancelada", "info");
                  },
                });
              }}
            >
              <X size={14} /> Cancelar
            </button>
          </div>
          {wizardStep < 3 ? (
            <div style={{ display: "flex", gap: 10 }}>
              {file && !extracting ? (
                <button
                  type="submit"
                  disabled={uploading}
                  className={expBtnClass("ghost")}
                  title="Subir ya con los datos actuales (los campos vacíos los completa la IA)"
                >
                  {uploading ? (
                    <Loader2 size={16} className={EXP_SPIN} />
                  ) : (
                    <UploadCloud size={16} />
                  )}
                  Subir ahora
                </button>
              ) : null}
              <button
                type="button"
                className={expBtnClass("primary")}
                onClick={() => {
                  const check = canProceedStep();
                  if (!check.ok) {
                    showToast(check.reason ?? "Completa los datos requeridos", "warning");
                    return;
                  }
                  setWizardStep((s) => (s + 1) as WizardStep);
                }}
              >
                Siguiente <ChevronRight size={16} />
              </button>
            </div>
          ) : (
            <button
              type="submit"
              disabled={uploading}
              className={expBtnClass("primary", "large")}
            >
              {uploading ? (
                <Loader2 size={16} className={EXP_SPIN} />
              ) : (
                <UploadCloud size={16} />
              )}
              {uploading ? `Subiendo… ${uploadProgress}%` : "Subir al archivo"}
            </button>
          )}
        </div>

        {uploading && uploadProgress > 0 && uploadProgress < 100 ? (
          <div className="expProgress" style={{ marginTop: 12 }}>
            <div
              className="expProgress-bar"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        ) : null}
      </form>
      )}
      </div>

      {/* Lista de expedientes subidos (recientes) */}
      {canManage ? (
        <div className="expRecentUploads" aria-label="Expedientes subidos recientemente">
          <div className="expFormSectionHeader" style={{ marginTop: 32 }}>
            <h3 className="expFormSectionTitle">
              <FileUp size={16} /> Expedientes subidos recientemente
              <span className="expFormSectionHint">
                {recentUploads.length} de los últimos subidos
              </span>
            </h3>
            {recentUploads.length > 0 ? (
              <button
                type="button"
                className={expBtnClass("ghost", "small")}
                onClick={refreshRecentUploads}
                disabled={loadingRecent}
                aria-label="Actualizar lista de recientes"
              >
                {loadingRecent ? (
                  <Loader2 size={12} className={EXP_SPIN} />
                ) : (
                  <RefreshCw size={12} />
                )}
                Actualizar
              </button>
            ) : null}
          </div>

          {hasRecentPending ? (
            <div className="expIndexingBanner" role="status">
              <Loader2 size={14} className="expSpin" />
              <span>
                <strong>Indexando con Pinecone...</strong> Los expedientes
                marcados como &quot;Procesando&quot; están siendo vectorizados y
                fragmentados. La lista se actualiza automáticamente cada 4s.
              </span>
            </div>
          ) : null}

          {loadingRecent && recentUploads.length === 0 ? (
            <SkeletonList count={3} />
          ) : recentUploads.length === 0 ? (
            <div className="expRecentEmpty">
              <FileText size={20} />
              <p>
                Aún no has subido expedientes. Completa el wizard de arriba
                para empezar.
              </p>
            </div>
          ) : (
            <div className="expRecentList">
              {recentUploads.map((exp) => (
                <article
                  key={exp.id}
                  className={
                    "expRecentItem" +
                    (exp.status === "processing" || exp.status === "uploaded"
                      ? " expRecentItemPending"
                      : "") +
                    (exp.status === "error" ? " expRecentItemError" : "")
                  }
                >
                  <div className="expRecentItemIcon">
                    <FileText size={16} />
                  </div>
                  <div className="expRecentItemBody">
                    <div className="expRecentItemHeader">
                      <strong>{exp.title}</strong>
                      <span
                        className={`expStatus expStatus-${exp.status}`}
                        data-status={exp.status}
                      >
                        {statusLabel(exp.status)}
                      </span>
                    </div>
                    <div className="expRecentItemMeta">
                      {exp.serie_documento ? (
                        <span>{exp.serie_documento}</span>
                      ) : (
                        <span>Sin número</span>
                      )}
                      {exp.anio ? <span>· {exp.anio}</span> : null}
                      {exp.oficina ? <span>· {exp.oficina}</span> : null}
                      <span>· {formatBytes(exp.file_size)}</span>
                      <span>· {new Date(exp.created_at).toLocaleDateString("es-PE")}</span>
                    </div>
                    {exp.metadata?.chunkCount ? (
                      <div className="expRecentItemMeta">
                        <span>
                          {exp.metadata.pageCount ?? 0} páginas · {exp.metadata.chunkCount} fragmentos
                        </span>
                      </div>
                    ) : null}
                    {exp.error_message ? (
                      <div className="expRecentItemError">
                        {exp.error_message}
                        <div style={{ marginTop: 8 }}>
                          <button
                            type="button"
                            className={expBtnClass("secondary", "small")}
                            onClick={() => void reindexExpediente(exp.id)}
                            disabled={reindexingId === exp.id}
                            title="Reintenta la extracción con OCR de alta calidad"
                          >
                            {reindexingId === exp.id ? (
                              <Loader2 size={13} className={EXP_SPIN} />
                            ) : (
                              <RefreshCw size={13} />
                            )}
                            Reintentar con OCR de alta calidad
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                  <div
                    className="expRecentItemActions"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={() => setOpenExp(exp)}
                      className="expIconButton"
                      aria-label="Ver detalle"
                      title="Ver detalle"
                    >
                      <Eye size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => void reindexExpediente(exp.id)}
                      disabled={reindexingId === exp.id}
                      className="expIconButton"
                      aria-label="Reindexar"
                      title="Reindexar"
                    >
                      <RefreshCw
                        size={14}
                        className={reindexingId === exp.id ? "expSpin" : ""}
                      />
                    </button>
                    <a
                      href={`/api/expedientes-archivo/${exp.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="expIconButton"
                      aria-label="Descargar PDF"
                      title="Descargar PDF"
                    >
                      <Download size={14} />
                    </a>
                    <button
                      type="button"
                      onClick={() => void deleteExpediente(exp)}
                      disabled={deletingId === exp.id}
                      className="expIconButton danger"
                      aria-label="Eliminar"
                      title="Eliminar"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </article>
              ))}
              {recentUploads.length >= 10 ? (
                <button
                  type="button"
                  className={cn(expBtnClass("secondary"), "expRecentViewAll")}
                  onClick={() => setTab("buscar")}
                >
                  Ver todos los expedientes
                  <ArrowRight size={14} />
                </button>
              ) : null}
            </div>
          )}
        </div>
      ) : null}
    </div>
  ) : (
    <div className="expTabContent">
      <div className="expEmpty">
        <div className="expEmptyIllustration">
          <Lock size={28} />
        </div>
        <h3 className="expEmpty-title">Acceso restringido</h3>
        <p className="expEmpty-desc">
          La carga y gestión de expedientes requiere rol DEC/Editor o administrador.
          Puedes buscar y consultar todos los expedientes indexados.
        </p>
        <button
          type="button"
          className={cn(expBtnClass("secondary"), "expEmpty-action")}
          onClick={() => setTab("buscar")}
        >
          <Search size={16} /> Ir a buscar
        </button>
      </div>
    </div>
  );
}
