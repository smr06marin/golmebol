-- ============================================================
-- MIGRACIÓN: Etiquetas de jugador referente (por equipo)
--
-- Permite marcar en cada jugador si es "Mayor de 35", "Élite" o
-- "Profesional" — así cada equipo, al ver su plantilla, puede identificar
-- de un vistazo cuáles son sus jugadores referentes.
--
-- Cómo ejecutar: Supabase → SQL Editor → pegar todo → RUN
-- Es seguro ejecutarlo más de una vez.
-- ============================================================

alter table players add column if not exists es_mayor_35   boolean not null default false;
alter table players add column if not exists es_elite      boolean not null default false;
alter table players add column if not exists es_profesional boolean not null default false;
