import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { armarLista, obtenerAgregado } from './rankingsJugadores'

// ── MEDIA del jugador (el número tipo FIFA, de 40 a 99) ───────────────────────────────────────────
// Sale de comparar al jugador contra TODOS los de Golmebol de su mismo tipo (arqueros con arqueros, jugadores de
// campo con jugadores de campo) que tengan al menos 3 partidos. En cada cosa se mira "mejor que qué porcentaje"
// de los demás (0 = el peor, 1 = el mejor), se ponderan y se pasa a la escala 40–99:
//   JUGADOR DE CAMPO: goles por partido 30% · % de partidos ganados 22% · MVP por partido 15% · partidos jugados 13%
//                     · goles en total 10% · TÍTULOS 10%
//   ARQUERO:          goles recibidos por partido 25% (menos es mejor) · PARTIDOS JUGADOS 22% · arcos en cero (total) 15%
//                     · % de partidos ganados 15% · TÍTULOS 13% · MVP por partido 10%
//   Al arquero se le da MUCHO valor a los partidos jugados: un arquero con pocos partidos y pocos goles recibidos no
//   puede quedar por encima de uno que ha atajado muchos partidos. Por eso, además del 22%, sus promedios se acercan
//   mucho más al promedio de todos mientras tenga pocos partidos (K = 8 partidos de referencia; al de campo, K = 2),
//   y los arcos en cero cuentan por TOTAL (más partidos → más arcos en cero), no por partido.
//   TÍTULOS: campeón vale 3, subcampeón 2 y tercer puesto 1 (los que guardó el organizador al cerrar cada torneo).
// Además arma el "por qué" (en qué está fuerte y qué lo baja) y RETOS para subirla: simula sus próximos partidos
// ("si haces 3 goles en tus próximos 3 partidos tu media pasa de 74 a 76") contra los mismos rivales de siempre.
//
// LO RECIENTE PESA MÁS (migracion_media_jugadores.sql → función media_jugadores_stats): cada partido, MVP, arco en
// cero y título pesa según su antigüedad: hoy vale 1, hace 6 meses 0,5, hace un año 0,25… Así un jugador que fue
// muy bueno hace tiempo pero ahora no tanto va bajando, y uno que viene jugando bien sube rápido. Además, cuando un
// jugador tiene poco peso reciente (lleva mucho sin jugar), sus promedios se acercan al promedio de todos (K = 2
// partidos "de referencia"), para que un buen rato de hace dos años no lo deje arriba para siempre.
// Si esa función todavía no está en la base, se cuenta todo igual (sin el tiempo) con el ranking normal + MVP,
// arcos en cero y títulos contados aparte (todas las páginas, Supabase da 1000 por vez).

export const MIN_PJ_MEDIA = 3
const PAG = 1000

// "1 campeón, 1 tercero" / "ninguno todavía"
function verTitulos(j) {
  const partes = []
  if (j.campeon) partes.push(`${j.campeon} ${j.campeon === 1 ? 'campeón' : 'veces campeón'}`)
  if (j.subcampeon) partes.push(`${j.subcampeon} ${j.subcampeon === 1 ? 'subcampeón' : 'veces subcampeón'}`)
  if (j.tercero) partes.push(`${j.tercero} ${j.tercero === 1 ? 'tercer puesto' : 'terceros puestos'}`)
  return partes.length ? partes.join(', ') : 'ninguno todavía'
}
const VALOR_TITULO = { campeon: 3, campeonato: 3, subcampeon: 2, final: 2, tercer_puesto: 1 }

