-- Corrige partidos de eliminatorias duplicados (misma fase, misma casilla,
-- mismos dos equipos) que se podían llegar a crear si el avance automático
-- de casillas corría dos veces casi al mismo tiempo (ej. justo cuando
-- terminaba el último partido de una ronda). El código ya se corrigió para
-- que esto no vuelva a pasar (ahora vuelve a consultar la base antes de
-- crear el partido), pero esto limpia los duplicados que ya se hayan creado
-- y agrega un candado en la base para que no puedan volver a crearse.
--
-- Es seguro correr esto aunque ya se haya corrido antes.

-- 1. Borra los duplicados: mismo torneo + fase + casilla + mismos dos
--    equipos (en el mismo orden local/visitante) — se queda solo con el más
--    viejo (el primero que se creó). Nunca borra un partido que ya se jugó
--    (por seguridad, aunque en la práctica un duplicado recién creado nunca
--    debería estar jugado).
delete from matches m
using (
  select id,
    row_number() over (
      partition by tournament_id, fase, slot_index, home_team_id, away_team_id
      order by created_at asc
    ) as rn
  from matches
  where slot_index is not null
) dup
where m.id = dup.id
  and dup.rn > 1
  and m.status <> 'finished';

-- 2. Candado en la base: no puede haber dos partidos de la misma fase, la
--    misma casilla y el mismo enfrentamiento (local/visitante) en el mismo
--    torneo. Si el partido es ida y vuelta, la vuelta tiene local/visitante
--    invertido, así que este candado NO le impide existir junto a la ida.
create unique index if not exists idx_matches_bracket_slot_fixture
  on matches(tournament_id, fase, slot_index, home_team_id, away_team_id)
  where slot_index is not null;
