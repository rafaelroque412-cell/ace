create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  file_name text not null,
  file_size bigint not null check (file_size > 0),
  mime_type text not null default 'application/pdf',
  storage_bucket text not null,
  storage_path text not null unique,
  document_type text not null default 'otros'
    check (document_type in ('ley', 'reglamento', 'opinion', 'directiva', 'bases_integradas', 'resolucion', 'contrato', 'expediente', 'otros')),
  source_entity text,
  process_type text,
  status text not null default 'uploaded'
    check (status in ('uploaded', 'processing', 'indexed', 'error')),
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.documents add column if not exists process_type text;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'documents_document_type_check'
      and conrelid = 'public.documents'::regclass
  ) then
    alter table public.documents drop constraint documents_document_type_check;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'documents_document_type_check'
      and conrelid = 'public.documents'::regclass
  ) then
    alter table public.documents add constraint documents_document_type_check
      check (document_type in ('ley', 'reglamento', 'opinion', 'directiva', 'bases_integradas', 'resolucion', 'contrato', 'expediente', 'otros'));
  end if;
end $$;

create table if not exists public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  chunk_index integer not null,
  page_start integer,
  page_end integer,
  content text not null,
  token_count integer,
  pinecone_vector_id text unique,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (document_id, chunk_index)
);

