-- ============================================================
-- PLANILLA DEL EQUIPO EN PDF (foto, nombre, cédula, fecha de nacimiento, firma)
--
-- La cédula y la fecha de nacimiento son datos protegidos: la tabla de jugadores
-- solo la leen cuentas reales, nunca el link público. Estas funciones entregan
-- la lista de UN equipo en UN torneo con permiso controlado:
--
--   · planilla_equipo_organizador(equipo, torneo)
--       → el organizador dueño del torneo o un admin principal.
--   · planilla_equipo_representante(token_del_equipo, torneo)
--       → el dueño/representante del equipo (quien entró con su cédula y
--         contraseña de Golmebol). Solo ve SU equipo.
--
-- No cambia nada de lo que ya existe. Se puede ejecutar varias veces.
-- Cómo ejecutar: Supabase → SQL Editor → pegar todo → RUN.
-- ============================================================

-- Arma los datos (uso interno: no se le da permiso a nadie directamente)
create or replace function public._planilla_equipo_datos(p_team_id uuid, p_tournament_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team teams%rowtype;
  v_tor tournaments%rowtype;
  v_jug jsonb;
begin
  select * into v_team from teams where id = p_team_id;
  if not found then raise exception 'Equipo no encontrado'; end if;
  select * into v_tor from tournaments where id = p_tournament_id;
  if not found then raise exception 'Torneo no encontrado'; end if;

  if not exists (select 1 from tournament_teams tt where tt.tournament_id = p_tournament_id and tt.team_id = p_team_id)
     and not exists (select 1 from tournament_player_registrations r where r.tournament_id = p_tournament_id and r.team_id = p_team_id) then
    raise exception 'Ese equipo no está en este torneo';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', p.id,
           'name', p.name,
           'cedula', to_jsonb(p) ->> 'numero_cedula',
           'fecha_nacimiento', to_jsonb(p) ->> 'fecha_nacimiento',
           'foto', coalesce(nullif(to_jsonb(p) ->> 'photo_face_url', ''), nullif(to_jsonb(p) ->> 'photo_url', ''))
         ) order by lower(coalesce(p.name, ''))), '[]'::jsonb)
    into v_jug
  from players p
  where p.id in (
    select r.player_id from tournament_player_registrations r
    where r.tournament_id = p_tournament_id and r.team_id = p_team_id and r.activo = true
  );

  return jsonb_build_object(
    'equipo', jsonb_build_object(
      'id', v_team.id,
      'name', v_team.name,
      'logo_url', v_team.logo_url,
      'city', to_jsonb(v_team) ->> 'city',
      'representante_nombre', to_jsonb(v_team) ->> 'representante_nombre'
    ),
    'torneo', jsonb_build_object(
      'id', v_tor.id,
      'name', v_tor.name,
      'modalidad', to_jsonb(v_tor) ->> 'modalidad'
    ),
    'jugadores', v_jug,
    'generado', now()
  );
end;
$$;

revoke all on function public._planilla_equipo_datos(uuid, uuid) from public, anon, authenticated;

-- ── Organizador (o admin principal) ─────────────────────────────────────
create or replace function public.planilla_equipo_organizador(p_team_id uuid, p_tournament_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_organizador uuid;
begin
  if auth.uid() is null or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'Debes iniciar sesión';
  end if;
  select organizador_id into v_organizador from tournaments where id = p_tournament_id;
  if not found then raise exception 'Torneo no encontrado'; end if;
  if v_organizador is distinct from auth.uid()
     and v_email not in ('golmebol@gmail.com', 'smr06marin@gmail.com') then
    raise exception 'No autorizado';
  end if;
  return public._planilla_equipo_datos(p_team_id, p_tournament_id);
end;
$$;

revoke all on function public.planilla_equipo_organizador(uuid, uuid) from public, anon;
grant execute on function public.planilla_equipo_organizador(uuid, uuid) to authenticated;

-- ── Dueño / representante del equipo ────────────────────────────────────
-- p_token es el del link de registro del equipo. La sesión debe ser de una
-- cuenta real (cédula@golmebol.com) y esa cédula debe ser la del representante
-- registrado del equipo. Si el equipo no tiene representante, no se entrega nada.
create or replace function public.planilla_equipo_representante(p_token text, p_tournament_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team teams%rowtype;
  v_ced text;
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_ok boolean;
begin
  if auth.uid() is null or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'Debes iniciar sesión';
  end if;
  if nullif(trim(coalesce(p_token, '')), '') is null then raise exception 'Link inválido'; end if;
  select * into v_team from teams where registro_token::text = trim(p_token) limit 1;
  if not found then raise exception 'Link inválido'; end if;

  v_ced := nullif(trim(coalesce(v_team.representante_cedula, '')), '');
  if v_ced is null then raise exception 'Este equipo no tiene un dueño registrado'; end if;

  v_ok := v_email = lower(v_ced) || '@golmebol.com'
       or exists (select 1 from players p where p.user_id = auth.uid() and trim(coalesce(p.numero_cedula, '')) = v_ced);
  if not v_ok then raise exception 'Solo el dueño del equipo puede descargar la planilla'; end if;

  return public._planilla_equipo_datos(v_team.id, p_tournament_id);
end;
$$;

revoke all on function public.planilla_equipo_representante(text, uuid) from public, anon;
grant execute on function public.planilla_equipo_representante(text, uuid) to authenticated;
