-- Imagen propia para la "repetición" del gol que sale encima del video en
-- vivo de la portada (golmebol.com) — cada patrocinador puede tener su
-- propia imagen diseñada para esto (distinta del logo chiquito del banner
-- rotativo), que entra y sale con transición justo antes de mostrar otra
-- vez la jugada del gol.
alter table patrocinadores_golmebol add column if not exists imagen_repeticion_url text;
