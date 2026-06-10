"use client";

import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Circle,
  CircleDot,
  ListChecks,
  MinusCircle,
  UploadCloud,
  UserRound,
  Users,
} from "lucide-react";
import {
  type EstadoFase,
  type FaseEvaluada,
  type InstruccionExpediente,
} from "@/lib/expediente-instruccion";
import {
  ACTORES,
  MACRO_FASES,
  type MacroFase,
  actorLabel,
  actorSigla,
  macroFaseLabel,
} from "@/lib/actores-contratacion";
import { processDocKindLabel } from "@/lib/legal-taxonomy";

const ESTADO_LABEL: Record<EstadoFase, string> = {
  completa: "Completa",
  en_curso: "En curso",
  pendiente: "Pendiente",
  atencion: "Requiere atención",
  no_aplica: "No aplica",
};

function PhaseIcon({ estado }: { estado: EstadoFase }) {
  if (estado === "completa") {
    return <CheckCircle2 size={18} />;
  }
  if (estado === "en_curso") {
    return <CircleDot size={18} />;
  }
  if (estado === "atencion") {
    return <AlertTriangle size={18} />;
  }
  if (estado === "no_aplica") {
    return <MinusCircle size={18} />;
  }
  return <Circle size={18} />;
}

function PhaseCard({
  canManage,
  fase,
  onSelectKind,
}: {
  canManage: boolean;
  fase: FaseEvaluada;
  onSelectKind?: (kind: string) => void;
}) {
  return (
    <li className="phaseItem" data-estado={fase.estado}>
      <div className="phaseMarker">
        <span className="phaseNumber" data-estado={fase.estado}>
          <PhaseIcon estado={fase.estado} />
        </span>
        <span className="phaseConnector" aria-hidden />
      </div>

      <div className="phaseBody">
        <div className="phaseHead">
          <div className="phaseTitle">
            <span className="phaseStep">Fase {fase.numero}</span>
            <strong>{fase.label}</strong>
          </div>
          <span className="phaseStateChip" data-estado={fase.estado}>
            {ESTADO_LABEL[fase.estado]}
          </span>
        </div>

        <p className="phaseDesc">{fase.descripcion}</p>

        <div className="phaseMeta">
          <span className="phaseResponsable" title={actorLabel(fase.responsable)}>
            <UserRound size={13} />
            {actorLabel(fase.responsable)}
          </span>
          {fase.participantes.length > 0 ? (
            <span className="phaseParticipantes">
              <Users size={13} />
              {fase.participantes.map((id) => actorSigla(id)).join(" · ")}
            </span>
          ) : null}
        </div>

        <ul className="phaseReqs">
          {fase.requisitos.map((req) => (
            <li className="phaseReq" data-ok={req.cumplido} key={`${fase.id}-${req.kind}-${req.label}`}>
              {req.cumplido ? <CheckCircle2 size={14} /> : <Circle size={14} />}
              <span>
                {req.label}
                {!req.obligatorio ? <em className="phaseOptional"> · recomendado</em> : null}
              </span>
              {req.cumplido && req.documentoTitulo ? (
                <small className="phaseReqDoc">{req.documentoTitulo}</small>
              ) : null}
            </li>
          ))}
        </ul>

        {fase.alertas.length > 0 ? (
          <p className="phaseAlert">
            <AlertTriangle size={13} />
            {fase.alertas.join(" ")}
          </p>
        ) : null}

        {canManage && fase.documentosFaltantes.length > 0 ? (
          <div className="phaseActions">
            {fase.documentosFaltantes.map((doc) => (
              <button
                className="phaseUploadButton"
                key={`${fase.id}-up-${doc.kind}-${doc.label}`}
                onClick={() => onSelectKind?.(doc.kind)}
                type="button"
              >
                <UploadCloud size={13} />
                Cargar {processDocKindLabel(doc.kind).toLowerCase()}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </li>
  );
}

function ActorMatrix() {
  return (
    <details className="actorMatrix">
      <summary>
        <Users size={14} />
        Actores por fase (Ley N.° 32069 · D.S. 009-2025-EF)
      </summary>
      <div className="actorMatrixWrap">
        <table className="actorMatrixTable">
          <thead>
            <tr>
              <th>Actor</th>
              {MACRO_FASES.map((macro) => (
                <th key={macro.id}>{macro.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ACTORES.map((act) => (
              <tr key={act.id}>
                <th scope="row" title={act.descripcion}>
                  {act.label}
                </th>
                {MACRO_FASES.map((macro) => {
                  const value = act.participacion[macro.id as MacroFase];
                  return (
                    <td key={macro.id} data-empty={value ? undefined : "true"}>
                      {value ?? "—"}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

export function PhaseTracker({
  canManage = false,
  instruccion,
  onSelectKind,
}: {
  canManage?: boolean;
  instruccion: InstruccionExpediente;
  onSelectKind?: (kind: string) => void;
}) {
  const faseActual = instruccion.fases.find((fase) => fase.esActual);
  const progresoPct = Math.round(instruccion.progreso * 100);

  // Macro-fases presentes en este flujo, en orden, para agrupar las fases.
  const macroFasesPresentes = MACRO_FASES.filter((macro) =>
    instruccion.fases.some((fase) => fase.macroFase === macro.id),
  );

  return (
    <section className="processPanel phaseTracker">
      <div className="processPanelHead">
        <ListChecks size={17} />
        <strong>Instrucción del expediente</strong>
      </div>

      {instruccion.desierto ? (
        <div className="phaseDesiertoBanner">
          <Ban size={16} />
          <span>
            Procedimiento declarado <strong>DESIERTO</strong>: la selección concluyó sin adjudicación. Las
            etapas posteriores a Buena pro no aplican.
          </span>
        </div>
      ) : null}

      <div className="phaseProgress">
        <div className="phaseProgressTop">
          <span>
            {instruccion.fasesCompletas} de {instruccion.totalFases} fases completas
          </span>
          <strong>{progresoPct}%</strong>
        </div>
        <div className="phaseProgressBar">
          <div className="phaseProgressFill" style={{ width: `${progresoPct}%` }} />
        </div>
        <p className="phaseProgressNow">
          {instruccion.desierto
            ? "Procedimiento concluido sin adjudicación (desierto)."
            : faseActual
              ? `Siguiente actuación: Fase ${faseActual.numero} · ${faseActual.label} — responsable: ${actorLabel(faseActual.responsable)}`
              : "Todas las fases obligatorias están completas."}
        </p>
      </div>

      {instruccion.alertasSecuencia.length > 0 ? (
        <div className="phaseSequenceAlerts">
          <div className="phaseSequenceTitle">
            <AlertTriangle size={14} />
            Revisión de secuencia y foliación
          </div>
          <ul>
            {instruccion.alertasSecuencia.map((alerta) => (
              <li key={alerta}>{alerta}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="phaseGroups">
        {macroFasesPresentes.map((macro) => (
          <div className="phaseGroup" key={macro.id}>
            <div className="phaseGroupLabel">{macroFaseLabel(macro.id)}</div>
            <ol className="phaseList">
              {instruccion.fases
                .filter((fase) => fase.macroFase === macro.id)
                .map((fase) => (
                  <PhaseCard canManage={canManage} fase={fase} key={fase.id} onSelectKind={onSelectKind} />
                ))}
            </ol>
          </div>
        ))}
      </div>

      <ActorMatrix />
    </section>
  );
}
