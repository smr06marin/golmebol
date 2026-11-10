-- =====================================================================
-- NOMBRE DEL EQUIPO SOLO EN UN TORNEO
--
-- Un equipo es el mismo en todos los torneos (así se junta toda su historia),
-- pero el organizador puede ponerle otro nombre SOLO en su torneo. Ese nombre
-- se guarda en tournament_teams.nombre_torneo. El nombre de siempre
-- (teams.name) NO se toca: en los demás torneos sigue igual.
--
-- Qué hace:
--   1) Agrega la columna tournament_teams.nombre_torneo (vacía = nombre de siempre).
--   2) Actualiza la vista pública tournament_teams_publico para que la página
--      pública del torneo muestre el nombre del torneo.
-- No borra ni cambia datos. Se puede correr varias veces.
-- =====================================================================
begin;

alter table public.tournament_teams add column if not exists nombre_torneo text;

-- La vista se vuelve a crear (una vista "select tt.*" no se entera de columnas nuevas).
drop view if exists public.tournament_teams_publico;
create view public.tournament_teams_publico as
select tt.*,
       (select to_jsonb(tp) || jsonb_build_object('name', coalesce(nullif(trim(tt.nombre_torneo), ''), tp.name))
          from public.teams_publico tp where tp.id = tt.team_id) as teams
from public.tournament_teams tt;

-- Solo lectura (igual que antes): nadie puede escribir por la vista
revoke all on public.tournament_teams_publico from public, anon, authenticated;
grant select on public.tournament_teams_publico to anon, authenticated;

commit;
