// ── Tanda de penales (desempate en eliminatorias) ───────────────────────────
// Lógica pura, sin pantalla ni base de datos, para que se pueda probar sola.
//
// Un "cobro" (kick) es:
//   { side: 'local' | 'visitante',          // equipo que cobra
//     jugadorId, jugadorNombre, numero,     // quién cobra (jugadorId null = sin registro)
//     arqueroId, arqueroNombre,             // arquero rival que defendía
//     resultado: 'gol' | 'fuera' | 'atajado' }
//
// Reglas (las de siempre): cada equipo cobra N veces, alternando y empezando
// el equipo que sale a cobrar primero. Si un equipo ya no puede alcanzar al otro
// con los cobros que le quedan, la tanda termina ahí. Si tras los N cobros de
// cada uno siguen empatados, se pasa a muerte súbita: una ronda más, y gana quien
// quede arriba cuando los dos hayan cobrado la misma cantidad.
//
// IMPORTANTE: estos goles son SOLO de la tanda. No se le cuentan al jugador como
// gol del partido ni al arquero como gol recibido; al arquero solo se le suman
// las atajadas (resultado 'atajado').

export const RESULTADOS = ['gol', 'fuera', 'atajado']

const otro = side => (side === 'local' ? 'visitante' : 'local')

export function tomados(kicks, side) { return kicks.filter(k => k.side === side).length }
export function golesDe(kicks, side) { return kicks.filter(k => k.side === side && k.resultado === 'gol').length }
export function marcador(kicks) { return { local: golesDe(kicks, 'local'), visitante: golesDe(kicks, 'visitante') } }

// ¿Ya se decidió la tanda? Devuelve 'local' | 'visitante' | null
export function ganadorTanda(kicks, n) {
  const tl = tomados(kicks, 'local'), tv = tomados(kicks, 'visitante')
  const gl = golesDe(kicks, 'local'), gv = golesDe(kicks, 'visitante')
  if (tl >= n && tv >= n) {
    // Terminados los N cobros (o ya en muerte súbita): solo se define con la misma cantidad de cobros
    if (tl === tv && gl !== gv) return gl > gv ? 'local' : 'visitante'
    return null
  }
  const faltanL = Math.max(0, n - tl), faltanV = Math.max(0, n - tv)
  if (gl > gv + faltanV) return 'local'
  if (gv > gl + faltanL) return 'visitante'
  return null
}

// Quién cobra ahora. null si la tanda ya terminó.
// primero: equipo que cobra primero en cada ronda.
export function siguienteCobro(kicks, n, primero) {
  if (ganadorTanda(kicks, n)) return null
  const tl = tomados(kicks, 'local'), tv = tomados(kicks, 'visitante')
  const side = tl === tv ? primero : otro(primero)
  const ronda = tomados(kicks, side) + 1
  return { side, ronda, enMuerteSubita: ronda > n }
}

// Cuántos cobros por equipo hay que tener definidos para poder seguir (n, o n+1, n+2... en muerte súbita)
export function rondasNecesarias(kicks, n) {
  const sig = siguienteCobro(kicks, n, 'local')
  return sig ? Math.max(n, sig.ronda) : Math.max(n, Math.max(tomados(kicks, 'local'), tomados(kicks, 'visitante')))
}

// Atajadas por arquero: { [arqueroId|nombre]: { arqueroId, arqueroNombre, atajados, golesRecibidos, fuera, enfrentados } }
export function resumenArqueros(kicks) {
  const r = {}
  kicks.forEach(k => {
    const clave = k.arqueroId || (k.arqueroNombre ? `n:${k.arqueroNombre}` : null)
    if (!clave) return
    const x = (r[clave] = r[clave] || { arqueroId: k.arqueroId || null, arqueroNombre: k.arqueroNombre || '', atajados: 0, golesRecibidos: 0, fuera: 0, enfrentados: 0 })
    x.enfrentados++
    if (k.resultado === 'atajado') x.atajados++
    else if (k.resultado === 'gol') x.golesRecibidos++
    else x.fuera++
  })
  return r
}

// En la base de datos el ganador de penales se guarda como 'home' | 'away'
// (así lo leen la tabla de llaves, la portada y las apuestas). Algunas pantallas
// viejas usaban 'local' | 'visitante': esto las unifica.
export function normalizarGanador(v) {
  if (v === 'local' || v === 'home') return 'home'
  if (v === 'visitante' || v === 'away') return 'away'
  return null
}

// Filas para la tabla partido_penales. ids: { local: teamId, visitante: teamId }
export function filasParaGuardar(matchId, tournamentId, kicks, ids) {
  return kicks.map((k, i) => ({
    match_id: matchId,
    tournament_id: tournamentId || null,
    orden: i + 1,
    ronda: kicks.slice(0, i + 1).filter(x => x.side === k.side).length,
    team_id: ids[k.side],
    player_id: k.jugadorId || null,
    player_nombre: k.jugadorId ? null : (k.jugadorNombre || null),
    numero: k.numero ? String(k.numero) : null,
    arquero_id: k.arqueroId || null,
    arquero_nombre: k.arqueroId ? null : (k.arqueroNombre || null),
    resultado: k.resultado,
  }))
}

// ¿Esta eliminatoria quedó empatada de verdad y toca preguntar por penales?
//  fase: la del partido ('grupo', 'octavos', ...). golesLocal/golesVis: de ESTE partido.
//  globalLlave: { local, visitante } si es la vuelta de una llave ida/vuelta ya jugada (si no, null).
export function necesitaPreguntarPenales({ fase, golesLocal, golesVis, globalLlave }) {
  if (!fase || fase === 'grupo') return false
  if (globalLlave) return globalLlave.local === globalLlave.visitante
  return golesLocal === golesVis
}
