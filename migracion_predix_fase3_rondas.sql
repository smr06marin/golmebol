-- ============================================================
-- MIGRACIÓN: Predix Golmebol — Fase 3 (rondas + notificación)
--
-- - Agrega `notificado_at` a predix_rondas: guarda cuándo se mandó
--   la notificación masiva de apertura a los jugadores (para que el
--   admin vea si ya se envió y pueda reenviarla si quiere).
-- - No hace falta crear la tabla player_notifications: ya existe en
--   Supabase (se usa hoy para avisos de "nueva tarjeta" en
--   PlayerHomePage.jsx) y se reutiliza aquí con tipo='predix_ronda'.
--
-- Cómo ejecutar: Supabase → SQL Editor → pegar todo → RUN
-- Es seguro ejecutarlo más de una vez.
-- ============================================================

alter table predix_rondas add column if not exists notificado_at timestamptz;
