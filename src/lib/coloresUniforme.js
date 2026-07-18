// Paleta fija de colores de uniforme para la planilla rápida. Cada color trae
// ya calculado su color de texto (blanco o casi-negro) para que el número
// siempre se lea bien encima, sin que el árbitro tenga que pensarlo.
export const COLORES_UNIFORME = [
  { nombre: 'Rojo',     hex: '#d93025', texto: '#ffffff' },
  { nombre: 'Azul',     hex: '#1a73e8', texto: '#ffffff' },
  { nombre: 'Azul rey', hex: '#1a3a8a', texto: '#ffffff' },
  { nombre: 'Verde',    hex: '#1e8e3e', texto: '#ffffff' },
  { nombre: 'Amarillo', hex: '#f9c400', texto: '#1a1a1a' },
  { nombre: 'Naranja',  hex: '#e8710a', texto: '#ffffff' },
  { nombre: 'Morado',   hex: '#9955ff', texto: '#ffffff' },
  { nombre: 'Negro',    hex: '#111827', texto: '#ffffff' },
  { nombre: 'Blanco',   hex: '#f5f5f5', texto: '#1a1a1a' },
  { nombre: 'Gris',     hex: '#5f6368', texto: '#ffffff' },
]

export function colorPorHex(hex) {
  return COLORES_UNIFORME.find(c => c.hex === hex) || COLORES_UNIFORME[0]
}
