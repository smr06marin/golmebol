-- ============================================================
-- MIGRACIÓN: Vencimiento del link de registro de jugadores (24h)
-- Cada vez que el admin/coordinador comparte el link de registro de un
-- equipo, se guarda la hora en que se envió. El link deja de servir para
-- inscribir jugadores 24 horas después — el equipo debe pedir que se lo
-- vuelvan a compartir.
-- Cómo ejecutar: Supabase → SQL Editor → pegar todo → RUN
-- Es seguro ejecutarlo más de una vez.
-- ============================================================

alter table teams add column if not exists registro_token_generado_en timestamptz;
