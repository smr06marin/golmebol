-- Vida futbolística del profesor (partidos jugados/ganados/empatados/
-- perdidos, goles, posición, años jugando, equipos, logros) + evaluaciones
-- que el profesor coordinador le hace a cada profesor (escala 1-10, con
-- fecha, para poder ver la evolución en el tiempo — mismo patrón que
-- escuela_tecnica/escuela_tactica/escuela_disciplina para jugadores).

-- ── 1. Vida futbolística — datos que se editan directo (no son serie de tiempo) ──
alter table players add column if not exists partidos_jugados_prof numeric default 0;
alter table players add column if not exists partidos_ganados_prof numeric default 0;
alter table players add column if not exists partidos_empatados_prof numeric default 0;
alter table players add column if not exists partidos_perdidos_prof numeric default 0;
alter table players add column if not exists goles_prof numeric default 0;
alter table players add column if not exists posicion_prof text;
alter table players add column if not exists anios_jugando_prof numeric;
alter table players add column if not exists equipos_prof text;
alter table players add column if not exists logros_prof text;

-- ── 2. Evaluaciones del coordinador a cada profesor (escala 1-10) ──
create table if not exists escuela_profesor_evaluaciones (
  id uuid primary key default gen_random_uuid(),
  profesor_id uuid not null references players(id) on delete cascade,
  evaluador_id uuid references players(id) on delete set null,
  fecha date not null default current_date,
  puntualidad numeric,
  conocimiento_tecnico numeric,
  comunicacion numeric,
  liderazgo numeric,
  disciplina numeric,
  compromiso numeric,
  comentario text,
  created_at timestamptz not null default now()
);
create index if not exists idx_escuela_profesor_evaluaciones_profesor on escuela_profesor_evaluaciones(profesor_id, fecha);
alter table escuela_profesor_evaluaciones enable row level security;
drop policy if exists "escuela_profesor_evaluaciones_all" on escuela_profesor_evaluaciones;
create policy "escuela_profesor_evaluaciones_all" on escuela_profesor_evaluaciones for all using (true) with check (true);
