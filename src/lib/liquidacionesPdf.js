// Liquidaciones en PDF para entregar a las canchas y a la escuela de árbitros:
// cada partido con fecha, hora, equipos y valor, más el total del torneo.
// Usa EXACTAMENTE las mismas reglas de gasto que la pestaña Finanzas (calcFinanzas),
// así que los totales del PDF coinciden con los de la pantalla.
import { nuevoPdf } from './pdfSimple'
import { fmtHora12 } from './horaHelpers'

const pesos = n => '$' + Math.round(n || 0).toLocaleString('es-CO')
const NOMBRE_FASE = { octavos: 'Octavos', cuartos: 'Cuartos', semifinal: 'Semifinal', final: 'Final', tercer_puesto: '3.er puesto', otro: 'Otra fase' }

// Colombia (UTC-5), igual que playedAtToLocal en el admin.
function fechaHoraLocal(playedAt) {
  if (!playedAt) return { fecha: '', hora: '' }
  const d = new Date(playedAt)
  if (isNaN(d.getTime())) return { fecha: '', hora: '' }
  const l = new Date(d.getTime() - 5 * 60 * 60 * 1000)
  return { fecha: l.toISOString().slice(0, 10), hora: l.toISOString().slice(11, 16) }
}
const fechaTexto = f => f ? new Date(f + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }) : 'Sin fecha'
const hoyTexto = () => new Date().toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })
const slug = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '')

export function armarLiquidaciones({ torneo, partidos = [], canchas = [], arbitros = [] }) {
  const fc = torneo?.finanzas_config || {}
  const canchaDe = m => (m.cancha_id != null && m.cancha_id !== '' && canchas.find(c => String(c.id) === String(m.cancha_id))) || (m.location && canchas.find(c => c.nombre === m.location)) || null
  const nombreArb = id => arbitros.find(a => a.id === id)?.name || ''
  const ordenados = [...partidos].sort((a, b) => String(a.played_at || '').localeCompare(String(b.played_at || '')))
  const terminados = ordenados.filter(p => p.status === 'finished')
  const pendientes = ordenados.filter(p => p.status !== 'finished' && !p.tipo_resultado)

  const fila = m => {
    const { fecha, hora } = fechaHoraLocal(m.played_at)
    const esW = m.tipo_resultado === 'w'
    const fase = m.fase && m.fase !== 'grupo' ? (NOMBRE_FASE[m.fase] || m.fase) : (m.matchday ? `Jornada ${m.matchday}` : 'Grupo')
    return {
      esW, fecha: fechaTexto(fecha), hora: hora ? fmtHora12(hora) : '—',
      partido: `${m.home?.name || 'Local'} vs ${m.away?.name || 'Visitante'}`, fase,
      resultado: esW ? 'W' : `${m.home_score ?? '-'} - ${m.away_score ?? '-'}`,
      arbitros: [m.arbitro1_id, m.arbitro2_id, m.arbitro3_id].filter(Boolean).map(nombreArb).filter(Boolean),
      cancha: canchaDe(m)?.nombre || m.location || 'Sin cancha asignada',
    }
  }

  // ── Canchas: cada una con su precio propio o, si no tiene, el del torneo
  const lista = canchas.map(c => ({
    id: c.id, nombre: c.nombre, escenario: c.escenario || '',
    precioPartido: c.precio_partido != null ? (c.precio_partido || 0) : (fc.pago_cancha_partido || 0),
    precioW: c.precio_w != null ? (c.precio_w || 0) : (fc.pago_cancha_w || 0),
    filas: [], pendientes: 0,
  }))
  lista.push({ id: 'sin-cancha', nombre: 'Sin cancha asignada', escenario: '', precioPartido: fc.pago_cancha_partido || 0, precioW: fc.pago_cancha_w || 0, filas: [], pendientes: 0 })
  const claveDe = m => { const c = canchaDe(m); return c ? c.id : 'sin-cancha' }
  terminados.forEach(m => { const x = lista.find(l => l.id === claveDe(m)); const f = fila(m); f.valor = f.esW ? x.precioW : x.precioPartido; x.filas.push(f) })
  pendientes.forEach(m => { const x = lista.find(l => l.id === claveDe(m)); if (x) x.pendientes += 1 })
  const canchasOut = lista.filter(x => x.filas.length > 0).map(x => {
    const ws = x.filas.filter(f => f.esW).length
    const jugados = x.filas.length - ws
    return { ...x, jugados, ws, total: jugados * x.precioPartido + ws * x.precioW }
  })

  // ── Árbitros: un total para toda la escuela (ellos lo reparten entre sí)
  const precioPartido = fc.pago_arbitro_partido || 0
  const precioW = fc.pago_arbitro_w || 0
  const filasArb = terminados.map(m => { const f = fila(m); f.valor = f.esW ? precioW : precioPartido; return f })
  const wsA = filasArb.filter(f => f.esW).length
  const jugadosA = filasArb.length - wsA
  const conteo = {}
  let sinArbitro = 0
  filasArb.forEach(f => { if (f.arbitros.length === 0) sinArbitro += 1; f.arbitros.forEach(n => { conteo[n] = (conteo[n] || 0) + 1 }) })
  const porArbitro = Object.entries(conteo).map(([nombre, partidosArb]) => ({ nombre, partidos: partidosArb })).sort((a, b) => b.partidos - a.partidos || a.nombre.localeCompare(b.nombre))

  return {
    canchas: canchasOut,
    arbitros: { precioPartido, precioW, filas: filasArb, jugados: jugadosA, ws: wsA, total: jugadosA * precioPartido + wsA * precioW, porArbitro, sinArbitro, pendientes: pendientes.length },
  }
}

