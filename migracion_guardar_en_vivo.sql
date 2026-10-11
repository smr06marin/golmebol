-- ============================================================
-- ARREGLO: el árbitro llena la planilla y el partido no se ve EN VIVO en la página
-- Cómo ejecutar: Supabase → SQL Editor → pegar todo → RUN. Es seguro correrlo más de una vez.
--
-- Causa probable: la planilla sube el avance del partido (reloj, goles, tarjetas) a la tabla de
-- partidos cada pocos segundos, pero esa tabla solo deja modificar al dueño/admin del torneo. Si quien
-- planilla es un árbitro (con cuenta o con link), la base descarta el avance SIN dar error y la página
-- pública nunca ve nada.
--
-- Qué hace: crea guardar_estado_en_vivo(partido, tipo, estado, hora) con permiso controlado. Solo toca
-- las columnas del "en vivo" (live_state / live_state_rapida) y solo mientras el partido NO esté
-- finalizado: no puede cambiar marcadores ni nada más.
-- Pueden usarla: dueño/organizador/admin, árbitros (cuenta de árbitro o árbitro asignado/líder) y
-- quien entró con el link de planillar de ese partido (vigente o vencido hace menos de 36 h).
-- ============================================================

create or replace function public.guardar_estado_en_vivo(
  p_match_id uuid, p_tipo text, p_snap jsonb, p_ts timestamptz)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  m public.matches%rowtype;
  v_ok boolean := false;
begin
  if auth.uid() is null then raise exception 'Sesión requerida'; end if;
  if p_tipo not in ('rapida', 'completa') then raise exception 'Tipo inválido'; end if;

  select * into m from public.matches where id = p_match_id;
  if not found then return false; end if;
  if m.status = 'finished' then return false; end if;   -- partido cerrado: no se toca

  v_ok := coalesce(public.es_dueno_torneo(m.tournament_id), false)
       or coalesce(public.es_organizador_plataforma(), false)
       or (m.link_planilla_expira is not null and m.link_planilla_expira > now() - interval '36 hours')
       or exists (
            select 1 from public.players p
            where p.user_id = auth.uid()
              and (p.es_arbitro is true or p.rol = 'arbitro' or p.es_arbitro_lider is true
                   or p.id in (m.arbitro1_id, m.arbitro2_id, m.arbitro3_id))
          );
  if not coalesce(v_ok, false) then raise exception 'No tienes permiso para planillar este partido'; end if;

  if p_tipo = 'rapida' then
    update public.matches set live_state_rapida = p_snap, live_state_rapida_updated_at = coalesce(p_ts, now()) where id = p_match_id;
  else
    update public.matches set live_state = p_snap, live_state_updated_at = coalesce(p_ts, now()) where id = p_match_id;
  end if;
  return true;
end $$;

revoke all on function public.guardar_estado_en_vivo(uuid, text, jsonb, timestamptz) from public, anon;
grant execute on function public.guardar_estado_en_vivo(uuid, text, jsonb, timestamptz) to authenticated;
