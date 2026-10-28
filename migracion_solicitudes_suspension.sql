-- ============================================================
-- SOLICITUDES DE VETO DE GOLMEBOL (suspensión de toda la plataforma)
-- Cómo ejecutar: Supabase → SQL Editor → pegar todo → RUN
-- Es seguro ejecutarlo más de una vez.
--
-- Para qué sirve: un organizador solo puede suspender jugadores EN SU torneo.
-- Si quiere que un jugador quede vetado de TODA la plataforma (que no pueda
-- jugar ningún torneo de Golmebol), manda una solicitud a Golmebol con el
-- motivo, desde la página SUSPENSIONES. Golmebol (el administrador de la
-- plataforma) la aprueba o la rechaza.
--
-- Quién ve qué:
--   · Golmebol (administrador de la plataforma): todas las solicitudes
--   · un organizador: solo las que él mandó
-- ============================================================

create table if not exists public.solicitudes_suspension (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  tournament_id uuid references public.tournaments(id) on delete set null, -- torneo desde donde se pide
  solicitante_id uuid default auth.uid(),
  solicitante_nombre text,
  motivo text not null,
  meses_sugeridos int,                       -- null = sin definir / indefinida
  estado text not null default 'pendiente' check (estado in ('pendiente', 'aprobada', 'rechazada')),
  respuesta text,
  resuelta_por uuid,
  resuelta_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists solicitudes_suspension_estado_idx on public.solicitudes_suspension (estado, created_at desc);
create index if not exists solicitudes_suspension_solicitante_idx on public.solicitudes_suspension (solicitante_id);

alter table public.solicitudes_suspension enable row level security;

do $$
declare r record;
begin
  for r in select policyname from pg_policies
           where schemaname = 'public' and tablename = 'solicitudes_suspension'
  loop
    execute format('drop policy if exists %I on public.solicitudes_suspension', r.policyname);
  end loop;
end $$;

revoke all on public.solicitudes_suspension from anon;
grant select, insert, update, delete on public.solicitudes_suspension to authenticated;

-- Ver: el admin ve todas; cada organizador solo las suyas
create policy solic_susp_select on public.solicitudes_suspension
  for select to authenticated
  using (coalesce(public.es_admin_plataforma(), false) or solicitante_id = auth.uid());

-- Crear: admin u organizador de la plataforma, siempre a su nombre
create policy solic_susp_insert on public.solicitudes_suspension
  for insert to authenticated
  with check (
    solicitante_id = auth.uid()
    and (coalesce(public.es_admin_plataforma(), false) or coalesce(public.es_organizador_plataforma(), false))
  );

-- Aprobar / rechazar / borrar: solo Golmebol (administrador)
create policy solic_susp_update_admin on public.solicitudes_suspension
  for update to authenticated
  using (coalesce(public.es_admin_plataforma(), false))
  with check (coalesce(public.es_admin_plataforma(), false));

create policy solic_susp_delete_admin on public.solicitudes_suspension
  for delete to authenticated
  using (coalesce(public.es_admin_plataforma(), false));

-- Verificación
select count(*) as solicitudes from public.solicitudes_suspension;

-- ROLLBACK (solo si algo sale mal): quita el "--" y ejecuta
-- drop table if exists public.solicitudes_suspension;
