-- ============================================================
-- ARREGLO: "Link de registro inválido" al abrir el link de registro de un equipo
-- Cómo ejecutar: Supabase → SQL Editor → pegar todo → RUN. Es seguro correrlo más de una vez.
--
-- Causa: en la base, teams.registro_token es de tipo UUID. Las funciones nuevas de seguridad
-- (info_registro_equipo y es_representante_equipo, del paso 1 de "datos del representante") lo
-- comparaban directo con texto y Postgres respondía "operator does not exist: uuid = text".
-- Con el bloqueo del paso 2 puesto, la app ya no podía leer el equipo de otra forma y todos los
-- links de registro salían como inválidos.
-- Solución: comparar como texto (igual que ya hacen registrar_equipo y las demás funciones).
-- Nada más cambia: mismas respuestas, mismos permisos.
-- ============================================================

create or replace function public.info_registro_equipo(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare v teams%rowtype;
begin
  if nullif(trim(coalesce(p_token, '')), '') is null then return null; end if;
  select * into v from teams where registro_token::text = trim(p_token) limit 1;
  if not found then return null; end if;
  return jsonb_build_object(
    'id', v.id,
    'name', v.name,
    'logo_url', v.logo_url,
    'representante_nombre', v.representante_nombre,
    'registro_token_horas', v.registro_token_horas,
    'registro_token_generado_en', v.registro_token_generado_en,
    'tiene_representante', nullif(trim(coalesce(v.representante_cedula, '')), '') is not null
  );
end $$;

create or replace function public.es_representante_equipo(p_token text, p_cedula text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare v teams%rowtype;
begin
  if nullif(trim(coalesce(p_token, '')), '') is null then return false; end if;
  select * into v from teams where registro_token::text = trim(p_token) limit 1;
  if not found then return false; end if;
  if nullif(trim(coalesce(v.representante_cedula, '')), '') is null then return true; end if;
  return trim(v.representante_cedula) = trim(coalesce(p_cedula, ''));
end $$;

revoke all on function public.info_registro_equipo(text), public.es_representante_equipo(text, text) from public;
grant execute on function public.info_registro_equipo(text), public.es_representante_equipo(text, text) to anon, authenticated;

-- Comprobación (opcional): debe devolver el equipo (no null). Cambia el texto por un token real
-- de un equipo: select registro_token from teams limit 1;
-- select public.info_registro_equipo((select registro_token::text from teams limit 1));
