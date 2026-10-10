-- ============================================================
-- ARREGLO: la plantilla de los equipos no cargaba (vista players_publico)
-- Cómo ejecutar: Supabase → SQL Editor → pegar todo → RUN
-- Es seguro ejecutarlo más de una vez. No quita ningún permiso.
--
-- Qué pasaba: la vista pública de jugadores perdió las columnas de etiquetas
-- (Élite / Profesional / Mayor de 35 / etiqueta personalizada) cuando se
-- recreó en la migración de seguridad. La página del torneo las pide, la base
-- respondía "column players_publico.es_elite does not exist" y la plantilla
-- se quedaba en "Cargando jugadores" para siempre.
--
-- Qué hace: se asegura de que las columnas existan en `players` y recrea la
-- vista con las mismas columnas de siempre + las etiquetas.
-- Sigue SIN incluir cédula, teléfono ni fecha de nacimiento.
-- ============================================================

alter table public.players add column if not exists es_mayor_35   boolean not null default false;
alter table public.players add column if not exists es_elite      boolean not null default false;
alter table public.players add column if not exists es_profesional boolean not null default false;
alter table public.players add column if not exists etiqueta_personalizada text;

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
from public.players;

revoke all on public.players_publico from public;
grant select on public.players_publico to anon, authenticated;

-- Comprobación (opcional): debe devolver true
-- select exists (select 1 from information_schema.columns
--                where table_name = 'players_publico' and column_name = 'es_elite');
