set local search_path = public, extensions;

create or replace function public.wcag_or_tsquery(query_text text)
returns tsquery
language sql
immutable
parallel safe
set search_path = public, extensions
as $$
  select nullif(
    coalesce(
      (
        select string_agg(quote_literal(lexeme), ' | ')
        from unnest(to_tsvector('english', coalesce(query_text, '')))
      ),
      ''
    ),
    ''
  )::tsquery;
$$;

create or replace function public.wcag_extract_criteria(query_text text)
returns text[]
language sql
immutable
parallel safe
as $$
  select array(
    select distinct m[1]
    from regexp_matches(coalesce(query_text, ''), '\m(\d+\.\d+\.\d+)\M', 'g') m
  );
$$;

create or replace function public.lexical_search_wcag (
  query_text       text,
  match_count      int    default 8,
  filter_version   text   default null,
  filter_levels    text[] default null,
  filter_doc_types text[] default null,
  filter_criteria  text[] default null
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
  with
  tq as (
    select public.wcag_or_tsquery(query_text) as q
  ),
  ids as (
    select case
             when filter_criteria is not null and cardinality(filter_criteria) > 0
               then filter_criteria
             else public.wcag_extract_criteria(query_text)
           end as criteria
  ),
  filtered as (
    select c.id, c.content, c.fts, c.source_url, c.criterion_id,
           c.conformance_level, c.wcag_version, c.metadata
    from public.wcag_chunks c
    join public.wcag_documents d on d.id = c.document_id
    where (filter_version   is null or c.wcag_version = filter_version)
      and (filter_levels    is null or c.conformance_level = any (filter_levels))
      and (filter_doc_types is null or d.doc_type = any (filter_doc_types))
  ),
  matched as (
    select f.*,
           coalesce(ts_rank_cd(f.fts, tq.q), 0)::float as lex,
           (cardinality(ids.criteria) > 0 and f.criterion_id = any (ids.criteria)) as id_hit
    from filtered f
    cross join tq
    cross join ids
    where (tq.q is not null and f.fts @@ tq.q)
       or (cardinality(ids.criteria) > 0 and f.criterion_id = any (ids.criteria))
  ),
  ranked as (
    select m.*, (case when m.id_hit then 1000.0 else 0.0 end) + m.lex as final_score
    from matched m
  ),
  deduped as (
    select distinct on (md5(r.content))
           r.id, r.content, r.final_score, r.source_url, r.criterion_id,
           r.conformance_level, r.wcag_version, r.metadata
    from ranked r
    order by md5(r.content), r.final_score desc, r.wcag_version desc nulls last
  )
  select d.id, d.content, d.final_score, d.source_url, d.criterion_id,
         d.conformance_level, d.wcag_version, d.metadata
  from deduped d
  order by d.final_score desc
  limit least(greatest(coalesce(match_count, 8), 1), 50);
$$;

comment on function public.lexical_search_wcag is
  'Embedding-free WCAG retrieval: OR-semantics full-text ranked by ts_rank_cd, fused with exact success-criterion id matching. Used directly as a fallback when query embedding is unavailable.';

drop function if exists public.hybrid_search_wcag(text, halfvec, int, int, text, text[]);

create or replace function public.hybrid_search_wcag (
  query_text       text,
  query_embedding  halfvec(1024),
  match_count      int    default 8,
  rrf_k            int    default 50,
  filter_version   text   default null,
  filter_levels    text[] default null,
  filter_doc_types text[] default null,
  filter_criteria  text[] default null
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
  with
  tq as (
    select public.wcag_or_tsquery(query_text) as q
  ),
  ids as (
    select case
             when filter_criteria is not null and cardinality(filter_criteria) > 0
               then filter_criteria
             else public.wcag_extract_criteria(query_text)
           end as criteria
  ),
  filtered as (
    select c.id, c.content, c.fts, c.embedding, c.source_url, c.criterion_id,
           c.conformance_level, c.wcag_version, c.metadata
    from public.wcag_chunks c
    join public.wcag_documents d on d.id = c.document_id
    where (filter_version   is null or c.wcag_version = filter_version)
      and (filter_levels    is null or c.conformance_level = any (filter_levels))
      and (filter_doc_types is null or d.doc_type = any (filter_doc_types))
  ),
  pool as (
    select least(greatest(coalesce(match_count, 8), 1), 50) * 4 as n
  ),
  semantic as (
    select f.id, row_number() over (order by f.embedding <=> query_embedding) as rank
    from filtered f, pool
    where f.embedding is not null and query_embedding is not null
    order by f.embedding <=> query_embedding
    limit (select n from pool)
  ),
  lexical as (
    select f.id, row_number() over (order by ts_rank_cd(f.fts, tq.q) desc) as rank
    from filtered f, tq, pool
    where tq.q is not null and f.fts @@ tq.q
    order by ts_rank_cd(f.fts, tq.q) desc
    limit (select n from pool)
  ),
  criterion as (
    select f.id, row_number() over (order by f.wcag_version desc nulls last) as rank
    from filtered f, ids, pool
    where cardinality(ids.criteria) > 0 and f.criterion_id = any (ids.criteria)
    order by f.wcag_version desc nulls last
    limit (select n from pool)
  ),
  fused as (
    select coalesce(s.id, l.id, x.id) as id,
           coalesce(1.0 / (rrf_k + s.rank), 0.0)
         + coalesce(1.0 / (rrf_k + l.rank), 0.0)
         + coalesce(2.0 / (rrf_k + x.rank), 0.0) as score
    from semantic s
    full outer join lexical  l on l.id = s.id
    full outer join criterion x on x.id = coalesce(s.id, l.id)
  ),
  joined as (
    select c.id, c.content, f.score, c.source_url, c.criterion_id,
           c.conformance_level, c.wcag_version, c.metadata
    from fused f
    join public.wcag_chunks c on c.id = f.id
  ),
  deduped as (
    select distinct on (md5(j.content))
           j.id, j.content, j.score, j.source_url, j.criterion_id,
           j.conformance_level, j.wcag_version, j.metadata
    from joined j
    order by md5(j.content), j.score desc, j.wcag_version desc nulls last
  )
  select d.id, d.content, d.score, d.source_url, d.criterion_id,
         d.conformance_level, d.wcag_version, d.metadata
  from deduped d
  order by d.score desc
  limit least(greatest(coalesce(match_count, 8), 1), 50);
$$;

comment on function public.hybrid_search_wcag is
  'Hybrid WCAG retrieval: RRF over semantic (pgvector), lexical (OR-semantics full-text) and exact success-criterion id arms, with metadata pre-filtering and content dedup.';;
