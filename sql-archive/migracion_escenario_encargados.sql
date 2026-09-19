-- ============================================================
-- MIGRACIÓN: un encargado puede tener varios escenarios (many-to-many)
--
-- Antes cada encargado (players) tenía un solo escenario_id. Ahora un
-- mismo encargado puede estar asignado a varios escenarios, así que la
-- relación pasa a esta tabla intermedia. players.escenario_id se deja
-- de usar pero no se borra (por si hace falta mirar el dato viejo).
--
-- Cómo ejecutar: Supabase → SQL Editor → pegar todo → RUN
-- Es seguro ejecutarlo más de una vez.
-- ============================================================

create table if not exists escenario_encargados (
  id            uuid primary key default gen_random_uuid(),
  escenario_id  uuid not null references escenarios(id) on delete cascade,
  player_id     uuid not null references players(id) on delete cascade,
  created_at    timestamptz default now(),
  unique (escenario_id, player_id)
);
create index if not exists idx_escenario_encargados_escenario on escenario_encargados(escenario_id);
create index if not exists idx_escenario_encargados_player on escenario_encargados(player_id);
alter table escenario_encargados disable row level security;

-- Migra las asignaciones que ya existían en players.escenario_id
insert into escenario_encargados (escenario_id, player_id)
select escenario_id, id from players
where escenario_id is not null and es_encargado_escenario = true
on conflict (escenario_id, player_id) do nothing;
