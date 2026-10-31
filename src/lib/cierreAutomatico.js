import { useEffect, useRef } from 'react'
import { supabase } from './supabase'

// CIERRE AUTOMÁTICO de la planilla: si el partido ya terminó (se cumplió el tiempo del 2.º tiempo, o el
// árbitro tocó "Finalizar partido") y pasan 5 minutos sin que nadie cierre la planilla, se cierra sola:
// se guarda el resultado, los goles, las tarjetas y las estadísticas tal como estaban, SIN MVP, y queda un
// informe que dice "planilla cerrada automáticamente". Lo ejecuta la propia planilla (rápida o profesional)
// mientras esté abierta en algún celular; si estaba cerrada, se cierra apenas se vuelva a abrir pasado el plazo.

export const CIERRE_AUTO_MIN = 5
export const CIERRE_AUTO_MS = CIERRE_AUTO_MIN * 60 * 1000

export function textoCierreAutomatico(hayRoja) {
  return `PLANILLA CERRADA AUTOMÁTICAMENTE: pasaron ${CIERRE_AUTO_MIN} minutos desde que terminó el partido y la planilla no se cerró. Se cerró sin MVP.` +
    (hayRoja ? ' Hubo tarjeta roja y no se registró el informe del árbitro.' : '')
}

// Deja el informe "cerrada automáticamente" (una sola vez por partido)
export async function guardarInformeCierreAuto({ partidoId, tournamentId, hayRoja }) {
  try {
    const descripcion = textoCierreAutomatico(hayRoja)
    const { data: previos } = await supabase.from('match_informes').select('id').eq('match_id', partidoId).eq('descripcion', descripcion).limit(1)
    if (previos && previos.length > 0) return
    await supabase.from('match_informes').insert({
      match_id: partidoId, tournament_id: tournamentId, tipo: hayRoja ? 'roja' : 'otro', descripcion, creado_por: 'Cierre automático',
    })
  } catch (e) { console.error('informe de cierre automático:', e) }
}

// ¿Cuándo terminó el 2.º tiempo según un borrador guardado? (epoch en ms; null si todavía no terminó).
// Sirve para saber el plazo aunque nadie tenga la planilla abierta: con el reloj andando se calcula desde la
// hora del guardado (savedAt) y los segundos que llevaba.
export function calcularFinTiempoSnap(snap, { limiteSegundos, updatedAt } = {}) {
  if (!snap || (snap.periodo || 1) !== 2) return null
  let fin = null
  if (snap.finTiempoEn) fin = Number(snap.finTiempoEn)
  else {
    const base = new Date(snap.savedAt || updatedAt || 0).getTime()
    if (!base) return null
    const segs = typeof snap.segundos === 'number' ? snap.segundos : 0
    const limite = typeof limiteSegundos === 'number' ? limiteSegundos : ((snap.duracionMinutos || 0) + (snap.tiempoExtra || 0)) * 60
    if (snap.tiempoAgotado) fin = base
    else if (limite > 0 && segs >= limite) fin = base - (segs - limite) * 1000
    else if (limite > 0 && snap.corriendo) fin = base + (limite - segs) * 1000
  }
  if (!fin || !Number.isFinite(fin) || fin > Date.now() + 1000) return null // todavía no terminó
  return fin
}

// Planillas abiertas en ESTE celular (para que el vigilante no se meta con una que ya está a la vista)
const planillasAbiertas = new Map()
export function registrarPlanillaAbierta(partidoId) {
  if (!partidoId) return undefined
  planillasAbiertas.set(partidoId, (planillasAbiertas.get(partidoId) || 0) + 1)
  return () => {
    const n = (planillasAbiertas.get(partidoId) || 1) - 1
    if (n <= 0) planillasAbiertas.delete(partidoId); else planillasAbiertas.set(partidoId, n)
  }
}
export function planillaEstaAbierta(partidoId) { return planillasAbiertas.has(partidoId) }

// Hook: llama a `onVencido` cuando llega `finTiempoEn + 5 min` (epoch en ms). `activo` apaga el control.
// También revisa al volver a la pantalla (si el celular estuvo bloqueado, el navegador pudo retrasar el temporizador).
export function useCierreAutomatico({ activo, finTiempoEn, onVencido }) {
  const alVencer = useRef(onVencido)
  useEffect(() => { alVencer.current = onVencido })
  useEffect(() => {
    if (!activo || !finTiempoEn) return undefined
    const limite = finTiempoEn + CIERRE_AUTO_MS
    let disparado = false
    const revisar = () => { if (!disparado && Date.now() >= limite) { disparado = true; alVencer.current?.() } }
    const t = setTimeout(revisar, Math.max(0, limite - Date.now()) + 50)
    const poll = setInterval(revisar, 30000)
    document.addEventListener('visibilitychange', revisar)
    return () => { clearTimeout(t); clearInterval(poll); document.removeEventListener('visibilitychange', revisar) }
  }, [activo, finTiempoEn])
}
