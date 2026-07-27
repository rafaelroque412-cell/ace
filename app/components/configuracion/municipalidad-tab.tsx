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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
// zod/mini: MISMA validacion, pero con API funcional y arbol podable. El zod
// completo entra entero en el paquete del navegador aunque solo se usen diez
// comprobaciones, y aqui era la MITAD del peso de /configuracion. Diferirlo no
// servia: municipalidad es la pestaña de inicio. `.shape`, `safeParse` y los
// mensajes propios se comportan igual (comprobado antes de convertir).
import * as z from "zod/mini";
import {
  type EntitySettings,
  type GovernmentLevel,
  DEGREE_OPTIONS,
  entityChecklist,
  onlyDigits,
  parseMonto,
} from "@/lib/configuracion-types";
import { fechaES } from "@/lib/fecha-es";
import { PORCENTAJE_LINEA_CORTE, soles } from "@/lib/segmentacion-parametros";
import { umbralContratoMenor } from "@/lib/umbral-contrato-menor";
import { useToastHelpers } from "@/lib/toast";
import { useYear } from "@/lib/year-context";
import { olvidarCatalogo } from "@/lib/settings-catalog-cache";

// Monto escrito a mano: se acepta "S/ 1'226,465.70" o "1226465.70". Vacio es
// valido (el PAC puede registrarse mas tarde).
/**
 * PAC de obras = monto total del PAC − PAC de bienes y servicios.
 *
 * Se calcula en vez de pedirse: el PAC se reparte entre esos dos bloques, así
 * que escribir los tres a mano solo abre la puerta a que no cuadren. Antes se
 * pedían los tres y la única defensa era un aviso de descuadre que nadie estaba
 * obligado a resolver.
 *
 * Devuelve "" cuando falta algún dato o cuando bienes y servicios excede el
 * total: un PAC de obras negativo no es un dato, es un error de captura, y se
 * señala como tal en vez de guardarse.
 */
export function calcularPacObras(total: string | undefined, bienesServicios: string | undefined): string {
  const t = parseMonto(total ?? "");
  const bs = parseMonto(bienesServicios ?? "");
  if (t === null || bs === null) return "";
  const obras = Math.round((t - bs) * 100) / 100;
  return obras < 0 ? "" : String(obras);
}

/**
 * Deja en un importe solo lo que puede formar parte de una cifra en soles.
 *
 * No se usa `<input type="number">`: rechaza el formato en que el PAC se
 * publica ("S/ 1'226,465.70"), muestra flechas que alteran el importe con la
 * rueda del ratón y en varios navegadores deja escribir "e" y signos. Se filtra
 * la entrada y se marca `inputMode="decimal"` para que el móvil abra el teclado
 * numérico.
 */
export function soloImporte(value: string): string {
  const limpio = value.replace(/[^\d.,]/g, "");
  // Un único separador decimal: el primer punto manda, el resto se descarta.
  const partes = limpio.split(".");
  return partes.length <= 2 ? limpio : `${partes[0]}.${partes.slice(1).join("")}`;
}

/**
 * Da formato de importe a lo tecleado: separador de miles y hasta dos
 * decimales. "1226465.7" → "1,226,465.7".
 *
 * Se formatea MIENTRAS se escribe y no al salir del campo porque el PAC son
 * cifras de siete u ocho dígitos: sin separadores no se distingue un millón de
 * diez, y ese número decide la línea de corte del Art. 125.2.
 *
 * El punto final se conserva ("1226465." → "1,226,465.") o no se podría llegar
 * a escribir un decimal: desaparecería en cuanto se teclea.
 */
export function formatearImporte(raw: string): string {
  const limpio = soloImporte(raw);
  if (limpio === "") return "";
  const [enteroRaw = "", decimal] = limpio.replace(/,/g, "").split(".");
  // Ceros a la izquierda fuera, salvo que el entero sea solo "0".
  const entero = enteroRaw.replace(/^0+(?=\d)/, "");
  const conMiles = entero.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  if (decimal === undefined) return limpio.endsWith(".") ? `${conMiles}.` : conMiles;
  // El céntimo es la unidad mínima del PAC: más decimales no son un dato.
  return `${conMiles}.${decimal.slice(0, 2)}`;
}

