-- Bracket fijo de eliminatorias: agrega una columna para la posición ("casilla")
-- de cada partido dentro de su fase (0, 1, 2...). Antes el árbol reordenaba a
-- TODOS los ganadores de una ronda por su posición en la tabla de grupos para
-- armar la ronda siguiente (esperando a que la ronda completa terminara).
-- Ahora cada partido tiene una casilla fija: el ganador de la casilla 0 y el
-- de la casilla 1 arman la casilla 0 de la ronda siguiente, el de la 2 y la 3
-- arman la casilla 1, etc. — y avanza apenas se sabe, sin esperar a los demás
-- partidos de esa ronda.
--
-- Es seguro correr esto aunque ya se haya corrido antes.

alter table matches add column if not exists slot_index integer;

create index if not exists idx_matches_bracket_slot on matches(tournament_id, fase, slot_index);
