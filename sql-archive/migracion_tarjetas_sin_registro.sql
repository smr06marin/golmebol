-- ── Tarjetas de jugadores SIN registro ──────────────────────────────────────
-- Un jugador escrito a mano en la planilla (sin id en el sistema) también
-- puede recibir tarjetas. Antes esos eventos no se guardaban y las finanzas
-- del torneo no los cobraban. Ahora quedan con player_id nulo y el nombre
-- escrito en la planilla.

alter table match_events add column if not exists player_nombre text;
