-- ============================================================
-- MIGRACIÓN: Historial de actividad del portal de Escenarios
--
-- Como varias personas pueden tener acceso al mismo escenario, queda un
-- registro de quién hizo qué: cambios de precio, productos o canchas que se
-- agregan o eliminan, ventas devueltas. Sirve para saber si hubo un cambio y
-- quién lo hizo, sin tener que confiar en la memoria de nadie.
--
-- Cómo ejecutar: Supabase → SQL Editor → pegar todo → RUN
-- Es seguro ejecutarlo más de una vez.
-- ============================================================

create table if not exists escenario_actividad (
  id            uuid primary key default gen_random_uuid(),
  escenario_id  uuid not null references escenarios(id) on delete cascade,
  player_id     uuid,
  player_nombre text,
  accion        text not null,   -- 'crear' | 'editar' | 'eliminar'
  entidad       text not null,   -- 'producto' | 'cancha' | 'venta'
  descripcion   text not null,
  created_at    timestamptz default now()
);
create index if not exists idx_escenario_actividad_escenario on escenario_actividad(escenario_id, created_at desc);
-- Mismo criterio que el resto del módulo: sin RLS, el acceso ya se controla
-- en la app (solo encargados del escenario llegan a estas páginas).
alter table escenario_actividad disable row level security;
