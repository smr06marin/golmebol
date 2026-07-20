-- Fase 2 Escuelas: día de partido (convocatoria, formación, partido en vivo, historial)
create table if not exists escuela_partidos (
  id uuid primary key default gen_random_uuid(),
  escuela_id uuid not null references teams(id) on delete cascade,

  -- info del partido
  rival text,
  fecha date,
  hora text,
  torneo text default 'Amistoso',
  estado text not null default 'pendiente' check (estado in ('pendiente','en_curso','finalizado')),
  vista text not null default 'setup',

  -- formación
  formacion_tipo text,
  formacion text,
  pitch_style text default 'Clásico',

  -- convocatoria / alineación (jsonb)
  convocados jsonb not null default '[]',
  lineup jsonb not null default '[]',
  bench jsonb not null default '[]',
  positions jsonb not null default '{}',
  eventos jsonb not null default '[]',

  score_home int not null default 0,
  score_away int not null default 0,
  timer_sec int not null default 0,

  mvp jsonb not null default '{}',
  observaciones text,

  creado_por uuid references players(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_escuela_partidos_escuela on escuela_partidos(escuela_id);
create index if not exists idx_escuela_partidos_estado on escuela_partidos(estado);

alter table escuela_partidos enable row level security;

drop policy if exists "escuela_partidos_all" on escuela_partidos;
create policy "escuela_partidos_all" on escuela_partidos for all using (true) with check (true);
