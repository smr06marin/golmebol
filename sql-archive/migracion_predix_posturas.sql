-- ============================================================
-- MIGRACIÓN: Predix — Apuestas abiertas (mercado) para Duelos 1v1
--
-- Complementa a predix_duelos (retar a alguien puntual). Esta es
-- la otra forma de apostar: dejar una apuesta abierta a un equipo
-- de un partido, visible para todos, y que se cruce sola con quien
-- le meta puntos al equipo contrario — igual que ya funciona
-- "Predix Apuestas 1x1" (predix_apuestas/predix_cruces), pero acá
-- con los puntos reales de Predix (los del ranking de premios),
-- no con la bolsa de puntos aparte.
--
-- Cómo funciona:
-- - Un jugador deja una apuesta abierta: "50 puntos a Chapecó".
-- - Se cruza automáticamente contra lo que otros hayan puesto al
--   equipo contrario, hasta donde alcance el menor de los montos.
--   Ejemplo: alguien le mete 20 a Leones → quedan 30 libres para
--   quien más quiera. Si nadie más entra, esos 30 nunca estuvieron
--   en juego (no ganan ni pierden). Si nadie cruza nada, la
--   apuesta completa queda sin efecto cuando termina el partido.
-- - Aplican las mismas protecciones que en los retos directos:
--   tope de 25% del saldo disponible, no se puede apostar en un
--   partido donde el jugador esté jugando, y quema creciente en
--   revanchas (si dos jugadores puntuales se cruzan varias veces
--   entre sí, el que gana se queda con menos cada vez). Todo esto
--   se valida en la aplicación.
--
-- Cómo ejecutar: Supabase → SQL Editor → pegar todo → RUN
-- Es seguro ejecutarlo más de una vez.
-- ============================================================

create table if not exists predix_posturas (
  id                uuid primary key default gen_random_uuid(),
  match_id          uuid not null references matches(id) on delete cascade,
  tournament_id     uuid references tournaments(id),
  player_id         uuid not null references players(id),
  user_id           uuid not null references auth.users(id),
  nombre            text not null,
  equipo            text not null check (equipo in ('local','visitante')),
  monto             numeric not null check (monto > 0),
  monto_emparejado  numeric not null default 0,
  estado            text not null default 'abierta' check (estado in ('abierta','cerrada')),
  created_at        timestamptz not null default now()
);

create index if not exists idx_predix_posturas_match  on predix_posturas(match_id);
create index if not exists idx_predix_posturas_player on predix_posturas(player_id);

alter table predix_posturas enable row level security;

drop policy if exists "predix_posturas_select" on predix_posturas;
create policy "predix_posturas_select" on predix_posturas for select using (true);

drop policy if exists "predix_posturas_insert" on predix_posturas;
create policy "predix_posturas_insert" on predix_posturas for insert with check (auth.uid() = user_id);

-- Necesario para que, al cruzar una apuesta nueva contra las abiertas,
-- se pueda actualizar el monto_emparejado/estado de las apuestas rivales
-- (no solo la propia).
drop policy if exists "predix_posturas_update" on predix_posturas;
create policy "predix_posturas_update" on predix_posturas for update using (true);

create table if not exists predix_posturas_cruces (
  id            uuid primary key default gen_random_uuid(),
  match_id      uuid not null references matches(id) on delete cascade,
  postura_a_id  uuid not null references predix_posturas(id) on delete cascade,
  postura_b_id  uuid not null references predix_posturas(id) on delete cascade,
  monto         numeric not null check (monto > 0),
  created_at    timestamptz not null default now()
);

create index if not exists idx_predix_posturas_cruces_match on predix_posturas_cruces(match_id);

alter table predix_posturas_cruces enable row level security;

drop policy if exists "predix_posturas_cruces_select" on predix_posturas_cruces;
create policy "predix_posturas_cruces_select" on predix_posturas_cruces for select using (true);

drop policy if exists "predix_posturas_cruces_insert" on predix_posturas_cruces;
create policy "predix_posturas_cruces_insert" on predix_posturas_cruces for insert with check (true);