// Los campos pj, goles, recibidos, pg, mvp, ceros y titulos ya vienen CON el peso del tiempo; los números de verdad
// (para mostrar) van en j.real. Los promedios se "acercan" al de todos con K partidos de referencia (ver arriba).
const K_CAMPO = 2, K_ARQUERO = 8
function componentes(tipo, ref) {
  const K = tipo === 'campo' ? K_CAMPO : K_ARQUERO
  const prom = (j, campo, r) => ((j[campo] || 0) + K * r) / ((j.pj || 0) + K)
  if (tipo === 'campo') return [
    { k: 'gpp',   peso: .30, nombre: 'Goles por partido',   valor: j => prom(j, 'goles', ref.gpp), mejorMayor: true,  ver: v => v.toFixed(1) },
    { k: 'efic',  peso: .22, nombre: 'Partidos ganados',    valor: j => prom(j, 'pg', ref.efic),   mejorMayor: true,  ver: v => `${Math.round(v * 100)}%` },
    { k: 'mvp',   peso: .15, nombre: 'Veces MVP',           valor: j => prom(j, 'mvp', ref.mvp),   mejorMayor: true,  ver: (v, j) => `${j.real.mvp}` },
    { k: 'pj',    peso: .13, nombre: 'Partidos jugados',    valor: j => j.pj,                      mejorMayor: true,  ver: (v, j) => `${j.real.pj}` },
    { k: 'goles', peso: .10, nombre: 'Goles en total',      valor: j => j.goles,                   mejorMayor: true,  ver: (v, j) => `${j.real.goles}` },
    { k: 'titulos', peso: .10, nombre: 'Títulos',           valor: j => j.titulos || 0,            mejorMayor: true,  ver: (v, j) => verTitulos(j.real) },
  ]
  return [
    { k: 'rpp',   peso: .25, nombre: 'Goles recibidos por partido', valor: j => prom(j, 'recibidos', ref.rpp), mejorMayor: false, ver: v => v.toFixed(1) },
    { k: 'pj',    peso: .22, nombre: 'Partidos jugados',    valor: j => j.pj,                        mejorMayor: true,  ver: (v, j) => `${j.real.pj}` },
    { k: 'ceros', peso: .15, nombre: 'Arcos en cero',       valor: j => j.ceros || 0,                mejorMayor: true,  ver: (v, j) => `${j.real.ceros}` },
    { k: 'efic',  peso: .15, nombre: 'Partidos ganados',    valor: j => prom(j, 'pg', ref.efic),     mejorMayor: true,  ver: v => `${Math.round(v * 100)}%` },
    { k: 'titulos', peso: .13, nombre: 'Títulos',           valor: j => j.titulos || 0,              mejorMayor: true,  ver: (v, j) => verTitulos(j.real) },
    { k: 'mvp',   peso: .10, nombre: 'Veces MVP',           valor: j => prom(j, 'mvp', ref.mvp),     mejorMayor: true,  ver: (v, j) => `${j.real.mvp}` },
  ]
}

