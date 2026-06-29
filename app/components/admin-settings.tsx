"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  CheckCircle2,
  KeyRound,
  ListChecks,
  Plus,
  Save,
  Search,
  ShieldCheck,
  Star,
  Trash2,
  UserPlus,
  Users,
  Workflow,
} from "lucide-react";

type EntitySettings = {
  address: string;
  executingUnit: string;
  governmentLevel: string;
  name: string;
  ruc: string;
  updatedAt: string | null;
};

type GovernmentLevel = {
  examples: string;
  label: string;
  value: string;
};

type ProcessTypeSetting = {
  active: boolean;
  category: "competitivo" | "no_competitivo" | "contrato_menor";
  code: string;
  description: string;
  frequentMunicipality: boolean;
  label: string;
  legalBasis: string;
  object: string;
  sortOrder: number;
  updatedAt?: string | null;
};

type RoleOption = {
  description?: string;
  label: string;
  value: string;
};

type UserSetting = {
  createdAt: string | null;
  email: string | null;
  entity: string;
  id: string;
  permissions?: Array<{ area: string; scope: string }>;
  role: string;
};

type CreatedCredential = {
  email: string;
  password: string;
  role: string;
};

type LinkedUser = {
  email: string;
  role: string;
  userId: string;
};

type RolePermission = {
  area: string;
  permissions: Record<string, boolean>;
  scope: string;
};

type SettingsPayload = {
  entity: EntitySettings;
  governmentLevels: GovernmentLevel[];
  processTypes: ProcessTypeSetting[];
  rolePermissions: RolePermission[];
  roles: RoleOption[];
  users: UserSetting[];
};

const emptyEntity: EntitySettings = {
  address: "",
  executingUnit: "",
  governmentLevel: "",
  name: "",
  ruc: "",
  updatedAt: null,
};

const CATEGORY_ORDER: ProcessTypeSetting["category"][] = [
  "competitivo",
  "no_competitivo",
  "contrato_menor",
];

const CATEGORY_META: Record<
  ProcessTypeSetting["category"],
  { description: string; label: string }
> = {
  competitivo: {
    description: "Licitaciones, concursos, subasta inversa y comparacion de precios.",
    label: "Competitivo",
  },
  no_competitivo: {
    description: "Supuestos del articulo 55 de la Ley 32069 y su reglamento.",
    label: "No competitivo",
  },
  contrato_menor: {
    description: "Reglas especiales hasta 8 UIT; no es procedimiento competitivo.",
    label: "Contrato menor",
  },
};

function onlyDigits(value: string, length: number) {
  return value.replace(/\D/g, "").slice(0, length);
}

function codeFromLabel(label: string) {
  return label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 70);
}

