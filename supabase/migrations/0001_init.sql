-- Personal OS — initial schema
-- Part 3 · Step 3. Run this in the Supabase SQL editor or via the Supabase CLI.

-- Vector extension (Database → Extensions also exposes this).
create extension if not exists vector;

-- ─── entities ──────────────────────────────────────────────────────────────
-- People / projects / companies a capture or task can be attached to.
create table if not exists entities (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null,
  name        text not null,
  kind        text not null default 'person', -- person | project | company | topic
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists entities_user_idx on entities (user_id);

-- ─── raw_captures ──────────────────────────────────────────────────────────
-- Every inbound capture (voice or text) lands here first, before routing.
create table if not exists raw_captures (
  id              uuid primary key default gen_random_uuid(),
  user_id         text not null,
  source          text not null default 'web', -- telegram | web | shortcut
  raw_text        text not null,
  audio_url       text,
  classification  jsonb,
  llm_source      text,                          -- anthropic | openai | regex
  routed_to       text,                          -- target table name
  routed_id       uuid,                          -- target row id
  created_at      timestamptz not null default now()
);
create index if not exists raw_captures_user_idx on raw_captures (user_id, created_at desc);

-- ─── tasks (the CRM) ───────────────────────────────────────────────────────
create table if not exists tasks (
  id                uuid primary key default gen_random_uuid(),
  user_id           text not null,
  title             text not null,
  description       text,
  urgency           text not null default 'this_week', -- today | this_week | this_month | someday
  key               boolean not null default false,
  priority_score    double precision not null default 0,
  time_estimate_min integer,
  tags              text[] not null default '{}',
  due_date          date,
  owner             text,
  entity_id         uuid references entities (id) on delete set null,
  completed_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists tasks_user_idx on tasks (user_id, urgency, priority_score desc);
create index if not exists tasks_open_idx on tasks (user_id) where completed_at is null;

-- ─── daily_logs ────────────────────────────────────────────────────────────
-- One row per (user, date). notes holds JSON for habits / nutrition / goals.
-- Goals use a sentinel date (2000-01-01) so they never roll over.
create table if not exists daily_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null,
  log_date    date not null,
  notes       text,            -- JSON string: { habits, nutrition, goals_week_items, ... }
  mood        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, log_date)
);
create index if not exists daily_logs_user_idx on daily_logs (user_id, log_date desc);

-- ─── memory_chunks (the brain layer, Part 6) ───────────────────────────────
create table if not exists memory_chunks (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null,
  source_type text not null,            -- capture | task | journal | habit | meal | ...
  source_id   uuid,
  text        text not null,
  embedding   vector(1536),
  created_at  timestamptz not null default now()
);
create index if not exists memory_chunks_user_idx on memory_chunks (user_id);
create index if not exists memory_chunks_embedding_idx
  on memory_chunks using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- ─── audit_log ─────────────────────────────────────────────────────────────
create table if not exists audit_log (
  id            uuid primary key default gen_random_uuid(),
  user_id       text not null,
  action        text not null,
  resource_type text,
  resource_id   uuid,
  metadata      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);
create index if not exists audit_log_user_idx on audit_log (user_id, created_at desc);

-- ─── Row Level Security ─────────────────────────────────────────────────────
-- Deny-all to the anon/auth roles; the service role key (server only) bypasses
-- RLS entirely, which is how every API route in this app reads/writes.
alter table entities       enable row level security;
alter table raw_captures   enable row level security;
alter table tasks          enable row level security;
alter table daily_logs     enable row level security;
alter table memory_chunks  enable row level security;
alter table audit_log      enable row level security;

-- No policies created => deny-all for non-service-role clients.

-- ─── memory search RPC ──────────────────────────────────────────────────────
-- Cosine-similarity nearest-neighbour search over memory_chunks.
create or replace function match_memory_chunks (
  query_embedding vector(1536),
  match_user_id   text,
  match_count     int default 20
)
returns table (
  id          uuid,
  source_type text,
  source_id   uuid,
  text        text,
  similarity  double precision,
  created_at  timestamptz
)
language sql stable
as $$
  select
    mc.id,
    mc.source_type,
    mc.source_id,
    mc.text,
    1 - (mc.embedding <=> query_embedding) as similarity,
    mc.created_at
  from memory_chunks mc
  where mc.user_id = match_user_id
    and mc.embedding is not null
  order by mc.embedding <=> query_embedding
  limit match_count;
$$;
