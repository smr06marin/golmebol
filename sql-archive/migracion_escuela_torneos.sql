-- Fase 4 Escuelas: torneos externos en los que participa la escuela (no son
-- los torneos internos de Golmebol), con su fase/resultado, partidos
-- vinculados y premios individuales por torneo.

create table if not exists escuela_torneos (
  id uuid primary key default gen_random_uuid(),
  escuela_id uuid not null references teams(id) on delete cascade,
  nombre text not null,
  temporada text,
  fecha_inicio date,
  fecha_fin date,
  estado text not null default 'en_curso' check (estado in ('en_curso','finalizado')),
  fase_actual text,
  resultado_final text,
  observaciones text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_escuela_torneos_escuela on escuela_torneos(escuela_id);
alter table escuela_torneos enable row level security;
drop policy if exists "escuela_torneos_all" on escuela_torneos;
create policy "escuela_torneos_all" on escuela_torneos for all using (true) with check (true);

-- Un partido de "Día de partido" puede quedar vinculado a uno de estos torneos
alter table escuela_partidos add column if not exists torneo_id uuid references escuela_torneos(id) on delete set null;
create index if not exists idx_escuela_partidos_torneo on escuela_partidos(torneo_id);

-- Premios individuales del torneo (goleador, MVP del torneo, etc.), a mano por el coordinador
create table if not exists escuela_torneo_premios (
  id uuid primary key default gen_random_uuid(),
  torneo_id uuid not null references escuela_torneos(id) on delete cascade,
  jugador_id uuid not null references players(id) on delete cascade,
  nombre text not null,
  emoji text default '🏆',
  descripcion text,
  created_at timestamptz not null default now()
);
create index if not exists idx_escuela_torneo_premios_torneo on escuela_torneo_premios(torneo_id);
create index if not exists idx_escuela_torneo_premios_jugador on escuela_torneo_premios(jugador_id);
alter table escuela_torneo_premios enable row level security;
drop policy if exists "escuela_torneo_premios_all" on escuela_torneo_premios;
create policy "escuela_torneo_premios_all" on escuela_torneo_premios for all using (true) with check (true);
