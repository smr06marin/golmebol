import { supabase } from './supabase'

// ── Detector de equipos duplicados ───────────────────────────────────────
// Un equipo que juega varios torneos debe ser SIEMPRE el mismo equipo en la
// base de datos: así su historia (partidos, palmarés, jugadores) se acumula y
// no queda repartida en copias. Por eso, antes de crear un equipo nuevo se
// busca si ya existe uno con nombre igual o parecido (sin importar tildes,
// mayúsculas o espacios) o con el mismo dueño (misma cédula).
//
// La búsqueda principal la hace la función de base de datos
// `buscar_equipos_para_inscribir` (migracion_buscar_equipos_ficha.sql), que
// además devuelve la "ficha" del equipo: torneos jugados, último torneo,
// jugadores y partidos. Si esa función todavía no existe en la base, se usa
// la búsqueda de antes (solo por nombre, sin ficha) para no romper nada.

const normalizarNombreEquipo = s =>
  (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(new RegExp('[\\u0300-\\u036f]', 'g'), '')
    .replace(/[^a-z0-9ñ ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

// Una cédula de relleno (0000000, 1111111...) no identifica a nadie
export function esCedulaValida(c) {
  const d = String(c || '').replace(/\D/g, '')
  return d.length >= 5 && !/^(\d)\1*$/.test(d)
}

// Búsqueda con ficha. `q` puede ser un nombre o una cédula completa.
// Devuelve { data, error }: error ≠ null si la función aún no está en la base.
export async function buscarEquiposFicha(q, torneoId = null) {
  const { data, error } = await supabase.rpc('buscar_equipos_para_inscribir', { p_q: String(q || ''), p_torneo: torneoId || null })
  if (error) return { data: null, error }
  return { data: Array.isArray(data) ? data : [], error: null }
}

// Equipos que podrían ser el que se va a crear: por nombre parecido y/o por la
// misma cédula del dueño. Los de la misma cédula salen primero.
export async function buscarEquiposParecidos(nombre, { cedula = null, torneoId = null } = {}) {
  const n = normalizarNombreEquipo(nombre)
  const conCedula = esCedulaValida(cedula)

  const [rn, rc] = await Promise.all([
    n.length >= 3 ? buscarEquiposFicha(nombre, torneoId) : Promise.resolve({ data: [], error: null }),
    conCedula ? buscarEquiposFicha(String(cedula).replace(/\D/g, ''), torneoId) : Promise.resolve({ data: [], error: null }),
  ])
  if (!rn.error && !rc.error) {
    const porId = new Map()
    for (const e of [...rc.data, ...rn.data]) {
      const previo = porId.get(e.id)
      porId.set(e.id, previo ? { ...previo, por_cedula: previo.por_cedula || e.por_cedula } : e)
    }
    return [...porId.values()]
      .sort((a, b) => (b.por_cedula ? 1 : 0) - (a.por_cedula ? 1 : 0))
      .slice(0, 6)
  }

  // Respaldo (la función de la base todavía no existe): solo por nombre, sin ficha
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
