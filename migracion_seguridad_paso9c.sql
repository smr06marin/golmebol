-- =====================================================================
-- PASO 9C — Sanciones, informes arbitrales, historial de ediciones y notificaciones de jugadores
-- =====================================================================
-- Tu auditoría mostró reglas "true" para cualquier sesión (incluidas las
-- sesiones anónimas que se crean al abrir un link de planilla):
--   sanciones             cualquiera podía crear y editar sanciones
--   player_notifications  cualquiera podía leer y escribir las notificaciones de TODOS
--   match_informes        cualquiera podía crear informes; los informes eran públicos (incluso sin sesión)
--   match_edit_log        cualquiera podía escribir; público (con el correo de quien editó)
-- AHORA:
--   sanciones             leer: cualquier sesión (la planilla la necesita para bloquear jugadores)
--                         crear/editar: admin, organizador, dueño del torneo, árbitros y quien planilla ese partido
--                         borrar: admin, organizador
--   match_informes        leer y crear: admin, organizador, árbitros y quien planilla ese partido | editar/borrar: admin, organizador
--   match_edit_log        leer y crear: admin, organizador y quien planilla ese partido | borrar: admin
--   player_notifications  leer/marcar leídas/borrar: el propio jugador (y admin) | crear: admin
-- NO cambia datos. NO requiere cambio de código.
-- Requiere es_cuenta_arbitro() (paso 9B-2) y puede_planillar_partido() (paso 6).
-- Aplicar fuera de partidos en vivo si se puede.
-- =====================================================================
begin;

