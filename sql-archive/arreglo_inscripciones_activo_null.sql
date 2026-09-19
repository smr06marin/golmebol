-- ARREGLO PUNTUAL (no migración de esquema): dos flujos del admin
-- (AdminEquipoDetallePage.jsx "Crear y agregar al equipo" y
-- AdminCrearPage.jsx) insertaban en tournament_player_registrations SIN
-- poner activo=true. Esas filas quedan con activo en NULL:
--   - La pestaña "Equipos" del torneo las cuenta igual (filtra por
--     "activo !== false", y null !== false), por eso se ve "17 jugadores".
--   - La Planilla Rápida (y el link del árbitro) exige activo = true exacto,
--     así que las excluye — por eso la planilla sale vacía.
--
-- Este script solo TOCA las filas que quedaron en ese limbo (activo IS
-- NULL) y las deja en true, que es lo que siempre debieron tener. No toca
-- ninguna fila que ya esté en true o en false (esas si son intencionales:
-- false = jugador sacado del torneo).
--
-- Cómo ejecutar: Supabase → SQL Editor → RUN. Seguro de re-ejecutar.

update tournament_player_registrations
set activo = true
where activo is null;
