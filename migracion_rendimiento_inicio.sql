-- ============================================================
-- PÁGINA DE INICIO MÁS RÁPIDA: resumen de los torneos en UNA consulta
--
-- Antes, para pintar las tarjetas de los torneos (cuántos equipos, "Fecha 5",
-- "Cuartos de final", campeón), cada visitante descargaba TODOS los partidos
-- de TODOS los torneos activos con los escudos de los equipos (miles de
-- filas, y la base corta en 1.000 filas, así que con muchos torneos algunas
-- tarjetas quedaban mal). Ahora la base hace la cuenta y manda una fila por
-- torneo.
--
-- Cómo ejecutar: Supabase → SQL Editor → pegar todo → RUN. Se puede correr más de una vez.
-- Mientras no se corra, la página sigue funcionando como antes (más lenta).
-- ============================================================

create or replace function public.resumen_torneos_inicio()
returns table (
  tournament_id uuid,
  equipos       integer,
  max_jornada   integer,
  fase_top      text,
  final_jugada  boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    t.id,
    (select count(*)::int from tournament_teams tt where tt.tournament_id = t.id),
    (select max(m.matchday)::int from matches m where m.tournament_id = t.id),
    (select m.fase from matches m
      where m.tournament_id = t.id and m.fase is not null and m.fase <> 'grupo'
      order by case m.fase when 'final' then 4 when 'semifinal' then 3 when 'cuartos' then 2 when 'octavos' then 1 else 0 end desc
      limit 1),
    exists (select 1 from matches m where m.tournament_id = t.id and m.fase = 'final' and m.status = 'finished')
  from tournaments t
  where t.status = 'active';
$$;

revoke all on function public.resumen_torneos_inicio() from public;
grant execute on function public.resumen_torneos_inicio() to anon, authenticated;

-- Índices para que estas cuentas (y la tabla de cada torneo) no recorran toda la tabla de partidos
create index if not exists matches_tournament_id_idx on public.matches (tournament_id);
create index if not exists tournament_teams_tournament_id_idx on public.tournament_teams (tournament_id);

-- ── Limpieza: borrador "en vivo" que quedó guardado en partidos YA JUGADOS ──
-- Al terminar un partido la planilla borra su borrador en vivo, pero algunos
-- partidos jugados lo conservan (ej. si se volvió a abrir la planilla después).
-- Ese borrador es la planilla entera (lista de jugadores con su cédula y las
-- firmas en imagen): pesaba ~900 KB por torneo en cada visita a la tabla y no
-- sirve para nada (un partido jugado nunca sale "en vivo"; el resultado, goles
-- y tarjetas ya están guardados aparte). Las firmas oficiales quedan intactas
-- en su propia columna.
update public.matches
   set live_state = null, live_state_updated_at = null
 where status = 'finished' and live_state is not null;

update public.matches
   set live_state_rapida = null, live_state_rapida_updated_at = null
 where status = 'finished' and live_state_rapida is not null;
