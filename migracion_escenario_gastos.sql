-- ============================================================
-- MIGRACIÓN: Gastos generales del escenario (no ligados a un producto)
--
-- "Compras" ya cubre lo que se compra para revender en la tienda
-- (productos, con su costo e inventario). "Gastos" es para lo demás que
-- sale de la caja del negocio: arriendo, servicios, nómina, aseo,
-- mantenimiento, etc. — para que el informe diario también los muestre y
-- la caja neta del día los descuente.
--
-- Cómo ejecutar: Supabase → SQL Editor → pegar todo → RUN
-- Es seguro ejecutarlo más de una vez.
-- ============================================================

create table if not exists escenario_gastos (
  id            uuid primary key default gen_random_uuid(),
  escenario_id  uuid not null references escenarios(id) on delete cascade,
  categoria     text,
  descripcion   text,
  monto         numeric not null default 0,
  fecha         date not null default current_date,
  hora          text,
  created_at    timestamptz default now()
);
create index if not exists idx_escenario_gastos_escenario_fecha on escenario_gastos(escenario_id, fecha);
alter table escenario_gastos disable row level security;
