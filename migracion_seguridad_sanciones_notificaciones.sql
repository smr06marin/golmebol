-- ============================================================
-- SEGURIDAD: cerrar `sanciones` y `notificaciones`
-- Cómo ejecutar: Supabase → SQL Editor → pegar todo → RUN
-- Es seguro ejecutarlo más de una vez.
--
-- Qué arregla:
--  * sanciones: hoy CUALQUIERA en internet (sin iniciar sesión) puede
--    leer, crear, cambiar y borrar sanciones. Después: solo quien haya
--    iniciado sesión (incluye árbitros por link de planilla).
--  * notificaciones: hoy no tiene ninguna protección. Después: cada
--    persona solo ve y marca como leídas SUS notificaciones; crear
--    notificaciones requiere cuenta real (no sesión anónima de planilla).
--
-- No requiere cambios en el código de la app.
-- ROLLBACK: al final del archivo (bloque comentado).
-- ============================================================

-- 0. Ayudante: ¿este jugador es la persona que tiene la sesión iniciada?
create or replace function public.es_mi_jugador(p_player_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.players p
    where p.id = p_player_id and p.user_id = auth.uid()
  );
$$;
revoke all on function public.es_mi_jugador(uuid) from public;
grant execute on function public.es_mi_jugador(uuid) to authenticated;

-- 1. SANCIONES ------------------------------------------------
alter table public.sanciones enable row level security;

do $$
declare r record;
begin
  for r in select policyname from pg_policies
           where schemaname = 'public' and tablename = 'sanciones'
  loop
    execute format('drop policy if exists %I on public.sanciones', r.policyname);
  end loop;
end $$;

revoke all on public.sanciones from anon;
grant select, insert, update, delete on public.sanciones to authenticated;

create policy sanciones_select_auth on public.sanciones
  for select to authenticated using (true);

create policy sanciones_insert_auth on public.sanciones
  for insert to authenticated with check (true);

create policy sanciones_update_auth on public.sanciones
  for update to authenticated using (true) with check (true);

-- Borrar sanciones: solo admin / organizador de la plataforma
create policy sanciones_delete_staff on public.sanciones
  for delete to authenticated
  using (public.es_admin_plataforma() or public.es_organizador_plataforma());

-- 2. NOTIFICACIONES -------------------------------------------
alter table public.notificaciones enable row level security;

do $$
declare r record;
begin
  for r in select policyname from pg_policies
           where schemaname = 'public' and tablename = 'notificaciones'
  loop
    execute format('drop policy if exists %I on public.notificaciones', r.policyname);
  end loop;
end $$;

revoke all on public.notificaciones from anon;
grant select, insert, update, delete on public.notificaciones to authenticated;

-- Ver y marcar como leídas: solo las propias (o admin)
create policy notif_select_propia on public.notificaciones
  for select to authenticated
  using (public.es_mi_jugador(player_id) or public.es_admin_plataforma());

create policy notif_update_propia on public.notificaciones
  for update to authenticated
  using (public.es_mi_jugador(player_id) or public.es_admin_plataforma())
  with check (public.es_mi_jugador(player_id) or public.es_admin_plataforma());

-- Crear: cuenta real (la sesión anónima de los links de planilla no puede)
create policy notif_insert_cuenta_real on public.notificaciones
  for insert to authenticated
  with check (coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false);

create policy notif_delete_propia on public.notificaciones
  for delete to authenticated
  using (public.es_mi_jugador(player_id) or public.es_admin_plataforma());

-- 3. VERIFICACIÓN (debe mostrar anon sin permisos en ambas tablas)
select table_name, grantee, string_agg(privilege_type, ', ') as permisos
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('sanciones', 'notificaciones')
  and grantee in ('anon', 'authenticated')
group by 1, 2
order by 1, 2;

-- ============================================================
-- ROLLBACK (solo si algo se rompe): quita el "--" de estas líneas y ejecuta
-- ============================================================
-- grant select, insert, update, delete on public.sanciones to anon;
-- drop policy if exists sanciones_select_auth on public.sanciones;
-- create policy sanciones_abierta on public.sanciones for all to public using (true) with check (true);
-- alter table public.notificaciones disable row level security;
-- grant select, insert, update, delete on public.notificaciones to anon;
