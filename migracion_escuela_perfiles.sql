-- Fase 3 Escuelas: perfil de cada jugador (tarjeta + stats + premios), acudientes y
-- tipo de sangre.

alter table players add column if not exists tipo_sangre text;

-- Flag booleano (mismo patrón que es_arbitro/es_profesor): una persona puede
-- ser jugador Y acudiente al mismo tiempo sin pisar su rol principal.
alter table players add column if not exists es_acudiente boolean not null default false;
create index if not exists idx_players_es_acudiente on players(es_acudiente);

-- Un jugador de escuela (niño/a) también puede tener su propio login, con su
-- número de tarjeta de identidad como cédula (mismo patrón cédula@golmebol.com).
alter table players add column if not exists es_jugador_escuela boolean not null default false;
create index if not exists idx_players_es_jugador_escuela on players(es_jugador_escuela);

alter table players add column if not exists goles_escuela int not null default 0;
alter table players add column if not exists asistencias_escuela int not null default 0;
alter table players add column if not exists amarillas_escuela int not null default 0;
alter table players add column if not exists rojas_escuela int not null default 0;
alter table players add column if not exists partidos_escuela int not null default 0;
alter table players add column if not exists mvp_escuela int not null default 0;

-- Vínculo acudiente ↔ jugador (un acudiente puede tener más de un hijo en la escuela)
create table if not exists escuela_acudientes (
  id uuid primary key default gen_random_uuid(),
  acudiente_id uuid not null references players(id) on delete cascade,
  jugador_id uuid not null references players(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(acudiente_id, jugador_id)
);
create index if not exists idx_escuela_acudientes_acudiente on escuela_acudientes(acudiente_id);
create index if not exists idx_escuela_acudientes_jugador on escuela_acudientes(jugador_id);
alter table escuela_acudientes enable row level security;
drop policy if exists "escuela_acudientes_all" on escuela_acudientes;
create policy "escuela_acudientes_all" on escuela_acudientes for all using (true) with check (true);

-- Premios configurables por escuela, con umbral sobre una estadística del jugador
create table if not exists escuela_premios (
  id uuid primary key default gen_random_uuid(),
  escuela_id uuid not null references teams(id) on delete cascade,
  nombre text not null,
  emoji text default '🏆',
  tipo_stat text not null default 'goles_escuela'
    check (tipo_stat in ('goles_escuela','asistencias_escuela','amarillas_escuela','rojas_escuela','partidos_escuela','mvp_escuela')),
  umbral int not null default 1,
  descripcion text,
  created_at timestamptz not null default now()
);
create index if not exists idx_escuela_premios_escuela on escuela_premios(escuela_id);
alter table escuela_premios enable row level security;
drop policy if exists "escuela_premios_all" on escuela_premios;
create policy "escuela_premios_all" on escuela_premios for all using (true) with check (true);

-- Lista acumulada de quiénes jugaron en un partido (para sumar "partidos jugados")
alter table escuela_partidos add column if not exists jugaron jsonb not null default '[]';
