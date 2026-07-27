"use client";

import { memo } from "react";
import { MessageSquare, Sparkles } from "lucide-react";
import type { FichaField } from "@/lib/necesidad-ficha-secciones";
import { etiquetaRecomendado } from "@/lib/necesidad-ficha-secciones";
import type { ObservacionNecesidad } from "@/lib/necesidades";
import { LIMITES_TEXTO } from "@/lib/necesidades-limites";
import { filasTextarea } from "@/lib/textarea-alto";
import { cn } from "@/lib/utils";
import { InfoPopover } from "../ui";
import { NecesidadEettCampo } from "../necesidad-eett-campo";
import { InstitucionesArbitralesEditor } from "../instituciones-arbitrales-editor";
import { OtrasPenalidadesEditor } from "../otras-penalidades-editor";
import { RequisitosCalificacionEditor } from "../requisitos-calificacion-editor";
import { SubcontratacionEditor } from "../subcontratacion-editor";
import { CAMPOS_SIN_REDACCION_IA } from "./campos-sin-redaccion-ia";
import {
  FICHA_CTRL,
  FICHA_CTRL_AREA,
  FICHA_CTRL_ERR,
  FICHA_CTRL_H,
  FICHA_IA,
  FICHA_LABEL,
  FICHA_OPT,
  FICHA_REQ,
} from "./ficha-estilos";

/**
 * Un campo de la ficha de necesidad.
 *
 * Antes era `renderFichaField`, una FUNCION dentro del componente de detalle.
 * Esa distincion lo era todo: lo que devuelve una funcion llamada durante el
 * render forma parte del arbol del padre, asi que React no tiene donde cortar.
 * Cada tecla pulsada en cualquier campo volvia a ejecutar estas casi cuatrocientas
 * lineas por CADA campo visible de la seccion.
 *
 * Como componente memoizado si hay donde cortar, pero solo si las props no
 * cambian. Por eso recibe el VALOR de su campo y no el formulario entero: el
 * formulario es un objeto nuevo en cada pulsacion y habria anulado la memo,
 * dejando el cambio en un movimiento de lineas entre ficheros. Lo mismo con los
 * mapas de avisos —se reducen aqui a un booleano o a una fecha— y con los
 * manejadores, que el padre estabiliza con `useCallbackEstable`.
 *
 * `geoValorEntidad`, `obligatorio`, `montoEstimado`, `tipoProceso` y `tipoObjeto`
 * los calcula el padre por el mismo motivo: dependen de catalogos o de OTROS
 * campos del formulario, y traerlos aqui reintroduciria la dependencia que
 * acabamos de cortar.
 */
export type CampoFichaProps = {
  /** Áreas ya registradas, para el autocompletado de `areaUsuaria`. */
  areasSugeridas: string[];
  /** La ficha está en modo edición (distinto de tener permiso). */
  editable: boolean;
  eettDocs: Array<{ file_name: string; id: string; status: string; title: string }>;
  eettUploading: boolean;
  /** Mensaje de error del campo, o `undefined` si no lo tiene. */
  error: string | undefined;
  /** El requerimiento del proceso exige este campo. */
  exigido: boolean;
  /** Fecha ISO en que la IA propuso el valor y se aprobó, o `null`. */
  fechaIA: string | null;
  field: FichaField;
  /** Ubicación de la entidad para este campo geográfico; "" si no aplica. */
  geoValorEntidad: string;
  modoSimple: boolean;
  montoEstimado: number | null;
  necesidadId: string;
  obligatorio: boolean;
  /** Observaciones sin resolver sobre este campo, o `null`. */
  obsPendiente: ObservacionNecesidad[] | null;
  onAbrirEett: (doc: { id: string }) => void;
  onCambio: (api: string, valor: string) => void;
  /** `null` retira el error del campo; una cadena lo fija. */
  onError: (api: string, mensaje: string | null) => void;
  onRedactarIA: (api: string) => void;
  onSubirEett: (archivo: File, tipo: "eett" | "tdr") => void;
  onTocar: (api: string) => void;
  puedeGestionar: boolean;
  tipoObjeto: string;
  tipoProceso: string | null;
  tocado: boolean;
  valor: string;
};

