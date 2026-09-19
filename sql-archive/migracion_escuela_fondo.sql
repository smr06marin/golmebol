-- ============================================================
-- MIGRACIÓN: Imagen de fondo para la página pública de la escuela
--
-- El coordinador de una escuela ahora puede subir una imagen de fondo
-- que se muestra en la página pública de registro de jugadores
-- (/registro/escuela/:id), además de poder editar el nombre, la
-- categoría, la ciudad y los datos del representante desde su portal.
--
-- Cómo ejecutar: Supabase → SQL Editor → pegar todo → RUN
-- Es seguro ejecutarlo más de una vez.
-- ============================================================

alter table teams add column if not exists imagen_fondo_url text;

comment on column teams.imagen_fondo_url is 'Imagen de fondo de la página pública de la escuela (registro de jugadores).';