function encabezado(d, torneo, titulo, subtitulo) {
  d.parrafo('GOLMEBOL', { size: 9, bold: true, color: '#5f6368', gap: 0 })
  d.titulo(titulo)
  d.parrafo(torneo?.name || 'Torneo', { size: 12, bold: true, color: '#202124', gap: 0 })
  d.parrafo(subtitulo, { size: 10, color: '#3c4043', gap: 0 })
  d.parrafo(`Documento generado el ${hoyTexto()}`, { size: 8.5, color: '#9aa0a6', gap: 6 })
  d.regla()
}

export function descargarLiquidacionCancha(x, torneo) {
  const d = nuevoPdf({ pie: `Golmebol · ${torneo?.name || ''}` })
  encabezado(d, torneo, 'Liquidación de cancha', `Cancha: ${x.escenario ? x.escenario + ' · ' : ''}${x.nombre}`)
  d.parrafo('Este documento muestra cada partido jugado en esta cancha durante el torneo y el valor que se le reconoce por cada uno. El total es lo que se le entrega a la cancha por este torneo.', { size: 9.5 })
  d.parrafo(`Cómo se calcula: partido jugado = ${pesos(x.precioPartido)}. Partido W (un equipo no se presentó y el partido no se jugó) = ${pesos(x.precioW)}.`, { size: 9.5, gap: 8 })
  d.parrafo('Detalle de partidos', { size: 11, bold: true, color: '#202124', gap: 4 })
  d.tabla(
    [{ t: '#', w: .4 }, { t: 'Fecha', w: 1.6 }, { t: 'Hora', w: 1 }, { t: 'Partido', w: 3.8 }, { t: 'Jornada / fase', w: 1.4 }, { t: 'Resultado', w: 1, align: 'center' }, { t: 'Valor', w: 1.2, align: 'right' }],
    x.filas.map((f, i) => [String(i + 1), f.fecha, f.hora, f.partido, f.fase, f.resultado, pesos(f.valor)]),
  )
  d.espacio(10)
  d.parrafo('Resumen', { size: 11, bold: true, color: '#202124', gap: 2 })
  d.par(`Partidos jugados: ${x.jugados} × ${pesos(x.precioPartido)}`, pesos(x.jugados * x.precioPartido))
  if (x.ws > 0) d.par(`Partidos W: ${x.ws} × ${pesos(x.precioW)}`, pesos(x.ws * x.precioW))
  d.par('TOTAL A ENTREGAR A LA CANCHA', pesos(x.total), { bold: true, fondo: '#e8f0fe', size: 11 })
  d.espacio(8)
  if (x.pendientes > 0) d.parrafo(`Quedan ${x.pendientes} partido(s) por jugar en esta cancha que todavía no están incluidos. Cuando se jueguen, se entrega una liquidación actualizada.`, { size: 8.5, color: '#5f6368' })
  d.espacio(6)
  d.saltoFirmas(['Entrega (Golmebol)', 'Recibe (nombre y cédula)', 'Fecha'])
  d.descargar(`liquidacion_cancha_${slug(x.nombre)}_${slug(torneo?.name)}.pdf`)
}