-- ¿Puedo crear/editar esta sanción?
create or replace function public.puede_gestionar_sancion(p_tournament uuid, p_match uuid, p_team uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
     and (
          coalesce(public.es_admin_plataforma(), false)
       or coalesce(public.es_organizador_plataforma(), false)
       or coalesce(public.es_dueno_torneo(p_tournament), false)
       or coalesce(public.es_cuenta_arbitro(), false)
       or (p_match is not null and exists (
              select 1 from public.matches m where m.id = p_match and public.puede_planillar_partido(m.id)))
       or (p_team is not null and exists (
              select 1 from public.matches m
              where (m.home_team_id = p_team or m.away_team_id = p_team)
                and public.puede_planillar_partido(m.id)))
     );
$$;
revoke all on function public.puede_gestionar_sancion(uuid, uuid, uuid) from public;
grant execute on function public.puede_gestionar_sancion(uuid, uuid, uuid) to authenticated;

-- ¿Puedo ver/crear informes o historial de este partido?
create or replace function public.puede_ver_partido_oficial(p_match uuid, p_incluye_arbitros boolean)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
     and (
          coalesce(public.es_admin_plataforma(), false)
       or coalesce(public.es_organizador_plataforma(), false)
       or (p_incluye_arbitros and coalesce(public.es_cuenta_arbitro(), false))
       or coalesce(public.puede_planillar_partido(p_match), false)
     );
$$;
revoke all on function public.puede_ver_partido_oficial(uuid, boolean) from public;
grant execute on function public.puede_ver_partido_oficial(uuid, boolean) to authenticated;

do $$
declare r record;
begin
  for r in select policyname, tablename from pg_policies
           where schemaname = 'public'
             and tablename in ('sanciones','match_informes','match_edit_log','player_notifications') loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

alter table public.sanciones            enable row level security;
alter table public.match_informes       enable row level security;
alter table public.match_edit_log       enable row level security;
alter table public.player_notifications enable row level security;

-- sanciones
create policy gm_sanc_select on public.sanciones for select to authenticated using (true);
create policy gm_sanc_insert on public.sanciones for insert to authenticated
  with check (public.puede_gestionar_sancion(tournament_id, match_id, team_id));
create policy gm_sanc_update on public.sanciones for update to authenticated
  using (public.puede_gestionar_sancion(tournament_id, match_id, team_id))
  with check (public.puede_gestionar_sancion(tournament_id, match_id, team_id));
create policy gm_sanc_delete on public.sanciones for delete to authenticated
  using (coalesce(public.es_admin_plataforma(), false) or coalesce(public.es_organizador_plataforma(), false));

-- match_informes
create policy gm_inf_select on public.match_informes for select to authenticated
  using (public.puede_ver_partido_oficial(match_id, true));
create policy gm_inf_insert on public.match_informes for insert to authenticated
  with check (public.puede_ver_partido_oficial(match_id, true));
create policy gm_inf_update on public.match_informes for update to authenticated
  using (coalesce(public.es_admin_plataforma(), false) or coalesce(public.es_organizador_plataforma(), false))
  with check (coalesce(public.es_admin_plataforma(), false) or coalesce(public.es_organizador_plataforma(), false));
create policy gm_inf_delete on public.match_informes for delete to authenticated
  using (coalesce(public.es_admin_plataforma(), false) or coalesce(public.es_organizador_plataforma(), false));

-- match_edit_log
create policy gm_log_select on public.match_edit_log for select to authenticated
  using (public.puede_ver_partido_oficial(match_id, false));
create policy gm_log_insert on public.match_edit_log for insert to authenticated
  with check (public.puede_ver_partido_oficial(match_id, false));
create policy gm_log_delete on public.match_edit_log for delete to authenticated
  using (coalesce(public.es_admin_plataforma(), false));

-- player_notifications
create policy gm_pnot_select on public.player_notifications for select to authenticated
  using (public.es_mi_jugador(player_id) or coalesce(public.es_admin_plataforma(), false));
create policy gm_pnot_insert on public.player_notifications for insert to authenticated
  with check (coalesce(public.es_admin_plataforma(), false));
create policy gm_pnot_update on public.player_notifications for update to authenticated
  using (public.es_mi_jugador(player_id) or coalesce(public.es_admin_plataforma(), false))
  with check (public.es_mi_jugador(player_id) or coalesce(public.es_admin_plataforma(), false));
create policy gm_pnot_delete on public.player_notifications for delete to authenticated
  using (public.es_mi_jugador(player_id) or coalesce(public.es_admin_plataforma(), false));

commit;

-- =====================================================================
-- PRUEBAS
-- =====================================================================
-- A) Un visitante sin cuenta no ve informes ni notificaciones (cada una debe dar 0):
--    begin; set local role anon;
--    select (select count(*) from public.match_informes) as informes,
--           (select count(*) from public.player_notifications) as notificaciones,
--           (select count(*) from public.match_edit_log) as historial;
--    rollback;
-- B) Reglas: debe dar 4 + 4 + 3 + 4 = 15 filas:
--    select tablename, policyname, cmd from pg_policies
--    where tablename in ('sanciones','match_informes','match_edit_log','player_notifications') order by 1, 3;
-- C) En la web:
--    1. Planilla rápida y profesional (por link y con cuenta de árbitro): terminar un partido con tarjeta roja
--       -> se crea la sanción automática y el informe; cerrar con informe escrito.
--    2. Admin/organizador: /admin/suspensiones: suspender y levantar una sanción; ver el historial y los informes arbitrales.
--    3. Un jugador: entrar a su inicio -> ver sus notificaciones (ronda de Predix, tarjeta nueva).
--    4. Admin: enviar una notificación masiva desde Tarjetas.
-- =====================================================================
-- ROLLBACK
-- =====================================================================
-- begin;
-- do $$ declare r record; begin
--   for r in select policyname, tablename from pg_policies where schemaname='public' and tablename in ('sanciones','match_informes','match_edit_log','player_notifications') loop
--     execute format('drop policy %I on public.%I', r.policyname, r.tablename); end loop; end $$;
-- create policy rollback_sanciones on public.sanciones for all to authenticated using (true) with check (true);
-- create policy rollback_informes on public.match_informes for all to public using (true) with check (true);
-- create policy rollback_edit_log on public.match_edit_log for all to public using (true) with check (true);
-- create policy rollback_pnot on public.player_notifications for all to authenticated using (true) with check (true);
-- commit;
