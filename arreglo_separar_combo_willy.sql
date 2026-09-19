-- ============================================================
-- ARREGLO: "COMBO DE WILLY" quedó como el MISMO equipo (mismo id
-- 1c7118c9-0f1b-4195-8980-7d2b15d980ec) en dos torneos:
--   - RELAMPAGO VIVEROS  (10 jugadores, 3 partidos ya finalizados)
--   - Torneo Barrio Santa Rita (16 jugadores, 2 partidos programados)
-- pero son dos equipos DISTINTOS que coinciden en nombre.
--
-- Este script:
--  1) Crea un equipo NUEVO (copia el nombre/ciudad/escudo/dueño
--     actuales — si el dueño real de Santa Rita es otra persona,
--     lo editás después en Equipos → el equipo nuevo).
--  2) Deja RELAMPAGO VIVEROS exactamente como está, sin tocarlo —
--     se queda con el equipo original y sus 10 jugadores y 3 partidos.
--  3) Mueve al equipo NUEVO solo lo de Santa Rita: la inscripción del
--     equipo en el torneo, los 16 jugadores inscritos ahí, esos mismos
--     jugadores en su relación base equipo↔jugador, y los 2 partidos
--     programados (por si ya hay algo cargado en ellos, también mueve
--     eventos/arqueros/estadísticas de esos partidos puntuales).
--
-- Es seguro ejecutarlo una sola vez. Si lo corrés dos veces no hace
-- nada la segunda vez (ya no quedará nada con el equipo viejo en
-- Santa Rita para mover).
-- Cómo ejecutar: Supabase → SQL Editor → pegar todo → RUN.
-- ============================================================

do $$
declare
  v_viejo_id  uuid := '1c7118c9-0f1b-4195-8980-7d2b15d980ec'; -- Combo de Willy (queda en RELAMPAGO VIVEROS)
  v_torneo_sr uuid := 'bf7454c6-7287-4c37-b7b2-f502748c9f3c'; -- Torneo Barrio Santa Rita
  v_nuevo_id  uuid;
begin
  -- 1) Equipo nuevo para Santa Rita (copia de los datos actuales)
  insert into teams (name, city, logo_url, representante_nombre, representante_telefono)
  select name, city, logo_url, representante_nombre, representante_telefono
  from teams where id = v_viejo_id
  returning id into v_nuevo_id;

  -- 2) La inscripción del equipo en Santa Rita pasa al equipo nuevo
  update tournament_teams set team_id = v_nuevo_id
  where tournament_id = v_torneo_sr and team_id = v_viejo_id;

  -- 3) Los jugadores inscritos en Santa Rita pasan al equipo nuevo
  update tournament_player_registrations set team_id = v_nuevo_id
  where tournament_id = v_torneo_sr and team_id = v_viejo_id;

  -- 4) Esos mismos jugadores, en su relación base equipo↔jugador
  update team_players set team_id = v_nuevo_id
  where team_id = v_viejo_id
    and player_id in (
      select player_id from tournament_player_registrations
      where tournament_id = v_torneo_sr and team_id = v_nuevo_id
    );

  -- 5) Los partidos programados de Santa Rita
  update matches set home_team_id = v_nuevo_id
  where tournament_id = v_torneo_sr and home_team_id = v_viejo_id;
  update matches set away_team_id = v_nuevo_id
  where tournament_id = v_torneo_sr and away_team_id = v_viejo_id;

  -- 6) Por si ya hay algo cargado en esos 2 partidos puntuales de Santa Rita
  update player_match_stats set team_id = v_nuevo_id
  where team_id = v_viejo_id and tournament_id = v_torneo_sr;

  update match_events set team_id = v_nuevo_id
  where team_id = v_viejo_id and match_id in (
    select id from matches where tournament_id = v_torneo_sr
  );

  update partido_arqueros set team_id = v_nuevo_id
  where team_id = v_viejo_id and match_id in (
    select id from matches where tournament_id = v_torneo_sr
  );

  update tournament_logros set team_id = v_nuevo_id
  where team_id = v_viejo_id and tournament_id = v_torneo_sr;

  raise notice 'Listo — equipo nuevo para Santa Rita creado con id: %', v_nuevo_id;
end $$;

-- Verificación rápida después de correrlo:
select 'RELAMPAGO VIVEROS' as torneo, count(*) from tournament_player_registrations
  where tournament_id = '7a971f03-5761-4fcc-8e55-bbab72017e7f' and team_id = '1c7118c9-0f1b-4195-8980-7d2b15d980ec' and activo = true
union all
select 'Santa Rita (equipo viejo, debe dar 0)', count(*) from tournament_player_registrations
  where tournament_id = 'bf7454c6-7287-4c37-b7b2-f502748c9f3c' and team_id = '1c7118c9-0f1b-4195-8980-7d2b15d980ec' and activo = true;
