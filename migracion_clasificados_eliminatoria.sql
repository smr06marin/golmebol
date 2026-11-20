-- ============================================================
-- CUÁNTOS EQUIPOS CLASIFICARON A LAS ELIMINACIONES DIRECTAS
--
-- Antes de programar el primer partido de eliminación directa, la app le
-- pregunta al organizador cuántos clasificaron (por grupo, o de la tabla).
-- Se guarda en tournaments.clasificacion_elim, por ejemplo:
--   {"modo":"grupo","n":2,"extra":2}  → 2 de cada grupo + 2 mejores de los que quedaron afuera
--   {"modo":"tabla","n":8,"extra":0}  → los 8 primeros de la tabla
-- Con eso la página pública marca en rojo a los que no clasificaron.
--
-- También vuelve a crear la vista pública de torneos (tournaments_publico) para
-- que incluya esta columna nueva. Sigue SIN mostrar el token ni la contraseña
-- del link de deudores, y el público solo puede LEER (igual que antes).
--
-- Cómo ejecutar: Supabase → SQL Editor → pegar todo → RUN. Se puede correr más de una vez.
-- ============================================================

alter table public.tournaments add column if not exists clasificacion_elim jsonb;

do $$
begin
  if to_regprocedure('public.columnas_publicas(text)') is not null then
    execute 'drop view if exists public.tournaments_publico';
    execute format('create view public.tournaments_publico as select %s from public.tournaments', public.columnas_publicas('tournaments'));
    execute 'revoke all on public.tournaments_publico from public, anon, authenticated';
    execute 'grant select on public.tournaments_publico to anon, authenticated';
  end if;
end $$;

-- Prueba: debe salir la columna clasificacion_elim y NO link_deudores_token ni link_deudores_password
-- select column_name from information_schema.columns where table_schema = 'public' and table_name = 'tournaments_publico' order by ordinal_position;