/**
 * Posición del cursor tras `digitos` dígitos del texto ya formateado.
 *
 * Al insertar separadores el texto crece por la izquierda del cursor y, sin
 * esto, saltaría al final: escribir en medio de una cifra se volvería
 * imposible. Se cuenta por DÍGITOS porque son lo único que el formateo no
 * mueve.
 */
export function posicionTrasDigitos(texto: string, digitos: number): number {
  if (digitos <= 0) return 0;
  let vistos = 0;
  for (let i = 0; i < texto.length; i += 1) {
    if (/\d/.test(texto[i])) vistos += 1;
    if (vistos === digitos) return i + 1;
  }
  return texto.length;
}

/**
 * ¿El valor conserva texto de la plantilla en vez del dato real?
 *
 * Estos campos se citan LITERALMENTE como antecedente en los informes que se
 * exportan y se firman. Un "(MODELO — reemplazar)" que nadie quitó acaba
 * impreso en un documento oficial, y ahí ya no hay quien lo explique.
 */
export function pareceTextoDePlantilla(valor: string): boolean {
  const v = (valor ?? "").toLowerCase();
  if (!v.trim()) return false;
  // Con límites de palabra: "modelo" suelto es texto de plantilla, pero no
  // debe saltar dentro de una palabra legítima del nombre del documento.
  return /\bmodelo\b|reemplaz|\[[^\]]*\]|\bx{3,}\b|\bejemplo\b|\bcompletar\b/.test(v);
}

/** Año de una fecha ISO, o null si no la hay. */
function anioDeFecha(fecha: string | undefined): number | null {
  const m = (fecha ?? "").match(/^(\d{4})-/);
  return m ? Number(m[1]) : null;
}

export type AvisoResolucion = { tono: "error" | "aviso"; texto: string };

/**
 * Incoherencias entre las dos resoluciones y el ejercicio fiscal.
 *
 * Ninguna bloquea el guardado: son datos que la entidad conoce mejor que una
 * regla, y un PAC aprobado en diciembre del año anterior es lo normal. Se
 * avisa para que nadie descubra el desajuste cuando el informe ya está firmado.
 */
export function avisosResoluciones(d: {
  piaNumero?: string;
  piaFecha?: string;
  pacNumero?: string;
  pacFecha?: string;
  ejercicio?: string;
}): AvisoResolucion[] {
  const out: AvisoResolucion[] = [];

  if (pareceTextoDePlantilla(d.piaNumero ?? "")) {
    out.push({ tono: "error", texto: "La resolución del PIA conserva texto de la plantilla: reemplázalo por el documento real." });
  }
  if (pareceTextoDePlantilla(d.pacNumero ?? "")) {
    out.push({ tono: "error", texto: "La resolución del PAC conserva texto de la plantilla: reemplázalo por el documento real." });
  }

  // El PAC se elabora a partir del PIA: aprobarlo antes no encaja.
  if (d.piaFecha && d.pacFecha && d.pacFecha < d.piaFecha) {
    out.push({ tono: "aviso", texto: "La resolución del PAC es anterior a la del PIA. Revisa las fechas: el PAC se elabora a partir del presupuesto aprobado." });
  }

  // El PAC del ejercicio se aprueba en ese año o en diciembre del anterior.
  const ejercicio = Number(d.ejercicio);
  const anioPac = anioDeFecha(d.pacFecha);
  if (Number.isFinite(ejercicio) && ejercicio > 0 && anioPac !== null && anioPac !== ejercicio && anioPac !== ejercicio - 1) {
    out.push({ tono: "aviso", texto: `La resolución del PAC es del ${anioPac} y el ejercicio registrado es ${ejercicio}. Comprueba cuál de los dos datos corresponde.` });
  }

  return out;
}

const montoSchema = z.optional(
  z.union([
    z.string().check(z.trim(), z.maxLength(30), z.refine((v) => v === "" || parseMonto(v) !== null, "Monto invalido")),
    z.literal(""),
  ]),
);