export function AdminSettings() {
  const [activeTab, setActiveTab] = useState<"municipalidad" | "procesos" | "usuarios">("municipalidad");
  const [processFilter, setProcessFilter] = useState<string>("todos");
  const [userSearch, setUserSearch] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState("todos");
  const [entity, setEntity] = useState<EntitySettings>(emptyEntity);
  const [governmentLevels, setGovernmentLevels] = useState<GovernmentLevel[]>([]);
  const [processTypes, setProcessTypes] = useState<ProcessTypeSetting[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [rolePermissions, setRolePermissions] = useState<RolePermission[]>([]);
  const [users, setUsers] = useState<UserSetting[]>([]);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState("consulta");
  const [newUserEntity, setNewUserEntity] = useState("");
  const [createdCredentials, setCreatedCredentials] = useState<CreatedCredential[]>([]);
  const [linkedUsers, setLinkedUsers] = useState<LinkedUser[]>([]);
  const [creatingUser, setCreatingUser] = useState(false);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const entityChecklist = useMemo(
    () => [
      { done: entity.name.trim().length >= 3, label: "Nombre de la entidad" },
      { done: /^\d{11}$/.test(entity.ruc), label: "RUC (11 digitos)" },
      { done: /^\d{6}$/.test(entity.executingUnit), label: "Unidad ejecutora (6 digitos)" },
      { done: entity.address.trim().length >= 5, label: "Direccion" },
      { done: Boolean(entity.governmentLevel), label: "Tipo de gobierno" },
    ],
    [entity],
  );
  const entityComplete = entityChecklist.every((item) => item.done);
  const entityProgress = entityChecklist.filter((item) => item.done).length;
  const activeProcesses = processTypes.filter((item) => item.active).length;
  const categorySummary = useMemo(
    () =>
      CATEGORY_ORDER.map((value) => {
        const items = processTypes.filter((item) => item.category === value);
        return {
          activeCount: items.filter((item) => item.active).length,
          description: CATEGORY_META[value].description,
          label: CATEGORY_META[value].label,
          total: items.length,
          value,
        };
      }),
    [processTypes],
  );
  const frequentCount = useMemo(
    () => processTypes.filter((item) => item.frequentMunicipality).length,
    [processTypes],
  );
  const processFilters = useMemo(
    () => [
      { count: processTypes.length, label: "Todos", value: "todos" },
      ...CATEGORY_ORDER.map((value) => ({
        count: processTypes.filter((item) => item.category === value).length,
        label: CATEGORY_META[value].label,
        value,
      })),
      { count: frequentCount, label: "Frecuentes municipales", value: "frecuentes" },
    ],
    [processTypes, frequentCount],
  );
  const visibleProcesses = useMemo(
    () =>
      processTypes
        .map((item, index) => ({ index, item }))
        .filter(({ item }) =>
          processFilter === "todos"
            ? true
            : processFilter === "frecuentes"
              ? item.frequentMunicipality
              : item.category === processFilter,
        ),
    [processTypes, processFilter],
  );
  const userRoleCounts = useMemo(
    () =>
      roles.map((role) => ({
        ...role,
        count: users.filter((user) => user.role === role.value).length,
      })),
    [roles, users],
  );
  const visibleUsers = useMemo(() => {
    const term = userSearch.trim().toLowerCase();
    return users
      .map((user, index) => ({ index, user }))
      .filter(({ user }) => {
        const matchesRole = userRoleFilter === "todos" || user.role === userRoleFilter;
        const matchesTerm =
          !term ||
          (user.email ?? "").toLowerCase().includes(term) ||
          (user.entity ?? "").toLowerCase().includes(term);
        return matchesRole && matchesTerm;
      });
  }, [users, userSearch, userRoleFilter]);

  function roleLabel(roleValue: string) {
    return roles.find((role) => role.value === roleValue)?.label ?? roleValue;
  }

  function userInitials(user: UserSetting) {
    const source = (user.email ?? "").split("@")[0] ?? "";
    const parts = source.split(/[.\-_]+/).filter(Boolean);
    const initials = parts.slice(0, 2).map((part) => part[0]).join("");
    return (initials || source.slice(0, 2) || "?").toUpperCase();
  }

  async function load() {
    setLoading(true);
    setError(null);
    const [settingsResp, usersResp] = await Promise.all([
      fetch("/api/configuracion/settings", { cache: "no-store" }),
      fetch("/api/configuracion/users?limit=200", { cache: "no-store" }),
    ]);
    const settingsPayload = (await settingsResp.json().catch(() => ({}))) as
      Partial<SettingsPayload> & { error?: string };
    if (!settingsResp.ok) {
      setError(settingsPayload.error ?? "No se pudo cargar configuracion");
      setLoading(false);
      return;
    }
    const usersPayload = (await usersResp.json().catch(() => ({}))) as
      Partial<SettingsPayload> & { error?: string };

    setEntity(settingsPayload.entity ?? emptyEntity);
    setGovernmentLevels(settingsPayload.governmentLevels ?? []);
    setProcessTypes(settingsPayload.processTypes ?? []);
    setRoles(settingsPayload.roles ?? []);
    setRolePermissions(settingsPayload.rolePermissions ?? []);
    setUsers(usersPayload.users ?? []);
    setLoading(false);
  }

  useEffect(() => {
    // Initial sync with the settings API when the admin screen mounts.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, []);

  // El banner "Guardado" se oculta solo despues de 5s para no quedar
  // pegado si el admin navega entre tabs sin hacer cambios.
  useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(() => setSaved(false), 5000);
    return () => clearTimeout(timer);
  }, [saved]);

  function updateProcess(index: number, patch: Partial<ProcessTypeSetting>) {
    setProcessTypes((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
    );
  }

  function addProcess() {
    const presetCategory = (CATEGORY_ORDER as string[]).includes(processFilter)
      ? (processFilter as ProcessTypeSetting["category"])
      : "competitivo";
    setProcessTypes((current) => [
      ...current,
      {
        active: true,
        category: presetCategory,
        code: "",
        description: "",
        frequentMunicipality: processFilter === "frecuentes",
        label: "",
        legalBasis: "",
        object: "",
        sortOrder: current.length + 1,
      },
    ]);
  }

  function removeProcess(index: number) {
    const target = processTypes[index];
    if (!target) return;
    const confirmed = window.confirm(
      `Eliminar el proceso "${target.label || target.code || "sin nombre"}"? Esta accion no se puede deshacer hasta que guardes los cambios.`,
    );
    if (!confirmed) return;
    setProcessTypes((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  function updateUser(index: number, patch: Partial<UserSetting>) {
    setUsers((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
    );
  }

  async function save() {
    setSaving(true);
    setSaved(false);
    setError(null);

    // Validacion cliente temprana: si la entidad no cumple, no gasta el round-trip
    if (!entityChecklist.every((c) => c.done)) {
      const missing = entityChecklist.filter((c) => !c.done).map((c) => c.label);
      setError(`Completa los datos de la entidad antes de guardar: ${missing.join(", ")}.`);
      setSaving(false);
      return;
    }

    const response = await fetch("/api/configuracion/settings", {
      body: JSON.stringify({ entity, processTypes }),
      headers: { "Content-Type": "application/json" },
      method: "PUT",
    });
    const payload = (await response.json()) as Partial<SettingsPayload> & {
      details?: { fieldErrors?: Record<string, string[]>; formErrors?: string[] };
      error?: string;
    };

    if (!response.ok) {
      // Mostrar errores de Zod especificos si los hay
      const zodErrors = payload.details?.fieldErrors;
      const zodMsg = zodErrors
        ? Object.entries(zodErrors)
            .map(([k, v]) => `${k}: ${v.join(", ")}`)
            .join("; ")
        : "";
      setError(zodMsg ? `${payload.error ?? "Error"} - ${zodMsg}` : payload.error ?? "No se pudo guardar configuracion");
      setSaving(false);
      return;
    }

    setEntity(payload.entity ?? entity);
    setProcessTypes(payload.processTypes ?? processTypes);
    setUsers(payload.users ?? users);
    setSaved(true);
    setSaving(false);
  }

  async function createUser() {
    if (!newUserEmail.trim()) {
      setError("Ingresa el correo del usuario.");
      return;
    }

    setCreatingUser(true);
    setSaved(false);
    setError(null);

    const response = await fetch("/api/configuracion/users", {
      body: JSON.stringify({
        email: newUserEmail.trim(),
        entity: newUserEntity.trim() || entity.name,
        password: newUserPassword,
        role: newUserRole,
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const payload = (await response.json().catch(() => ({}))) as {
      status?: "created" | "linked";
      email?: string;
      role?: string;
      password?: string;
      error?: string;
    };

    if (!response.ok) {
      setError(payload.error ?? "No se pudo crear usuario");
      setCreatingUser(false);
      return;
    }

    // Si el usuario fue creado nuevo, mostramos la credencial.
    // Si ya existia, lo marcamos como vinculado.
    if (payload.status === "created" && payload.email && payload.password && payload.role) {
      setCreatedCredentials([
        { email: payload.email, password: payload.password, role: payload.role },
      ]);
      setLinkedUsers([]);
    } else {
      setLinkedUsers(
        payload.status === "linked" && payload.email && payload.role
          ? [{ email: payload.email, role: payload.role, userId: "" }]
          : [],
      );
      setCreatedCredentials([]);
    }
    // Refrescar lista
    void load();
    setNewUserEmail("");
    setNewUserPassword("");
    setNewUserEntity("");
    setNewUserRole("consulta");
    setSaved(true);
    setCreatingUser(false);
  }

  async function seedRoleUsers() {
    const confirmed = window.confirm(
      `Esto creara (o vinculara) un usuario por cada perfil del sistema. Las contrasenas temporales se mostraran despues. Continuar?`,
    );
    if (!confirmed) return;
    setCreatingUser(true);
    setSaved(false);
    setError(null);

    const response = await fetch("/api/configuracion/users/seed", {
      body: JSON.stringify({ entity: entity.name }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const payload = (await response.json().catch(() => ({}))) as {
      created?: Array<{ email: string; password: string; role: string }>;
      linked?: Array<{ email: string; role: string; userId: string }>;
      error?: string;
    };

    if (!response.ok) {
      setError(payload.error ?? "No se pudieron crear usuarios base");
      setCreatingUser(false);
      return;
    }

    setCreatedCredentials(payload.created ?? []);
    setLinkedUsers(payload.linked ?? []);
    void load();
    setSaved(true);
    setCreatingUser(false);
  }

  async function saveUser(user: UserSetting) {
    setSavingUserId(user.id);
    setSaved(false);
    setError(null);

    const response = await fetch(`/api/configuracion/users/${encodeURIComponent(user.id)}`, {
      body: JSON.stringify({ entity: user.entity, role: user.role }),
      headers: { "Content-Type": "application/json" },
      method: "PATCH",
    });
    const payload = (await response.json().catch(() => ({}))) as { error?: string };

    if (!response.ok) {
      setError(payload.error ?? "No se pudo actualizar usuario");
      setSavingUserId(null);
      return;
    }

    void load();
    setSaved(true);
    setSavingUserId(null);
  }

  async function deleteUser(user: UserSetting) {
    const confirmed = window.confirm(`Eliminar usuario ${user.email ?? user.id}? Esta accion quita el acceso.`);
    if (!confirmed) {
      return;
    }

    setSavingUserId(user.id);
    setSaved(false);
    setError(null);

    const response = await fetch(
      `/api/configuracion/users?userId=${encodeURIComponent(user.id)}`,
      { method: "DELETE" },
    );
    const payload = (await response.json().catch(() => ({}))) as { error?: string };

    if (!response.ok) {
      setError(payload.error ?? "No se pudo eliminar usuario");
      setSavingUserId(null);
      return;
    }

    setUsers(users.filter((item) => item.id !== user.id));
    setSaved(true);
    setSavingUserId(null);
  }

  if (loading && !entity.name) {
    return (
      <div className="emptyState" role="status" aria-live="polite">
        <span>Cargando configuracion...</span>
      </div>
    );
  }

  return (
    <div className="settingsLayout">
      <section className="toolPanel settingsHero">
        <div className="settingsHeroIcon">
          <Building2 size={24} />
        </div>
        <div>
          <p className="eyebrow">Configuracion institucional</p>
          <h2>Datos que usara ACE</h2>
          <p>
            Registra la entidad, el ambito de gobierno y los procesos habilitados. Esta
            informacion se usara en expedientes, auditoria, documentos generados,
            validaciones y contexto juridico del sistema.
          </p>
        </div>
        <div className="settingsStatus">
          <span data-ready={entityComplete}>
            {entityComplete ? "Configuracion completa" : "Requiere completar datos"}
          </span>
          <strong>{activeProcesses} proceso(s) activos</strong>
        </div>
      </section>

      {error ? <p className="evalError">{error}</p> : null}
      {saved ? (
        <div className="successBanner">
          <CheckCircle2 size={17} />
          Configuracion guardada correctamente.
        </div>
      ) : null}

      <div className="settingsTabs" role="tablist" aria-label="Configuracion">
        <button
          aria-selected={activeTab === "municipalidad"}
          onClick={() => setActiveTab("municipalidad")}
          role="tab"
          type="button"
        >
          <Building2 size={16} />
          Municipalidad
        </button>
        <button
          aria-selected={activeTab === "procesos"}
          onClick={() => setActiveTab("procesos")}
          role="tab"
          type="button"
        >
          <Workflow size={16} />
          Procesos
        </button>
        <button
          aria-selected={activeTab === "usuarios"}
          onClick={() => setActiveTab("usuarios")}
          role="tab"
          type="button"
        >
          <Users size={16} />
          Usuarios
        </button>
      </div>

      {activeTab === "municipalidad" ? (
        <div className="municipalityLayout">
          <section className="toolPanel">
            <div className="toolPanelHeader">
              <div>
                <p className="eyebrow">Entidad</p>
                <h2>Informacion institucional</h2>
                <span className="processPanelHint">
                  Estos datos identifican a tu entidad en expedientes, contratos y auditoria.
                </span>
              </div>
            </div>
            <div className="settingsForm">
              <label>
                <span>Nombre de la entidad</span>
                <input
                  onChange={(event) => setEntity((current) => ({ ...current, name: event.target.value }))}
                  placeholder="Ej. Municipalidad Distrital de..."
                  value={entity.name}
                />
              </label>
              <div className="settingsFormTwo">
                <label>
                  <span>RUC</span>
                  <input
                    inputMode="numeric"
                    onChange={(event) =>
                      setEntity((current) => ({ ...current, ruc: onlyDigits(event.target.value, 11) }))
                    }
                    placeholder="11 digitos"
                    value={entity.ruc}
                  />
                  <small data-ok={/^\d{11}$/.test(entity.ruc)}>{entity.ruc.length}/11 digitos</small>
                </label>
                <label>
                  <span>Unidad ejecutora</span>
                  <input
                    inputMode="numeric"
                    onChange={(event) =>
                      setEntity((current) => ({
                        ...current,
                        executingUnit: onlyDigits(event.target.value, 6),
                      }))
                    }
                    placeholder="6 digitos"
                    value={entity.executingUnit}
                  />
                  <small data-ok={/^\d{6}$/.test(entity.executingUnit)}>
                    {entity.executingUnit.length}/6 digitos
                  </small>
                </label>
              </div>
              <label>
                <span>Direccion de la entidad</span>
                <input
                  onChange={(event) => setEntity((current) => ({ ...current, address: event.target.value }))}
                  placeholder="Direccion fiscal o sede principal"
                  value={entity.address}
                />
              </label>
              <div className="govLevelField">
                <span className="govLevelLabel">Tipo de gobierno</span>
                <div className="govLevelOptions" role="radiogroup" aria-label="Tipo de gobierno">
                  {governmentLevels.map((level) => (
                    <button
                      aria-checked={entity.governmentLevel === level.value}
                      className="govLevelCard"
                      data-selected={entity.governmentLevel === level.value}
                      key={level.value}
                      onClick={() =>
                        setEntity((current) => ({ ...current, governmentLevel: level.value }))
                      }
                      role="radio"
                      type="button"
                    >
                      <strong>{level.label}</strong>
                      <small>{level.examples}</small>
                    </button>
                  ))}
                </div>
                <small className="govLevelHint">
                  Identifica el ambito institucional en reportes, expedientes y auditoria.
                </small>
              </div>
            </div>
          </section>

          <aside className="municipalitySide">
            <section className="entityPreviewCard" data-ready={entityComplete}>
              <div className="entityPreviewHead">
                <span className="entityPreviewIcon">
                  <Building2 size={20} />
                </span>
                <div>
                  <small>Vista previa</small>
                  <strong>{entity.name || "Nombre de la entidad"}</strong>
                </div>
              </div>
              <dl className="entityPreviewData">
                <div>
                  <dt>RUC</dt>
                  <dd>{entity.ruc || "—"}</dd>
                </div>
                <div>
                  <dt>Unidad ejecutora</dt>
                  <dd>{entity.executingUnit || "—"}</dd>
                </div>
                <div>
                  <dt>Direccion</dt>
                  <dd>{entity.address || "—"}</dd>
                </div>
                <div>
                  <dt>Nivel</dt>
                  <dd>
                    {governmentLevels.find((level) => level.value === entity.governmentLevel)?.label ?? "—"}
                  </dd>
                </div>
              </dl>
            </section>

            <section className="entityChecklist">
              <div className="entityChecklistHead">
                <strong>Completa el perfil</strong>
                <span>
                  {entityProgress}/{entityChecklist.length}
                </span>
              </div>
              <div className="entityProgressBar" aria-hidden>
                <span style={{ width: `${(entityProgress / entityChecklist.length) * 100}%` }} />
              </div>
              <ul>
                {entityChecklist.map((item) => (
                  <li data-done={item.done} key={item.label}>
                    <CheckCircle2 size={15} />
                    {item.label}
                  </li>
                ))}
              </ul>
            </section>

            <div className="settingsUsagePanel">
              <strong>Uso dentro de ACE</strong>
              <span>Expedientes y documentos generados tomaran esta entidad como contexto predeterminado.</span>
              <span>Auditoria registrara entidad, rol y usuario para trazabilidad institucional.</span>
              <span>Validar y Analiza podran incorporar estos datos en informes y exportaciones.</span>
            </div>
          </aside>
        </div>
      ) : null}

      {activeTab === "procesos" ? (
        <section className="toolPanel processPanel">
          <div className="toolPanelHeader">
            <div>
              <p className="eyebrow">Catalogo</p>
              <h2>Procedimientos de contratacion</h2>
              <span className="processPanelHint">
                Define los procedimientos que ACE ofrecera al crear expedientes y contratos.
              </span>
            </div>
            <button className="primaryButton" onClick={addProcess} type="button">
              <Plus size={16} />
              Agregar proceso
            </button>
          </div>

          <div className="processSummary">
            {categorySummary.map((item) => (
              <article data-category={item.value} key={item.value}>
                <div className="processSummaryTop">
                  <strong>{item.activeCount}</strong>
                  <span className="processSummaryBadge">{item.label}</span>
                </div>
                <p>{item.description}</p>
                <small>
                  {item.activeCount} activo(s) de {item.total}
                </small>
              </article>
            ))}
          </div>

          <div className="processFilterBar" role="tablist" aria-label="Filtrar procesos">
            {processFilters.map((filter) => (
              <button
                aria-selected={processFilter === filter.value}
                key={filter.value}
                onClick={() => setProcessFilter(filter.value)}
                role="tab"
                type="button"
              >
                {filter.label}
                <em>{filter.count}</em>
              </button>
            ))}
          </div>

          <div className="processCardList">
            {visibleProcesses.length === 0 ? (
              <div className="emptyState">
                <Workflow size={20} />
                <p>No hay procesos en esta vista. Cambia el filtro o agrega uno nuevo.</p>
                <button className="secondaryButton" onClick={addProcess} type="button">
                  <Plus size={16} />
                  Agregar proceso
                </button>
              </div>
            ) : (
              visibleProcesses.map(({ index, item }) => (
                <article
                  className="processCard"
                  data-active={item.active}
                  data-category={item.category}
                  key={`${item.code}-${index}`}
                >
                  <header className="processCardHead">
                    <label className="switchControl" title={item.active ? "Desactivar" : "Activar"}>
                      <input
                        checked={item.active}
                        onChange={(event) => updateProcess(index, { active: event.target.checked })}
                        type="checkbox"
                      />
                      <span aria-hidden className="switchTrack">
                        <span className="switchThumb" />
                      </span>
                    </label>
                    <div className="processCardHeadMain">
                      <input
                        className="processNameInput"
                        onBlur={() => {
                          if (!item.code && item.label) {
                            updateProcess(index, { code: codeFromLabel(item.label) });
                          }
                        }}
                        onChange={(event) => updateProcess(index, { label: event.target.value })}
                        placeholder="Nombre del procedimiento"
                        value={item.label}
                      />
                      <div className="processCardTags">
                        <span className="categoryBadge" data-category={item.category}>
                          {CATEGORY_META[item.category].label}
                        </span>
                        <span className="statusPill" data-active={item.active}>
                          {item.active ? "Activo" : "Inactivo"}
                        </span>
                        {item.frequentMunicipality ? (
                          <span className="freqBadge">
                            <Star size={12} />
                            Frecuente municipal
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <button
                      aria-label="Eliminar proceso"
                      className="iconButton danger"
                      onClick={() => removeProcess(index)}
                      type="button"
                    >
                      <Trash2 size={15} />
                    </button>
                  </header>

                  <div className="processCardGrid">
                    <label>
                      <span>Categoria</span>
                      <select
                        onChange={(event) =>
                          updateProcess(index, {
                            category: event.target.value as ProcessTypeSetting["category"],
                          })
                        }
                        value={item.category}
                      >
                        <option value="competitivo">Competitivo</option>
                        <option value="no_competitivo">No competitivo</option>
                        <option value="contrato_menor">Contrato menor</option>
                      </select>
                    </label>
                    <label>
                      <span>Objeto</span>
                      <input
                        onChange={(event) => updateProcess(index, { object: event.target.value })}
                        placeholder="Bienes, obras, servicios..."
                        value={item.object}
                      />
                    </label>
                    <label className="processCardWide">
                      <span>Sustento / referencia legal</span>
                      <input
                        onChange={(event) => updateProcess(index, { legalBasis: event.target.value })}
                        placeholder="Ley 32069, Reglamento, Bases Estandar DGA..."
                        value={item.legalBasis}
                      />
                    </label>
                    <label className="processCardWide">
                      <span>Descripcion operativa</span>
                      <input
                        onChange={(event) => updateProcess(index, { description: event.target.value })}
                        placeholder="Uso interno, directiva aplicable o nota breve"
                        value={item.description}
                      />
                    </label>
                  </div>

                  <details className="processAdvanced">
                    <summary>Opciones avanzadas</summary>
                    <div className="processAdvancedGrid">
                      <label className="switchInline">
                        <input
                          checked={item.frequentMunicipality}
                          onChange={(event) =>
                            updateProcess(index, { frequentMunicipality: event.target.checked })
                          }
                          type="checkbox"
                        />
                        <span>Marcar como frecuente municipal</span>
                      </label>
                      <label>
                        <span>Codigo interno</span>
                        <input
                          onChange={(event) =>
                            updateProcess(index, { code: codeFromLabel(event.target.value) })
                          }
                          placeholder="licitacion_publica"
                          value={item.code}
                        />
                      </label>
                      <label>
                        <span>Orden de aparicion</span>
                        <input
                          inputMode="numeric"
                          onChange={(event) =>
                            updateProcess(index, {
                              sortOrder: Number.parseInt(event.target.value || "0", 10),
                            })
                          }
                          value={item.sortOrder}
                        />
                      </label>
                    </div>
                  </details>
                </article>
              ))
            )}
          </div>
        </section>
      ) : null}

      {activeTab === "usuarios" ? (
        <section className="toolPanel settingsUsersPanel">
          <div className="toolPanelHeader usersHeader">
            <div>
              <p className="eyebrow">Accesos</p>
              <h2>Usuarios y roles</h2>
              <span>Administra cuentas, perfil institucional y permisos efectivos por rol.</span>
            </div>
            <div className="usersHeaderStats" aria-label="Resumen de usuarios">
              <strong>{users.length}</strong>
              <span>usuario(s)</span>
            </div>
          </div>

          <div className="userAdminGrid">
            <section className="userCreateCard">
              <div className="userSectionTitle">
                <span>
                  <UserPlus size={17} />
                </span>
                <div>
                  <strong>Crear o vincular usuario</strong>
                  <small>Si el correo ya existe, ACE actualiza su perfil y permisos.</small>
                </div>
              </div>
              <div className="userCreateForm">
                <label>
                  <span>Correo institucional</span>
                  <input
                    onChange={(event) => setNewUserEmail(event.target.value)}
                    placeholder="correo@entidad.gob.pe"
                    value={newUserEmail}
                  />
                </label>
                <label>
                  <span>Perfil</span>
                  <select onChange={(event) => setNewUserRole(event.target.value)} value={newUserRole}>
                    {roles.map((role) => (
                      <option key={role.value} value={role.value}>
                        {role.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Entidad o unidad</span>
                  <input
                    onChange={(event) => setNewUserEntity(event.target.value)}
                    placeholder={entity.name || "Entidad asociada"}
                    value={newUserEntity}
                  />
                </label>
                <label>
                  <span>Contrasena temporal</span>
                  <input
                    onChange={(event) => setNewUserPassword(event.target.value)}
                    placeholder="Opcional, ACE puede generar una"
                    type="password"
                    value={newUserPassword}
                  />
                </label>
              </div>
              <div className="userCreateActions">
                <button className="primaryButton" disabled={creatingUser} onClick={createUser} type="button">
                  <Plus size={16} />
                  {creatingUser ? "Procesando..." : "Crear / vincular"}
                </button>
                <button className="secondaryButton" disabled={creatingUser} onClick={seedRoleUsers} type="button">
                  <Users size={16} />
                  Crear 1 por perfil
                </button>
              </div>
            </section>

            <section className="roleSummaryCard">
              <div className="userSectionTitle">
                <span>
                  <ShieldCheck size={17} />
                </span>
                <div>
                  <strong>Perfiles configurados</strong>
                  <small>Cada perfil activa permisos concretos dentro de ACE.</small>
                </div>
              </div>
              <div className="roleProfileGrid">
                {userRoleCounts.map((role) => (
                  <article data-role={role.value} key={role.value}>
                    <div>
                      <strong>{role.label}</strong>
                      <em>{role.count}</em>
                    </div>
                    <code>{role.value}</code>
                    <span>{role.description}</span>
                  </article>
                ))}
              </div>
            </section>
          </div>

          {createdCredentials.length > 0 ? (
            <div className="credentialsPanel">
              <KeyRound size={17} />
              <div>
                <strong>Credenciales temporales creadas</strong>
                <span>Guarda estas credenciales ahora; por seguridad solo se muestran en esta respuesta.</span>
              </div>
              {createdCredentials.map((credential) => (
                <code key={`${credential.email}-${credential.role}`}>
                  {roleLabel(credential.role)}: {credential.email} / {credential.password}
                </code>
              ))}
            </div>
          ) : null}
          {linkedUsers.length > 0 ? (
            <div className="linkedUsersPanel">
              <CheckCircle2 size={17} />
              <div>
                <strong>Usuarios existentes vinculados</strong>
                <span>Estos correos ya existian en Supabase Auth; se actualizo su perfil ACE, rol y permisos.</span>
              </div>
              {linkedUsers.map((linked) => (
                <code key={`${linked.email}-${linked.userId}`}>
                  {roleLabel(linked.role)}: {linked.email}
                </code>
              ))}
            </div>
          ) : null}

          <div className="usersListHeader">
            <div>
              <p className="eyebrow">Cuentas activas</p>
              <h2>Usuarios registrados</h2>
            </div>
            <span>{visibleUsers.length} de {users.length}</span>
          </div>
          {users.length > 0 ? (
            <div className="usersToolbar">
              <label className="usersSearch">
                <Search size={15} />
                <input
                  onChange={(event) => setUserSearch(event.target.value)}
                  placeholder="Buscar por correo o entidad..."
                  value={userSearch}
                />
              </label>
              <div className="usersRoleFilter" role="tablist" aria-label="Filtrar por rol">
                <button
                  aria-selected={userRoleFilter === "todos"}
                  onClick={() => setUserRoleFilter("todos")}
                  role="tab"
                  type="button"
                >
                  Todos
                  <em>{users.length}</em>
                </button>
                {userRoleCounts.map((role) => (
                  <button
                    aria-selected={userRoleFilter === role.value}
                    data-role={role.value}
                    key={role.value}
                    onClick={() => setUserRoleFilter(role.value)}
                    role="tab"
                    type="button"
                  >
                    {role.label}
                    <em>{role.count}</em>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          <div className="usersSettingsList">
            {users.length === 0 ? (
              <div className="emptyState">
                <Users size={20} />
                <span>No hay perfiles registrados todavia.</span>
              </div>
            ) : visibleUsers.length === 0 ? (
              <div className="emptyState">
                <Search size={20} />
                <span>Ningun usuario coincide con la busqueda o el filtro.</span>
              </div>
            ) : (
              visibleUsers.map(({ index, user }) => (
                <article className="userSettingsRow" key={user.id}>
                  <div className="userSettingsIdentity">
                    <span className="userAvatar" data-role={user.role} aria-hidden>
                      {userInitials(user)}
                    </span>
                    <div className="userIdentityText">
                      <strong>{user.email ?? "Usuario sin correo"}</strong>
                      <span className="roleBadge" data-role={user.role}>
                        {roleLabel(user.role)}
                      </span>
                      <div className="userPermissionChips" aria-label="Permisos activos">
                        {(user.permissions ?? [])
                          .slice(0, 4)
                          .map((permission) => (
                            <small key={permission.area}>{permission.area}</small>
                          ))}
                        {(user.permissions?.length ?? 0) > 4 ? (
                          <small>+{(user.permissions?.length ?? 0) - 4}</small>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <label>
                    <span>Rol</span>
                    <select
                      onChange={(event) => updateUser(index, { role: event.target.value })}
                      value={user.role}
                    >
                      {roles.map((role) => (
                        <option key={role.value} value={role.value}>
                          {role.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Entidad asociada</span>
                    <input
                      onChange={(event) => updateUser(index, { entity: event.target.value })}
                      placeholder={entity.name || "Entidad o unidad"}
                      value={user.entity}
                    />
                  </label>
                  <button
                    className="secondaryButton compactButton"
                    disabled={savingUserId === user.id}
                    onClick={() => saveUser(user)}
                    type="button"
                  >
                    <Save size={15} />
                    {savingUserId === user.id ? "Guardando..." : "Guardar"}
                  </button>
                  <button
                    aria-label="Eliminar usuario"
                    className="iconButton danger"
                    disabled={savingUserId === user.id}
                    onClick={() => deleteUser(user)}
                    type="button"
                  >
                    <Trash2 size={15} />
                  </button>
                </article>
              ))
            )}
          </div>
          <div className="permissionsMatrix">
            <div className="toolPanelHeader compactHeader">
              <div>
                <p className="eyebrow">Permisos</p>
                <h2>Matriz por perfil</h2>
              </div>
            </div>
            <div className="permissionsTable" role="table" aria-label="Matriz de permisos">
              <div className="permissionsRow header" role="row">
                <span>Modulo</span>
                {roles.map((role) => (
                  <span key={role.value}>{role.label}</span>
                ))}
              </div>
              {rolePermissions.map((item) => (
                <div className="permissionsRow" key={item.area} role="row">
                  <div>
                    <strong>{item.area}</strong>
                    <small>{item.scope}</small>
                  </div>
                  {roles.map((role) => (
                    <span
                      className={item.permissions[role.value] ? "allowed" : "denied"}
                      key={role.value}
                    >
                      {item.permissions[role.value] ? "Permite" : "No"}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <div className="settingsFooter">
        <div>
          <ListChecks size={18} />
          <span>
            {activeTab === "municipalidad"
              ? "RUC: 11 digitos. Unidad ejecutora: 6 digitos."
              : activeTab === "procesos"
                ? "Los procesos activos se usaran como catalogo administrativo del sistema."
                : "Los roles determinan permisos reales de consulta, DEC, legal y administracion."}
          </span>
        </div>
        {activeTab !== "usuarios" ? (
          <button className="primaryButton" disabled={saving} onClick={save} type="button">
            <Save size={16} />
            {saving ? "Guardando..." : "Guardar configuracion"}
          </button>
        ) : null}
      </div>
    </div>
  );
}
