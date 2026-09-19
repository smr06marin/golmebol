-- ============================================================
-- DIAGNÓSTICO: "Combo de Willy" quedó como el MISMO equipo (mismo id)
-- en Santa Rita y en el otro torneo, cuando en realidad son dos
-- equipos independientes.
--
-- Corré cada SELECT por separado (uno a la vez) y pegame el resultado
-- de cada uno. Con eso armo el script exacto para separarlos en dos
-- equipos, sin tocar nada del equipo original.
-- ============================================================

-- 1) El/los equipo(s) que se llaman "Combo de Willy" (o parecido)
select id, name, city, logo_url, representante_nombre, representante_telefono
from teams
where name ilike '%combo%willy%' or name ilike '%willy%';

-- 2) En qué torneos está inscrito ese equipo (con ese mismo id)
select tt.id as tournament_teams_id, tt.tournament_id, t.name as torneo, tt.team_id
from tournament_teams tt
join tournaments t on t.id = tt.tournament_id
where tt.team_id in (select id from teams where name ilike '%combo%willy%' or name ilike '%willy%')
order by t.name;

-- 3) Jugadores inscritos con ese equipo, por torneo (para ver cuáles son de Santa Rita)
select tpr.id as inscripcion_id, tpr.tournament_id, t.name as torneo, tpr.team_id, p.id as player_id, p.name as jugador, tpr.activo
from tournament_player_registrations tpr
join tournaments t on t.id = tpr.tournament_id
join players p on p.id = tpr.player_id
where tpr.team_id in (select id from teams where name ilike '%combo%willy%' or name ilike '%willy%')
order by t.name, p.name;

-- 4) Partidos jugados/programados con ese equipo, por torneo
select m.id as match_id, m.tournament_id, t.name as torneo, m.home_team_id, m.away_team_id, m.status, m.played_at
from matches m
join tournaments t on t.id = m.tournament_id
where m.home_team_id in (select id from teams where name ilike '%combo%willy%' or name ilike '%willy%')
   or m.away_team_id in (select id from teams where name ilike '%combo%willy%' or name ilike '%willy%')
order by t.name, m.played_at;

-- 5) team_players (relación base equipo↔jugador, no es por torneo)
select tp.id, tp.team_id, tp.player_id, p.name as jugador, tp.activo
from team_players tp
join players p on p.id = tp.player_id
where tp.team_id in (select id from teams where name ilike '%combo%willy%' or name ilike '%willy%')
order by p.name;
