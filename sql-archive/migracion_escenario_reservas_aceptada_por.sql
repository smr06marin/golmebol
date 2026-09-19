-- ============================================================
-- MIGRACIÓN: quién aceptó cada reserva de cancha
--
-- Cómo ejecutar: Supabase → SQL Editor → pegar todo → RUN
-- Es seguro ejecutarlo más de una vez.
-- ============================================================

alter table escenario_reservas add column if not exists aceptada_por uuid references players(id) on delete set null;
alter table escenario_reservas add column if not exists aceptada_por_nombre text;

comment on column escenario_reservas.aceptada_por         is 'Encargado (players.id) que aceptó la solicitud de reserva.';
comment on column escenario_reservas.aceptada_por_nombre  is 'Nombre del encargado que aceptó, guardado aparte para no depender de un join.';
