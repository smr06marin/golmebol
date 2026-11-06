-- ============================================================
-- CHAT DE AYUDA PÚBLICO (visitantes sin cuenta de las páginas públicas)
-- Cómo ejecutar: Supabase → SQL Editor → pegar TODO → RUN. Es seguro repetirlo.
-- Importante: córrelo ANTES de subir el código nuevo.
--
-- Reutiliza las tablas del chat de ayuda: un chat público es una fila de soporte_chats
-- SIN usuario (user_id vacío) y con un "token" secreto que solo guarda el navegador del visitante.
-- Las personas NO leen las tablas directamente: todo pasa por el servidor (/api/publico-chat).
-- ROLLBACK (al final, comentado).
-- ============================================================
alter table public.soporte_chats alter column user_id drop not null;

alter table public.soporte_chats add column if not exists origen text not null default 'admin';
alter table public.soporte_chats drop constraint if exists soporte_chats_origen_check;
alter table public.soporte_chats add constraint soporte_chats_origen_check check (origen in ('admin', 'publico'));

alter table public.soporte_chats add column if not exists token uuid;
alter table public.soporte_chats add column if not exists tema text;
alter table public.soporte_chats add column if not exists torneo_id uuid;
alter table public.soporte_chats add column if not exists contacto text;
alter table public.soporte_chats add column if not exists ip_hash text;

create unique index if not exists soporte_chats_token_uk on public.soporte_chats (token) where token is not null;
create index if not exists soporte_chats_ip_idx on public.soporte_chats (ip_hash, created_at) where ip_hash is not null;

-- ROLLBACK:
--   delete from public.soporte_chats where origen = 'publico';
--   drop index if exists soporte_chats_token_uk; drop index if exists soporte_chats_ip_idx;
--   alter table public.soporte_chats drop column if exists origen, drop column if exists token, drop column if exists tema,
--     drop column if exists torneo_id, drop column if exists contacto, drop column if exists ip_hash;
--   alter table public.soporte_chats alter column user_id set not null;
