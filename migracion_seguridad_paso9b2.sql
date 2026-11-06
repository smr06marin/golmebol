-- =====================================================================
-- PASO 9B-2 — Árbitros (reclamos y encuestas), disponibilidad de equipos,
--             y la función pública de ocupación de escenarios
-- =====================================================================
-- HOY estas tablas no tienen protección (RLS apagado): cualquiera con la llave
-- pública puede leer, crear o borrar reclamos contra árbitros, encuestas y
-- votos. AHORA:
--   arbitro_reclamos      leer: cuentas de árbitro, admin, organizador | crear/editar/borrar: líder arbitral, admin, organizador
--   encuestas_arbitros    leer: cuentas de árbitro, admin, organizador | crear/editar/borrar: líder arbitral, admin, organizador
--   encuesta_respuestas   leer: cuentas de árbitro, admin, organizador | votar: un árbitro, solo con SU jugador | borrar: admin, organizador
--   team_availability     la app no la usa: solo admin y organizador (leer y escribir)
-- Además crea escenario_ocupacion(): la función que usará la página pública de
-- reservas para saber qué horarios están ocupados SIN leer teléfonos
-- (ese cierre es el paso 9B-3; este archivo NO toca escenario_reservas).
-- NO cambia datos. NO requiere cambio de código (excepto la función, que se usa en 9B-3).
-- =====================================================================
begin;

-- ¿Mi cuenta es de árbitro (o líder arbitral)?
create or replace function public.es_cuenta_arbitro()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
     and exists (
       select 1 from public.players p
       where p.user_id = auth.uid()
         and (p.es_arbitro is true or p.rol = 'arbitro' or p.es_arbitro_lider is true)
     );
$$;
revoke all on function public.es_cuenta_arbitro() from public;
grant execute on function public.es_cuenta_arbitro() to authenticated;

-- ¿Mi cuenta es de líder arbitral?
create or replace function public.es_lider_arbitral()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
     and exists (
       select 1 from public.players p
       where p.user_id = auth.uid() and p.es_arbitro_lider is true
     );
$$;
revoke all on function public.es_lider_arbitral() from public;
grant execute on function public.es_lider_arbitral() to authenticated;

-- Limpia reglas viejas y activa RLS
do $$
declare r record;
begin
  for r in select policyname, tablename from pg_policies
           where schemaname = 'public'
             and tablename in ('arbitro_reclamos','encuestas_arbitros','encuesta_respuestas','team_availability') loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

alter table public.arbitro_reclamos    enable row level security;
alter table public.encuestas_arbitros  enable row level security;
alter table public.encuesta_respuestas enable row level security;
alter table public.team_availability   enable row level security;

-- arbitro_reclamos
create policy gm_reclamos_select on public.arbitro_reclamos for select to authenticated
  using (public.es_cuenta_arbitro() or coalesce(public.es_admin_plataforma(), false) or coalesce(public.es_organizador_plataforma(), false));
create policy gm_reclamos_write on public.arbitro_reclamos for all to authenticated
  using (public.es_lider_arbitral() or coalesce(public.es_admin_plataforma(), false) or coalesce(public.es_organizador_plataforma(), false))
  with check (public.es_lider_arbitral() or coalesce(public.es_admin_plataforma(), false) or coalesce(public.es_organizador_plataforma(), false));

-- encuestas_arbitros
create policy gm_encuestas_select on public.encuestas_arbitros for select to authenticated
  using (public.es_cuenta_arbitro() or coalesce(public.es_admin_plataforma(), false) or coalesce(public.es_organizador_plataforma(), false));
create policy gm_encuestas_write on public.encuestas_arbitros for all to authenticated
  using (public.es_lider_arbitral() or coalesce(public.es_admin_plataforma(), false) or coalesce(public.es_organizador_plataforma(), false))
  with check (public.es_lider_arbitral() or coalesce(public.es_admin_plataforma(), false) or coalesce(public.es_organizador_plataforma(), false));

-- encuesta_respuestas
create policy gm_encresp_select on public.encuesta_respuestas for select to authenticated
  using (public.es_cuenta_arbitro() or coalesce(public.es_admin_plataforma(), false) or coalesce(public.es_organizador_plataforma(), false));
create policy gm_encresp_insert on public.encuesta_respuestas for insert to authenticated
  with check (public.es_cuenta_arbitro() and public.es_mi_jugador(votante_id));
create policy gm_encresp_delete on public.encuesta_respuestas for delete to authenticated
  using (coalesce(public.es_admin_plataforma(), false) or coalesce(public.es_organizador_plataforma(), false));

-- team_availability (sin uso en la app)
create policy gm_tavail_staff on public.team_availability for all to authenticated
  using (coalesce(public.es_admin_plataforma(), false) or coalesce(public.es_organizador_plataforma(), false))
  with check (coalesce(public.es_admin_plataforma(), false) or coalesce(public.es_organizador_plataforma(), false));

-- Función pública: horarios ocupados de un escenario, SIN teléfonos
create or replace function public.escenario_ocupacion(p_escenario_id uuid, p_cancha text default null, p_fecha date default null)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'cancha', r.cancha, 'fecha', r.fecha, 'hora', r.hora, 'duracion', r.duracion,
           'estado', r.estado, 'nombre', r.nombre, 'equipo', r.equipo)), '[]'::jsonb)
  from public.escenario_reservas r
  where r.escenario_id = p_escenario_id
    and (p_cancha is null or r.cancha::text = p_cancha)
    and (p_fecha is null or r.fecha::text = p_fecha::text);
$$;
revoke all on function public.escenario_ocupacion(uuid, text, date) from public;
grant execute on function public.escenario_ocupacion(uuid, text, date) to anon, authenticated;

commit;

-- =====================================================================
-- PRUEBAS
-- =====================================================================
-- A) Un visitante no puede leer reclamos (debe dar 0 filas, aunque haya datos):
--    begin; set local role anon; select count(*) from public.arbitro_reclamos; rollback;
--    -> resultado: count = 0
-- B) La función pública responde (no debe fallar):
--    select jsonb_array_length(public.escenario_ocupacion((select id from public.escenarios limit 1)));
-- C) En la web, con cuenta de árbitro líder: /arbitro/lider registrar un reclamo; /arbitro/ranking verlo y
--    marcarlo resuelto; /arbitro/encuestas crear una encuesta. Con un árbitro normal: votar una encuesta
--    y ver el perfil de otro árbitro (/arbitro/perfil/ID) con sus reclamos.
-- =====================================================================
-- ROLLBACK
-- =====================================================================
-- begin;
-- do $$ declare r record; begin
--   for r in select policyname, tablename from pg_policies where schemaname='public' and tablename in ('arbitro_reclamos','encuestas_arbitros','encuesta_respuestas','team_availability') loop
--     execute format('drop policy %I on public.%I', r.policyname, r.tablename); end loop; end $$;
-- alter table public.arbitro_reclamos disable row level security;
-- alter table public.encuestas_arbitros disable row level security;
-- alter table public.encuesta_respuestas disable row level security;
-- alter table public.team_availability disable row level security;
-- commit;
