-- ============================================================
-- MIGRACIÓN: Preferencia de días/hora por equipo, para la jornada
-- automática (Torneos → Partidos → Jornada Automática)
-- Cómo ejecutar: Supabase → SQL Editor → pegar → RUN
-- Es seguro ejecutarlo más de una vez.
--
-- dias_preferidos: array de texto con los días que ese equipo prefiere
--   jugar EN ESTE TORNEO (ej: {'martes','jueves'}). Vacío/null = sin
--   preferencia (cualquier día sirve).
-- hora_preferida: hora que ese equipo prefiere jugar. Vacío/null = sin
--   preferencia (se usa la hora por defecto de la jornada).
-- Van en tournament_teams (no en teams) porque la preferencia es por
-- torneo — el mismo equipo puede jugar dos torneos con horarios distintos.
-- ============================================================

alter table tournament_teams add column if not exists dias_preferidos text[];
alter table tournament_teams add column if not exists hora_preferida time;
