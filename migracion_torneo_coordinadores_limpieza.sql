-- ============================================================
-- LIMPIEZA (correr UNA sola vez, solo si ya habías corrido la primera versión de
-- migracion_torneo_coordinadores.sql).
--
-- La primera versión le atribuía al único coordinador TODOS los torneos no finalizados.
-- Esto quita los torneos que ya iniciaron y donde nunca se asignó ningún árbitro:
-- esos no son de ningún coordinador. Los que sí tienen árbitros asignados, los que
-- aún no inician y los que un coordinador marcó con «Yo lo dirijo» después, se quedan.
--
-- Cómo ejecutar: Supabase → SQL Editor → pegar todo → RUN.
-- (No la repitas después de que los coordinadores usen «Yo lo dirijo» en torneos sin árbitros asignados:
--  si la repites, esos se quitarían.)
-- ============================================================

delete from torneo_coordinadores tc
where exists (            -- el torneo ya inició (hay un partido jugado)
        select 1 from matches m where m.tournament_id = tc.tournament_id and m.status = 'finished')
  and not exists (        -- y nunca se asignó un árbitro en ningún partido
        select 1 from matches m
        where m.tournament_id = tc.tournament_id
          and (m.arbitro1_id is not null or m.arbitro2_id is not null or m.arbitro3_id is not null));

-- Ver cómo quedó (opcional):
-- select p.name as coordinador, t.name as torneo
-- from torneo_coordinadores tc
-- join players p on p.id = tc.coordinador_id
-- join tournaments t on t.id = tc.tournament_id
-- order by p.name, t.name;
