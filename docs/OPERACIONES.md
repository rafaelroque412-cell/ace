# Operaciones — ACE IA Jurídica

Guía operativa de la Fase 4 institucional: cola de indexación, roles, OCR,
monitoreo/auditoría, backups y el diseño diferido de ingesta externa (Drive/S3).

## 1. Roles

| Rol | Permisos |
|-----|----------|
| `user` | Lee el corpus, usa chat/búsqueda/normas/análisis, guarda y sigue temas. |
| `editor` | Todo lo de `user` + **gestiona el corpus**: sube, reindexa y borra documentos. |
| `admin` | Todo + gestión de usuarios, evaluación continua, monitoreo y auditoría. |

- **Bootstrap:** el **primer usuario registrado** se promueve automáticamente a `admin`
  (trigger `handle_new_user`). El resto nace como `user`.
- Promover manualmente:
  ```sql
  update public.profiles set role = 'editor' where email = 'persona@dominio.pe';
  update public.profiles set role = 'admin'  where email = 'persona@dominio.pe';
  ```
- Gating: rutas de corpus usan `requireEditor`; rutas de gobernanza (eval, métricas,
  auditoría) usan `requireAdmin`. RLS replica esto con `is_editor()` / `is_admin()`.

## 2. Cola de indexación (drainer)

La subida y el reindexado responden 202 y procesan en `after()` (vía rápida). Si la
invocación serverless muere a mitad, el documento queda atascado en `uploaded` o en
`processing`. El **drainer** lo recupera reprocesando desde Storage.

- Endpoint: `GET|POST /api/documents/drain`.
  - **Cron de Vercel:** autorizado con header `Authorization: Bearer $CRON_SECRET`.
  - **Manual:** un `editor`/`admin` lo dispara desde **Monitoreo → Drenar cola**.
- Cron configurado en `vercel.json` cada 5 minutos.
- Un documento `processing` más viejo que `INDEXING_STALE_MINUTES` (def. 10) se
  considera muerto y se re-encola. Cada corrida procesa `INDEXING_DRAIN_BATCH` (def. 3).
- El estado del documento (`status` + `updated_at`) **es** la cola; `processing_jobs`
  es el log detallado.

### Variables de entorno
```
CRON_SECRET=<aleatorio; configúralo también en Vercel>
INDEXING_STALE_MINUTES=10
INDEXING_DRAIN_BATCH=3
```

## 3. OCR de PDFs escaneados

Si un PDF no tiene texto seleccionable, se intenta OCR con **OpenAI Vision** en vez de
rechazarlo (antes se rechazaba). Controlado por:
```
OPENAI_PDF_OCR_ENABLED=true
OPENAI_PDF_OCR_MODEL=gpt-4o-mini
OPENAI_OCR_MAX_PAGES=25
```
Tiene costo por página; `OPENAI_OCR_MAX_PAGES` lo acota. El método de extracción usado
queda en `documents.metadata.extractionMethod` (`pdf-text` | `openai-ocr`).

## 4. Monitoreo y auditoría (admin)

- **/metricas** — conteos del corpus, estado del pipeline (en cola / procesando /
  indexados / con error / atascados), documentos en error, actividad reciente y botón
  para drenar la cola. Conteos vía función SQL `admin_metrics()` (escala sin traer filas).
- **/auditoria** — explorador de `audit_logs` con filtro por acción y detalle JSON.

## 5. Backups

Se usa la **gestión de backups de Supabase** (no se reinventa a nivel de app):

- **Postgres:** backups diarios automáticos del proyecto (plan Pro: PITR / point-in-time
  recovery). Restauración desde el dashboard de Supabase → Database → Backups.
- **Storage (bucket `documents`):** los PDFs originales son la fuente de verdad para
  reindexar; respaldarlos con una copia periódica del bucket (rclone / `supabase storage`
  o réplica a almacenamiento frío) según política de retención.
- **Recuperación ante pérdida de índice (Pinecone):** Pinecone es **derivado**; ante
  pérdida, reindexar el corpus desde los PDFs en Storage (subida/reindex → drainer).
  No requiere backup propio de vectores.

### Checklist de restauración
1. Restaurar Postgres al punto deseado (dashboard Supabase).
2. Verificar que el bucket `documents` tiene los PDFs.
3. Reindexar masivamente (`POST /api/documents/reindex`) o dejar que el drainer procese
   los `uploaded`/atascados.

## 6. Ingesta externa Drive/S3 (diseño diferido)

No implementado aún; diseño acordado para cuando se priorice:

- **Nuevo endpoint** `POST /api/documents/import` (admin) que reciba `{ source: "drive"|"s3", ref }`.
- **Conector** en `lib/ingestion/<source>.ts` que liste y descargue PDFs de la fuente:
  - *Drive:* service account de Google (`GOOGLE_SERVICE_ACCOUNT_JSON`) + ID de carpeta;
    `drive.files.list` (mimeType=application/pdf) → descarga → `uploadPdfToStorage` →
    insert en `documents` (status `uploaded`).
  - *S3:* credenciales AWS + bucket/prefijo; `ListObjectsV2` → `GetObject` → idem.
- **Indexación:** reutiliza el pipeline existente; los documentos creados como `uploaded`
  los toma el **drainer** automáticamente. No hay lógica nueva de indexado.
- **Idempotencia:** deduplicar por `storage_path`/hash para no re-importar lo ya cargado.

## 7. Hardening pendiente (no bloqueante)

Hallazgos del linter de Supabase a resolver en el panel/Auth (fuera del alcance de este
lote, varios son toggles del dashboard, no SQL de la app):

- Activar **Leaked Password Protection** (Auth → Settings).
- `set_updated_at`: fijar `search_path`.
- Mover la extensión `pg_trgm` fuera del esquema `public` (cuidado: requiere recrear
  índices trigram).
- Revisar funciones `SECURITY DEFINER` expuestas vía RPC (`handle_new_user` puede
  revocar `execute` a `anon`/`authenticated`; `is_admin`/`is_editor` deben conservar
  `execute` porque las usan las políticas RLS).
