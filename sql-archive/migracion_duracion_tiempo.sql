-- ============================================================
-- MIGRACIÓN: Duración de cada tiempo por torneo
--
-- Antes el cronómetro de la planilla usaba un valor fijo según la
-- modalidad (Fútbol 5: 20 min, Fútbol 7: 25 min, Fútbol 11: 45 min) sin
-- forma de cambiarlo. Con esta columna, al crear o editar un torneo se
-- puede indicar cuántos minutos dura cada tiempo — si se deja vacío, sigue
-- usando el valor típico de la modalidad como antes.
--
-- Cómo ejecutar: Supabase → SQL Editor → pegar todo → RUN
-- Es seguro ejecutarlo más de una vez.
-- ============================================================

alter table tournaments add column if not exists duracion_tiempo_min integer;
