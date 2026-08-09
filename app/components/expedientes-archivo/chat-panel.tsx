"use client";

import { memo, useState, useRef, useEffect } from "react";
import { Bot, Sparkles, Send } from "lucide-react";
import { ExpSlideOver } from "./slide-over-shell";
import type { ChatPanelProps } from "./types";

export const ChatPanel = memo(function ChatPanel({ query, onClose, onAsk, searching, messages, onOpenExpediente }: ChatPanelProps) {
  const [draft, setDraft] = useState(query);
  const lastSyncedQueryRef = useRef(query);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (query !== lastSyncedQueryRef.current) {
      lastSyncedQueryRef.current = query;
      setDraft(query);
    }
  }, [query]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function submit() {
    const text = draft.trim();
    if (!text || searching) return;
    setDraft("");
    void onAsk(text);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submit();
    }
  }

  const lastAi = [...messages].reverse().find((m) => m.role === "ai");
  const showSuggestion = !searching && lastAi && (!lastAi.sources || lastAi.sources.length === 0);

  // Escape, foco atrapado y bloqueo de scroll los aporta ExpSlideOver (Radix).
  return (
    <ExpSlideOver
      clasePanel="expChatPanel"
      etiquetaCerrar="Cerrar chat"
      onClose={onClose}
      subtitulo="Pregunta en lenguaje natural sobre los expedientes"
      titulo="Chat con IA"
    >
        <div className="expChat-body">
          {messages.length === 0 ? (
            <div className="expChatEmpty">
              <div className="expChatEmpty-icon">
                <Bot size={24} />
              </div>
              <p>Pregúntame lo que quieras sobre los expedientes archivados.</p>
              <p className="expChatEmpty-hint">Ejemplos para empezar</p>
              <ul className="expChatEmpty-examples">
                <li
                  onClick={() => setDraft("¿Cuántos expedientes de contratación hay en 2024?")}
                >
                  ¿Cuántos expedientes de contratación hay en 2024?
                </li>
                <li
                  onClick={() =>
                    setDraft("¿Dónde está el expediente de la licencia 2024-0345?")
                  }
                >
                  ¿Dónde está el expediente de la licencia 2024-0345?
                </li>
                <li
                  onClick={() =>
                    setDraft("Resúmeme los expedientes de subgerencia de tránsito")
                  }
                >
                  Resúmeme los expedientes de subgerencia de tránsito
                </li>
              </ul>
            </div>
          ) : (
            <>
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`expChat-msg ${m.role}`}
                >
                  <div className="expChat-avatar">
                    {m.role === "user" ? "Tú" : <Bot size={14} />}
                  </div>
                  <div className="expChat-bubble">
                    <p style={{ margin: 0 }}>{m.text}</p>
                    {m.sources && m.sources.length > 0 ? (
                      <div className="expChat-sources">
                        {m.sources.map((s, j) => (
                          <button
                            key={j}
                            type="button"
                            className="expCitation"
                            onClick={() => onOpenExpediente(s.expedienteId)}
                            style={{ width: "100%" }}
                          >
                            <span className="expCitationNumber">{j + 1}</span>
                            <span className="expCitationTitle">{s.title}</span>
                            <span className="expCitationSource">{s.citation}</span>
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
              {searching ? (
                <div className="expChat-msg ai">
                  <div className="expChat-avatar">
                    <Bot size={14} />
                  </div>
                  <div className="expChat-bubble">
                    <p className="expChat-thinking" style={{ margin: 0 }}>
                      <Sparkles size={14} /> Pensando…
                    </p>
                  </div>
                </div>
              ) : null}
              {showSuggestion ? (
                <div className="expChat-suggestion">
                  <Sparkles size={16} />
                  <div>
                    <strong>No encontré coincidencias claras</strong>
                    <p>
                      Prueba con otros términos, o sube un nuevo expediente desde la pestaña
                      Subir.
                    </p>
                  </div>
                </div>
              ) : null}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>
        <div className="expChat-input">
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Escribe tu pregunta… (Enter envía, Shift+Enter nueva línea)"
            rows={2}
            disabled={searching}
          />
          <button
            type="button"
            className="expBtn expBtn-primary"
            onClick={() => void submit()}
            disabled={!draft.trim() || searching}
          >
            <Send size={16} /> Preguntar
          </button>
        </div>
    </ExpSlideOver>
  );
});
