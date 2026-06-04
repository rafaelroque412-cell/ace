# SDD — ACE IA Jurídica

**Spec-Driven Development consolidado.** Documento autoritativo del sistema tal como
está implementado (reemplaza a los dos SDD previos en conflicto:
`SDD_FUNCIONALIDADES_IA_JURIDICA.md` y `SPEC_DRIVEN_DEVELOPMENT.md`).

> Estado: Fases 0–4 implementadas y verificadas. Última actualización: 2026-06-03.

---

## 1. Visión y alcance

ACE IA Jurídica es un **RAG jurídico** para **contrataciones públicas peruanas**
(Ley 32069 / OECE). Permite a un equipo legal:

- Cargar y gobernar un **corpus normativo** (PDFs: ley, reglamento, directivas,
  opiniones, resoluciones OECE, bases integradas, contratos, expedientes).
- **Consultar** ese corpus por chat y búsqueda semántica, con **respuestas siempre
  citadas** y *gating* de fuentes (si no hay sustento normativo, lo declara en vez de
  inventar).
- **Navegar** la normativa por artículo con concordancias entre normas.
- **Analizar** documentos y **generar contratos** DOCX con cláusulas obligatorias.
- **Hacer seguimiento** (boletín de novedades, carpetas/guardados) y **medir la
  calidad** del asistente (evaluación continua) y la **operación** (monitoreo/auditoría).

**Principios de producto:** la IA propone, el usuario valida; cada respuesta jurídica
cita documentos; trazabilidad completa; el sistema falla de forma explícita y recuperable.

---

## 2. Arquitectura

```text
Usuario
  → Next.js 16 (App Router, Turbopack) en Vercel
  → API Routes (runtime nodejs) + Server Components
  → Servicios de dominio (lib/*)
  → Supabase (PostgreSQL + Auth + Storage)  ·  Pinecone (vectores)  ·  OpenAI (LLM/embeddings/OCR)
```

- **Stack:** Next.js 16, React 19, TypeScript estricto, Zod, `@supabase/ssr`,
  `pdfjs-dist`, `docx`, Radix Dialog, lucide-react.
- **Sesión:** refresco en `proxy.ts` (raíz) → `lib/supabase/middleware.ts`.
  *(Next 16 usa `proxy.ts`, no `middleware.ts`.)*
- **Claves:** solo en servidor; buckets privados; metadata jurídica estructurada en
  PostgreSQL; embeddings + metadatos mínimos en Pinecone.

### Flujo documental

```text
PDF → Supabase Storage → extracción de texto (pdf-parse, OCR fallback OpenAI Vision)
    → clasificación + resumen IA → segmentación por artículo → fragmentación (chunks)
    → embeddings (modelo integrado de Pinecone) → upsert a Pinecone
    → estado y log en PostgreSQL → consulta con citas
```

---

## 3. Modelo de datos (PostgreSQL / Supabase)

| Dominio | Tablas |
|---------|--------|
| Corpus (compartido) | `documents`, `document_chunks`, `document_summaries`, `processing_jobs` |
| Estructura normativa | `norma_articulos`, `norma_concordancias` |
| Chat (privado por usuario) | `chat_sessions`, `chat_messages`, `chat_sources`, `chat_response_notes` |
| Productividad (privado) | `normative_comparisons`, `document_analyses` |
| Engagement | `boletin_eventos` (compartido), `seguimientos`, `carpetas`, `guardados` (privados) |
| Evaluación | `eval_preguntas`, `eval_corridas`, `eval_resultados` |
| Identidad / gobernanza | `profiles`, `audit_logs` |

- **`documents.status`**: `uploaded → processing → indexed | error`. Este estado
  (con `updated_at`) **es** la cola de indexación; `processing_jobs` es el log detallado.
- **Tipos documentales**: `ley`, `reglamento`, `opinion`, `directiva`, `bases_integradas`,
  `resolucion`, `contrato`, `expediente`, `otros` (lista única en `lib/legal-taxonomy.ts`).
- **Funciones**: `handle_new_user` (perfil + bootstrap del primer admin), `is_admin()`,
  `is_editor()`, `admin_metrics()` (conteos), `set_updated_at`.
- Esquema fuente de verdad: `docs/supabase/schema.sql`.

---

## 4. Roles y seguridad

