-- ============================================================
-- MIGRACIÓN: Patrocinadores por torneo (tournament_sponsors)
-- Cómo ejecutar: Supabase → SQL Editor → pegar todo → RUN
-- Es seguro ejecutarlo más de una vez.
--
-- NO toca la tabla "sponsors" (esa es para tarjetas de jugador).
--
-- Nota sobre permisos: la tabla "tournaments" en Golmebol NO tiene RLS
-- estricto (el acceso se filtra en la app con organizador_id / roles).
-- Acá se traduce ese mismo criterio a políticas SQL:
--   - lectura pública (página del torneo)
--   - escritura solo admin (roles_plataforma.rol = 'admin') o el
--     organizador dueño (tournaments.organizador_id = auth.uid())
-- ============================================================

create table if not exists tournament_sponsors (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  nombre        text not null,
  logo_url      text,
  link          text,
  orden         int not null default 0,
  created_at    timestamptz not null default now()
);

create index if not exists idx_tournament_sponsors_tournament
  on tournament_sponsors (tournament_id);

create index if not exists idx_tournament_sponsors_orden
  on tournament_sponsors (tournament_id, orden);

comment on table tournament_sponsors is
  'Patrocinadores del torneo (branding de la página pública). Distinto de "sponsors" (tarjetas de jugador).';

alter table tournament_sponsors enable row level security;

-- Lectura pública (página del torneo, sin auth)
drop policy if exists "tournament_sponsors_select" on tournament_sponsors;
create policy "tournament_sponsors_select"
on tournament_sponsors for select
using (true);

-- Escritura: admin de plataforma O organizador dueño del torneo
drop policy if exists "tournament_sponsors_insert" on tournament_sponsors;
create policy "tournament_sponsors_insert"
on tournament_sponsors for insert
with check (
  exists (
    select 1 from roles_plataforma rp
    where rp.activo is not false
      and rp.rol = 'admin'
      and (
        rp.user_id = auth.uid()
        or lower(rp.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      )
  )
  or exists (
    select 1 from tournaments t
    where t.id = tournament_id
      and t.organizador_id = auth.uid()
  )
);

drop policy if exists "tournament_sponsors_update" on tournament_sponsors;
create policy "tournament_sponsors_update"
on tournament_sponsors for update
using (
  exists (
    select 1 from roles_plataforma rp
    where rp.activo is not false
      and rp.rol = 'admin'
      and (
        rp.user_id = auth.uid()
        or lower(rp.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      )
  )
  or exists (
    select 1 from tournaments t
    where t.id = tournament_sponsors.tournament_id
      and t.organizador_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from roles_plataforma rp
    where rp.activo is not false
      and rp.rol = 'admin'
      and (
        rp.user_id = auth.uid()
        or lower(rp.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      )
  )
  or exists (
    select 1 from tournaments t
    where t.id = tournament_id
      and t.organizador_id = auth.uid()
  )
);

drop policy if exists "tournament_sponsors_delete" on tournament_sponsors;
create policy "tournament_sponsors_delete"
on tournament_sponsors for delete
using (
  exists (
    select 1 from roles_plataforma rp
    where rp.activo is not false
      and rp.rol = 'admin'
      and (
        rp.user_id = auth.uid()
        or lower(rp.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      )
  )
  or exists (
    select 1 from tournaments t
    where t.id = tournament_sponsors.tournament_id
      and t.organizador_id = auth.uid()
  )
);
