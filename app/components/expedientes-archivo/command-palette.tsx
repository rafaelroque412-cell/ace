"use client";

import { memo, useState, useEffect, useRef, useMemo } from "react";
import {
  Search,
  X,
  UploadCloud,
  FileText,
  HelpCircle,
  Download,
  MessageCircle,
} from "lucide-react";
import type { ExpedienteItem } from "./types";

export type CommandAction = {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  shortcut?: string;
  onSelect: () => void;
  group: "expedientes" | "acciones";
};

type Props = {
  open: boolean;
  onClose: () => void;
  expedientes: ExpedienteItem[];
  onOpenExpediente: (exp: ExpedienteItem) => void;
  onGoToSubir: () => void;
  onShowHelp: () => void;
  onOpenChat: () => void;
};

export const CommandPalette = memo(function CommandPalette({
  open,
  onClose,
  expedientes,
  onOpenExpediente,
  onGoToSubir,
  onShowHelp,
  onOpenChat,
}: Props) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 10);
  }, []);

  const baseActions: CommandAction[] = useMemo(
    () => [
      {
        id: "go-subir",
        label: "Ir a Subir expediente",
        description: "Abre la pestaña para subir un nuevo PDF",
        icon: <UploadCloud size={16} />,
        shortcut: "Ctrl+U",
        onSelect: () => {
          onGoToSubir();
          onClose();
        },
        group: "acciones",
      },
      {
        id: "open-chat",
        label: "Abrir chat con IA",
        description: "Panel lateral para conversación multi-turno",
        icon: <MessageCircle size={16} />,
        shortcut: "Ctrl+I",
        onSelect: () => {
          onOpenChat();
          onClose();
        },
        group: "acciones",
      },
      {
        id: "export-csv",
        label: "Exportar inventario CSV",
        description: "Descarga todos los expedientes filtrados",
        icon: <Download size={16} />,
        onSelect: () => {
          window.open("/api/expedientes-archivo/export?formato=csv", "_blank");
          onClose();
        },
        group: "acciones",
      },
      {
        id: "show-help",
        label: "Ver atajos de teclado",
        description: "Abre la lista de atajos disponibles",
        icon: <HelpCircle size={16} />,
        shortcut: "?",
        onSelect: () => {
          onShowHelp();
          onClose();
        },
        group: "acciones",
      },
    ],
    [onGoToSubir, onOpenChat, onShowHelp, onClose],
  );

  const expedienteResults: CommandAction[] = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    const matches = expedientes
      .filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          (e.materia ?? "").toLowerCase().includes(q) ||
          (e.oficina ?? "").toLowerCase().includes(q) ||
          (e.asunto ?? "").toLowerCase().includes(q) ||
          (e.serie_documento ?? "").toLowerCase().includes(q) ||
          String(e.anio ?? "").includes(q),
      )
      .slice(0, 8)
      .map<CommandAction>((e) => ({
        id: `exp-${e.id}`,
        label: e.title,
        description: [
          e.anio ? `${e.anio}` : null,
          e.oficina,
          e.materia,
          e.status,
        ]
          .filter(Boolean)
          .join(" · "),
        icon: <FileText size={16} />,
        onSelect: () => {
          onOpenExpediente(e);
          onClose();
        },
        group: "expedientes",
      }));
    return matches;
  }, [query, expedientes, onOpenExpediente, onClose]);

  const filteredActions: CommandAction[] = useMemo(() => {
    if (!query.trim()) return baseActions;
    const q = query.toLowerCase();
    return baseActions.filter(
      (a) => a.label.toLowerCase().includes(q) || (a.description ?? "").toLowerCase().includes(q),
    );
  }, [baseActions, query]);

  const allItems = [...expedienteResults, ...filteredActions];

  useEffect(() => {
    if (activeIndex >= allItems.length && allItems.length > 0) {
      setActiveIndex(0);
    }
  }, [allItems.length, activeIndex]);

  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(`[data-cmd-idx="${activeIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((i) => Math.min(allItems.length - 1, i + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => Math.max(0, i - 1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const item = allItems[activeIndex];
      if (item) item.onSelect();
    } else if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    }
  }

  if (!open) return null;

  return (
    <div className="expCmdOverlay" onClick={onClose} role="dialog" aria-label="Búsqueda rápida">
      <div className="expCmd" onClick={(e) => e.stopPropagation()}>
        <div className="expCmd-header">
          <Search size={18} />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={onKeyDown}
            placeholder="Busca un expediente o una acción…"
            className="expCmd-input"
            aria-label="Búsqueda rápida"
          />
          <kbd style={{ fontSize: 11, color: "var(--exp-muted)" }}>Esc</kbd>
        </div>
        <ul className="expCmd-list" ref={listRef}>
          {allItems.length === 0 ? (
            <li className="expCmd-empty">
              Sin resultados para &ldquo;{query}&rdquo;
            </li>
          ) : (
            <>
              {expedienteResults.length > 0 ? (
                <li className="expCmd-group" aria-hidden="true">
                  Expedientes ({expedienteResults.length})
                </li>
              ) : null}
              {expedienteResults.map((item, idx) => (
                <li
                  key={item.id}
                  data-cmd-idx={idx}
                  className={`expCmd-item ${idx === activeIndex ? "active" : ""}`}
                  onMouseEnter={() => setActiveIndex(idx)}
                  onClick={item.onSelect}
                >
                  {item.icon}
                  <div className="expCmd-itemBody">
                    <strong>{item.label}</strong>
                    {item.description ? <span>{item.description}</span> : null}
                  </div>
                </li>
              ))}
              {filteredActions.length > 0 ? (
                <li className="expCmd-group" aria-hidden="true">
                  Acciones
                </li>
              ) : null}
              {filteredActions.map((item, idx) => {
                const realIdx = expedienteResults.length + idx;
                return (
                  <li
                    key={item.id}
                    data-cmd-idx={realIdx}
                    className={`expCmd-item ${realIdx === activeIndex ? "active" : ""}`}
                    onMouseEnter={() => setActiveIndex(realIdx)}
                    onClick={item.onSelect}
                  >
                    {item.icon}
                    <div className="expCmd-itemBody">
                      <strong>{item.label}</strong>
                      {item.description ? <span>{item.description}</span> : null}
                    </div>
                    {item.shortcut ? (
                      <span className="expCmd-shortcut">
                        {item.shortcut.split("+").map((k, i) => (
                          <kbd key={i}>{k.trim()}</kbd>
                        ))}
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </>
          )}
        </ul>
        <div className="expCmd-footer">
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd> navegar
          </span>
          <span>
            <kbd>Enter</kbd> seleccionar
          </span>
          <span>
            <kbd>Esc</kbd> cerrar
          </span>
          <span className="expCmd-hint">
            <X size={12} /> Click fuera
          </span>
        </div>
      </div>
    </div>
  );
});
