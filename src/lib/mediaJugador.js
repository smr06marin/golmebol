import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { armarLista, obtenerAgregado } from './rankingsJugadores'

// ── MEDIA del jugador (el número tipo FIFA, de 40 a 99) ───────────────────────────────────────────
// Sale de comparar al jugador contra TODOS los de Golmebol de su mismo tipo (arqueros con arqueros, jugadores de
// campo con jugadores de campo) que tengan al menos 3 partidos. En cada cosa se mira "mejor que qué porcentaje"
// de los demás (0 = el peor, 1 = el mejor), se ponderan y se pasa a la escala 40–99:
//   JUGADOR DE CAMPO: goles por partido 35% · % de partidos ganados 25% · partidos jugados 15% · MVP por partido 15%
//                     · goles en total 10%
//   ARQUERO:          goles recibidos por partido 35% (menos es mejor) · arcos en cero por partido 20%
//                     · % de partidos ganados 20% · partidos jugados 15% · MVP por partido 10%
// Además arma el "por qué" (en qué está fuerte y qué lo baja) y RETOS para subirla: simula sus próximos partidos
// ("si haces 3 goles en tus próximos 3 partidos tu media pasa de 74 a 76") contra los mismos rivales de siempre.
// Los MVP y los arcos en cero no vienen en el ranking: se cuentan aparte (todas las páginas, Supabase da 1000 por vez).

export const MIN_PJ_MEDIA = 3
const PAG = 1000

const COMPONENTES = {
  campo: [
    { k: 'gpp',   peso: .35, nombre: 'Goles por partido',   valor: j => j.goles / j.pj,     mejorMayor: true,  ver: v => v.toFixed(1) },
    { k: 'efic',  peso: .25, nombre: 'Partidos ganados',    valor: j => j.pg / j.pj,        mejorMayor: true,  ver: v => `${Math.round(v * 100)}%` },
    { k: 'pj',    peso: .15, nombre: 'Partidos jugados',    valor: j => j.pj,               mejorMayor: true,  ver: v => `${v}` },
    { k: 'mvp',   peso: .15, nombre: 'Veces MVP',           valor: j => (j.mvp || 0) / j.pj, mejorMayor: true, ver: (v, j) => `${j.mvp || 0}` },
    { k: 'goles', peso: .10, nombre: 'Goles en total',      valor: j => j.goles,            mejorMayor: true,  ver: v => `${v}` },
  ],
  arquero: [
    { k: 'rpp',   peso: .35, nombre: 'Goles recibidos por partido', valor: j => j.recibidos / j.pj, mejorMayor: false, ver: v => v.toFixed(1) },
    { k: 'ceros', peso: .20, nombre: 'Arcos en cero',       valor: j => (j.ceros || 0) / j.pj, mejorMayor: true, ver: (v, j) => `${j.ceros || 0}` },
    { k: 'efic',  peso: .20, nombre: 'Partidos ganados',    valor: j => j.pg / j.pj,        mejorMayor: true,  ver: v => `${Math.round(v * 100)}%` },
    { k: 'pj',    peso: .15, nombre: 'Partidos jugados',    valor: j => j.pj,               mejorMayor: true,  ver: v => `${v}` },
    { k: 'mvp',   peso: .10, nombre: 'Veces MVP',           valor: j => (j.mvp || 0) / j.pj, mejorMayor: true, ver: (v, j) => `${j.mvp || 0}` },
  ],
}

// ── MVP y arcos en cero de todos (se guardan 5 minutos en memoria) ──
let _extras = null, _enVuelo = null
async function todas(armar) {
  const filas = []
  for (let desde = 0; desde < 300 * PAG; desde += PAG) {
    const { data, error } = await armar().range(desde, desde + PAG - 1)
    if (error) throw error
    filas.push(...(data || []))
    if (!data || data.length < PAG) break
  }
  return filas
}
export function obtenerExtras() {
  if (_extras && Date.now() - _extras.t < 5 * 60 * 1000) return Promise.resolve(_extras.d)
  if (_enVuelo) return _enVuelo
  _enVuelo = Promise.all([
    todas(() => supabase.from('tournament_logros').select('id, player_id').eq('tipo', 'mvp').order('id', { ascending: true })),
    todas(() => supabase.from('player_match_stats').select('id, player_id').eq('fue_arquero', true).eq('goals_conceded', 0).order('id', { ascending: true })),
  ]).then(([mvps, ceros]) => {
    const d = { mvp: new Map(), ceros: new Map() }
    mvps.forEach(r => { const id = String(r.player_id); d.mvp.set(id, (d.mvp.get(id) || 0) + 1) })
    ceros.forEach(r => { const id = String(r.player_id); d.ceros.set(id, (d.ceros.get(id) || 0) + 1) })
    _extras = { t: Date.now(), d }
    return d
  }).finally(() => { _enVuelo = null })
  return _enVuelo
}

// Cuántos valores de una lista ordenada son menores / iguales a v (búsqueda binaria)
function contar(ordenada, v) {
  let lo = 0, hi = ordenada.length
  while (lo < hi) { const m = (lo + hi) >> 1; if (ordenada[m] < v) lo = m + 1; else hi = m }
  const menores = lo
  hi = ordenada.length
  while (lo < hi) { const m = (lo + hi) >> 1; if (ordenada[m] <= v) lo = m + 1; else hi = m }
  return { menores, iguales: lo - menores }
}
// 0 = peor que todos, 1 = mejor que todos (los empates cuentan la mitad)
function porcentaje(ordenadaOtros, v, mejorMayor) {
  const n = ordenadaOtros.length
  if (n === 0) return 1
  const { menores, iguales } = contar(ordenadaOtros, v)
  const mayores = n - menores - iguales
  const peores = mejorMayor ? menores : mayores
  return (peores + iguales * .5) / n
}
const aMedia = s => Math.max(40, Math.min(99, Math.round(40 + 59 * s)))

