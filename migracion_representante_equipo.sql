-- ============================================================
-- MIGRACIÓN: Representante (dueño) del equipo
-- Cómo ejecutar: Supabase → SQL Editor → pegar todo → RUN
-- Es seguro ejecutarlo más de una vez.
-- ============================================================

alter table teams add column if not exists representante_nombre    text;
alter table teams add column if not exists representante_telefono  text;
