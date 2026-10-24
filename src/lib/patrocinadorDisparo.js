// Disparo de publicidad de un patrocinador desde los paneles de control.
//
// El panel guarda en site_config.en_vivo_control[streamId]:
//   patrocinador_id, patrocinador_ts (hora del clic: cada clic nuevo = una aparición nueva),
//   patrocinador_tipo ('logo' | 'banner' | 'video'), patrocinador_tamano ('auto' | 'grande' | 'pequeno').
// Todas las vistas (overlay de OBS, portada, panel por link, panel de admin) leen eso
// con disparoDeControl y dibujan PatrocinadorEnVivoOverlay.

export const DURACION_LOGO_MS = 8000
export const DURACION_BANNER_MS = 10000          // cada banner
export const DURACION_MAXIMA_VIDEO_MS = 180000   // seguro por si un video nunca avisa que terminó

export function cargaDisparo(patrocinadorId, tipo = 'logo', tamano = 'auto') {
  return { patrocinador_id: patrocinadorId, patrocinador_ts: Date.now(), patrocinador_tipo: tipo, patrocinador_tamano: tamano }
}

export function disparoDeControl(c) {
  if (!c?.patrocinador_id) return null
  return {
    id: c.patrocinador_id,
    tipo: c.patrocinador_tipo === 'banner' || c.patrocinador_tipo === 'video' ? c.patrocinador_tipo : 'logo',
    tamano: c.patrocinador_tamano === 'grande' || c.patrocinador_tamano === 'pequeno' ? c.patrocinador_tamano : 'auto',
    clave: c.patrocinador_ts || 0,
  }
}

// 'auto' = grande en el descanso, pequeño mientras se juega
export function tamanoVideoEfectivo(tamano, descanso) {
  if (tamano === 'grande' || tamano === 'pequeno') return tamano
  return descanso ? 'grande' : 'pequeno'
}

// ¿Esta aparición tapa las gráficas de abajo (tabla/goles/jugadores)? El video
// pequeño NO: va en una esquina y deja todo lo demás a la vista.
export function disparoEsExclusivo(d, descanso) {
  if (!d) return false
  return !(d.tipo === 'video' && tamanoVideoEfectivo(d.tamano, descanso) === 'pequeno')
}
