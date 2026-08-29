-- ============================================================
-- MIGRACIÓN: Etiquetas de jugador referente en la vista pública
--
-- La página pública del torneo (RosterModal en TorneoPublicoPage.jsx, al
-- tocar un equipo para ver su plantilla) lee los jugadores desde la vista
-- "players_publico" (no desde la tabla players directo) — así que las
-- etiquetas (Élite / Profesional / Mayor de 35 / etiqueta personalizada)
-- agregadas en migracion_jugador_etiquetas.sql no se veían ahí hasta
-- agregarlas también a esta vista.
--
-- Recrea la vista con las mismas columnas de siempre + las 4 nuevas.
-- Requiere haber corrido antes migracion_jugador_etiquetas.sql (si no,
-- este script fallará porque esas columnas de "players" no existirían).
--
-- Cómo ejecutar: Supabase → SQL Editor → pegar todo → RUN
-- Es seguro ejecutarlo más de una vez.
-- ============================================================

drop view if exists public.players_publico;
create view public.players_publico as
select
  id,
  name,
  photo_url,
  photo_face_url,
  city,
  genero,
  posicion,
  posicion_futbol5,
  posicion_futbol7,
  posicion_futbol11,
  goles_escuela,
  asistencias_escuela,
  amarillas_escuela,
  rojas_escuela,
  partidos_escuela,
  mvp_escuela,
  es_elite,
  es_profesional,
  es_mayor_35,
  etiqueta_personalizada
from players;

revoke all on public.players_publico from public;
grant select on public.players_publico to anon, authenticated;
