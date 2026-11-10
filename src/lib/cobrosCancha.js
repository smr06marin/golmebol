// Cobros en cancha (torneos con finanzas_config.cobro_en_cancha = true, los de Golmebol):
//  · El árbitro SOLO registra las transferencias: foto del comprobante + monto.
//  · El arbitraje y las tarjetas se suman solos (arbitraje por equipo según el torneo; tarjetas = las que desbloqueó en la planilla).
// Las funciones de Supabase están en migracion_cobros_cancha.sql.
import { supabase } from './supabase'
import { comprimirImagen } from './imageCompress'
import { errorAmigable } from './mensajesError'

export const TZ = 'America/Bogota'

export const cobraEnCancha = torneo => !!torneo?.finanzas_config?.cobro_en_cancha

export const pesos = n => { const v = Math.round(Number(n) || 0); return (v < 0 ? '-$' : '$') + Math.abs(v).toLocaleString('es-CO') }

// Día (AAAA-MM-DD) en hora de Colombia de una fecha ISO
export const diaBogota = iso => (iso ? new Date(iso) : new Date()).toLocaleDateString('en-CA', { timeZone: TZ })

// Cuánto paga cada equipo que le toca pagar: arbitraje normal; en un W, lo que paga el que se presenta
// (valor_w_presenta) y, si el torneo no lo tiene, el arbitraje normal.
export function montoArbitraje(partido, fc) {
  const normal = Number(fc?.arbitraje_equipo) || 0
  if (partido?.tipo_resultado === 'w') { const w = Number(fc?.valor_w_presenta) || 0; return w > 0 ? w : normal }
  return normal
}

// Qué equipos pagan arbitraje en este partido:
//  · normal  → los dos
//  · por W   → solo el que ganó (el que se presentó); el otro no paga
//  · desierto → nadie
export function equiposQuePagan(partido, nombres = {}) {
  if (!partido) return []
  const local = { team_id: partido.home_team_id, nombre: nombres.local || partido.home?.name || 'Local' }
  const visit = { team_id: partido.away_team_id, nombre: nombres.visitante || partido.away?.name || 'Visitante' }
  if (partido.tipo_resultado === 'desierto') return []
  if (partido.tipo_resultado === 'w') {
    return [(Number(partido.home_score) || 0) > (Number(partido.away_score) || 0) ? local : visit]
  }
  return [local, visit]
}

