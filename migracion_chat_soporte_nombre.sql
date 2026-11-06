-- ============================================================
-- CHAT DE AYUDA — nombre de quien escribe (se pregunta una sola vez)
-- Cómo ejecutar: Supabase → SQL Editor → pegar TODO → RUN. Es seguro repetirlo.
-- Importante: córrelo ANTES de subir el código nuevo.
--
-- El nombre se guarda en soporte_chats (la ficha del organizador), NO en los mensajes:
-- la limpieza de los 8 días borra mensajes y archivos, pero el nombre se queda.
-- ============================================================
alter table public.soporte_chats add column if not exists nombre text;

create or replace function public.soporte_guardar_nombre(p_nombre text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  p_nombre := regexp_replace(btrim(coalesce(p_nombre, '')), '\s+', ' ', 'g');
  if char_length(p_nombre) < 2 or char_length(p_nombre) > 60 then raise exception 'Nombre no válido'; end if;
  update public.soporte_chats set nombre = p_nombre where user_id = auth.uid();
end $$;

revoke all on function public.soporte_guardar_nombre(text) from public;
grant execute on function public.soporte_guardar_nombre(text) to authenticated;

-- ROLLBACK:
--   drop function if exists public.soporte_guardar_nombre(text);
--   alter table public.soporte_chats drop column if exists nombre;
