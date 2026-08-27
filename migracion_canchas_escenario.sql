-- ============================================================
-- MIGRACIÓN: Agrupar canchas del torneo por escenario/sede
-- Cómo ejecutar: Supabase → SQL Editor → pegar → RUN
-- Es seguro ejecutarlo más de una vez.
--
-- "canchas" acá es la lista simple de canchas de UN torneo (Torneo →
-- Partidos → Canchas), no tiene nada que ver con el módulo de "Escenarios
-- Deportivos" (el negocio de alquiler de canchas). Se le agrega un campo
-- de texto libre "escenario" para poder agrupar, por ejemplo, "Cancha 1" y
-- "Cancha 2" bajo "Centegol", y "Cancha A" bajo "El Gol" — así, al generar
-- la jornada automática, se puede elegir en qué sede(s) y con cuántas
-- canchas jugar esa semana.
-- ============================================================

alter table canchas add column if not exists escenario text;
