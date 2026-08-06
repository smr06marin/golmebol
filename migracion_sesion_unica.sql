-- Bloqueo de sesión única por cuenta: cuando alguien entra con su cédula en
-- un dispositivo nuevo, el dispositivo que ya estaba abierto se cierra solo
-- (ver src/components/SessionGuard.jsx). session_id se reescribe en cada
-- login exitoso; el dispositivo cuyo id local ya no coincide se desloguea.
alter table players add column if not exists session_id uuid;
alter table players add column if not exists session_actualizado_at timestamptz;

-- El paso que faltaba: la columna se actualiza bien, pero sin esto Supabase
-- Realtime nunca avisa al dispositivo viejo (el UPDATE pasa "en silencio" y
-- SessionGuard.jsx nunca recibe el evento para expulsarlo). Hay que sumar la
-- tabla a la publicación de Realtime. Guardado con chequeo para poder
-- ejecutar este archivo más de una vez sin error.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'players'
  ) then
    alter publication supabase_realtime add table players;
  end if;
end $$;
