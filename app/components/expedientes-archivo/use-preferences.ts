"use client";

import { useEffect, useState, useCallback, useRef } from "react";

type Setter<T> = (value: T | ((prev: T) => T)) => void;
type SortBy = "created_at" | "title" | "anio" | "file_size" | "status";
type SortDir = "asc" | "desc";

export function useLocalStorage<T>(
  key: string,
  initialValue: T,
  validate?: (value: unknown) => value is T,
): [T, Setter<T>, () => void] {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === "undefined") return initialValue;
    try {
      const item = window.localStorage.getItem(key);
      if (item === null) return initialValue;
      const parsed = JSON.parse(item) as unknown;
      if (validate && !validate(parsed)) {
        return initialValue;
      }
      return parsed as T;
    } catch {
      return initialValue;
    }
  });

  // Ref para evitar writes redundantes
  const lastWrittenRef = useRef<string | null>(null);

  const setStoredValue: Setter<T> = useCallback(
    (next) => {
      setValue((prev) => {
        const resolved =
          typeof next === "function" ? (next as (p: T) => T)(prev) : next;
        try {
          const serialized = JSON.stringify(resolved);
          // Solo escribir si realmente cambió
          if (lastWrittenRef.current === serialized) {
            return resolved;
          }
          lastWrittenRef.current = serialized;
          window.localStorage.setItem(key, serialized);
        } catch {
          // Ignorar errores de localStorage
        }
        return resolved;
      });
    },
    [key],
  );

  const remove = useCallback(() => {
    try {
      window.localStorage.removeItem(key);
      lastWrittenRef.current = null;
      setValue(initialValue);
    } catch {
      // Ignorar
    }
  }, [key, initialValue]);

  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === key && e.newValue !== null) {
        try {
          const parsed = JSON.parse(e.newValue) as unknown;
          if (!validate || validate(parsed)) {
            setValue(parsed as T);
          }
        } catch {
          // Ignorar
        }
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [key, validate]);

  return [value, setStoredValue, remove];
}

type ViewMode = "lista" | "tabla" | "tarjetas";
type StatusFilter = "todos" | "pendientes" | "indexados" | "error";

export function useExpedientesPreferences() {
  const [viewMode, setViewMode, resetViewMode] = useLocalStorage<ViewMode>(
    "exp:viewMode",
    "lista",
    (v): v is ViewMode => v === "lista" || v === "tabla" || v === "tarjetas",
  );

  const [statusFilter, setStatusFilter, resetStatusFilter] = useLocalStorage<StatusFilter>(
    "exp:statusFilter",
    "todos",
    (v): v is StatusFilter =>
      v === "todos" || v === "pendientes" || v === "indexados" || v === "error",
  );

  const [sortByRaw, setSortByRaw, resetSortBy] = useLocalStorage<SortBy>(
    "exp:sortBy",
    "created_at",
  );

  const [sortDir, setSortDir, resetSortDir] = useLocalStorage<SortDir>(
    "exp:sortDir",
    "desc",
    (v): v is SortDir => v === "asc" || v === "desc",
  );

  const [filters, setFilters, resetFilters] = useLocalStorage<{
    oficina: string;
    estante: string;
    tipoDocumento: string;
  }>("exp:filters", { oficina: "", estante: "", tipoDocumento: "" });

  const [collapsed, setCollapsed, resetCollapsed] = useLocalStorage<boolean>(
    "exp:sidebarCollapsed",
    false,
  );

  const [tab, setTab, resetTab] = useLocalStorage<"buscar" | "subir">(
    "exp:lastTab",
    "buscar",
    (v): v is "buscar" | "subir" => v === "buscar" || v === "subir",
  );

  // Setters tipados estables (no cambian entre renders)
  const setSortBy = useCallback(
    (value: SortBy | ((prev: SortBy) => SortBy)) => {
      if (typeof value === "function") {
        setSortByRaw((prev) => (value as (p: SortBy) => SortBy)(prev));
      } else {
        setSortByRaw(value);
      }
    },
    [setSortByRaw],
  );

  const resetAll = useCallback(() => {
    resetViewMode();
    resetStatusFilter();
    resetSortBy();
    resetSortDir();
    resetFilters();
    resetCollapsed();
    resetTab();
  }, [
    resetViewMode,
    resetStatusFilter,
    resetSortBy,
    resetSortDir,
    resetFilters,
    resetCollapsed,
    resetTab,
  ]);

  return {
    viewMode,
    setViewMode,
    statusFilter,
    setStatusFilter,
    sortBy: sortByRaw,
    setSortBy,
    sortDir,
    setSortDir,
    filters,
    setFilters,
    collapsed,
    setCollapsed,
    tab,
    setTab,
    resetAll,
  };
}
