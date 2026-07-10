-- ============================================================
-- MIGRACIÓN: Sincronización en vivo de la planilla (multi-celular)
-- Permite que, si el celular que está llenando la planilla se daña o
-- se apaga, otro árbitro asignado o el admin puedan entrar desde otro
-- celular y seguir exactamente donde iba: mismos datos, mismo cronómetro.
-- Cómo ejecutar: Supabase → SQL Editor → pegar todo → RUN
-- Es seguro ejecutarlo más de una vez.
-- ============================================================

alter table matches add column if not exists live_state            jsonb;
alter table matches add column if not exists live_state_updated_at timestamptz;
