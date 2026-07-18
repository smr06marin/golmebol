// Estilos compartidos por los componentes de la planilla rápida. Centralizados
// acá para no repetir los mismos objetos inline en cada archivo (son varios
// componentes pequeños que arman una sola pantalla).
export const FONDO = '#07070e'
export const PANEL = '#111827'
export const BORDE = '#1e2d3d'
export const TEXTO = '#e8f4fd'
export const TEXTO_TENUE = '#7a9ab5'
export const AZUL_APP = '#1a73e8'
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

export function avatarJugador(j, size = 40) {
  const url = j?.photo_face_url || j?.photo_url
  return { url, size }
}
