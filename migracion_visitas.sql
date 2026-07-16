-- ── Analíticas de visitas del sitio público ─────────────────────────────────
-- Cada visita a la página pública queda registrada con sesión del navegador,
-- dispositivo y torneo consultado. Las ve solo el administrador en su panel.

create table if not exists site_visitas (
  id uuid primary key default gen_random_uuid(),
  pagina text,          -- 'inicio' | 'tabla_torneo' | 'torneo_publico'
  torneo_id uuid,
  session_id text,
  dispositivo text,     -- 'movil' | 'pc'
  created_at timestamptz default now()
);

create index if not exists site_visitas_created_idx on site_visitas (created_at);

alter table site_visitas enable row level security;

-- Cualquier visitante (sin cuenta) puede registrar su visita
do $$ begin
  create policy site_visitas_insert on site_visitas for insert with check (true);
exception when duplicate_object then null; end $$;

-- Solo usuarios autenticados pueden leerlas (el panel es del admin)
do $$ begin
  create policy site_visitas_select on site_visitas for select using (auth.role() = 'authenticated');
exception when duplicate_object then null; end $$;
