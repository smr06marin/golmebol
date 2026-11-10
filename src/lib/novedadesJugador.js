// "Desde tu última visita": compara lo que el jugador tiene hoy con lo que tenía la última vez que entró
// (otro día) y arma una lista corta de novedades: partidos, goles, victorias y puestos que subió o bajó.
// La foto de "lo último visto" se guarda en el celular, atada al usuario (se borra al cerrar sesión).
import { leerCopia, guardarCopia } from './perfilPrevio'
import { STAT_CONFIG, ORDEN_STATS } from './rankingsJugadores'

const UN_ANIO = 400 * 24 * 60 * 60 * 1000
const hoy = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}` }
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`

function resumir(stats, puestos) {
  const p = {}
  if (puestos) ORDEN_STATS.forEach(k => { if (puestos[k]) p[k] = puestos[k].puesto })
  return {
    stats: { pj: stats.pj || 0, goles: stats.goles || 0, pg: stats.pg || 0, titulos: stats.titulos || 0 },
    puestos: puestos ? p : null,
  }
}

export function calcularNovedades(userId, stats, puestos, esPortero = false) {
  if (!userId || !stats) return []
  const ahora = resumir(stats, puestos)
  const g = leerCopia(userId, 'visto', UN_ANIO)
  const dia = hoy()

  let base = null
  if (g && g.dia !== dia) base = g.ultimo            // primera entrada de hoy: se compara contra lo último visto otro día
  else if (g) base = g.base                          // ya había entrado hoy: se mantiene la misma comparación todo el día
  const ultimo = { stats: ahora.stats, puestos: ahora.puestos || g?.ultimo?.puestos || null }
  if (!base) base = ultimo                           // primera vez en este celular: no hay con qué comparar
  if (base && !base.puestos && ahora.puestos) base = { ...base, puestos: ahora.puestos }
  try { guardarCopia(userId, 'visto', { dia, base, ultimo }) } catch { /* sin almacenamiento: no hay novedades, no pasa nada */ }

  const lista = []
  const d = k => (ahora.stats[k] || 0) - (base.stats?.[k] || 0)
  if (d('titulos') > 0) lista.push({ tono: 'oro', texto: `¡${plural(d('titulos'), 'título nuevo', 'títulos nuevos')}!` })
  if (d('pj') > 0) lista.push({ tono: 'sube', texto: `+${plural(d('pj'), 'partido jugado', 'partidos jugados')}` })
  if (!esPortero && d('goles') > 0) lista.push({ tono: 'sube', texto: `+${plural(d('goles'), 'gol', 'goles')}` })
  if (d('pg') > 0) lista.push({ tono: 'sube', texto: `+${plural(d('pg'), 'victoria', 'victorias')}` })
  if (base.puestos && ahora.puestos) {
    const cambios = ORDEN_STATS
      .filter(k => k !== 'pp' && base.puestos[k] && ahora.puestos[k] && base.puestos[k] !== ahora.puestos[k])
      .map(k => ({ k, delta: base.puestos[k] - ahora.puestos[k] }))
      .sort((a, b) => b.delta - a.delta)
    cambios.forEach(({ k, delta }) => {
      const nombre = STAT_CONFIG[k].corto.toLowerCase()
      lista.push(delta > 0
        ? { tono: 'sube', stat: k, texto: `Subiste ${plural(delta, 'puesto', 'puestos')} en ${nombre}: ahora eres #${ahora.puestos[k]}` }
        : { tono: 'baja', stat: k, texto: `Bajaste ${plural(-delta, 'puesto', 'puestos')} en ${nombre}: ahora eres #${ahora.puestos[k]}` })
    })
  }
  return lista.slice(0, 5)
}
