-- ============================================================
-- MIGRACIÓN: Predix — Apuestas 1x1 (juego de predicciones por
-- puntos, SIN dinero real) entre usuarios de la plataforma.
--
-- Cómo funciona:
-- - Cualquier usuario con cuenta pone un número (puntos) a favor
--   de un equipo en un partido programado.
-- - Si otro usuario pone puntos al equipo contrario, se van
--   emparejando (cruzando) automáticamente hasta donde alcance
--   el menor de los dos montos. Lo que quede sin cruzar sigue
--   "abierto" en la mesa para que alguien más lo cierre.
-- - Al terminar el partido, cada cruce se liquida:
--     * Si hay un equipo ganador (sin penales): el ganador se
--       queda con el 80% de lo cruzado del perdedor (+ recupera
--       su propio monto cruzado); el 20% restante es la "casa".
--     * Si el partido queda empatado: cada lado recupera el 80%
--       de lo que cruzó (pierde el 20%).
--     * Si el ganador se define por penales: el ganador solo se
--       queda con el 50% de lo cruzado del perdedor.
--   Lo que nunca se cruzó con nadie se devuelve completo (no
--   gana ni pierde), porque nunca estuvo realmente en juego.
--
-- Cómo ejecutar: Supabase → SQL Editor → pegar todo → RUN
-- Es seguro ejecutarlo más de una vez.
-- ============================================================

create table if not exists predix_apuestas (
  id                uuid primary key default gen_random_uuid(),
  match_id          uuid not null references matches(id) on delete cascade,
  user_id           uuid not null references auth.users(id),
  nombre            text not null,
  equipo            text not null check (equipo in ('local','visitante')),
  monto             numeric not null check (monto > 0),
  monto_emparejado  numeric not null default 0,
  estado            text not null default 'abierta' check (estado in ('abierta','cerrada')),
  created_at        timestamptz not null default now()
);

create index if not exists idx_predix_apuestas_match on predix_apuestas(match_id);
create index if not exists idx_predix_apuestas_user  on predix_apuestas(user_id);

alter table predix_apuestas enable row level security;

drop policy if exists "predix_apuestas_select" on predix_apuestas;
create policy "predix_apuestas_select" on predix_apuestas for select using (true);

drop policy if exists "predix_apuestas_insert" on predix_apuestas;
create policy "predix_apuestas_insert" on predix_apuestas for insert with check (auth.uid() = user_id);

drop policy if exists "predix_apuestas_update" on predix_apuestas;
create policy "predix_apuestas_update" on predix_apuestas for update using (true);

-- Registra qué monto de una apuesta quedó emparejado (cruzado)
-- contra cuál apuesta rival. Un mismo lado del partido puede
-- terminar cruzado contra varias personas distintas.
create table if not exists predix_cruces (
  id            uuid primary key default gen_random_uuid(),
  match_id      uuid not null references matches(id) on delete cascade,
  apuesta_a_id  uuid not null references predix_apuestas(id) on delete cascade,
  apuesta_b_id  uuid not null references predix_apuestas(id) on delete cascade,
  monto         numeric not null check (monto > 0),
  created_at    timestamptz not null default now()
);

create index if not exists idx_predix_cruces_match on predix_cruces(match_id);

alter table predix_cruces enable row level security;

drop policy if exists "predix_cruces_select" on predix_cruces;
create policy "predix_cruces_select" on predix_cruces for select using (true);

drop policy if exists "predix_cruces_insert" on predix_cruces;
create policy "predix_cruces_insert" on predix_cruces for insert with check (true);
