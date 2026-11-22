-- ════════════════════════════════════════════════════════════════════════════════════════════
-- Logro "Ser Mejor Arquero": ahora cuenta cuando un ARQUERO es escogido MVP de un partido.
--
-- Antes: mejor_arquero_count solo contaba el premio "Mejor arquero" del torneo (tournament_logros
-- tipo 'mejor_arquero'), pero ese premio no se puede entregar desde la app, así que el logro nunca
-- se cumplía. Ahora cuenta:
--   · cada partido en que el jugador (si es Portero) fue escogido MVP por el árbitro (tipo 'mvp'), y
--   · el premio "Mejor arquero / Mejor portero" del torneo, si algún día se entrega.
--
-- Además: apenas el árbitro guarda el MVP (o se borra), se recalculan las estadísticas y los logros
-- de ese jugador, sin esperar a su siguiente partido.
--
-- Al final se recalcula a todos los arqueros que ya fueron MVP, para que se les marque de una vez.
-- Correr UNA vez en Supabase → SQL Editor. Se puede volver a correr sin problema.
-- ════════════════════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.recalcular_player_stats(p_player_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_stats       player_match_stats%ROWTYPE;
  v_pj          integer := 0;
  v_victorias   integer := 0;
  v_empates     integer := 0;
  v_derrotas    integer := 0;
  v_goles       integer := 0;
  v_dobletes    integer := 0;
  v_hat_tricks  integer := 0;
  v_sin_tarjetas integer := 0;
  v_racha_goles integer := 0;
  v_racha_goles_max integer := 0;
  v_racha_vict  integer := 0;
  v_racha_vict_max integer := 0;
  v_arcos_cero  integer := 0;
  v_campeonatos integer := 0;
  v_mvp         integer := 0;
  v_mejor_arq   integer := 0;
  v_mvp_arquero integer := 0;
  v_valla       integer := 0;
  v_goleador    integer := 0;
  v_es_portero  boolean := false;
  r             RECORD;
BEGIN
  -- Detectar posición
  SELECT (posicion_futbol5 = 'Portero' OR posicion_futbol7 = 'Portero' OR posicion_futbol11 = 'Portero')
  INTO v_es_portero FROM players WHERE id = p_player_id;
  v_es_portero := COALESCE(v_es_portero, false);

  -- Recorrer partidos en orden cronológico
  FOR r IN
    SELECT pms.goals_scored, pms.goals_conceded, pms.team_result,
           pms.yellow_cards, pms.blue_cards, pms.red_cards
    FROM player_match_stats pms
    JOIN matches m ON m.id = pms.match_id
    WHERE pms.player_id = p_player_id
    ORDER BY m.played_at ASC
  LOOP
    v_pj := v_pj + 1;

    -- Resultado
    IF r.team_result = 'win'  THEN v_victorias := v_victorias + 1; END IF;
    IF r.team_result = 'draw' THEN v_empates   := v_empates   + 1; END IF;
    IF r.team_result = 'loss' THEN v_derrotas  := v_derrotas  + 1; END IF;

    -- Goles
    v_goles := v_goles + COALESCE(r.goals_scored, 0);
    IF COALESCE(r.goals_scored, 0) >= 2 THEN v_dobletes  := v_dobletes  + 1; END IF;
    IF COALESCE(r.goals_scored, 0) >= 3 THEN v_hat_tricks := v_hat_tricks + 1; END IF;

    -- Racha de goles
    IF COALESCE(r.goals_scored, 0) > 0 THEN
      v_racha_goles := v_racha_goles + 1;
      IF v_racha_goles > v_racha_goles_max THEN v_racha_goles_max := v_racha_goles; END IF;
    ELSE
      v_racha_goles := 0;
    END IF;

    -- Racha de victorias
    IF r.team_result = 'win' THEN
      v_racha_vict := v_racha_vict + 1;
      IF v_racha_vict > v_racha_vict_max THEN v_racha_vict_max := v_racha_vict; END IF;
    ELSE
      v_racha_vict := 0;
    END IF;

    -- Arcos en cero (portero)
    IF v_es_portero AND COALESCE(r.goals_conceded, 0) = 0 THEN
      v_arcos_cero := v_arcos_cero + 1;
    END IF;

    -- Partidos sin tarjetas
    IF COALESCE(r.yellow_cards, 0) = 0 AND COALESCE(r.blue_cards, 0) = 0 AND COALESCE(r.red_cards, 0) = 0 THEN
      v_sin_tarjetas := v_sin_tarjetas + 1;
    END IF;
  END LOOP;

  -- Logros de torneo
  SELECT COUNT(*) INTO v_campeonatos FROM tournament_logros WHERE player_id = p_player_id AND tipo = 'campeon';
  SELECT COUNT(*) INTO v_mvp         FROM tournament_logros WHERE player_id = p_player_id AND tipo = 'mejor_jugador';
  SELECT COUNT(*) INTO v_mejor_arq   FROM tournament_logros WHERE player_id = p_player_id AND tipo IN ('mejor_arquero', 'mejor_portero');
  SELECT COUNT(*) INTO v_valla       FROM tournament_logros WHERE player_id = p_player_id AND tipo = 'valla_menos_vencida';
  SELECT COUNT(*) INTO v_goleador    FROM tournament_logros WHERE player_id = p_player_id AND tipo = 'goleador';

  -- NUEVO: un arquero escogido MVP de un partido cuenta como "Mejor arquero" (una vez por partido)
  IF v_es_portero THEN
    SELECT COUNT(DISTINCT COALESCE(match_id::text, id::text)) INTO v_mvp_arquero
    FROM tournament_logros WHERE player_id = p_player_id AND tipo = 'mvp';
    v_mejor_arq := v_mejor_arq + COALESCE(v_mvp_arquero, 0);
  END IF;

  -- Upsert en cache
  INSERT INTO player_stats_cache (
    player_id, pj, victorias, empates, derrotas, goles, dobletes, hat_tricks,
    racha_goles_actual, racha_victorias_actual, racha_victorias_max,
    arcos_cero, partidos_sin_tarjetas,
    campeonatos, mvp_count, mejor_arquero_count, valla_menos_vencida_count,
    goleador_torneo_count, updated_at
  ) VALUES (
    p_player_id, v_pj, v_victorias, v_empates, v_derrotas, v_goles, v_dobletes, v_hat_tricks,
    v_racha_goles, v_racha_vict, v_racha_vict_max,
    v_arcos_cero, v_sin_tarjetas,
    v_campeonatos, v_mvp, v_mejor_arq, v_valla,
    v_goleador, now()
  )
  ON CONFLICT (player_id) DO UPDATE SET
    pj = EXCLUDED.pj, victorias = EXCLUDED.victorias, empates = EXCLUDED.empates,
    derrotas = EXCLUDED.derrotas, goles = EXCLUDED.goles, dobletes = EXCLUDED.dobletes,
    hat_tricks = EXCLUDED.hat_tricks, racha_goles_actual = EXCLUDED.racha_goles_actual,
    racha_victorias_actual = EXCLUDED.racha_victorias_actual,
    racha_victorias_max = EXCLUDED.racha_victorias_max,
    arcos_cero = EXCLUDED.arcos_cero, partidos_sin_tarjetas = EXCLUDED.partidos_sin_tarjetas,
    campeonatos = EXCLUDED.campeonatos, mvp_count = EXCLUDED.mvp_count,
    mejor_arquero_count = EXCLUDED.mejor_arquero_count,
    valla_menos_vencida_count = EXCLUDED.valla_menos_vencida_count,
    goleador_torneo_count = EXCLUDED.goleador_torneo_count,
    updated_at = now();
END;
$function$;

-- Cuando se guarda o se borra un MVP / premio de arquero, se recalcula a ese jugador al instante.
CREATE OR REPLACE FUNCTION public.trg_logro_arquero_recalcular()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_player uuid := COALESCE(NEW.player_id, OLD.player_id);
  v_tipo   text := COALESCE(NEW.tipo, OLD.tipo);
BEGIN
  IF v_player IS NOT NULL AND v_tipo IN ('mvp', 'mejor_arquero', 'mejor_portero') THEN
    BEGIN
      PERFORM public.recalcular_player_stats(v_player);
      PERFORM public.verificar_logros(v_player);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'No se pudieron recalcular los logros del jugador %: %', v_player, SQLERRM; -- nunca impide guardar el MVP
    END;
  END IF;
  RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS trg_logro_arquero_recalcular ON public.tournament_logros;
CREATE TRIGGER trg_logro_arquero_recalcular
  AFTER INSERT OR DELETE ON public.tournament_logros
  FOR EACH ROW EXECUTE FUNCTION public.trg_logro_arquero_recalcular();

-- Ponerse al día: arqueros que ya fueron MVP o tienen premio de arquero
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT DISTINCT tl.player_id
    FROM public.tournament_logros tl
    JOIN public.players p ON p.id = tl.player_id
    WHERE tl.tipo IN ('mvp', 'mejor_arquero', 'mejor_portero')
      AND (p.posicion_futbol5 = 'Portero' OR p.posicion_futbol7 = 'Portero' OR p.posicion_futbol11 = 'Portero')
  LOOP
    PERFORM public.recalcular_player_stats(r.player_id);
    PERFORM public.verificar_logros(r.player_id);
  END LOOP;
END $$;

-- Para revisar (opcional): arqueros con su conteo de "Mejor arquero"
-- select p.name, c.mejor_arquero_count from public.player_stats_cache c join public.players p on p.id = c.player_id
-- where c.mejor_arquero_count > 0 order by c.mejor_arquero_count desc;
