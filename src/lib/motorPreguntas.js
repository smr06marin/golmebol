// ── MOTOR DE PREGUNTAS ───────────────────────────────────────────────────────
// En vez de programar cada pregunta a mano, este motor ENTIENDE la estructura
// de la pregunta y calcula la respuesta directo de los datos crudos:
//   · métrica: goles, tarjetas (amarillas/azules/rojas), faltas, victorias,
//     derrotas, empates, partidos, goles recibidos (arquero)...
//   · dirección: "más" (por defecto) o "menos / peor"
//   · filtro por torneo: si la pregunta menciona el nombre de un torneo
//   · agrupación: por jugador (equipo), o por rival/torneo (jugador)
// Ejemplos que resuelve solo: "jugador con más tarjetas amarillas",
// "quién tiene menos faltas", "más goles en Torneo Interno",
// "jugador con más victorias", "quién ha recibido menos goles".

export const normalizarPregunta = s =>
  (s || '').toLowerCase().normalize('NFD').replace(new RegExp('[\\u0300-\\u036f]', 'g'), '')

// El orden importa: lo específico va antes que lo genérico
// (p.ej. "amarilla" antes que "tarjeta", "gol" antes que "partido")
const METRICAS = [
  { id: 'amarillas', kws: ['amarilla'],                 icono: '🟨', label: 'tarjetas amarillas',            val: d => d.amarillas },
  { id: 'azules',    kws: ['azul'],                     icono: '🟦', label: 'tarjetas azules',               val: d => d.azules },
  { id: 'rojas',     kws: ['roja', 'expuls'],           icono: '🟥', label: 'tarjetas rojas',                val: d => d.rojas },
  { id: 'tarjetas',  kws: ['tarjeta'],                  icono: '🃏', label: 'tarjetas (todas)',              val: d => d.amarillas + d.azules + d.rojas },
  { id: 'faltas',    kws: ['falta'],                    icono: '⚠️', label: 'faltas',                        val: d => d.faltas },
  { id: 'recibidos', kws: ['recibid', 'valla', 'arco'], icono: '🧤', label: 'goles recibidos (de arquero)',  val: d => d.gcArq, arquero: true },
  { id: 'victorias', kws: ['victoria', 'ganad', 'gana'],icono: '🏅', label: 'victorias',                     val: d => d.victorias },
  { id: 'derrotas',  kws: ['derrota', 'perdid'],        icono: '💔', label: 'derrotas',                      val: d => d.derrotas },
  { id: 'empates',   kws: ['empat'],                    icono: '🤝', label: 'empates',                       val: d => d.empates },
  { id: 'goles',     kws: ['gol', 'anot', 'marcad'],    icono: '⚽', label: 'goles',                         val: d => d.goles },
  { id: 'partidos',  kws: ['partido', 'presencia', 'jugado'], icono: '🎽', label: 'partidos jugados',        val: d => d.pj },
]

const CERO = () => ({ goles: 0, pj: 0, amarillas: 0, azules: 0, rojas: 0, faltas: 0, victorias: 0, derrotas: 0, empates: 0, gcArq: 0, pjArq: 0 })

function acumular(acc, fila) {
  acc.goles     += fila.goles     || 0
  acc.pj        += 1
  acc.amarillas += fila.amarillas || 0
  acc.azules    += fila.azules    || 0
  acc.rojas     += fila.rojas     || 0
  acc.faltas    += fila.faltas    || 0
  if (fila.resultado === 'win')  acc.victorias++
  if (fila.resultado === 'loss') acc.derrotas++
  if (fila.resultado === 'draw') acc.empates++
  if (fila.fueArquero) { acc.gcArq += fila.gc || 0; acc.pjArq++ }
}

