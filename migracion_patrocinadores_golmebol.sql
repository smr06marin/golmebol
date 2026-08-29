-- ============================================================
-- MIGRACIÓN: Patrocinadores oficiales de Golmebol (portada pública)
--
-- Banner de patrocinadores que rota cada 5 segundos en la página de
-- inicio pública, debajo de Escenarios/Escuelas. Al hacer clic en uno se
-- ve su info completa (dirección, WhatsApp, redes sociales) y un botón
-- para escribirle directo por WhatsApp.
--
-- Esto es distinto de la tabla "sponsors" que ya existe (esa es para las
-- tarjetas de jugador, un logo por card_id) — esta es para los
-- patrocinadores de la plataforma en general, con su propia info.
--
-- Cómo ejecutar: Supabase → SQL Editor → pegar todo → RUN
-- Es seguro ejecutarlo más de una vez.
-- ============================================================

create table if not exists patrocinadores_golmebol (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null,
  logo_url    text,
  whatsapp    text,
  direccion   text,
  facebook    text,
  instagram   text,
  tiktok      text,
  activo      boolean not null default true,
  orden       integer not null default 0,
  created_at  timestamptz default now()
);
create index if not exists idx_patrocinadores_golmebol_orden on patrocinadores_golmebol(orden);
alter table patrocinadores_golmebol disable row level security;

-- Bucket de Storage para los logos de los patrocinadores
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'patrocinadores',
  'patrocinadores',
  true,
  5242880, -- 5 MB
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml']
)
on conflict (id) do update set public = true;

drop policy if exists "patrocinadores_select" on storage.objects;
create policy "patrocinadores_select"
on storage.objects for select
using (bucket_id = 'patrocinadores');

drop policy if exists "patrocinadores_insert" on storage.objects;
create policy "patrocinadores_insert"
on storage.objects for insert
with check (bucket_id = 'patrocinadores' and auth.role() = 'authenticated');

drop policy if exists "patrocinadores_update" on storage.objects;
create policy "patrocinadores_update"
on storage.objects for update
using (bucket_id = 'patrocinadores' and auth.role() = 'authenticated');

drop policy if exists "patrocinadores_delete" on storage.objects;
create policy "patrocinadores_delete"
on storage.objects for delete
using (bucket_id = 'patrocinadores' and auth.role() = 'authenticated');
