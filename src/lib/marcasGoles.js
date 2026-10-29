// Nombre de cada marca de goles de un jugador EN UN SOLO PARTIDO. Se usa igual en el aviso de gol
// de la transmisión, en el perfil del jugador y en su marca histórica:
//   1 Gol · 2 Doblete · 3 Triplete · 4 Póker · 5 Repóker · 6 Doble triplete · 7 Récord goleador
//   · 8 Goleada histórica · 9 Jornada legendaria · 10 (o más) Gesta histórica
export const MARCAS_GOLES = [
  { n: 1,  nombre: 'Gol',               plural: 'Goles' },
  { n: 2,  nombre: 'Doblete',           plural: 'Dobletes' },
  { n: 3,  nombre: 'Triplete',          plural: 'Tripletes' },
  { n: 4,  nombre: 'Póker',             plural: 'Pókers' },
  { n: 5,  nombre: 'Repóker',           plural: 'Repókers' },
  { n: 6,  nombre: 'Doble triplete',    plural: 'Dobles tripletes' },
  { n: 7,  nombre: 'Récord goleador',   plural: 'Récords goleador' },
  { n: 8,  nombre: 'Goleada histórica', plural: 'Goleadas históricas' },
  { n: 9,  nombre: 'Jornada legendaria', plural: 'Jornadas legendarias' },
  { n: 10, nombre: 'Gesta histórica',   plural: 'Gestas históricas' },
]

// Marca que corresponde a `goles` goles en un partido (10 o más = Gesta histórica). null si no hay goles.
export function marcaDeGoles(goles) {
  const g = Math.floor(Number(goles) || 0)
  if (g < 1) return null
  return MARCAS_GOLES[Math.min(g, 10) - 1]
}

export const nombreMarcaGoles = goles => marcaDeGoles(goles)?.nombre || ''

// De una lista de "goles en cada partido" arma cuántas veces logró cada marca de 2 goles en adelante:
// [{ n, nombre, plural, veces }] solo con las que tienen veces > 0, de la más grande a la más chica.
export function contarMarcasGoles(golesPorPartido) {
  const veces = {}
  ;(golesPorPartido || []).forEach(g => {
    const m = marcaDeGoles(g)
    if (m && m.n >= 2) veces[m.n] = (veces[m.n] || 0) + 1
  })
  return MARCAS_GOLES.filter(m => veces[m.n]).map(m => ({ ...m, veces: veces[m.n] })).reverse()
}
