-- Portada de la página de inicio (la imagen de fondo de la parte de arriba de golmebol.com).
-- Se sube desde /admin/patrocinadores → "Portada de la página de inicio".
-- Guarda { "url": "https://…/portada/inicio_123.jpg" } en la fila única de site_config.
-- Si no hay portada guardada, la página de inicio usa el diseño oscuro de siempre.
alter table site_config add column if not exists portada_inicio jsonb;
