-- ============================================================
-- MIGRACIÓN: bloquear/activar un escenario por meses
--
-- El admin principal puede activar un escenario por X meses (como ya se
-- hace con árbitros/profesores/encargados) o bloquearlo de una. Si está
-- bloqueado o vencido, el portal del encargado y la página pública de
-- reservas dejan de funcionar hasta que se reactive.
--
-- Cómo ejecutar: Supabase → SQL Editor → pegar todo → RUN
-- Es seguro ejecutarlo más de una vez.
-- ============================================================

alter table escenarios add column if not exists activo boolean not null default true;
alter table escenarios add column if not exists fecha_vencimiento timestamptz;
alter table escenarios add column if not exists meses_pagados integer not null default 0;

comment on column escenarios.activo             is 'Si está en false, el escenario queda bloqueado sin importar la fecha de vencimiento.';
comment on column escenarios.fecha_vencimiento   is 'Hasta cuándo tiene acceso activo. NULL = sin fecha (queda a criterio de "activo").';
comment on column escenarios.meses_pagados       is 'Acumulado informativo de meses activados en total.';
