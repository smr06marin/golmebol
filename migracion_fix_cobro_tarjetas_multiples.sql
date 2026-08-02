-- Corrige el cobro de tarjetas de los torneos que YA se cerraron (donde se
-- usó el botón "Guardar logros", que es lo que genera la deuda personal por
-- tarjetas en torneo_finanzas).
--
-- Antes, si a un jugador le sacaban VARIAS tarjetas en un mismo partido (ej.
-- amarilla + roja, o dos amarillas), se le cobraban TODAS sumadas. La regla
-- correcta es: si le sacan varias en un mismo partido, solo se cobra la de
-- MAYOR VALOR de ese partido — no la suma.
--
-- Este script recorre los torneos que cobran por tarjetas (finanzas_config
-- con algún precio > 0) y que YA tienen deuda personal generada (es decir,
-- que ya se cerraron con "Guardar logros" en algún momento), y recalcula esa
-- deuda con la regla correcta.
--
-- IMPORTANTE — qué SÍ y qué NO toca:
--   - Solo borra y vuelve a insertar las filas de tipo 'deuda_personal' que
--     todavía están SIN PAGAR (pagado = false). Las que ya se marcaron como
--     pagadas se dejan intactas (ese dinero ya se cobró, no se ajusta solo).
--   - No toca 'pago_tarjetas' (pagos ya registrados por equipo) ni ningún
--     otro movimiento — esos son datos reales de plata que ya entró.
--   - Solo procesa torneos que NO están en curso (los que aún no se cierran
--     no tienen deuda_personal todavía, y no se les genera de una con este
--     script — eso lo sigue haciendo "Guardar logros" cuando corresponda,
--     ya con el código corregido).
--
-- Es seguro re-ejecutar: si se corre dos veces seguidas da el mismo resultado.

do $$
declare
  torneo record;
begin
  for torneo in
    select t.id, t.finanzas_config, t.name
    from tournaments t
    where coalesce((t.finanzas_config->>'precio_amarilla')::numeric, 0)
        + coalesce((t.finanzas_config->>'precio_azul')::numeric, 0)
        + coalesce((t.finanzas_config->>'precio_roja')::numeric, 0) > 0
      and exists (
        select 1 from torneo_finanzas tf
        where tf.tournament_id = t.id and tf.tipo = 'deuda_personal'
      )
  loop
    -- Solo se tocan las deudas personales de este torneo que TODAVÍA no se
    -- pagaron — las pagadas quedan como están. (Statement aparte: el WITH de
    -- abajo solo puede ir pegado a UN statement, y este DELETE no lo necesita.)
    delete from torneo_finanzas
    where tournament_id = torneo.id and tipo = 'deuda_personal' and pagado = false;

    -- Igual que hace la app al cerrar el torneo: el saldo pendiente del
    -- equipo (cargo correcto menos lo ya pagado) se reparte entre sus
    -- jugadores en proporción a lo que cada uno generó.
    with precios as (
      select
        coalesce((torneo.finanzas_config->>'precio_amarilla')::numeric, 0) as pa,
        coalesce((torneo.finanzas_config->>'precio_azul')::numeric, 0)     as pz,
        coalesce((torneo.finanzas_config->>'precio_roja')::numeric, 0)     as pr
    ),
    -- Un jugador en un partido = una fila de player_match_stats. Si esa fila
    -- tiene varias tarjetas (de distinto color), solo cuenta la de mayor
    -- precio de ESE partido.
    por_partido as (
      select
        pms.player_id,
        pms.team_id,
        pms.match_id,
        greatest(
          case when pms.yellow_cards > 0 then p.pa else 0 end,
          case when pms.blue_cards   > 0 then p.pz else 0 end,
          case when pms.red_cards    > 0 then p.pr else 0 end
        ) as monto_partido
      from player_match_stats pms, precios p
      where pms.tournament_id = torneo.id
        and pms.player_id is not null
        and (pms.yellow_cards > 0 or pms.blue_cards > 0 or pms.red_cards > 0)
    ),
    -- Valor total correcto por jugador: suma de lo máximo de cada partido.
    valor_jugador as (
      select player_id, team_id, sum(monto_partido) as valor
      from por_partido
      where monto_partido > 0
      group by player_id, team_id
    ),
    -- Cargo total correcto por equipo (suma de sus jugadores).
    cargo_equipo as (
      select team_id, sum(valor) as cargo
      from valor_jugador
      group by team_id
    ),
    -- Lo que el equipo ya pagó de tarjetas (esto no cambia con la regla nueva).
    pagos_equipo as (
      select team_id, sum(monto) as pagado
      from torneo_finanzas
      where tournament_id = torneo.id and tipo = 'pago_tarjetas'
      group by team_id
    )
    insert into torneo_finanzas (tournament_id, team_id, player_id, tipo, monto, concepto, pagado)
    select
      torneo.id,
      vj.team_id,
      vj.player_id,
      'deuda_personal',
      round(vj.valor * (greatest(0, ce.cargo - coalesce(pe.pagado, 0)) / ce.cargo)),
      concat('Tarjetas del torneo ', coalesce(torneo.name, ''), ' (recalculado: solo se cobra la de mayor valor por partido)'),
      false
    from valor_jugador vj
    join cargo_equipo ce on ce.team_id = vj.team_id
    left join pagos_equipo pe on pe.team_id = vj.team_id
    where ce.cargo > 0
      and greatest(0, ce.cargo - coalesce(pe.pagado, 0)) > 0
      and round(vj.valor * (greatest(0, ce.cargo - coalesce(pe.pagado, 0)) / ce.cargo)) > 0;
  end loop;
end $$;