| Rol | Permisos |
|-----|----------|
| `user` | Lee el corpus; chat/búsqueda/normas/análisis; guarda y sigue temas. |
| `editor` | + **gestiona el corpus** (sube, reindexa, borra documentos). |
| `admin` | + usuarios, evaluación continua, monitoreo y auditoría. |

- **Bootstrap:** el primer usuario registrado se promueve a `admin` automáticamente; el
  resto nace `user`. Promoción manual por SQL (`update profiles set role=...`).
- **Gating de rutas:** `requireUser` / `requireEditor` / `requireAdmin` (`lib/auth.ts`).
- **RLS:** corpus = lectura autenticada, escritura `is_editor()`; chat/comparaciones/
  guardados = privados por `owner_id`; eval/boletín-write/auditoría = `is_admin()`.
  Los datos privados se escriben/leen con el **JWT del usuario** (`supabaseUserRest`);
  operaciones de servidor confiables usan `service_role`.

---

## 5. Módulos por fase (todas implementadas)

### Fase 0 — Núcleo RAG + Auth
Subida/indexado de PDFs, chat jurídico con fuentes + historial, búsqueda semántica/
híbrida, gating de suficiencia. Supabase Auth (email+password) + RLS + roles.

### Fase 1 — Base documental tipo vLex
Capa estructurada por artículo (`norma_articulos`), navegador `/normas` con tabs
Normas/Jurisprudencia, versionado ligero (vigencia/status/`amends`, "solo vigente").

### Fase 2 — Red de citas, reranking, facetas
Reranking dedicado `bge-reranker-v2-m3`; facetas (`/api/facets`) + filtro por artículo;
citador/concordancias (`norma_concordancias`) cross-norma e internas.

### Fase 3 — Asistente tipo Vincent
Análisis de documento (`/analizar`), generación de contratos DOCX (`/contratos`),
visor PDF con resaltado de la cita (`pdf-cite-viewer`).

### Fase 4 — Producto/engagement + institucional
- **Boletín** (`/alertas`), **seguimientos**, **carpetas/guardados** (`/guardado`).
- **Evaluación continua** (`/evaluacion`, admin): banco de preguntas → corre el pipeline
  real → mide cobertura de términos + suficiencia + confianza → score.
- **Monitoreo** (`/metricas`, admin) y **Auditoría** (`/auditoria`, admin).
- **Rol editor**, **bootstrap admin**, **cola resiliente** y **OCR** (ver §7).

---

## 6. API (rutas, runtime nodejs)

| Ruta | Método | Auth | Función |
|------|--------|------|---------|
| `/api/chat` | POST | user | Respuesta jurídica con fuentes + gating |
| `/api/search` | POST | user | Búsqueda semántica/híbrida |
| `/api/facets` | GET | user | Conteos del corpus para filtros |
| `/api/norms`, `/api/norms/[id]`, `/api/norms/articles/[id]/citing` | GET | user | Navegador normativo + concordancias |
| `/api/analyze` | POST | user | Análisis de documento |
| `/api/compare` | POST | user | Comparación normativa |
| `/api/contracts/generate` | POST | user | Genera contrato DOCX |
| `/api/documents` | GET/POST/DELETE | user / **editor** | Listar / subir / borrar masivo |
| `/api/documents/[id]` | GET/POST/DELETE | user / **editor** | Descargar / reindexar / borrar |
| `/api/documents/reindex` | POST | **editor** | Reindexado masivo |
| `/api/documents/drain` | GET/POST | cron(`CRON_SECRET`) o **editor** | Drenar cola de atascados |
| `/api/boletin`, `/api/seguimientos`, `/api/folders`, `/api/saved` | varios | user | Engagement |
| `/api/eval` | GET/POST/DELETE | **admin** | Evaluación continua |
| `/api/metrics` | GET | **admin** | Métricas de monitoreo |
| `/api/audit` | GET | **admin** | Registro de auditoría |
| `/api/chat/sessions`, `/api/chat/messages/[id]` | varios | user | Historial |
| `/api/health`, `/api/integrations/health` | GET | público | Salud |

---

## 7. Pipeline de indexación

1. **Subida** (`POST /api/documents`): guarda el PDF en Storage, inserta `documents`
   (status `uploaded`), responde **202** y procesa en `after()` (vía rápida).
2. **Extracción** (`lib/pdf-processing.ts`): `pdf-parse`; si el texto es insuficiente
   (PDF escaneado) y `OPENAI_PDF_OCR_ENABLED=true`, **OCR con OpenAI Vision**
   (`extractPdfTextWithOpenAI`, acotado por `OPENAI_OCR_MAX_PAGES`). El método queda en
   `metadata.extractionMethod` (`pdf-text` | `openai-ocr`).
