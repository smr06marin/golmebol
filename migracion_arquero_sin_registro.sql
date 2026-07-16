-- ── Arquero SIN registro + minuto de las tarjetas ───────────────────────────

-- 1. Un jugador sin registro puede ser el arquero del partido: se guarda con
--    su nombre y número escritos en la planilla (player_id queda nulo).
--    Antes no se guardaba y al reabrir la planilla volvía a pedir arquero.
alter table partido_arqueros add column if not exists player_nombre text;
alter table partido_arqueros add column if not exists numero text;
alter table partido_arqueros alter column player_id drop not null;

-- 2. El minuto de cada tarjeta se guarda en el evento (columna minute, la
--    misma de los goles) para que al reabrir la planilla se vea el tiempo
--    en que se sacó, no solo un chulo.
-- (match_events.minute ya existe — no requiere cambios)
