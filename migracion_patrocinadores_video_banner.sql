-- ============================================================
-- PATROCINADORES: banners y video para las transmisiones en vivo
-- Cómo ejecutar: Supabase → SQL Editor → pegar todo → RUN.
-- Es seguro ejecutarlo más de una vez. No toca los datos que ya existen.
--
-- Agrega dos columnas a patrocinadores_golmebol:
--   banners   lista de imágenes (URL) del patrocinador. Al apretar "Banner" en el
--             panel de la transmisión salen todas, una detrás de otra.
--   video_url video corto del patrocinador (grande en el descanso, pequeño
--             en una esquina mientras se juega).
-- Los archivos se guardan en el mismo almacenamiento "patrocinadores" que ya usan los logos.
-- Un video puede pesar hasta 50 MB (límite de Supabase en el plan gratis).
-- ============================================================
alter table public.patrocinadores_golmebol add column if not exists banners   text[] not null default '{}';
alter table public.patrocinadores_golmebol add column if not exists video_url text;
