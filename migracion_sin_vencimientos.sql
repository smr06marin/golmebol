-- ============================================================
-- GOLMEBOL — Sin vencimientos: jugadores y árbitros siempre activos
-- ============================================================
-- Ejecutar en Supabase → SQL Editor. Es idempotente (se puede correr varias veces).
--
-- Qué hace:
--  1) Deja activo_membresia = true a TODOS los jugadores y árbitros.
--  2) Borra fecha_vencimiento de jugadores y árbitros normales.
--     NO toca la mensualidad de las ESCUELAS (jugadores de escuela) ni los
--     datos de profesores / encargados de escenario: eso es otro módulo.
--  3) Deja el default de la columna en true y un trigger que impide que un
--     jugador o árbitro vuelva a quedar inactivo (aunque algún código viejo
--     o un registro nuevo intente guardarlo como false).
-- ============================================================

-- ¿Aplica "sin vencimiento" a esta fila? (no aplica a profesores ni encargados
-- de escenario). Usa jsonb para no fallar si alguna columna no existe todavía.
create or replace function public._sin_venc_aplica(j jsonb)
returns boolean
language sql
immutable
as $$
  select not (
       coalesce((j ->> 'es_profesor')::boolean, false)
    or coalesce((j ->> 'es_profesor_coordinador')::boolean, false)
    or coalesce((j ->> 'es_encargado_escenario')::boolean, false)
    or coalesce(j ->> 'rol', '') = 'profesor'
  );
$$;

-- 1) Todos activos
update public.players p
   set activo_membresia = true
 where p.activo_membresia is distinct from true
   and public._sin_venc_aplica(to_jsonb(p));

-- 2) Sin fecha de vencimiento (salvo jugadores de escuelas)
update public.players p
   set fecha_vencimiento = null
 where p.fecha_vencimiento is not null
   and public._sin_venc_aplica(to_jsonb(p))
   and coalesce((to_jsonb(p) ->> 'es_jugador_escuela')::boolean, false) = false
   and not exists (
         select 1
           from public.team_players tp
          where tp.player_id = p.id
            and tp.team_id in (select escuela_id from public.players where escuela_id is not null)
       );

-- 3) Default en true + trigger que lo garantiza
alter table public.players alter column activo_membresia set default true;

create or replace function public.players_siempre_activos()
returns trigger
language plpgsql
as $$
begin
  if public._sin_venc_aplica(to_jsonb(new)) then
    new.activo_membresia := true;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_players_siempre_activos on public.players;
create trigger trg_players_siempre_activos
  before insert or update on public.players
  for each row execute function public.players_siempre_activos();

-- Verificación (debe dar 0 inactivos entre jugadores/árbitros):
-- select count(*) from public.players p
--  where activo_membresia is distinct from true and public._sin_venc_aplica(to_jsonb(p));
