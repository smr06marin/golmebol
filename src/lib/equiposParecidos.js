import { supabase } from './supabase'

// ── Detector de equipos duplicados ──────────────────────────────────────────
// Antes de crear un equipo nuevo se busca si ya existe uno con nombre igual o
// parecido (sin importar tildes, mayúsculas o espacios). Así no se duplican
// equipos y no se pierde su historia (partidos, palmarés, jugadores).

export const normalizarNombreEquipo = s =>
  (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(new RegExp('[\\u0300-\\u036f]', 'g'), '')
    .replace(/[^a-z0-9ñ ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

export async function buscarEquiposParecidos(nombre) {
  const n = normalizarNombreEquipo(nombre)
  if (n.length < 3) return []
  const { data } = await supabase.from('teams').select('id, name, city, logo_url, representante_nombre')
  return (data || [])
    .filter(t => {
      const tn = normalizarNombreEquipo(t.name)
      if (!tn) return false
      // Igual, o uno contiene al otro ("Niupi" vs "Niupi FC"), o comparten
      // la primera palabra significativa (≥4 letras)
      if (tn === n || tn.includes(n) || n.includes(tn)) return true
      const p1 = n.split(' ')[0], p2 = tn.split(' ')[0]
      return p1.length >= 4 && p1 === p2
    })
    .slice(0, 5)
}
