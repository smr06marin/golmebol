// Datos base (equipos + partidos + puntos del torneo) para las tablas de
// posiciones que se dibujan sobre la transmisión en vivo. Se refrescan solos
// cada cierto tiempo, así que al terminar un partido la tabla suma el
// resultado definitivo sin recargar nada. Lo que se está jugando AHORA se
// suma aparte con `tablasConVivo` (torneoTablas.js), con los datos rápidos
// del partido en vivo.
import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { cargarTorneoPuntos } from './puntosTorneo'

const COLS_BASE = 'id, status, fase, tipo_resultado, home_team_id, away_team_id, home_score, away_score'
const COLS_VIVO = ', live_state, live_state_updated_at, live_state_rapida, live_state_rapida_updated_at'

async function cargarBase(tid, conVivo) {
  const [torneo, { data: equiposData }, { data: partidos }] = await Promise.all([
    cargarTorneoPuntos(tid),
    supabase.from('tournament_teams').select('teams(id, name, logo_url)').eq('tournament_id', tid),
    supabase.from('matches').select(COLS_BASE + (conVivo ? COLS_VIVO : '')).eq('tournament_id', tid),
  ])
  return { torneo: torneo || {}, equipos: (equiposData || []).map(d => d.teams).filter(Boolean), partidos: partidos || [] }
}

// ids: torneos cuya tabla se necesita. Devuelve { [tournamentId]: base }.
// conVivo: trae también los datos del partido en juego (para vistas que no
// tienen su propia lista de partidos en vivo).
export function useTablasBase(ids, { intervalo = 30000, conVivo = false } = {}) {
  const [bases, setBases] = useState({})
  const key = [...new Set((ids || []).filter(Boolean))].sort().join(',')
  useEffect(() => {
    if (!key) return undefined
    let vivo = true
    const cargar = () => key.split(',').forEach(async tid => {
      try {
        const b = await cargarBase(tid, conVivo)
        if (vivo) setBases(prev => ({ ...prev, [tid]: b }))
      } catch { /* se queda con la tabla anterior hasta el próximo intento */ }
    })
    cargar()
    const t = setInterval(cargar, intervalo)
    return () => { vivo = false; clearInterval(t) }
  }, [key, intervalo, conVivo])
  return bases
}
