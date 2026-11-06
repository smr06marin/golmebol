-- ROLLBACK DEL PASO 11A — devuelve los permisos y la función como estaban.
begin;

grant execute on function public._login_jugador(text) to anon, authenticated;
grant execute on function public.refrescar_permisos_publicos() to anon, authenticated;
grant execute on function public.recalcular_player_stats(uuid) to anon;
grant execute on function public.verificar_logros(uuid) to anon;

create or replace function public.buscar_jugador_por_cedula(p_cedula text, p_tournament_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_cedula text := trim(p_cedula);
  v_p      players%rowtype;
  v_ya     record;
begin
  if v_cedula is null or v_cedula = '' then
    raise exception 'Cédula vacía';
  end if;

  select * into v_p from players where numero_cedula = v_cedula limit 1;
  if not found then
    return jsonb_build_object('encontrado', false);
  end if;

  if p_tournament_id is not null then
    select r.id, t.name as equipo_nombre
      into v_ya
    from tournament_player_registrations r
    left join teams t on t.id = r.team_id
    where r.tournament_id = p_tournament_id
      and r.player_id = v_p.id
      and r.activo = true
    limit 1;
  end if;

  return jsonb_build_object(
    'encontrado', true,
    'id', v_p.id,
    'name', v_p.name,
    'numero_cedula', v_p.numero_cedula,
    'city', v_p.city,
    'photo_url', v_p.photo_url,
    'photo_face_url', v_p.photo_face_url,
    'telefono', v_p.telefono,
    'whatsapp', v_p.whatsapp,
    'es_arbitro', coalesce(v_p.es_arbitro, false) or v_p.rol = 'arbitro',
    'rol', v_p.rol,
    'tiene_cedula_frontal', v_p.cedula_frontal_url is not null,
    'tiene_cedula_trasera', v_p.cedula_trasera_url is not null,
    'ya_en_torneo', v_ya.id is not null,
    'equipo_en_torneo', v_ya.equipo_nombre
  );
end;
$function$;

commit;
