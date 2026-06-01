"use client";

import { useState } from "react";
import { Bot, Send, ShieldCheck } from "lucide-react";

type ChatSource = {
  chunkId: string;
  documentTitle: string;
  documentType: string;
  sourceEntity: string | null;
  chunkIndex: number;
  score: number;
  excerpt: string;
};

type ChatResponse = {
  answer?: string;
  error?: string;
  model?: string;
  sources?: ChatSource[];
};

export function LegalChat() {
  const [answer, setAnswer] = useState(
    "Haz una consulta sobre documentos ya indexados. La respuesta incluira sustento y fuentes.",
  );
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState("tecnica");
  const [question, setQuestion] = useState("");
  const [sources, setSources] = useState<ChatSource[]>([]);

  async function submitQuestion(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (question.trim().length < 5) {
      setAnswer("Escribe una pregunta mas especifica.");
      return;
    }

    setLoading(true);
    setAnswer("Buscando fuentes y generando respuesta...");
    setSources([]);

    try {
      const response = await fetch("/api/chat", {
        body: JSON.stringify({
          mode,
          question,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const payload = (await response.json()) as ChatResponse;

      if (!response.ok) {
        setAnswer(payload.error ?? "No se pudo responder la consulta.");
        return;
      }

      setAnswer(payload.answer ?? "No se genero respuesta.");
      setSources(payload.sources ?? []);
    } catch {
      setAnswer("No se pudo conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="chatPanel" id="chat">
      <div className="panelHeader">
        <div>
          <p className="eyebrow">Consulta legal</p>
          <h2>Chat juridico</h2>
        </div>
        <ShieldCheck size={22} />
      </div>

      <div className="conversation">
        <div className="message user">
          {question || "Que dice la documentacion indexada sobre impedimentos?"}
        </div>
        <div className="message assistant">{answer}</div>
      </div>

      <form className="promptBox" onSubmit={submitQuestion}>
        <select
          aria-label="Modo de respuesta"
          onChange={(event) => setMode(event.target.value)}
          value={mode}
        >
          <option value="tecnica">Tecnica</option>
          <option value="breve">Breve</option>
          <option value="informe">Informe</option>
          <option value="checklist">Checklist</option>
        </select>
        <input
          aria-label="Pregunta juridica"
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Escribe una consulta sobre Ley 32069, reglamento u OECE..."
          value={question}
        />
        <button disabled={loading} type="submit">
          {loading ? <Bot size={18} /> : <Send size={18} />}
          {loading ? "Consultando..." : "Consultar"}
        </button>
      </form>

      {sources.length > 0 ? (
        <div className="sourceList">
          <strong>Fuentes recuperadas</strong>
          {sources.map((source, index) => (
            <article className="sourceItem" key={source.chunkId}>
              <div>
                <span>Fuente {index + 1}</span>
                <strong>{source.documentTitle}</strong>
                <small>
                  {source.documentType} · {source.sourceEntity ?? "Sin entidad"} · fragmento{" "}
                  {source.chunkIndex + 1}
                </small>
              </div>
              <p>{source.excerpt}</p>
            </article>
          ))}
        </div>
      ) : null}
    </div>
  );
}