// ── Estadísticas con el peso del tiempo (función media_jugadores_stats); null si todavía no existe ──
let _pesados = null, _enVueloPesados = null
export function obtenerPesados() {
  if (_pesados && Date.now() - _pesados.t < 5 * 60 * 1000) return Promise.resolve(_pesados.d)
  if (_enVueloPesados) return _enVueloPesados
  _enVueloPesados = todas(() => supabase.rpc('media_jugadores_stats').order('player_id', { ascending: true }))
    .then(filas => { const d = filas.length ? filas : null; _pesados = { t: Date.now(), d }; return d })
    .catch(() => null)
    .finally(() => { _enVueloPesados = null })
  return _enVueloPesados
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
    todas(() => supabase.from('tournament_logros').select('id, player_id, tournament_id, tipo').in('tipo', Object.keys(VALOR_TITULO)).order('id', { ascending: true })),
  ]).then(([mvps, ceros, titulos]) => {
    const d = { mvp: new Map(), ceros: new Map(), titulos: new Map() }
    // Títulos: por jugador y por torneo se queda el mejor (por si quedó guardado dos veces)
    const mejor = new Map()
    titulos.forEach(r => {
      const clave = `${r.player_id}|${r.tournament_id}`
      if ((VALOR_TITULO[r.tipo] || 0) > (VALOR_TITULO[mejor.get(clave)] || 0)) mejor.set(clave, r.tipo)
    })
    mejor.forEach((tipo, clave) => {
      const id = clave.split('|')[0]
      const t = d.titulos.get(id) || { puntos: 0, campeon: 0, subcampeon: 0, tercero: 0 }
      t.puntos += VALOR_TITULO[tipo]
      if (VALOR_TITULO[tipo] === 3) t.campeon++; else if (VALOR_TITULO[tipo] === 2) t.subcampeon++; else t.tercero++
      d.titulos.set(id, t)
    })
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
// pesados: filas de media_jugadores_stats (con el tiempo). Si no hay, se usa agregado + extras (sin el tiempo).
export function calcularMedia(agregado, extras, playerId, pesados = null) {
  const id = String(playerId || '')
  const lista = pesados
    ? armarLista(pesados.map(r => ({
        id: String(r.player_id), players: { posicion_futbol5: r.pos5, posicion_futbol7: r.pos7, posicion_futbol11: r.pos11 },
        pj: Number(r.w_pj) || 0, goles: Number(r.w_goles) || 0, recibidos: Number(r.w_recibidos) || 0, pg: Number(r.w_pg) || 0,
        mvp: Number(r.w_mvp) || 0, ceros: Number(r.w_ceros) || 0, titulos: Number(r.w_titulos) || 0,
        real: { pj: r.pj || 0, goles: r.goles || 0, mvp: r.mvp || 0, ceros: r.ceros || 0, campeon: r.campeon || 0, subcampeon: r.subcampeon || 0, tercero: r.tercero || 0 },
      })))
    : armarLista(agregado || []).map(j => {
        const t = extras?.titulos?.get(j.id)
        const mvp = extras?.mvp?.get(j.id) || 0, ceros = extras?.ceros?.get(j.id) || 0
        return { ...j, mvp, ceros, titulos: t?.puntos || 0,
          real: { pj: j.pj, goles: j.goles, mvp, ceros, campeon: t?.campeon || 0, subcampeon: t?.subcampeon || 0, tercero: t?.tercero || 0 } }
      })
  const yo = lista.find(j => j.id === id)
  if (!yo) return null
  const tipo = yo.esPortero ? 'arquero' : 'campo'
  if (yo.real.pj < MIN_PJ_MEDIA) return { sinMedia: true, faltan: MIN_PJ_MEDIA - yo.real.pj, tipo, pj: yo.real.pj }

  const todos = lista.filter(j => j.real.pj >= MIN_PJ_MEDIA && !!j.esPortero === !!yo.esPortero)
  const otros = todos.filter(j => j.id !== id)
  // Promedios de todos (la "referencia" hacia la que se acercan los que llevan mucho sin jugar)
  const suma = c => todos.reduce((s, j) => s + (j[c] || 0), 0)
  const sPj = suma('pj') || 1
  const ref = { gpp: suma('goles') / sPj, efic: suma('pg') / sPj, mvp: suma('mvp') / sPj, rpp: suma('recibidos') / sPj, ceros: suma('ceros') / sPj }
  const comps = componentes(tipo, ref)
  const ordenadas = comps.map(c => otros.map(c.valor).sort((a, b) => a - b))
  // Sin títulos (o arquero sin arcos en cero) = 0, no "mitad de la tabla" por empatar con todos los que tampoco tienen
  const sinNada = (c, j) => (c.k === 'titulos' || (c.k === 'ceros' && tipo === 'arquero')) && !(c.valor(j) > 0)
  const pDe = (c, i, j) => (sinNada(c, j) ? 0 : porcentaje(ordenadas[i], c.valor(j), c.mejorMayor))
  const evaluar = j => {
    const partes = comps.map((c, i) => ({ ...c, p: pDe(c, i, j), texto: c.ver(c.valor(j), j) }))
    return { partes, media: aMedia(partes.reduce((s, x) => s + x.peso * x.p, 0)) }
  }
  const mio = evaluar(yo)

  // "Mejor que el X% de los arqueros/jugadores": se compara su media con la de los demás
  const mediasOtros = otros.map(o => {
    const s = comps.reduce((acc, c, i) => acc + c.peso * pDe(c, i, o), 0)
    return aMedia(s)   // (cada otro se compara contra todos los demás menos él mismo y contra mí; la diferencia es mínima)
  }).sort((a, b) => a - b)
  const superaA = Math.round(porcentaje(mediasOtros, mio.media, true) * 100)
  const puesto = mediasOtros.filter(m => m > mio.media).length + 1

  // ── Retos: qué pasaría en sus próximos partidos ──
  const gpp = yo.goles / yo.pj, efic = yo.pg / yo.pj, rpp = yo.recibidos / yo.pj
  // Los partidos nuevos pesan 1 (son de hoy)
  const con = cambios => evaluar({ ...yo, real: { ...yo.real, pj: yo.real.pj + (cambios.pj || 0) }, ...Object.fromEntries(Object.entries(cambios).map(([k, v]) => [k, (yo[k] || 0) + v])) }).media
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
  // El reto más grande: salir campeón del torneo que está jugando
  const mCampeon = con({ titulos: 3 })
  if (mCampeon > mio.media) retos.push({ icono: '🏆', texto: 'Sal campeón de tu torneo', media: mCampeon })
  const retosUtiles = retos.map(r => ({ ...r, sube: r.media - mio.media })).filter(r => r.sube > 0).sort((a, b) => b.sube - a.sube).slice(0, 4)

  const porFuerza = [...mio.partes].sort((a, b) => b.p - a.p)
  return {
    tipo, media: mio.media, partes: mio.partes, superaA, puesto, total: mediasOtros.length + 1, conTiempo: !!pesados,
    fuerte: porFuerza[0], debil: porFuerza[porFuerza.length - 1], retos: retosUtiles,
  }
}

// Hook: la media del jugador (null mientras carga). Se recalcula cuando cambia el número de partidos.
export function useMediaJugador(playerId, userId, pj) {
  const [res, setRes] = useState(null)
  useEffect(() => {
    if (!playerId) return undefined
    let vivo = true
    obtenerPesados().then(async pesados => {
      // Con la función del tiempo no hace falta nada más; sin ella, el ranking normal + MVP, ceros y títulos aparte
      const [ag, ex] = pesados ? [null, null] : await Promise.all([obtenerAgregado(userId), obtenerExtras().catch(() => null)])
      if (vivo) setRes(calcularMedia(ag, ex, playerId, pesados))
    }).catch(() => {})
    return () => { vivo = false }
  }, [playerId, userId, pj])
  return res
}
