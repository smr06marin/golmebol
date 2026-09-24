-- Imágenes para la repetición del gol (ver LiveEmbed/LandingPage): en vez de
-- una imagen por patrocinador, ahora se suben desde /admin/config-sitio,
-- junto con el link de la transmisión en vivo — se puede subir varias y van
-- rotando en orden cada vez que el árbitro anota un gol.
-- Cada elemento del arreglo es: { id, url }
--
-- (La columna imagen_repeticion_url que se había agregado a
-- patrocinadores_golmebol en migracion_patrocinadores_imagen_repeticion.sql
-- ya no se usa — se deja tal cual si ya la corriste, no hace falta quitarla.)
alter table site_config add column if not exists en_vivo_repeticion_imagenes jsonb default '[]'::jsonb;
