select tt.team_id, t.id, t.name, t.city, t.logo_url, t.representante_nombre
from tournament_teams tt
join teams t on t.id = tt.team_id
where tt.tournament_id = 'bf7454c6-7287-4c37-b7b2-f502748c9f3c' -- Torneo Barrio Santa Rita
  and t.name ilike '%combo%willy%';
