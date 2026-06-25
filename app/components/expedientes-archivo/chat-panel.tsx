"use client";

import { useState, useRef, useEffect } from "react";
import { Bot, X, Sparkles } from "lucide-react";
import type { ChatPanelProps } from "./types";

export function ChatPanel({ query, onClose, onAsk, searching, messages, onOpenExpediente }: ChatPanelProps) {
  const [draft, setDraft] = useState(query);
  const lastSyncedQueryRef = useRef(query);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Sincronizar el draft con la query externa (solo si realmente cambió).
  // El ref evita re-sincronizar cuando el usuario ya está escribiendo.
  useEffect(() => {
    if (query !== lastSyncedQueryRef.current) {
      lastSyncedQueryRef.current = query;
      setDraft(query);
    }
  }, [query]);

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

  return (
    <div className="subirSlideOverOverlay" onClick={onClose}>
      <aside
        className="subirChatPanel"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Chat con IA"
      >
        <header className="subirSlideOverHead">
          <div>
            <strong>Chat con IA</strong>
            <span>Pregunta en lenguaje natural sobre los expedientes</span>
          </div>
          <button
            type="button"
            className="subirSlideOverClose"
            onClick={onClose}
            aria-label="Cerrar chat"
          >
            <X size={18} />
          </button>
        </header>
        <div className="subirChatBody">
          {messages.length === 0 ? (
            <div className="subirChatEmpty">
              <Bot size={28} />
              <p>Pregúntame lo que quieras sobre los expedientes archivados.</p>
              <p className="subirChatHint">Ejemplos:</p>
              <ul>
                <li>&ldquo;¿Cuántos expedientes de contratación hay en 2024?&rdquo;</li>
                <li>&ldquo;¿Dónde está el expediente de la licencia 2024-0345?&rdquo;</li>
                <li>&ldquo;Resúmeme los expedientes de subgerencia de tránsito&rdquo;</li>
              </ul>
            </div>
          ) : (
            messages.map((m, i) => (
              <div key={i} className={`subirChatMsg ${m.role === "user" ? "user" : "ai"}`}>
                <div className="subirChatMsgAvatar">
                  {m.role === "user" ? "Tú" : <Bot size={14} />}
                </div>
                <div className="subirChatMsgBody">
                  <p>{m.text}</p>
                  {m.sources && m.sources.length > 0 ? (
                    <div className="subirChatSources">
                      {m.sources.map((s, j) => (
                        <button
                          key={j}
                          type="button"
                          className="subirSourceChip"
                          onClick={() => onOpenExpediente(s.expedienteId)}
                        >
                          <span className="subirSourceChipBadge">[{j + 1}]</span>
                          <span className="subirSourceChipTitle">{s.title}</span>
                          <span className="subirSourceChipCitation">{s.citation}</span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            ))
          )}
          {searching ? (
            <div className="subirChatMsg ai">
              <div className="subirChatMsgAvatar"><Bot size={14} /></div>
              <div className="subirChatMsgBody">
                <p className="subirChatThinking">
                  <Sparkles size={14} /> Pensando…
                </p>
              </div>
            </div>
          ) : null}
          {showSuggestion ? (
            <div className="subirChatSuggestion">
              <Sparkles size={14} />
              <div>
                <strong>No encontré coincidencias claras</strong>
                <p>Prueba con otros términos, o sube un nuevo expediente desde la pestaña Subir.</p>
              </div>
            </div>
          ) : null}
        </div>
        <div className="subirChatInput">
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
            className="primaryButton"
            onClick={() => void submit()}
            disabled={!draft.trim() || searching}
          >
            Preguntar
          </button>
        </div>
      </aside>
    </div>
  );
}