export const CampoFicha = memo(function CampoFicha({
  areasSugeridas,
  editable,
  eettDocs,
  eettUploading,
  error,
  exigido,
  fechaIA,
  field,
  geoValorEntidad,
  modoSimple,
  montoEstimado,
  necesidadId,
  obligatorio,
  obsPendiente,
  onAbrirEett,
  onCambio,
  onError,
  onRedactarIA,
  onSubirEett,
  onTocar,
  puedeGestionar,
  tipoObjeto,
  tipoProceso,
  tocado,
  valor,
}: CampoFichaProps) {
  const val = valor;
  const hasError = Boolean(error);
  const limpiarError = () => {
    if (error) onError(field.api, null);
  };
  /** Al escribir: se anota el campo como tocado y se retira su error. */
  const alEscribir = () => {
    if (!tocado) onTocar(field.api);
    limpiarError();
  };
  /**
   * Validacion al salir del campo. Antes solo se validaba al pulsar Guardar: se
   * rellenaban nueve secciones y el fallo aparecia al final, lejos de donde se
   * cometio. Solo actua sobre campos ya tocados (o que ya estaban en error),
   * para no senalar lo que nadie ha tocado todavia.
   */
  const validarAlSalir = () => {
    if (!obligatorio) return;
    if (!tocado && !error) return;
    onError(field.api, String(valor).trim() ? null : "Campo obligatorio");
  };
  // Marcas de accesibilidad del control. Sin ellas el error solo existe en rojo:
  // `aria-invalid` hace que el lector de pantalla anuncie el campo como
  // invalido, y `aria-describedby` le engancha el texto del motivo, que hasta
  // ahora era un <span> suelto sin relacion con el control. Se declaran una vez
  // y se reparten a los seis controles para que no puedan divergir.
  const errorId = `err-${field.api}`;
  const marcasError = {
    "aria-describedby": hasError ? errorId : undefined,
    "aria-invalid": hasError || undefined,
  } as const;
  const botonRedactarIA = puedeGestionar && !CAMPOS_SIN_REDACCION_IA.has(field.api) ? (
    <button
      className="mb-1.5 inline-flex w-fit items-center gap-1 rounded-md bg-accent/10 px-2 py-1 text-[11px] font-semibold text-accent transition hover:bg-accent/20"
      onClick={(e) => { e.preventDefault(); onRedactarIA(field.api); }}
      title="Redactar este campo con el copiloto IA (Ley 32069)"
      type="button"
    >
      <Sparkles size={12} /> Redactar con IA
    </button>
  ) : null;
  // Base legal del campo. El disparador y el globo los pone Radix: teclado,
  // Escape, reposicionamiento y ARIA salen de serie.
  const tooltipNode = !modoSimple && field.baseLegal ? (
    <InfoPopover etiqueta={`Base legal de ${field.label}`}>
      {field.baseLegal}
      {field.ejemplo ? `
  Ej: ${field.ejemplo}` : ""}
    </InfoPopover>
  ) : null;

  if (field.checkbox) {
    return (
      // data-campo: la verificación («¿Está lista?») salta hasta aquí.
      <label
        className={cn(
          "flex items-center gap-2.5 rounded-[10px] border border-line bg-surface px-3 py-2.5",
          field.wide && "col-span-full",
        )}
        data-campo={field.api}
        key={field.api}
      >
        <input
          checked={val === "true"}
          onChange={(e) => { onCambio(field.api, e.target.checked ? "true" : "false"); }}
          type="checkbox"
          className="size-4 shrink-0 accent-brand"
        />
        <span className="text-[13px] font-semibold text-ink">{field.label}</span>
        {tooltipNode}
      </label>
    );
  }

  // El EETT/TDR es un ADJUNTO, no un texto: se redacta fuera, en
  // Word o PDF, con sus tablas y su formato. Transcribirlo a un
  // textarea perdía la maqueta y creaba una segunda versión que no
  // coincidía con la que se firma. Los documentos son los del módulo
  // EETT/TDR; esto es su puerta de entrada desde el campo.
  if (field.api === "descripcionDetallada") {
    return (
      <div className="col-span-full" data-campo={field.api} key={field.api}>
        <span className={FICHA_LABEL}>
          {field.label}
          {obligatorio ? (
            <span className={FICHA_REQ}>obligatorio</span>
          ) : (
            <span className={FICHA_OPT}>{field.recomendado ? etiquetaRecomendado(field) : "opcional"}</span>
          )}
        </span>
        <NecesidadEettCampo
          docs={eettDocs.map((d) => ({
            file_name: d.file_name,
            id: d.id,
            status: d.status,
            title: d.title,
          }))}
          necesidadId={necesidadId}
          onAbrir={(docId) => {
            const doc = eettDocs.find((d) => d.id === docId);
            if (doc) onAbrirEett(doc);
          }}
          onSubir={(archivo, tipo) => void onSubirEett(archivo, tipo)}
          readOnly={!editable || !puedeGestionar}
          subiendo={eettUploading}
        />
        {!modoSimple && field.baseLegal ? <small className="mt-1 block text-[11.5px] text-muted">{field.baseLegal}</small> : null}
      </div>
    );
  }

  // Editor estructurado (varios inputs): fuera de <label>.
  if (field.kind === "requisitos") {
    return (
      <div className={field.wide ? "col-span-full" : undefined} data-campo={field.api} key={field.api}>
        <span className={FICHA_LABEL}>
          {field.label}
          {obligatorio ? (
            <span className={FICHA_REQ}>obligatorio</span>
          ) : (
            <span className={FICHA_OPT}>{field.recomendado ? etiquetaRecomendado(field) : "opcional"}</span>
          )}
          {fechaIA !== null ? (
            <span
              className={FICHA_IA}
              title={`Propuesto por la IA desde el EETT/TDR y aprobado en el traslado el ${new Date(fechaIA).toLocaleString("es-PE")}. Revísalo antes de firmar.`}
            >
              ✦ propuesto por IA
            </span>
          ) : null}
        </span>
        <RequisitosCalificacionEditor
          // Sin la cuantía no se puede comprobar el tope de 3x del modelo, y sin el
          // procedimiento no se sabe si cabe la capacidad económica (Art. 72.3.e).
          montoEstimado={montoEstimado}
          tipoProceso={tipoProceso}
          objeto={tipoObjeto}
          onChange={(next) => onCambio(field.api, next)}
          value={val}
        />
        {!modoSimple && field.baseLegal ? <small className="mt-1 block text-[11.5px] text-muted">{field.baseLegal}</small> : null}
      </div>
    );
  }

  // Cuadro de instituciones arbitrales: varios inputs, fuera de <label>.
  if (field.kind === "controversias") {
    return (
      <div className={field.wide ? "col-span-full" : undefined} data-campo={field.api} key={field.api}>
        <span className={FICHA_LABEL}>
          {field.label}
          {obligatorio ? (
            <span className={FICHA_REQ}>obligatorio</span>
          ) : (
            <span className={FICHA_OPT}>{field.recomendado ? etiquetaRecomendado(field) : "opcional"}</span>
          )}
          {fechaIA !== null ? (
            <span
              className={FICHA_IA}
              title={`Propuesto por la IA desde el EETT/TDR y aprobado en el traslado el ${new Date(fechaIA).toLocaleString("es-PE")}. Revísalo antes de firmar.`}
            >
              ✦ propuesto por IA
            </span>
          ) : null}
        </span>
        {/* La IA no reescribe el apartado: aporta las condiciones adicionales
            (sede, plazos…). El párrafo y el cuadro los compone el editor. */}
        {botonRedactarIA}
        <InstitucionesArbitralesEditor
          onChange={(next) => onCambio(field.api, next)}
          value={val}
        />
        {!modoSimple && field.baseLegal ? <small className="mt-1 block text-[11.5px] text-muted">{field.baseLegal}</small> : null}
      </div>
    );
  }

  // Cuadro de otras penalidades: varios inputs, fuera de <label>.
  if (field.kind === "penalidades") {
    return (
      <div className={field.wide ? "col-span-full" : undefined} data-campo={field.api} key={field.api}>
        <span className={FICHA_LABEL}>
          {field.label}
          {obligatorio ? (
            <span className={FICHA_REQ}>obligatorio</span>
          ) : (
            <span className={FICHA_OPT}>{field.recomendado ? etiquetaRecomendado(field) : "opcional"}</span>
          )}
          {fechaIA !== null ? (
            <span
              className={FICHA_IA}
              title={`Propuesto por la IA desde el EETT/TDR y aprobado en el traslado el ${new Date(fechaIA).toLocaleString("es-PE")}. Revísalo antes de firmar.`}
            >
              ✦ propuesto por IA
            </span>
          ) : null}
        </span>
        {/* La IA no reescribe el apartado: aporta las condiciones adicionales
            (sede, plazos…). El párrafo y el cuadro los compone el editor. */}
        {botonRedactarIA}
        <OtrasPenalidadesEditor
          onChange={(next) => onCambio(field.api, next)}
          value={val}
        />
        {!modoSimple && field.baseLegal ? <small className="mt-1 block text-[11.5px] text-muted">{field.baseLegal}</small> : null}
      </div>
    );
  }

  // Cuadro de subcontratación: varios inputs, fuera de <label>.
  if (field.kind === "subcontratacion") {
    return (
      <div className={field.wide ? "col-span-full" : undefined} data-campo={field.api} key={field.api}>
        <span className={FICHA_LABEL}>
          {field.label}
          {obligatorio ? (
            <span className={FICHA_REQ}>obligatorio</span>
          ) : (
            <span className={FICHA_OPT}>{field.recomendado ? etiquetaRecomendado(field) : "opcional"}</span>
          )}
          {fechaIA !== null ? (
            <span
              className={FICHA_IA}
              title={`Propuesto por la IA desde el EETT/TDR y aprobado en el traslado el ${new Date(fechaIA).toLocaleString("es-PE")}. Revísalo antes de firmar.`}
            >
              ✦ propuesto por IA
            </span>
          ) : null}
        </span>
        {/* La IA no reescribe el apartado: aporta las condiciones adicionales
            (sede, plazos…). El párrafo y el cuadro los compone el editor. */}
        {botonRedactarIA}
        <SubcontratacionEditor
          onChange={(next) => onCambio(field.api, next)}
          value={val}
        />
        {!modoSimple && field.baseLegal ? <small className="mt-1 block text-[11.5px] text-muted">{field.baseLegal}</small> : null}
      </div>
    );
  }

  return (
    <label className={cn("flex min-w-0 flex-col", field.wide && "col-span-full")} data-campo={field.api} key={field.api}>
      <span className={FICHA_LABEL}>
        {field.label}
        {obligatorio ? (
          <span className={FICHA_REQ}>obligatorio</span>
        ) : (
          <span className={FICHA_OPT}>{field.recomendado ? etiquetaRecomendado(field) : "opcional"}</span>
        )}
        {fechaIA !== null ? (
          <span
            className={FICHA_IA}
            title={`Propuesto por la IA desde el EETT/TDR y aprobado en el traslado el ${new Date(fechaIA).toLocaleString("es-PE")}. Revísalo antes de firmar.`}
          >
            ✦ propuesto por IA
          </span>
        ) : null}
        {exigido ? (
          <span className="text-[11px] font-medium text-brand" title="El requerimiento de este proceso de selección exige este campo">
            · exige el proceso
          </span>
        ) : null}
        {obsPendiente !== null ? (
          <span
            className="inline-flex items-center gap-0.5 rounded-full bg-warning-soft px-1.5 py-px text-[10px] font-bold text-warning"
            title={obsPendiente
              .map((o) => `Observación (${o.autor_referencia ?? "—"}): ${o.comentario}`)
              .join("\n")}
          >
            <MessageSquare size={11} aria-hidden /> {obsPendiente.length}
          </span>
        ) : null}
        {tooltipNode}
      </span>
      {geoValorEntidad ? (
        // Desplegable con la ubicación de la entidad. Preserva un
        // valor previo distinto para no borrarlo en silencio.
        <select
          className={cn(FICHA_CTRL, FICHA_CTRL_H, hasError && FICHA_CTRL_ERR)}
          {...marcasError}
          onBlur={validarAlSalir}
          onChange={(e) => { onCambio(field.api, e.target.value); alEscribir(); }}
          value={val || field.porDefecto || ""}
        >
          {field.porDefecto ? null : <option value="">— Sin definir —</option>}
          {val && val !== geoValorEntidad ? <option value={val}>{val} — valor actual</option> : null}
          <option value={geoValorEntidad}>{geoValorEntidad}</option>
        </select>
      ) : field.api === "areaUsuaria" ? (
        // Texto con autocompletado de las áreas ya registradas: sugiere
        // la grafía existente sin cerrar la lista a un catálogo rígido.
        <>
          <input
            className={cn(FICHA_CTRL, FICHA_CTRL_H, hasError && FICHA_CTRL_ERR)}
            {...marcasError}
            list="areas-usuarias-sugeridas"
            maxLength={LIMITES_TEXTO[field.api]}
            onBlur={validarAlSalir}
            onChange={(e) => { onCambio(field.api, e.target.value); alEscribir(); }}
            type="text"
            value={val}
          />
          {areasSugeridas.length > 0 ? (
            <datalist id="areas-usuarias-sugeridas">
              {areasSugeridas.map((a) => <option key={a} value={a} />)}
            </datalist>
          ) : null}
        </>
      ) : field.kind === "textarea" ? (
        <>
          {botonRedactarIA}
          <textarea
            className={cn(FICHA_CTRL, FICHA_CTRL_AREA, hasError && FICHA_CTRL_ERR)}
            {...marcasError}
            maxLength={LIMITES_TEXTO[field.api]}
            onBlur={validarAlSalir}
            onChange={(e) => { onCambio(field.api, e.target.value); alEscribir(); }}
            // La fórmula se ve al redactar, no escondida en el globo
            // de ayuda: es la estructura que el texto debe seguir.
            placeholder={field.plantilla}
            rows={filasTextarea(val, field.wide)}
            value={val}
          />
          <span className={cn("mt-1 text-[11px]", val.length > 1800 ? "font-semibold text-warning" : "text-muted")}>
            {val.length} caracteres
          </span>
        </>
      ) : field.kind === "select" ? (
        <select
          className={cn(FICHA_CTRL, FICHA_CTRL_H, hasError && FICHA_CTRL_ERR)}
          {...marcasError}
          onBlur={validarAlSalir}
          onChange={(e) => { onCambio(field.api, e.target.value); alEscribir(); }}
          // Con `porDefecto`, un valor vacio mostraria la primera opcion
          // mientras el estado sigue vacio: lo que se ve y lo que se
          // guardaria dejarian de ser lo mismo.
          value={val || field.porDefecto || ""}
        >
          {/* Sin «— Sin definir —» cuando el campo tiene valor por defecto: es
              un enum cerrado y el guardado rechaza la cadena vacía con un 400.
              Elegirla dejaba la ficha sin poder guardarse —«No se pudo
              autoguardar» en cada tecla— sin decir qué campo la bloqueaba.
              Misma regla que ya seguían los desplegables de ubicación. */}
          {field.porDefecto ? null : <option value="">— Sin definir —</option>}
          {/* Un valor guardado antes de que el campo fuera una lista
              cerrada no está entre las opciones. Se añade como
              primera opción para NO perderlo al guardar. */}
          {val && !(field.opciones ?? []).some((o) => o.value === val) ? (
            <option value={val}>{val} — valor actual</option>
          ) : null}
          {(field.opciones ?? []).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : field.kind === "number" || field.kind === "date" ? (
        <input
          className={cn(FICHA_CTRL, FICHA_CTRL_H, hasError && FICHA_CTRL_ERR)}
          {...marcasError}
          onBlur={validarAlSalir}
          onChange={(e) => { onCambio(field.api, e.target.value); alEscribir(); }}
          type={field.kind === "number" ? "number" : "date"}
          value={val}
        />
      ) : (
        <>
          {botonRedactarIA}
          <input
            className={cn(FICHA_CTRL, FICHA_CTRL_H, hasError && FICHA_CTRL_ERR)}
            {...marcasError}
            maxLength={LIMITES_TEXTO[field.api]}
            onBlur={validarAlSalir}
            onChange={(e) => { onCambio(field.api, e.target.value); alEscribir(); }}
            type="text"
            value={val}
          />
        </>
      )}
      {hasError ? <span className="mt-1 text-[12px] font-medium text-danger" id={errorId}>{error}</span> : null}
    </label>
  );
});
