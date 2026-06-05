"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  CheckCircle2,
  KeyRound,
  ListChecks,
  Plus,
  Save,
  ShieldCheck,
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

  const entityComplete = useMemo(
    () =>
      entity.name.trim().length >= 3 &&
      /^\d{11}$/.test(entity.ruc) &&
      /^\d{6}$/.test(entity.executingUnit) &&
      entity.address.trim().length >= 5 &&
      Boolean(entity.governmentLevel),
    [entity],
  );
  const activeProcesses = processTypes.filter((item) => item.active).length;
  const userRoleCounts = useMemo(
    () =>
      roles.map((role) => ({
        ...role,
        count: users.filter((user) => user.role === role.value).length,
      })),
    [roles, users],
  );

  function roleLabel(roleValue: string) {
    return roles.find((role) => role.value === roleValue)?.label ?? roleValue;
  }

  async function load() {
    setLoading(true);
    setError(null);
    const response = await fetch("/api/configuracion");
    const payload = (await response.json()) as Partial<SettingsPayload> & { error?: string };

    if (!response.ok) {
      setError(payload.error ?? "No se pudo cargar configuracion");
      setLoading(false);
      return;
    }

    setEntity(payload.entity ?? emptyEntity);
    setGovernmentLevels(payload.governmentLevels ?? []);
    setProcessTypes(payload.processTypes ?? []);
    setRoles(payload.roles ?? []);
    setRolePermissions(payload.rolePermissions ?? []);
    setUsers(payload.users ?? []);
    setLoading(false);
  }

  useEffect(() => {
    // Initial sync with the settings API when the admin screen mounts.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, []);

  function updateProcess(index: number, patch: Partial<ProcessTypeSetting>) {
    setProcessTypes((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
    );
  }

  function addProcess() {
    setProcessTypes((current) => [
      ...current,
      {
        active: true,
        category: "competitivo",
        code: "",
        description: "",
        frequentMunicipality: false,
        label: "",
        legalBasis: "",
        object: "",
        sortOrder: current.length + 1,
      },
    ]);
  }

  function removeProcess(index: number) {
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

    const response = await fetch("/api/configuracion", {
      body: JSON.stringify({ entity, processTypes }),
      headers: { "Content-Type": "application/json" },
      method: "PUT",
    });
    const payload = (await response.json()) as Partial<SettingsPayload> & { error?: string };

    if (!response.ok) {
      setError(payload.error ?? "No se pudo guardar configuracion");
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

    const response = await fetch("/api/configuracion", {
      body: JSON.stringify({
        action: "create_user",
        email: newUserEmail.trim(),
        entity: newUserEntity.trim() || entity.name,
        password: newUserPassword,
        role: newUserRole,
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const payload = (await response.json()) as Partial<SettingsPayload> & {
      createdCredentials?: CreatedCredential[];
      error?: string;
      linkedUsers?: LinkedUser[];
    };

    if (!response.ok) {
      setError(payload.error ?? "No se pudo crear usuario");
      setCreatingUser(false);
      return;
    }

    setUsers(payload.users ?? users);
    setCreatedCredentials(payload.createdCredentials ?? []);
    setLinkedUsers(payload.linkedUsers ?? []);
    setNewUserEmail("");
    setNewUserPassword("");
    setNewUserEntity("");
    setNewUserRole("consulta");
    setSaved(true);
    setCreatingUser(false);
  }

  async function seedRoleUsers() {
    setCreatingUser(true);
    setSaved(false);
    setError(null);

    const response = await fetch("/api/configuracion", {
      body: JSON.stringify({
        action: "seed_role_users",
        entity: entity.name,
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const payload = (await response.json()) as Partial<SettingsPayload> & {
      createdCredentials?: CreatedCredential[];
      error?: string;
      linkedUsers?: LinkedUser[];
    };

    if (!response.ok) {
      setError(payload.error ?? "No se pudieron crear usuarios base");
      setCreatingUser(false);
      return;
    }

    setUsers(payload.users ?? users);
    setCreatedCredentials(payload.createdCredentials ?? []);
    setLinkedUsers(payload.linkedUsers ?? []);
    setSaved(true);
    setCreatingUser(false);
  }

  async function saveUser(user: UserSetting) {
    setSavingUserId(user.id);
    setSaved(false);
    setError(null);

    const response = await fetch("/api/configuracion", {
      body: JSON.stringify({
        action: "update_user",
        entity: user.entity,
        role: user.role,
        userId: user.id,
      }),
      headers: { "Content-Type": "application/json" },
      method: "PATCH",
    });
    const payload = (await response.json()) as Partial<SettingsPayload> & { error?: string };

    if (!response.ok) {
      setError(payload.error ?? "No se pudo actualizar usuario");
      setSavingUserId(null);
      return;
    }

    setUsers(payload.users ?? users);
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

    const response = await fetch(`/api/configuracion?userId=${encodeURIComponent(user.id)}`, {
      method: "DELETE",
    });
    const payload = (await response.json()) as Partial<SettingsPayload> & { error?: string };

    if (!response.ok) {
      setError(payload.error ?? "No se pudo eliminar usuario");
      setSavingUserId(null);
      return;
    }

    setUsers(payload.users ?? users.filter((item) => item.id !== user.id));
    setSaved(true);
    setSavingUserId(null);
  }

  if (loading) {
    return (
      <div className="emptyState">
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
        <div className="settingsGrid single">
          <section className="toolPanel">
          <div className="toolPanelHeader">
            <div>
              <p className="eyebrow">Entidad</p>
              <h2>Informacion institucional</h2>
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
                <small>{entity.ruc.length}/11 digitos</small>
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
                <small>{entity.executingUnit.length}/6 digitos</small>
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
            <label>
              <span>Tipo de gobierno</span>
              <select
                onChange={(event) =>
                  setEntity((current) => ({ ...current, governmentLevel: event.target.value }))
                }
                value={entity.governmentLevel}
              >
                <option value="">Seleccionar nivel</option>
                {governmentLevels.map((level) => (
                  <option key={level.value} value={level.value}>
                    {level.label}
                  </option>
                ))}
              </select>
              <small>
                Se usa para identificar el ambito institucional en reportes, expedientes y auditoria.
              </small>
            </label>
            <div className="settingsUsagePanel">
              <strong>Uso dentro de ACE</strong>
              <span>Expedientes y documentos generados tomaran esta entidad como contexto predeterminado.</span>
              <span>Auditoria registrara entidad, rol y usuario para trazabilidad institucional.</span>
              <span>Validar y Analiza podran incorporar estos datos en informes y exportaciones.</span>
            </div>
          </div>
          </section>
        </div>
      ) : null}

      {activeTab === "procesos" ? (
        <section className="toolPanel">
        <div className="toolPanelHeader">
          <div>
            <p className="eyebrow">Catalogo</p>
            <h2>Procedimientos de contratacion</h2>
          </div>
          <button className="secondaryButton" onClick={addProcess} type="button">
            <Plus size={16} />
            Agregar proceso
          </button>
        </div>
        <div className="processSettingsIntro">
          <article>
            <strong>Competitivos</strong>
            <span>Licitaciones, concursos, SIE, comparacion de precios y concursos de proyectos.</span>
          </article>
          <article>
            <strong>No competitivos</strong>
            <span>Supuestos del articulo 55 de la Ley 32069 y desarrollo reglamentario.</span>
          </article>
          <article>
            <strong>Contratos menores</strong>
            <span>No son procedimiento competitivo; aplican reglas especiales hasta 8 UIT.</span>
          </article>
        </div>
        <div className="processSettingsList">
          {processTypes.map((item, index) => (
            <article className="processSettingsRow" key={`${item.code}-${index}`}>
              <label className="toggleLine">
                <input
                  checked={item.active}
                  onChange={(event) => updateProcess(index, { active: event.target.checked })}
                  type="checkbox"
                />
                <span>{item.active ? "Activo" : "Inactivo"}</span>
              </label>
              <label>
                <span>Nombre</span>
                <input
                  onBlur={() => {
                    if (!item.code && item.label) {
                      updateProcess(index, { code: codeFromLabel(item.label) });
                    }
                  }}
                  onChange={(event) => updateProcess(index, { label: event.target.value })}
                  placeholder="Ej. Licitacion publica"
                  value={item.label}
                />
              </label>
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
              <label>
                <span>Codigo</span>
                <input
                  onChange={(event) =>
                    updateProcess(index, { code: codeFromLabel(event.target.value) })
                  }
                  placeholder="licitacion_publica"
                  value={item.code}
                />
              </label>
              <label>
                <span>Sustento / referencia</span>
                <input
                  onChange={(event) => updateProcess(index, { legalBasis: event.target.value })}
                  placeholder="Ley 32069, Reglamento, Bases Estandar DGA..."
                  value={item.legalBasis}
                />
              </label>
              <label className="processDescription">
                <span>Descripcion operativa</span>
                <input
                  onChange={(event) => updateProcess(index, { description: event.target.value })}
                  placeholder="Uso interno, directiva aplicable o nota breve"
                  value={item.description}
                />
              </label>
              <label className="toggleLine">
                <input
                  checked={item.frequentMunicipality}
                  onChange={(event) =>
                    updateProcess(index, { frequentMunicipality: event.target.checked })
                  }
                  type="checkbox"
                />
                <span>Frecuente municipal</span>
              </label>
              <label className="sortField">
                <span>Orden</span>
                <input
                  inputMode="numeric"
                  onChange={(event) =>
                    updateProcess(index, { sortOrder: Number.parseInt(event.target.value || "0", 10) })
                  }
                  value={item.sortOrder}
                />
              </label>
              <button
                aria-label="Eliminar proceso"
                className="iconButton"
                onClick={() => removeProcess(index)}
                type="button"
              >
                <Trash2 size={15} />
              </button>
            </article>
          ))}
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
                  <article key={role.value}>
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
            <span>{users.length} total</span>
          </div>
          <div className="usersSettingsList">
            {users.length === 0 ? (
              <div className="emptyState">
                <Users size={20} />
                <span>No hay perfiles registrados todavia.</span>
              </div>
            ) : (
              users.map((user, index) => (
                <article className="userSettingsRow" key={user.id}>
                  <div className="userSettingsIdentity">
                    <strong>{user.email ?? "Usuario sin correo"}</strong>
                    <span>{roleLabel(user.role)} · {user.id}</span>
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
                    className="iconButton"
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
