-- =====================================================================
-- Chat de ayuda: un TEMA de Telegram por conversación (para que no se mezclen)
-- Cómo ejecutar: Supabase → SQL Editor → pegar todo → RUN. Se puede correr más de una vez.
-- Guarda en cada conversación el número de su tema (hilo) en el grupo de Telegram.
-- =====================================================================
alter table public.soporte_chats add column if not exists telegram_tema_id bigint;
create unique index if not exists soporte_chats_telegram_tema_uk
  on public.soporte_chats (telegram_tema_id) where telegram_tema_id is not null;