// Arma la media del jugador (con el por qué y los retos). null si no está en el ranking.
export function calcularMedia(agregado, extras, playerId) {
  const id = String(playerId || '')
  const lista = armarLista(agregado || []).map(j => ({ ...j, mvp: extras?.mvp?.get(j.id) || 0, ceros: extras?.ceros?.get(j.id) || 0 }))
  const yo = lista.find(j => j.id === id)
  if (!yo) return null
  const tipo = yo.esPortero ? 'arquero' : 'campo'
  if (yo.pj < MIN_PJ_MEDIA) return { sinMedia: true, faltan: MIN_PJ_MEDIA - yo.pj, tipo, pj: yo.pj }

  const comps = COMPONENTES[tipo]
  const otros = lista.filter(j => j.id !== id && j.pj >= MIN_PJ_MEDIA && !!j.esPortero === !!yo.esPortero)
  const ordenadas = comps.map(c => otros.map(c.valor).sort((a, b) => a - b))
  const evaluar = j => {
    const partes = comps.map((c, i) => ({ ...c, p: porcentaje(ordenadas[i], c.valor(j), c.mejorMayor), texto: c.ver(c.valor(j), j) }))
    return { partes, media: aMedia(partes.reduce((s, x) => s + x.peso * x.p, 0)) }
  }
  const mio = evaluar(yo)

  // "Mejor que el X% de los arqueros/jugadores": se compara su media con la de los demás
  const mediasOtros = otros.map(o => {
    const s = comps.reduce((acc, c, i) => acc + c.peso * porcentaje(ordenadas[i], c.valor(o), c.mejorMayor), 0)
    return aMedia(s)   // (cada otro se compara contra todos los demás menos él mismo y contra mí; la diferencia es mínima)
  }).sort((a, b) => a - b)
  const superaA = Math.round(porcentaje(mediasOtros, mio.media, true) * 100)
  const puesto = mediasOtros.filter(m => m > mio.media).length + 1

  // ── Retos: qué pasaría en sus próximos partidos ──
  const gpp = yo.goles / yo.pj, efic = yo.pg / yo.pj, rpp = yo.recibidos / yo.pj
  const con = cambios => evaluar({ ...yo, ...Object.fromEntries(Object.entries(cambios).map(([k, v]) => [k, (yo[k] || 0) + v])) }).media
  const retos = []
  if (tipo === 'campo') {
    // Goles en los próximos 3 partidos (el menor número que sube la media)
    for (let x = 1; x <= 12; x++) {
      const m = con({ pj: 3, pg: Math.round(3 * efic), goles: x })
      if (m > mio.media) { retos.push({ icono: '⚽', texto: `Haz ${x} ${x === 1 ? 'gol' : 'goles'} en tus próximos 3 partidos`, media: m }); break }
    }
    retos.push({ icono: '✅', texto: 'Gana tus próximos 2 partidos', media: con({ pj: 2, pg: 2, goles: Math.round(2 * gpp) }) })
    retos.push({ icono: '⭐', texto: 'Sé el MVP de tu próximo partido', media: con({ pj: 1, pg: 1, mvp: 1, goles: Math.max(1, Math.round(gpp)) }) })
  } else {
    retos.push({ icono: '🧤', texto: 'Deja el arco en cero en tus próximos 2 partidos', media: con({ pj: 2, pg: Math.max(1, Math.round(2 * efic)), ceros: 2 }) })
    if (rpp > 1.2) retos.push({ icono: '🥅', texto: 'Recibe máximo 1 gol por partido en los próximos 3', media: con({ pj: 3, pg: Math.round(3 * efic), recibidos: 3 }) })
    retos.push({ icono: '✅', texto: 'Gana tus próximos 2 partidos', media: con({ pj: 2, pg: 2, recibidos: Math.round(2 * rpp) }) })
    retos.push({ icono: '⭐', texto: 'Sé el MVP de tu próximo partido', media: con({ pj: 1, pg: 1, mvp: 1, recibidos: Math.round(rpp) }) })
  }
  const retosUtiles = retos.map(r => ({ ...r, sube: r.media - mio.media })).filter(r => r.sube > 0).sort((a, b) => b.sube - a.sube).slice(0, 3)

  const porFuerza = [...mio.partes].sort((a, b) => b.p - a.p)
  return {
    tipo, media: mio.media, partes: mio.partes, superaA, puesto, total: mediasOtros.length + 1,
    fuerte: porFuerza[0], debil: porFuerza[porFuerza.length - 1], retos: retosUtiles,
  }
}

// Hook: la media del jugador (null mientras carga). Se recalcula cuando cambia el número de partidos.
export function useMediaJugador(playerId, userId, pj) {
  const [res, setRes] = useState(null)
  useEffect(() => {
    if (!playerId) return undefined
    let vivo = true
    Promise.all([obtenerAgregado(userId), obtenerExtras().catch(() => null)])
      .then(([ag, ex]) => { if (vivo) setRes(calcularMedia(ag, ex, playerId)) })
      .catch(() => {})
    return () => { vivo = false }
  }, [playerId, userId, pj])
  return res
}
