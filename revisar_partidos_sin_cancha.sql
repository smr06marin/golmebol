-- =====================================================================
-- PARTIDOS JUGADOS SIN CANCHA: ¿dónde se jugaron de verdad?
-- Pegar COMPLETO en Supabase → SQL Editor → RUN. Solo LEE: no cambia nada.
-- Por cada partido ya jugado que la app no puede ubicar en una cancha, te muestra:
--   lugar_guardado        = lo que quedó escrito en el partido (o "(vacío)")
--   ese_dia_en_otros      = dónde se jugaron los demás partidos de ESE día en el mismo torneo
-- Con eso se ve si es un nombre escrito distinto o si nunca se puso cancha.
-- =====================================================================
select
  t.name as torneo,
  (m.played_at at time zone 'America/Bogota')::date as fecha,
  to_char(m.played_at at time zone 'America/Bogota', 'HH12:MI AM') as hora,
  coalesce(h.name, '?') || ' vs ' || coalesce(a.name, '?') as partido,
  coalesce(m.tipo_resultado, 'jugado') as tipo,
  coalesce(m.location, '(vacío)') as lugar_guardado,
  (select string_agg(distinct x.location, '  |  ')
     from matches x
    where x.tournament_id = m.tournament_id and x.id <> m.id and x.location is not null
      and (x.played_at at time zone 'America/Bogota')::date = (m.played_at at time zone 'America/Bogota')::date) as ese_dia_en_otros
from matches m
join tournaments t on t.id = m.tournament_id
left join teams h on h.id = m.home_team_id
left join teams a on a.id = m.away_team_id
where m.status = 'finished'
  and m.cancha_id is null
  and (m.location is null
       or not exists (select 1 from canchas c where c.tournament_id = m.tournament_id and c.nombre = m.location))
order by t.name, m.played_at;
