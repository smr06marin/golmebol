-- ============================================================
-- ASISTENTE AUTOMÁTICO DEL CHAT DE AYUDA
-- Cómo ejecutar: Supabase → SQL Editor → pegar TODO → RUN. Es seguro repetirlo.
-- Importante: córrelo ANTES de subir el código nuevo.
--
-- Marca con "automatico" las respuestas que da el asistente solo (con datos de Golmebol),
-- para mostrarlas como "Asistente automático" y no con el nombre de una persona.
-- ROLLBACK: alter table public.soporte_mensajes drop column if exists automatico;
-- ============================================================
alter table public.soporte_mensajes add column if not exists automatico boolean not null default false;
