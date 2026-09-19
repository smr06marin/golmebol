-- ── Nombres de árbitros escritos en la planilla ─────────────────────────────
-- La planilla guarda el NOMBRE del árbitro (texto) además del id, para los
-- árbitros escritos a mano con "Otro (escribir)". Estas columnas no existían
-- y hacían fallar TODO el guardado del resultado con el error:
-- "Could not find the 'arbitro1' column of 'matches' in the schema cache"

alter table matches add column if not exists arbitro1 text;
alter table matches add column if not exists arbitro2 text;
alter table matches add column if not exists arbitro3 text;
