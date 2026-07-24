-- Índices para que la app cargue más rápido en general (no una pantalla en
-- particular). Postgres NO crea automáticamente un índice en las columnas que
-- usás como llave foránea (tournament_id, team_id, player_id, etc.) — solo en
-- la primary key. Si esas columnas no tienen índice, cada consulta filtrada
-- por torneo/equipo/jugador hace un recorrido completo de la tabla, y eso se
-- va sintiendo cada vez más lento en TODAS las páginas a medida que crecen
-- los datos (partidos, jugadores, estadísticas...). Esto agrega esos índices.
-- Es seguro correrlo aunque ya existan (IF NOT EXISTS) y no cambia ni borra
-- ningún dato.

-- Login / verificación de rol al abrir cualquier portal (se consulta SIEMPRE)
create index if not exists idx_roles_plataforma_email    on roles_plataforma(email);
create index if not exists idx_players_user_id           on players(user_id);
create index if not exists idx_players_numero_cedula     on players(numero_cedula);

-- Partidos por torneo (la tabla más consultada de toda la app)
create index if not exists idx_matches_tournament_id     on matches(tournament_id);
create index if not exists idx_matches_home_team_id      on matches(home_team_id);
create index if not exists idx_matches_away_team_id      on matches(away_team_id);

-- Equipos e inscripciones por torneo/equipo/jugador
create index if not exists idx_tournament_teams_tournament_id on tournament_teams(tournament_id);
create index if not exists idx_tournament_teams_team_id       on tournament_teams(team_id);
create index if not exists idx_tpr_tournament_id  on tournament_player_registrations(tournament_id);
create index if not exists idx_tpr_team_id        on tournament_player_registrations(team_id);
create index if not exists idx_tpr_player_id      on tournament_player_registrations(player_id);
create index if not exists idx_team_players_team_id   on team_players(team_id);
create index if not exists idx_team_players_player_id on team_players(player_id);

-- Estadísticas por partido/torneo/jugador (goleadores, tarjetas, planillas)
create index if not exists idx_pms_match_id       on player_match_stats(match_id);
create index if not exists idx_pms_tournament_id  on player_match_stats(tournament_id);
create index if not exists idx_pms_player_id      on player_match_stats(player_id);
create index if not exists idx_pms_team_id        on player_match_stats(team_id);

-- Grupos de un torneo
create index if not exists idx_tournament_grupos_tournament_id on tournament_grupos(tournament_id);
create index if not exists idx_grupo_equipos_grupo_id          on grupo_equipos(grupo_id);
create index if not exists idx_grupo_equipos_team_id           on grupo_equipos(team_id);

-- Logros (MVP, campeón) y predicciones por partido/torneo
create index if not exists idx_tournament_logros_tournament_id on tournament_logros(tournament_id);
create index if not exists idx_tournament_logros_match_id      on tournament_logros(match_id);
