"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Info, Trash2 } from "lucide-react";
import {
  ACREDITACION_TIPICA,
  SUBTIPOS_CAPACIDAD_TECNICA,
  TIPOS_REQUISITO_ART72,
  ayudaPorObjeto,
  componerRequisitos,
  parseRequisitos,
  repartirRequisitos,
  type EstadoRequisito,
  type EstadoTipoRequisito,
  type RepartoRequisitos,
  type RequisitoFacultativo,
  type TipoRequisitoArt72,
} from "@/lib/requisitos-calificacion";
import { avisosDeTopes } from "@/lib/requisitos-topes";
import { tienePrecalificacion } from "@/lib/procesos-seleccion";
// El alto se calcula con la estimación ESTRECHA (no `wide`): estos textarea
// viven dentro de la tarjeta de cada tipo, que es bastante más angosta que un
// campo ancho de la ficha, y con la estimación ancha un párrafo de 270
// caracteres se quedaba en cuatro filas.
import { filasTextarea } from "@/lib/textarea-alto";

// Editor de la variable f) de la Estrategia (Art. 46.1.f) y de la propuesta del
// requerimiento (Art. 44.2.b).
//
// El Art. 72.3 define una lista CERRADA de cinco tipos: no existe un sexto. Por
// eso son casillas y no texto libre — antes se podía escribir cualquier cosa
// ("Certificación ISO 9001") como requisito de calificación.
//
// Qué tipo es obligatorio y cuál facultativo lo determinan las bases estándar
// según la modalidad (Art. 72.4). Mientras esa tabla no esté cargada en ACE, lo
// marca el usuario; el día que esté, se deriva del tipo de procedimiento.

