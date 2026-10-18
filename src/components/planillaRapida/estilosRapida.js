// Estilos compartidos por los componentes de la planilla rápida. Centralizados
// acá para no repetir los mismos objetos inline en cada archivo (son varios
// componentes pequeños que arman una sola pantalla).
export const FONDO = '#07070e'
export const PANEL = '#111827'
export const BORDE = '#1e2d3d'
export const TEXTO = '#e8f4fd'
export const TEXTO_TENUE = '#7a9ab5'
const AZUL_APP = '#1a73e8'
export const CIAN = '#00ddd0'
export const ORO = '#f9a825'
export const VERDE = '#1e8e3e'
export const ROJO = '#d93025'

export const btnPrimario = {
  padding: '12px', background: AZUL_APP, border: 'none', borderRadius: '10px',
  cursor: 'pointer', color: '#fff', fontWeight: '800', fontSize: '.9rem',
}

export const btnSecundario = {
  padding: '12px', background: 'none', border: `1px solid ${BORDE}`, borderRadius: '10px',
  cursor: 'pointer', color: TEXTO_TENUE, fontWeight: '700', fontSize: '.85rem',
}

export function formatTiempo(s) {
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

function avatarJugador(j, size = 40) {
  const url = j?.photo_face_url || j?.photo_url
  return { url, size }
}

// Parpadeo para "iluminar" lo que el árbitro TODAVÍA tiene que hacer (arqueros,
// informe, MVP...). Se pinta con <style>{ESTILO_RESALTE}</style> en cada pantalla
// que lo usa (así no depende de index.css) y se aplica con
// animation: 'gmResalte 1.1s ease-in-out infinite'.
export const ESTILO_RESALTE = `
@keyframes gmResalte {
  0%, 100% { box-shadow: 0 0 0 0 rgba(249,196,0,.85), 0 0 0 0 rgba(249,196,0,.35); }
  50%      { box-shadow: 0 0 0 5px rgba(249,196,0,.55), 0 0 18px 4px rgba(249,196,0,.45); }
}
@keyframes gmResalteRojo {
  0%, 100% { box-shadow: 0 0 0 0 rgba(217,48,37,.85); }
  50%      { box-shadow: 0 0 0 5px rgba(217,48,37,.5), 0 0 18px 4px rgba(217,48,37,.45); }
}
`
export const ANIM_RESALTE = 'gmResalte 1.1s ease-in-out infinite'
export const ANIM_RESALTE_ROJO = 'gmResalteRojo 1.1s ease-in-out infinite'
export const AMARILLO = '#f9c400'
