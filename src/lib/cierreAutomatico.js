import { useEffect, useRef } from 'react'
import { supabase } from './supabase'

// CIERRE AUTOMÁTICO de la planilla: si el partido ya terminó (se cumplió el tiempo del 2.º tiempo, o el
// árbitro tocó "Finalizar partido") y pasan 15 minutos sin que nadie cierre la planilla, se cierra sola:
// se guarda el resultado, los goles, las tarjetas y las estadísticas tal como estaban, SIN MVP, y queda un
// informe que dice "planilla cerrada automáticamente". Lo ejecuta la propia planilla (rápida o profesional)
// mientras esté abierta en algún celular; si estaba cerrada, se cierra apenas se vuelva a abrir pasado el plazo.

export const CIERRE_AUTO_MIN = 15
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

// Hook: llama a `onVencido` cuando llega `finTiempoEn + 15 min` (epoch en ms). `activo` apaga el control.
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
