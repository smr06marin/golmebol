-- Las políticas actuales de "players" solo permiten crear/editar TU PROPIA
-- fila (auth.uid() = user_id). Eso rompe dos flujos normales de la app:
--   1) Un coordinador/admin creando la ficha de OTRO jugador (su cuenta no
--      es la del jugador que está creando).
--   2) El sistema vinculando la cuenta de un jugador recién registrado — en
--      ese momento la fila todavía tiene user_id = null, así que la política
--      no deja que se le asigne.
--
-- El resto de tablas de Golmebol (sanciones, roles_plataforma) usan
-- políticas abiertas y dejan el control de acceso al código de la app, no a
-- RLS. Esto pone "players" en el mismo esquema.

drop policy if exists players_insert_own on players;
drop policy if exists players_update_own on players;
drop policy if exists players_delete_own on players;

create policy players_insert_all on players for insert with check (true);
create policy players_update_all on players for update using (true);
create policy players_delete_all on players for delete using (true);

-- players_select_all ya estaba abierta (using true) — no se toca.
