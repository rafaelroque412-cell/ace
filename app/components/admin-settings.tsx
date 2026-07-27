"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import { MunicipalidadTab } from "./configuracion/municipalidad-tab";
import { ConfirmDialog } from "./confirm-dialog";
import {
  type CreatedCredential,
  type EntitySettings,
  type GovernmentLevel,
  type LinkedUser,
  type OficinaOption,
  type RoleOption,
  type RolePermission,
  type SettingsPayload,
  type UserSetting,
  emptyEntity,
  isEntityComplete,
} from "@/lib/configuracion-types";
import { esUsuarioValido, USUARIO_LONGITUD } from "@/lib/usuario-credencial";
import { useYear } from "@/lib/year-context";
import { useToastHelpers } from "@/lib/toast";

// Municipalidad NO se difiere: es la pestaña de inicio y es lo que se ve al
// entrar. Las otras dos solo aparecen si se pulsan.
const UsuariosTab = dynamic(() => import("./configuracion/usuarios-tab").then((m) => m.UsuariosTab), {
  loading: () => (
    <div className="grid gap-3" aria-busy="true">
      <div className="h-9 w-64 animate-pulse rounded-lg bg-line/70" />
      <div className="h-52 animate-pulse rounded-[10px] bg-line/70" />
    </div>
  ),
  ssr: false,
});
const FeriadosTab = dynamic(() => import("./configuracion/feriados-tab").then((m) => m.FeriadosTab), {
  loading: () => (
    <div className="grid gap-3" aria-busy="true">
      <div className="h-9 w-64 animate-pulse rounded-lg bg-line/70" />
      <div className="h-52 animate-pulse rounded-[10px] bg-line/70" />
    </div>
  ),
  ssr: false,
});

type Tab = "municipalidad" | "usuarios" | "feriados";

/**
 * Contenido de las secciones de Municipalidad, Usuarios y Feriados.
 *
 * La navegación y el encabezado los gobierna ConfiguracionWorkspace: aquí solo
 * se pinta la sección indicada. Antes traía también su propio hero y su barra de
 * pestañas para poder funcionar suelto, pero nunca se usó así —el workspace
 * siempre lo montaba en modo `chromeless`—, así que era JSX que no llegaba a la
 * pantalla.
 */
