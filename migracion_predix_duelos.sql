-- ============================================================
-- MIGRACIÓN: Predix — Duelos 1v1 (retar a un jugador específico
-- apostando puntos de PREDIX, los mismos que cuentan para el
-- ranking de premios).
--
-- Cómo funciona:
-- - Un jugador reta a otro jugador puntual (no anónimo, no un
--   pool) para un partido donde NINGUNO de los dos esté jugando.
-- - Ambos apuestan el mismo monto de puntos, cada uno a un
--   equipo distinto del mismo partido (el retador elige, el
--   retado queda automáticamente en el equipo contrario).
-- - El retado tiene que ACEPTAR para que el duelo quede en
--   marcha. Mientras no acepte, el retador puede cancelarlo.
-- - Al terminar el partido:
--     * Si hay ganador claro (sin penales): el que acertó no se
--       queda con todo el monto del rival, solo con un
--       porcentaje que baja mientras más veces se enfrenten ESOS
--       DOS jugadores entre sí (para que no sea negocio que un
--       amigo "regale" puntos siempre al mismo):
--         1er duelo entre ambos:  gana 50% del monto del rival
--         2do duelo entre ambos:  gana 30%
--         3er duelo en adelante:  gana 10%
--       El resto de ese monto se pierde (no va a nadie).
--     * Empate: cada lado pierde el 20% de lo que apostó.
--     * Si el ganador se define por penales: el que acertó se
--       queda con el 50% del monto del rival (fijo, no escala).
--   El monto máximo de un duelo es el 25% del saldo Predix
--   disponible del jugador (puntos por predicciones + neto de
--   duelos ya resueltos - lo comprometido en duelos pendientes),
--   para que nadie arriesgue todo de una sola vez. Esto se valida
--   en la aplicación al crear/aceptar el duelo.
--
-- Cómo ejecutar: Supabase → SQL Editor → pegar todo → RUN
-- Es seguro ejecutarlo más de una vez.
-- ============================================================

create table if not exists predix_duelos (
  id                uuid primary key default gen_random_uuid(),
  match_id          uuid not null references matches(id) on delete cascade,
  tournament_id     uuid references tournaments(id),
  retador_id        uuid not null references players(id),
  retador_user_id   uuid not null references auth.users(id),
  retador_nombre    text not null,
  retador_equipo    text not null check (retador_equipo in ('local','visitante')),
  retado_id         uuid not null references players(id),
  retado_user_id    uuid not null references auth.users(id),
  retado_nombre     text not null,
  monto             numeric not null check (monto > 0),
  estado            text not null default 'pendiente' check (estado in ('pendiente','aceptado','rechazado','cancelado')),
  created_at        timestamptz not null default now(),
  respondido_at     timestamptz,
  check (retador_id <> retado_id)
);

create index if not exists idx_predix_duelos_match    on predix_duelos(match_id);
create index if not exists idx_predix_duelos_retador  on predix_duelos(retador_id);
create index if not exists idx_predix_duelos_retado   on predix_duelos(retado_id);
create index if not exists idx_predix_duelos_estado   on predix_duelos(estado);

alter table predix_duelos enable row level security;

drop policy if exists "predix_duelos_select" on predix_duelos;
create policy "predix_duelos_select" on predix_duelos for select using (true);

-- Solo el retador puede crear un reto a su propio nombre.
drop policy if exists "predix_duelos_insert" on predix_duelos;
create policy "predix_duelos_insert" on predix_duelos for insert with check (auth.uid() = retador_user_id);

-- El retado acepta/rechaza; el retador puede cancelar mientras esté pendiente.
-- (La transición exacta se valida en la aplicación, no acá.)
drop policy if exists "predix_duelos_update" on predix_duelos;
create policy "predix_duelos_update" on predix_duelos for update
  using (auth.uid() = retador_user_id or auth.uid() = retado_user_id);
