"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Info, Loader, Trash2 } from "lucide-react";
import {
  ACREDITACION_TIPICA,
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
import {
  ACREDITACION_EXPERIENCIA,
  componerExperienciaPostor,
  montoDeExperiencia,
  objetoConvocatoria,
  similaresDeExperiencia,
} from "@/lib/requisitos-experiencia";
import { ACREDITACION_PERSONAL_CLAVE } from "@/lib/personal-clave";
import { PersonalClaveEditor } from "./personal-clave-editor";
import { tienePrecalificacion } from "@/lib/procesos-seleccion";
import { Sparkles } from "lucide-react";
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
  moneda,
  necesidadId,
  personalClaveExperiencia,
  personalClaveAcreditacion,
  onCampoFicha,
  tipoProceso,
  requisitosModelo,
}: {
  value: string;
  onChange: (next: string) => void;
  readOnly?: boolean;
  /** Para pedir a la IA la propuesta de servicios similares. */
  necesidadId?: string;
  /**
   * Experiencia del personal clave (Art. 72.3.b), como cuadro serializado. Se
   * registra DENTRO de la tarjeta de experiencia del postor, pero se guarda en
   * una columna propia de la necesidad, no en el texto canónico de requisitos:
   * por eso llega y se escribe por fuera del `value`/`onChange` del editor.
   */
  personalClaveExperiencia?: string;
  /** Texto de cómo se acredita la experiencia del personal clave (fijo del formato). */
  personalClaveAcreditacion?: string;
  /** Escribe un campo suelto de la ficha (el cuadro del personal clave). */
  onCampoFicha?: (api: string, valor: string) => void;
  // Objeto contractual: la ayuda de capacidad técnica y experiencia cambia en
  // obras (Art. 72.3.b + Art. 157). undefined = ayuda genérica.
  objeto?: string | null;
  /** Cuantía de la contratación: sin ella no se puede calcular el tope de 3x. */
  montoEstimado?: number | null;
  /** Moneda de la convocatoria: la frase de experiencia se redacta en ella. */
  moneda?: string | null;
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
  // El monto facturado que exige la experiencia del postor. No tiene columna
  // propia: se compone dentro del detalle y se relee de él, como el resto de
  // este módulo (texto canónico). Se guarda lo TECLEADO para no perder los
  // decimales a medio escribir; se re-sincroniza solo cuando el valor cambia por
  // fuera (traer datos de IA, recarga).
  const [montoExp, setMontoExp] = useState<string>(() =>
    montoDeExperiencia(repartirRequisitos(parseRequisitos(value)).porTipo.get("experiencia_postor")?.detalle ?? ""),
  );
  // Qué se considera similar al objeto convocado: la segunda frase del requisito.
  // Tampoco tiene columna; se relee del detalle, igual que el monto.
  const [similaresExp, setSimilaresExp] = useState<string>(() =>
    similaresDeExperiencia(repartirRequisitos(parseRequisitos(value)).porTipo.get("experiencia_postor")?.detalle ?? ""),
  );
  useEffect(() => {
    if (value !== emitidoRef.current) {
      const next = repartirRequisitos(parseRequisitos(value));
      setReparto(next);
      const detExp = next.porTipo.get("experiencia_postor")?.detalle ?? "";
      setMontoExp(montoDeExperiencia(detExp));
      setSimilaresExp(similaresDeExperiencia(detExp));
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

  // Propuesta de la IA para «servicios similares». A diferencia del resto de la
  // experiencia —que es texto fijo y se compone—, qué se considera similar es un
  // juicio abierto sobre el objeto, así que SÍ se le pide al modelo. Es una
  // propuesta: rellena el campo, que el usuario revisa. Si falla, se conserva lo
  // que hubiera y se avisa; nunca se borra con una respuesta en blanco.
  const [proponiendo, setProponiendo] = useState(false);
  const [errorSimilares, setErrorSimilares] = useState("");
  async function proponerSimilares() {
    if (!necesidadId || readOnly) return;
    setProponiendo(true);
    setErrorSimilares("");
    try {
      const res = await fetch(`/api/necesidades/${necesidadId}/servicios-similares`, { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.texto) {
        setErrorSimilares(data?.error ?? "No se pudo proponer. Escríbelo a mano.");
        return;
      }
      setSimilaresExp(data.texto);
    } catch {
      setErrorSimilares("No se pudo conectar. Escríbelo a mano.");
    } finally {
      setProponiendo(false);
    }
  }

  // «Redactar con IA» de la experiencia del postor. Como la forma de pago o la
  // recepción, se COMPONE con el texto del formato en vez de pedírselo al
  // modelo: es texto reglamentario con un solo hueco, el monto. El monto y su
  // versión en letras salen del número tecleado, en la moneda de la convocatoria.
  function redactarExperiencia() {
    // Se rellenan LOS DOS campos a la vez: el detalle (qué se exige, con el
    // monto y lo similar) y la acreditación (cómo se prueba), que es texto fijo
    // del formato. Un solo `emit` para no dejar la ficha en un estado a medias.
    const next = new Map(porTipo);
    const actual = next.get("experiencia_postor") ?? {
      estado: "obligatorio" as EstadoRequisito,
      detalle: "",
      acreditacion: "",
      sustento: "",
    };
    next.set("experiencia_postor", {
      ...actual,
      detalle: componerExperienciaPostor({ monto: montoExp, moneda, objeto, similares: similaresExp }),
      acreditacion: ACREDITACION_EXPERIENCIA,
    });
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
              {/* Experiencia del postor: el monto facturado es un NÚMERO con
                  decimales, y de él sale la frase entera del formato —cifra y
                  letras, en la moneda de la convocatoria—. Se registra aquí y
                  «Redactar con IA» lo compone en el detalle de abajo. */}
              {tipo.key === "experiencia_postor" && estado !== "no" ? (
                <>
                  {/* Monto y «qué se considera similar», en UNA fila: el monto es
                      una cifra corta y no necesita todo el ancho. */}
                  <div className="reqCalExperienciaFila">
                    <label className="reqCalCampo reqCalMonto">
                      <span>Monto facturado acumulado exigido</span>
                      <input
                        disabled={readOnly}
                        inputMode="decimal"
                        min={0}
                        onChange={(ev) => setMontoExp(ev.target.value)}
                        placeholder="Ej. 180000.00"
                        step="0.01"
                        type="number"
                        value={montoExp}
                      />
                    </label>
                    <label className="reqCalCampo reqCalSimilares">
                      <span className="reqCalSpanConBoton">
                        {`¿Qué se considera ${objetoConvocatoria(objeto)} similar al objeto convocado?`}
                        {necesidadId ? (
                          <button
                            className="reqCalRedactar"
                            disabled={readOnly || proponiendo}
                            onClick={proponerSimilares}
                            title="Que la IA proponga qué se considera similar, a partir del objeto de la contratación"
                            type="button"
                          >
                            {proponiendo ? <Loader className="reqCalSpin" size={12} /> : <Sparkles size={12} />}
                            {proponiendo ? "Proponiendo…" : "Proponer con IA"}
                          </button>
                        ) : null}
                      </span>
                      <textarea
                        disabled={readOnly}
                        onChange={(ev) => setSimilaresExp(ev.target.value)}
                        placeholder="Ej. mantenimiento de áreas verdes, jardinería y afines."
                        rows={2}
                        value={similaresExp}
                      />
                      {errorSimilares ? <span className="reqCalAvisoTope" role="status">{errorSimilares}</span> : null}
                    </label>
                  </div>
                  <button
                    className="reqCalRedactar"
                    disabled={readOnly}
                    onClick={redactarExperiencia}
                    title="Redactar el requisito con el texto del formato (Art. 72.3.c)"
                    type="button"
                  >
                    <Sparkles size={12} /> Redactar con IA
                  </button>
                </>
              ) : null}
              {estado !== "no" ? (
                <label className="reqCalCampo">
                  <span>¿Qué se exige exactamente?</span>
                  <textarea
                    disabled={readOnly}
                    onChange={(ev) => editar(tipo.key, "detalle", ev.target.value)}
                    placeholder={`Ej. ${tipo.ejemplo}`}
                    // La experiencia del postor se compone («Redactar con IA») y
                    // es texto largo: se muestra en una caja baja con scroll, no
                    // ocupando media pantalla. El resto de tipos crece con su
                    // contenido, como antes.
                    rows={tipo.key === "experiencia_postor" ? 3 : filasTextarea(e?.detalle ?? "")}
                    value={e?.detalle ?? ""}
                  />
                  {/* Topes del modelo. Se avisa, no se bloquea: esto es una PROPUESTA del
                      area usuaria y quien establece los requisitos es la DEC (Art. 72.1).
                      Impedir escribir la cifra seria arrogarse esa decision. */}
                  {(tipo.key === "experiencia_postor" || tipo.key === "capacidad_tecnica")
                    ? avisosDeTopes(
                        // El monto tecleado se suma al detalle para que el tope
                        // de 3x avise ya, antes de componer el texto.
                        tipo.key === "experiencia_postor" ? `${e?.detalle ?? ""} ${montoExp}` : e?.detalle ?? "",
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

              {/* CAPACIDAD TÉCNICA Y PROFESIONAL · Experiencia del personal clave
                  (Art. 72.3.b). La entidad la pide DENTRO de la experiencia del
                  postor, así que va aquí, tras «¿Con qué se acredita?». El texto
                  lo fija el formato y tiene tres huecos; «Redactar con IA» lo
                  compone con ellos. Se guarda en columnas propias de la
                  necesidad (personalClave*), por eso escribe con `onCampoFicha`. */}
              {tipo.key === "experiencia_postor" && estado !== "no" && onCampoFicha ? (
                <div className="reqCalPersonalClave">
                  <p className="reqCalPersonalClaveTitulo">Capacidad técnica y profesional · Experiencia del personal clave</p>
                  <p className="reqCalPersonalClaveAyuda">
                    Un puesto por fila. En el requerimiento sale como cuadro (Art. 72.3.b).
                  </p>
                  <PersonalClaveEditor
                    onChange={(next) => onCampoFicha("personalClaveExperiencia", next)}
                    readOnly={readOnly}
                    value={personalClaveExperiencia ?? ""}
                  />
                  {/* Cómo se acredita: texto fijo del formato. «Redactar con IA»
                      lo rellena; se puede ajustar a mano. */}
                  <label className="reqCalCampo">
                    <span className="reqCalSpanConBoton">
                      ¿Cómo se acredita la experiencia del personal clave?
                      <button
                        className="reqCalRedactar"
                        disabled={readOnly}
                        onClick={() => onCampoFicha("personalClaveAcreditacion", ACREDITACION_PERSONAL_CLAVE)}
                        title="Rellenar con el texto estándar del formato (Anexo N° 19)"
                        type="button"
                      >
                        <Sparkles size={12} /> Redactar con IA
                      </button>
                    </span>
                    <textarea
                      disabled={readOnly}
                      onChange={(ev) => onCampoFicha("personalClaveAcreditacion", ev.target.value)}
                      placeholder="Pulsa «Redactar con IA» para el texto estándar del Anexo N° 19."
                      rows={4}
                      value={personalClaveAcreditacion ?? ""}
                    />
                  </label>
                </div>
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
