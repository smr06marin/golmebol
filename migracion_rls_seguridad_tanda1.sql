-- ============================================================
-- MIGRACIÓN: RLS seguridad — TANDA 1
-- Cómo ejecutar (cuando se apruebe): Supabase → SQL Editor → RUN
-- Es idempotente (drop policy if exists / create or replace function).
--
-- PRERREQUISITO: migracion_rpc_registro.sql ya aplicada y verificada
-- (registrar_equipo / registrar_escuela / buscar_jugador_por_cedula /
--  jugador_tiene_deuda / confirmar_cedula_urls). Esos RPC son
--  security definer y siguen funcionando con RLS endurecido.
--
-- Tablas cubiertas:
--   roles_plataforma, players (+ vista players_publico),
--   tournaments, teams, matches, torneo_finanzas,
--   escenario_ventas, escenario_compras, escenario_pedidos,
--   las 13 tablas escuela_*
--
-- Storage "cedulas": NO se redefine acá — ya quedó en
-- migracion_rpc_registro.sql (cedulas_insert_registro /
-- cedulas_select_autorizado).
--
-- NOTA players / página pública:
--   anon pierde SELECT en players. La página pública debe leer
--   players_publico (o actualizar embeds). Mientras TorneoPublicoPage
--   haga .select('players(...)') sobre la tabla base, esos embeds
--   fallarán para anon hasta migrar el frontend.
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- 0. HELPERS (security definer — evitan recursión RLS)
-- ────────────────────────────────────────────────────────────

create or replace function public.es_admin_plataforma()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from roles_plataforma rp
    where rp.activo is not false
      and rp.rol = 'admin'
      and (
        rp.user_id = auth.uid()
        or lower(rp.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      )
  );
$$;

create or replace function public.es_organizador_plataforma()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from roles_plataforma rp
    where rp.activo is not false
      and rp.rol = 'organizador'
      and (
        rp.user_id = auth.uid()
        or lower(rp.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      )
  );
$$;

