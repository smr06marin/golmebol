-- ============================================================
-- AVISOS PARA EL PÚBLICO EN EL NAVEGADOR Y EN LA APP INSTALADA (Web Push)
-- Cómo ejecutar: Supabase → SQL Editor → pegar todo → RUN. Es seguro correrlo más de una vez.
--
-- Hasta ahora solo recibían avisos los celulares con la app nativa (Firebase). Esto deja que también los
-- reciban quienes entran desde el navegador o tienen Golmebol instalada en la pantalla de inicio.
-- Usa las MISMAS colas y avisos que ya existen (partido nuevo, cambio, resultado, recordatorio):
-- solo se agregan dos cosas:
--   * una columna con las llaves de la suscripción del navegador
--   * la función registrar_push_web, con la que el navegador guarda su suscripción (anónimo)
-- ============================================================

alter table public.push_dispositivos add column if not exists suscripcion jsonb;

create or replace function public.registrar_push_web(
  p_endpoint text, p_p256dh text, p_auth text, p_equipos uuid[], p_torneos uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Solo servicios de push reales de los navegadores (evita que alguien nos haga llamar direcciones cualquiera)
  if p_endpoint is null or length(p_endpoint) < 20 or length(p_endpoint) > 1000
     or p_endpoint !~ '^https://(fcm\.googleapis\.com|[a-z0-9.-]+\.push\.services\.mozilla\.com|[a-z0-9.-]+\.push\.apple\.com|[a-z0-9.-]+\.notify\.windows\.com)/' then
    raise exception 'Suscripción inválida';
  end if;
  if p_p256dh is null or length(p_p256dh) not between 20 and 200 or p_auth is null or length(p_auth) not between 8 and 100 then
    raise exception 'Suscripción inválida';
  end if;
  insert into public.push_dispositivos as d (token, plataforma, suscripcion, equipos, torneos, activo, actualizado_en)
  values (p_endpoint, 'web', jsonb_build_object('p256dh', p_p256dh, 'auth', p_auth),
          (select coalesce(array_agg(x), '{}') from (select distinct unnest(coalesce(p_equipos,'{}')) x limit 300) s),
          (select coalesce(array_agg(x), '{}') from (select distinct unnest(coalesce(p_torneos,'{}')) x limit 100) s),
          true, now())
  on conflict (token) do update
    set plataforma = 'web',
        suscripcion = excluded.suscripcion,
        equipos = excluded.equipos,
        torneos = excluded.torneos,
        activo = true,
        actualizado_en = now();
end $$;
revoke all on function public.registrar_push_web(text, text, text, uuid[], uuid[]) from public;
grant execute on function public.registrar_push_web(text, text, text, uuid[], uuid[]) to anon, authenticated;

-- ROLLBACK (opcional):
-- drop function if exists public.registrar_push_web(text, text, text, uuid[], uuid[]);
-- alter table public.push_dispositivos drop column if exists suscripcion;