const entitySchema = z.object({
  name: z.string().check(z.trim(), z.minLength(3, "Minimo 3 caracteres"), z.maxLength(180)),
  ruc: z.string().check(z.trim(), z.regex(/^\d{11}$/, "El RUC debe tener 11 digitos")),
  executingUnit: z.string().check(z.trim(), z.regex(/^\d{6}$/, "La unidad ejecutora debe tener 6 digitos")),
  address: z.string().check(z.trim(), z.minLength(5, "Minimo 5 caracteres"), z.maxLength(260)),
  city: z.optional(z.union([z.string().check(z.trim(), z.minLength(2, "Minimo 2 caracteres"), z.maxLength(120)), z.literal("")])),
  department: z.optional(z.union([z.string().check(z.trim(), z.maxLength(120)), z.literal("")])),
  province: z.optional(z.union([z.string().check(z.trim(), z.maxLength(120)), z.literal("")])),
  governmentLevel: z.enum(["gobierno_nacional", "gobierno_regional", "gobierno_local"], {
    message: "Selecciona el tipo de gobierno",
  }),
  managerDegree: z.optional(z.union([z.string().check(z.trim(), z.maxLength(30)), z.literal("")])),
  managerDni: z.optional(z.union([z.string().check(z.trim(), z.regex(/^\d{8}$/, "El DNI debe tener 8 digitos")), z.literal("")])),
  managerFullName: z.optional(z.union([z.string().check(z.trim(), z.minLength(3, "Minimo 3 caracteres"), z.maxLength(200)), z.literal("")])),
  managerPosition: z.optional(z.union([z.string().check(z.trim(), z.maxLength(120)), z.literal("")])),
  managerResolutionNumber: z.optional(z.union([z.string().check(z.trim(), z.maxLength(80)), z.literal("")])),
  managerResolutionDate: z.optional(z.union([z.string().check(z.trim(), z.maxLength(20)), z.literal("")])),
  piaResolutionNumber: z.optional(z.union([z.string().check(z.trim(), z.maxLength(120)), z.literal("")])),
  piaResolutionDate: z.optional(z.union([z.string().check(z.trim(), z.maxLength(20)), z.literal("")])),
  pacResolutionNumber: z.optional(z.union([z.string().check(z.trim(), z.maxLength(120)), z.literal("")])),
  pacResolutionDate: z.optional(z.union([z.string().check(z.trim(), z.maxLength(20)), z.literal("")])),
  pacAnio: z.optional(z.union([z.string().check(z.trim(), z.regex(/^\d{4}$/, "Ano de 4 digitos")), z.literal("")])),
  pacMontoTotal: montoSchema,
  pacMontoBienesServicios: montoSchema,
  pacMontoObras: montoSchema,
  // UIT del ejercicio (Art. 52.1.b del Reglamento: el umbral del contrato menor
  // se expresa en UIT y decide si cabe agrupar por items).
  uitAnio: z.optional(z.union([z.string().check(z.trim(), z.regex(/^\d{4}$/, "Ano de 4 digitos")), z.literal("")])),
  uitValor: montoSchema,
});

type EntityFormData = z.infer<typeof entitySchema>;
// El formulario permite "sin seleccionar" (""); la validacion exige el valor real.
type FormState = Omit<EntityFormData, "governmentLevel"> & {
  governmentLevel: EntityFormData["governmentLevel"] | "";
};

const governmentLevelOptions: GovernmentLevel[] = [
  {
    label: "Gobierno Nacional",
    value: "gobierno_nacional",
    examples: "Ministerios, organismos publicos, programas y organismos constitucionales autonomos",
  },
  {
    label: "Gobierno Regional",
    value: "gobierno_regional",
    examples: "Gobiernos Regionales",
  },
  {
    label: "Gobierno Local",
    value: "gobierno_local",
    examples: "Municipalidades Provinciales y Municipalidades Distritales",
  },
];

