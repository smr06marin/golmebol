-- ============================================================
-- PATROCINADORES — TODO EN UNO (tabla + banners + video + almacenamiento)
-- Cómo ejecutar: Supabase → SQL Editor → pegar TODO → RUN.
-- Es seguro ejecutarlo más de una vez, y no borra ni cambia lo que ya existe.
-- Sirve aunque nunca hayas creado la tabla de patrocinadores.
--
-- Qué deja listo:
--  1. La tabla patrocinadores_golmebol (si no existía).
--  2. Las columnas banners (lista de imágenes) y video_url (video corto).
--  3. El almacenamiento "patrocinadores" para logos, banners Y VIDEOS:
--     imágenes de hasta 5 MB y videos de hasta 50 MB (límite del plan gratis).
-- ============================================================

-- 1. Tabla
create table if not exists public.patrocinadores_golmebol (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null,
  logo_url    text,
  whatsapp    text,
  direccion   text,
  facebook    text,
  instagram   text,
  tiktok      text,
  activo      boolean not null default true,
  orden       integer not null default 0,
  created_at  timestamptz default now()
);
create index if not exists idx_patrocinadores_golmebol_orden on public.patrocinadores_golmebol(orden);
alter table public.patrocinadores_golmebol disable row level security;

-- 2. Columnas nuevas
alter table public.patrocinadores_golmebol add column if not exists banners   text[] not null default '{}';
alter table public.patrocinadores_golmebol add column if not exists video_url text;

-- 3. Almacenamiento (el bucket de antes solo aceptaba imágenes de 5 MB: aquí se amplía para videos)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'patrocinadores', 'patrocinadores', true,
  52428800, -- 50 MB
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml',
        'video/mp4', 'video/webm', 'video/quicktime']
)
on conflict (id) do update
  set public = true,
      file_size_limit = 52428800,
      allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml',
                                 'video/mp4', 'video/webm', 'video/quicktime'];

drop policy if exists "patrocinadores_select" on storage.objects;
create policy "patrocinadores_select"
on storage.objects for select
using (bucket_id = 'patrocinadores');

drop policy if exists "patrocinadores_insert" on storage.objects;
create policy "patrocinadores_insert"
on storage.objects for insert
with check (bucket_id = 'patrocinadores' and auth.role() = 'authenticated');

drop policy if exists "patrocinadores_update" on storage.objects;
create policy "patrocinadores_update"
on storage.objects for update
using (bucket_id = 'patrocinadores' and auth.role() = 'authenticated');

drop policy if exists "patrocinadores_delete" on storage.objects;
create policy "patrocinadores_delete"
on storage.objects for delete
using (bucket_id = 'patrocinadores' and auth.role() = 'authenticated');

-- Refresca la lista de tablas de la API para que reconozca la tabla y columnas nuevas
notify pgrst, 'reload schema';
