"use client";

import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Landmark,
  Loader2,
  Save,
  User,
  Wallet,
} from "lucide-react";
import { SaveStatus } from "./save-status";
import { inputBase } from "./ui";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type EntitySettings,
  type GovernmentLevel,
  DEGREE_OPTIONS,
  entityChecklist,
  onlyDigits,
  parseMonto,
} from "@/lib/configuracion-types";
// La lógica no-React de esta pestaña (formateo de montos, avisos de las
// resoluciones, esquema de validación y estado del formulario) vive en su propio
// módulo, probado sin montar React.
import {
  type EntityFormData,
  type FormState,
  avisosResoluciones,
  calcularPacObras,
  entitySchema,
  formatearImporte,
  governmentLevelOptions,
  posicionTrasDigitos,
  toFormState,
} from "@/lib/configuracion-entidad";
import { fechaES } from "@/lib/fecha-es";
import { PORCENTAJE_LINEA_CORTE, soles } from "@/lib/segmentacion-parametros";
import { umbralContratoMenor } from "@/lib/umbral-contrato-menor";
import { useToastHelpers } from "@/lib/toast";
import { useYear } from "@/lib/year-context";
import { olvidarCatalogo } from "@/lib/settings-catalog-cache";

type Props = {
  entity: EntitySettings;
  setEntity: React.Dispatch<React.SetStateAction<EntitySettings>>;
  governmentLevels: GovernmentLevel[];
};

