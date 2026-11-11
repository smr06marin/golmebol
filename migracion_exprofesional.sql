-- ============================================================
-- NUEVA ETIQUETA: "Exprofesional" para los jugadores
-- Cómo ejecutar: Supabase → SQL Editor → pegar todo → RUN
-- Es seguro ejecutarlo más de una vez. No quita ningún permiso.
--
-- Qué hace: agrega la columna es_exprofesional a `players` y recrea la vista
-- pública `players_publico` con las mismas columnas de siempre + esa etiqueta,
-- para que se vea en la plantilla pública de cada equipo.
-- Sigue SIN incluir cédula, teléfono ni fecha de nacimiento.
--
-- IMPORTANTE: correr este SQL ANTES de subir el código a la web.
-- ============================================================

alter table public.players add column if not exists es_exprofesional boolean not null default false;

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
  es_exprofesional,
  es_mayor_35,
  etiqueta_personalizada
from public.players;

revoke all on public.players_publico from public;
grant select on public.players_publico to anon, authenticated;

-- Comprobación (opcional): debe devolver true
-- select exists (select 1 from information_schema.columns
--                where table_name = 'players_publico' and column_name = 'es_exprofesional');
