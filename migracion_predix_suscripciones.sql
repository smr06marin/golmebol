-- ============================================================
-- MIGRACIÓN: Predix Golmebol — suscripciones de pago
--
-- Resumen del modelo (ver Plan_Predix_Golmebol_Suscripciones.md):
-- - Predix sigue siendo gratis para predecir (puntos "demo", sin
--   premio). Con una suscripción activa se gana en puntos "pago",
--   que sí compiten por premio.
-- - Dos tipos de plan: "torneo" (habilita un torneo puntual) y
--   "completa" (habilita todos los torneos activos). El jugador
--   elige cuánto paga dentro del rango del plan.
-- - predix_planes: lo que el admin configura (rango de precio,
--   multiplicador de premio, duración).
-- - predix_suscripciones: lo que un jugador activó en concreto
--   (cuánto pagó, desde cuándo, hasta cuándo).
-- - predix_rondas: fechas de apertura/cierre/fin por torneo, las
--   controla el admin principal.
-- - predix_premios_mensuales: registro de quién ganó qué cada mes
--   (top 1 con monto fijo, top 2/3 sorpresa de patrocinadores,
--   bono por desbloqueo de tarjeta con 3 meses seguidos pagos).
--
-- Cómo ejecutar: Supabase → SQL Editor → pegar todo → RUN
-- Es seguro ejecutarlo más de una vez.
-- ============================================================

-- ── Planes ───────────────────────────────────────────────────
create table if not exists predix_planes (
  id                    uuid primary key default gen_random_uuid(),
  tipo                  text not null check (tipo in ('torneo','completa')),
  tournament_id         uuid references tournaments(id) on delete cascade, -- null si tipo = 'completa'
  nombre                text not null,
  precio_min            numeric not null check (precio_min > 0),
  precio_max            numeric not null check (precio_max >= precio_min),
  multiplicador_premio  numeric not null default 4, -- 4 para 'torneo', 10 para 'completa'
  duracion_dias         integer not null default 30,
  activo                boolean not null default true,
  created_at            timestamptz not null default now()
);

create index if not exists idx_predix_planes_torneo on predix_planes(tournament_id);

alter table predix_planes enable row level security;

drop policy if exists "predix_planes_select" on predix_planes;
create policy "predix_planes_select" on predix_planes for select using (true);

drop policy if exists "predix_planes_insert" on predix_planes;
create policy "predix_planes_insert" on predix_planes for insert with check (true);

drop policy if exists "predix_planes_update" on predix_planes;
create policy "predix_planes_update" on predix_planes for update using (true);

drop policy if exists "predix_planes_delete" on predix_planes;
create policy "predix_planes_delete" on predix_planes for delete using (true);

-- ── Suscripciones ────────────────────────────────────────────
create table if not exists predix_suscripciones (
  id              uuid primary key default gen_random_uuid(),
  player_id       uuid not null references players(id) on delete cascade,
  plan_id         uuid not null references predix_planes(id),
  tournament_id   uuid references tournaments(id), -- copia del plan, null si es 'completa'
  monto_pagado    numeric not null check (monto_pagado > 0),
  fecha_inicio    date not null default current_date,
  fecha_fin       date not null,
  estado          text not null default 'activa' check (estado in ('activa','vencida','cancelada')),
  meses_seguidos  integer not null default 1,
  activada_por    uuid references auth.users(id),
  created_at      timestamptz not null default now()
);

create index if not exists idx_predix_suscripciones_player on predix_suscripciones(player_id);
create index if not exists idx_predix_suscripciones_torneo on predix_suscripciones(tournament_id);
create index if not exists idx_predix_suscripciones_estado on predix_suscripciones(estado);

alter table predix_suscripciones enable row level security;

drop policy if exists "predix_suscripciones_select" on predix_suscripciones;
create policy "predix_suscripciones_select" on predix_suscripciones for select using (true);

drop policy if exists "predix_suscripciones_insert" on predix_suscripciones;
create policy "predix_suscripciones_insert" on predix_suscripciones for insert with check (true);

drop policy if exists "predix_suscripciones_update" on predix_suscripciones;
create policy "predix_suscripciones_update" on predix_suscripciones for update using (true);

-- ── Rondas (fechas de apertura/cierre por torneo) ───────────
create table if not exists predix_rondas (
  id             uuid primary key default gen_random_uuid(),
  tournament_id  uuid not null references tournaments(id) on delete cascade,
  nombre         text not null,
  fecha_apertura timestamptz,
  fecha_cierre   timestamptz,
  fecha_fin      timestamptz,
  estado         text not null default 'proxima' check (estado in ('proxima','abierta','cerrada','finalizada')),
  created_at     timestamptz not null default now()
);

create index if not exists idx_predix_rondas_torneo on predix_rondas(tournament_id);

alter table predix_rondas enable row level security;

drop policy if exists "predix_rondas_select" on predix_rondas;
create policy "predix_rondas_select" on predix_rondas for select using (true);

drop policy if exists "predix_rondas_insert" on predix_rondas;
create policy "predix_rondas_insert" on predix_rondas for insert with check (true);

drop policy if exists "predix_rondas_update" on predix_rondas;
create policy "predix_rondas_update" on predix_rondas for update using (true);

-- ── Premios mensuales ────────────────────────────────────────
create table if not exists predix_premios_mensuales (
  id             uuid primary key default gen_random_uuid(),
  mes            date not null, -- primer día del mes que se está premiando
  tipo           text not null check (tipo in ('top1_torneo','top1_completa','top2_sorpresa','top3_sorpresa','tarjeta')),
  tournament_id  uuid references tournaments(id),
  player_id      uuid not null references players(id) on delete cascade,
  posicion       integer,
  monto          numeric, -- solo aplica a top1 (4x/10x lo que pagó); null en sorpresas/tarjeta
  entregado      boolean not null default false,
  created_at     timestamptz not null default now()
);

create index if not exists idx_predix_premios_mes on predix_premios_mensuales(mes);
create index if not exists idx_predix_premios_player on predix_premios_mensuales(player_id);

alter table predix_premios_mensuales enable row level security;

drop policy if exists "predix_premios_select" on predix_premios_mensuales;
create policy "predix_premios_select" on predix_premios_mensuales for select using (true);

drop policy if exists "predix_premios_insert" on predix_premios_mensuales;
create policy "predix_premios_insert" on predix_premios_mensuales for insert with check (true);

drop policy if exists "predix_premios_update" on predix_premios_mensuales;
create policy "predix_premios_update" on predix_premios_mensuales for update using (true);

-- ── Separar puntos "demo" (gratis) de puntos "pago" ─────────
-- Se guarda en cada fila, no se recalcula: si la suscripción vence
-- después, la predicción ya hecha en modo "pago" se queda así.
alter table predicciones     add column if not exists modo text not null default 'demo' check (modo in ('demo','pago'));
alter table predix_apuestas  add column if not exists modo text not null default 'demo' check (modo in ('demo','pago'));

create index if not exists idx_predicciones_modo    on predicciones(modo);
create index if not exists idx_predix_apuestas_modo on predix_apuestas(modo);