3. **Enriquecimiento:** clasificación + resumen IA, segmentación por artículo,
   concordancias, chunking con header de contexto jurídico.
4. **Embeddings + upsert** a Pinecone (índice `ace`, namespace `legal-documents`,
   modelo integrado 1024-dim, fieldMap `text→text`).
5. **Estado:** `documents.status` → `indexed`/`error`; emite eventos al `boletin_eventos`.

### Cola resiliente (drainer)
Si la invocación serverless muere a mitad, el documento queda atascado. El **drainer**
(`lib/indexing-queue.ts`, `/api/documents/drain`) reprocesa los `uploaded` y los
`processing` muertos (> `INDEXING_STALE_MINUTES`) descargando el PDF de Storage. Corre
por **cron de Vercel** cada 5 min (`vercel.json`) y se puede disparar manual desde
Monitoreo. Procesa `INDEXING_DRAIN_BATCH` por corrida.

> Causa raíz histórica del indexado inestable (resuelta): copiar los bytes del File con
> `Buffer.from(new Uint8Array(...))` (`readFileBytes`) porque el pdf.js de pdf-parse
> mutaba el ArrayBuffer compartido.

---

## 8. RAG: recuperación, ranking y respuesta

- **Búsqueda** (`searchLegalSources`): híbrida (semántica + léxica) con filtros
  (tipo, proceso, entidad, año, artículo, vigencia) y **reranking** `bge-reranker-v2-m3`.
- **Gating de fuentes** (`assessSources`): clasifica suficiencia y confianza
  (`alta`/`media`/`baja`); solo fundamenta en ley/reglamento/directiva/opinión (las bases
  integradas no son fundamento). Si no hay sustento, responde con una nota explícita.
- **Citas** `[F#]`: las fuentes fuera de rango se muestran como advertencia.
- **Modos** de respuesta: `breve`, `tecnica`, `informe`, `checklist`.
- **Persistencia:** cada intercambio guarda sesión/mensajes/fuentes y auditoría. El
  evaluador continuo usa `persist:false` para no ensuciar el historial.

---

## 9. Operación

Detalle en **`docs/OPERACIONES.md`** (roles, cola/cron, OCR, backups, ingesta Drive/S3
diferida, hardening pendiente).

### Variables de entorno clave
```
OPENAI_API_KEY, OPENAI_LEGAL_MODEL(=gpt-4.1-mini)
OPENAI_PDF_OCR_ENABLED(=true), OPENAI_PDF_OCR_MODEL(=gpt-4o-mini), OPENAI_OCR_MAX_PAGES(=25)
PINECONE_API_KEY, PINECONE_INDEX_NAME(=ace), PINECONE_NAMESPACE(=legal-documents)
PINECONE_RERANK_ENABLED(=true), PINECONE_RERANK_MODEL(=bge-reranker-v2-m3)
NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_STORAGE_BUCKET
CRON_SECRET, INDEXING_STALE_MINUTES(=10), INDEXING_DRAIN_BATCH(=3)
NEXT_PUBLIC_APP_URL
```

### Backups
Backups gestionados de Supabase (Postgres PITR); los PDFs en Storage son la fuente de
verdad para reindexar. Pinecone es **derivado**: ante pérdida, reindexar desde Storage.

---

## 10. Estado y verificación

- **Build** `next build` ✅, `tsc --noEmit` ✅.
- **Smoke autenticado** ✅: progresión de roles user→editor→admin validada contra los
  endpoints reales; integraciones (OpenAI/Pinecone/Supabase) `ok`.
- **Datos**: corpus de prueba (cargar normativa real para pruebas RAG significativas).

---

## 11. Backlog / pendientes

- Cargar corpus normativo real (Ley 32069, Reglamento, directivas/opiniones OECE).
- Comparación normativa V2: alineación por artículo + diff visual.
- Ingesta externa Drive/S3 (diseño en `docs/OPERACIONES.md`).
- Hardening (no bloqueante): leaked-password protection en Auth, `search_path` de
  `set_updated_at`, mover `pg_trgm` fuera de `public`.
- Decisiones de producto: si el chat debe fundamentar en resoluciones OECE; estructura
  propia para modos informe/checklist.
