// ── Qué torneos ve un coordinador de árbitros ───────────────────────────────
// Antes veía los partidos de TODOS los torneos, y la pantalla se llenaba de
// torneos que otros coordinadores dirigen. Ahora cada torneo cae en un grupo:
//
//  · 'cerrado' → finalizado o archivado. No se muestra.
//  · 'mio'     → ya lo ha manejado este coordinador. Se muestra.
//  · 'nuevo'   → aún no inicia (ningún partido jugado ni en juego), todavía no se
//                sabe quién lo dirige. Se muestra a todos los coordinadores hasta
//                que inicie.
//  · 'ajeno'   → ya inició y este coordinador nunca lo manejó: lo dirige otro.
//                Se oculta (con un botón para verlos por si hace falta).
//
// "Ya lo manejó" = quedó registrado en torneo_coordinadores (se anota solo cuando
// asigna árbitros, marca sin planillador, abre una planilla o registra un reclamo
// en un partido de ese torneo) O se deduce de lo que ya existe: es uno de los
// árbitros de algún partido del torneo, o registró un reclamo en él.
// "Inició" = hay al menos un partido jugado o en juego.

export function clasificarTorneos({ partidos = [], torneosInfo = null, misTorneos = null, reclamos = [], yoId = null }) {
  const info = torneosInfo || {}
  const inferidos = new Set()
  const torneoDeMatch = new Map()
  const iniciados = new Set()
  partidos.forEach(p => {
    torneoDeMatch.set(p.id, p.tournament_id)
    if (yoId && [p.arbitro1_id, p.arbitro2_id, p.arbitro3_id].includes(yoId)) inferidos.add(p.tournament_id)
    if (p.status === 'finished' || p.live_state) iniciados.add(p.tournament_id)
  })
  reclamos.forEach(r => {
    if (yoId && r.registrado_por === yoId && torneoDeMatch.has(r.match_id)) inferidos.add(torneoDeMatch.get(r.match_id))
  })

  const clasif = {}
  new Set(partidos.map(p => p.tournament_id)).forEach(tid => {
    const t = info[tid]
    if (t && (t.status === 'finished' || t.archivado)) { clasif[tid] = 'cerrado'; return }
    if ((misTorneos && misTorneos.has(tid)) || inferidos.has(tid)) { clasif[tid] = 'mio'; return }
    if (!iniciados.has(tid)) { clasif[tid] = 'nuevo'; return }
    // Sin la tabla torneo_coordinadores (migración sin correr) no se sabe qué torneos son de este coordinador:
    // en ese caso no se oculta nada por "ajeno" para no dejarlo sin sus torneos.
    clasif[tid] = misTorneos ? 'ajeno' : 'mio'
  })
  return clasif
}
