-- AUDITORÍA de "partidos jugados" por jugador (SOLO LECTURA: todas son SELECT).
-- Regla de Golmebol: juega un partido quien quedó anotado en la planilla con
-- número de camiseta (o marcado "jugó" en la carga rápida). Ejecutar en
-- Supabase > SQL Editor; cada bloque se puede correr por separado.

-- 1) Estadísticas de partidos que NO están terminados (no deberían existir).
select s.match_id, m.status, m.played_at, s.team_id, s.player_id, p.name as jugador
from player_match_stats s
join matches m on m.id = s.match_id
left join players p on p.id = s.player_id
where m.status <> 'finished'
order by m.played_at desc;

-- 2) Estadísticas en partidos por W o desierto (nadie jugó esos partidos).
select s.match_id, m.tipo_resultado, m.played_at, s.team_id, s.player_id, p.name as jugador
from player_match_stats s
join matches m on m.id = s.match_id
left join players p on p.id = s.player_id
where m.tipo_resultado in ('w', 'desierto')
order by m.played_at desc;

-- 3) Estadísticas de un equipo que ni siquiera juega ese partido (dato inconsistente).
select s.match_id, s.team_id, s.player_id, p.name as jugador
from player_match_stats s
join matches m on m.id = s.match_id
left join players p on p.id = s.player_id
where s.team_id <> m.home_team_id and s.team_id <> m.away_team_id;

-- 4) Partidos donde un equipo tiene MUCHOS jugadores anotados (posible plantilla
--    completa anotada por error). Cambia el 12 según la modalidad (F5 ~ 10, F7 ~ 14, F11 ~ 22).
select s.match_id, t.name as equipo, count(*) as jugadores_anotados, m.played_at
from player_match_stats s
join matches m on m.id = s.match_id
join teams t on t.id = s.team_id
group by s.match_id, t.name, m.played_at
having count(*) > 12
order by jugadores_anotados desc, m.played_at desc;

-- 5) Un partido concreto: quién quedó contando como "jugó" y qué hizo.
--    Reemplaza el uuid por el id del partido que quieras revisar.
-- select p.name as jugador, s.numero_camiseta, s.goals_scored, s.yellow_cards, s.red_cards
-- from player_match_stats s join players p on p.id = s.player_id
-- where s.match_id = '00000000-0000-0000-0000-000000000000'
-- order by s.numero_camiseta;

-- Si alguna fila de los bloques 1 a 3 está de verdad mal, revísala y bórrala SOLO tú, a mano:
-- delete from player_match_stats where match_id = '...' and player_id = '...';
