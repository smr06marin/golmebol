-- ============================================================
-- MIGRACIÓN: Registro de ediciones de planillas ya cerradas
-- Cada vez que alguien (admin o coordinador) modifica una planilla
-- que ya estaba cerrada (status='finished'), queda un registro de
-- quién la editó y en qué momento.
-- Cómo ejecutar: Supabase → SQL Editor → pegar todo → RUN
-- Es seguro ejecutarlo más de una vez.
-- ============================================================

create table if not exists match_edit_log (
  id              uuid primary key default gen_random_uuid(),
  match_id        uuid not null references matches(id) on delete cascade,
  editor_user_id  uuid,
  editor_name     text,
  editor_email    text,
  edited_at       timestamptz not null default now()
);

create index if not exists match_edit_log_match_id_idx on match_edit_log(match_id);

alter table match_edit_log enable row level security;

drop policy if exists "match_edit_log_select" on match_edit_log;
create policy "match_edit_log_select" on match_edit_log for select using (true);

drop policy if exists "match_edit_log_insert" on match_edit_log;
create policy "match_edit_log_insert" on match_edit_log for insert with check (true);
