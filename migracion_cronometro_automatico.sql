-- ============================================================
-- PUNTUALIDAD: EL CRONÓMETRO DE LA PLANILLA ARRANCA SOLO
--
-- tournaments.cronometro_auto_min:
--   null = apagado (el árbitro inicia el cronómetro, como siempre)
--   10   = el cronómetro arranca solo 10 minutos después de la hora programada del partido
--
-- También vuelve a crear la vista pública de torneos para que incluya la
-- columna nueva (la usa la planilla del link del árbitro). Sigue sin mostrar
-- el token ni la contraseña del link de deudores, y el público solo puede leer.
--
-- Cómo ejecutar: Supabase → SQL Editor → pegar todo → RUN. Se puede correr más de una vez.
-- ============================================================

alter table public.tournaments add column if not exists cronometro_auto_min integer;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'tournaments_cronometro_auto_min_rango') then
    alter table public.tournaments add constraint tournaments_cronometro_auto_min_rango
      check (cronometro_auto_min is null or (cronometro_auto_min >= 0 and cronometro_auto_min <= 120));
  end if;
end $$;

do $$
begin
  if to_regprocedure('public.columnas_publicas(text)') is not null then
    execute 'drop view if exists public.tournaments_publico';
    execute format('create view public.tournaments_publico as select %s from public.tournaments', public.columnas_publicas('tournaments'));
    execute 'revoke all on public.tournaments_publico from public, anon, authenticated';
    execute 'grant select on public.tournaments_publico to anon, authenticated';
  end if;
end $$;
