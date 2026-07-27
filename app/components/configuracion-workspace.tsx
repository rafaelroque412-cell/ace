"use client";

import dynamic from "next/dynamic";
import { AlertCircle, Building2, CalendarDays, CheckCircle2, FileSpreadsheet, Hash, Landmark, UserCog } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { AdminSettings } from "./admin-settings";
import { ConfirmDialog } from "./confirm-dialog";
import { useOficinas } from "./oficinas/use-oficinas";

// Oficinas arrastra 2 662 lineas de subcomponentes —areas, numeracion,
// membrete, modelos y sus dos modales— para una seccion que hay que elegir.
const OficinasSettings = dynamic(() => import("./oficinas-settings").then((m) => m.OficinasSettings), {
  loading: () => (
    <div className="grid gap-3" aria-busy="true">
      <div className="h-9 w-64 animate-pulse rounded-lg bg-line/70" />
      <div className="h-52 animate-pulse rounded-[10px] bg-line/70" />
    </div>
  ),
  ssr: false,
});

type SectionKey =
  | "municipalidad"
  | "areas"
  | "numeracion"
  | "membrete"
  | "usuarios"
  | "feriados";

type NavItem = {
  key: SectionKey;
  icon: React.ReactNode;
  label: string;
  desc: string;
  owner: "admin" | "ofic";
};

// Una sola navegación para TODA la configuración, agrupada por dominio. Antes
// vivían en dos componentes apilados (AdminSettings + OficinasSettings), cada uno
// con su propio hero y su propia barra de pestañas: cuatro encabezados y dos
// menús para seis secciones. Aquí la navegación es única y aquellos componentes
// se han quedado solo con el contenido de cada sección.
const NAV: { grupo: string; items: NavItem[] }[] = [
  {
    grupo: "Entidad",
    items: [
      {
        key: "municipalidad",
        icon: <Landmark size={18} />,
        label: "Municipalidad",
        desc: "Datos de la entidad y autoridad",
        owner: "admin",
      },
    ],
  },
  {
    grupo: "Oficinas y documentos",
    items: [
      {
        key: "areas",
        icon: <Building2 size={18} />,
        label: "Áreas",
        desc: "Oficinas emisoras",
        owner: "ofic",
      },
      {
        key: "numeracion",
        icon: <Hash size={18} />,
        label: "Numeración",
        desc: "Correlativos por documento",
        owner: "ofic",
      },
      {
        key: "membrete",
        icon: <FileSpreadsheet size={18} />,
        label: "Membrete",
        desc: "Hoja membretada de PDF",
        owner: "ofic",
      },
    ],
  },
  {
    grupo: "Acceso",
    items: [
      {
        key: "usuarios",
        icon: <UserCog size={18} />,
        label: "Usuarios",
        desc: "Cuentas, roles y permisos",
        owner: "admin",
      },
    ],
  },
  {
    grupo: "Sistema",
    items: [
      {
        key: "feriados",
        icon: <CalendarDays size={18} />,
        label: "Feriados",
        desc: "Días no laborables (plazos)",
        owner: "admin",
      },
    ],
  },
];

/**
 * Cabecera de cada sección: qué es y para qué sirve, en una frase.
 *
 * Vive aquí y no en cada pestaña porque el workspace ya sabe cuál está activa:
 * así las seis empiezan igual —antes unas abrían con un párrafo suelto y otras
 * directamente con la lista— y añadir una sección no obliga a recordar el patrón.
 */
const SECCION_INFO: Record<SectionKey, { titulo: string; sub: string }> = {
  municipalidad: {
    titulo: "Datos de la entidad",
    sub: "Identificación, autoridad y montos del PAC. Es lo que se imprime en la cabecera de los documentos que la entidad firma.",
  },
  areas: {
    titulo: "Áreas y oficinas",
    sub: "Las oficinas que emiten documentos. Registra primero el área; después podrás darle numeración y hoja membretada.",
  },
  numeracion: {
    titulo: "Numeración de documentos",
    sub: "Qué tipos de documento emite cada oficina y desde qué correlativo empieza cada uno.",
  },
  membrete: {
    titulo: "Hoja membretada",
    sub: "El PDF de fondo sobre el que se redactan las respuestas oficiales. Sin membrete, el PDF exportado sale sin membrete.",
  },
  usuarios: {
    titulo: "Usuarios y accesos",
    sub: "Cuentas del sistema. El rol define los permisos; la oficina y la jefatura, qué expedientes ve cada persona.",
  },
  feriados: {
    titulo: "Feriados y días no laborables",
    sub: "Se descuentan —junto a sábados y domingos— al calcular las fechas del cronograma de la estrategia.",
  },
};

const OWNER: Record<SectionKey, "admin" | "ofic"> = {
  municipalidad: "admin",
  usuarios: "admin",
  feriados: "admin",
  areas: "ofic",
  numeracion: "ofic",
  membrete: "ofic",
};

type Summary = {
  entityComplete: boolean;
  usersCount: number;
  oficinasCount: number;
  oficinasConMembrete: number;
  oficinasConNumeracion: number;
  feriadosCount: number | null;
};

