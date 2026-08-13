-- Base de caja: el monto de plata que se deja en caja (ej. cada lunes) para
-- poder ir comparando cuánta plata se va recogiendo durante la semana.
-- Se guarda un historial (no se sobrescribe) para poder ver cuándo se puso
-- cada base.
create table if not exists escenario_base_caja (
  id            uuid primary key default gen_random_uuid(),
  escenario_id  uuid not null references escenarios(id) on delete cascade,
  monto         numeric not null default 0,
  fecha         date not null default current_date,
  hora          text,
  player_id     uuid references players(id),
  created_at    timestamptz default now()
);

create index if not exists idx_escenario_base_caja_escenario_fecha
  on escenario_base_caja(escenario_id, fecha desc);

alter table escenario_base_caja disable row level security;
