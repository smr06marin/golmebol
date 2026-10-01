-- Agrega la columna que marca cuándo alguien (organizador/árbitro/admin)
-- debe cambiar su contraseña — se prende sola cuando un admin le resetea
-- la contraseña a esa persona desde "Usuarios y permisos", y se apaga sola
-- en cuanto esa persona la cambia por una propia desde el panel.
alter table roles_plataforma add column if not exists debe_cambiar_password boolean default false;
