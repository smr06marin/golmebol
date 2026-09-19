-- ── Verificación por WhatsApp para jugadores nuevos ─────────────────────────
-- Los jugadores que se registran solos desde la app quedan con verificado=false
-- hasta que envíen el mensaje de WhatsApp (nombre, cédula y equipo) y el admin
-- los apruebe manualmente en Admin > Jugadores.
-- Los jugadores YA existentes quedan verificados automáticamente.

alter table players add column if not exists verificado boolean not null default true;

-- Equipo en el que dice que va a jugar (lo escribe al registrarse; si queda
-- vacío es alguien que solo quiere PREDIX)
alter table players add column if not exists equipo_deseado text;

-- Por si la columna se creó antes sin default: asegurar que todos los
-- jugadores actuales queden verificados
update players set verificado = true where verificado is null;