export function descargarLiquidacionArbitros(a, torneo) {
  const d = nuevoPdf({ pie: `Golmebol · ${torneo?.name || ''}` })
  encabezado(d, torneo, 'Liquidación de árbitros', 'Escuela de árbitros')
  d.parrafo('Este documento muestra cada partido del torneo con su árbitro o árbitros y el valor que se reconoce a la escuela por cada uno. Es un valor total para toda la escuela: los árbitros lo reparten entre ellos.', { size: 9.5 })
  d.parrafo(`Cómo se calcula: partido jugado = ${pesos(a.precioPartido)}. Partido W (un equipo no se presentó y el partido no se jugó) = ${pesos(a.precioW)}.`, { size: 9.5, gap: 8 })
  d.parrafo('Detalle de partidos', { size: 11, bold: true, color: '#202124', gap: 4 })
  d.tabla(
    [{ t: '#', w: .4 }, { t: 'Fecha', w: 1.9 }, { t: 'Hora', w: 1 }, { t: 'Partido', w: 2.8 }, { t: 'Cancha', w: 1.7 }, { t: 'Árbitros', w: 2.1 }, { t: 'Valor', w: 1.1, align: 'right' }],
    a.filas.map((f, i) => [String(i + 1), f.fecha, f.hora, `${f.partido}${f.esW ? ' (W)' : ''}`, f.cancha, f.arbitros.length ? f.arbitros.join(', ') : 'Sin árbitro anotado', pesos(f.valor)]),
  )
  d.espacio(10)
  d.parrafo('Resumen', { size: 11, bold: true, color: '#202124', gap: 2 })
  d.par(`Partidos jugados: ${a.jugados} × ${pesos(a.precioPartido)}`, pesos(a.jugados * a.precioPartido))
  if (a.ws > 0) d.par(`Partidos W: ${a.ws} × ${pesos(a.precioW)}`, pesos(a.ws * a.precioW))
  d.par('TOTAL A ENTREGAR A LA ESCUELA', pesos(a.total), { bold: true, fondo: '#e8f0fe', size: 11 })
  if (a.porArbitro.length > 0) {
    d.espacio(12)
    d.parrafo('Partidos pitados por cada árbitro (para repartir entre ellos)', { size: 11, bold: true, color: '#202124', gap: 2 })
    d.parrafo('Es solo informativo: muestra en cuántos partidos estuvo cada árbitro según lo anotado en el torneo.', { size: 8.5, color: '#5f6368', gap: 4 })
    d.tabla([{ t: 'Árbitro', w: 4 }, { t: 'Partidos', w: 1, align: 'right' }], [...a.porArbitro.map(p => [p.nombre, String(p.partidos)]), ...(a.sinArbitro > 0 ? [[`Partidos sin árbitro anotado`, String(a.sinArbitro)]] : [])])
  }
  d.espacio(8)
  if (a.pendientes > 0) d.parrafo(`Quedan ${a.pendientes} partido(s) por jugar que todavía no están incluidos. Cuando se jueguen, se entrega una liquidación actualizada.`, { size: 8.5, color: '#5f6368' })
  d.espacio(6)
  d.saltoFirmas(['Entrega (Golmebol)', 'Recibe (nombre y cédula)', 'Fecha'])
  d.descargar(`liquidacion_arbitros_${slug(torneo?.name)}.pdf`)
}
