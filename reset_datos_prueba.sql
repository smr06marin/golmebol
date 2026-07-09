-- ============================================================
-- RESET: borra todos los datos de prueba (jugadores, equipos,
-- torneos, partidos, estadísticas, finanzas, etc.) y deja la
-- app en cero para empezar a cargar datos reales.
--
-- CONSERVA (no se toca):
--   - sponsors, cards, card_levels, achievements (plantillas/config)
--   - roles_plataforma: se borra todo EXCEPTO smr06marin@gmail.com
--
-- Cómo ejecutar: Supabase → SQL Editor → pegar todo → RUN
-- Recomendado: correr primero solo la sección 1 (conteo) para
-- confirmar qué se va a borrar, y recién después la sección 2.
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- 1. CONTEO ANTES DE BORRAR (correr esto primero y revisar)
-- ────────────────────────────────────────────────────────────
select
  (select count(*) from players)                            as players,
  (select count(*) from teams)                               as teams,
  (select count(*) from tournaments)                         as tournaments,
  (select count(*) from matches)                              as matches,
  (select count(*) from match_events)                         as match_events,
  (select count(*) from player_match_stats)                   as player_match_stats,
  (select count(*) from tournament_teams)                     as tournament_teams,
  (select count(*) from team_players)                         as team_players,
  (select count(*) from tournament_player_registrations)      as tournament_player_registrations,
  (select count(*) from tournament_grupos)                    as tournament_grupos,
  (select count(*) from grupo_equipos)                        as grupo_equipos,
  (select count(*) from fechas)                                as fechas,
  (select count(*) from canchas)                               as canchas,
  (select count(*) from partido_arqueros)                     as partido_arqueros,
  (select count(*) from tournament_logros)                    as tournament_logros,
  (select count(*) from predicciones)                         as predicciones,
  (select count(*) from torneo_finanzas)                      as torneo_finanzas,
  (select count(*) from sanciones)                             as sanciones,
  (select count(*) from notificaciones)                       as notificaciones,
  (select count(*) from player_notifications)                 as player_notifications,
  (select count(*) from arbitro_evaluaciones)                 as arbitro_evaluaciones,
  (select count(*) from arbitro_examenes)                     as arbitro_examenes,
  (select count(*) from arbitro_reclamos)                     as arbitro_reclamos,
  (select count(*) from encuestas_arbitros)                   as encuestas_arbitros,
  (select count(*) from encuesta_respuestas)                  as encuesta_respuestas,
  (select count(*) from noticias)                              as noticias,
  (select count(*) from records_historicos)                   as records_historicos,
  (select count(*) from player_card_level_progress)           as player_card_level_progress,
  (select count(*) from player_achievement_progress)          as player_achievement_progress,
  (select count(*) from player_stats_cache)                   as player_stats_cache,
  (select count(*) from roles_plataforma)                     as roles_plataforma;


-- ────────────────────────────────────────────────────────────
-- 2. BORRADO (orden pensado para no chocar con llaves foráneas)
--    Corré todo este bloque de una sola vez.
-- ────────────────────────────────────────────────────────────

begin;

-- Progreso / caché de jugador (dependen de players)
delete from player_achievement_progress;
delete from player_card_level_progress;
delete from player_stats_cache;

-- Predicciones y logros
delete from predicciones;
delete from tournament_logros;

-- Módulo árbitros
delete from arbitro_evaluaciones;
delete from arbitro_examenes;
delete from arbitro_reclamos;
delete from encuesta_respuestas;
delete from encuestas_arbitros;

-- Notificaciones
delete from notificaciones;
delete from player_notifications;

-- Sanciones y finanzas (referencian players/teams/tournaments)
delete from sanciones;
delete from torneo_finanzas;

-- Partidos y todo lo que cuelga de un partido
delete from partido_arqueros;
delete from player_match_stats;
delete from match_events;
delete from matches;

-- Inscripciones, grupos, fechas, canchas (cuelgan de tournaments/teams)
delete from tournament_player_registrations;
delete from grupo_equipos;
delete from tournament_grupos;
delete from fechas;
delete from canchas;

-- Vínculos equipo-torneo y equipo-jugador
delete from tournament_teams;
delete from team_players;

-- Entidades principales
delete from teams;
delete from tournaments;
delete from players;

-- Contenido editorial de prueba
delete from noticias;
delete from records_historicos;

-- Cuentas: dejar solo el admin principal
delete from roles_plataforma where email <> 'smr06marin@gmail.com';

commit;


-- ────────────────────────────────────────────────────────────
-- 3. CONTEO DESPUÉS (todo debería dar 0, salvo roles_plataforma = 1)
-- ────────────────────────────────────────────────────────────
select
  (select count(*) from players)     as players,
  (select count(*) from teams)       as teams,
  (select count(*) from tournaments) as tournaments,
  (select count(*) from matches)     as matches,
  (select count(*) from roles_plataforma) as roles_plataforma;


-- ────────────────────────────────────────────────────────────
-- NOTA sobre archivos (fotos, logos, cédulas):
-- Este script solo borra filas de la base de datos. Las imágenes
-- ya subidas (fotos de jugadores, logos de equipos, cédulas,
-- banners de torneos) siguen ocupando espacio en Storage.
-- Para limpiarlas: Supabase → Storage → entrá a cada bucket
-- (players, teams, cedulas, tournaments) → seleccionar todo → borrar.
-- El bucket "sponsors" NO se toca (los sponsors se conservan).
--
-- NOTA sobre cuentas de acceso (auth):
-- Este script no borra usuarios de Supabase Auth (los logins con
-- email/contraseña de jugadores y árbitros de prueba). Si querés
-- borrarlos también: Supabase → Authentication → Users → borrar
-- manualmente los que no sean smr06marin@gmail.com. Se recomienda
-- hacerlo a mano y no por SQL para no romper la sesión activa.
-- ============================================================
