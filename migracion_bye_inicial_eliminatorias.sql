-- Permite armar el árbol de eliminatorias directas con número impar de
-- clasificados: guarda qué equipo pasó directo (bye) en la primera ronda,
-- sin jugar, cuando el admin elige esa opción en vez de meter un mejor
-- perdedor más para completar número par.
alter table tournaments
  add column if not exists bye_inicial_team_id uuid references teams(id) on delete set null;