create table if not exists public.document_summaries (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  summary_type text not null default 'executive',
  content text not null,
  model text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.processing_jobs (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references public.documents(id) on delete cascade,
  job_type text not null default 'index_document',
  status text not null default 'queued'
    check (status in ('queued', 'processing', 'completed', 'error')),
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.chat_sessions (
  id uuid primary key default gen_random_uuid(),
  title text,
  user_reference text,
  owner_id uuid references auth.users(id) on delete cascade,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.chat_sessions add column if not exists owner_id uuid references auth.users(id) on delete cascade;

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.chat_sessions(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  sources jsonb not null default '[]'::jsonb,
  model text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.chat_sources (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.chat_messages(id) on delete cascade,
  document_id uuid references public.documents(id) on delete set null,
  chunk_id uuid references public.document_chunks(id) on delete set null,
  document_title text not null,
  page integer,
  page_end integer,
  article text,
  quote text not null,
  score numeric,
  semantic_score numeric,
  lexical_score numeric,
  evidence_quality numeric,
  match_type text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.chat_response_notes (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.chat_messages(id) on delete cascade,
  note text not null,
  feedback text check (feedback in ('correct', 'incorrect')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.chat_sources add column if not exists page_end integer;
alter table public.chat_sources add column if not exists semantic_score numeric;
alter table public.chat_sources add column if not exists lexical_score numeric;
alter table public.chat_sources add column if not exists evidence_quality numeric;
alter table public.chat_sources add column if not exists match_type text;
alter table public.chat_sources add column if not exists metadata jsonb not null default '{}'::jsonb;

create table if not exists public.normative_comparisons (
  id uuid primary key default gen_random_uuid(),
  topic text not null,
  side_a jsonb not null default '{}'::jsonb,
  side_b jsonb not null default '{}'::jsonb,
  result text not null,
  sources_a jsonb not null default '[]'::jsonb,
  sources_b jsonb not null default '[]'::jsonb,
  assessment jsonb not null default '{}'::jsonb,
  model text,
  owner_id uuid references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.normative_comparisons add column if not exists owner_id uuid references auth.users(id) on delete cascade;

create index if not exists idx_normative_comparisons_created_at on public.normative_comparisons(created_at desc);
create index if not exists idx_normative_comparisons_owner on public.normative_comparisons(owner_id);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_reference text,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_documents_status on public.documents(status);
create index if not exists idx_documents_type on public.documents(document_type);
create index if not exists idx_documents_process_type on public.documents(process_type);
create index if not exists idx_documents_created_at on public.documents(created_at desc);
create index if not exists idx_document_chunks_document_id on public.document_chunks(document_id);
create index if not exists idx_document_chunks_content_trgm on public.document_chunks using gin (content gin_trgm_ops);
create index if not exists idx_processing_jobs_document_id on public.processing_jobs(document_id);
create index if not exists idx_processing_jobs_status on public.processing_jobs(status);
create index if not exists idx_chat_messages_session_id on public.chat_messages(session_id);
create index if not exists idx_chat_sources_message_id on public.chat_sources(message_id);
create index if not exists idx_chat_sources_document_id on public.chat_sources(document_id);
create index if not exists idx_chat_response_notes_message_id on public.chat_response_notes(message_id);
create index if not exists idx_audit_logs_entity on public.audit_logs(entity_type, entity_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_documents_updated_at on public.documents;
create trigger set_documents_updated_at
before update on public.documents
for each row execute function public.set_updated_at();

drop trigger if exists set_chat_sessions_updated_at on public.chat_sessions;
create trigger set_chat_sessions_updated_at
before update on public.chat_sessions
for each row execute function public.set_updated_at();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documents', 'documents', false, 52428800, array['application/pdf'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.documents enable row level security;
alter table public.document_chunks enable row level security;
alter table public.document_summaries enable row level security;
alter table public.processing_jobs enable row level security;
alter table public.chat_sessions enable row level security;
alter table public.chat_messages enable row level security;
alter table public.chat_sources enable row level security;
alter table public.chat_response_notes enable row level security;
alter table public.normative_comparisons enable row level security;
alter table public.audit_logs enable row level security;

-- ============================================================
-- Autenticacion, perfiles/roles y politicas RLS
-- ============================================================

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text not null default 'user' check (role in ('user', 'editor', 'admin')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create index if not exists idx_chat_sessions_owner on public.chat_sessions(owner_id);

-- Crea el perfil automaticamente al registrarse
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  admin_count int;
begin
  -- El primer usuario registrado nace admin (bootstrap); el resto, user.
  select count(*) into admin_count from public.profiles where role = 'admin';
  insert into public.profiles (id, email, role)
  values (new.id, new.email, case when admin_count = 0 then 'admin' else 'user' end)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Helper de rol admin (security definer evita recursion de RLS)
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

-- Helper de rol editor (editor o admin): gestiona el corpus, no usuarios/eval
create or replace function public.is_editor()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role in ('editor', 'admin')
  );
$$;

-- Metricas agregadas para el panel de monitoreo (solo admin). security definer +
-- guard is_admin() para que no se pueda leer sin ser admin.
create or replace function public.admin_metrics()
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  result jsonb;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'documents', jsonb_build_object(
      'total', (select count(*) from public.documents),
      'uploaded', (select count(*) from public.documents where status = 'uploaded'),
      'processing', (select count(*) from public.documents where status = 'processing'),
      'indexed', (select count(*) from public.documents where status = 'indexed'),
      'error', (select count(*) from public.documents where status = 'error')
    ),
    'stuck', (
      select count(*) from public.documents
      where status = 'uploaded'
         or (status = 'processing' and updated_at < now() - interval '10 minutes')
    ),
    'chunks', (select count(*) from public.document_chunks),
    'articulos', (select count(*) from public.norma_articulos),
    'summaries', (select count(*) from public.document_summaries),
    'concordancias', (select count(*) from public.norma_concordancias),
    'chat_sessions', (select count(*) from public.chat_sessions),
    'chat_messages', (select count(*) from public.chat_messages),
    'boletin', (select count(*) from public.boletin_eventos),
    'seguimientos', (select count(*) from public.seguimientos),
    'guardados', (select count(*) from public.guardados),
    'eval_preguntas', (select count(*) from public.eval_preguntas),
    'eval_corridas', (select count(*) from public.eval_corridas),
    'users', jsonb_build_object(
      'total', (select count(*) from public.profiles),
      'admins', (select count(*) from public.profiles where role = 'admin'),
      'editors', (select count(*) from public.profiles where role = 'editor'),
      'users', (select count(*) from public.profiles where role = 'user')
    )
  ) into result;

  return result;
end;
$$;

-- Facetas del corpus agregadas en la BD (conteos por dimension), para no traer
-- todas las filas a la app ni capar el calculo con un limit arbitrario.
create or replace function public.corpus_facets()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with idx as (
    select document_type, source_entity, process_type, metadata
    from public.documents
    where status = 'indexed'
  )
  select jsonb_build_object(
    'total', (select count(*) from idx),
    'documentType', (
      select coalesce(jsonb_agg(jsonb_build_object('value', document_type, 'count', c) order by c desc), '[]'::jsonb)
      from (select document_type, count(*) c from idx where document_type is not null group by document_type) t
    ),
    'sourceEntity', (
      select coalesce(jsonb_agg(jsonb_build_object('value', source_entity, 'count', c) order by c desc), '[]'::jsonb)
      from (select source_entity, count(*) c from idx where source_entity is not null group by source_entity) t
    ),
    'processType', (
      select coalesce(jsonb_agg(jsonb_build_object('value', process_type, 'count', c) order by c desc), '[]'::jsonb)
      from (select process_type, count(*) c from idx where process_type is not null group by process_type) t
    ),
    'year', (
      select coalesce(jsonb_agg(jsonb_build_object('value', y, 'count', c) order by y desc), '[]'::jsonb)
      from (select metadata->>'year' y, count(*) c from idx where metadata->>'year' is not null group by metadata->>'year') t
    ),
    'vigencia', (
      select coalesce(jsonb_agg(jsonb_build_object('value', v, 'count', c) order by c desc), '[]'::jsonb)
      from (select metadata->>'vigencia' v, count(*) c from idx where metadata->>'vigencia' is not null group by metadata->>'vigencia') t
    )
  );
$$;

-- Acciones distintas de auditoria, agregadas en la BD: devuelve un arreglo
-- pequeno en vez de transferir toda la tabla para poblar el filtro (solo admin).
create or replace function public.distinct_audit_actions()
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(distinct action order by action), '{}')
  from public.audit_logs;
$$;

-- profiles: ver el propio o si es admin; actualizaciones solo admin
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());
drop policy if exists profiles_admin_update on public.profiles;
create policy profiles_admin_update on public.profiles
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Corpus compartido: lectura para autenticados, escritura para editor o admin
do $$
declare t text;
begin
  foreach t in array array['documents', 'document_chunks', 'document_summaries', 'processing_jobs']
  loop
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format('create policy %I on public.%I for select to authenticated using (true)', t || '_select', t);
    execute format('drop policy if exists %I on public.%I', t || '_admin_insert', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.is_editor())', t || '_admin_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_admin_update', t);
    execute format('create policy %I on public.%I for update to authenticated using (public.is_editor()) with check (public.is_editor())', t || '_admin_update', t);
    execute format('drop policy if exists %I on public.%I', t || '_admin_delete', t);
    execute format('create policy %I on public.%I for delete to authenticated using (public.is_editor())', t || '_admin_delete', t);
  end loop;
end $$;

-- chat_sessions: privadas por dueno
drop policy if exists chat_sessions_owner on public.chat_sessions;
create policy chat_sessions_owner on public.chat_sessions
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- chat_messages: via sesion del dueno
drop policy if exists chat_messages_owner on public.chat_messages;
create policy chat_messages_owner on public.chat_messages
  for all to authenticated
  using (exists (select 1 from public.chat_sessions s where s.id = chat_messages.session_id and s.owner_id = auth.uid()))
  with check (exists (select 1 from public.chat_sessions s where s.id = chat_messages.session_id and s.owner_id = auth.uid()));

-- chat_sources: via mensaje -> sesion del dueno
drop policy if exists chat_sources_owner on public.chat_sources;
create policy chat_sources_owner on public.chat_sources
  for all to authenticated
  using (exists (
    select 1 from public.chat_messages m
    join public.chat_sessions s on s.id = m.session_id
    where m.id = chat_sources.message_id and s.owner_id = auth.uid()))
  with check (exists (
    select 1 from public.chat_messages m
    join public.chat_sessions s on s.id = m.session_id
    where m.id = chat_sources.message_id and s.owner_id = auth.uid()));

-- chat_response_notes: via mensaje -> sesion del dueno
drop policy if exists chat_response_notes_owner on public.chat_response_notes;
create policy chat_response_notes_owner on public.chat_response_notes
  for all to authenticated
  using (exists (
    select 1 from public.chat_messages m
    join public.chat_sessions s on s.id = m.session_id
    where m.id = chat_response_notes.message_id and s.owner_id = auth.uid()))
  with check (exists (
    select 1 from public.chat_messages m
    join public.chat_sessions s on s.id = m.session_id
    where m.id = chat_response_notes.message_id and s.owner_id = auth.uid()));

-- normative_comparisons: privadas por dueno
drop policy if exists normative_comparisons_owner on public.normative_comparisons;
create policy normative_comparisons_owner on public.normative_comparisons
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- audit_logs: lectura solo admin (escritura via service_role)
drop policy if exists audit_logs_admin_select on public.audit_logs;
create policy audit_logs_admin_select on public.audit_logs
  for select to authenticated
  using (public.is_admin());

-- ============================================================
-- Capa estructurada por articulo (Fase 1: base documental tipo vLex)
-- ============================================================

create table if not exists public.norma_articulos (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  article_number text not null,
  article_label text,
  section_title text,
  ordinal integer not null,
  content text not null,
  page_start integer,
  page_end integer,
  document_type text,
  document_number text,
  hierarchy_rank integer,
  process_type text,
  status text,
  vigencia text,
  year integer,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (document_id, ordinal)
);

create index if not exists idx_norma_articulos_document on public.norma_articulos(document_id);
create index if not exists idx_norma_articulos_number on public.norma_articulos(article_number);
create index if not exists idx_norma_articulos_content_trgm on public.norma_articulos using gin (content gin_trgm_ops);

alter table public.norma_articulos enable row level security;

-- norma_articulos: corpus compartido (lectura authenticated, escritura admin)
drop policy if exists norma_articulos_select on public.norma_articulos;
create policy norma_articulos_select on public.norma_articulos
  for select to authenticated
  using (true);
drop policy if exists norma_articulos_admin_insert on public.norma_articulos;
create policy norma_articulos_admin_insert on public.norma_articulos
  for insert to authenticated
  with check (public.is_editor());
drop policy if exists norma_articulos_admin_update on public.norma_articulos;
create policy norma_articulos_admin_update on public.norma_articulos
  for update to authenticated
  using (public.is_editor())
  with check (public.is_editor());
drop policy if exists norma_articulos_admin_delete on public.norma_articulos;
create policy norma_articulos_admin_delete on public.norma_articulos
  for delete to authenticated
  using (public.is_editor());

-- ============================================================
-- Citador / concordancias (Fase 2: red de citas tipo vLex)
-- ============================================================

create table if not exists public.norma_concordancias (
  id uuid primary key default gen_random_uuid(),
  source_document_id uuid not null references public.documents(id) on delete cascade,
  source_article_id uuid references public.norma_articulos(id) on delete cascade,
  source_article_number text,
  ref_type text,
  ref_document_number text,
  ref_article_number text,
  target_document_id uuid references public.documents(id) on delete set null,
  target_article_id uuid references public.norma_articulos(id) on delete set null,
  raw_text text not null,
  resolved boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_concordancias_source_article on public.norma_concordancias(source_article_id);
create index if not exists idx_concordancias_source_document on public.norma_concordancias(source_document_id);
create index if not exists idx_concordancias_target_document on public.norma_concordancias(target_document_id);
create index if not exists idx_concordancias_target_article on public.norma_concordancias(target_article_id);

alter table public.norma_concordancias enable row level security;

drop policy if exists norma_concordancias_select on public.norma_concordancias;
create policy norma_concordancias_select on public.norma_concordancias
  for select to authenticated
  using (true);
drop policy if exists norma_concordancias_admin_insert on public.norma_concordancias;
create policy norma_concordancias_admin_insert on public.norma_concordancias
  for insert to authenticated
  with check (public.is_editor());
drop policy if exists norma_concordancias_admin_update on public.norma_concordancias;
create policy norma_concordancias_admin_update on public.norma_concordancias
  for update to authenticated
  using (public.is_editor())
  with check (public.is_editor());
drop policy if exists norma_concordancias_admin_delete on public.norma_concordancias;
create policy norma_concordancias_admin_delete on public.norma_concordancias
  for delete to authenticated
  using (public.is_editor());

-- ============================================================
-- Analisis de documentos (Fase 3: asistente tipo Vincent) - privado por dueno
-- ============================================================

create table if not exists public.document_analyses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  source text not null,
  document_id uuid references public.documents(id) on delete set null,
  title text,
  result jsonb not null default '{}'::jsonb,
  model text,
  created_at timestamptz not null default now()
);

create index if not exists idx_document_analyses_owner on public.document_analyses(owner_id);

alter table public.document_analyses enable row level security;

drop policy if exists document_analyses_owner on public.document_analyses;
create policy document_analyses_owner on public.document_analyses
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- ============================================================
-- Fase 4: producto/engagement (alertas, carpetas/favoritos, evaluacion)
-- ============================================================

-- Boletin de novedades (compartido): lectura authenticated, escritura admin
create table if not exists public.boletin_eventos (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  document_id uuid references public.documents(id) on delete cascade,
  document_type text,
  process_type text,
  source_entity text,
  topic text,
  title text not null,
  summary text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_boletin_created on public.boletin_eventos(created_at desc);
alter table public.boletin_eventos enable row level security;
drop policy if exists boletin_select on public.boletin_eventos;
create policy boletin_select on public.boletin_eventos for select to authenticated using (true);
drop policy if exists boletin_admin_write on public.boletin_eventos;
create policy boletin_admin_write on public.boletin_eventos for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Seguimientos, carpetas y guardados (privados por dueno)
create table if not exists public.seguimientos (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  value text not null,
  created_at timestamptz not null default now(),
  unique (owner_id, kind, value)
);
create index if not exists idx_seguimientos_owner on public.seguimientos(owner_id);
alter table public.seguimientos enable row level security;
drop policy if exists seguimientos_owner on public.seguimientos;
create policy seguimientos_owner on public.seguimientos for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create table if not exists public.carpetas (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_carpetas_owner on public.carpetas(owner_id);
alter table public.carpetas enable row level security;
drop policy if exists carpetas_owner on public.carpetas;
create policy carpetas_owner on public.carpetas for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create table if not exists public.guardados (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  carpeta_id uuid references public.carpetas(id) on delete set null,
  item_type text not null,
  document_id uuid references public.documents(id) on delete set null,
  article_id uuid references public.norma_articulos(id) on delete set null,
  message_id uuid references public.chat_messages(id) on delete set null,
  title text not null,
  note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_guardados_owner on public.guardados(owner_id);
alter table public.guardados enable row level security;
drop policy if exists guardados_owner on public.guardados;
create policy guardados_owner on public.guardados for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- Evaluacion continua (preguntas/corridas/resultados): lectura authenticated, escritura admin
create table if not exists public.eval_preguntas (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  expected_keywords text[] not null default '{}',
  document_type text,
  process_type text,
  created_at timestamptz not null default now()
);
alter table public.eval_preguntas enable row level security;
drop policy if exists eval_preguntas_select on public.eval_preguntas;
create policy eval_preguntas_select on public.eval_preguntas for select to authenticated using (true);
drop policy if exists eval_preguntas_admin_write on public.eval_preguntas;
create policy eval_preguntas_admin_write on public.eval_preguntas for all to authenticated using (public.is_admin()) with check (public.is_admin());

create table if not exists public.eval_corridas (
  id uuid primary key default gen_random_uuid(),
  run_at timestamptz not null default now(),
  summary jsonb not null default '{}'::jsonb
);
alter table public.eval_corridas enable row level security;
drop policy if exists eval_corridas_select on public.eval_corridas;
create policy eval_corridas_select on public.eval_corridas for select to authenticated using (true);
drop policy if exists eval_corridas_admin_write on public.eval_corridas;
create policy eval_corridas_admin_write on public.eval_corridas for all to authenticated using (public.is_admin()) with check (public.is_admin());

create table if not exists public.eval_resultados (
  id uuid primary key default gen_random_uuid(),
  corrida_id uuid not null references public.eval_corridas(id) on delete cascade,
  pregunta_id uuid references public.eval_preguntas(id) on delete set null,
  question text,
  confidence text,
  sufficient boolean,
  sources_count int,
  keyword_hit numeric,
  score numeric,
  feedback text,
  created_at timestamptz not null default now()
);
create index if not exists idx_eval_resultados_corrida on public.eval_resultados(corrida_id);
alter table public.eval_resultados enable row level security;
drop policy if exists eval_resultados_select on public.eval_resultados;
create policy eval_resultados_select on public.eval_resultados for select to authenticated using (true);
drop policy if exists eval_resultados_admin_write on public.eval_resultados;
create policy eval_resultados_admin_write on public.eval_resultados for all to authenticated using (public.is_admin()) with check (public.is_admin());
