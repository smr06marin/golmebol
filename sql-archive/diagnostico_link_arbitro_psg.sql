-- Diagnóstico: revisa el partido del link de árbitro más reciente (equipos
-- y torneo reales guardados en la fila de "matches"), y compara contra las
-- inscripciones de PSG en tournament_player_registrations.
-- Solo LEE datos, no cambia nada. Correr en Supabase → SQL Editor → RUN.

-- 1) Últimos partidos con link de árbitro generado
select m.id as match_id, m.tournament_id, t.name as torneo,
       m.home_team_id, ht.name as home_name,
       m.away_team_id, at.name as away_name,
       m.link_planilla_expira
from matches m
join tournaments t on t.id = m.tournament_id
left join teams ht on ht.id = m.home_team_id
left join teams at on at.id = m.away_team_id
where m.link_planilla_token is not null
order by m.link_planilla_expira desc
limit 5;

-- 2) Inscripciones de PSG en tournament_player_registrations (todas, para
--    ver el tournament_id y team_id reales con los que quedaron guardadas,
--    y si activo está en true/false/null)
select tpr.id, tpr.tournament_id, t.name as torneo, tpr.team_id, tpr.activo, p.name as jugador
from tournament_player_registrations tpr
join players p on p.id = tpr.player_id
join tournaments t on t.id = tpr.tournament_id
join teams te on te.id = tpr.team_id
where te.name ilike '%psg%'
order by tpr.tournament_id;
