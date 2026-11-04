// Cuenta de plata de UN equipo, para el link público de finanzas (/finanzas/:token).
// Recibe lo que devuelve la función finanzas_equipo_ver() de la base de datos y arma:
//   · grupos:  resumen por concepto (arbitraje, tarjetas, inscripción, multas) con cargos, pagos y saldo
//   · lineas:  todos los movimientos, del más nuevo al más viejo
//   · totales: cuánto debe, cuánto ha pagado
// Mismas reglas de cobro que calcFinanzas() del panel de administración (AdminTorneoDetallePage):
//   · Arbitraje: se cobra por cada partido jugado (no W) y se paga en efectivo en la cancha → no deja deuda.
//   · Tarjetas: igual que el link de deudores — se debe lo que siga sin marcar como pagado (por partido, la más cara).
//   · Inscripción: por equipo, o por jugador inscrito × tarifa; los abonos entran como 'abono_inscripcion'.
//   · Multas: la W al que NO se presentó + deudas anotadas a mano sin pagar; los pagos entran como 'pago_cargos'.
//   · Inscripción y multas solo se muestran si el torneo "lleva cuentas" (finanzas_config.llevar_cuentas).

const num = v => Number(v) || 0

export const ETIQUETAS = {
  arbitraje:   { icono: '🧑‍⚖️', etiqueta: 'Arbitraje' },
  tarjetas:    { icono: '🟨',   etiqueta: 'Tarjetas' },
  inscripcion: { icono: '📝',   etiqueta: 'Inscripción' },
  multas:      { icono: '⛔',   etiqueta: 'Multas / W' },
}

