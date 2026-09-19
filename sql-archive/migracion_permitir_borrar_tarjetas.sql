-- Las tarjetas personalizadas (tabla "cards" y sus dependientes) se crearon
-- hace tiempo, probablemente sin una política de RLS que permita DELETE —
-- por eso el botón de "eliminar" decía "eliminada ✓" pero la tarjeta seguía
-- ahí (Postgrest borra 0 filas y no avisa error si RLS lo bloquea en
-- silencio). Esto agrega una política amplia (igual al resto del proyecto)
-- para permitir todas las operaciones, incluyendo borrar.
alter table cards enable row level security;
drop policy if exists "cards_all" on cards;
create policy "cards_all" on cards for all using (true) with check (true);

alter table card_levels enable row level security;
drop policy if exists "card_levels_all" on card_levels;
create policy "card_levels_all" on card_levels for all using (true) with check (true);

alter table achievements enable row level security;
drop policy if exists "achievements_all" on achievements;
create policy "achievements_all" on achievements for all using (true) with check (true);

alter table sponsors enable row level security;
drop policy if exists "sponsors_all" on sponsors;
create policy "sponsors_all" on sponsors for all using (true) with check (true);

-- Estas dos pueden no existir en tu base todavía (según el diseño de logros
-- por jugador) — si el SQL Editor da error de "relation does not exist" en
-- una de ellas, borra ese bloque y corre el resto.
alter table player_card_level_progress enable row level security;
drop policy if exists "player_card_level_progress_all" on player_card_level_progress;
create policy "player_card_level_progress_all" on player_card_level_progress for all using (true) with check (true);

alter table player_achievement_progress enable row level security;
drop policy if exists "player_achievement_progress_all" on player_achievement_progress;
create policy "player_achievement_progress_all" on player_achievement_progress for all using (true) with check (true);
