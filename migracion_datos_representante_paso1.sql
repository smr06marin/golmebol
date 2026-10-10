-- ============================================================
-- PROTEGER DATOS PRIVADOS DE EQUIPOS Y TORNEOS — PASO 1 de 2 (no rompe nada)
--
-- PROBLEMA: cualquier visitante (sin iniciar sesión) puede leer con la clave pública de la app:
--   · teams: cédula, teléfono y nombre del representante, y el token del link de registro
--   · tournaments: el token Y la contraseña del link de deudores de tarjetas
--     (con eso se puede abrir el link y marcar tarjetas como pagadas)
-- La página pública del torneo los descargaba sin querer en cada visita (tabla teams(*) y tournaments *).
--
-- ESTE PASO solo AGREGA cosas, no quita permisos:
--   1) Vistas públicas SIN esas columnas: teams_publico, tournaments_publico, tournament_teams_publico
--   2) Funciones para los 3 lugares donde un visitante sin sesión sí necesita algo del representante:
--        info_registro_equipo(token)  → link de registro de equipo
--        es_representante_equipo(token, cédula) → ¿esta cédula es la del representante? (sí/no)
--        dueno_equipo_por_cedula(cédula) → entrada de un dueño de equipo que aún no es jugador
--
-- ORDEN: 1) correr ESTE archivo  2) publicar la versión nueva de la app  3) probar (abajo)
--        4) correr el PASO 2 (bloqueo), que es lo que realmente cierra el hueco.
--
-- Cómo ejecutar: Supabase → SQL Editor → pegar todo → RUN. Es seguro correrlo más de una vez.
-- ============================================================

-- Columnas que NO se muestran al público, por tabla.
create or replace function public.columnas_publicas(p_tabla text)
returns text
language sql
stable
set search_path = public
as $$
  select string_agg(format('%I', a.attname), ', ' order by a.attnum)
  from pg_attribute a
  where a.attrelid = to_regclass('public.' || p_tabla)
    and a.attnum > 0
    and not a.attisdropped
    and a.attname <> all (
      case p_tabla
        when 'teams' then array[
          'representante_cedula', 'representante_telefono', 'representante_nombre',
          'registro_token', 'registro_token_horas', 'registro_token_generado_en']
        when 'tournaments' then array['link_deudores_token', 'link_deudores_password']
        else array[]::text[]
      end
    );
$$;

-- Vistas públicas (leen con permisos del dueño, así que siguen funcionando aunque el PASO 2 quite el acceso directo)
do $$
begin
  execute 'drop view if exists public.tournament_teams_publico';
  execute 'drop view if exists public.teams_publico';
  execute 'drop view if exists public.tournaments_publico';
  execute format('create view public.teams_publico as select %s from public.teams', public.columnas_publicas('teams'));
  execute format('create view public.tournaments_publico as select %s from public.tournaments', public.columnas_publicas('tournaments'));
end $$;

-- tournament_teams con el equipo (sin datos privados) ya embebido en la columna "teams",
-- para que la página del torneo siga pidiendo todo en una sola consulta.
create view public.tournament_teams_publico as
select tt.*,
       (select to_jsonb(tp) from public.teams_publico tp where tp.id = tt.team_id) as teams
from public.tournament_teams tt;

revoke all on public.teams_publico, public.tournaments_publico, public.tournament_teams_publico from public;
grant select on public.teams_publico, public.tournaments_publico, public.tournament_teams_publico to anon, authenticated;

-- ── Funciones para visitantes sin sesión ────────────────────────────────────

-- Link de registro de equipo: devuelve solo lo que la pantalla necesita.
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

-- ¿Esta cédula es la del representante del equipo del link? (si el equipo no tiene representante registrado, sí)
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

-- Entrada de un dueño de equipo que aún no es jugador: se busca por su cédula exacta.
create or replace function public.dueno_equipo_por_cedula(p_cedula text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare v record;
begin
  if nullif(trim(coalesce(p_cedula, '')), '') is null then return null; end if;
  select name, representante_nombre, representante_telefono into v
  from teams
  where representante_cedula = trim(p_cedula) and representante_nombre is not null
  limit 1;
  if not found then return null; end if;
  return jsonb_build_object('name', v.name, 'representante_nombre', v.representante_nombre, 'representante_telefono', v.representante_telefono);
end $$;

revoke all on function public.info_registro_equipo(text), public.es_representante_equipo(text, text), public.dueno_equipo_por_cedula(text) from public;
grant execute on function public.info_registro_equipo(text), public.es_representante_equipo(text, text), public.dueno_equipo_por_cedula(text) to anon, authenticated;

-- ── Comprobaciones (opcional): deben dar lo esperado ────────────────────────
-- select count(*) from teams_publico;                       -- = cantidad de equipos
-- select column_name from information_schema.columns where table_name = 'teams_publico' and column_name like 'representante%';   -- 0 filas
-- select column_name from information_schema.columns where table_name = 'tournaments_publico' and column_name like 'link_deudores%'; -- 0 filas