export function armarCuentaEquipo(d) {
  const fc = d?.torneo?.config || {}
  const llevar = !!fc.llevar_cuentas
  const equipoId = d?.equipo?.id
  const pA = num(fc.precio_amarilla), pZ = num(fc.precio_azul), pR = num(fc.precio_roja)
  const partidos = d?.partidos || []
  const movimientos = d?.movimientos || []
  const porId = new Map(partidos.map(p => [p.id, p]))
  const rivalDe = p => (p.home_team_id === equipoId ? p.away_nombre : p.home_nombre) || 'Rival'

  const lineas = [] // { id, fecha, tipo: 'cargo' | 'pago' | 'info', grupo, titulo, detalle, monto }
  let n = 0
  const add = l => lineas.push({ id: `l${n++}`, fecha: null, detalle: '', ...l })

  // ── Arbitraje: se paga en efectivo en la cancha el día del partido → siempre sale como pagado, sin valor ──
  if (num(fc.arbitraje_equipo) > 0) {
    partidos.filter(p => p.status === 'finished' && p.tipo_resultado !== 'w').forEach(p => {
      add({ fecha: p.played_at, tipo: 'info', grupo: 'arbitraje', titulo: `Arbitraje · vs ${rivalDe(p)}`, detalle: 'Pagado en la cancha el día del partido', monto: 0 })
    })
  }

  // ── Tarjetas ──
  // MISMA regla que el link de deudores (ver_deudores_por_link): lo que se debe son las tarjetas que siguen SIN marcar
  // como pagadas en las estadísticas del partido (yellow_paid / blue_paid / red_paid). Si en un partido hay varias
  // sin pagar, solo se cobra la más cara. Así el equipo ve exactamente lo mismo que el organizador en el link de deudores.
  ;(d?.tarjetas_stats || []).forEach(st => {
    if (!st.player_id) return
    const am = num(st.yellow_cards) > 0, az = num(st.blue_cards) > 0, rj = num(st.red_cards) > 0
    if (!am && !az && !rj) return
    const valor = Math.max(am ? pA : 0, az ? pZ : 0, rj ? pR : 0)
    const pendiente = Math.max(am && !st.yellow_paid ? pA : 0, az && !st.blue_paid ? pZ : 0, rj && !st.red_paid ? pR : 0)
    if (valor <= 0) return
    const p = porId.get(st.match_id)
    const icono = (am ? '🟨' : '') + (az ? '🟦' : '') + (rj ? '🟥' : '')
    add({ fecha: p?.played_at || null, tipo: 'cargo', grupo: 'tarjetas', titulo: `${icono} ${st.nombre || 'Jugador'}`, detalle: p ? `Partido vs ${rivalDe(p)}` : 'Tarjeta', monto: valor, pendiente })
  })
  movimientos.filter(m => m.tipo === 'pago_tarjetas').forEach(m => {
    // El nombre sale del jugador del pago o, si no lo trae, del concepto ("Tarjeta(s) de NOMBRE — ...")
    const deConcepto = (m.concepto || '').match(/^Tarjeta\(s\) de (.+?)(?: — |$)/)
    const nombre = m.jugador || (deConcepto ? deConcepto[1] : '')
    add({ fecha: m.created_at, tipo: 'pago', grupo: 'tarjetas', titulo: nombre ? `Pagó la tarjeta de ${nombre}` : 'Pagó una tarjeta', detalle: nombre ? '' : (m.concepto || ''), monto: num(m.monto) })
  })

  if (llevar) {
    // ── Inscripción ──
    const porJugador = fc.inscripcion_modo === 'jugador'
    const tarifa = num(fc.inscripcion_jugador)
    const inscritos = num(d?.inscritos)
    const inscripcion = porJugador ? inscritos * tarifa : num(fc.inscripcion)
    if (inscripcion > 0) {
      add({ tipo: 'cargo', grupo: 'inscripcion', titulo: 'Inscripción', detalle: porJugador ? `${inscritos} jugador(es) × ${'$' + Math.round(tarifa).toLocaleString('es-CO')}` : 'Inscripción del equipo', monto: inscripcion })
    }
    movimientos.filter(m => m.tipo === 'abono_inscripcion').forEach(m => {
      add({ fecha: m.created_at, tipo: 'pago', grupo: 'inscripcion', titulo: 'Pago de inscripción', detalle: [m.jugador, m.concepto].filter(Boolean).join(' · '), monto: num(m.monto) })
    })

    // ── Multas: W (al que no se presentó) + deudas anotadas a mano ──
    const multaW = num(fc.multa_no_presenta)
    if (multaW > 0) {
      partidos.filter(p => p.status === 'finished' && p.tipo_resultado === 'w').forEach(p => {
        const presentaId = num(p.home_score) > num(p.away_score) ? p.home_team_id : p.away_team_id
        const ausenteId = presentaId === p.home_team_id ? p.away_team_id : p.home_team_id
        if (ausenteId === equipoId) add({ fecha: p.played_at, tipo: 'cargo', grupo: 'multas', titulo: 'Multa por no presentarse (W)', detalle: `Partido vs ${rivalDe(p)}`, monto: multaW })
      })
    }
    movimientos.filter(m => m.tipo === 'cargo_manual').forEach(m => {
      add({
        fecha: m.created_at, tipo: m.pagado ? 'info' : 'cargo', grupo: 'multas',
        titulo: m.concepto || 'Deuda anotada', detalle: m.pagado ? 'Ya pagada' : 'Deuda anotada por el organizador', monto: num(m.monto),
      })
    })
    movimientos.filter(m => m.tipo === 'pago_cargos').forEach(m => {
      add({ fecha: m.created_at, tipo: 'pago', grupo: 'multas', titulo: 'Pagó una multa / W', detalle: m.concepto || '', monto: num(m.monto) })
    })
  }

  // ── Resumen por concepto ──
  const grupos = Object.keys(ETIQUETAS).map(clave => {
    const ls = lineas.filter(l => l.grupo === clave)
    const cargos = ls.filter(l => l.tipo === 'cargo').reduce((a, l) => a + l.monto, 0)
    const pagos = ls.filter(l => l.tipo === 'pago').reduce((a, l) => a + l.monto, 0)
    const informativo = ls.filter(l => l.tipo === 'info').reduce((a, l) => a + l.monto, 0)
    // Tarjetas: lo que se debe es lo que sigue sin marcar como pagado (igual que el admin), no cargos - pagos
    const saldo = clave === 'tarjetas'
      ? ls.filter(l => l.tipo === 'cargo').reduce((a, l) => a + l.pendiente, 0)
      : cargos - pagos
    return { clave, ...ETIQUETAS[clave], cargos, pagos, informativo, saldo, hay: ls.length > 0 }
  }).filter(g => g.hay)

  const totalDebe = grupos.filter(g => g.clave !== 'arbitraje').reduce((a, g) => a + Math.max(g.saldo, 0), 0)
  const totalPagado = grupos.reduce((a, g) => a + g.pagos, 0)

  // Más nuevo primero; lo que no tiene fecha (la inscripción) va al final
  lineas.sort((a, b) => {
    if (!a.fecha && !b.fecha) return 0
    if (!a.fecha) return 1
    if (!b.fecha) return -1
    return new Date(b.fecha) - new Date(a.fecha)
  })

  // ── Qué cargos siguen SIN pagar ──
  // Los pagos se anotan por concepto (no por línea), así que se asume que se paga primero lo más viejo:
  // lo que sigue debiéndose son los cargos más nuevos hasta completar el saldo del concepto.
  grupos.forEach(g => {
    let restante = g.clave === 'arbitraje' ? 0 : Math.max(g.saldo, 0)
    lineas.filter(l => l.grupo === g.clave && l.tipo === 'cargo').forEach(l => {
      if (l.pendiente !== undefined) return // tarjetas: ya viene de las marcas de pago de cada jugador
      l.pendiente = Math.min(l.monto, restante)
      restante -= l.pendiente
    })
  })

  return { grupos, lineas, totalDebe, totalPagado }
}
