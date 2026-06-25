"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { Search, X, UploadCloud, FileText, HelpCircle, Download } from "lucide-react";
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

export function CommandPalette({
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

  // Reset al montar (el componente se monta solo cuando se abre gracias al `key`
  // en el padre, así que el estado inicial es siempre limpio).
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 10);
  }, []);

  // Acciones siempre disponibles
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
        description: "Panel lateral para conversación multi-turn",
        icon: <FileText size={16} />,
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

  // Resultados de expedientes (top 8 por relevancia)
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
          (e.status as string),
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

  // Mantener activeIndex dentro de rango
  useEffect(() => {
    if (activeIndex >= allItems.length && allItems.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- adjust active index when list shrinks
      setActiveIndex(0);
    }
  }, [allItems.length, activeIndex]);

  // Scroll al item activo
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
    <div className="cmdPaletteOverlay" onClick={onClose} role="dialog" aria-label="Búsqueda rápida">
      <div className="cmdPalette" onClick={(e) => e.stopPropagation()}>
        <div className="cmdPaletteInput">
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
            aria-label="Búsqueda rápida"
          />
          <kbd>Esc</kbd>
        </div>
        <ul className="cmdPaletteList" ref={listRef}>
          {allItems.length === 0 ? (
            <li className="cmdPaletteEmpty">
              Sin resultados para &ldquo;{query}&rdquo;
            </li>
          ) : (
            <>
              {expedienteResults.length > 0 && (
                <li className="cmdPaletteGroup" aria-hidden="true">
                  Expedientes ({expedienteResults.length})
                </li>
              )}
              {expedienteResults.map((item, idx) => (
                <li
                  key={item.id}
                  data-cmd-idx={idx}
                  className={`cmdPaletteItem ${idx === activeIndex ? "active" : ""}`}
                  onMouseEnter={() => setActiveIndex(idx)}
                  onClick={item.onSelect}
                >
                  {item.icon}
                  <div className="cmdPaletteItemBody">
                    <strong>{item.label}</strong>
                    {item.description ? <span>{item.description}</span> : null}
                  </div>
                </li>
              ))}
              {filteredActions.length > 0 && (
                <li className="cmdPaletteGroup" aria-hidden="true">
                  Acciones
                </li>
              )}
              {filteredActions.map((item, idx) => {
                const realIdx = expedienteResults.length + idx;
                return (
                  <li
                    key={item.id}
                    data-cmd-idx={realIdx}
                    className={`cmdPaletteItem ${realIdx === activeIndex ? "active" : ""}`}
                    onMouseEnter={() => setActiveIndex(realIdx)}
                    onClick={item.onSelect}
                  >
                    {item.icon}
                    <div className="cmdPaletteItemBody">
                      <strong>{item.label}</strong>
                      {item.description ? <span>{item.description}</span> : null}
                    </div>
                    {item.shortcut ? <kbd>{item.shortcut}</kbd> : null}
                  </li>
                );
              })}
            </>
          )}
        </ul>
        <div className="cmdPaletteFooter">
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
          <span className="cmdPaletteHint">
            <X size={12} style={{ display: "inline", verticalAlign: "middle" }} /> Click fuera
          </span>
        </div>
      </div>
    </div>
  );
}
