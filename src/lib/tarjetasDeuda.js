import { supabase } from './supabase'

// Construye, a partir de las filas de player_match_stats de un torneo, quiénes
// deben tarjeta (sin pagar) y el detalle de qué deben (tipo, cantidad, monto,
// partido). Se usa tanto en la carga inicial de la planilla (completa y
// rápida) como en el refresco en tiempo real cuando alguien registra un pago
// desde otro lado.
// matchesInfo es un mapa match_id -> { played_at, home_team_id, away_team_id }
// (se trae aparte, con un .in() sobre matches, para no depender de que exista
// una relación/FK declarada entre player_match_stats y matches en la BD).
export function construirDeudaTarjetas(filas, finanzasConfig, matchesInfo = {}) {
  const cobra = (finanzasConfig?.precio_amarilla || 0) + (finanzasConfig?.precio_azul || 0) + (finanzasConfig?.precio_roja || 0) > 0
  const idsDebenTarjeta = new Set()
  const detallePorJugador = {}
  const idsEquipos = new Set()
  if (cobra) {
    (filas || []).forEach(s => {
      const items = []
      if (s.yellow_cards > 0 && !s.yellow_paid) items.push({ tipo: 'Amarilla', cantidad: s.yellow_cards, monto: (finanzasConfig.precio_amarilla || 0) * s.yellow_cards })
      if (s.blue_cards > 0 && !s.blue_paid) items.push({ tipo: 'Azul', cantidad: s.blue_cards, monto: (finanzasConfig.precio_azul || 0) * s.blue_cards })
      if (s.red_cards > 0 && !s.red_paid) items.push({ tipo: 'Roja', cantidad: s.red_cards, monto: (finanzasConfig.precio_roja || 0) * s.red_cards })
      if (items.length === 0) return
      idsDebenTarjeta.add(s.player_id)
      const m = matchesInfo[s.match_id]
      if (m?.home_team_id) idsEquipos.add(m.home_team_id)
      if (m?.away_team_id) idsEquipos.add(m.away_team_id)
      const conDatos = items.map(it => ({ ...it, fecha: m?.played_at || null, home_team_id: m?.home_team_id || null, away_team_id: m?.away_team_id || null }))
      detallePorJugador[s.player_id] = [...(detallePorJugador[s.player_id] || []), ...conDatos]
    })
  }
  return { idsDebenTarjeta, detallePorJugador, idsEquipos }
}

// Trae played_at/home_team_id/away_team_id de un set de partidos (para el
// detalle de deuda de tarjetas) en una sola consulta con .in().
export async function fetchMatchesInfo(matchIds) {
  const ids = [...new Set((matchIds || []).filter(Boolean))]
  if (ids.length === 0) return {}
  const { data } = await supabase.from('matches').select('id, played_at, home_team_id, away_team_id').in('id', ids)
  const mapa = {}
  ;(data || []).forEach(m => { mapa[m.id] = m })
  return mapa
}
