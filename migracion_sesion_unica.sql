-- Bloqueo de sesión única por cuenta: cuando alguien entra con su cédula en
-- un dispositivo nuevo, el dispositivo que ya estaba abierto se cierra solo
-- (ver src/components/SessionGuard.jsx). session_id se reescribe en cada
-- login exitoso; el dispositivo cuyo id local ya no coincide se desloguea.
alter table players add column if not exists session_id uuid;
alter table players add column if not exists session_actualizado_at timestamptz;
