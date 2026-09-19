-- ============================================================
-- MIGRACIÓN: Sanciones de jugadores
-- Cómo ejecutar: Supabase → SQL Editor → pegar todo → RUN
-- Es seguro ejecutarlo más de una vez.
-- ============================================================

create table if not exists sanciones (
  id            uuid primary key default gen_random_uuid(),
  player_id     uuid references players(id) on delete cascade,
  tournament_id uuid references tournaments(id) on delete set null,  -- null = aplica a TODOS los torneos
  motivo        text,
  fecha_fin     timestamptz,  -- null = para siempre
  activa        boolean default true,
  created_at    timestamptz default now()
);

create index if not exists idx_sanciones_jugador on sanciones(player_id);

alter table sanciones enable row level security;

drop policy if exists "sanciones_select" on sanciones;
create policy "sanciones_select" on sanciones for select using (true);

drop policy if exists "sanciones_insert" on sanciones;
create policy "sanciones_insert" on sanciones for insert with check (true);

drop policy if exists "sanciones_update" on sanciones;
create policy "sanciones_update" on sanciones for update using (true);

drop policy if exists "sanciones_delete" on sanciones;
create policy "sanciones_delete" on sanciones for delete using (true);
