-- Permite al admin ocultar/mostrar individualmente cada récord AUTOMÁTICO
-- (los que se calculan solos: máximo goleador, hat-tricks, racha, etc.) en
-- la página pública de récords, sin tener que borrar datos. Si un récord no
-- tiene fila aquí, se asume visible = true (comportamiento actual).
create table if not exists records_config (
  id text primary key,
  visible boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table records_config enable row level security;
drop policy if exists "records_config_all" on records_config;
create policy "records_config_all" on records_config for all using (true) with check (true);
