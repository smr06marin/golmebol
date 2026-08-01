-- ============================================================
-- FIX: RLS quedó activado en escenario_encargados
--
-- Supabase prende Row Level Security solo en las tablas nuevas si no
-- se desactiva explícitamente. Esta tabla ya tenía el "disable" en su
-- migración original (migracion_escenario_encargados.sql) pero por lo
-- visto no llegó a aplicarse — este script solo repite esa línea, es
-- seguro correrlo aunque ya esté desactivado.
--
-- Cómo ejecutar: Supabase → SQL Editor → pegar todo → RUN
-- ============================================================

alter table escenario_encargados disable row level security;
