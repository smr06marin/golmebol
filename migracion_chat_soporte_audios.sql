-- ============================================================
-- CHAT DE AYUDA — audios (notas de voz y archivos de audio)
-- Cómo ejecutar: Supabase → SQL Editor → pegar TODO → RUN. Es seguro repetirlo.
-- (Corre ANTES la migración de fotos y videos: migracion_chat_soporte_adjuntos.sql)
-- ============================================================
alter table public.soporte_mensajes drop constraint if exists soporte_mensajes_adjunto_tipo_check;
alter table public.soporte_mensajes add constraint soporte_mensajes_adjunto_tipo_check
  check (adjunto_tipo is null or adjunto_tipo in ('imagen', 'video', 'audio'));

update storage.buckets
   set allowed_mime_types = array['image/jpeg','image/png','image/webp',
                                  'video/mp4','video/quicktime','video/webm',
                                  'audio/mp4','audio/x-m4a','audio/mpeg','audio/aac','audio/webm','audio/ogg']
 where id = 'soporte-adjuntos';
