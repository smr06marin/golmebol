-- Límite de jugadores por equipo, configurable por torneo (opcional).
-- null = sin límite. Se pone al crear el torneo o luego desde "Editar
-- torneo", y aplica igual para todos los equipos inscritos.
alter table tournaments add column if not exists limite_jugadores_equipo integer;

comment on column tournaments.limite_jugadores_equipo is
  'Máximo de jugadores activos por equipo en este torneo (null = sin límite)';