function toFormState(entity: EntitySettings): FormState {
  return {
    name: entity.name || "",
    ruc: entity.ruc || "",
    executingUnit: entity.executingUnit || "",
    address: entity.address || "",
    city: entity.city || "",
    department: entity.department || "",
    province: entity.province || "",
    governmentLevel: (entity.governmentLevel as FormState["governmentLevel"]) || "",
    managerDegree: entity.managerDegree || "",
    managerDni: entity.managerDni || "",
    managerFullName: entity.managerFullName || "",
    managerPosition: entity.managerPosition || "",
    managerResolutionNumber: entity.managerResolutionNumber || "",
    managerResolutionDate: entity.managerResolutionDate || "",
    piaResolutionNumber: entity.piaResolutionNumber || "",
    piaResolutionDate: entity.piaResolutionDate || "",
    pacResolutionNumber: entity.pacResolutionNumber || "",
    pacResolutionDate: entity.pacResolutionDate || "",
    pacAnio: entity.pacAnio || "",
    // El servidor devuelve el número plano ("6099061.68"); en el campo se
    // muestra con separadores, igual que mientras se escribe.
    pacMontoTotal: formatearImporte(entity.pacMontoTotal || ""),
    pacMontoBienesServicios: formatearImporte(entity.pacMontoBienesServicios || ""),
    pacMontoObras: formatearImporte(entity.pacMontoObras || ""),
    uitAnio: entity.uitAnio || "",
    uitValor: formatearImporte(entity.uitValor || ""),
  };
}

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

  // Campo de texto reutilizable con el estilo de Areas (.formField).
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
      /** Importe en soles: prefijo S/, teclado numérico y entrada filtrada. */
      moneda?: boolean;
    } = {},
  ) => (
    <label className={`formField${opts.full ? " formFieldFull" : ""}`} data-campo-entidad={name}>
      <span>
        {label}
        {opts.required ? <em>obligatorio</em> : null}
      </span>
      <div className={opts.moneda ? "montoInput" : undefined}>
        {opts.moneda ? <span aria-hidden="true">S/</span> : null}
        <input
          type={opts.type ?? "text"}
          value={formData[name] ?? ""}
          placeholder={opts.placeholder}
          // El error se pintaba solo en color: un lector de pantalla no lo
          // asociaba al campo ni sabía que era inválido.
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
            // Formateo en vivo: se cuenta cuántos DÍGITOS quedaban a la
            // izquierda del cursor y se recoloca tras los mismos dígitos del
            // texto ya formateado. Sin esto, insertar un separador empujaría el
            // cursor al final y no se podría corregir el medio de una cifra.
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
        <small className="formFieldError" id={`err-${name}`}>
          {errors[name]}
        </small>
      ) : opts.hint ? (
        <small className="formFieldHint">{opts.hint}</small>
      ) : null}
    </label>
  );

  const degreeIsPreset = DEGREE_OPTIONS.includes(
    formData.managerDegree as (typeof DEGREE_OPTIONS)[number],
  );

  return (
    <div className="configPila">
      <div className="areasToolbar">
        <p className="areasToolbarDesc">
          Completa los datos de tu entidad. Se guardan solos mientras escribes; el
          contador de la derecha muestra cuántos campos clave faltan.
        </p>
        <div className="areasToolbarActions">
          <span className={`areaStatusBadge ${complete ? "active" : "inactive"}`}>
            {complete ? "Perfil completo" : `${progress} de ${checklist.length} campos`}
          </span>
        </div>
      </div>

      {/* Progreso del perfil: arriba, para que guíe qué falta mientras se completa. */}
      <div className="areaCard">
        <div className="areaFieldGroupTitle conAire">
          <CheckCircle2 size={14} /> Completa el perfil ({progress}/{checklist.length})
        </div>
        <div className="perfilProgreso" aria-hidden="true">
          <div
            className="perfilProgresoBarra"
            style={{ width: `${(progress / checklist.length) * 100}%` }}
          />
        </div>
        {/* El checklist es además el ÍNDICE del formulario: con ~24 campos en una
            columna, saber qué falta sin poder ir hasta ello obligaba a buscarlo
            a ojo. Cada punto salta a su campo y lo enfoca. */}
        <ul className="perfilChecklist">
          {checklist.map((item) => (
            <li key={item.label}>
              <button
                data-done={item.done}
                onClick={() => irACampo(item.campo)}
                title={item.done ? `${item.label} — completo` : `Ir a ${item.label}`}
                type="button"
              >
                <CheckCircle2 size={14} />
                <span>{item.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Datos de la entidad */}
      <div className="areaCard">
        <div className="areaFieldsSections">
          <div className="areaFieldGroup">
            <div className="areaFieldGroupTitle">
              <Building2 size={14} /> Datos de la entidad
            </div>
            <div className="areaFieldGroupGrid">
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
          </div>

          <div className="areaFieldGroup">
            <div className="areaFieldGroupTitle">
              <Landmark size={14} /> Tipo de gobierno
            </div>
            <div
              role="radiogroup"
              aria-label="Tipo de gobierno"
              aria-invalid={hasFieldError("governmentLevel") || undefined}
              data-campo-entidad="governmentLevel"
              className="perfilRadios"
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
                    className="perfilRadio"
                  >
                    <strong className="perfilRadioLabel">{level.label}</strong>
                    <small className="perfilRadioEjemplos">{level.examples}</small>
                  </button>
                );
              })}
            </div>
            {hasFieldError("governmentLevel") ? (
              <small className="formFieldError enBloque">
                {errors.governmentLevel}
              </small>
            ) : (
              <small className="formFieldHint enBloque">
                Identifica el ámbito institucional en reportes, expedientes y auditoría.
              </small>
            )}
          </div>
        </div>
      </div>

      {/* Gerente de la entidad */}
      <div className="areaCard">
        <div className="areaFieldGroup">
          <div className="areaFieldGroupTitle">
            <User size={14} /> Gerente de la entidad
          </div>
          <div className="areaFieldGroupGrid">
            <label className="formField">
              <span>Grado / Título profesional</span>
              <select
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
                  className="conAireArriba"
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
        </div>
      </div>

      {/* Presupuesto y PAC (dos grupos: resoluciones y montos) */}
      <div className="areaCard">
        <div className="areaFieldsSections">
          <div className="areaFieldGroup">
            <div className="areaFieldGroupTitle">
              <Wallet size={14} /> Resoluciones del PIA y PAC
            </div>
            <p className="areasToolbarDesc anchoLibre">
              Se citan <strong>literalmente</strong> como antecedente en los informes que se
              exportan y se firman. Se registran una vez por ejercicio.
            </p>
            {/* Rejilla propia: el número de resolución es un texto largo
                ("Resolución de Alcaldía N° 238-2025-MDP/ALC") y en media
                columna se leía a trozos, mientras que su fecha —un selector—
                sobraba de ancho. Aquí el número se lleva el doble. */}
            <div className="areaFieldGroupGrid resolucionesGrid">
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
              {campo("pacAnio", "Ejercicio fiscal", {
                placeholder: "2026",
                inputMode: "numeric",
                maxDigits: 4,
              })}
            </div>

            {/* Vista previa de la cita. Estos campos no se leen aquí: se leen
                impresos en un informe, y así se ve cómo van a quedar antes de
                exportarlo. */}
            {citasResoluciones.length > 0 ? (
              <div className="citaPreview">
                <span className="citaPreviewTitulo">Se citará así en los informes</span>
                {citasResoluciones.map((c) => (
                  <p key={c.clave}>
                    <strong>{c.etiqueta}:</strong> {c.texto}
                  </p>
                ))}
              </div>
            ) : null}

            {avisosResol.map((a) => (
              <p className={`citaAviso citaAviso-${a.tono}`} key={a.texto}>
                <AlertTriangle size={13} /> {a.texto}
              </p>
            ))}
          </div>

          <div className="areaFieldGroup">
            <div className="areaFieldGroupTitle">
              <Wallet size={14} /> Montos del PAC — línea de corte (Art. 125)
            </div>
            <p className="areasToolbarDesc anchoLibre">
              Registra el monto total del PAC y la parte de bienes y servicios. El PAC de obras y
              la línea de corte se calculan solos.
            </p>
            <div className="areaFieldGroupGrid">
              {campo("pacMontoTotal", "Monto total del PAC (S/)", { moneda: true, placeholder: "6,099,061.68" })}
              {campo("pacMontoBienesServicios", "PAC bienes y servicios (S/) — base del 10%", {
                moneda: true,
                placeholder: "1,226,465.70",
                hint: "Incluye bienes, servicios, no competitivos y CEAM del PAC (Guía).",
              })}
              {/* Calculado, no escrito: el PAC se reparte entre los dos bloques,
                  así que pedir el tercero solo permite que no cuadren. */}
              <label className="formField">
                <span>PAC obras (S/)</span>
                <div className="montoInput">
                  <span aria-hidden="true">S/</span>
                  <input
                    readOnly
                    tabIndex={-1}
                    value={pacResumen?.obras ?? ""}
                    placeholder="Se calcula: total − bienes y servicios"
                    className="perfilCampoCalculado"
                  />
                </div>
                <small className="formFieldHint">
                  Se calcula restando: monto total del PAC − PAC de bienes y servicios.
                </small>
              </label>
            </div>

            {pacResumen ? (
              <div className="perfilPreview">
                <strong className="perfilPreviewTitulo">
                  Línea de corte por cuantía: {pacResumen.lineaCorte}
                </strong>
                <div className="perfilNota">
                  10% del PAC de bienes y servicios. Toda contratación por encima de ese monto es
                  de <em>alta cuantía</em> (Art. 125.2). Es una referencia: cada expediente
                  recalcula la línea sumando las no programadas ya convocadas, las otras que se
                  segmenten a la vez y la propia contratación si no está programada.
                </div>
                {pacResumen.excede ? (
                  <div className="perfilPreviewAviso">
                    Revisa las cifras: el PAC de bienes y servicios supera el monto total del PAC
                    ({pacResumen.total}), así que el PAC de obras saldría negativo. Mientras no
                    cuadren, el PAC de obras se deja sin registrar.
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="areaFieldGroup">
            <div className="areaFieldGroupTitle">
              <Wallet size={14} /> UIT del ejercicio — tope del contrato menor
            </div>
            <p className="areasToolbarDesc anchoLibre">
              La norma expresa las cuantías en UIT. De este valor sale el tope del contrato menor,
              que decide si un requerimiento puede convocarse por ítems, lotes o tramos.
            </p>
            <div className="areaFieldGroupGrid">
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
              <div className="perfilPreview">
                <strong className="perfilPreviewTitulo">
                  Tope del contrato menor: {umbralResumen}
                </strong>
                <div className="perfilNota">
                  8 UIT. Son contratos menores los de monto <em>igual o inferior</em> a esa cifra
                  (Ley 32069, Art. 34.1) y no requieren procedimiento de selección. Por eso un
                  requerimiento solo puede convocarse por ítems, lotes o tramos si{" "}
                  <strong>cada uno supera ese tope</strong> (Reglamento, Art. 52.1.b): en el importe
                  exacto todavía es contrato menor.
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Vista previa: cómo aparece la entidad en los documentos */}
      <div className="areaCard">
        <div className="areaFieldGroupTitle conAireAmplio">
          <Building2 size={14} /> Vista previa — cómo se verá en los documentos
        </div>
        <dl className="perfilDatos">
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
        </dl>
      </div>

      {/* Barra fija: el estado del guardado vivía al final de un formulario muy
          largo, así que mientras se escribía arriba no se veía nada. */}
      <div className="perfilBarraGuardado">
        <button
          className="primaryButton"
          type="button"
          onClick={() => persist("manual")}
          disabled={saving || !isDirty}
        >
          {saving ? <Loader2 size={16} className="expSpin" /> : <Save size={16} />}{" "}
          {saving ? "Guardando..." : isDirty ? "Guardar cambios" : "Guardado"}
        </button>
        <SaveStatus status={saveStatus} lastSaved={lastSaved} />
        {isDirty ? (
          <span className="configSinGuardarChip alFinal">
            <AlertTriangle size={12} aria-hidden /> Sin guardar
          </span>
        ) : null}
      </div>
    </div>
  );
}

// Par etiqueta/valor de la vista previa. Vacío se muestra como guion tenue.
function Dato({ k, v }: { k: string; v: string | null | undefined }) {
  const valor = (v ?? "").trim();
  return (
    <div>
      <dt>
        {k}
      </dt>
      <dd data-vacio={valor ? undefined : "true"}>
        {valor || "—"}
      </dd>
    </div>
  );
}

function SaveStatus({
  status,
  lastSaved,
}: {
  status: "saving" | "error" | "dirty" | "saved" | "idle";
  lastSaved: Date | null;
}) {
  if (status === "idle") return null;

  const config: Record<
    Exclude<typeof status, "idle">,
    { icon: React.ReactNode; text: string }
  > = {
    saving: {
      icon: <Loader2 size={14} className="expSpin" />,
      text: "Guardando cambios...",
    },
    saved: {
      icon: <CheckCircle2 size={14} />,
      text: lastSaved ? `Todo guardado - ${lastSaved.toLocaleTimeString("es-PE")}` : "Todo guardado",
    },
    dirty: {
      icon: <span className="perfilSaveDot" />,
      text: "Cambios sin guardar",
    },
    error: {
      icon: <span aria-hidden>⚠</span>,
      text: "No se pudo guardar. Reintenta.",
    },
  };

  const { icon, text } = config[status];
  return (
    <span
      role="status"
      aria-live="polite"
      className="perfilSaveStatus"
      data-status={status}
    >
      {icon}
      {text}
    </span>
  );
}
