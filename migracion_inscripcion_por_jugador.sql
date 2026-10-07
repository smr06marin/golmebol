-- Inscripción POR JUGADOR: marca de pago en cada inscripción de jugador.
-- Ejecutar una vez en Supabase > SQL Editor (se puede re-ejecutar sin problema).
alter table tournament_player_registrations
  add column if not exists inscripcion_pagada boolean not null default false,
  add column if not exists inscripcion_pagada_at timestamptz;

-- Nota: los torneos que ya existen siguen cobrando "por equipo" (no cambia nada)
-- hasta que el organizador cambie el modo en la configuración del torneo.
