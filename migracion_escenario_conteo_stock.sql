-- ============================================================
-- MIGRACIÓN: Conteo físico de stock (verificación) en Escenarios
--
-- Al cerrar el día, el encargado puede contar físicamente cuánto quedó
-- de cada producto y compararlo contra lo que el sistema dice que debería
-- quedar (según ventas y compras registradas). Si no coinciden, queda
-- anotada la diferencia — sirve para detectar faltantes, errores de
-- conteo o ventas que no se registraron.
--
-- Cómo ejecutar: Supabase → SQL Editor → pegar todo → RUN
-- Es seguro ejecutarlo más de una vez.
-- ============================================================

create table if not exists escenario_conteos_stock (
  id                uuid primary key default gen_random_uuid(),
  escenario_id      uuid not null references escenarios(id) on delete cascade,
  fecha             date not null,
  product_id        uuid references escenario_productos(id) on delete set null,
  nombre            text,
  cantidad_sistema  integer not null default 0,
  cantidad_fisica   integer not null default 0,
  diferencia        integer not null default 0,
  player_id         uuid references players(id) on delete set null,
  created_at        timestamptz default now(),
  unique (escenario_id, fecha, product_id)
);
create index if not exists idx_escenario_conteos_stock_escenario_fecha on escenario_conteos_stock(escenario_id, fecha);

alter table escenario_conteos_stock disable row level security;
