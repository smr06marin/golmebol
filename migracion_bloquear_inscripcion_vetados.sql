-- ============================================================
-- VETO DE GOLMEBOL: un jugador vetado NO se puede inscribir en ningún torneo
-- Cómo ejecutar: Supabase → SQL Editor → pegar todo → RUN
-- Es seguro ejecutarlo más de una vez.
--
-- Qué hace:
--   Cuando alguien intenta inscribir a un jugador en un torneo (el organizador,
--   el representante del equipo, un link de registro, etc.), la base de datos
--   revisa si ese jugador tiene una sanción GLOBAL vigente (la de "Vetar de
--   Golmebol", tournament_id vacío). Si la tiene, la inscripción se rechaza con
--   un mensaje claro. Aplica mientras dure la sanción:
--     · indefinida (sin fecha de fin) → no se puede inscribir nunca
--     · con fecha de fin             → no se puede hasta que pase esa fecha
--     · sanción quitada              → se puede de nuevo
--
-- Qué NO hace:
--   · No saca al jugador de torneos donde ya estaba inscrito (ahí lo frena la
--     planilla, que ya lee las sanciones globales).
--   · Las suspensiones de UN solo torneo no impiden inscribirse en otros.
--
-- Funciona sin cambios en la app: la regla vive en la base de datos, así que
-- no se puede saltar por ninguna pantalla ni link.
-- ============================================================

create or replace function public.bloquear_inscripcion_vetado()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hay boolean;
  v_indefinido boolean;
  v_fin timestamptz;
begin
  -- Solo al inscribir de verdad (o al reactivar una inscripción apagada)
  if coalesce(new.activo, true) = false then
    return new;
  end if;
  if tg_op = 'UPDATE' and coalesce(old.activo, true) = true then
    return new; -- cambios normales (ej. pasar de equipo): no es una inscripción nueva
  end if;

  select count(*) > 0,
         coalesce(bool_or(s.fecha_fin is null), false),
         max(s.fecha_fin)
    into v_hay, v_indefinido, v_fin
  from public.sanciones s
  where s.player_id = new.player_id
    and s.activa = true
    and s.tournament_id is null
    and (s.fecha_fin is null or s.fecha_fin > now());

  if v_hay then
    if v_indefinido then
      raise exception 'Este jugador está vetado de Golmebol y no puede inscribirse en ningún torneo.'
        using errcode = 'P0001', hint = 'JUGADOR_VETADO';
    else
      raise exception 'Este jugador está vetado de Golmebol hasta el % y no puede inscribirse en ningún torneo antes de esa fecha.', to_char(v_fin, 'DD/MM/YYYY')
        using errcode = 'P0001', hint = 'JUGADOR_VETADO';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_bloquear_inscripcion_vetado on public.tournament_player_registrations;
create trigger trg_bloquear_inscripcion_vetado
  before insert or update of activo on public.tournament_player_registrations
  for each row execute function public.bloquear_inscripcion_vetado();

-- Verificación: debe listar el trigger
select tgname, tgenabled
from pg_trigger
where tgrelid = 'public.tournament_player_registrations'::regclass
  and tgname = 'trg_bloquear_inscripcion_vetado';

-- ============================================================
-- ROLLBACK (solo si algo sale mal): quita el "--" y ejecuta
-- ============================================================
-- drop trigger if exists trg_bloquear_inscripcion_vetado on public.tournament_player_registrations;
-- drop function if exists public.bloquear_inscripcion_vetado();
