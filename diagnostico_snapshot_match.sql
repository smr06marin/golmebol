select id, status,
       live_state_rapida is not null as tiene_snapshot_guardado,
       jsonb_array_length(live_state_rapida->'jugadoresLocal') as jugadores_local_en_snapshot,
       jsonb_array_length(live_state_rapida->'jugadoresVisitante') as jugadores_visitante_en_snapshot,
       live_state_rapida_updated_at
from matches
where id = '8b04f896-4802-4a9b-95b1-4c8be730befb';
