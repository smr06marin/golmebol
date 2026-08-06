-- Dirección del escenario, para mostrar el mapa en la página pública de
-- reservas (nuevo diseño estilo landing page).
alter table escenarios add column if not exists direccion text;
