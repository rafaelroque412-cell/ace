"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Database,
  FileText,
  FolderTree,
  Layers,
  LoaderCircle,
  MessageSquare,
  Play,
  RefreshCw,
  Users,
} from "lucide-react";

type Metrics = {
  documents: { total: number; uploaded: number; processing: number; indexed: number; error: number };
  stuck: number;
  chunks: number;
  articulos: number;
  summaries: number;
  concordancias: number;
  chat_sessions: number;
  chat_messages: number;
  boletin: number;
  seguimientos: number;
  guardados: number;
  eval_preguntas: number;
  eval_corridas: number;
  users: { total: number; admins: number; editors: number; users: number };
};
type DocError = { id: string; title: string; error_message: string | null; updated_at: string };
type Activity = {
  id: string;
  action: string;
  entity_type: string;
  details: Record<string, unknown>;
  created_at: string;
};

export function MetricsDashboard() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [errors, setErrors] = useState<DocError[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [draining, setDraining] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function reload() {
    const payload = await fetch("/api/metrics").then((response) => response.json());
    setMetrics(payload.metrics ?? null);
    setErrors(payload.recentErrors ?? []);
    setActivity(payload.recentActivity ?? []);
    setLoading(false);
  }

  useEffect(() => {
    void reload();
  }, []);

  async function drain() {
    setDraining(true);
    setMessage(null);
    try {
      const summary = await fetch("/api/documents/drain", { method: "POST" }).then((response) => response.json());
      if (summary.error) {
        setMessage(summary.error);
      } else {
        setMessage(
          summary.scanned === 0
            ? "No hay documentos atascados."
            : `Procesados ${summary.processed}/${summary.scanned} (errores: ${summary.failed}).`,
        );
      }
      await reload();
    } finally {
      setDraining(false);
    }
  }

  if (loading) {
    return (
      <div className="emptyState">
        <span>Cargando...</span>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="emptyState">
        <AlertTriangle size={20} />
        <span>No se pudieron cargar las métricas.</span>
      </div>
    );
  }

  const cards = [
    { icon: FileText, label: "Documentos", value: metrics.documents.total, hint: `${metrics.documents.indexed} indexados` },
    { icon: Layers, label: "Chunks (Pinecone)", value: metrics.chunks, hint: `${metrics.articulos} artículos` },
    { icon: Database, label: "Resúmenes", value: metrics.summaries, hint: `${metrics.concordancias} concordancias` },
    { icon: MessageSquare, label: "Sesiones de chat", value: metrics.chat_sessions, hint: `${metrics.chat_messages} mensajes` },
    { icon: FolderTree, label: "Guardados", value: metrics.guardados, hint: `${metrics.seguimientos} seguimientos` },
    { icon: Users, label: "Usuarios", value: metrics.users.total, hint: `${metrics.users.admins} admin · ${metrics.users.editors} editor` },
  ];

  return (
    <div className="evalLayout">
      <div className="evalStats">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <article className="statCard" key={card.label}>
              <Icon size={18} />
              <span className="statLabel">{card.label}</span>
              <strong>{card.value}</strong>
              <span className="statHint">{card.hint}</span>
            </article>
          );
        })}
      </div>

      <section className="toolPanel">
        <div className="toolPanelHeader">
          <div>
            <p className="eyebrow">Cola de indexación</p>
            <h2>Estado del pipeline</h2>
          </div>
          <div className="metricActions">
            <button className="secondaryButton compactButton" onClick={reload} type="button">
              <RefreshCw size={15} />
              Refrescar
            </button>
            <button className="primaryButton" disabled={draining} onClick={drain} type="button">
              {draining ? <LoaderCircle size={16} /> : <Play size={16} />}
              {draining ? "Drenando..." : "Drenar cola"}
            </button>
          </div>
        </div>
        <div className="indexPipeline">
          <span className="pipePill pipeUploaded">{metrics.documents.uploaded} en cola</span>
          <span className="pipePill pipeProcessing">{metrics.documents.processing} procesando</span>
          <span className="pipePill pipeIndexed">{metrics.documents.indexed} indexados</span>
          <span className="pipePill pipeError">{metrics.documents.error} con error</span>
          {metrics.stuck > 0 ? (
            <span className="pipePill pipeStuck">
              <AlertTriangle size={13} /> {metrics.stuck} atascados
            </span>
          ) : null}
        </div>
        {message ? <p className="metricMessage">{message}</p> : null}
      </section>

      <div className="evalGrid">
        <section className="toolPanel">
          <div className="toolPanelHeader">
            <div>
              <p className="eyebrow">Indexación</p>
              <h2>Documentos con error</h2>
            </div>
          </div>
          <div className="documentList">
            {errors.length === 0 ? (
              <div className="emptyState">
                <span>Sin documentos en error.</span>
              </div>
            ) : (
              errors.map((doc) => (
                <article className="evalResult" key={doc.id}>
                  <strong>{doc.title}</strong>
                  <p>{doc.error_message ?? "Error desconocido"}</p>
                  <span className="statHint">{new Date(doc.updated_at).toLocaleString("es-PE")}</span>
                </article>
              ))
            )}
          </div>
        </section>

        <aside className="toolPanel">
          <div className="toolPanelHeader">
            <div>
              <p className="eyebrow">Trazabilidad</p>
              <h2>Actividad reciente</h2>
            </div>
          </div>
          <div className="auditList">
            {activity.map((item) => (
              <div className="auditRow" key={item.id}>
                <span className="auditAction">{item.action}</span>
                <span className="auditMeta">{item.entity_type}</span>
                <span className="auditTime">{new Date(item.created_at).toLocaleString("es-PE")}</span>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
