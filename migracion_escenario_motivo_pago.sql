-- Permite anotar por qué un equipo pagó menos del valor de la cancha
-- (descuento, cliente frecuente, error, etc.) cuando se edita el pago de
-- una reserva ya programada.
alter table escenario_reservas add column if not exists motivo_pago text;

comment on column escenario_reservas.motivo_pago is 'Razón por la que se pagó menos del valor de la cancha, si aplica';
