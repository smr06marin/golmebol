// Datos de jugadores para las planillas.
//
// Antes cada consulta traía al jugador "incrustado" (players(...)). Eso obliga a
// que la tabla de jugadores sea legible para cualquier sesión, incluidas las
// sesiones ANÓNIMAS de los links de planilla (cualquiera puede crear una).
// Ahora la consulta se hace sin incrustar y los jugadores se piden aparte:
//   · sesión anónima (link de planilla) → función del servidor `planilla_jugadores`
//     (solo jugadores inscritos en torneos activos, cédula enmascarada)
//   · cuenta real → tabla players como siempre
// El resultado deja `fila.players` igual que antes, así el resto del código no cambia.
import { supabase } from './supabase'

async function esSesionAnonima() {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    return !!session?.user?.is_anonymous
  } catch { return false }
}

export async function conPlayers(consulta, columnas, columnaId = 'player_id') {
  const res = await consulta
  if (res.error || !Array.isArray(res.data) || res.data.length === 0) return res
  const ids = [...new Set(res.data.map(r => r[columnaId]).filter(Boolean))]
  if (ids.length === 0) return res

  let lista = null
  if (await esSesionAnonima()) {
    const r = await supabase.rpc('planilla_jugadores', { p_ids: ids })
    if (!r.error && Array.isArray(r.data)) lista = r.data
  }
  if (!lista) {
    const r = await supabase.from('players').select(columnas).in('id', ids)
    lista = r.data || []
  }
  const mapa = new Map(lista.map(p => [p.id, p]))
  res.data.forEach(r => { r.players = mapa.get(r[columnaId]) || null })
  return res
}
