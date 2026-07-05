-- ============================================================
-- MIGRACIÓN: Finanzas del torneo (tarjetas, cuentas, deudas)
-- Cómo ejecutar: Supabase → SQL Editor → pegar todo → RUN
-- Es seguro ejecutarlo más de una vez.
-- ============================================================

-- 1. Configuración financiera del torneo (precios de tarjetas, arbitraje, etc.)
alter table tournaments add column if not exists finanzas_config jsonb;

-- 2. Movimientos de dinero (pagos de equipos y deudas personales)
create table if not exists torneo_finanzas (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid references tournaments(id) on delete cascade,
  team_id       uuid references teams(id) on delete set null,
  player_id     uuid references players(id) on delete set null,
  tipo          text not null,  -- 'pago_tarjetas' | 'pago_cargos' | 'deuda_personal' | 'pago_deuda_personal'
  concepto      text,
  monto         numeric not null default 0,
  pagado        boolean default false,
  created_at    timestamptz default now()
);

create index if not exists idx_torneo_finanzas_torneo  on torneo_finanzas(tournament_id);
create index if not exists idx_torneo_finanzas_equipo  on torneo_finanzas(team_id);
create index if not exists idx_torneo_finanzas_jugador on torneo_finanzas(player_id);

-- 3. Permisos (mismo esquema abierto que usan las demás tablas de la app)
alter table torneo_finanzas enable row level security;

drop policy if exists "finanzas_select" on torneo_finanzas;
create policy "finanzas_select" on torneo_finanzas for select using (true);

drop policy if exists "finanzas_insert" on torneo_finanzas;
create policy "finanzas_insert" on torneo_finanzas for insert with check (true);

drop policy if exists "finanzas_update" on torneo_finanzas;
create policy "finanzas_update" on torneo_finanzas for update using (true);

drop policy if exists "finanzas_delete" on torneo_finanzas;
create policy "finanzas_delete" on torneo_finanzas for delete using (true);
