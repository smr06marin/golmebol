-- Logos de patrocinador para la transmisión en vivo, guardados POR TORNEO
-- (no por transmisión ni por partido) — porque los mismos patrocinadores se
-- repiten partido tras partido de un mismo torneo. Se suben de a uno, sin
-- límite de cuántos, y cada uno guarda su propia posición y tamaño (x, y,
-- ancho, todo en % del video) elegidos a mano arrastrando en el panel de
-- control de /admin/config-sitio.
--
-- Forma: { [tournamentId]: [ { id, url, nombre, x, y, ancho } ] }
--
-- Esto es solo la BIBLIOTECA de logos y su posición guardada — cuáles de
-- esos logos están prendidos AHORA MISMO en una transmisión puntual es otra
-- cosa, aparte, guardada por transmisión en en_vivo_control.logos_activos
-- (ver migracion_en_vivo_control.sql), no acá.
alter table site_config
  add column if not exists patrocinador_logos_torneo jsonb not null default '{}'::jsonb;
