-- Asistencia de entrenamientos: cualquier profesor de la escuela (no solo el
-- coordinador) puede marcar quién vino cada día. Un registro por
-- jugador+fecha (si se vuelve a guardar el mismo día, se actualiza).
create table if not exists escuela_asistencia (
  id uuid primary key default gen_random_uuid(),
  escuela_id uuid not null references teams(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  fecha date not null,
  presente boolean not null default true,
  profesor_id uuid references players(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(escuela_id, player_id, fecha)
);
create index if not exists idx_escuela_asistencia_escuela_fecha on escuela_asistencia(escuela_id, fecha);
create index if not exists idx_escuela_asistencia_player on escuela_asistencia(player_id);
alter table escuela_asistencia enable row level security;
drop policy if exists "escuela_asistencia_all" on escuela_asistencia;
create policy "escuela_asistencia_all" on escuela_asistencia for all using (true) with check (true);
