-- Fase por partido de torneo + resultado final automático. Cuando se crea
-- un partido de "Día de partido" ligado a un torneo de la escuela, ahora se
-- elige también en qué fase se juega (grupos, dieciseisavos, octavos,
-- cuartos, semifinal, tercer/cuarto puesto, final). Al finalizar ese
-- partido, si es una fase eliminatoria, se actualiza solo el estado del
-- torneo (en_curso/finalizado), la fase actual y el resultado final
-- (campeón/subcampeón/tercero/cuarto/eliminado en tal fase) — y ese
-- resultado se le suma a la "vida futbolística" de los jugadores que
-- jugaron algún partido del torneo, de los profesores que dirigieron
-- alguno, y del equipo (escuela).

-- ── 1. Fase de cada partido de torneo ──
alter table escuela_partidos add column if not exists fase text;

-- ── 2. Resumen de torneos en la vida futbolística del jugador ──
alter table players add column if not exists torneos_jugados_escuela numeric default 0;
alter table players add column if not exists torneos_campeon_escuela numeric default 0;
alter table players add column if not exists torneos_subcampeon_escuela numeric default 0;
alter table players add column if not exists torneos_tercero_escuela numeric default 0;

-- ── 3. Resumen de torneos en la vida futbolística del profesor ──
alter table players add column if not exists torneos_jugados_prof numeric default 0;
alter table players add column if not exists torneos_campeon_prof numeric default 0;
alter table players add column if not exists torneos_subcampeon_prof numeric default 0;
alter table players add column if not exists torneos_tercero_prof numeric default 0;

-- ── 4. Resumen de torneos del equipo (escuela) ──
alter table teams add column if not exists torneos_jugados numeric default 0;
alter table teams add column if not exists torneos_campeon numeric default 0;
alter table teams add column if not exists torneos_subcampeon numeric default 0;
alter table teams add column if not exists torneos_tercero numeric default 0;
