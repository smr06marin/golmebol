-- ============================================================
-- PASO 7 — site_config (transmisión en vivo, patrocinadores, portada)
-- ============================================================
-- ANTES: RLS apagado -> cualquiera con la llave pública podía reescribir la
-- configuración de las transmisiones, sponsors y portada.
-- AHORA:
--   * Lectura: pública (la landing, /en-vivo y el realtime la necesitan).
--   * Escritura directa: solo cuentas REALES con rol admin u organizador.
--   * El link secreto del operador (/en-vivo-control/TOKEN) ya NO escribe la
--     tabla: llama a la función control_en_vivo_link(), que valida el token
--     y solo toca la "llave" de ESA transmisión dentro de en_vivo_control.
-- NO cambia ningún dato existente (streams, tokens y links siguen igual).
-- ============================================================

alter table public.site_config enable row level security;

drop policy if exists gm_site_config_select on public.site_config;
drop policy if exists gm_site_config_insert on public.site_config;
drop policy if exists gm_site_config_update on public.site_config;
drop policy if exists gm_site_config_delete on public.site_config;

create policy gm_site_config_select on public.site_config
  for select to anon, authenticated using (true);

create policy gm_site_config_insert on public.site_config
  for insert to authenticated
  with check (public.es_admin_plataforma() or public.es_organizador_plataforma());

create policy gm_site_config_update on public.site_config
  for update to authenticated
  using (public.es_admin_plataforma() or public.es_organizador_plataforma())
  with check (public.es_admin_plataforma() or public.es_organizador_plataforma());

create policy gm_site_config_delete on public.site_config
  for delete to authenticated
  using (public.es_admin_plataforma());

-- Función para el link del operador (sin login): valida el token.
create or replace function public.control_en_vivo_link(p_token text, p_cambios jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stream_id text;
begin
  if p_token is null or length(p_token) < 16 then
    raise exception 'Link inválido';
  end if;
  if p_cambios is null or jsonb_typeof(p_cambios) <> 'object' then
    raise exception 'Cambios inválidos';
  end if;
  if length(p_cambios::text) > 20000 then
    raise exception 'Cambios demasiado grandes';
  end if;

  select s->>'id' into v_stream_id
  from public.site_config c,
       lateral jsonb_array_elements(
         case when jsonb_typeof(c.en_vivo_streams) = 'array' then c.en_vivo_streams else '[]'::jsonb end
       ) s
  where c.id = true
    and coalesce(s->>'control_token', '') <> ''
    and s->>'control_token' = p_token
  limit 1;

  if v_stream_id is null then
    raise exception 'Link inválido o desactivado';
  end if;

  update public.site_config
  set en_vivo_control = coalesce(en_vivo_control, '{}'::jsonb)
        || jsonb_build_object(
             v_stream_id,
             coalesce(en_vivo_control -> v_stream_id, '{}'::jsonb) || p_cambios
           ),
      updated_at = now()
  where id = true;
end;
$$;

revoke all on function public.control_en_vivo_link(text, jsonb) from public;
grant execute on function public.control_en_vivo_link(text, jsonb) to anon, authenticated;

-- ============================================================
-- PRUEBAS (corre cada una en el SQL Editor)
-- ============================================================
-- 1) RLS activo y 4 políticas:
--    select relrowsecurity from pg_class where oid = 'public.site_config'::regclass;   -- true
--    select policyname, cmd from pg_policies where tablename = 'site_config';          -- 4 filas
-- 2) La función existe:
--    select proname, prosecdef from pg_proc where proname = 'control_en_vivo_link';    -- prosecdef = true
-- 3) Token malo debe fallar:
--    select public.control_en_vivo_link('token-que-no-existe-123456', '{"overlay":null}'::jsonb);  -- error "Link inválido o desactivado"
--
-- ============================================================
-- ROLLBACK (si algo falla, corre esto y todo vuelve a como estaba)
-- ============================================================
-- alter table public.site_config disable row level security;
-- drop policy if exists gm_site_config_select on public.site_config;
-- drop policy if exists gm_site_config_insert on public.site_config;
-- drop policy if exists gm_site_config_update on public.site_config;
-- drop policy if exists gm_site_config_delete on public.site_config;
-- drop function if exists public.control_en_vivo_link(text, jsonb);
