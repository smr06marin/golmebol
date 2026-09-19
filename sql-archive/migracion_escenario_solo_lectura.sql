-- Permite dar acceso a un escenario en modo "solo lectura": la persona
-- puede entrar y ver todas las secciones (canchas, ventas, inventario,
-- compras, gastos, informe diario, reportes, actividad, quién reservó
-- cada cancha con su nombre y teléfono, etc.) pero no puede crear, editar,
-- eliminar ni registrar nada.
alter table escenario_encargados add column if not exists solo_lectura boolean default false;

comment on column escenario_encargados.solo_lectura is 'Si es true, esta persona solo puede ver el escenario, no editar nada';
