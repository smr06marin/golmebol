-- Tanda de penales: se registra aparte del marcador del partido. Un gol de
-- penales no vale lo mismo que un gol de partido, así que jugadores y
-- arqueros lo llevan en columnas propias, separadas de sus estadísticas
-- normales de la escuela.

-- ── 1. Resultado de la tanda, guardado en el partido ──
alter table escuela_partidos add column if not exists penales_jugados boolean not null default false;
alter table escuela_partidos add column if not exists penales_home numeric;
alter table escuela_partidos add column if not exists penales_away numeric;
alter table escuela_partidos add column if not exists penales_detalle jsonb;

-- ── 2. Dato especial en la vida futbolística del jugador ──
alter table players add column if not exists goles_penales_escuela numeric default 0;
alter table players add column if not exists atajadas_penales_escuela numeric default 0;
alter table players add column if not exists goles_recibidos_penales_escuela numeric default 0;
