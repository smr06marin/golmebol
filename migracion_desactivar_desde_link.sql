-- ── Desactivar jugadores desde el link de registro del equipo ───────────────
-- Queda registrado quién lo desactivó (verificado con cédula + contraseña)

alter table tournament_player_registrations add column if not exists desactivado_por text;
alter table tournament_player_registrations add column if not exists desactivado_at timestamptz;
