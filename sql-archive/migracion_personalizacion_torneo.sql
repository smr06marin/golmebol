-- ============================================================
-- MIGRACIÓN: Personalización visual / dominio por torneo
-- Cómo ejecutar: Supabase → SQL Editor → pegar todo → RUN
-- Es seguro ejecutarlo más de una vez.
--
-- Agrega a "tournaments" los campos de branding (colores, favicon,
-- dominio personalizado). logo_url YA existe en la tabla — no se toca.
-- También crea el bucket de Storage "torneo-branding" (público en lectura)
-- para logos/favicons/sponsors de torneo.
-- ============================================================

-- 1. Columnas de personalización (solo las que faltan)
alter table tournaments
  add column if not exists custom_domain text;

alter table tournaments
  add column if not exists color_primario text;

alter table tournaments
  add column if not exists color_secundario text;

-- logo_url ya existe en tournaments (se usa en admin y página pública) — no se agrega.

alter table tournaments
  add column if not exists favicon_url text;

-- Dominio único (varios NULL están permitidos en un índice UNIQUE de Postgres)
create unique index if not exists idx_tournaments_custom_domain
  on tournaments (custom_domain);

comment on column tournaments.custom_domain is
  'Dominio personalizado del torneo (ej. mitorneo.com). Nullable y único.';
comment on column tournaments.color_primario is
  'Color primario de branding del torneo en hex (ej. #1a73e8).';
comment on column tournaments.color_secundario is
  'Color secundario de branding del torneo en hex.';
comment on column tournaments.favicon_url is
  'URL pública del favicon del torneo (bucket torneo-branding).';

-- 2. Bucket Storage para assets de branding del torneo
--    (lectura pública; escritura autenticada — mismo estilo que otros buckets)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'torneo-branding',
  'torneo-branding',
  true,
  5242880, -- 5 MB
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml', 'image/x-icon', 'image/vnd.microsoft.icon']
)
on conflict (id) do update set public = true;

drop policy if exists "torneo_branding_select" on storage.objects;
create policy "torneo_branding_select"
on storage.objects for select
using (bucket_id = 'torneo-branding');

drop policy if exists "torneo_branding_insert" on storage.objects;
create policy "torneo_branding_insert"
on storage.objects for insert
with check (bucket_id = 'torneo-branding' and auth.role() = 'authenticated');

drop policy if exists "torneo_branding_update" on storage.objects;
create policy "torneo_branding_update"
on storage.objects for update
using (bucket_id = 'torneo-branding' and auth.role() = 'authenticated');

drop policy if exists "torneo_branding_delete" on storage.objects;
create policy "torneo_branding_delete"
on storage.objects for delete
using (bucket_id = 'torneo-branding' and auth.role() = 'authenticated');
