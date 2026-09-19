-- ============================================================
-- MIGRACIÓN: Roles de la plataforma (admin, organizador, árbitro)
-- Cómo ejecutar: Supabase → SQL Editor → pegar todo → RUN
-- Es seguro ejecutarlo más de una vez.
-- ============================================================

-- 1. Roles por email (el rol se asigna al correo con que la persona crea su cuenta)
create table if not exists roles_plataforma (
  id         uuid primary key default gen_random_uuid(),
  email      text unique not null,
  rol        text not null default 'organizador',  -- 'admin' | 'organizador' | 'arbitro'
  plan       text default 'gratis',                -- para organizadores (informativo)
  notas      text,
  activo     boolean default true,
  created_at timestamptz default now()
);

alter table roles_plataforma enable row level security;

drop policy if exists "roles_select" on roles_plataforma;
create policy "roles_select" on roles_plataforma for select using (true);

drop policy if exists "roles_insert" on roles_plataforma;
create policy "roles_insert" on roles_plataforma for insert with check (true);

drop policy if exists "roles_update" on roles_plataforma;
create policy "roles_update" on roles_plataforma for update using (true);

drop policy if exists "roles_delete" on roles_plataforma;
create policy "roles_delete" on roles_plataforma for delete using (true);

-- 2. Admin principal (ajusta o agrega correos si usas otro)
insert into roles_plataforma (email, rol, plan, notas)
values ('golmebol@gmail.com', 'admin', null, 'Admin principal')
on conflict (email) do nothing;

insert into roles_plataforma (email, rol, plan, notas)
values ('smr06marin@gmail.com', 'admin', null, 'Admin principal')
on conflict (email) do nothing;

-- 3. Torneos: premium (pago por torneo) y ediciones
alter table tournaments add column if not exists premium boolean default false;
alter table tournaments add column if not exists torneo_padre_id uuid;
alter table tournaments add column if not exists edicion integer default 1;

-- 4. Vincular el rol con la cuenta (se llena solo cuando la persona inicia sesión)
alter table roles_plataforma add column if not exists user_id uuid;
