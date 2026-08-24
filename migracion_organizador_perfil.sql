-- ============================================================
-- MIGRACIÓN: Perfil de organizador (dominio propio + vitrina)
-- Cómo ejecutar: Supabase → SQL Editor → pegar todo → RUN
-- Es seguro ejecutarlo más de una vez.
--
-- Un organizador puede tener VARIOS torneos (tournaments.organizador_id).
-- Esto agrega un perfil por organizador con su propio dominio, logo,
-- favicon y patrocinadores — una página "vitrina" que lista todos sus
-- torneos, servida desde su propio dominio pero manejada 100% desde
-- Golmebol (mismo patrón que migracion_personalizacion_torneo.sql, que ya
-- hace esto por torneo individual — esto es lo mismo pero a nivel de
-- organizador, para que un solo dominio junte todos sus torneos).
-- ============================================================

-- 1. Perfil del organizador (1 fila por organizador_id)
create table if not exists organizador_perfiles (
  id                uuid primary key default gen_random_uuid(),
  organizador_id    uuid not null unique,
  nombre_publico    text,
  custom_domain     text unique,
  logo_url          text,
  favicon_url       text,
  color_primario    text,
  color_secundario  text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on table organizador_perfiles is
  'Branding + dominio propio del organizador (vitrina con todos sus torneos). 1 fila por organizador_id (auth.uid()).';
comment on column organizador_perfiles.custom_domain is
  'Dominio propio del organizador (ej. mievento.com). Nullable y único. Distinto del custom_domain por torneo (tournaments.custom_domain).';

-- 2. Patrocinadores del organizador (se muestran en toda su vitrina, no solo un torneo)
create table if not exists organizador_sponsors (
  id              uuid primary key default gen_random_uuid(),
  organizador_id  uuid not null,
  nombre          text not null,
  logo_url        text,
  link            text,
  orden           int not null default 0,
  created_at      timestamptz not null default now()
);

create index if not exists idx_organizador_sponsors_organizador
  on organizador_sponsors (organizador_id, orden);

comment on table organizador_sponsors is
  'Patrocinadores del organizador (branding de su vitrina). Distinto de tournament_sponsors (por torneo individual).';

-- 3. RLS — mismo criterio que tournament_sponsors: lectura pública (la
--    vitrina la ve cualquier visitante sin login), escritura solo admin de
--    plataforma o el propio organizador dueño del perfil.
alter table organizador_perfiles enable row level security;
alter table organizador_sponsors enable row level security;

drop policy if exists "organizador_perfiles_select" on organizador_perfiles;
create policy "organizador_perfiles_select"
on organizador_perfiles for select
using (true);

drop policy if exists "organizador_perfiles_insert" on organizador_perfiles;
create policy "organizador_perfiles_insert"
on organizador_perfiles for insert
with check (
  organizador_id = auth.uid()
  or exists (
    select 1 from roles_plataforma rp
    where rp.activo is not false and rp.rol = 'admin'
      and (rp.user_id = auth.uid() or lower(rp.email) = lower(coalesce(auth.jwt() ->> 'email', '')))
  )
);

drop policy if exists "organizador_perfiles_update" on organizador_perfiles;
create policy "organizador_perfiles_update"
on organizador_perfiles for update
using (
  organizador_id = auth.uid()
  or exists (
    select 1 from roles_plataforma rp
    where rp.activo is not false and rp.rol = 'admin'
      and (rp.user_id = auth.uid() or lower(rp.email) = lower(coalesce(auth.jwt() ->> 'email', '')))
  )
)
with check (
  organizador_id = auth.uid()
  or exists (
    select 1 from roles_plataforma rp
    where rp.activo is not false and rp.rol = 'admin'
      and (rp.user_id = auth.uid() or lower(rp.email) = lower(coalesce(auth.jwt() ->> 'email', '')))
  )
);

drop policy if exists "organizador_sponsors_select" on organizador_sponsors;
create policy "organizador_sponsors_select"
on organizador_sponsors for select
using (true);

drop policy if exists "organizador_sponsors_insert" on organizador_sponsors;
create policy "organizador_sponsors_insert"
on organizador_sponsors for insert
with check (
  organizador_id = auth.uid()
  or exists (
    select 1 from roles_plataforma rp
    where rp.activo is not false and rp.rol = 'admin'
      and (rp.user_id = auth.uid() or lower(rp.email) = lower(coalesce(auth.jwt() ->> 'email', '')))
  )
);

drop policy if exists "organizador_sponsors_update" on organizador_sponsors;
create policy "organizador_sponsors_update"
on organizador_sponsors for update
using (
  organizador_id = auth.uid()
  or exists (
    select 1 from roles_plataforma rp
    where rp.activo is not false and rp.rol = 'admin'
      and (rp.user_id = auth.uid() or lower(rp.email) = lower(coalesce(auth.jwt() ->> 'email', '')))
  )
)
with check (
  organizador_id = auth.uid()
  or exists (
    select 1 from roles_plataforma rp
    where rp.activo is not false and rp.rol = 'admin'
      and (rp.user_id = auth.uid() or lower(rp.email) = lower(coalesce(auth.jwt() ->> 'email', '')))
  )
);

drop policy if exists "organizador_sponsors_delete" on organizador_sponsors;
create policy "organizador_sponsors_delete"
on organizador_sponsors for delete
using (
  organizador_id = auth.uid()
  or exists (
    select 1 from roles_plataforma rp
    where rp.activo is not false and rp.rol = 'admin'
      and (rp.user_id = auth.uid() or lower(rp.email) = lower(coalesce(auth.jwt() ->> 'email', '')))
  )
);

-- 4. Bucket de Storage para logo/favicon/sponsors del organizador
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'organizador-branding',
  'organizador-branding',
  true,
  5242880, -- 5 MB
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml', 'image/x-icon', 'image/vnd.microsoft.icon']
)
on conflict (id) do update set public = true;

drop policy if exists "organizador_branding_select" on storage.objects;
create policy "organizador_branding_select"
on storage.objects for select
using (bucket_id = 'organizador-branding');

drop policy if exists "organizador_branding_insert" on storage.objects;
create policy "organizador_branding_insert"
on storage.objects for insert
with check (bucket_id = 'organizador-branding' and auth.role() = 'authenticated');

drop policy if exists "organizador_branding_update" on storage.objects;
create policy "organizador_branding_update"
on storage.objects for update
using (bucket_id = 'organizador-branding' and auth.role() = 'authenticated');

drop policy if exists "organizador_branding_delete" on storage.objects;
create policy "organizador_branding_delete"
on storage.objects for delete
using (bucket_id = 'organizador-branding' and auth.role() = 'authenticated');