export function AdminSettings({
  currentUserId: currentUserIdProp,
  section,
  oficinas,
  onReloadOficinas,
  onSummary,
}: {
  currentUserId?: string;
  /** Sección a pintar. Si no es una de las suyas, no pinta nada. */
  section: Tab | null;
  /**
   * Oficinas para el desplegable "Oficina asignada". Las provee el workspace, que
   * ya las tiene cargadas: pedirlas aquí otra vez duplicaba la petición y traía
   * el payload completo (todas las oficinas con sus contadores) para usar solo
   * el id y el nombre.
   */
  oficinas: OficinaOption[];
  /** Relee las oficinas (al abrir el alta, por si se crearon en Áreas). */
  onReloadOficinas: () => Promise<void>;
  /** Reporta al workspace el estado para los indicadores de la barra lateral. */
  onSummary?: (s: { entityComplete: boolean; usersCount: number }) => void;
}) {
  const { yearParam } = useYear();
  const [entity, setEntity] = useState<EntitySettings>(emptyEntity);
  const [governmentLevels, setGovernmentLevels] = useState<GovernmentLevel[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [rolePermissions, setRolePermissions] = useState<RolePermission[]>([]);
  const [users, setUsers] = useState<UserSetting[]>([]);
  const [createdCredentials, setCreatedCredentials] = useState<CreatedCredential[]>([]);
  const [linkedUsers, setLinkedUsers] = useState<LinkedUser[]>([]);
  const [creatingUser, setCreatingUser] = useState(false);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmSeed, setConfirmSeed] = useState(false);

  const { success: toastSuccess, error: toastError } = useToastHelpers();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setConfirmSeed(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [settingsResp, usersResp] = await Promise.all([
      fetch(`/api/configuracion/settings?${yearParam}`, { cache: "no-store" }),
      fetch("/api/configuracion/users?limit=200", { cache: "no-store" }),
    ]);
    const settingsPayload = (await settingsResp.json().catch(() => ({}))) as
      Partial<SettingsPayload> & { error?: string };
    if (!settingsResp.ok) {
      setError(settingsPayload.error ?? "No se pudo cargar la configuración");
      setLoading(false);
      return;
    }
    const usersPayload = (await usersResp.json().catch(() => ({}))) as
      Partial<SettingsPayload> & { error?: string };

    const nextEntity = { ...emptyEntity, ...(settingsPayload.entity ?? {}) };
    setEntity(nextEntity);
    setGovernmentLevels(settingsPayload.governmentLevels ?? []);
    setRoles(settingsPayload.roles ?? []);
    setRolePermissions(settingsPayload.rolePermissions ?? []);
    setUsers(usersPayload.users ?? []);
    setLoading(false);
  }, [yearParam]);

  useEffect(() => {
    void load();
  }, [load]);

  // Reporta el resumen a la barra lateral en vivo: mismo criterio de "entidad
  // completa" que la pestaña (isEntityComplete), y se recalcula al editar la
  // entidad o la lista de usuarios, no solo en la carga.
  useEffect(() => {
    onSummary?.({ entityComplete: isEntityComplete(entity), usersCount: users.length });
  }, [entity, users, onSummary]);


  async function createUser(input: {
    usuario: string;
    entity: string;
    esJefe: boolean;
    oficinaId: string;
    password: string;
    role: string;
    nombreCompleto: string;
    dni: string;
    cargo: string;
    gradoAcademico: string;
  }) {
    if (!esUsuarioValido(input.usuario)) {
      toastError("Usuario inválido", `El usuario es el DNI: ${USUARIO_LONGITUD} dígitos.`);
      return;
    }
    setCreatingUser(true);
    setError(null);

    const response = await fetch("/api/configuracion/users", {
      body: JSON.stringify({
        usuario: input.usuario.trim(),
        entity: input.entity.trim() || entity.name,
        esJefe: input.esJefe,
        oficinaId: input.oficinaId || "",
        password: input.password,
        role: input.role,
        nombreCompleto: input.nombreCompleto.trim(),
        dni: input.dni.trim(),
        cargo: input.cargo.trim(),
        gradoAcademico: input.gradoAcademico.trim(),
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const payload = (await response.json().catch(() => ({}))) as {
      status?: "created" | "linked";
      usuario?: string;
      role?: string;
      password?: string;
      error?: string;
    };

    if (!response.ok) {
      toastError("Error al crear usuario", payload.error ?? "No se pudo crear usuario");
      setCreatingUser(false);
      return;
    }

    if (payload.status === "created" && payload.usuario && payload.password && payload.role) {
      // Se ACUMULAN, no se reemplazan: al crear dos usuarios seguidos, la
      // contraseña del primero desaparecía de pantalla para siempre —y el panel
      // avisa de que solo se muestran una vez—.
      setCreatedCredentials((prev) => [
        ...prev.filter((c) => c.usuario !== payload.usuario),
        { usuario: payload.usuario!, password: payload.password!, role: payload.role! },
      ]);
      setLinkedUsers([]);
    } else {
      setLinkedUsers(
        payload.status === "linked" && payload.usuario && payload.role
          ? [{ usuario: payload.usuario, role: payload.role, userId: "" }]
          : [],
      );
      setCreatedCredentials([]);
    }
    void load();
    toastSuccess("Usuario creado", `${payload.usuario} agregado correctamente`);
    setCreatingUser(false);
  }

  async function seedRoleUsers() {
    setConfirmSeed(false);
    setCreatingUser(true);
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
      toastError("Error", payload.error ?? "No se pudieron crear usuarios base");
      setCreatingUser(false);
      return;
    }

    // Las cuentas del seed son por ROL (dec@ace.local), no por DNI: se muestran
    // con su correo como identificador, que es con lo que realmente entran.
    setCreatedCredentials(
      (payload.created ?? []).map((c) => ({ usuario: c.email, password: c.password, role: c.role })),
    );
    setLinkedUsers(
      (payload.linked ?? []).map((l) => ({ usuario: l.email, role: l.role, userId: l.userId })),
    );
    void load();
    toastSuccess("Usuarios base creados", `${(payload.created?.length ?? 0) + (payload.linked?.length ?? 0)} usuarios procesados`);
    setCreatingUser(false);
  }

  async function saveUser(user: UserSetting) {
    setSavingUserId(user.id);
    setError(null);

    const response = await fetch(`/api/configuracion/users/${encodeURIComponent(user.id)}`, {
      body: JSON.stringify({
        entity: user.entity,
        esJefe: Boolean(user.esJefe),
        oficinaId: user.oficinaId || "",
        role: user.role,
        nombreCompleto: user.nombreCompleto ?? "",
        dni: user.dni ?? "",
        cargo: user.cargo ?? "",
        gradoAcademico: user.gradoAcademico ?? "",
      }),
      headers: { "Content-Type": "application/json" },
      method: "PATCH",
    });
    const payload = (await response.json().catch(() => ({}))) as { error?: string };

    if (!response.ok) {
      toastError("Error al actualizar", payload.error ?? "No se pudo actualizar usuario");
      setSavingUserId(null);
      return;
    }

    void load();
    toastSuccess("Usuario actualizado", `${user.email} guardado correctamente`);
    setSavingUserId(null);
  }

  /**
   * Restablece la contraseña de un usuario y muestra la temporal en el panel de
   * credenciales. Es la única vía de recuperación: las cuentas usan correos
   * @ace.local, que no reciben el email de recuperación de Supabase.
   */
  async function resetPassword(user: UserSetting) {
    setSavingUserId(user.id);
    setError(null);

    const response = await fetch(
      `/api/configuracion/users/${encodeURIComponent(user.id)}/password`,
      { method: "POST" },
    );
    const payload = (await response.json().catch(() => ({}))) as {
      usuario?: string;
      password?: string;
      error?: string;
    };

    if (!response.ok || !payload.password) {
      toastError("No se pudo restablecer", payload.error ?? "Inténtalo de nuevo.");
      setSavingUserId(null);
      return;
    }

    const usuario = payload.usuario || user.email || user.id;
    setCreatedCredentials((prev) => [
      ...prev.filter((c) => c.usuario !== usuario),
      { usuario, password: payload.password!, role: user.role },
    ]);
    setLinkedUsers([]);
    toastSuccess("Contraseña restablecida", `Entrega la nueva clave a ${usuario}`);
    setSavingUserId(null);
  }

  async function deleteUser(user: UserSetting) {
    setSavingUserId(user.id);
    setError(null);

    const response = await fetch(
      `/api/configuracion/users?userId=${encodeURIComponent(user.id)}`,
      { method: "DELETE" },
    );
    const payload = (await response.json().catch(() => ({}))) as { error?: string; aviso?: string };

    if (!response.ok) {
      toastError("Error al eliminar", payload.error ?? "No se pudo eliminar usuario");
      setSavingUserId(null);
      return;
    }

    if (payload.aviso) {
      // El acceso se revocó, pero la ficha sigue ahí: se recarga para que la
      // lista muestre la realidad en vez de dar por hecho que desapareció.
      toastError("Eliminado a medias", payload.aviso);
      void load();
      setSavingUserId(null);
      return;
    }

    setUsers(users.filter((item) => item.id !== user.id));
    toastSuccess("Usuario eliminado", `${user.email} ha sido removido`);
    setSavingUserId(null);
  }

  // Solo pinta cuando la sección activa es una de las suyas.
  if (!section) return null;

  if (loading && !entity.name) {
    return (
      <div className="emptyState" role="status" aria-live="polite">
        <span>Cargando configuración…</span>
      </div>
    );
  }

  const shownTab: Tab = section;

  return (
    <div className="settingsLayout">
      {error ? <p className="evalError">{error}</p> : null}

      {shownTab === "municipalidad" ? (
        <MunicipalidadTab
          entity={entity}
          setEntity={setEntity}
          governmentLevels={governmentLevels}
        />
      ) : null}

      {shownTab === "usuarios" ? (
        <UsuariosTab
          entity={entity}
          users={users}
          setUsers={setUsers}
          oficinas={oficinas}
          roles={roles}
          rolePermissions={rolePermissions}
          createdCredentials={createdCredentials}
          linkedUsers={linkedUsers}
          creatingUser={creatingUser}
          savingUserId={savingUserId}
          currentUserId={currentUserIdProp ?? ""}
          onCreateUser={createUser}
          onReloadOficinas={onReloadOficinas}
          onSeedRoleUsers={() => setConfirmSeed(true)}
          onSaveUser={saveUser}
          onResetPassword={resetPassword}
          onDeleteUser={deleteUser}
        />
      ) : null}

      {shownTab === "feriados" ? <FeriadosTab /> : null}

      <div className="settingsFooter">
        <div>
          {shownTab === "municipalidad" ? (
            <span>Los datos se guardan automáticamente mientras escribes. RUC: 11 dígitos. Unidad ejecutora: 6 dígitos.</span>
          ) : shownTab === "usuarios" ? (
            <span>El rol define los permisos; la oficina y la jefatura definen qué expedientes ve cada usuario.</span>
          ) : (
            <span>Calendario de feriados y días no laborables, usado para calcular plazos.</span>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmSeed}
        title="Crear usuarios por perfil"
        message={
          "Esto creara (o vinculará) un usuario por cada perfil del sistema. Los correos se generan con el dominio @ace.local (no reciben correos de recuperación). Las contraseñas temporales se mostrarán después. ¿Continuar?"
        }
        tone="warning"
        confirmLabel="Crear usuarios"
        onConfirm={seedRoleUsers}
        onCancel={() => setConfirmSeed(false)}
      />
    </div>
  );
}