// filas: [{ jugador, rival, torneo, fecha, goles, gc, amarillas, azules, rojas,
//           faltas, resultado, fueArquero }]
// partidosEquipo (solo modo equipo): [{ gf, gc, rival, torneo, fecha, marcador }]
export function responderPregunta(pregunta, { modo = 'equipo', filas = [], partidosEquipo = [], nombresTorneos = [] }) {
  try {
    const q = normalizarPregunta(pregunta)
    if (!q.trim() || filas.length === 0) return []

    const metrica = METRICAS.find(m => m.kws.some(k => q.includes(k)))
    if (!metrica) return []

    const dir     = /\bmenos\b|\bpeor\b/.test(q) ? 'min' : 'max'
    const dirTxt  = dir === 'min' ? 'menos' : 'más'
    const torneoSel = nombresTorneos.find(t => t && q.includes(normalizarPregunta(t))) || null
    const sufijo  = torneoSel ? ` en ${torneoSel}` : ''
    const filasF  = torneoSel ? filas.filter(f => f.torneo === torneoSel) : filas
    const partsF  = torneoSel ? partidosEquipo.filter(p => p.torneo === torneoSel) : partidosEquipo
    if (filasF.length === 0) return []

    const cards = []

    // ¿Pregunta por UN PARTIDO puntual? ("partido con más goles")
    if (q.includes('partido') && (metrica.id === 'goles' || metrica.id === 'recibidos') && modo === 'equipo' && partsF.length > 0) {
      const campo = metrica.id === 'goles' ? 'gf' : 'gc'
      const p = [...partsF].sort((a, b) => dir === 'max' ? b[campo] - a[campo] : a[campo] - b[campo])[0]
      cards.push({ icono: metrica.icono, titulo: `Partido con ${dirTxt} ${metrica.label}${sufijo}`,
        respuesta: `${p[campo]} ${metrica.id === 'goles' ? 'goles' : 'goles en contra'} — ${p.marcador} vs ${p.rival}`,
        detalle: [p.torneo, p.fecha].filter(Boolean).join(' · ') })
      return cards
    }

    // Agrupación
    let clave = 'jugador'
    if (modo === 'jugador') clave = (q.includes('rival') || q.includes('contra') || q.includes('equipo')) ? 'rival' : q.includes('torneo') ? 'torneo' : null

    if (modo === 'jugador' && !clave) {
      // Total personal + su mejor/peor desglose por torneo
      const total = CERO(); filasF.forEach(f => acumular(total, f))
      const v = metrica.val(total)
      cards.push({ icono: metrica.icono, titulo: `Sus ${metrica.label}${sufijo}`,
        respuesta: `${v} ${metrica.label} en ${total.pj} partidos`,
        detalle: total.pj > 0 ? `Promedio: ${(v / total.pj).toFixed(2)} por partido` : null })
      return cards
    }

    // Ranking por jugador / rival / torneo
    const grupos = {}
    filasF.forEach(f => {
      const g = f[clave]; if (!g) return
      if (!grupos[g]) grupos[g] = CERO()
      acumular(grupos[g], f)
    })
    let lista = Object.entries(grupos).map(([nombre, d]) => ({ nombre, valor: metrica.val(d), d }))
    if (metrica.arquero) lista = lista.filter(x => x.d.pjArq > 0)
    if (lista.length === 0) return []
    lista.sort((a, b) => dir === 'max' ? b.valor - a.valor : a.valor - b.valor)

    const quien = modo === 'equipo' ? 'Jugador' : clave === 'rival' ? 'Rival' : 'Torneo'
    const top = lista[0]
    cards.push({ icono: metrica.icono, titulo: `${quien} con ${dirTxt} ${metrica.label}${sufijo}`,
      respuesta: `${top.nombre} — ${top.valor} ${metrica.label}${metrica.id === 'partidos' ? '' : ` en ${top.d.pj} PJ`}`,
      detalle: lista.slice(1, 5).map(x => `${x.nombre} (${x.valor})`).join(' · ') || null })

    // Total del grupo si preguntan "cuántas/total"
    if (/cuant|total/.test(q) && modo === 'equipo') {
      const total = lista.reduce((s, x) => s + x.valor, 0)
      cards.push({ icono: '🧮', titulo: `Total de ${metrica.label} del equipo${sufijo}`,
        respuesta: `${total} ${metrica.label}`, detalle: null })
    }

    return cards
  } catch (e) {
    console.error('Motor de preguntas:', e)
    return []
  }
}
