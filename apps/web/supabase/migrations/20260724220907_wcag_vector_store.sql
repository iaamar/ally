-- WCAG knowledge base vector store
create extension if not exists vector with schema extensions;

set local search_path = public, extensions;

create table if not exists public.wcag_documents (
  id            uuid primary key default gen_random_uuid(),
  source_url    text not null unique,
  title         text not null,
  raw_markdown  text not null,
  content_hash  text not null,
  doc_type      text not null check (
                  doc_type in ('spec','understanding','technique','overview','other')
                ),
  wcag_version  text,
  scraped_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists wcag_documents_doc_type_idx on public.wcag_documents (doc_type);
create index if not exists wcag_documents_version_idx  on public.wcag_documents (wcag_version);

create table if not exists public.wcag_chunks (
  id              uuid primary key default gen_random_uuid(),
  document_id     uuid not null references public.wcag_documents (id) on delete cascade,

  content         text not null,
  chunk_index     int  not null,
  token_count     int  not null,

  embedding       extensions.halfvec(1024),
  embedding_model text not null default 'BAAI/bge-large-en-v1.5',

  metadata        jsonb not null default '{}'::jsonb,

  source_url        text generated always as (metadata ->> 'source_url')        stored,
  wcag_version      text generated always as (metadata ->> 'wcag_version')      stored,
  conformance_level text generated always as (metadata ->> 'conformance_level') stored,
  criterion_id      text generated always as (metadata ->> 'criterion_id')      stored,
  principle         text generated always as (metadata ->> 'principle')         stored,
  topic             text generated always as (metadata ->> 'topic')             stored,

  fts tsvector generated always as (
    setweight(to_tsvector('english', coalesce(metadata ->> 'title', '')), 'A') ||
    setweight(to_tsvector('english', content), 'B')
  ) stored,

  created_at timestamptz not null default now(),

  unique (document_id, chunk_index)
);

create index if not exists wcag_chunks_embedding_idx
  on public.wcag_chunks
  using hnsw (embedding extensions.halfvec_cosine_ops)
  with (m = 16, ef_construction = 64);

create index if not exists wcag_chunks_fts_idx      on public.wcag_chunks using gin (fts);
create index if not exists wcag_chunks_metadata_idx on public.wcag_chunks using gin (metadata jsonb_path_ops);
create index if not exists wcag_chunks_filter_idx
  on public.wcag_chunks (wcag_version, conformance_level);
create index if not exists wcag_chunks_criterion_idx on public.wcag_chunks (criterion_id);
create index if not exists wcag_chunks_document_idx  on public.wcag_chunks (document_id);

create or replace function public.match_wcag_chunks (
  query_embedding    extensions.halfvec(1024),
  match_count        int     default 8,
  similarity_cutoff  float   default 0.0,
  filter_version     text    default null,
  filter_levels      text[]  default null,
  filter_doc_types   text[]  default null
)
returns table (
  id                uuid,
  content           text,
  similarity        float,
  source_url        text,
  criterion_id      text,
  conformance_level text,
  wcag_version      text,
  metadata          jsonb
)
language sql
stable
set search_path = public, extensions
as $$
  select
    c.id,
    c.content,
    1 - (c.embedding <=> query_embedding) as similarity,
    c.source_url,
    c.criterion_id,
    c.conformance_level,
    c.wcag_version,
    c.metadata
  from public.wcag_chunks c
  join public.wcag_documents d on d.id = c.document_id
  where c.embedding is not null
    and (filter_version   is null or c.wcag_version = filter_version)
    and (filter_levels    is null or c.conformance_level = any (filter_levels))
    and (filter_doc_types is null or d.doc_type = any (filter_doc_types))
    and 1 - (c.embedding <=> query_embedding) >= similarity_cutoff
  order by c.embedding <=> query_embedding
  limit least(match_count, 50);
$$;

create or replace function public.hybrid_search_wcag (
  query_text       text,
  query_embedding  extensions.halfvec(1024),
  match_count      int    default 8,
  rrf_k            int    default 50,
  filter_version   text   default null,
  filter_levels    text[] default null
)
returns table (
  id                uuid,
  content           text,
  score             float,
  source_url        text,
  criterion_id      text,
  conformance_level text,
  wcag_version      text,
  metadata          jsonb
)
language sql
stable
set search_path = public, extensions
as $$
  with filtered as (
    select c.*
    from public.wcag_chunks c
    where (filter_version is null or c.wcag_version = filter_version)
      and (filter_levels  is null or c.conformance_level = any (filter_levels))
  ),
  semantic as (
    select f.id, row_number() over (order by f.embedding <=> query_embedding) as rank
    from filtered f
    where f.embedding is not null
    order by f.embedding <=> query_embedding
    limit least(match_count, 50) * 4
  ),
  lexical as (
    select f.id,
           row_number() over (
             order by ts_rank_cd(f.fts, websearch_to_tsquery('english', query_text)) desc
           ) as rank
    from filtered f
    where f.fts @@ websearch_to_tsquery('english', query_text)
    limit least(match_count, 50) * 4
  )
  select
    c.id,
    c.content,
    coalesce(1.0 / (rrf_k + s.rank), 0.0) + coalesce(1.0 / (rrf_k + l.rank), 0.0) as score,
    c.source_url,
    c.criterion_id,
    c.conformance_level,
    c.wcag_version,
    c.metadata
  from semantic s
  full outer join lexical l on l.id = s.id
  join public.wcag_chunks c on c.id = coalesce(s.id, l.id)
  order by score desc
  limit least(match_count, 50);
$$;

alter table public.wcag_documents enable row level security;
alter table public.wcag_chunks    enable row level security;

drop policy if exists "wcag_documents are publicly readable" on public.wcag_documents;
create policy "wcag_documents are publicly readable"
  on public.wcag_documents for select
  to anon, authenticated
  using (true);

drop policy if exists "wcag_chunks are publicly readable" on public.wcag_chunks;
create policy "wcag_chunks are publicly readable"
  on public.wcag_chunks for select
  to anon, authenticated
  using (true);

comment on table public.wcag_chunks is
  'Embedded WCAG guideline chunks, one row per success criterion or section. Queried by the accessibility assistant via match_wcag_chunks / hybrid_search_wcag.';;