const SUMMARY_INICIAL: Summary = {
  entityComplete: false,
  usersCount: 0,
  oficinasCount: 0,
  oficinasConMembrete: 0,
  oficinasConNumeracion: 0,
  feriadosCount: null,
};

// Indicador (badge) que se pinta a la derecha de cada ítem de la barra lateral.
// `tono`: ok = verde (listo), warn = ámbar (falta algo), mute = gris (informativo).
type Indicador = { texto: string; tono: "ok" | "warn" | "mute" } | null;

export function ConfiguracionWorkspace({ currentUserId }: { currentUserId: string }) {
  const [active, setActive] = useState<SectionKey>("municipalidad");
  const [summary, setSummary] = useState<Summary>(SUMMARY_INICIAL);
  /** Sección a la que se quiere ir dejando cambios sin guardar (pide confirmar). */
  const [saltoPendiente, setSaltoPendiente] = useState<SectionKey | null>(null);
  // Las oficinas se cargan UNA vez para toda la configuración: las consumen la
  // sección de Oficinas (Áreas/Numeración/Membrete), el desplegable de "Oficina
  // asignada" del alta de usuarios y los indicadores de la barra lateral.
  const oficinasState = useOficinas();

  const adminSection =
    OWNER[active] === "admin" ? (active as "municipalidad" | "usuarios" | "feriados") : null;
  const oficSection =
    OWNER[active] === "ofic" ? (active as "areas" | "numeracion" | "membrete") : null;

  // Callbacks estables: los hijos ya tienen los datos y los reportan aquí.
  const reportAdmin = useCallback(
    (s: { entityComplete: boolean; usersCount: number }) =>
      setSummary((prev) => ({ ...prev, entityComplete: s.entityComplete, usersCount: s.usersCount })),
    [],
  );
  // Los indicadores de oficinas se derivan del estado que ya vive aquí.
  const { oficinas, loading: oficinasCargando, sinGuardar } = oficinasState;

  // Áreas y Numeración editan sobre el estado compartido: salir de ellas con
  // cambios pendientes los descartaba en silencio (la siguiente recarga los
  // revertía). Se avisa antes de perderlos.
  const editandoOficinas = active === "areas" || active === "numeracion";
  const hayPendientes = sinGuardar && editandoOficinas;

  function irA(destino: SectionKey) {
    if (destino === active) return;
    if (hayPendientes) {
      setSaltoPendiente(destino);
      return;
    }
    setActive(destino);
  }

  // Aviso del navegador al cerrar/recargar la pestaña con cambios pendientes.
  useEffect(() => {
    if (!hayPendientes) return;
    const alSalir = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", alSalir);
    return () => window.removeEventListener("beforeunload", alSalir);
  }, [hayPendientes]);
  useEffect(() => {
    if (oficinasCargando) return;
    setSummary((prev) => ({
      ...prev,
      oficinasCount: oficinas.length,
      oficinasConMembrete: oficinas.filter((o) => o.membrete).length,
      oficinasConNumeracion: oficinas.filter((o) => o.counters.some((c) => c.enabled)).length,
    }));
  }, [oficinas, oficinasCargando]);

  // Feriados carga aparte (dentro de su pestaña); aquí se consulta solo el conteo
  // para el indicador. La dependencia es "¿estoy en feriados?" y no la sección
  // activa: así se consulta al entrar y al salir de esa pestaña —que es cuando el
  // número puede haber cambiado— en vez de en cada uno de los seis saltos de menú.
  const enFeriados = active === "feriados";
  useEffect(() => {
    let vivo = true;
    void (async () => {
      try {
        const r = await fetch("/api/configuracion/feriados", { cache: "no-store" });
        const d = await r.json();
        if (vivo) setSummary((prev) => ({ ...prev, feriadosCount: (d.feriados ?? []).length }));
      } catch {
        /* sin indicador */
      }
    })();
    return () => {
      vivo = false;
    };
  }, [enFeriados]);

  // Resumen antes del detalle: configurar es una puesta a punto, y lo primero
  // que hace falta saber es cuánto queda. Se cuenta "lista" una sección cuando
  // tiene lo mínimo para que el resto de la aplicación funcione.
  const listas: Record<SectionKey, boolean> = {
    municipalidad: summary.entityComplete,
    areas: summary.oficinasCount > 0,
    numeracion: summary.oficinasConNumeracion > 0,
    membrete: summary.oficinasConMembrete > 0,
    usuarios: summary.usersCount > 0,
    feriados: (summary.feriadosCount ?? 0) > 0,
  };
  const totalSecciones = Object.keys(listas).length;
  const completas = Object.values(listas).filter(Boolean).length;
  const pct = Math.round((completas / totalSecciones) * 100);

  const indicadores: Record<SectionKey, Indicador> = {
    municipalidad: summary.entityComplete
      ? { texto: "Listo", tono: "ok" }
      : { texto: "Incompleto", tono: "warn" },
    areas:
      summary.oficinasCount === 0
        ? { texto: "0", tono: "warn" }
        : { texto: String(summary.oficinasCount), tono: "mute" },
    numeracion:
      summary.oficinasCount === 0
        ? { texto: "Falta área", tono: "warn" }
        : { texto: `${summary.oficinasConNumeracion}/${summary.oficinasCount}`, tono: "mute" },
    membrete:
      summary.oficinasCount === 0
        ? { texto: "Falta área", tono: "warn" }
        : { texto: `${summary.oficinasConMembrete}/${summary.oficinasCount}`, tono: "mute" },
    usuarios: { texto: String(summary.usersCount), tono: summary.usersCount === 0 ? "warn" : "mute" },
    feriados:
      summary.feriadosCount === null
        ? null
        : { texto: String(summary.feriadosCount), tono: summary.feriadosCount === 0 ? "warn" : "mute" },
  };

  return (
    <div className="configLayout">
      <aside className="configNav" aria-label="Secciones de configuración">
        <div className="configResumen">
          <div
            aria-hidden
            className="configResumenAnillo"
            style={{ "--pct": pct } as React.CSSProperties}
          >
            <span>{completas}/{totalSecciones}</span>
          </div>
          <div className="configResumenTexto">
            <span className="configResumenTitulo">
              {completas === totalSecciones ? "Configuración completa" : "Puesta a punto"}
            </span>
            <span className="configResumenPie">
              {completas === totalSecciones
                ? "Todas las secciones tienen lo mínimo registrado."
                : `Faltan ${totalSecciones - completas} de ${totalSecciones} secciones por completar.`}
            </span>
          </div>
        </div>

        {NAV.map((grupo) => (
          <div className="configNavGroup" key={grupo.grupo}>
            <p className="configNavGroupTitle">{grupo.grupo}</p>
            {grupo.items.map((it) => {
              const ind = indicadores[it.key];
              return (
                <button
                  aria-current={active === it.key ? "page" : undefined}
                  className="configNavItem"
                  key={it.key}
                  onClick={() => irA(it.key)}
                  type="button"
                >
                  <span className="configNavIcon">{it.icon}</span>
                  <span className="configNavText">
                    <span className="configNavLabel">{it.label}</span>
                    <span className="configNavDesc">{it.desc}</span>
                  </span>
                  {ind ? (
                    <span className={`configNavBadge ${ind.tono}`}>
                      {ind.tono === "ok" ? (
                        <CheckCircle2 size={11} />
                      ) : ind.tono === "warn" ? (
                        <AlertCircle size={11} />
                      ) : null}
                      {ind.texto}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        ))}
      </aside>

      <div className="configPanel">
        <header className="configSeccionHead">
          <span className="configSeccionIcono" aria-hidden>
            {NAV.flatMap((g) => g.items).find((i) => i.key === active)?.icon}
          </span>
          <div className="configSeccionTexto">
            <h2 className="configSeccionTitulo">{SECCION_INFO[active].titulo}</h2>
            <p className="configSeccionSub">{SECCION_INFO[active].sub}</p>
          </div>
          {indicadores[active] ? (
            <div className="configSeccionAcciones">
              <span className={`configNavBadge ${indicadores[active]!.tono}`}>
                {indicadores[active]!.tono === "ok" ? (
                  <CheckCircle2 size={11} />
                ) : indicadores[active]!.tono === "warn" ? (
                  <AlertCircle size={11} />
                ) : null}
                {indicadores[active]!.texto}
              </span>
            </div>
          ) : null}
        </header>

        {hayPendientes ? (
          <p className="configSinGuardar" role="status">
            <AlertCircle size={13} aria-hidden />
            Hay cambios sin guardar en esta sección. Pulsa <strong>Guardar</strong> antes de salir:
            todavía solo existen en este navegador.
          </p>
        ) : null}
        <AdminSettings
          currentUserId={currentUserId}
          oficinas={oficinas.map((o) => ({ id: o.id, nombre: o.nombre }))}
          onReloadOficinas={oficinasState.reload}
          onSummary={reportAdmin}
          section={adminSection}
        />
        <OficinasSettings
          aplicarDelServidor={oficinasState.aplicarDelServidor}
          error={oficinasState.error}
          loading={oficinasState.loading}
          oficinas={oficinas}
          reload={oficinasState.reload}
          section={oficSection}
          setOficinas={oficinasState.setOficinas}
        />
      </div>

      <ConfirmDialog
        open={saltoPendiente !== null}
        title="Cambios sin guardar"
        message="Los cambios de esta sección todavía no se han guardado. Si sales ahora se descartarán."
        tone="warning"
        confirmLabel="Salir sin guardar"
        cancelLabel="Seguir aquí"
        onConfirm={() => {
          const destino = saltoPendiente;
          setSaltoPendiente(null);
          // Se recarga del servidor para que lo descartado no siga en pantalla.
          void oficinasState.reload();
          if (destino) setActive(destino);
        }}
        onCancel={() => setSaltoPendiente(null)}
      />
    </div>
  );
}
