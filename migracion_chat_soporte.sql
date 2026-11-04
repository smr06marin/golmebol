-- =====================================================================
-- CHAT DE AYUDA (organizadores ↔ soporte Golmebol por WhatsApp)
-- Pegar COMPLETO en Supabase → SQL Editor → RUN. Se puede correr más de una vez.
--
-- Cómo funciona: cada usuario del admin tiene UN chat. Lo que escribe llega a tu
-- WhatsApp (desde la función /api/soporte-enviar); lo que tú contestas en WhatsApp
-- vuelve a su chat (función /api/whatsapp-webhook). Todo queda guardado aquí.
-- El usuario SOLO puede LEER su chat; los mensajes los escribe el servidor.
-- =====================================================================

create table if not exists soporte_chats (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null unique references auth.users(id) on delete cascade,
  codigo            bigint generated always as identity,      -- el "#12" que ves en WhatsApp
  email             text,
  ultimo_contexto   text,                                      -- en qué pantalla estaba al escribir
  ultimo_mensaje_at timestamptz not null default now(),
  leido_usuario_at  timestamptz not null default now(),        -- hasta cuándo vio las respuestas
  created_at        timestamptz not null default now()
);
create unique index if not exists soporte_chats_codigo_uk on soporte_chats(codigo);

create table if not exists soporte_mensajes (
  id         uuid primary key default gen_random_uuid(),
  chat_id    uuid not null references soporte_chats(id) on delete cascade,
  de         text not null check (de in ('usuario', 'soporte')),
  texto      text not null check (char_length(texto) between 1 and 2000),
  wa_id      text,                                             -- id del mensaje en WhatsApp (para saber a qué chat responde cada contestación)
  wa_estado  text,                                             -- solo mensajes del usuario: 'enviado' | 'plantilla' | 'error' | 'sin_configurar'
  created_at timestamptz not null default now()
);
create index if not exists soporte_mensajes_chat_idx on soporte_mensajes(chat_id, created_at);
create unique index if not exists soporte_mensajes_wa_id_uk on soporte_mensajes(wa_id) where wa_id is not null;

alter table soporte_chats    enable row level security;
alter table soporte_mensajes enable row level security;

drop policy if exists "soporte_chats_select" on soporte_chats;
create policy "soporte_chats_select" on soporte_chats
  for select using (user_id = auth.uid());

drop policy if exists "soporte_mensajes_select" on soporte_mensajes;
create policy "soporte_mensajes_select" on soporte_mensajes
  for select using (exists (select 1 from soporte_chats c where c.id = chat_id and c.user_id = auth.uid()));

-- Sin políticas de insert/update: solo el servidor (clave service_role) escribe.

-- Devuelve el chat del usuario que entró (lo crea la primera vez)
create or replace function soporte_mi_chat()
returns soporte_chats
language plpgsql security definer set search_path = public as $$
declare
  v_chat soporte_chats;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  select * into v_chat from soporte_chats where user_id = auth.uid();
  if not found then
    insert into soporte_chats (user_id, email)
    values (auth.uid(), lower(coalesce(auth.jwt() ->> 'email', '')))
    on conflict (user_id) do nothing;
    select * into v_chat from soporte_chats where user_id = auth.uid();
  end if;
  return v_chat;
end $$;

-- Marca como vistas las respuestas
create or replace function soporte_marcar_leido()
returns void
language sql security definer set search_path = public as $$
  update soporte_chats set leido_usuario_at = now() where user_id = auth.uid();
$$;

revoke all on function soporte_mi_chat()      from public;
revoke all on function soporte_marcar_leido() from public;
grant execute on function soporte_mi_chat()      to authenticated;
grant execute on function soporte_marcar_leido() to authenticated;

-- Tiempo real: que las respuestas aparezcan solas en el chat
do $$
begin
  alter publication supabase_realtime add table soporte_mensajes;
exception when duplicate_object then null;
end $$;