-- Dueño del torneo (organizador_id = auth.uid()) o admin
create or replace function public.es_dueno_torneo(p_tournament_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.es_admin_plataforma()
    or exists (
      select 1 from tournaments t
      where t.id = p_tournament_id
        and t.organizador_id = auth.uid()
    );
$$;

-- Encargado del escenario (vía escenario_encargados → players.user_id) o admin
create or replace function public.es_encargado_escenario(p_escenario_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.es_admin_plataforma()
    or exists (
      select 1
      from escenario_encargados ee
      join players p on p.id = ee.player_id
      where ee.escenario_id = p_escenario_id
        and p.user_id = auth.uid()
    );
$$;

-- Staff de una escuela (profesor / coordinador con players.escuela_id) o admin
create or replace function public.es_staff_escuela(p_escuela_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.es_admin_plataforma()
    or exists (
      select 1 from players p
      where p.user_id = auth.uid()
        and p.escuela_id = p_escuela_id
        and (p.es_profesor = true or p.es_profesor_coordinador = true or p.rol = 'profesor')
    );
$$;

-- Staff de la escuela a la que pertenece un jugador (alumno / profesor evaluado)
create or replace function public.es_staff_de_jugador(p_jugador_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.es_admin_plataforma()
    or exists (
      select 1
      from players alumno
      join players staff on staff.escuela_id = alumno.escuela_id
      where alumno.id = p_jugador_id
        and alumno.escuela_id is not null
        and staff.user_id = auth.uid()
        and (staff.es_profesor = true or staff.es_profesor_coordinador = true or staff.rol = 'profesor')
    );
$$;

-- Organizador dueño de algún torneo donde el jugador está (o estuvo) inscrito
create or replace function public.es_org_de_jugador(p_jugador_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.es_admin_plataforma()
    or exists (
      select 1
      from tournament_player_registrations r
      join tournaments t on t.id = r.tournament_id
      where r.player_id = p_jugador_id
        and t.organizador_id = auth.uid()
    );
$$;

revoke all on function public.es_admin_plataforma() from public;
revoke all on function public.es_organizador_plataforma() from public;
revoke all on function public.es_dueno_torneo(uuid) from public;
revoke all on function public.es_encargado_escenario(uuid) from public;
revoke all on function public.es_staff_escuela(uuid) from public;
revoke all on function public.es_staff_de_jugador(uuid) from public;
revoke all on function public.es_org_de_jugador(uuid) from public;

grant execute on function public.es_admin_plataforma() to authenticated, anon;
grant execute on function public.es_organizador_plataforma() to authenticated, anon;
grant execute on function public.es_dueno_torneo(uuid) to authenticated, anon;
grant execute on function public.es_encargado_escenario(uuid) to authenticated, anon;
grant execute on function public.es_staff_escuela(uuid) to authenticated, anon;
grant execute on function public.es_staff_de_jugador(uuid) to authenticated, anon;
grant execute on function public.es_org_de_jugador(uuid) to authenticated, anon;


-- ────────────────────────────────────────────────────────────
-- 1. roles_plataforma
-- ────────────────────────────────────────────────────────────
-- Bootstrap del primer admin (correr UNA vez como postgres / service_role
-- si la tabla está vacía o no hay admin; bypasea RLS):
--   insert into roles_plataforma (email, rol, activo)
--   values ('tu@email.com', 'admin', true)
--   on conflict (email) do update set rol = 'admin', activo = true;

alter table roles_plataforma enable row level security;

drop policy if exists "roles_select" on roles_plataforma;
drop policy if exists "roles_insert" on roles_plataforma;
drop policy if exists "roles_update" on roles_plataforma;
drop policy if exists "roles_delete" on roles_plataforma;
drop policy if exists "roles_plataforma_select" on roles_plataforma;
drop policy if exists "roles_plataforma_insert" on roles_plataforma;
drop policy if exists "roles_plataforma_update_admin" on roles_plataforma;
drop policy if exists "roles_plataforma_update_claim" on roles_plataforma;
drop policy if exists "roles_plataforma_delete" on roles_plataforma;

-- Admin ve todos; cada usuario ve su propia fila (user_id o email del JWT).
create policy "roles_plataforma_select"
on roles_plataforma for select
using (
  public.es_admin_plataforma()
  or user_id = auth.uid()
  or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
);

-- Solo admin puede crear roles
create policy "roles_plataforma_insert"
on roles_plataforma for insert
with check (public.es_admin_plataforma());

-- Admin edita cualquier fila
create policy "roles_plataforma_update_admin"
on roles_plataforma for update
using (public.es_admin_plataforma())
with check (public.es_admin_plataforma());

-- Claim propio: App.jsx hace update({ user_id }) al login.
-- El trigger de abajo impide mutar rol/activo/email/plan.
create policy "roles_plataforma_update_claim"
on roles_plataforma for update
using (
  lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  and (user_id is null or user_id = auth.uid())
)
with check (
  lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  and user_id = auth.uid()
);

create policy "roles_plataforma_delete"
on roles_plataforma for delete
using (public.es_admin_plataforma());

-- Guardia de columnas: no-admin no puede tocar rol/activo/email/plan.
-- RLS no limita columnas en UPDATE; este trigger cierra el hueco.
create or replace function public.roles_plataforma_claim_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.es_admin_plataforma() then
    return new;
  end if;
  if new.rol is distinct from old.rol
     or new.activo is distinct from old.activo
     or new.email is distinct from old.email
     or new.plan is distinct from old.plan then
    raise exception 'Solo un admin puede modificar rol/activo/email/plan en roles_plataforma';
  end if;
  if new.user_id is distinct from old.user_id
     and old.user_id is not null
     and new.user_id is distinct from auth.uid() then
    raise exception 'No se puede reasignar user_id de un rol ajeno';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_roles_plataforma_claim_guard on roles_plataforma;
create trigger trg_roles_plataforma_claim_guard
before update on roles_plataforma
for each row execute function public.roles_plataforma_claim_guard();


-- ────────────────────────────────────────────────────────────
-- 2. players — filas + vista pública (sin PII para anon)
-- ────────────────────────────────────────────────────────────

alter table players enable row level security;

drop policy if exists players_insert_own on players;
drop policy if exists players_update_own on players;
drop policy if exists players_delete_own on players;
drop policy if exists players_insert_all on players;
drop policy if exists players_update_all on players;
drop policy if exists players_delete_all on players;
drop policy if exists players_select_all on players;
drop policy if exists "players_select" on players;
drop policy if exists "players_insert" on players;
drop policy if exists "players_update" on players;
drop policy if exists "players_delete" on players;

-- SELECT de filas abierto a quien tenga GRANT (authenticated).
-- anon NO tiene GRANT sobre players (ver abajo).
create policy "players_select"
on players for select
using (true);

-- Escritura: admin, organizador del torneo del jugador, staff de su escuela,
-- o el propio dueño (user_id = auth.uid()).
-- INSERT de jugadores nuevos vía registro público va por RPC (security definer).
create policy "players_insert"
on players for insert
with check (
  public.es_admin_plataforma()
  or public.es_organizador_plataforma()
  or public.es_staff_escuela(escuela_id)
  or user_id = auth.uid()
);

create policy "players_update"
on players for update
using (
  public.es_admin_plataforma()
  or public.es_org_de_jugador(id)
  or public.es_staff_de_jugador(id)
  or user_id = auth.uid()
)
with check (
  public.es_admin_plataforma()
  or public.es_org_de_jugador(id)
  or public.es_staff_de_jugador(id)
  or user_id = auth.uid()
);

create policy "players_delete"
on players for delete
using (
  public.es_admin_plataforma()
  or public.es_org_de_jugador(id)
  or public.es_staff_de_jugador(id)
  or user_id = auth.uid()
);

-- Vista pública: SOLO columnas usadas en la página pública del torneo
-- (nombre/foto/ciudad/posiciones/stats). Sin cédula, teléfonos,
-- URLs de documento ni user_id.
-- security_invoker=false (default): la vista lee players como owner,
-- así anon puede SELECT la vista sin GRANT sobre la tabla base.
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
  mvp_escuela
from players;

revoke all on public.players_publico from public;
grant select on public.players_publico to anon, authenticated;

-- anon: sin SELECT en players. authenticated conserva SELECT * (tanda 2).
revoke select on table public.players from anon;
grant select on table public.players to authenticated;


-- ────────────────────────────────────────────────────────────
-- 3. tournaments / teams / matches
-- ────────────────────────────────────────────────────────────

alter table tournaments enable row level security;
alter table teams       enable row level security;
alter table matches     enable row level security;

-- tournaments
drop policy if exists "tournaments_select" on tournaments;
drop policy if exists "tournaments_insert" on tournaments;
drop policy if exists "tournaments_update" on tournaments;
drop policy if exists "tournaments_delete" on tournaments;

create policy "tournaments_select"
on tournaments for select
using (true);

create policy "tournaments_insert"
on tournaments for insert
with check (
  public.es_admin_plataforma()
  or organizador_id = auth.uid()
);

create policy "tournaments_update"
on tournaments for update
using (
  public.es_admin_plataforma()
  or organizador_id = auth.uid()
)
with check (
  public.es_admin_plataforma()
  or organizador_id = auth.uid()
);

create policy "tournaments_delete"
on tournaments for delete
using (
  public.es_admin_plataforma()
  or organizador_id = auth.uid()
);

-- teams (sin organizador_id: vía tournament_teams; escuelas vía staff)
drop policy if exists "teams_select" on teams;
drop policy if exists "teams_insert" on teams;
drop policy if exists "teams_update" on teams;
drop policy if exists "teams_delete" on teams;

create policy "teams_select"
on teams for select
using (true);

create policy "teams_insert"
on teams for insert
with check (
  public.es_admin_plataforma()
  or public.es_organizador_plataforma()
);

create policy "teams_update"
on teams for update
using (
  public.es_admin_plataforma()
  or public.es_staff_escuela(id)
  or exists (
    select 1 from tournament_teams tt
    join tournaments t on t.id = tt.tournament_id
    where tt.team_id = teams.id
      and t.organizador_id = auth.uid()
  )
)
with check (
  public.es_admin_plataforma()
  or public.es_staff_escuela(id)
  or exists (
    select 1 from tournament_teams tt
    join tournaments t on t.id = tt.tournament_id
    where tt.team_id = teams.id
      and t.organizador_id = auth.uid()
  )
);

create policy "teams_delete"
on teams for delete
using (
  public.es_admin_plataforma()
  or exists (
    select 1 from tournament_teams tt
    join tournaments t on t.id = tt.tournament_id
    where tt.team_id = teams.id
      and t.organizador_id = auth.uid()
  )
);

-- matches
drop policy if exists "matches_select" on matches;
drop policy if exists "matches_insert" on matches;
drop policy if exists "matches_update" on matches;
drop policy if exists "matches_delete" on matches;

create policy "matches_select"
on matches for select
using (true);

create policy "matches_insert"
on matches for insert
with check (public.es_dueno_torneo(tournament_id));

create policy "matches_update"
on matches for update
using (public.es_dueno_torneo(tournament_id))
with check (public.es_dueno_torneo(tournament_id));

create policy "matches_delete"
on matches for delete
using (public.es_dueno_torneo(tournament_id));


-- ────────────────────────────────────────────────────────────
-- 4. torneo_finanzas — NADA público
--    (jugador_tiene_deuda lee vía security definer → no se rompe)
-- ────────────────────────────────────────────────────────────

alter table torneo_finanzas enable row level security;

drop policy if exists "finanzas_select" on torneo_finanzas;
drop policy if exists "finanzas_insert" on torneo_finanzas;
drop policy if exists "finanzas_update" on torneo_finanzas;
drop policy if exists "finanzas_delete" on torneo_finanzas;
drop policy if exists "torneo_finanzas_select" on torneo_finanzas;
drop policy if exists "torneo_finanzas_insert" on torneo_finanzas;
drop policy if exists "torneo_finanzas_update" on torneo_finanzas;
drop policy if exists "torneo_finanzas_delete" on torneo_finanzas;

create policy "torneo_finanzas_select"
on torneo_finanzas for select
using (public.es_dueno_torneo(tournament_id));

create policy "torneo_finanzas_insert"
on torneo_finanzas for insert
with check (public.es_dueno_torneo(tournament_id));

create policy "torneo_finanzas_update"
on torneo_finanzas for update
using (public.es_dueno_torneo(tournament_id))
with check (public.es_dueno_torneo(tournament_id));

create policy "torneo_finanzas_delete"
on torneo_finanzas for delete
using (public.es_dueno_torneo(tournament_id));


-- ────────────────────────────────────────────────────────────
-- 5. escenario_ventas / compras / pedidos
-- ────────────────────────────────────────────────────────────

alter table escenario_ventas  enable row level security;
alter table escenario_compras enable row level security;
alter table escenario_pedidos enable row level security;

-- ventas
drop policy if exists "escenario_ventas_select" on escenario_ventas;
drop policy if exists "escenario_ventas_insert" on escenario_ventas;
drop policy if exists "escenario_ventas_update" on escenario_ventas;
drop policy if exists "escenario_ventas_delete" on escenario_ventas;

create policy "escenario_ventas_select"
on escenario_ventas for select
using (public.es_encargado_escenario(escenario_id));

create policy "escenario_ventas_insert"
on escenario_ventas for insert
with check (public.es_encargado_escenario(escenario_id));

create policy "escenario_ventas_update"
on escenario_ventas for update
using (public.es_encargado_escenario(escenario_id))
with check (public.es_encargado_escenario(escenario_id));

create policy "escenario_ventas_delete"
on escenario_ventas for delete
using (public.es_encargado_escenario(escenario_id));

-- compras
drop policy if exists "escenario_compras_select" on escenario_compras;
drop policy if exists "escenario_compras_insert" on escenario_compras;
drop policy if exists "escenario_compras_update" on escenario_compras;
drop policy if exists "escenario_compras_delete" on escenario_compras;

create policy "escenario_compras_select"
on escenario_compras for select
using (public.es_encargado_escenario(escenario_id));

create policy "escenario_compras_insert"
on escenario_compras for insert
with check (public.es_encargado_escenario(escenario_id));

create policy "escenario_compras_update"
on escenario_compras for update
using (public.es_encargado_escenario(escenario_id))
with check (public.es_encargado_escenario(escenario_id));

create policy "escenario_compras_delete"
on escenario_compras for delete
using (public.es_encargado_escenario(escenario_id));

-- pedidos
drop policy if exists "escenario_pedidos_select" on escenario_pedidos;
drop policy if exists "escenario_pedidos_insert" on escenario_pedidos;
drop policy if exists "escenario_pedidos_update" on escenario_pedidos;
drop policy if exists "escenario_pedidos_delete" on escenario_pedidos;
drop policy if exists "escenario_pedidos_insert_publico" on escenario_pedidos;

create policy "escenario_pedidos_select"
on escenario_pedidos for select
using (public.es_encargado_escenario(escenario_id));

create policy "escenario_pedidos_insert"
on escenario_pedidos for insert
with check (public.es_encargado_escenario(escenario_id));

create policy "escenario_pedidos_update"
on escenario_pedidos for update
using (public.es_encargado_escenario(escenario_id))
with check (public.es_encargado_escenario(escenario_id));

create policy "escenario_pedidos_delete"
on escenario_pedidos for delete
using (public.es_encargado_escenario(escenario_id));


-- ────────────────────────────────────────────────────────────
-- 6. Las 13 tablas escuela_*
--    Staff = es_profesor / es_profesor_coordinador / rol='profesor'
--    con players.escuela_id = esa escuela.
-- ────────────────────────────────────────────────────────────

alter table escuela_partidos              enable row level security;
alter table escuela_asistencia            enable row level security;
alter table escuela_medidas               enable row level security;
alter table escuela_pruebas_fisicas       enable row level security;
alter table escuela_tecnica               enable row level security;
alter table escuela_tactica               enable row level security;
alter table escuela_disciplina            enable row level security;
alter table escuela_partido_stats         enable row level security;
alter table escuela_acudientes            enable row level security;
alter table escuela_premios               enable row level security;
alter table escuela_torneos               enable row level security;
alter table escuela_torneo_premios        enable row level security;
alter table escuela_profesor_evaluaciones enable row level security;

-- Tablas con escuela_id directo
do $$
declare
  t text;
begin
  foreach t in array array[
    'escuela_partidos',
    'escuela_asistencia',
    'escuela_premios',
    'escuela_torneos'
  ]
  loop
    execute format('drop policy if exists %I on %I', t || '_all', t);
    execute format('drop policy if exists %I on %I', t || '_select', t);
    execute format('drop policy if exists %I on %I', t || '_insert', t);
    execute format('drop policy if exists %I on %I', t || '_update', t);
    execute format('drop policy if exists %I on %I', t || '_delete', t);

    execute format($p$
      create policy %I on %I for select
      using (public.es_staff_escuela(escuela_id))
    $p$, t || '_select', t);

    execute format($p$
      create policy %I on %I for insert
      with check (public.es_staff_escuela(escuela_id))
    $p$, t || '_insert', t);

    execute format($p$
      create policy %I on %I for update
      using (public.es_staff_escuela(escuela_id))
      with check (public.es_staff_escuela(escuela_id))
    $p$, t || '_update', t);

    execute format($p$
      create policy %I on %I for delete
      using (public.es_staff_escuela(escuela_id))
    $p$, t || '_delete', t);
  end loop;
end $$;

-- Tablas por jugador_id (evolución del alumno)
do $$
declare
  t text;
begin
  foreach t in array array[
    'escuela_medidas',
    'escuela_pruebas_fisicas',
    'escuela_tecnica',
    'escuela_tactica',
    'escuela_disciplina'
  ]
  loop
    execute format('drop policy if exists %I on %I', t || '_all', t);
    execute format('drop policy if exists %I on %I', t || '_select', t);
    execute format('drop policy if exists %I on %I', t || '_insert', t);
    execute format('drop policy if exists %I on %I', t || '_update', t);
    execute format('drop policy if exists %I on %I', t || '_delete', t);

    execute format($p$
      create policy %I on %I for select
      using (public.es_staff_de_jugador(jugador_id))
    $p$, t || '_select', t);

    execute format($p$
      create policy %I on %I for insert
      with check (public.es_staff_de_jugador(jugador_id))
    $p$, t || '_insert', t);

    execute format($p$
      create policy %I on %I for update
      using (public.es_staff_de_jugador(jugador_id))
      with check (public.es_staff_de_jugador(jugador_id))
    $p$, t || '_update', t);

    execute format($p$
      create policy %I on %I for delete
      using (public.es_staff_de_jugador(jugador_id))
    $p$, t || '_delete', t);
  end loop;
end $$;

-- escuela_partido_stats → vía partido → escuela_id
drop policy if exists "escuela_partido_stats_all" on escuela_partido_stats;
drop policy if exists "escuela_partido_stats_select" on escuela_partido_stats;
drop policy if exists "escuela_partido_stats_insert" on escuela_partido_stats;
drop policy if exists "escuela_partido_stats_update" on escuela_partido_stats;
drop policy if exists "escuela_partido_stats_delete" on escuela_partido_stats;

create policy "escuela_partido_stats_select"
on escuela_partido_stats for select
using (
  exists (
    select 1 from escuela_partidos ep
    where ep.id = partido_id
      and public.es_staff_escuela(ep.escuela_id)
  )
);

create policy "escuela_partido_stats_insert"
on escuela_partido_stats for insert
with check (
  exists (
    select 1 from escuela_partidos ep
    where ep.id = partido_id
      and public.es_staff_escuela(ep.escuela_id)
  )
);

create policy "escuela_partido_stats_update"
on escuela_partido_stats for update
using (
  exists (
    select 1 from escuela_partidos ep
    where ep.id = partido_id
      and public.es_staff_escuela(ep.escuela_id)
  )
)
with check (
  exists (
    select 1 from escuela_partidos ep
    where ep.id = partido_id
      and public.es_staff_escuela(ep.escuela_id)
  )
);

create policy "escuela_partido_stats_delete"
on escuela_partido_stats for delete
using (
  exists (
    select 1 from escuela_partidos ep
    where ep.id = partido_id
      and public.es_staff_escuela(ep.escuela_id)
  )
);

-- escuela_torneo_premios → vía torneo → escuela_id
drop policy if exists "escuela_torneo_premios_all" on escuela_torneo_premios;
drop policy if exists "escuela_torneo_premios_select" on escuela_torneo_premios;
drop policy if exists "escuela_torneo_premios_insert" on escuela_torneo_premios;
drop policy if exists "escuela_torneo_premios_update" on escuela_torneo_premios;
drop policy if exists "escuela_torneo_premios_delete" on escuela_torneo_premios;

create policy "escuela_torneo_premios_select"
on escuela_torneo_premios for select
using (
  exists (
    select 1 from escuela_torneos et
    where et.id = torneo_id
      and public.es_staff_escuela(et.escuela_id)
  )
);

create policy "escuela_torneo_premios_insert"
on escuela_torneo_premios for insert
with check (
  exists (
    select 1 from escuela_torneos et
    where et.id = torneo_id
      and public.es_staff_escuela(et.escuela_id)
  )
);

create policy "escuela_torneo_premios_update"
on escuela_torneo_premios for update
using (
  exists (
    select 1 from escuela_torneos et
    where et.id = torneo_id
      and public.es_staff_escuela(et.escuela_id)
  )
)
with check (
  exists (
    select 1 from escuela_torneos et
    where et.id = torneo_id
      and public.es_staff_escuela(et.escuela_id)
  )
);

create policy "escuela_torneo_premios_delete"
on escuela_torneo_premios for delete
using (
  exists (
    select 1 from escuela_torneos et
    where et.id = torneo_id
      and public.es_staff_escuela(et.escuela_id)
  )
);

-- escuela_acudientes: staff de la escuela del alumno, o el propio acudiente/jugador
drop policy if exists "escuela_acudientes_all" on escuela_acudientes;
drop policy if exists "escuela_acudientes_select" on escuela_acudientes;
drop policy if exists "escuela_acudientes_insert" on escuela_acudientes;
drop policy if exists "escuela_acudientes_update" on escuela_acudientes;
drop policy if exists "escuela_acudientes_delete" on escuela_acudientes;

create policy "escuela_acudientes_select"
on escuela_acudientes for select
using (
  public.es_staff_de_jugador(jugador_id)
  or exists (select 1 from players p where p.id = acudiente_id and p.user_id = auth.uid())
  or exists (select 1 from players p where p.id = jugador_id and p.user_id = auth.uid())
);

create policy "escuela_acudientes_insert"
on escuela_acudientes for insert
with check (
  public.es_staff_de_jugador(jugador_id)
  or exists (select 1 from players p where p.id = acudiente_id and p.user_id = auth.uid())
);

create policy "escuela_acudientes_update"
on escuela_acudientes for update
using (public.es_staff_de_jugador(jugador_id))
with check (public.es_staff_de_jugador(jugador_id));

create policy "escuela_acudientes_delete"
on escuela_acudientes for delete
using (
  public.es_staff_de_jugador(jugador_id)
  or exists (select 1 from players p where p.id = acudiente_id and p.user_id = auth.uid())
);

-- escuela_profesor_evaluaciones: staff de la misma escuela que el profesor evaluado
drop policy if exists "escuela_profesor_evaluaciones_all" on escuela_profesor_evaluaciones;
drop policy if exists "escuela_profesor_evaluaciones_select" on escuela_profesor_evaluaciones;
drop policy if exists "escuela_profesor_evaluaciones_insert" on escuela_profesor_evaluaciones;
drop policy if exists "escuela_profesor_evaluaciones_update" on escuela_profesor_evaluaciones;
drop policy if exists "escuela_profesor_evaluaciones_delete" on escuela_profesor_evaluaciones;

create policy "escuela_profesor_evaluaciones_select"
on escuela_profesor_evaluaciones for select
using (public.es_staff_de_jugador(profesor_id));

create policy "escuela_profesor_evaluaciones_insert"
on escuela_profesor_evaluaciones for insert
with check (public.es_staff_de_jugador(profesor_id));

create policy "escuela_profesor_evaluaciones_update"
on escuela_profesor_evaluaciones for update
using (public.es_staff_de_jugador(profesor_id))
with check (public.es_staff_de_jugador(profesor_id));

create policy "escuela_profesor_evaluaciones_delete"
on escuela_profesor_evaluaciones for delete
using (public.es_staff_de_jugador(profesor_id));


-- ============================================================
-- CHECKLIST MANUAL DE PRUEBAS (antes de dar por buena la migración)
-- ============================================================
--
-- A) Usuario público (logout / ventana privada, anon key):
--    [ ] /t/:id sigue mostrando torneo, equipos, partidos
--    [ ] Lectura de players vía players_publico (nombre/foto/ciudad) OK
--        — si TorneoPublicoPage aún embebe players(...), fallará hasta
--          migrar el frontend a players_publico
--    [ ] GET .../rest/v1/players?select=* → debe fallar (anon sin GRANT)
--    [ ] GET .../rest/v1/players_publico → OK (sin cédula/teléfonos)
--    [ ] GET .../rest/v1/torneo_finanzas → 0 filas / error RLS
--    [ ] INSERT en tournaments / matches → debe fallar
--
-- B) Organizador (roles_plataforma.rol='organizador'):
--    [ ] Ve y edita SU torneo (nombre, logo, partidos, equipos)
--    [ ] NO puede update/delete un torneo con otro organizador_id
--    [ ] Puede crear partido en su torneo; falla en torneo ajeno
--    [ ] Ve finanzas SOLO de su torneo
--    [ ] NO puede insertarse como admin en roles_plataforma
--
-- C) Admin (roles_plataforma.rol='admin'):
--    [ ] Acceso completo a torneos, players, finanzas, escenarios, escuelas
--    [ ] Puede crear/editar/borrar roles en AdminUsuariosPage
--    [ ] Puede ver cédulas (createSignedUrl — policies de migracion_rpc_registro)
--
-- D) Ataque roles_plataforma:
--    [ ] Con usuario organizador o jugador autenticado:
--        insert into roles_plataforma (email, rol) values ('hacker@x.com','admin')
--        vía REST → debe fallar (403 / RLS)
--    [ ] update roles_plataforma set rol='admin' where email='yo@...' → fallar
--        (salvo claim de user_id en la propia fila; trigger bloquea rol/plan/…)
--
-- E) Escenarios:
--    [ ] Encargado ve ventas/compras/pedidos de SUS escenarios
--    [ ] Encargado de A no ve datos de escenario B
--    [ ] Admin ve todos
--
-- F) Escuelas:
--    [ ] Profesor de escuela X ve asistencia/partidos de X
--    [ ] Profesor de X no ve datos de escuela Y
--    [ ] Acudiente ve solo sus vínculos en escuela_acudientes
--
-- G) Regresión general:
--    [ ] Consola del navegador: sin ráfaga nueva de 401/403 en pantallas
--        normales de admin, organizador, jugador, árbitro, escuela, escenario
--    [ ] Login admin sigue resolviendo rol (select roles_plataforma por email)
--    [ ] Claim de user_id al login sigue funcionando
--
-- H) Casos nuevos (post-RPC):
--    [ ] Un jugador (no admin/organizador) intenta UPDATE directo a
--        torneo_finanzas → debe fallar (RLS)
--    [ ] Un organizador intenta editar un torneo que no es suyo → debe fallar
--    [ ] Confirmar que jugador_tiene_deuda y buscar_jugador_por_cedula
--        (RPC security definer) siguen funcionando igual después de aplicar
--        esta migración (registro de equipo: búsqueda + aviso de deuda)
--    [ ] Flujo completo /registro/equipo y /registro/escuela sigue OK
--        (RPC + confirmar_cedula_urls + storage policies previas)
--
-- I) Bootstrap (si algo queda sin admin):
--    En SQL Editor como postgres:
--      select * from roles_plataforma where rol='admin';
--    Si vacío, insertar el admin a mano (bypasea RLS).
--
-- ============================================================
