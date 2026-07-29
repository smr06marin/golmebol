-- ══════════════════════════════════════════════════════════════════
-- Sistema de puntos configurable por torneo (victoria / empate / derrota)
-- ══════════════════════════════════════════════════════════════════
-- Cómo ejecutar: Supabase → SQL Editor → pegar todo → RUN
-- Es seguro ejecutarlo más de una vez.
--
-- Antes, TODOS los torneos usaban 3 puntos por victoria y 1 por empate
-- (0 por derrota), fijo en el código. Ahora cada torneo puede definir su
-- propio sistema (algunos ligas usan 2-1-0 en vez de 3-1-0).
--
-- El default (3, 1, 0) mantiene el comportamiento de siempre para los
-- torneos ya creados — no hace falta tocarlos si no se quiere cambiar
-- su sistema de puntos.

alter table tournaments
  add column if not exists pts_victoria integer not null default 3;

alter table tournaments
  add column if not exists pts_empate integer not null default 1;

alter table tournaments
  add column if not exists pts_derrota integer not null default 0;

comment on column tournaments.pts_victoria is 'Puntos que suma un equipo por partido ganado en este torneo.';
comment on column tournaments.pts_empate  is 'Puntos que suma un equipo por partido empatado en este torneo.';
comment on column tournaments.pts_derrota is 'Puntos que suma un equipo por partido perdido en este torneo (normalmente 0).';
