-- Fase 5 Escuelas: Ficha de Evolución del Jugador — datos básicos ampliados,
-- medidas físicas, pruebas físicas, evaluación técnica/táctica, disciplina
-- y estadísticas detalladas por partido. Todo con fecha, para poder graficar
-- la evolución en el tiempo (peso, estatura, velocidad, técnica, etc).

-- ── 1. Datos básicos ampliados (se editan, no son series de tiempo) ──
alter table players add column if not exists posicion text;
alter table players add column if not exists pie_dominante text check (pie_dominante in ('izquierdo','derecho','ambidiestro'));
alter table players add column if not exists anios_jugando numeric;

-- ── 2. Medidas físicas (peso mensual, estatura/envergadura/pie cada 3-6 meses) ──
create table if not exists escuela_medidas (
  id uuid primary key default gen_random_uuid(),
  jugador_id uuid not null references players(id) on delete cascade,
  fecha date not null default current_date,
  estatura_cm numeric,
  peso_kg numeric,
  imc numeric,
  envergadura_cm numeric,
  talla_pie numeric,
  created_at timestamptz not null default now()
);
create index if not exists idx_escuela_medidas_jugador on escuela_medidas(jugador_id, fecha);
alter table escuela_medidas enable row level security;
drop policy if exists "escuela_medidas_all" on escuela_medidas;
create policy "escuela_medidas_all" on escuela_medidas for all using (true) with check (true);

-- ── 3. Pruebas físicas (cada 3 meses) ──
create table if not exists escuela_pruebas_fisicas (
  id uuid primary key default gen_random_uuid(),
  jugador_id uuid not null references players(id) on delete cascade,
  fecha date not null default current_date,
  velocidad_seg numeric,
  agilidad_seg numeric,
  resistencia_nivel numeric,
  salto_vertical_cm numeric,
  flexibilidad_cm numeric,
  fuerza_reps numeric,
  created_at timestamptz not null default now()
);
create index if not exists idx_escuela_pruebas_fisicas_jugador on escuela_pruebas_fisicas(jugador_id, fecha);
alter table escuela_pruebas_fisicas enable row level security;
drop policy if exists "escuela_pruebas_fisicas_all" on escuela_pruebas_fisicas;
create policy "escuela_pruebas_fisicas_all" on escuela_pruebas_fisicas for all using (true) with check (true);

-- ── 4. Evaluación técnica (cada 2-3 meses, escala 1-10) ──
create table if not exists escuela_tecnica (
  id uuid primary key default gen_random_uuid(),
  jugador_id uuid not null references players(id) on delete cascade,
  fecha date not null default current_date,
  control numeric, pase_corto numeric, pase_largo numeric, conduccion numeric,
  regate numeric, remate numeric, cabeceo numeric, ambas_piernas numeric,
  created_at timestamptz not null default now()
);
create index if not exists idx_escuela_tecnica_jugador on escuela_tecnica(jugador_id, fecha);
alter table escuela_tecnica enable row level security;
drop policy if exists "escuela_tecnica_all" on escuela_tecnica;
create policy "escuela_tecnica_all" on escuela_tecnica for all using (true) with check (true);

-- ── 5. Evaluación táctica (cada 3 meses, escala 1-10) ──
create table if not exists escuela_tactica (
  id uuid primary key default gen_random_uuid(),
  jugador_id uuid not null references players(id) on delete cascade,
  fecha date not null default current_date,
  posicionamiento numeric, decisiones numeric, comprension numeric,
  marcacion numeric, movimientos_sin_balon numeric,
  created_at timestamptz not null default now()
);
create index if not exists idx_escuela_tactica_jugador on escuela_tactica(jugador_id, fecha);
alter table escuela_tactica enable row level security;
drop policy if exists "escuela_tactica_all" on escuela_tactica;
create policy "escuela_tactica_all" on escuela_tactica for all using (true) with check (true);

-- ── 6. Disciplina y actitud (mensual, escala 1-10) ──
create table if not exists escuela_disciplina (
  id uuid primary key default gen_random_uuid(),
  jugador_id uuid not null references players(id) on delete cascade,
  fecha date not null default current_date,
  puntualidad numeric, asistencia numeric, actitud numeric,
  trabajo_equipo numeric, liderazgo numeric, respeto numeric, esfuerzo numeric,
  created_at timestamptz not null default now()
);
create index if not exists idx_escuela_disciplina_jugador on escuela_disciplina(jugador_id, fecha);
alter table escuela_disciplina enable row level security;
drop policy if exists "escuela_disciplina_all" on escuela_disciplina;
create policy "escuela_disciplina_all" on escuela_disciplina for all using (true) with check (true);

-- ── 7. Estadísticas detalladas por partido (una fila por jugador por partido) ──
create table if not exists escuela_partido_stats (
  id uuid primary key default gen_random_uuid(),
  partido_id uuid not null references escuela_partidos(id) on delete cascade,
  jugador_id uuid not null references players(id) on delete cascade,
  minutos numeric,
  recuperaciones numeric,
  pases_acertados numeric,
  calificacion numeric,
  created_at timestamptz not null default now(),
  unique(partido_id, jugador_id)
);
create index if not exists idx_escuela_partido_stats_jugador on escuela_partido_stats(jugador_id);
create index if not exists idx_escuela_partido_stats_partido on escuela_partido_stats(partido_id);
alter table escuela_partido_stats enable row level security;
drop policy if exists "escuela_partido_stats_all" on escuela_partido_stats;
create policy "escuela_partido_stats_all" on escuela_partido_stats for all using (true) with check (true);
