-- Vincula el video de "en vivo" de la portada (site_config) con el partido
-- que se está transmitiendo, para poder mostrar su marcador (el mismo que
-- ya sube en tiempo real la planilla del árbitro) como una barra encima
-- del video en golmebol.com — igual que el "score bug" de un canal
-- deportivo. Se elige a mano desde /admin/config-sitio, no se adivina solo,
-- porque puede haber varios partidos en vivo a la vez en distintos torneos.
alter table site_config add column if not exists en_vivo_match_id uuid references matches(id) on delete set null;
