import React from "react";
import {
  Search,
  Bot,
  Filter,
  X,
  Loader2,
  Info,
  Lightbulb,
  ArrowRight,
  FileText,
  MapPin,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  FileUp,
  List as ListIcon,
  Table2,
  Grid3x3,
  Eye,
  Download,
  RefreshCw,
  Trash2,
  Plus,
  History,
} from "lucide-react";
import {
  SearchMode,
  SearchResult,
  ChatAnswer,
  ExpedienteItem,
  ViewMode,
  StatusFilter,
  AdvancedFilters,
  SortBy,
  SortDir,
  WorkspaceTab,
} from "./types";
import { TablaExpedientes } from "./tabla-expedientes";
import { TarjetasExpedientes } from "./tarjetas-expedientes";
import { Pagination } from "./pagination";
import { SkeletonList, SkeletonStats } from "./skeleton";

const STATUS_PILLS: { id: StatusFilter; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "pendientes", label: "Pendientes" },
  { id: "indexados", label: "Indexados" },
  { id: "error", label: "Con error" },
];

export type BuscarTabContentProps = {
  // Search
  mode: SearchMode;
  query: string;
  setQuery: (q: string) => void;
  changeMode: (m: SearchMode) => void;
  runSearch: (e?: React.FormEvent) => void;
  searching: boolean;
  showFilters: boolean;
  setShowFilters: React.Dispatch<React.SetStateAction<boolean>>;
  filterAnio: string;
  setFilterAnio: (v: string) => void;
  filterOficina: string;
  setFilterOficina: (v: string) => void;
  filterMateria: string;
  setFilterMateria: (v: string) => void;
  activeFilterCount: number;
  isAdmin: boolean;

  // Results
  searchMessage: string | null;
  answer: ChatAnswer | null;
  results: SearchResult[] | null;
  openExpedienteById: (id: string) => Promise<void>;

  // Stats
  displayStats: { total: number; indexed: number; pending: number; error: number; totalBytes: number };
  displayStatusCounts: { todos: number; pendientes: number; indexados: number; error: number };

  // List
  expedientes: ExpedienteItem[];
  filteredExps: ExpedienteItem[];
  loadingList: boolean;
  searchInput: string;
  setSearchInput: (v: string) => void;
  viewMode: ViewMode;
  setViewMode: (m: ViewMode) => void;
  statusFilter: StatusFilter;
  setStatusFilter: (s: StatusFilter) => void;
  advancedFilters: AdvancedFilters;
  setAdvancedFilters: React.Dispatch<React.SetStateAction<AdvancedFilters>>;
  sortBy: SortBy;
  sortDir: SortDir;
  handleSort: (col: string) => void;
  selectedIds: Set<string>;
  toggleSelect: (id: string) => void;
  toggleSelectAll: () => void;
  setSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  setBulkOpen: (v: boolean) => void;
  setOpenExp: (exp: ExpedienteItem) => void;
  setReplaceExp: React.Dispatch<React.SetStateAction<ExpedienteItem | null>>;

  // Actions
  canManage: boolean;
  reindexingId: string | null;
  deletingId: string | null;
  reindexExpediente: (id: string) => Promise<void>;
  deleteExpediente: (exp: ExpedienteItem) => void;
  loadExpedientes: (page?: number) => Promise<void>;
  pagination: { page: number; limit: number; total: number; totalPages: number };
  clearFilters: () => void;
  hasActiveFilters: () => boolean;
  resetPreferences: () => void;

  // Helpers
  formatBytes: (n: number) => string;
  statusLabel: (s: ExpedienteItem["status"]) => string;
  setTab: (t: WorkspaceTab) => void;
};

