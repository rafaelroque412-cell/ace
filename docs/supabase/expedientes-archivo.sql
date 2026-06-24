-- ============================================================
-- Sub-módulo: Biblioteca de Expedientes Archivados.
-- Expedientes/documentos terminados, escaneados (OCR) e indexados en Pinecone
-- (namespace propio PINECONE_EXPEDIENTES_NAMESPACE, aislado del corpus normativo
-- y del archivo administrativo). Registra además la UBICACIÓN FÍSICA exacta
-- (catálogo fijo: tipo de contenedor, color, ambiente) + nro de caja/archivador.
--
-- INDEPENDIENTE del expediente de contratación (Ley 32069): otra tratativa.
-- Migración idempotente. Depende de objetos del esquema principal:
--   - extension pg_trgm · funcion public.set_updated_at() · funcion public.is_editor()
-- Aplicar en Supabase Dashboard -> SQL Editor.
-- ============================================================

create table if not exists public.expedientes_archivo (
  id uuid primary key default gen_random_uuid(),
  -- Identificación documental
  numero_expediente text,
  numero_documento text,
  fecha date,
  anio integer,
  asunto text,
  materia text,
  resumen text,
  remitente text,
  destinatario text,
  title text not null,
  -- Ubicación física (catálogo fijo)
  tipo_contenedor text not null default 'otros'
    check (tipo_contenedor in ('folder','archivador','caja','tomo','paquete','estante','otros')),
  nro_archivador text,
  nro_caja text,
  color text,
  ubicacion text,
  codigo_ubicacion text,
  nro_folios integer,
  observaciones text,
  -- Archivo digital
  file_name text not null,
  file_size bigint not null check (file_size > 0),
  mime_type text not null default 'application/pdf',
  storage_bucket text not null,
  storage_path text not null unique,
  status text not null default 'uploaded'
    check (status in ('uploaded','processing','indexed','error')),
  error_message text,
  body_text text,
  metadata jsonb not null default '{}'::jsonb,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.expedientes_archivo_chunks (
  id uuid primary key default gen_random_uuid(),
  expediente_id uuid not null references public.expedientes_archivo(id) on delete cascade,
  chunk_index integer not null,
  page_start integer,
  page_end integer,
  content text not null,
  pinecone_vector_id text unique,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (expediente_id, chunk_index)
);

create index if not exists idx_expedientes_archivo_status on public.expedientes_archivo(status);
create index if not exists idx_expedientes_archivo_fecha on public.expedientes_archivo(fecha desc);
create index if not exists idx_expedientes_archivo_anio on public.expedientes_archivo(anio desc);
create index if not exists idx_expedientes_archivo_numero on public.expedientes_archivo(numero_documento);
create index if not exists idx_expedientes_archivo_created_at on public.expedientes_archivo(created_at desc);
create index if not exists idx_expedientes_archivo_chunks_exp on public.expedientes_archivo_chunks(expediente_id);
create index if not exists idx_expedientes_archivo_chunks_trgm
  on public.expedientes_archivo_chunks using gin (content gin_trgm_ops);

drop trigger if exists set_expedientes_archivo_updated_at on public.expedientes_archivo;
create trigger set_expedientes_archivo_updated_at
before update on public.expedientes_archivo
for each row execute function public.set_updated_at();

-- RLS: lectura para autenticados; escritura para editor/admin (patrón del corpus).
do $$
declare t text;
begin
  foreach t in array array['expedientes_archivo','expedientes_archivo_chunks']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I_select on public.%I', t, t);
    execute format('create policy %I_select on public.%I for select to authenticated using (true)', t, t);
    execute format('drop policy if exists %I_editor_insert on public.%I', t, t);
    execute format('create policy %I_editor_insert on public.%I for insert to authenticated with check (public.is_editor())', t, t);
    execute format('drop policy if exists %I_editor_update on public.%I', t, t);
    execute format('create policy %I_editor_update on public.%I for update to authenticated using (public.is_editor()) with check (public.is_editor())', t, t);
    execute format('drop policy if exists %I_editor_delete on public.%I', t, t);
    execute format('create policy %I_editor_delete on public.%I for delete to authenticated using (public.is_editor())', t, t);
  end loop;
end $$;
