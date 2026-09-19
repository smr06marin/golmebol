-- ============================================================
-- MIGRACIÓN: Enlazar un escenario (cancha) a la vitrina del organizador
-- Cómo ejecutar: Supabase → SQL Editor → pegar todo → RUN
-- Es seguro ejecutarlo más de una vez.
--
-- Complemento de migracion_organizador_perfil.sql — agrega el campo para
-- que la vitrina del organizador (dominio propio con todos sus torneos)
-- también muestre un botón "Reservar cancha" que lleve al escenario que
-- el organizador tenga en el módulo de Escenarios Deportivos. Es opcional
-- y no tiene ninguna relación automática (los "encargados" de escenario
-- se identifican por cédula, no por la cuenta de organizador de torneos),
-- por eso se enlaza a mano desde "Mi dominio".
-- ============================================================

alter table organizador_perfiles
  add column if not exists escenario_id uuid references escenarios(id) on delete set null;

comment on column organizador_perfiles.escenario_id is
  'Escenario (cancha) que se muestra con un botón "Reservar cancha" en la vitrina del organizador. Opcional, se elige a mano.';