// Foto del comprobante → bucket privado «comprobantes». Devuelve la ruta guardada.
export async function subirComprobante(file, tournamentId, matchId) {
  const liviana = await comprimirImagen(file, { maxSize: 1280, calidad: 0.8 })
  const nombre = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`
  const ruta = `${tournamentId}/${matchId}/${nombre}`
  const { error } = await supabase.storage.from('comprobantes').upload(ruta, liviana, { contentType: 'image/jpeg', upsert: false })
  if (error) throw error
  return ruta
}

const urlsFirmadas = new Map()
// Enlace temporal (1 hora) para ver una foto privada
export async function urlComprobante(ruta) {
  if (!ruta) return null
  const previo = urlsFirmadas.get(ruta)
  if (previo && previo.vence > Date.now()) return previo.url
  const { data, error } = await supabase.storage.from('comprobantes').createSignedUrl(ruta, 3600)
  if (error || !data?.signedUrl) return null
  urlsFirmadas.set(ruta, { url: data.signedUrl, vence: Date.now() + 50 * 60 * 1000 })
  return data.signedUrl
}

// Todo lo vigente (no anulado) de un partido: transferencias y tarjetas
export async function cargarCobrosPartido(matchId) {
  const { data, error } = await supabase.from('cobros_cancha').select('*').eq('match_id', matchId).eq('anulado', false).order('cobrado_at', { ascending: true })
  if (error) return []
  return data || []
}

// foto + monto → fila 'transferencia'. Devuelve { ok } o { ok:false, error }
export async function registrarTransferencia({ partido, monto, file }) {
  try {
    if (!file) throw new Error('Falta la foto del comprobante')
    const ruta = await subirComprobante(file, partido.tournament_id, partido.id)
    const { error } = await supabase.rpc('registrar_transferencia', { p_match_id: partido.id, p_monto: Number(monto), p_comprobante_path: ruta })
    if (error) throw error
    return { ok: true }
  } catch (e) {
    return { ok: false, error: errorAmigable(e, 'No se pudo guardar. Revisa la señal e intenta de nuevo.') }
  }
}

export async function anularCobro(id) {
  const { error } = await supabase.rpc('anular_cobro_cancha', { p_id: id })
  return error ? { ok: false, error: errorAmigable(error, 'No se pudo deshacer') } : { ok: true }
}

// ── CUADRE DE LA CANCHA (todo automático) ────────────────────────────────────
// partidos: partidos del árbitro de ESE día (con home/away, location, tournament_id, status, tipo_resultado y marcador)
// configs: { [tournament_id]: finanzas_config }
// cobros: filas vigentes de cobros_cancha de esos partidos (transferencias y tarjetas)
//
//   arbitrajes     = partidos CERRADOS × equipos que pagan × valor (normal: 2 equipos; W: 1 solo; desierto: ninguno)
//   tarjetas       = lo que se desbloqueó en la planilla
//   recogido       = arbitrajes + tarjetas
//   transferencias = suma de las fotos registradas (llega a la cuenta de Golmebol)
//   efectivo       = recogido − transferencias   (lo que el árbitro debe tener en la mano)
//   leCorresponde  = partidos pitados × pago por partido  +  partidos W × pago por W
//   aEntregar      = efectivo − leCorresponde   (si es negativo, Golmebol le debe la diferencia)
export function resumenCaja(partidos, configs, cobros) {
  const porCancha = {}
  const filtrados = (partidos || []).filter(p => cobraEnCancha({ finanzas_config: configs[p.tournament_id] }))
  filtrados.forEach(p => {
    const cancha = (p.location || '').trim() || 'Sin cancha'
    const g = (porCancha[cancha] ||= {
      cancha, partidos: [], pitados: 0, ws: 0, desiertos: 0, sinTerminar: 0, equiposArbitraje: 0,
      arbitrajes: 0, tarjetas: 0, recogido: 0, transferencia: 0, efectivo: 0, leCorresponde: 0, fotos: [], tarjetasLista: [],
    })
    const fc = configs[p.tournament_id] || {}
    g.partidos.push(p)
    if (p.status !== 'finished') { g.sinTerminar += 1; return }
    if (p.tipo_resultado === 'w') { g.ws += 1; g.leCorresponde += Number(fc.pago_arbitro_w) || 0 }
    else if (p.tipo_resultado === 'desierto') g.desiertos += 1
    else { g.pitados += 1; g.leCorresponde += Number(fc.pago_arbitro_partido) || 0 }
    const n = equiposQuePagan(p).length
    g.equiposArbitraje += n
    g.arbitrajes += n * montoArbitraje(p, fc)
  })
  const ids = new Set(filtrados.map(p => p.id))
  const porId = Object.fromEntries(filtrados.map(p => [p.id, p]))
  ;(cobros || []).filter(c => ids.has(c.match_id) && !c.anulado).forEach(c => {
    const p = porId[c.match_id]
    const g = porCancha[(p.location || '').trim() || 'Sin cancha']
    const monto = Number(c.monto) || 0
    if (c.tipo === 'tarjeta') { g.tarjetas += monto; g.tarjetasLista.push({ ...c, partido: p }) }
    else if (c.tipo === 'transferencia') { g.transferencia += monto; g.fotos.push({ id: c.id, ruta: c.comprobante_path, monto, partido: p, hora: c.cobrado_at, por: c.cobrado_por_nombre }) }
  })
  Object.values(porCancha).forEach(g => {
    g.recogido = g.arbitrajes + g.tarjetas
    g.efectivo = g.recogido - g.transferencia
  })

  const canchas = Object.values(porCancha).sort((a, b) => a.cancha.localeCompare(b.cancha, 'es'))
  const tot = canchas.reduce((t, g) => ({
    arbitrajes: t.arbitrajes + g.arbitrajes, tarjetas: t.tarjetas + g.tarjetas, recogido: t.recogido + g.recogido,
    transferencia: t.transferencia + g.transferencia, efectivo: t.efectivo + g.efectivo,
    leCorresponde: t.leCorresponde + g.leCorresponde, sinTerminar: t.sinTerminar + g.sinTerminar,
  }), { arbitrajes: 0, tarjetas: 0, recogido: 0, transferencia: 0, efectivo: 0, leCorresponde: 0, sinTerminar: 0 })
  tot.aEntregar = tot.efectivo - tot.leCorresponde
  return { canchas, totales: tot, hayPartidos: filtrados.length > 0 }
}
