-- ============================================================
-- MIGRACIÓN: pago individual de tarjetas + suspensión automática
-- por tarjeta roja
-- Cómo ejecutar: Supabase → SQL Editor → pegar todo → RUN
-- Es seguro ejecutarlo más de una vez.
-- ============================================================

-- 1. Pago de una tarjeta específica de un jugador (para poder quitar la
--    advertencia "debe tarjeta" en la planilla sin tocar el balance
--    general de cuentas por equipo, que sigue funcionando igual).
alter table player_match_stats add column if not exists yellow_paid boolean not null default false;
alter table player_match_stats add column if not exists blue_paid   boolean not null default false;
alter table player_match_stats add column if not exists red_paid    boolean not null default false;

-- 2. Suspensión automática por tarjeta roja: se guarda igual que una
--    sanción manual, pero con partidos_pendientes = 1 (en vez de fecha_fin).
--    Cada vez que el equipo del jugador juega un partido, ese contador baja
--    solo; al llegar a 0 la sanción se desactiva sola. Si el organizador
--    quiere extenderla, la edita a mano desde el torneo (ya funciona con
--    fecha_fin, como antes).
alter table sanciones add column if not exists team_id uuid references teams(id) on delete set null;
alter table sanciones add column if not exists match_id uuid references matches(id) on delete set null;
alter table sanciones add column if not exists partidos_pendientes integer;

create index if not exists idx_sanciones_match on sanciones(match_id);
create index if not exists idx_sanciones_team  on sanciones(team_id);