export function MunicipalidadTab({ entity, setEntity, governmentLevels }: Props) {
  const { yearParam } = useYear();
  const { success, error: toastError } = useToastHelpers();

  const [formData, setFormData] = useState<FormState>(() => toFormState(entity));
  // Ultimo estado confirmado en el servidor: base para detectar cambios reales
  // y evitar auto-guardados en la carga inicial.
  const [savedData, setSavedData] = useState<FormState>(() => toFormState(entity));
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [touched, setTouched] = useState<Partial<Record<keyof FormState, boolean>>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [activeSection, setActiveSection] = useState('datos');
  const [showPreview, setShowPreview] = useState(false);

  const SECCIONES = [
    { id: 'datos', label: 'Datos de la entidad' },
    { id: 'gobierno', label: 'Tipo de gobierno' },
    { id: 'gerente', label: 'Gerente municipal' },
    { id: 'aga', label: 'Autoridad de gestión administrativa (AGA)' },
    { id: 'pac', label: 'PAC y montos' },
    { id: 'preview', label: 'Vista previa' },
  ];

  const levels = governmentLevels.length > 0 ? governmentLevels : governmentLevelOptions;

  const validateField = useCallback((name: keyof FormState, value: string) => {
    const fieldSchema = entitySchema.shape[name as keyof EntityFormData];
    if (!fieldSchema) return;
    const result = fieldSchema.safeParse(value);
    setErrors((prev) => {
      const next = { ...prev };
      if (result.success) delete next[name];
      else next[name] = result.error.issues[0].message;
      return next;
    });
  }, []);

  const validateAll = useCallback(() => {
    const result = entitySchema.safeParse(formData);
    if (result.success) {
      setErrors({});
      return true;
    }
    const fieldErrors: Partial<Record<keyof FormState, string>> = {};
    result.error.issues.forEach((e) => {
      if (e.path[0]) fieldErrors[e.path[0] as keyof FormState] = e.message;
    });
    setErrors(fieldErrors);
    // Un campo solo se pinta en rojo si además está "tocado" (para no regañar
    // mientras se escribe por primera vez). Al validar TODO el formulario hay que
    // marcarlos: sin esto, el aviso decía "revisa los campos marcados en rojo" y
    // no había ninguno en rojo. Es también lo que hace visible el error del tipo
    // de gobierno, cuyos botones no disparan blur y nunca se marcaban solos.
    setTouched((prev) => {
      const next = { ...prev };
      for (const clave of Object.keys(fieldErrors)) {
        next[clave as keyof FormState] = true;
      }
      return next;
    });
    // Lleva la vista al primer campo con problema: el formulario es largo y el
    // error podía quedar fuera de pantalla.
    const primero = Object.keys(fieldErrors)[0];
    if (primero && typeof document !== "undefined") {
      requestAnimationFrame(() => {
        document
          .querySelector<HTMLElement>(`[data-campo-entidad="${primero}"]`)
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    }
    return false;
  }, [formData]);

  const isDirty = useMemo(
    () => JSON.stringify(formData) !== JSON.stringify(savedData),
    [formData, savedData],
  );

  // El efecto de sincronización necesita saber si hay cambios sin guardar, pero
  // NO puede depender de `isDirty`: eso lo re-dispararía en cada tecla. Se pasa
  // por una ref, actualizada en su propio efecto (asignarla durante el render
  // rompe el modelo de React) y declarada ANTES para que en un mismo commit se
  // actualice primero.
  const hayCambiosSinGuardar = useRef(false);
  useEffect(() => {
    hayCambiosSinGuardar.current = isDirty;
  }, [isDirty]);

  // Cuando el padre entrega/actualiza la entidad (carga o guardado), se
  // sincroniza el formulario y la base de comparacion sin marcar cambios.
  //
  // El formulario NO se pisa si el usuario tiene cambios sin guardar. El
  // autoguardado dispara a los 1.5 s de dejar de escribir, pero la respuesta
  // llega después: si para entonces se ha seguido tecleando, reemplazar el
  // formulario por lo que devolvió el servidor BORRA esos caracteres. Ese era el
  // motivo de que un monto largo pareciera cortarse a los pocos dígitos —el
  // resto se escribía y desaparecía—.
  useEffect(() => {
    const next = toFormState(entity);
    setSavedData(next);
    if (!hayCambiosSinGuardar.current) setFormData(next);
  }, [entity]);

  useEffect(() => {
    const sections = document.querySelectorAll('[data-section]');
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.getAttribute('data-section') || '');
          }
        });
      },
      { rootMargin: '-80px 0px -60% 0px' }
    );
    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, []);

  const persist = useCallback(
    async (mode: "auto" | "manual") => {
      const parsed = entitySchema.safeParse(formData);
      if (!parsed.success) {
        if (mode === "manual") {
          validateAll();
          toastError("Datos incompletos", "Revisa los campos marcados en rojo.");
        }
        return false;
      }

      setSaving(true);
      setSaveError(false);
      try {
        const response = await fetch(`/api/configuracion/settings?${yearParam}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ entity: formData }),
        });
        const payload = await response.json();

        if (!response.ok) {
          const zodErrors = payload.details?.fieldErrors as
            | Record<string, string[]>
            | undefined;
          const zodMsg = zodErrors
            ? Object.entries(zodErrors)
                .map(([k, v]) => `${k}: ${v.join(", ")}`)
                .join("; ")
            : "";
          throw new Error(
            zodMsg
              ? `${payload.error ?? "Error"} - ${zodMsg}`
              : payload.error ?? "No se pudo guardar la configuracion",
          );
        }

        // El catalogo que las demas pantallas tienen en memoria acaba de dejar
        // de ser cierto. Antes daba igual —cada componente lo repedia al
        // montarse—; ahora se comparte, asi que hay que decirle que lo olvide.
        olvidarCatalogo();
        // setEntity dispara el efecto de sincronizacion, que actualiza savedData.
        setEntity((prev) => ({ ...prev, ...payload.entity }));
        setSavedData(formData);
        setLastSaved(new Date());
        if (mode === "manual") {
          success("Configuracion guardada", "Los datos de la entidad se actualizaron.");
        }
        return true;
      } catch (err) {
        setSaveError(true);
        const message = err instanceof Error ? err.message : "No se pudo guardar la configuracion";
        toastError("Error al guardar", message);
        return false;
      } finally {
        setSaving(false);
      }
    },
    [formData, yearParam, setEntity, success, toastError, validateAll],
  );

  // Auto-guardado con antirebote: solo cuando el usuario cambio algo (isDirty)
  // y el formulario es valido. No se dispara en la carga inicial.
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!isDirty || saving) return;
    if (!entitySchema.safeParse(formData).success) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      void persist("auto");
    }, 1500);
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [formData, isDirty, saving, persist]);

  const handleChange = useCallback(
    (name: keyof FormState, value: string) => {
      setFormData((prev) => {
        const next = { ...prev, [name]: value };
        // El PAC de obras es el resto: se recalcula al tocar cualquiera de sus
        // dos sumandos, no se escribe.
        if (name === "pacMontoTotal" || name === "pacMontoBienesServicios") {
          next.pacMontoObras = calcularPacObras(next.pacMontoTotal, next.pacMontoBienesServicios);
        }
        return next;
      });
      if (touched[name]) validateField(name, value);
    },
    [touched, validateField],
  );

  const handleBlur = useCallback(
    (name: keyof FormState) => {
      setTouched((prev) => ({ ...prev, [name]: true }));
      validateField(name, formData[name] ?? "");
    },
    [formData, validateField],
  );

  // Resumen en vivo del PAC: la linea de corte que se muestra aqui es la del
  // caso "contratacion ya programada" (10% del PAC sin sumar nada). Cuando el
  // requerimiento no esta en el PAC, el expediente recalcula sumando su monto.
  // Tope del contrato menor en vivo. Se enseña aquí porque quien registra la UIT
  // no tiene por qué saber de memoria que son 8 UIT ni cuánto suman.
  const umbralResumen = useMemo(() => {
    const umbral = umbralContratoMenor(parseMonto(formData.uitValor));
    return umbral === null ? null : soles(umbral);
  }, [formData.uitValor]);

  // Rango de la LP abreviada para bienes, en vivo. Solo cuando ambos extremos son
  // coherentes (máximo ≥ mínimo); si no, no se muestra.
  const lpAbreviadaResumen = useMemo(() => {
    const min = parseMonto(formData.lpAbreviadaBienesMin);
    const max = parseMonto(formData.lpAbreviadaBienesMax);
    if (min === null || max === null || min <= 0 || max < min) return null;
    return `${soles(min)} – ${soles(max)}`;
  }, [formData.lpAbreviadaBienesMin, formData.lpAbreviadaBienesMax]);

  const pacResumen = useMemo(() => {
    const bienesServicios = parseMonto(formData.pacMontoBienesServicios);
    if (bienesServicios === null || bienesServicios <= 0) return null;
    const total = parseMonto(formData.pacMontoTotal);
    const obras = calcularPacObras(formData.pacMontoTotal, formData.pacMontoBienesServicios);
    return {
      // Ya no puede haber descuadre —obras es el resto—, pero sí una captura
      // imposible: bienes y servicios por encima del total.
      excede: total !== null && bienesServicios > total,
      lineaCorte: soles(Math.round(bienesServicios * PORCENTAJE_LINEA_CORTE * 100) / 100),
      obras: obras === "" ? "" : soles(Number(obras)),
      total: total === null ? "" : soles(total),
    };
  }, [formData.pacMontoBienesServicios, formData.pacMontoTotal]);

  // Cómo quedará la cita en los informes exportados. Estos campos no se leen en
  // el formulario: se leen impresos, y así se comprueba antes de exportar.
  const citasResoluciones = useMemo(() => {
    const cita = (numero: string | undefined, fecha: string | undefined) => {
      const n = (numero ?? "").trim();
      if (!n) return "";
      const f = fechaES(fecha);
      return f ? `${n}, del ${f}` : n;
    };
    return [
      { clave: "pia", etiqueta: "PIA", texto: cita(formData.piaResolutionNumber, formData.piaResolutionDate) },
      { clave: "pac", etiqueta: "PAC", texto: cita(formData.pacResolutionNumber, formData.pacResolutionDate) },
    ].filter((c) => c.texto !== "");
  }, [
    formData.pacResolutionDate,
    formData.pacResolutionNumber,
    formData.piaResolutionDate,
    formData.piaResolutionNumber,
  ]);

  const avisosResol = useMemo(
    () =>
      avisosResoluciones({
        ejercicio: formData.pacAnio,
        pacFecha: formData.pacResolutionDate,
        pacNumero: formData.pacResolutionNumber,
        piaFecha: formData.piaResolutionDate,
        piaNumero: formData.piaResolutionNumber,
      }),
    [
      formData.pacAnio,
      formData.pacResolutionDate,
      formData.pacResolutionNumber,
      formData.piaResolutionDate,
      formData.piaResolutionNumber,
    ],
  );

  // Mismo criterio que la barra lateral (isEntityComplete), desde la fuente única.
  const checklist = useMemo(() => entityChecklist(formData), [formData]);
  const complete = checklist.every((item) => item.done);
  const progress = checklist.filter((item) => item.done).length;
  const today = new Date().toLocaleDateString("es-PE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const hasFieldError = (name: keyof FormState) => Boolean(errors[name] && touched[name]);

  /** Lleva la vista al campo y lo enfoca (usado por el checklist como índice). */
  function irACampo(campo: string) {
    const destino = document.querySelector<HTMLElement>(`[data-campo-entidad="${campo}"]`);
    if (!destino) return;
    destino.scrollIntoView({ behavior: "smooth", block: "center" });
    destino.querySelector<HTMLElement>("input, select, textarea, button")?.focus();
  }

  // Estado del guardado para el indicador unico del pie.
  const saveStatus: "saving" | "error" | "dirty" | "saved" | "idle" = saving
    ? "saving"
    : saveError
      ? "error"
      : isDirty
        ? "dirty"
        : lastSaved
          ? "saved"
          : "idle";

  const campo = (
    name: keyof FormState,
    label: string,
    opts: {
      placeholder?: string;
      hint?: string;
      required?: boolean;
      inputMode?: "text" | "numeric";
      type?: string;
      maxDigits?: number;
      full?: boolean;
      moneda?: boolean;
    } = {},
  ) => (
    <label className={`flex flex-col gap-1${opts.full ? " col-span-2" : ""}`} data-campo-entidad={name}>
      <span className="text-xs font-semibold text-muted">
        {label}
        {opts.required ? <em className="font-normal text-xs text-muted/60 not-italic ml-1">obligatorio</em> : null}
      </span>
      <div className={opts.moneda ? "flex items-stretch w-full" : undefined}>
        {opts.moneda ? <span aria-hidden="true" className="flex items-center px-2 border border-line border-r-0 rounded-l-md bg-surface text-xs text-muted font-semibold select-none">S/</span> : null}
        <input
          className={`${inputBase}${opts.moneda ? " rounded-r-md text-right tabular-nums" : " rounded-md"}`}
          type={opts.type ?? "text"}
          value={formData[name] ?? ""}
          placeholder={opts.placeholder}
          aria-invalid={hasFieldError(name) || undefined}
          aria-describedby={hasFieldError(name) ? `err-${name}` : undefined}
          inputMode={opts.moneda ? "decimal" : opts.inputMode}
          onChange={(e) => {
            if (!opts.moneda) {
              handleChange(
                name,
                opts.maxDigits ? onlyDigits(e.target.value, opts.maxDigits) : e.target.value,
              );
              return;
            }
            const input = e.currentTarget;
            const digitosAntes = input.value
              .slice(0, input.selectionStart ?? input.value.length)
              .replace(/\D/g, "").length;
            const formateado = formatearImporte(input.value);
            handleChange(name, formateado);
            requestAnimationFrame(() => {
              const pos = posicionTrasDigitos(formateado, digitosAntes);
              input.setSelectionRange(pos, pos);
            });
          }}
          onBlur={() => handleBlur(name)}
        />
      </div>
      {hasFieldError(name) ? (
        <small className="text-xs font-semibold text-red-600" id={`err-${name}`} role="alert">
          {errors[name]}
        </small>
      ) : opts.hint ? (
        <small className="text-xs text-muted/70">{opts.hint}</small>
      ) : null}
    </label>
  );

  const degreeIsPreset = DEGREE_OPTIONS.includes(
    formData.managerDegree as (typeof DEGREE_OPTIONS)[number],
  );

  const previewDl = (
    <dl className="flex flex-col gap-y-1.5 m-0">
      <Dato k="Entidad" v={formData.name} />
      <Dato k="RUC" v={formData.ruc} />
      <Dato k="Unidad ejecutora" v={formData.executingUnit} />
      <Dato k="Departamento" v={formData.department} />
      <Dato k="Provincia" v={formData.province} />
      <Dato k="Ciudad" v={formData.city} />
      <Dato k="Dirección" v={formData.address} />
      <Dato
        k="Nivel de gobierno"
        v={levels.find((l) => l.value === formData.governmentLevel)?.label ?? ""}
      />
      <Dato
        k="Gerente"
        v={
          formData.managerDegree || formData.managerFullName
            ? `${(formData.managerDegree ?? "").trim()} ${formData.managerFullName ?? ""}`.trim()
            : ""
        }
      />
      <Dato k="DNI del gerente" v={formData.managerDni} />
      <Dato
        k="Designación"
        v={formData.managerResolutionNumber ? `R.A. Nro. ${formData.managerResolutionNumber}` : ""}
      />
      <Dato
        k="AGA"
        v={
          formData.agaDegree || formData.agaFullName
            ? `${(formData.agaDegree ?? "").trim()} ${formData.agaFullName ?? ""}`.trim()
            : ""
        }
      />
      <Dato k="Cargo del AGA" v={formData.agaPosition} />
      <Dato
        k="Designación del AGA"
        v={formData.agaResolutionNumber ? `R.A. Nro. ${formData.agaResolutionNumber}` : ""}
      />
    </dl>
  );

  return (
    <div className="tw flex flex-col gap-4">

      {/* ── Header ─────────────────────────────── */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <p className="text-sm text-muted leading-relaxed max-w-[68ch] m-0">
          Completa los datos de tu entidad. Se guardan solos mientras escribes; el
          contador de la derecha muestra cuántos campos clave faltan.
        </p>
        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap ${
          complete ? "bg-success-soft text-success" : "bg-warning-soft text-warning"
        }`}>
          {complete ? "Perfil completo" : `${progress} de ${checklist.length} campos`}
        </span>
      </div>

      {/* ── Checklist ───────────────────────────── */}
      <div className="border border-line rounded-lg bg-panel p-4">
        <div className="flex items-center gap-1.5 text-sm font-semibold text-ink mb-3">
          <CheckCircle2 size={14} /> Completa el perfil ({progress}/{checklist.length})
        </div>
        <div className="h-1.5 rounded-full bg-line overflow-hidden mb-3" aria-hidden="true">
          <div
            className="h-full rounded-full bg-brand transition-all"
            style={{ width: `${(progress / checklist.length) * 100}%` }}
          />
        </div>
        <ul className="grid gap-1.5 m-0 p-0 list-none">
          {checklist.map((item) => (
            <li key={item.label}>
              <button
                data-done={item.done}
                onClick={() => irACampo(item.campo)}
                title={item.done ? `${item.label} — completo` : `Ir a ${item.label}`}
                type="button"
                className={`flex items-center gap-2 text-sm cursor-pointer border-0 bg-transparent p-0 ${item.done ? "text-success" : "text-muted hover:text-ink"}`}
              >
                <CheckCircle2 size={14} />
                <span>{item.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* ── Navegación por anclas ───────────────── */}
      <nav className="sticky top-4 z-10 flex gap-1 overflow-x-auto pb-2 border-b border-line">
        {SECCIONES.map(sec => (
          <a
            key={sec.id}
            href={`#${sec.id}`}
            onClick={(e) => { e.preventDefault(); document.getElementById(sec.id)?.scrollIntoView({ behavior: 'smooth' }); }}
            className={`whitespace-nowrap px-3 py-1.5 text-xs rounded-md transition-colors ${
              activeSection === sec.id
                ? 'bg-brand text-white'
                : 'text-muted hover:bg-surface'
            }`}
          >
            {sec.label}
          </a>
        ))}
      </nav>

      {/* ── Grid: formulario + sidebar preview ──── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">

        {/* Columna principal — formulario */}
        <div className="flex flex-col gap-4">

          {/* ── Card: Datos de la entidad ────────── */}
          <section id="datos" data-section="datos" className="border border-line rounded-lg bg-panel p-4">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink mb-3">
              <Building2 size={14} /> Datos de la entidad
            </h2>
            <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
              {campo("name", "Nombre de la entidad", {
                placeholder: "Ej. Municipalidad Distrital de...",
                hint: "Nombre oficial que aparecerá en documentos",
                required: true,
                full: true,
              })}
              {campo("ruc", "RUC", {
                placeholder: "11 dígitos",
                inputMode: "numeric",
                maxDigits: 11,
                required: true,
                hint: `${formData.ruc.length}/11 dígitos`,
              })}
              {campo("executingUnit", "Unidad ejecutora", {
                placeholder: "6 dígitos",
                inputMode: "numeric",
                maxDigits: 6,
                required: true,
                hint: `${formData.executingUnit.length}/6 dígitos`,
              })}
              {campo("department", "Departamento", {
                placeholder: "Ej. Apurímac",
              })}
              {campo("province", "Provincia", {
                placeholder: "Ej. Cotabambas",
              })}
              {campo("city", "Ciudad", {
                placeholder: "Ej. Challhuahuacho",
                hint: `Encabeza los documentos: "${(formData.city ?? "").trim() || "Ciudad"}, ${today}"`,
                full: true,
              })}
              {campo("address", "Dirección de la entidad", {
                placeholder: "Dirección fiscal o sede principal",
                required: true,
                full: true,
              })}
            </div>
          </section>

          {/* ── Card: Tipo de gobierno ───────────── */}
          <section id="gobierno" data-section="gobierno" className="border border-line rounded-lg bg-panel p-4">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink mb-3">
              <Landmark size={14} /> Tipo de gobierno
            </h2>
            <div
              role="radiogroup"
              aria-label="Tipo de gobierno"
              aria-invalid={hasFieldError("governmentLevel") || undefined}
              data-campo-entidad="governmentLevel"
              className="grid grid-cols-1 gap-2 sm:grid-cols-3"
            >
              {levels.map((level) => {
                const selected = formData.governmentLevel === level.value;
                return (
                  <button
                    key={level.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => handleChange("governmentLevel", level.value)}
                    className={`flex flex-col gap-0.5 p-3 rounded-lg border text-left cursor-pointer font-inherit transition-colors ${
                      selected
                        ? "border-brand/35 bg-brand-soft"
                        : "border-line bg-white hover:border-brand/20"
                    }`}
                  >
                    <strong className={`text-sm font-semibold ${selected ? "text-brand-dark" : "text-ink"}`}>
                      {level.label}
                    </strong>
                    <small className="text-xs text-muted leading-snug">
                      {level.examples}
                    </small>
                  </button>
                );
              })}
            </div>
            {hasFieldError("governmentLevel") ? (
              <small className="text-xs font-semibold text-red-600 block mt-2" role="alert">
                {errors.governmentLevel}
              </small>
            ) : (
              <small className="text-xs text-muted/80 block mt-2">
                Identifica el ámbito institucional en reportes, expedientes y auditoría.
              </small>
            )}
          </section>

          {/* ── Card: Gerente municipal ──────────── */}
          <section id="gerente" data-section="gerente" className="border border-line rounded-lg bg-panel p-4">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink mb-3">
              <User size={14} /> Gerente de la entidad
            </h2>
            <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-muted">Grado / Título profesional</span>
                <select
                  className="w-full px-2.5 py-2 rounded-md border border-line text-sm bg-white outline-none focus:border-brand focus:shadow-[0_0_0_2px_rgba(15,118,110,0.12)]"
                  value={degreeIsPreset ? formData.managerDegree : formData.managerDegree ? "__otro__" : ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "__otro__") handleChange("managerDegree", " ");
                    else handleChange("managerDegree", val);
                  }}
                  onBlur={() => handleBlur("managerDegree")}
                >
                  <option value="">Seleccionar...</option>
                  {DEGREE_OPTIONS.map((deg) => (
                    <option key={deg} value={deg}>
                      {deg}
                    </option>
                  ))}
                  <option value="__otro__">Otro</option>
                </select>
                {!degreeIsPreset && formData.managerDegree ? (
                  <input
                    placeholder="Ej. MBA., PH.D."
                    value={formData.managerDegree.trim()}
                    onChange={(e) => handleChange("managerDegree", e.target.value)}
                    onBlur={() => handleBlur("managerDegree")}
                    className="w-full px-2.5 py-2 rounded-md border border-line text-sm bg-white outline-none placeholder:text-slate-400 focus:border-brand focus:shadow-[0_0_0_2px_rgba(15,118,110,0.12)]"
                  />
                ) : null}
              </label>
              {campo("managerFullName", "Nombre completo", {
                placeholder: "Nombres y apellidos completos",
              })}
              {campo("managerDni", "DNI", {
                placeholder: "8 dígitos",
                inputMode: "numeric",
                maxDigits: 8,
                hint: `${(formData.managerDni ?? "").length}/8 dígitos`,
              })}
              {campo("managerPosition", "Cargo", { placeholder: "Gerente General" })}
              {campo("managerResolutionNumber", "Resolución de Alcaldía Nro.", {
                placeholder: "Ej. 123-2026-MDCH/A",
              })}
              {campo("managerResolutionDate", "Fecha de la Resolución", { type: "date" })}
            </div>
          </section>

          {/* ── Card: Autoridad de gestión administrativa (AGA) ── */}
          <section id="aga" data-section="aga" className="border border-line rounded-lg bg-panel p-4">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink mb-1.5">
              <User size={14} /> Autoridad de gestión administrativa (AGA)
            </h2>
            <p className="text-sm text-muted leading-relaxed m-0 mb-3">
              La más alta autoridad de la gestión administrativa: <strong>aprueba, autoriza y supervisa</strong>{" "}
              las contrataciones y aprueba el expediente (Ley 32069, Art. 25.1.b; Reglamento, Art. 19; Art. 54.2).
              En una municipalidad suele ser el gerente municipal; regístrala aquí aunque coincida.
            </p>
            <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
              {campo("agaDegree", "Grado / Título profesional", { placeholder: "Ej. CPC., ING., ABOG." })}
              {campo("agaFullName", "Nombre completo", { placeholder: "Nombres y apellidos completos" })}
              {campo("agaDni", "DNI", {
                placeholder: "8 dígitos",
                inputMode: "numeric",
                maxDigits: 8,
                hint: `${(formData.agaDni ?? "").length}/8 dígitos`,
              })}
              {campo("agaPosition", "Cargo", { placeholder: "Ej. Gerente Municipal" })}
              {campo("agaResolutionNumber", "Resolución de designación Nro.", { placeholder: "Ej. 123-2026-MDCH/A" })}
              {campo("agaResolutionDate", "Fecha de la Resolución", { type: "date" })}
            </div>
          </section>

          {/* ── Card: PAC y montos ───────────────── */}
          <section id="pac" data-section="pac" className="border border-line rounded-lg bg-panel p-4">
            <div className="flex flex-col gap-6">

              {/* Bloque: Resoluciones PIA/PAC */}
              <div className="flex flex-col gap-3">
                <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                  <Wallet size={14} /> Resoluciones del PIA y PAC
                </h2>
                <p className="text-sm text-muted leading-relaxed m-0">
                  Se citan <strong>literalmente</strong> como antecedente en los informes que se
                  exportan y se firman. Se registran una vez por ejercicio.
                </p>
                <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-3 max-sm:grid-cols-1">
                  {campo("piaResolutionNumber", "Resolución que aprueba el PIA", {
                    hint: "Tipo y número completos, tal como se citarán.",
                    placeholder: "Ej. Resolución de Alcaldía N° 238-2025-MDP/ALC",
                  })}
                  {campo("piaResolutionDate", "Fecha de la Resolución del PIA", { type: "date" })}
                  {campo("pacResolutionNumber", "Resolución que aprueba el PAC", {
                    hint: "Documento de aprobación: resolución, memorando u otro.",
                    placeholder: "Ej. Resolución de Gerencia Municipal N° 007-2026-MDP/GM",
                  })}
                  {campo("pacResolutionDate", "Fecha de la Resolución del PAC", { type: "date" })}
                  <div className="col-start-2 max-sm:col-start-1">
                    {campo("pacAnio", "Ejercicio fiscal", {
                      placeholder: "2026",
                      inputMode: "numeric",
                      maxDigits: 4,
                    })}
                  </div>
                </div>

                {citasResoluciones.length > 0 ? (
                  <div className="p-3 rounded-lg border border-line/60 bg-surface">
                    <span className="text-xs font-semibold text-muted block mb-2">Se citará así en los informes</span>
                    {citasResoluciones.map((c) => (
                      <p key={c.clave} className="text-sm text-ink m-0 mb-1 last:mb-0">
                        <strong>{c.etiqueta}:</strong> {c.texto}
                      </p>
                    ))}
                  </div>
                ) : null}

                {avisosResol.map((a) => (
                  <p key={a.texto} className={`flex items-center gap-1.5 px-2.5 py-2 rounded-md border text-xs leading-snug m-0 ${
                    a.tono === "error"
                      ? "bg-danger-soft border-danger/30 text-danger"
                      : "bg-warning-soft border-warning/30 text-warning"
                  }`}>
                    <AlertTriangle size={13} className="shrink-0" /> {a.texto}
                  </p>
                ))}
              </div>

              {/* Bloque: umbral destacado */}
              {umbralResumen !== null ? (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm font-medium text-blue-800">
                    Umbral del contrato menor: <strong>{umbralResumen}</strong>
                  </p>
                  <p className="text-xs text-blue-600 mt-1">
                    Contrataciones cuya cuantía de la contratación no supere este monto pueden agruparse por ítems (8 UIT - Ley 32069, Art. 34.1).
                  </p>
                </div>
              ) : null}

              {/* Bloque: Montos PAC */}
              <div className="flex flex-col gap-3">
                <h3 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                  <Wallet size={14} /> Montos del PAC — línea de corte (Art. 125)
                </h3>
                <p className="text-sm text-muted leading-relaxed m-0">
                  Registra el monto total del PAC y la parte de bienes y servicios. El PAC de obras y
                  la línea de corte se calculan solos.
                </p>
                <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
                  {campo("pacMontoTotal", "Monto total del PAC (S/)", { moneda: true, placeholder: "6,099,061.68" })}
                  {campo("pacMontoBienesServicios", "PAC bienes y servicios (S/) — base del 10%", {
                    moneda: true,
                    placeholder: "1,226,465.70",
                    hint: "Incluye bienes, servicios, no competitivos y CEAM del PAC (Guía).",
                  })}
                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-semibold text-muted">PAC obras (S/)</span>
                    <div className="flex items-stretch w-full">
                      <span aria-hidden="true" className="flex items-center px-2 border border-line border-r-0 rounded-l-md bg-surface text-muted text-xs font-semibold select-none">S/</span>
                      <input
                        readOnly
                        tabIndex={-1}
                        value={pacResumen?.obras ?? ""}
                        placeholder="Se calcula: total − bienes y servicios"
                        className="w-full px-2.5 py-2 border border-line text-sm bg-surface/50 outline-none rounded-r-md text-right tabular-nums"
                      />
                    </div>
                    <small className="text-xs text-muted/70">
                      Se calcula restando: monto total del PAC − PAC de bienes y servicios.
                    </small>
                  </label>
                </div>

                {pacResumen ? (
                  <div className="p-3 rounded-lg border border-line/60 bg-surface">
                    <strong className="block text-sm font-semibold text-ink mb-1.5">
                      Línea de corte por cuantía: {pacResumen.lineaCorte}
                    </strong>
                    <div className="text-xs text-muted leading-relaxed">
                      10% del PAC de bienes y servicios. Toda contratación por encima de ese monto es
                      de <em>alta cuantía</em> (Art. 125.2). Es una referencia: cada expediente
                      recalcula la línea sumando las no programadas ya convocadas, las otras que se
                      segmenten a la vez y la propia contratación si no está programada.
                    </div>
                    {pacResumen.excede ? (
                      <div className="mt-2 p-2.5 rounded-md bg-warning-soft border border-warning/30 text-xs text-warning">
                        Revisa las cifras: el PAC de bienes y servicios supera el monto total del PAC
                        ({pacResumen.total}), así que el PAC de obras saldría negativo. Mientras no
                        cuadren, el PAC de obras se deja sin registrar.
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>

              {/* Bloque: UIT */}
              <div className="flex flex-col gap-3">
                <h3 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                  <Wallet size={14} /> UIT del ejercicio — tope del contrato menor
                </h3>
                <p className="text-sm text-muted leading-relaxed m-0">
                  La norma expresa las cuantías en UIT. De este valor sale el tope del contrato menor,
                  que decide si un requerimiento puede convocarse por ítems, lotes o tramos.
                </p>
                <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
                  {campo("uitValor", "Valor de la UIT (S/)", {
                    moneda: true,
                    placeholder: "5,350.00",
                    hint: "El vigente al momento de la contratación (Ley 32069, Art. 34.1).",
                  })}
                  {campo("uitAnio", "Ejercicio de la UIT", {
                    placeholder: "2026",
                    inputMode: "numeric",
                    maxDigits: 4,
                  })}
                </div>

                {umbralResumen ? (
                  <div className="p-3 rounded-lg border border-line/60 bg-surface">
                    <strong className="block text-sm font-semibold text-ink mb-1.5">
                      Tope del contrato menor: {umbralResumen}
                    </strong>
                    <div className="text-xs text-muted leading-relaxed">
                      8 UIT. Son contratos menores los de monto <em>igual o inferior</em> a esa cifra
                      (Ley 32069, Art. 34.1) y no requieren procedimiento de selección. Por eso un
                      requerimiento solo puede convocarse por ítems, lotes o tramos si{" "}
                      <strong>cada uno supera ese tope</strong> (Reglamento, Art. 52.1.b): en el importe
                      exacto todavía es contrato menor.
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Bloque: Licitación Pública abreviada para bienes */}
              <div className="flex flex-col gap-3">
                <h3 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                  <Wallet size={14} /> Licitación Pública abreviada para bienes — rango de cuantía
                </h3>
                <p className="text-sm text-muted leading-relaxed m-0">
                  El umbral de la modalidad abreviada no está en la norma publicada (los Arts. 93-95
                  remiten a una tabla web). Regístralo aquí: se usa para saber qué ítems de un
                  requerimiento por relación de ítems caen en esa banda y redactar su experiencia por ítem.
                </p>
                <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
                  {campo("lpAbreviadaBienesMin", "Cuantía mínima (S/)", {
                    moneda: true,
                    placeholder: "500,000.00",
                  })}
                  {campo("lpAbreviadaBienesMax", "Cuantía máxima (S/)", {
                    moneda: true,
                    placeholder: "5,000,000.00",
                  })}
                  {campo("lpAbreviadaBienesAnio", "Ejercicio del rango", {
                    placeholder: "2026",
                    inputMode: "numeric",
                    maxDigits: 4,
                  })}
                </div>

                {lpAbreviadaResumen ? (
                  <div className="p-3 rounded-lg border border-line/60 bg-surface">
                    <strong className="block text-sm font-semibold text-ink mb-1.5">
                      Rango de la LP abreviada para bienes: {lpAbreviadaResumen}
                    </strong>
                    <div className="text-xs text-muted leading-relaxed">
                      Un ítem cuya cuantía cae dentro de este rango corresponde a una Licitación Pública
                      abreviada de bienes. Por encima del máximo es Licitación Pública plena.
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Bloque: Topes de procedimiento por cuantía (año fiscal) */}
              <div className="flex flex-col gap-3">
                <h3 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                  <Wallet size={14} /> Topes de procedimiento por cuantía — Año fiscal
                </h3>
                <p className="text-sm text-muted leading-relaxed m-0">
                  Importes de la tabla anual DSEACE-OECE (Arts. 93-95 del Reglamento) que deciden el
                  procedimiento según la cuantía. No están en la norma publicada; se registran por año.
                  Si los dejas vacíos, la app usa los valores 2026.
                </p>
                <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
                  {campo("topeAnio", "Ejercicio de los topes", {
                    placeholder: "2026",
                    inputMode: "numeric",
                    maxDigits: 4,
                  })}
                  {campo("topePiso", "Piso — contrato menor (S/)", { moneda: true, placeholder: "44,000.00" })}
                  {campo("topeLicitacionConcurso", "Frontera Licitación/Concurso (S/)", {
                    moneda: true,
                    placeholder: "485,000.00",
                  })}
                  {campo("topeLicitacionObras", "Licitación Pública de obras (S/)", {
                    moneda: true,
                    placeholder: "5,000,000.00",
                  })}
                  {campo("topeComparacionPrecios", "Techo Comparación de Precios (S/)", {
                    moneda: true,
                    placeholder: "100,000.00",
                  })}
                </div>
                <div className="text-xs text-muted leading-relaxed">
                  Bienes/servicios ≥ frontera → Licitación/Concurso Público; entre el piso y la frontera →
                  su modalidad Abreviada; ≤ techo → cabe Comparación de Precios. Obras ≥ su umbral →
                  Licitación Pública; por debajo, abreviada de obras.
                </div>
              </div>

            </div>
          </section>

          {/* ── Mobile: toggle vista previa ──────── */}
          <div className="lg:hidden">
            <button
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 border border-dashed border-line rounded-lg bg-surface text-sm text-muted hover:text-ink hover:border-brand transition-colors"
              onClick={() => setShowPreview(!showPreview)}
              type="button"
            >
              {showPreview ? "Ocultar" : "Mostrar"} vista previa
            </button>
            {showPreview && (
              <div id="preview" data-section="preview" className="mt-3 border border-line rounded-lg bg-panel p-4">
                <div className="flex items-center gap-1.5 text-sm font-semibold text-ink mb-3">
                  <Building2 size={14} /> Vista previa — cómo se verá en los documentos
                </div>
                {previewDl}
              </div>
            )}
          </div>

        </div>

        {/* ── Sidebar desktop: vista previa ─────── */}
        <aside className="sticky top-20 self-start hidden lg:block" data-section="preview">
          <div className="border border-line rounded-lg bg-panel p-4">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-muted uppercase tracking-wider mb-3">
              <Building2 size={12} /> Vista previa
            </div>
            {previewDl}
          </div>
        </aside>

      </div>

      {/* ── Barra de guardado ───────────────────── */}
      <div className="flex items-center gap-3 py-3 border-t border-line">
        <button
          className="inline-flex items-center justify-center gap-2 min-h-[42px] px-4 font-bold text-white bg-brand border-0 rounded-lg cursor-pointer hover:bg-brand-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          type="button"
          onClick={() => persist("manual")}
          disabled={saving || !isDirty}
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}{" "}
          {saving ? "Guardando..." : isDirty ? "Guardar cambios" : "Guardado"}
        </button>
        <SaveStatus
          status={saveStatus}
          message={
            saveStatus === "saved" && lastSaved
              ? `Todo guardado - ${lastSaved.toLocaleTimeString("es-PE")}`
              : undefined
          }
        />
        {isDirty ? (
          <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap bg-warning-soft text-warning ml-auto">
            <AlertTriangle size={12} aria-hidden /> Sin guardar
          </span>
        ) : null}
      </div>

    </div>
  );
}

function Dato({ k, v }: { k: string; v: string | null | undefined }) {
  const valor = (v ?? "").trim();
  return (
    <div className="grid grid-cols-[minmax(100px,auto)_1fr] gap-x-2.5 py-0.5">
      <dt className="text-xs font-semibold text-muted leading-snug">
        {k}
      </dt>
      <dd className={`text-sm text-ink m-0 ${valor ? "" : "text-muted/55"}`}>
        {valor || "—"}
      </dd>
    </div>
  );
}


