-- ============================================================
-- CHAT DE AYUDA — fotos y videos en la conversación
-- Cómo ejecutar: Supabase → SQL Editor → pegar TODO → RUN. Es seguro repetirlo.
--
--  * soporte_mensajes: columnas adjunto_path / adjunto_tipo; el texto puede ir vacío si hay adjunto.
--  * Bucket PRIVADO "soporte-adjuntos" (máx. 50 MB por archivo; fotos jpg/png/webp y videos mp4/mov/webm).
--    Los archivos se guardan en  <id del chat>/<uuid>.<ext>.  Solo el dueño del chat puede VERLOS;
--    para subirlos, el servidor le da un permiso temporal (/api/soporte-adjunto).
-- ROLLBACK (al final, comentado).
-- ============================================================
alter table public.soporte_mensajes add column if not exists adjunto_path text;
alter table public.soporte_mensajes add column if not exists adjunto_tipo text;

alter table public.soporte_mensajes drop constraint if exists soporte_mensajes_adjunto_tipo_check;
alter table public.soporte_mensajes add constraint soporte_mensajes_adjunto_tipo_check
  check (adjunto_tipo is null or adjunto_tipo in ('imagen', 'video'));

-- El texto ya no es obligatorio cuando el mensaje trae foto o video
alter table public.soporte_mensajes drop constraint if exists soporte_mensajes_texto_check;
alter table public.soporte_mensajes drop constraint if exists soporte_mensajes_contenido_check;
alter table public.soporte_mensajes add constraint soporte_mensajes_contenido_check
  check (char_length(texto) <= 2000 and (char_length(texto) >= 1 or adjunto_path is not null));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('soporte-adjuntos', 'soporte-adjuntos', false, 52428800,
        array['image/jpeg','image/png','image/webp','video/mp4','video/quicktime','video/webm'])
on conflict (id) do update
  set public = false, file_size_limit = 52428800,
      allowed_mime_types = array['image/jpeg','image/png','image/webp','video/mp4','video/quicktime','video/webm'];

drop policy if exists "soporte_adjuntos_leer" on storage.objects;
create policy "soporte_adjuntos_leer" on storage.objects
  for select to authenticated
  using (bucket_id = 'soporte-adjuntos'
         and exists (select 1 from public.soporte_chats c
                     where c.user_id = auth.uid() and c.id::text = (storage.foldername(name))[1]));

-- ROLLBACK:
--   drop policy if exists "soporte_adjuntos_leer" on storage.objects;
--   (los archivos se borran desde Storage → soporte-adjuntos; luego: delete from storage.buckets where id = 'soporte-adjuntos';)
--   alter table public.soporte_mensajes drop column if exists adjunto_path, drop column if exists adjunto_tipo;
