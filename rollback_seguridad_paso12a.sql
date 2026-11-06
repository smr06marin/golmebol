-- ROLLBACK DEL PASO 12A — devuelve la política de lectura de players como estaba.
begin;

drop policy if exists players_select on public.players;
create policy players_select on public.players
  for select
  using ((auth.uid() IS NOT NULL) AND (COALESCE(((auth.jwt() ->> 'is_anonymous'::text))::boolean, false) = false));

drop function if exists public.es_cuenta_conocida();

commit;
