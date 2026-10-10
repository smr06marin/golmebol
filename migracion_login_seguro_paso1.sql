-- ============================================================
-- LOGIN SEGURO — PASO 1 (solo agrega funciones, no quita nada)
-- Cómo ejecutar: Supabase → SQL Editor → pegar todo → RUN
-- Es seguro ejecutarlo más de una vez.
--
-- Por qué: el login busca al jugador por cédula ANTES de iniciar
-- sesión, pero la tabla `players` ya no se puede leer sin sesión
-- (con razón: tiene cédulas, teléfonos, fechas de nacimiento).
-- Estas funciones hacen esa búsqueda por dentro del servidor y
-- devuelven SOLO lo mínimo:
--   * login_buscar_cedula   → si existe, si ya tiene cuenta, sus roles
--                             y solo el PRIMER nombre (no el completo).
--   * login_verificar_nombre → compara el nombre escrito en el servidor;
--                             solo si coincide devuelve el nombre completo.
-- También crea aquí el perfil del dueño de un equipo que aún no es jugador.
-- ============================================================

-- Ayudante: 1 si el campo del jugador es true, 0 si no (tolera columnas que no existan)
create or replace function public._login_flag(j jsonb, k text)
returns int
language sql
immutable
as $$ select case when coalesce(j ->> k, 'false') = 'true' then 1 else 0 end $$;

-- Ayudante: la fila "buena" para una cédula (por si hubiera duplicados:
-- la que ya tiene cuenta manda; si no, la que tiene más roles)
create or replace function public._login_jugador(p_cedula text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select to_jsonb(p)
  from public.players p
  where p.numero_cedula = trim(coalesce(p_cedula, ''))
    and trim(coalesce(p_cedula, '')) <> ''
  order by (case when p.user_id is not null then 100 else 0 end)
         + public._login_flag(to_jsonb(p), 'es_arbitro')
         + public._login_flag(to_jsonb(p), 'es_arbitro_lider')
         + public._login_flag(to_jsonb(p), 'es_profesor')
         + public._login_flag(to_jsonb(p), 'es_profesor_coordinador')
         + public._login_flag(to_jsonb(p), 'es_encargado_escenario')
         + public._login_flag(to_jsonb(p), 'es_acudiente')
         + public._login_flag(to_jsonb(p), 'es_jugador_escuela') desc
  limit 1
$$;

revoke all on function public._login_flag(jsonb, text) from public;
revoke all on function public._login_jugador(text) from public;

-- 1. Buscar por cédula
create or replace function public.login_buscar_cedula(p_cedula text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  ced text := trim(coalesce(p_cedula, ''));
  j   jsonb;
  eq  record;
begin
  if ced = '' then return jsonb_build_object('encontrado', false); end if;

  j := public._login_jugador(ced);

  -- ¿Es dueño (representante) de un equipo sin perfil de jugador? Se le crea uno mínimo.
  if j is null then
    select representante_nombre, representante_telefono into eq
    from public.teams
    where representante_cedula = ced and representante_nombre is not null
    limit 1;
    if found then
      insert into public.players (name, telefono, numero_cedula, rol, activo_membresia, primer_ingreso, fecha_registro)
      values (eq.representante_nombre, eq.representante_telefono, ced, 'jugador', true, true, now());
      j := public._login_jugador(ced);
    end if;
  end if;

  if j is null then return jsonb_build_object('encontrado', false); end if;

  return jsonb_build_object(
    'encontrado',               true,
    'id',                       j ->> 'id',
    'tiene_cuenta',             (j ->> 'user_id') is not null,
    'primer_ingreso',           j -> 'primer_ingreso',
    'rol',                      j ->> 'rol',
    'es_arbitro',               coalesce((j ->> 'es_arbitro')::boolean, false),
    'es_arbitro_lider',         coalesce((j ->> 'es_arbitro_lider')::boolean, false),
    'es_profesor',              coalesce((j ->> 'es_profesor')::boolean, false),
    'es_profesor_coordinador',  coalesce((j ->> 'es_profesor_coordinador')::boolean, false),
    'es_encargado_escenario',   coalesce((j ->> 'es_encargado_escenario')::boolean, false),
    'es_acudiente',             coalesce((j ->> 'es_acudiente')::boolean, false),
    'es_jugador_escuela',       coalesce((j ->> 'es_jugador_escuela')::boolean, false),
    'equipo_deseado',           j -> 'equipo_deseado',
    'nombre_corto',             split_part(trim(coalesce(j ->> 'name', '')), ' ', 1)
  );
end
$$;

-- 2. Verificar nombre (comparación hecha en el servidor)
create or replace function public.login_verificar_nombre(p_cedula text, p_nombre text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  j         jsonb := public._login_jugador(p_cedula);
  de        text  := 'áéíóúüñ';
  a         text  := 'aeiouun';
  escritas  text[];
  guardadas text[];
begin
  if j is null then return jsonb_build_object('ok', false); end if;

  escritas := array(
    select w from unnest(regexp_split_to_array(trim(translate(lower(coalesce(p_nombre, '')), de, a)), '\s+')) w
    where w <> '');
  guardadas := array(
    select w from unnest(regexp_split_to_array(trim(translate(lower(coalesce(j ->> 'name', '')), de, a)), '\s+')) w
    where w <> '');

  if coalesce(cardinality(escritas), 0) < 2 then
    return jsonb_build_object('ok', false);
  end if;

  if escritas <@ guardadas then
    return jsonb_build_object('ok', true, 'nombre', j ->> 'name');
  end if;
  return jsonb_build_object('ok', false);
end
$$;

revoke all on function public.login_buscar_cedula(text) from public;
revoke all on function public.login_verificar_nombre(text, text) from public;
grant execute on function public.login_buscar_cedula(text) to anon, authenticated;
grant execute on function public.login_verificar_nombre(text, text) to anon, authenticated;

-- Comprobación (opcional): cambia 123 por una cédula real.
-- select public.login_buscar_cedula('123');
