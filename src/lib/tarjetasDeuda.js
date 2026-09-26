import { supabase } from './supabase'

// Construye, a partir de las filas de player_match_stats de un torneo, quiénes
// deben tarjeta (sin pagar) y el detalle de qué deben (tipo cobrado, monto,
// partido). Se usa tanto en la carga inicial de la planilla (completa y
// rápida) como en el refresco en tiempo real cuando alguien registra un pago
// desde otro lado.
//
// REGLA: si a un jugador le sacan VARIAS tarjetas en un mismo partido (ej.
// amarilla + roja, o dos amarillas), solo se le cobra la de MAYOR VALOR de
// ese partido — no la suma de todas. Cada fila de player_match_stats ya es
// un partido de un jugador, así que el "monto" de esa fila es el máximo
// entre los precios de los tipos de tarjeta sin pagar que tenga esa fila.
// (tiposDelPartido queda igual con todos los tipos, solo informativo.)
//
// matchesInfo es un mapa match_id -> { played_at, home_team_id, away_team_id }
// (se trae aparte, con un .in() sobre matches, para no depender de que exista
// una relación/FK declarada entre player_match_stats y matches en la BD).
export function construirDeudaTarjetas(filas, finanzasConfig, matchesInfo = {}) {
  const precios = {
    Amarilla: finanzasConfig?.precio_amarilla || 0,
    Azul: finanzasConfig?.precio_azul || 0,
    Roja: finanzasConfig?.precio_roja || 0,
  }
  const cobra = precios.Amarilla + precios.Azul + precios.Roja > 0
  const idsDebenTarjeta = new Set()
  const detallePorJugador = {}
  const idsEquipos = new Set()
  if (cobra) {
    (filas || []).forEach(s => {
      const sinPagar = []
      if (s.yellow_cards > 0 && !s.yellow_paid) sinPagar.push('Amarilla')
      if (s.blue_cards > 0 && !s.blue_paid) sinPagar.push('Azul')
      if (s.red_cards > 0 && !s.red_paid) sinPagar.push('Roja')
      if (sinPagar.length === 0) return
      idsDebenTarjeta.add(s.player_id)
      // Solo se cobra la de mayor valor de ESTE partido, aunque haya varias.
      const tipoCobrado = sinPagar.reduce((a, b) => (precios[b] > precios[a] ? b : a))
      const m = matchesInfo[s.match_id]
      if (m?.home_team_id) idsEquipos.add(m.home_team_id)
      if (m?.away_team_id) idsEquipos.add(m.away_team_id)
      const item = {
        tipo: tipoCobrado, tiposDelPartido: sinPagar, monto: precios[tipoCobrado],
        fecha: m?.played_at || null, home_team_id: m?.home_team_id || null, away_team_id: m?.away_team_id || null,
      }
      detallePorJugador[s.player_id] = [...(detallePorJugador[s.player_id] || []), item]
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