export function RequisitosCalificacionEditor({
  value,
  onChange,
  readOnly = false,
  objeto,
  montoEstimado,
  tipoProceso,
  requisitosModelo,
}: {
  value: string;
  onChange: (next: string) => void;
  readOnly?: boolean;
  // Objeto contractual: la ayuda de capacidad técnica y experiencia cambia en
  // obras (Art. 72.3.b + Art. 157). undefined = ayuda genérica.
  objeto?: string | null;
  /** Cuantía de la contratación: sin ella no se puede calcular el tope de 3x. */
  montoEstimado?: number | null;
  /** Procedimiento: decide si cabe la capacidad económica (Art. 72.3.e). */
  tipoProceso?: string | null;
  /**
   * Tipos que el PDF-modelo del procedimiento declara como apartado.
   *
   * NO filtra: el Art. 72.3 permite los cinco y la entidad puede sustentar uno
   * que su formato no liste. Solo DICE cual pide el formato, que es lo que hasta
   * ahora habia que saberse de memoria: los modelos declaran entre cero y cuatro
   * segun el objeto y el procedimiento —los de obras nunca traen capacidad
   * legal, el no competitivo no trae ninguno— y la ficha ofrecia siempre los
   * mismos.
   */
  requisitosModelo?: ReadonlySet<string>;
}) {
  // Estado LOCAL del reparto. El valor se persiste como texto canónico y ese
  // round-trip (serializar → parsear) recorta los espacios al final de cada campo
  // (`.trim()` en unirNombre/partirSegmentos/partirNombre). Si el textarea leyera
  // su contenido de ese round-trip en cada tecla, un espacio al final se borraría
  // al instante y no se podría separar palabras. Por eso el editor guarda lo
  // TECLEADO (con sus espacios) y solo re-sincroniza cuando el valor cambia por
  // FUERA (traer datos de la IA, recarga de la ficha…).
  const [reparto, setReparto] = useState<RepartoRequisitos>(() =>
    repartirRequisitos(parseRequisitos(value)),
  );
  // Última cadena que ESTE editor emitió: distingue un cambio propio (no
  // re-sincronizar, borraría el espacio recién tecleado) de uno externo.
  const emitidoRef = useRef<string>(value);
  useEffect(() => {
    if (value !== emitidoRef.current) {
      setReparto(repartirRequisitos(parseRequisitos(value)));
      emitidoRef.current = value;
    }
  }, [value]);

  const { porTipo, otrosObligatorios, otrosFacultativos } = reparto;

  function propagar(next: RepartoRequisitos) {
    if (readOnly) return;
    setReparto(next);
    const texto = componerRequisitos(next);
    emitidoRef.current = texto;
    onChange(texto);
  }

  function emit(
    next: Map<TipoRequisitoArt72, EstadoTipoRequisito>,
    otrosObl: string[] = otrosObligatorios,
    otrosFac: RequisitoFacultativo[] = otrosFacultativos,
  ) {
    propagar({ porTipo: next, otrosObligatorios: otrosObl, otrosFacultativos: otrosFac });
  }

  function cambiar(key: TipoRequisitoArt72, estado: EstadoRequisito) {
    const next = new Map(porTipo);
    const actual = next.get(key);
    next.set(key, {
      estado,
      // El detalle se conserva al cambiar de naturaleza: es lo que se exige, y
      // no depende de si el requisito es obligatorio o facultativo.
      detalle: actual?.detalle ?? "",
      // La acreditación (cómo se prueba, Art. 72.1) aplica a ambas naturalezas,
      // así que también se conserva al cambiar de obligatorio a facultativo.
      acreditacion: actual?.acreditacion ?? "",
      // El sustento solo aplica a los facultativos: al dejar de serlo, se suelta.
      sustento: estado === "facultativo" ? (actual?.sustento ?? "") : "",
    });
    emit(next);
  }

  function editar(key: TipoRequisitoArt72, campo: "detalle" | "acreditacion" | "sustento", valor: string) {
    const next = new Map(porTipo);
    const actual = next.get(key) ?? { estado: "obligatorio" as EstadoRequisito, detalle: "", acreditacion: "", sustento: "" };
    next.set(key, { ...actual, [campo]: valor });
    emit(next);
  }

  const hayHeredados = otrosObligatorios.length > 0 || otrosFacultativos.length > 0;

  // El Art. 72.3.e limita la capacidad económica a los procedimientos CON
  // precalificación, y el 72.4 remite a las bases estándar de cada modalidad.
  // Ofrecerla siempre invitaba a exigir en un Concurso Público de servicios algo
  // que su modelo no contempla. Si ya viniera rellenada de antes se conserva:
  // ocultar un dato escrito sería hacerlo desaparecer sin avisar.
  const conPrecalificacion = tienePrecalificacion(tipoProceso);
  const tiposAplicables = TIPOS_REQUISITO_ART72.filter(
    (t) => t.key !== "capacidad_economica" || conPrecalificacion || porTipo.get("capacidad_economica")?.estado !== "no",
  );
  return (
    <div className="reqCal">
      <p className="reqCalHint">
        <Info size={12} /> El Art. 72.3 del Reglamento define estos cinco tipos y no admite otros.
        Cuáles son obligatorios lo fijan las bases estándar según la modalidad del procedimiento
        (Art. 72.4). Los facultativos requieren sustento.
      </p>

      <div className="reqCalTipos">
        {tiposAplicables.map((tipo) => {
          const e = porTipo.get(tipo.key);
          const estado: EstadoRequisito = e?.estado ?? "no";
          return (
            <div className="reqCalTipo" data-estado={estado} key={tipo.key}>
              <div className="reqCalTipoHead">
                <div className="reqCalTipoNombre">
                  <strong>{tipo.label}</strong>
                  {requisitosModelo?.has(tipo.key) ? (
                    <span className="reqCalDelModelo" title="El modelo de requerimiento de este procedimiento trae este apartado">
                      · lo pide el modelo
                    </span>
                  ) : null}
                  <small>{ayudaPorObjeto(tipo.key, tipo.ayuda, objeto)}</small>
                </div>
                <select
                  aria-label={`Naturaleza de ${tipo.label}`}
                  disabled={readOnly}
                  onChange={(ev) => cambiar(tipo.key, ev.target.value as EstadoRequisito)}
                  value={estado}
                >
                  <option value="no">No aplica</option>
                  <option value="obligatorio">Obligatorio</option>
                  <option value="facultativo">Facultativo</option>
                </select>
              </div>
              {/* El 72.3 fija el TIPO; el contenido concreto lo pone la
                  entidad. Sin detalle, el requisito no es acreditable. */}
              {estado !== "no" ? (
                <label className="reqCalCampo">
                  <span>¿Qué se exige exactamente?</span>
                  <textarea
                    disabled={readOnly}
                    onChange={(ev) => editar(tipo.key, "detalle", ev.target.value)}
                    placeholder={`Ej. ${tipo.ejemplo}`}
                    rows={filasTextarea(e?.detalle ?? "")}
                    value={e?.detalle ?? ""}
                  />
                  {/* El modelo parte la capacidad tecnica en cuatro literales con reglas
                      propias. Se enseñan aqui, donde se escribe, en vez de dejarlas en el
                      PDF: son las que se observan si se incumplen. */}
                  {tipo.key === "capacidad_tecnica" ? (
                    <ul className="reqCalSubtipos">
                      {SUBTIPOS_CAPACIDAD_TECNICA.map((sub) => (
                        <li key={sub.clave}>
                          <strong>{sub.clave} {sub.label}.</strong> {sub.regla}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {/* Topes del modelo. Se avisa, no se bloquea: esto es una PROPUESTA del
                      area usuaria y quien establece los requisitos es la DEC (Art. 72.1).
                      Impedir escribir la cifra seria arrogarse esa decision. */}
                  {(tipo.key === "experiencia_postor" || tipo.key === "capacidad_tecnica")
                    ? avisosDeTopes(
                        e?.detalle ?? "",
                        montoEstimado ?? null,
                        tipo.key,
                      ).map((aviso) => (
                        <span className="reqCalAvisoTope" key={aviso.clave} role="status">
                          <AlertTriangle aria-hidden size={11} /> {aviso.mensaje}
                        </span>
                      ))
                    : null}
                </label>
              ) : null}

              {/* Art. 72.1: el cumplimiento "es acreditado conforme indiquen
                  las bases". Aplica a obligatorios y facultativos por igual; el
                  placeholder propone la acreditación típica del tipo (72.3). */}
              {estado !== "no" ? (
                <label className="reqCalCampo">
                  <span>¿Con qué se acredita?</span>
                  <textarea
                    disabled={readOnly}
                    onChange={(ev) => editar(tipo.key, "acreditacion", ev.target.value)}
                    placeholder={ACREDITACION_TIPICA[tipo.key]}
                    rows={filasTextarea(e?.acreditacion ?? "")}
                    value={e?.acreditacion ?? ""}
                  />
                </label>
              ) : null}

              {/* Solo los facultativos se sustentan: son los únicos que la DEC
                  puede excluir tras la interacción con el mercado. */}
              {estado === "facultativo" ? (
                <label className="reqCalCampo">
                  <span>Sustento: ¿por qué se exige este facultativo?</span>
                  <textarea
                    disabled={readOnly}
                    onChange={(ev) => editar(tipo.key, "sustento", ev.target.value)}
                    placeholder="Sin sustento, la DEC puede excluirlo si el mercado muestra que no es necesario."
                    rows={filasTextarea(e?.sustento ?? "")}
                    value={e?.sustento ?? ""}
                  />
                </label>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Datos heredados del texto libre anterior: no se borran solos. */}
      {hayHeredados ? (
        <div className="reqCalHeredados">
          <p>
            <AlertTriangle size={12} /> Estos requisitos vienen de un registro anterior en texto
            libre y no corresponden a ninguno de los cinco tipos del Art. 72.3. Reemplázalos por el
            tipo que corresponda y elimínalos.
          </p>
          {[...otrosObligatorios.map((n) => ({ nombre: n, fac: false })),
            ...otrosFacultativos.map((f) => ({ nombre: f.nombre, fac: true }))].map((item, i) => (
            <div className="reqCalRow" key={`${item.nombre}-${i}`}>
              <span>
                {item.nombre} <em>{item.fac ? "(facultativo)" : "(obligatorio)"}</em>
              </span>
              {!readOnly ? (
                <button
                  aria-label={`Eliminar ${item.nombre}`}
                  className="segCronoRemove"
                  onClick={() =>
                    emit(
                      porTipo,
                      otrosObligatorios.filter((n) => !(n === item.nombre && !item.fac)),
                      otrosFacultativos.filter((f) => !(f.nombre === item.nombre && item.fac)),
                    )
                  }
                  type="button"
                >
                  <Trash2 size={13} />
                </button>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
