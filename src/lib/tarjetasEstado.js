// Cuando una tarjeta NO tiene marca de pago en la planilla (jugador sin registro, partido sin estadísticas,
// o la marca se perdió), no hay forma de saber si ya se pagó mirando la planilla. Lo único que queda son los
// pagos de tarjetas que se anotaron CON NOMBRE ("Tarjeta(s) de Juan David Guzmán …").
// Esta función reparte esos pagos con nombre entre las tarjetas sin marca del mismo jugador, para que:
//   · el que ya pagó deje de salir como deudor,
//   · el que no ha pagado salga con su nombre y su valor (y la cuenta cuadre con lo que debe el equipo).
//
// filas: [{ player_id, nombre, valor, estado: 'pagada' | 'pendiente' | 'sin_marca', fecha }]
// pagos: [{ player_id, jugador, concepto, monto }]   (solo pagos de tarjetas del equipo)
// Devuelve un Set con los índices de `filas` (sin marca) que quedaron cubiertas por un pago con nombre.

// "1 nov", "11 oct": la fecha del partido tal como se anota en el concepto del pago ("… — vs RIVAL (1 nov)"),
// para que al pagar UNA tarjeta se cierre justo esa y no otra del mismo jugador.
export const etiquetaFecha = iso => new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', timeZone: 'America/Bogota' }).replace('.', '')

const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()

export function cubrirSinMarca(filas, pagos) {
  const cubiertas = new Set()
  const usadasPagadas = new Set()
  const orden = filas.map((f, i) => i).sort((a, b) => new Date(filas[a].fecha || 0) - new Date(filas[b].fecha || 0))

  ;(pagos || []).forEach(p => {
    let saldo = Number(p.monto) || 0
    if (saldo <= 0) return
    const concepto = norm(p.concepto)
    const candidatas = orden.filter(i => {
      const f = filas[i]
      if (f.player_id && p.player_id && f.player_id === p.player_id) return true
      const nombre = norm(f.nombre)
      return nombre.length >= 4 && concepto.includes(nombre)
    })
    // 1) Lo que ya figura como pagado con marca se asume pagado con este mismo pago (para no gastarlo dos veces)
    candidatas.filter(i => filas[i].estado === 'pagada' && !usadasPagadas.has(i)).forEach(i => {
      if (saldo >= filas[i].valor - 0.5) { saldo -= filas[i].valor; usadasPagadas.add(i) }
    })
    // 2) Lo que sobre cubre las tarjetas sin marca de ese jugador: primero la del partido que el concepto nombra
    //    (por su fecha), después de la más vieja a la más nueva
    const nombraFecha = i => filas[i].fecha && concepto.includes(norm(`(${etiquetaFecha(filas[i].fecha)})`)) ? 0 : 1
    candidatas.filter(i => filas[i].estado === 'sin_marca' && !cubiertas.has(i)).sort((a, b) => nombraFecha(a) - nombraFecha(b)).forEach(i => {
      if (saldo >= filas[i].valor - 0.5) { saldo -= filas[i].valor; cubiertas.add(i) }
    })
  })
  return cubiertas
}
