"use client";

import { useEffect, useState, useCallback } from "react";

type Setter<T> = (value: T | ((prev: T) => T)) => void;

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

  const setStoredValue: Setter<T> = useCallback(
    (next) => {
      setValue((prev) => {
        const resolved =
          typeof next === "function" ? (next as (p: T) => T)(prev) : next;
        try {
          window.localStorage.setItem(key, JSON.stringify(resolved));
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

  const [sortBy, setSortBy, resetSortBy] = useLocalStorage<string>(
    "exp:sortBy",
    "created_at",
  );

  const [sortDir, setSortDir, resetSortDir] = useLocalStorage<"asc" | "desc">(
    "exp:sortDir",
    "desc",
    (v): v is "asc" | "desc" => v === "asc" || v === "desc",
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
    sortBy: sortBy as
      | "created_at"
      | "title"
      | "anio"
      | "file_size"
      | "status",
    setSortBy: setSortBy as (
      value:
        | "created_at"
        | "title"
        | "anio"
        | "file_size"
        | "status"
        | ((prev: string) => string),
    ) => void,
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
