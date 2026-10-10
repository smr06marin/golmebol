-- ============================================================
-- JUGADORES BÁSICO — vista segura para listas de nombres/fotos
-- Cómo ejecutar: Supabase → SQL Editor → pegar todo → RUN
-- Es seguro ejecutarlo más de una vez. No quita ningún permiso.
--
-- Por qué: varias pantallas (apuestas/retos, lista de árbitros, encuestas,
-- planilla) leen la tabla `players` completa solo para mostrar nombre y foto.
-- Con esta vista leen únicamente eso (sin cédula, teléfono ni fecha de
-- nacimiento). Así, más adelante se puede cerrar la tabla `players` para que
-- cada persona solo vea su propia ficha completa.
-- ============================================================

drop view if exists public.jugadores_basico;
create view public.jugadores_basico as
select
  id,
  name,
  photo_url,
  photo_face_url,
  user_id,
  rol,
  es_arbitro,
  es_arbitro_lider,
  activo_membresia
from public.players;

revoke all on public.jugadores_basico from public, anon;
grant select on public.jugadores_basico to authenticated;

-- Comprobación (opcional): debe dar la misma cantidad que players
-- select (select count(*) from jugadores_basico) as vista, (select count(*) from players) as tabla;
