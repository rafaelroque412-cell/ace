# Contexto de trabajo — ACE · fase preparatoria (F1)

## Objective
- Implementar tres mejoras en el módulo Expedientes F1 (ya con ediciones aplicadas): (3) cálculo/verificación automática del beneficio de los 40 días en A10 (Art. 64.3); (4) notificación del cronograma de presentación de requerimientos hacia el área usuaria (Guía sección I y Art. 42.2); (5) enlace verificable a las bases estándar vigentes en A9 (R.D. 001-2026-EF/54.01).

## Important Details
- Repo: `C:\Users\USER\Documents\ace` · Next.js 16 + TS estricto + React 19 + Tailwind + Supabase PostgREST + Vitest. Trabajar en español; **NO commitear** sin autorización explícita.
- Guía en `%TEMP%\opencode\guia-actualizada.txt`: el texto dice «numeral 64.1» pero los campos y `estrategia-formato.ts:406` citan el numeral 64.3; la implementación usa **Art. 64.3**. URL de bases: `https://www.gob.pe/institucion/mef/normas-legales/7614342-001-2026-ef-54-01`.
- `writeAuditLog` (lib/supabase-server.ts:330) y `fase1.cronograma_listo` en `hitos/route.ts`; la ruta `notificaciones/route.ts` ya filtra esa action (patrón two-step: token de usuario para 404 de acceso, clave de servicio para leer). `timeline-expediente.ts:55` ya etiqueta la action — no necesita cambio.
- La action no cambia de nombre (sigue `fase1.cronograma_listo`); solo se enriquece su `details`.
- `CampoFormulario` ahora tiene `enlace?: { texto: string; url: string }`.
- `avisosA10` formatea fechas como `dd/mm/yyyy` y usa `restarDiasCalendario(convocatoria, 40)` + `diasCalendarioEntre(publicacion, convocatoria)`; los avisos son informativos («es un cálculo, no un candado»).
- `cronogramaRequerimientosDetalle` filtra solo filas con `area` y `fecha` no vacías; sin filas devuelve el mensaje genérico anterior.
- Patrón del repo: funciones puras exportadas y testeadas; avisos de paso con `pasoGating`/`pasoGatingWarn` + `AlertTriangle`.

## Work State
### Completed
- Trabajo previo verificado en verde (A5 CEAM, aviso orden A3→A2, centralización `esNoProgramada`/`esProgramada`, documento de modificación del CMN en informes): tsc limpio, eslint 0 errores, 2315 tests / 165 archivos.
- **Tarea 3 (A10)**:
  - `lib/cronograma-fechas.ts`: nuevo export `restarDiasCalendario(iso, dias)` (junto a `sumarDiasCalendario`).
  - `lib/actuaciones-preparatorias.ts`: import de `diasCalendarioEntre` y `restarDiasCalendario` desde `./cronograma-fechas`; nueva función exportada `avisosA10(data): AvisoPaso[]` al final del archivo.
  - `app/components/fase-panel.tsx`: import de `avisosA10`; `const avisosDeA10 = code === "A10" ? avisosA10(draftData) : []` junto a `avisosDeA1` (~línea 1010); render con `className={pasoGating ${a.nivel === "error" ? "pasoGatingWarn" : ""}}` (error → amarillo, warn → sin clase extra).
- **Tarea 4 (cronograma)**:
  - `lib/actuaciones-preparatorias.ts`: nuevo export `cronogramaRequerimientosDetalle(items)` → `{ mensaje, filas }` con filas `{ area, fecha }` y mensaje con fechas unidas por `" · "`.
  - `app/api/processes/[id]/hitos/route.ts`: al marcar `A2` hecho, `details` ahora incluye `message: cronograma.mensaje` y `cronograma: cronograma.filas` (import añadido, mismo action).
  - `app/api/processes/[id]/notificaciones/route.ts`: `AuditRow.details` ampliado con `cronograma?: { area: string; fecha: string }[]`.
  - `app/components/fase-preparatoria/notification-banner.tsx`: renderiza `<ul className="notifBannerCrono">` con las filas bajo el mensaje.
  - `app/styles.css`: añadido `.notifBannerCrono`.
- **Tarea 5 (A9)**:
  - `CampoFormulario` (lib/actuaciones-preparatorias.ts:44): nueva propiedad opcional `enlace?: { texto: string; url: string }`.
  - Campo `version_bases_estandar` de A9: añadido `enlace` con texto «Ver las bases estándar vigentes en el portal del MEF» y la URL del R.D.
  - `app/components/fase-panel.tsx` `Campo`: constante `ayudaConEnlace` (ayuda + `<a>` con clase `pasoFieldEnlace`) tras `labelContent`; **todas las ramas de render** (boolean, cronograma, factores, roles, requisitos, proveedores, texto/select/date, etc.) ahora emiten `{ayudaConEnlace}`.
  - `app/styles.css`: añadido `.pasoFieldEnlace` (+ hover).
- **Tests (verdes)**:
  - `tests/beneficio-anuncio-a10.test.ts` (nuevo, 9 tests): `avisosA10` (5) y `cronogramaRequerimientosDetalle` (3) + casos límite.
  - `tests/cronograma-fechas.test.ts`: +3 tests de `restarDiasCalendario` (40 días exactos, cruce de mes, 0 días).
  - `tests/actuaciones-preparatorias.test.ts`: +2 tests A9 (enlace exacto del R.D.; solo ese campo lleva enlace).
- **Verificación final**: `npx tsc --noEmit` limpio; `npm run lint` 0 errores (51 warnings preexistentes ajenos en `process-list.tsx`); `npx vitest run` 166 archivos / 2329 tests todos verdes.

### Active
- (none)

### Blocked
- (none)

## Next Move
- Esperar decisión: revisar diffs con `git diff`, hacer QA visual en preview, o correr la build de CI. **No commitear** sin permiso.
- Si se pide: comprobar que el banner de notificación muestra las filas del cronograma (`.notifBannerCrono`) en la UI del área usuaria.

## Relevant Files
- `lib/actuaciones-preparatorias.ts`: `avisosA10` y `cronogramaRequerimientosDetalle` (nuevos, final del archivo), prop `enlace` en `CampoFormulario`, campo `version_bases_estandar` (~1817) con enlace, `avisosA1` (~2012, intacto), import `diasCalendarioEntre` + `restarDiasCalendario`.
- `lib/cronograma-fechas.ts`: `restarDiasCalendario` (nuevo, ~149).
- `app/components/fase-panel.tsx`: import `avisosA10` (~39), `avisosDeA10` (~1010), render de avisos (~1310), `ayudaConEnlace` en `Campo` (tras `labelContent`, ~375) cableado en todas las ramas.
- `app/api/processes/[id]/hitos/route.ts`: import del detalle (línea 5 aprox), bloque `fase1.cronograma_listo` con `cronograma.mensaje`/`cronograma.filas`.
- `app/api/processes/[id]/notificaciones/route.ts`: tipo `AuditRow` con `cronograma`.
- `app/components/fase-preparatoria/notification-banner.tsx`: lista `.notifBannerCrono`.
- `app/styles.css`: `.notifBannerCrono` y `.pasoFieldEnlace` añadidos.
- `lib/timeline-expediente.ts:55`: sin cambios (action ya etiquetada).
- Tests: `tests/beneficio-anuncio-a10.test.ts` (nuevo), `tests/cronograma-fechas.test.ts`, `tests/actuaciones-preparatorias.test.ts`.
- `%TEMP%\opencode\guia-actualizada.txt`: líneas ~144–145 y 159 (cronograma), ~633 (URL bases), ~656–660 (40 días).
