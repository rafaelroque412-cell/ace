"use client";

import { useState, useCallback, useRef } from "react";
import { Undo2 } from "lucide-react";

type UndoState = {
  id: number;
  message: string;
};

type UndoActions = {
  /** Restaura el estado previo (se llamó "Deshacer"). */
  undo: () => void | Promise<void>;
  /** Confirma la acción diferida (venció la ventana o se cerró el aviso). */
  commit?: () => void | Promise<void>;
};

type PushOptions = {
  /** Acción a ejecutar si NO se deshace (p.ej. el DELETE real en el servidor). */
  onCommit?: () => void | Promise<void>;
  timeoutMs?: number;
};

let nextId = 1;

// Pila de "deshacer" con commit diferido. La acción real (p.ej. eliminar en el
// servidor) se aplaza hasta que vence la ventana o el usuario cierra el aviso;
// si pulsa "Deshacer", se cancela el commit y se restaura el estado.
export function useUndoStack() {
  const [stack, setStack] = useState<UndoState[]>([]);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const actions = useRef(new Map<number, UndoActions>());

  const cleanup = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
    actions.current.delete(id);
    setStack((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const push = useCallback(
    (message: string, undo: () => void | Promise<void>, options?: PushOptions) => {
      const id = nextId++;
      const timeoutMs = options?.timeoutMs ?? 8000;
      actions.current.set(id, { undo, commit: options?.onCommit });
      setStack((prev) => [...prev, { id, message }]);
      const timer = setTimeout(() => {
        const action = actions.current.get(id);
        timers.current.delete(id);
        actions.current.delete(id);
        setStack((prev) => prev.filter((s) => s.id !== id));
        if (action?.commit) {
          void Promise.resolve(action.commit()).catch((e) => console.error("Commit failed:", e));
        }
      }, timeoutMs);
      timers.current.set(id, timer);
    },
    [],
  );

  // "Deshacer": cancela el commit y restaura.
  const execute = useCallback(
    (id: number) => {
      const action = actions.current.get(id);
      cleanup(id);
      if (action?.undo) {
        void Promise.resolve(action.undo()).catch((e) => console.error("Undo failed:", e));
      }
    },
    [cleanup],
  );

  // Cerrar el aviso (×): confirma la acción ya, sin esperar a que venza.
  const dismiss = useCallback(
    (id: number) => {
      const action = actions.current.get(id);
      cleanup(id);
      if (action?.commit) {
        void Promise.resolve(action.commit()).catch((e) => console.error("Commit failed:", e));
      }
    },
    [cleanup],
  );

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
