-- ============================================================
-- MIGRACIÓN: Escenarios Deportivos (tienda + canchas)
--
-- Módulo nuevo, independiente de torneos/escuelas: un "escenario" es un
-- negocio de canchas sintéticas con tienda de productos (empanadas,
-- gaseosas, etc). El encargado del escenario es un jugador más (tabla
-- `players`), mismo patrón que ya existe para árbitros y profesores
-- (es_encargado_escenario), para reutilizar el login por cédula tal cual
-- está en toda la plataforma.
--
-- Cómo ejecutar: Supabase → SQL Editor → pegar todo → RUN
-- Es seguro ejecutarlo más de una vez.
-- ============================================================

-- ── El escenario en sí (negocio: tienda + canchas) ──────────
create table if not exists escenarios (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  city              text,
  logo_url          text,
  imagen_fondo_url  text,
  whatsapp          text,                      -- número del negocio, sin + ni espacios, con código de país
  hora_apertura     integer not null default 8,
  hora_cierre       integer not null default 22,
  precio_futbol5    numeric not null default 60000,
  precio_futbol7    numeric not null default 90000,
  created_at        timestamptz default now()
);

-- ── Rol encargado (mismo patrón que profesor/árbitro) ───────
alter table players add column if not exists es_encargado_escenario boolean not null default false;
alter table players add column if not exists escenario_id uuid references escenarios(id) on delete set null;
create index if not exists idx_players_escenario on players(escenario_id);
create index if not exists idx_players_es_encargado_escenario on players(es_encargado_escenario);

-- ── Inventario de la tienda ──────────────────────────────────
create table if not exists escenario_productos (
  id            uuid primary key default gen_random_uuid(),
  escenario_id  uuid not null references escenarios(id) on delete cascade,
  emoji         text default '🛒',
  nombre        text not null,
  costo         numeric not null default 0,
  precio        numeric not null default 0,
  cantidad      integer not null default 0,
  stock_minimo  integer not null default 5,
  created_at    timestamptz default now()
);
create index if not exists idx_escenario_productos_escenario on escenario_productos(escenario_id);

-- ── Ventas (punto de venta) ──────────────────────────────────
create table if not exists escenario_ventas (
  id             uuid primary key default gen_random_uuid(),
  escenario_id   uuid not null references escenarios(id) on delete cascade,
  fecha          date not null,
  hora           text,
  items          jsonb not null default '[]',  -- [{productId,nombre,cantidad,precio,costo}]
  total          numeric not null default 0,
  costo_total    numeric not null default 0,
  ganancia       numeric not null default 0,
  origen_pedido  boolean not null default false,
  created_at     timestamptz default now()
);
create index if not exists idx_escenario_ventas_escenario_fecha on escenario_ventas(escenario_id, fecha);

-- ── Compras a proveedores ────────────────────────────────────
create table if not exists escenario_compras (
  id            uuid primary key default gen_random_uuid(),
  escenario_id  uuid not null references escenarios(id) on delete cascade,
  proveedor     text,
  product_id    uuid references escenario_productos(id) on delete set null,
  nombre        text,
  cantidad      integer not null default 0,
  costo         numeric not null default 0,
  fecha         date not null default current_date,
  created_at    timestamptz default now()
);
create index if not exists idx_escenario_compras_escenario on escenario_compras(escenario_id);

-- ── Reservas de cancha ────────────────────────────────────────
create table if not exists escenario_reservas (
  id                      uuid primary key default gen_random_uuid(),
  escenario_id            uuid not null references escenarios(id) on delete cascade,
  cancha                  text not null check (cancha in ('futbol5','futbol7')),
  fecha                   date not null,
  hora                    text not null,        -- 'HH:00'
  duracion                integer not null default 60,
  nombre                  text,
  telefono                text,
  equipo                  text,
  estado                  text not null default 'pendiente' check (estado in ('pendiente','aceptada','rechazada','mantenimiento')),
  pago                    text not null default 'pendiente' check (pago in ('pendiente','anticipo','pagado')),
  monto                   numeric not null default 0,
  monto_pagado            numeric not null default 0,
  recurrente              boolean not null default false,
  generada_de_recurrente  boolean not null default false,
  created_at              timestamptz default now()
);
create index if not exists idx_escenario_reservas_escenario_fecha on escenario_reservas(escenario_id, fecha);

-- ── Pedidos remotos (cliente en la cancha pide por WhatsApp) ──
create table if not exists escenario_pedidos (
  id            uuid primary key default gen_random_uuid(),
  escenario_id  uuid not null references escenarios(id) on delete cascade,
  items         jsonb not null default '[]',
  nombre        text,
  telefono      text,
  total         numeric not null default 0,
  fecha         date not null,
  hora          text,
  estado        text not null default 'pendiente' check (estado in ('pendiente','completado')),
  created_at    timestamptz default now()
);
create index if not exists idx_escenario_pedidos_escenario on escenario_pedidos(escenario_id);
