-- =====================================================================
-- Deuda personal por deuda del equipo (x2, dividida entre los jugadores
-- que fueron del equipo en ESE torneo) — SOLO torneos organizados por
-- Golmebol (tournaments.organizador_id IS NULL).
--
-- jugador_tiene_deuda devuelve total, concepto y el DETALLE de cada deuda
-- (torneo, equipo, monto que le toca a él) para mostrarle: "el equipo X
-- del torneo Y quedó debiendo plata, se dividió entre los jugadores y a
-- ti te corresponde $Z".
--
-- Bloquea SOLO si el torneo al que se inscribe es de Golmebol, y cuenta
-- solo deudas SIN PAGAR de OTROS torneos de Golmebol. En torneos de
-- organizadores externos no bloquea ni cuenta nada.
-- =====================================================================

drop function if exists public.jugador_tiene_deuda(uuid, uuid);

create or replace function public.jugador_tiene_deuda(p_player_id uuid, p_tournament_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_existe boolean;
  v_total numeric := 0;
  v_detalles jsonb := '[]'::jsonb;
begin
  select true, organizador_id into v_existe, v_org from tournaments where id = p_tournament_id;

  -- Torneo inexistente, o de un organizador externo: no aplica la deuda personal.
  if v_existe is null or v_org is not null then
    return jsonb_build_object('tiene_deuda', false, 'total', 0, 'concepto', null, 'detalles', '[]'::jsonb);
  end if;

  select
    coalesce(sum(f.monto), 0),
    coalesce(jsonb_agg(jsonb_build_object(
      'id', f.id,
      'monto', f.monto,
      'torneo', t.name,
      'torneo_id', t.id,
      'equipo', tm.name,
      'concepto', f.concepto
    ) order by t.name), '[]'::jsonb)
  into v_total, v_detalles
  from torneo_finanzas f
  join tournaments t on t.id = f.tournament_id
  left join teams tm on tm.id = f.team_id
  where f.player_id = p_player_id
    and f.tipo = 'deuda_personal'
    and coalesce(f.pagado, false) = false
    and f.tournament_id <> p_tournament_id
    and t.organizador_id is null;

  return jsonb_build_object(
    'tiene_deuda', v_total > 0,
    'total', v_total,
    'concepto', (select string_agg((x->>'equipo') || ' (' || (x->>'torneo') || ')', ', ') from jsonb_array_elements(v_detalles) x),
    'detalles', v_detalles
  );
end;
$$;

grant execute on function public.jugador_tiene_deuda(uuid, uuid) to anon, authenticated;
