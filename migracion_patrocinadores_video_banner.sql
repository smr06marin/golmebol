-- ============================================================
-- PUBLICIDAD DE LAS TRANSMISIONES — almacenamiento para logos, banners y VIDEOS
-- Cómo ejecutar: Supabase → SQL Editor → pegar TODO → RUN.
-- Es seguro ejecutarlo más de una vez. No toca ninguna tabla ni dato existente.
--
-- Los patrocinadores de cada transmisión (nombre, logo, banners y video) se guardan
-- junto al panel de control de ESA transmisión, así que NO hace falta ninguna tabla.
-- Lo único que se necesita es que el almacenamiento "patrocinadores" acepte:
--   · imágenes de hasta 5 MB (logos y banners) y
--   · videos de hasta 50 MB (MP4, WebM, MOV — 50 MB es el máximo del plan gratis).
-- (El almacenamiento viejo solo aceptaba imágenes de 5 MB.)
-- ============================================================

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
