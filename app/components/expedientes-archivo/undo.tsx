"use client";

import { useState, useCallback } from "react";
import { Undo2 } from "lucide-react";

type UndoState = {
  id: number;
  message: string;
  undo: () => void | Promise<void>;
};

let nextId = 1;

export function useUndoStack() {
  const [stack, setStack] = useState<UndoState[]>([]);

  const push = useCallback(
    (message: string, undo: () => void | Promise<void>, timeoutMs = 8000) => {
      const item: UndoState = { id: nextId++, message, undo };
      setStack((prev) => [...prev, item]);
      setTimeout(() => {
        setStack((prev) => prev.filter((s) => s.id !== item.id));
      }, timeoutMs);
    },
    [],
  );

  const execute = useCallback(async (id: number) => {
    const item = stack.find((s) => s.id === id);
    if (!item) return;
    setStack((prev) => prev.filter((s) => s.id !== id));
    try {
      await item.undo();
    } catch (e) {
      console.error("Undo failed:", e);
    }
  }, [stack]);

  const dismiss = useCallback((id: number) => {
    setStack((prev) => prev.filter((s) => s.id !== id));
  }, []);

  return { stack, push, execute, dismiss };
}

export function UndoToasts({
  stack,
  onExecute,
  onDismiss,
}: {
  stack: UndoState[];
  onExecute: (id: number) => void;
  onDismiss: (id: number) => void;
}) {
  if (stack.length === 0) return null;
  return (
    <div
      aria-live="polite"
      style={{
        position: "fixed",
        bottom: 80,
        right: 20,
        zIndex: 300,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      {stack.map((item) => (
        <div
          key={item.id}
          className="expToast"
          style={{ maxWidth: 360 }}
          role="status"
        >
          <Undo2 size={16} className="expToast-icon" />
          <span className="expToast-message">{item.message}</span>
          <button
            type="button"
            className="expToast-close"
            onClick={() => onExecute(item.id)}
            style={{ background: "rgba(255,255,255,0.3)" }}
            aria-label="Deshacer"
          >
            <Undo2 size={12} /> Deshacer
          </button>
          <button
            type="button"
            className="expToast-close"
            onClick={() => onDismiss(item.id)}
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
