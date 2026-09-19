-- ============================================================
-- MIGRACIÓN: Contacto y redes sociales del organizador (vitrina)
-- Cómo ejecutar: Supabase → SQL Editor → pegar todo → RUN
-- Es seguro ejecutarlo más de una vez.
--
-- Complemento de migracion_organizador_perfil.sql — agrega los campos que
-- necesita el rediseño de la vitrina (descripción del hero, WhatsApp,
-- correo, dirección y redes sociales para el footer/pie de página).
-- ============================================================

alter table organizador_perfiles add column if not exists descripcion   text;
alter table organizador_perfiles add column if not exists whatsapp      text;
alter table organizador_perfiles add column if not exists email        text;
alter table organizador_perfiles add column if not exists direccion    text;
alter table organizador_perfiles add column if not exists facebook_url  text;
alter table organizador_perfiles add column if not exists instagram_url text;
alter table organizador_perfiles add column if not exists tiktok_url    text;

comment on column organizador_perfiles.descripcion is 'Texto corto debajo del título en la vitrina (hero).';
