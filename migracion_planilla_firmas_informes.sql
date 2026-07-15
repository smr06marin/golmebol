-- ── Planilla: firmas persistentes, capitanes e informes ─────────────────────

-- Firmas de la planilla (capitanes, árbitros, anotador) como imágenes base64.
-- Antes solo vivían en la memoria del navegador y se perdían al reabrir.
alter table matches add column if not exists firmas jsonb;

-- Número de camiseta del capitán de cada equipo en este partido
alter table matches add column if not exists capitan_local text;
alter table matches add column if not exists capitan_visitante text;

-- Informes del partido: obligatorios cuando hay tarjeta roja o el partido
-- termina antes de tiempo (W.O. / desierto). Se escriben o dictan por voz.
create table if not exists match_informes (
  id uuid primary key default gen_random_uuid(),
  match_id uuid references matches(id) on delete cascade,
  tournament_id uuid,
  tipo text,                -- 'roja' | 'terminado_antes' | 'otro'
  descripcion text not null,
  creado_por text,          -- nombre o correo de quien lo registró
  created_at timestamptz default now()
);

alter table match_informes enable row level security;

do $$ begin
  create policy match_informes_select on match_informes for select using (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy match_informes_insert on match_informes for insert with check (auth.role() = 'authenticated');
exception when duplicate_object then null; end $$;
