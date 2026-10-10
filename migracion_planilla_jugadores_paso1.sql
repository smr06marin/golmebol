-- ============================================================
-- PLANILLA SEGURA — PASO 1 (solo agrega una función, no quita nada)
-- Cómo ejecutar: Supabase → SQL Editor → pegar todo → RUN
-- Es seguro ejecutarlo más de una vez.
--
-- Qué hace: las planillas por link (sesión anónima, sin cuenta) necesitan
-- ver nombre, foto y cédula de los jugadores del partido. Esta función
-- se los da por el servidor, con límites:
--   * solo jugadores inscritos en torneos ACTIVOS (no todos los jugadores)
--   * máximo 300 por llamada
--   * la cédula sale enmascarada (••••1234) para sesiones anónimas
-- Así se puede cerrar después la lectura de `players` a las sesiones anónimas.
-- ============================================================

create or replace function public.planilla_jugadores(p_ids uuid[])
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_anon boolean := coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false);
  v_res  jsonb;
begin
  if auth.uid() is null then
    raise exception 'Debes tener una sesión';
  end if;
  if p_ids is null or cardinality(p_ids) = 0 then return '[]'::jsonb; end if;
  if cardinality(p_ids) > 300 then
    raise exception 'Demasiados jugadores en una sola consulta';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
      'id',                          p.id,
      'name',                        p.name,
      'numero_cedula',               case
                                       when v_anon and p.numero_cedula is not null
                                         then '••••' || right(p.numero_cedula, 4)
                                       else p.numero_cedula
                                     end,
      'photo_face_url',              p.photo_face_url,
      'photo_url',                   p.photo_url,
      'posicion_futbol5',            p.posicion_futbol5,
      'posicion_futbol7',            p.posicion_futbol7,
      'posicion_futbol11',           p.posicion_futbol11,
      'foto_cambiar_tarjeta',        p.foto_cambiar_tarjeta,
      'foto_cambiar_perfil',         p.foto_cambiar_perfil,
      'foto_cambiar_cedula_frontal', p.foto_cambiar_cedula_frontal,
      'foto_cambiar_cedula_trasera', p.foto_cambiar_cedula_trasera
    )), '[]'::jsonb)
  into v_res
  from public.players p
  where p.id = any (p_ids)
    and exists (
      select 1
      from public.tournament_player_registrations r
      join public.tournaments t on t.id = r.tournament_id
      where r.player_id = p.id
        and t.status = 'active'
    );

  return v_res;
end
$$;

revoke all on function public.planilla_jugadores(uuid[]) from public, anon;
grant execute on function public.planilla_jugadores(uuid[]) to authenticated;

-- Comprobación (opcional): debe devolver una lista (puede ser corta si el torneo no está activo)
-- select public.planilla_jugadores(array(select id from players limit 3));