export function BuscarTabContent({
  mode,
  query,
  setQuery,
  changeMode,
  runSearch,
  searching,
  showFilters,
  setShowFilters,
  filterAnio,
  setFilterAnio,
  filterOficina,
  setFilterOficina,
  filterMateria,
  setFilterMateria,
  activeFilterCount,
  isAdmin,
  searchMessage,
  answer,
  results,
  openExpedienteById,
  displayStats,
  displayStatusCounts,
  expedientes,
  filteredExps,
  loadingList,
  searchInput,
  setSearchInput,
  viewMode,
  setViewMode,
  statusFilter,
  setStatusFilter,
  advancedFilters,
  setAdvancedFilters,
  sortBy,
  sortDir,
  handleSort,
  selectedIds,
  toggleSelect,
  toggleSelectAll,
  setSelectedIds,
  setBulkOpen,
  setOpenExp,
  setReplaceExp,
  canManage,
  reindexingId,
  deletingId,
  reindexExpediente,
  deleteExpediente,
  loadExpedientes,
  pagination,
  clearFilters,
  hasActiveFilters,
  resetPreferences,
  formatBytes,
  statusLabel,
  setTab,
}: BuscarTabContentProps) {
  return (
    <div className="expTabContent">
      {/* Elige cómo se interpreta lo que escribes en el MISMO buscador —cambia
          el marcador de posición, el rótulo y el botón de envío—, no a qué
          panel se va. */}
      <div className="expSearchModes" role="group" aria-label="Modo de búsqueda">
        <button
          type="button"
          aria-pressed={mode === "buscar"}
          className={"expSearchModeCard" + (mode === "buscar" ? " active" : "")}
          onClick={() => changeMode("buscar")}
        >
          <span className="expSearchModeIcon">
            <Search size={18} />
          </span>
          <span className="expSearchModeText">
            <span className="expSearchModeTitle">Buscar</span>
            <span className="expSearchModeDesc">Por el contenido del documento</span>
          </span>
        </button>
        <button
          type="button"
          aria-pressed={mode === "preguntar"}
          className={"expSearchModeCard" + (mode === "preguntar" ? " active" : "")}
          onClick={() => changeMode("preguntar")}
        >
          <span className="expSearchModeIcon">
            <Bot size={18} />
          </span>
          <span className="expSearchModeText">
            <span className="expSearchModeTitle">Preguntar a la IA</span>
            <span className="expSearchModeDesc">Respuesta y ubicación, en lenguaje natural</span>
          </span>
        </button>
      </div>

      <form onSubmit={runSearch} className="expSearchBar">
        <Search size={18} className="expSearchHint" />
        <input
          id="exp-search-input"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={
            mode === "buscar"
              ? "Ej. licencia de funcionamiento, predio 2024, oficio 0345…"
              : "Ej. ¿Dónde está el expediente de la licencia 2024-0345?"
          }
          className="expSearchInput"
          aria-label={mode === "buscar" ? "Buscar en el contenido" : "Preguntar a la IA"}
        />
        {mode === "buscar" ? (
          <button
            type="button"
            className={"expFilterToggle" + (showFilters ? " active" : "")}
            onClick={() => setShowFilters((v) => !v)}
            aria-expanded={showFilters}
            title="Filtros"
          >
            <Filter size={15} /> Filtros
            {activeFilterCount > 0 ? (
              <span className="expFilterBadge">{activeFilterCount}</span>
            ) : null}
          </button>
        ) : null}
        <button type="submit" disabled={searching} className="expBtn expBtn-primary">
          {searching ? (
            <Loader2 size={16} className="expSpin" />
          ) : mode === "buscar" ? (
            <Search size={16} />
          ) : (
            <Bot size={16} />
          )}
          {searching
            ? mode === "buscar"
              ? "Buscando..."
              : "Consultando..."
            : mode === "buscar"
              ? "Buscar"
              : "Preguntar"}
        </button>
      </form>

      {mode === "buscar" && showFilters ? (
        <div className="expFilters" aria-label="Filtros de búsqueda">
          <div className="expFilterField">
            <label className="expFilterLabel" htmlFor="filter-anio">Año</label>
            <input
              id="filter-anio"
              type="number"
              value={filterAnio}
              onChange={(e) => setFilterAnio(e.target.value)}
              placeholder="Ej. 2024"
              className="expField-input"
            />
          </div>
          {isAdmin ? (
            <div className="expFilterField">
              <label className="expFilterLabel" htmlFor="filter-oficina">Oficina</label>
              <input
                id="filter-oficina"
                value={filterOficina}
                onChange={(e) => setFilterOficina(e.target.value)}
                placeholder="Ej. Subgerencia de Tránsito"
                className="expField-input"
              />
            </div>
          ) : null}
          <div className="expFilterField">
            <label className="expFilterLabel" htmlFor="filter-materia">Materia</label>
            <input
              id="filter-materia"
              value={filterMateria}
              onChange={(e) => setFilterMateria(e.target.value)}
              placeholder="Ej. contratación"
              className="expField-input"
            />
          </div>
          {activeFilterCount > 0 ? (
            <button
              type="button"
              className="expBtn expBtn-ghost expFilterClear"
              onClick={() => {
                setFilterAnio("");
                setFilterOficina("");
                setFilterMateria("");
              }}
            >
              <X size={14} /> Limpiar
            </button>
          ) : null}
        </div>
      ) : null}

      {displayStats.pending > 0 ? (
        <span className="expHelpText" style={{ marginTop: 8 }}>
          <Loader2 size={12} className="expSpin" /> {displayStats.pending} expediente
          {displayStats.pending === 1 ? "" : "s"} en proceso aún no aparece
          {displayStats.pending === 1 ? "" : "n"} en la búsqueda (se indexa
          {displayStats.pending === 1 ? "" : "n"} en segundo plano).
        </span>
      ) : null}

      {mode === "preguntar" && !query && !answer ? (
        <div className="expSuggestedQuestions" aria-label="Ejemplos de preguntas">
          <span
            className="expHelpText"
            style={{ marginTop: 0, marginBottom: 4 }}
          >
            <Lightbulb size={12} /> Prueba con una de estas preguntas:
          </span>
          {[
            "¿Cuántos expedientes de contratación hay en 2024?",
            "¿Dónde está el expediente de la licencia 2024-0345?",
            "Resúmeme los expedientes de la subgerencia de tránsito",
          ].map((q) => (
            <button
              key={q}
              type="button"
              className="expSuggestedQuestion"
              onClick={() => {
                setQuery(q);
                setTimeout(() => {
                  const form = document.querySelector(
                    "form.expSearchBar",
                  ) as HTMLFormElement | null;
                  form?.requestSubmit();
                }, 50);
              }}
            >
              <ArrowRight size={12} />
              <span>{q}</span>
            </button>
          ))}
        </div>
      ) : null}

      {searchMessage ? (
        <div className="expMessage expMessage-info" role="status">
          <Info size={16} />
          <span>{searchMessage}</span>
        </div>
      ) : null}

      {answer ? (
        <div className="expAnswerCard">
          <div className="expAnswerHeader">
            <div className="expAnswerAvatar">
              <Sparkles size={16} />
            </div>
            <div>
              <h3 className="expAnswerTitle">Respuesta de la IA</h3>
              <p className="expAnswerSubtitle">
                Basada en los expedientes del archivo. Las citas [E#] enlazan a las fuentes.
              </p>
            </div>
          </div>
          <p className="expAnswerText">{answer.answer}</p>
          {answer.sources.length > 0 ? (
            <div className="expAnswerSources">
              <p className="expAnswerSourcesLabel">Fuentes ({answer.sources.length})</p>
              {answer.sources.map((source, index) => (
                <button
                  key={`${source.expedienteId}-${index}`}
                  type="button"
                  className="expCitation"
                  onClick={() => void openExpedienteById(source.expedienteId)}
                >
                  <span className="expCitationNumber">E{index + 1}</span>
                  <span className="expCitationTitle">{source.title}</span>
                  <span className="expCitationSource">{source.citation}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {results ? (
        <div className="expResults">
          <div className="expFormSectionHeader">
            <h3 className="expFormSectionTitle">
              <FileText size={16} /> Resultados
              <span className="expFormSectionHint">
                {results.length} coincidencia{results.length === 1 ? "" : "s"}
              </span>
            </h3>
          </div>
          {results.length === 0
            ? null
            : results.map((source) => (
                <article
                  key={source.expedienteId}
                  className="expResultCard"
                  onClick={() => void openExpedienteById(source.expedienteId)}
                >
                  <div className="expResultIcon">
                    <FileText size={18} />
                  </div>
                  <div className="expResultBody">
                    <h4 className="expResultTitle">{source.title}</h4>
                    <div className="expResultMeta">
                      {source.serieDocumento ? (
                        <span className="expResultMetaItem">{source.serieDocumento}</span>
                      ) : null}
                      {source.anio ? (
                        <span className="expResultMetaItem">{source.anio}</span>
                      ) : null}
                      {source.materia ? (
                        <span className="expResultMetaItem">{source.materia}</span>
                      ) : null}
                      {source.pageStart ? (
                        <span className="expResultMetaItem">pág. {source.pageStart}</span>
                      ) : null}
                    </div>
                    {source.ubicacionResumen ? (
                      <div className="expResultMeta">
                        <span className="expResultMetaItem">
                          <MapPin size={12} /> {source.ubicacionResumen}
                        </span>
                      </div>
                    ) : null}
                    {source.excerpt ? (
                      <p className="expResultExcerpt">{source.excerpt}</p>
                    ) : null}
                  </div>
                  <div className="expResultActions">
                    <a
                      href={`/api/expedientes-archivo/${source.expedienteId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="expIconButton"
                      title="Abrir PDF"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <FileText size={14} />
                    </a>
                  </div>
                </article>
              ))}
        </div>
      ) : null}

      {displayStats.total > 0 ? (
        <div className="expStats" aria-label="Resumen del archivo">
          <div className="expStatCard statBrand">
            <div className="expStatHeader">
              <span className="expStatLabel">Total</span>
              <FileText className="expStatIcon" size={16} />
            </div>
            <span className="expStatValue">{displayStats.total}</span>
            <span className="expStatHint">expedientes en el archivo</span>
          </div>
          <div className="expStatCard statSuccess">
            <div className="expStatHeader">
              <span className="expStatLabel">Indexados</span>
              <CheckCircle2 className="expStatIcon" size={16} />
            </div>
            <span className="expStatValue">{displayStats.indexed}</span>
            <span className="expStatHint">listos para buscar</span>
          </div>
          <div className="expStatCard statWarning">
            <div className="expStatHeader">
              <span className="expStatLabel">Pendientes</span>
              <Loader2 className="expStatIcon" size={16} />
            </div>
            <span className="expStatValue">{displayStats.pending}</span>
            <span className="expStatHint">procesándose ahora</span>
          </div>
          <div className="expStatCard statDanger">
            <div className="expStatHeader">
              <span className="expStatLabel">Con error</span>
              <AlertCircle className="expStatIcon" size={16} />
            </div>
            <span className="expStatValue">{displayStats.error}</span>
            <span className="expStatHint">requieren atención</span>
          </div>
          <div className="expStatCard statInfo">
            <div className="expStatHeader">
              <span className="expStatLabel">Tamaño</span>
              <FileUp className="expStatIcon" size={16} />
            </div>
            <span className="expStatValue">{formatBytes(displayStats.totalBytes)}</span>
            <span className="expStatHint">en Supabase Storage</span>
          </div>
        </div>
      ) : null}

      {expedientes.length > 0 ? (
        <>
          <div className="expListHeader">
            <input
              type="search"
              placeholder="Filtra la lista por título, materia u oficina…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="expListSearch"
              aria-label="Filtro rápido de la lista"
            />
            {/* Cómo se dibuja la MISMA lista: un control segmentado, no pestañas. */}
            <div
              className="expSegmented"
              role="group"
              aria-label="Modo de vista"
            >
              <button
                type="button"
                aria-pressed={viewMode === "lista"}
                className={viewMode === "lista" ? "active" : ""}
                onClick={() => setViewMode("lista")}
                title="Vista lista"
                aria-label="Vista lista"
              >
                <ListIcon size={14} />
              </button>
              <button
                type="button"
                aria-pressed={viewMode === "tabla"}
                className={viewMode === "tabla" ? "active" : ""}
                onClick={() => setViewMode("tabla")}
                title="Vista tabla"
                aria-label="Vista tabla"
              >
                <Table2 size={14} />
              </button>
              <button
                type="button"
                aria-pressed={viewMode === "tarjetas"}
                className={viewMode === "tarjetas" ? "active" : ""}
                onClick={() => setViewMode("tarjetas")}
                title="Vista tarjetas"
                aria-label="Vista tarjetas"
              >
                <Grid3x3 size={14} />
              </button>
            </div>
            <div className="expPillGroup" role="group" aria-label="Filtrar por estado">
              {STATUS_PILLS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  aria-pressed={statusFilter === s.id}
                  className={statusFilter === s.id ? "expPill active" : "expPill"}
                  onClick={() => setStatusFilter(s.id)}
                >
                  {s.label}
                  <span className="expPillCount">{displayStatusCounts[s.id]}</span>
                </button>
              ))}
            </div>
          </div>

          {hasActiveFilters() ? (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
              <span className="expHelpText" style={{ marginTop: 0 }}>
                <Filter size={12} /> Filtros activos:
              </span>
              {searchInput ? (
                <span className="expFilterChip">
                  Búsqueda: &quot;{searchInput.slice(0, 20)}&quot;
                  <button onClick={() => setSearchInput("")} aria-label="Quitar filtro">
                    <X size={12} />
                  </button>
                </span>
              ) : null}
              {advancedFilters.oficina ? (
                <span className="expFilterChip">
                  Oficina: {advancedFilters.oficina}
                  <button
                    onClick={() =>
                      setAdvancedFilters((f) => ({ ...f, oficina: "" }))
                    }
                    aria-label="Quitar filtro"
                  >
                    <X size={12} />
                  </button>
                </span>
              ) : null}
              {advancedFilters.estante ? (
                <span className="expFilterChip">
                  Estante: {advancedFilters.estante}
                  <button
                    onClick={() =>
                      setAdvancedFilters((f) => ({ ...f, estante: "" }))
                    }
                    aria-label="Quitar filtro"
                  >
                    <X size={12} />
                  </button>
                </span>
              ) : null}
              {advancedFilters.tipoDocumento ? (
                <span className="expFilterChip">
                  Tipo: {advancedFilters.tipoDocumento}
                  <button
                    onClick={() =>
                      setAdvancedFilters((f) => ({ ...f, tipoDocumento: "" }))
                    }
                    aria-label="Quitar filtro"
                  >
                    <X size={12} />
                  </button>
                </span>
              ) : null}
              {statusFilter !== "todos" ? (
                <span className="expFilterChip">
                  Estado: {STATUS_PILLS.find((p) => p.id === statusFilter)?.label}
                  <button onClick={() => setStatusFilter("todos")} aria-label="Quitar filtro">
                    <X size={12} />
                  </button>
                </span>
              ) : null}
              <button
                type="button"
                className="expBtn expBtn-ghost expBtn-small"
                onClick={clearFilters}
              >
                <X size={12} /> Limpiar todos
              </button>
            </div>
          ) : null}

          <div className="expAdvancedFilters">
            {isAdmin ? (
              <div className="expField">
                <label className="expField-label">
                  <Filter size={11} /> Oficina
                </label>
                <input
                  value={advancedFilters.oficina}
                  onChange={(e) =>
                    setAdvancedFilters((f) => ({ ...f, oficina: e.target.value }))
                  }
                  placeholder="Filtrar por oficina"
                  className="expField-input"
                  aria-label="Filtrar por oficina"
                />
              </div>
            ) : null}
            <div className="expField">
              <label className="expField-label">Estante</label>
              <input
                value={advancedFilters.estante}
                onChange={(e) =>
                  setAdvancedFilters((f) => ({ ...f, estante: e.target.value }))
                }
                placeholder="Nº estante"
                className="expField-input"
                aria-label="Filtrar por estante"
              />
            </div>
            <div className="expField">
              <label className="expField-label">Tipo de documento</label>
              <input
                value={advancedFilters.tipoDocumento}
                onChange={(e) =>
                  setAdvancedFilters((f) => ({ ...f, tipoDocumento: e.target.value }))
                }
                placeholder="Resolución, Oficio…"
                className="expField-input"
                aria-label="Filtrar por tipo de documento"
              />
            </div>
            <button
              type="button"
              className="expBtn expBtn-ghost"
              onClick={clearFilters}
              disabled={!hasActiveFilters()}
            >
              <X size={14} /> Limpiar
            </button>
          </div>

          {canManage && selectedIds.size > 0 ? (
            <div className="expBulkBar" role="region" aria-label="Acciones masivas">
              <strong>{selectedIds.size}</strong>
              <span>seleccionado{selectedIds.size === 1 ? "" : "s"}</span>
              <button type="button" onClick={() => setSelectedIds(new Set())}>
                <X size={14} /> Cancelar
              </button>
              <button
                type="button"
                className="primary"
                onClick={() => setBulkOpen(true)}
              >
                <MapPin size={14} /> Mover / reasignar
              </button>
            </div>
          ) : null}

          {loadingList ? (
            <>
              <SkeletonStats />
              <SkeletonList count={5} />
            </>
          ) : filteredExps.length === 0 ? (
            <div className="expEmpty">
              <div className="expEmptyIllustration">
                <FileText size={28} />
              </div>
              <h3 className="expEmpty-title">
                {expedientes.length === 0
                  ? "El archivo está vacío"
                  : "Sin coincidencias"}
              </h3>
              <p className="expEmpty-desc">
                {expedientes.length === 0
                  ? "Sube el primer expediente para empezar a indexar contenido."
                  : "No hay expedientes que coincidan con los filtros aplicados. Prueba ajustando los criterios."}
              </p>
              {expedientes.length === 0 && canManage ? (
                <button
                  type="button"
                  className="expBtn expBtn-primary expEmpty-action"
                  onClick={() => setTab("subir")}
                >
                  <Plus size={16} /> Subir primer expediente
                </button>
              ) : null}
            </div>
          ) : (
            <>
              {viewMode === "lista" ? (
                <div className="expList" role="list">
                  {filteredExps.map((exp) => (
                    <article
                      key={exp.id}
                      className="expListItem"
                      onClick={() => setOpenExp(exp)}
                      role="listitem"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setOpenExp(exp);
                        }
                      }}
                    >
                      <div className="expListItemIcon">
                        <FileText size={18} />
                      </div>
                      <div className="expListItemBody">
                        <h4 className="expListItemTitle">{exp.title}</h4>
                        <div className="expListItemMeta">
                          {exp.serie_documento ? (
                            <span>{exp.serie_documento}</span>
                          ) : (
                            <span>Sin número</span>
                          )}
                          {exp.anio ? <span>· {exp.anio}</span> : null}
                          {exp.oficina ? <span>· {exp.oficina}</span> : null}
                          <span>· {formatBytes(exp.file_size)}</span>
                          <span
                            className={`expStatus expStatus-${exp.status}`}
                            data-status={exp.status}
                          >
                            {statusLabel(exp.status)}
                          </span>
                        </div>
                        {exp.nro_estante || exp.nro_piso || exp.nro_local ? (
                          <div className="expListItemMeta">
                            <span className="expResultMetaItem">
                              <MapPin size={12} />
                              {[exp.nro_estante && `E${exp.nro_estante}`, exp.nro_piso && `P${exp.nro_piso}`, exp.nro_local]
                                .filter(Boolean)
                                .join(" / ")}
                            </span>
                          </div>
                        ) : null}
                      </div>
                      <div
                        className="expListItemActions"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {canManage ? (
                          <>
                            <input
                              type="checkbox"
                              checked={selectedIds.has(exp.id)}
                              onChange={() => toggleSelect(exp.id)}
                              aria-label={`Seleccionar ${exp.title}`}
                              style={{ marginRight: 4 }}
                            />
                            <button
                              type="button"
                              onClick={() => setOpenExp(exp)}
                              className="expIconButton"
                              aria-label="Ver detalle"
                              title="Ver detalle"
                            >
                              <Eye size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => void reindexExpediente(exp.id)}
                              disabled={reindexingId === exp.id}
                              className="expIconButton"
                              aria-label="Reindexar"
                              title="Reindexar"
                            >
                              <RefreshCw
                                size={14}
                                className={reindexingId === exp.id ? "expSpin" : ""}
                              />
                            </button>
                            <a
                              href={`/api/expedientes-archivo/${exp.id}`}
                              target="_blank"
                              rel="noreferrer"
                              className="expIconButton"
                              aria-label="Descargar PDF"
                              title="Descargar PDF"
                            >
                              <Download size={14} />
                            </a>
                            <button
                              type="button"
                              onClick={() => void deleteExpediente(exp)}
                              disabled={deletingId === exp.id}
                              className="expIconButton danger"
                              aria-label="Eliminar"
                              title="Eliminar"
                            >
                              <Trash2 size={14} />
                            </button>
                          </>
                        ) : (
                          <a
                            href={`/api/expedientes-archivo/${exp.id}`}
                            target="_blank"
                            rel="noreferrer"
                            className="expIconButton"
                            aria-label="Abrir PDF"
                            title="Abrir PDF"
                          >
                            <FileText size={14} />
                          </a>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              ) : viewMode === "tabla" ? (
                <TablaExpedientes
                  exps={filteredExps}
                  canManage={canManage}
                  selectedIds={selectedIds}
                  onToggle={toggleSelect}
                  onSelectAll={toggleSelectAll}
                  onOpen={setOpenExp}
                  onDelete={deleteExpediente}
                  onDownload={(exp) =>
                    window.open(`/api/expedientes-archivo/${exp.id}`, "_blank")
                  }
                  onReplace={setReplaceExp}
                  sortBy={sortBy}
                  sortDir={sortDir}
                  onSort={handleSort}
                  reindexingId={reindexingId}
                  deletingId={deletingId}
                  reindex={reindexExpediente}
                  formatBytes={formatBytes}
                  statusLabel={statusLabel}
                />
              ) : (
                <TarjetasExpedientes
                  exps={filteredExps}
                  onOpen={setOpenExp}
                  formatBytes={formatBytes}
                  statusLabel={statusLabel}
                />
              )}

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginTop: 16,
                  padding: "12px 14px",
                  background: "var(--exp-line-soft)",
                  borderRadius: "var(--exp-radius)",
                  fontSize: 12,
                  color: "var(--exp-muted)",
                }}
              >
                <span>
                  Mostrando <strong>{filteredExps.length}</strong> de{" "}
                  {expedientes.length} expediente{expedientes.length === 1 ? "" : "s"}
                </span>
                {hasActiveFilters() ? (
                  <button
                    type="button"
                    className="expBtn expBtn-ghost expBtn-small"
                    onClick={resetPreferences}
                  >
                    <History size={12} /> Restablecer preferencias
                  </button>
                ) : null}
              </div>

              {pagination.totalPages > 1 ? (
                <Pagination
                  pagination={pagination}
                  onPageChange={(page) => void loadExpedientes(page)}
                />
              ) : null}
            </>
          )}
        </>
      ) : null}
    </div>
  );
}
