"use client";

import { AlertTriangle, CheckCircle2, CircleDashed, Info } from "lucide-react";
import type { LiteralExpediente } from "@/lib/expediente-contenido";
import type { NivelControl, TarjetaControl } from "@/lib/torre-control";
import { cuantasBloquean } from "@/lib/torre-control";
import { hitoLabel } from "@/lib/procurement-fases";

const ICONO: Record<NivelControl, typeof Info> = {
  ok: CheckCircle2,
  warn: AlertTriangle,
  stop: AlertTriangle,
  mute: CircleDashed,
};

/**
 * Estado del expediente, antes de las diez fases.
 *
 * Al abrir un expediente lo primero que aparecía era el paso 1. Pero ninguna de
 * las contradicciones reales vive dentro de UN paso: el valor estimado lo fija
 * A5, la línea de corte la usa A2, la certificación la comprueba A7 y la fecha
 * requerida vive en la Necesidad. Cada paso estaba "correcto" por separado y el
 * expediente entero no.
 *
 * Son tarjetas y no una lista de avisos porque cada una es una PAREJA de datos
 * que se contradicen, y hay que ver los dos juntos: "S/ 285,924 frente a
 * S/ 90,000" se entiende sin leer.
 */
export function TorreControl({
  tarjetas,
  faltan,
  onAbrirPaso,
}: {
  tarjetas: TarjetaControl[];
  /**
   * Literales del Art. 54.2 aún incumplidos para aprobar el expediente (A8).
   * Antes solo se veían al abrir A8; subirlos aquí muestra desde arriba qué
   * pasos completar y por qué, sin cazar el dato dentro del último paso.
   */
  faltan?: LiteralExpediente[];
  /** Abre el paso que resuelve la tarjeta. */
  onAbrirPaso?: (code: string) => void;
}) {
  const bloquean = cuantasBloquean(tarjetas);
  const pendientes = faltan ?? [];

  return (
    <section aria-label="Estado del expediente" className="torre">
      <header className="torreHead">
        <h3>Estado del expediente</h3>
        {bloquean > 0 ? (
          <span className="torrePill torrePillStop">
            {bloquean === 1 ? "1 cosa bloquea" : `${bloquean} cosas bloquean`}
          </span>
        ) : (
          <span className="torrePill torrePillOk">Sin contradicciones</span>
        )}
      </header>

      <div className="torreGrid">
        {tarjetas.map((t) => {
          const Icono = ICONO[t.nivel];
          return (
            <article className={`torreCard torreCard-${t.nivel}`} key={t.clave}>
              <p className="torreLabel">
                <Icono size={12} /> {t.etiqueta}
              </p>
              <p className="torreValor">{t.valor}</p>
              <p className="torreNota">{t.nota}</p>
              {/* Solo hay botón si hay algo que resolver: en una tarjeta
                  conforme sería una invitación a tocar lo que ya está bien. */}
              {t.paso && onAbrirPaso && (t.nivel === "stop" || t.nivel === "warn") ? (
                <button className="torreIr" onClick={() => onAbrirPaso(t.paso!)} type="button">
                  Ir a {hitoLabel(t.paso)}
                </button>
              ) : null}
            </article>
          );
        })}
      </div>

      {/* Qué falta para aprobar el expediente (Art. 54.2). Si no falta nada, no
          se pinta: la píldora "Sin contradicciones" ya lo dice. */}
      {pendientes.length > 0 ? (
        <div className="torreFaltan">
          <p className="torreFaltanTitulo">
            <AlertTriangle size={12} /> Para aprobar el expediente falta (Art. 54.2):
          </p>
          <ul className="torreFaltanLista">
            {pendientes.map((f) => (
              <li className="torreFaltanItem" key={f.literal}>
                <span className="torreFaltanTexto">
                  <strong>{f.literal}</strong> · {f.etiqueta}
                  {f.detalle ? <span className="torreFaltanDetalle"> — {f.detalle}</span> : null}
                </span>
                {f.paso && onAbrirPaso ? (
                  <button
                    className="torreIr"
                    onClick={() => onAbrirPaso(f.paso!)}
                    type="button"
                  >
                    Ir a {hitoLabel(f.paso)}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
