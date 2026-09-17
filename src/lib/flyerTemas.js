// Paletas de colores para elegir al generar un flyer (torneo, partido,
// programación) — antes cada flyer tenía un solo color fijo; ahora el
// organizador puede escoger entre varios antes de descargar/compartir.
// El primer tema de cada lista es siempre el color "de siempre" (para que
// nadie note el cambio si no toca nada), y los demás son alternativas.
// Los campos varían según lo que necesita cada flyer (fondo en gradiente
// para el de torneo, dos tonos para el de partido, cinco tonos para el de
// programación) — se mantuvieron separados a propósito en vez de forzar un
// único formato genérico, para que cada tema quede fiel a su diseño.

export const TEMAS_TORNEO = [
  { id: 'azul',    nombre: 'Azul (original)', swatch: '#1a3a8a', fondo: 'radial-gradient(circle at 50% 28%, #1a3a8a 0%, #0c1c4a 55%, #06102c 100%)', acento: '#00ddd0', acentoGlow: 'rgba(0,221,208,.55)' },
  { id: 'rojo',    nombre: 'Rojo',    swatch: '#7a0f0f', fondo: 'radial-gradient(circle at 50% 28%, #7a0f0f 0%, #4a0909 55%, #230404 100%)', acento: '#e8b923', acentoGlow: 'rgba(232,185,35,.55)' },
  { id: 'verde',   nombre: 'Verde',   swatch: '#0f6e3e', fondo: 'radial-gradient(circle at 50% 28%, #0f6e3e 0%, #0a4527 55%, #04240f 100%)', acento: '#ffd54f', acentoGlow: 'rgba(255,213,79,.55)' },
  { id: 'morado',  nombre: 'Morado',  swatch: '#4a1a8a', fondo: 'radial-gradient(circle at 50% 28%, #4a1a8a 0%, #2d1054 55%, #160629 100%)', acento: '#00e5ff', acentoGlow: 'rgba(0,229,255,.55)' },
  { id: 'naranja', nombre: 'Naranja', swatch: '#b85c00', fondo: 'radial-gradient(circle at 50% 28%, #b85c00 0%, #6e3800 55%, #2e1300 100%)', acento: '#00c2ff', acentoGlow: 'rgba(0,194,255,.55)' },
  { id: 'negro',   nombre: 'Negro',   swatch: '#2a2a2a', fondo: 'radial-gradient(circle at 50% 28%, #2a2a2a 0%, #161616 55%, #0a0a0a 100%)', acento: '#f9a825', acentoGlow: 'rgba(249,168,37,.55)' },
]

// `watermark` es el mismo tono de "secundario" pero en rgba, para el
// texto chiquito "GOLMEBOL" del pie (que va sobre el fondo "principal",
// no sobre la tarjeta) — sin esto quedaba siempre en azul aunque se
// cambiara de tema.
export const TEMAS_PARTIDO = [
  { id: 'dorado',  nombre: 'Dorado (original)', swatch: '#F5C800', principal: '#F5C800', secundario: '#1a3a8a', watermark: 'rgba(26,58,138,.65)' },
  { id: 'cian',    nombre: 'Cian',    swatch: '#00ddd0', principal: '#00ddd0', secundario: '#0c1c4a', watermark: 'rgba(12,28,74,.65)' },
  { id: 'verde',   nombre: 'Verde',   swatch: '#8bc34a', principal: '#8bc34a', secundario: '#0a4527', watermark: 'rgba(10,69,39,.65)' },
  { id: 'naranja', nombre: 'Naranja', swatch: '#ff9800', principal: '#ff9800', secundario: '#5c2e00', watermark: 'rgba(92,46,0,.65)' },
  { id: 'rosado',  nombre: 'Rosado',  swatch: '#ff4d94', principal: '#ff4d94', secundario: '#3a0d1f', watermark: 'rgba(58,13,31,.65)' },
  { id: 'blanco',  nombre: 'Blanco/Gris', swatch: '#e8eaed', principal: '#e8eaed', secundario: '#202124', watermark: 'rgba(32,33,36,.65)' },
]

export const TEMAS_PROGRAMACION = [
  { id: 'rojo',    nombre: 'Rojo (original)', swatch: '#7a0f0f', oscuro: '#230404', medio: '#7a0f0f', claro: '#a51e1e', acento: '#e8b923', acentoSuave: '#f3d47a' },
  { id: 'azul',    nombre: 'Azul',    swatch: '#1a3a8a', oscuro: '#06102c', medio: '#1a3a8a', claro: '#2f57c9', acento: '#00ddd0', acentoSuave: '#7be8e0' },
  { id: 'verde',   nombre: 'Verde',   swatch: '#0f6e3e', oscuro: '#04240f', medio: '#0f6e3e', claro: '#1ea158', acento: '#ffd54f', acentoSuave: '#ffe59c' },
  { id: 'morado',  nombre: 'Morado',  swatch: '#4a1a8a', oscuro: '#160629', medio: '#4a1a8a', claro: '#6b34bb', acento: '#00e5ff', acentoSuave: '#7cf0ff' },
  { id: 'naranja', nombre: 'Naranja', swatch: '#b85c00', oscuro: '#2e1300', medio: '#b85c00', claro: '#e07b0e', acento: '#00c2ff', acentoSuave: '#7fdcff' },
  { id: 'negro',   nombre: 'Negro',   swatch: '#2a2a2a', oscuro: '#0a0a0a', medio: '#2a2a2a', claro: '#454545', acento: '#f9a825', acentoSuave: '#fbc767' },
]
