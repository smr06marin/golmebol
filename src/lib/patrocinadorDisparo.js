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

// Botón "Encender banners": no es de un patrocinador, sino de TODOS — junta los banners de todos
// los patrocinadores de la transmisión y salen uno tras otro (como un video).
export const ID_TODOS_BANNERS = '__todos_los_banners__'

// Apagar lo que esté en pantalla: es un "disparo" nuevo (marca de tiempo nueva) sin patrocinador.
export function apagarDisparo() {
  return { patrocinador_id: null, patrocinador_ts: Date.now(), patrocinador_tipo: null, patrocinador_tamano: null }
}

// Todos los banners de la lista de patrocinadores, en orden
export function todosLosBanners(lista) {
  return (Array.isArray(lista) ? lista : []).flatMap(p => (Array.isArray(p.banners) ? p.banners : [])).filter(Boolean)
}

// Qué patrocinador dibujar para un disparo: el de ese id, o uno "virtual" con todos los banners juntos
export function patrocinadorDeDisparo(lista, d) {
  if (!d) return null
  if (d.id === ID_TODOS_BANNERS) {
    const banners = todosLosBanners(lista)
    return banners.length ? { id: ID_TODOS_BANNERS, nombre: 'Patrocinadores', banners } : null
  }
  return (Array.isArray(lista) ? lista : []).find(p => p.id === d.id) || null
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

// Patrocinadores de UNA transmisión: cada transmisión tiene los suyos, guardados
// junto a su panel de control (site_config.en_vivo_control[idTransmisión].patrocinadores).
// Cada uno: { id, nombre, logo_url, banners: [url], video_url }
export function patrocinadoresDeControl(c) {
  const lista = Array.isArray(c?.patrocinadores) ? c.patrocinadores : []
  return lista.filter(p => p && p.id && p.nombre)
}
