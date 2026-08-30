-- ============================================================
-- Foto del equipo que se presentó cuando un partido queda por W
-- (Planilla Rápida y Planilla Completa)
--
-- Guarda la URL pública de la foto del equipo que sí se presentó, tomada
-- desde la cámara del celular al marcar el partido como "Por W". Se
-- reutiliza el bucket 'teams' que ya existe y ya tiene sus políticas de
-- storage (mismo patrón usado hoy para fotos de facturas, uniformes, etc.
-- dentro de ese bucket) — no hace falta crear un bucket nuevo.
--
-- Cómo ejecutar: Supabase → SQL Editor → pegar todo → RUN
-- Es seguro ejecutarlo más de una vez.
-- ============================================================

alter table matches add column if not exists foto_w_url text;
