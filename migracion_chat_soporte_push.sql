-- ============================================================
-- CHAT DE AYUDA — avisos push en el navegador / app instalada
-- Cómo ejecutar: Supabase → SQL Editor → pegar todo → RUN. Es seguro repetirlo.
--
-- Guarda, por usuario, los navegadores/dispositivos que activaron los avisos
-- del chat. Solo el servidor (clave service_role) la lee y la escribe.
-- ROLLBACK:  drop table if exists public.soporte_push;
-- ============================================================
create table if not exists public.soporte_push (
  id        bigserial primary key,
  user_id   uuid not null references auth.users(id) on delete cascade,
  endpoint  text not null unique,
  p256dh    text not null,
  auth      text not null,
  creado_en timestamptz not null default now()
);
create index if not exists soporte_push_user on public.soporte_push (user_id);
alter table public.soporte_push enable row level security;
revoke all on public.soporte_push from anon, authenticated;
