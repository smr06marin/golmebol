// Atajos para que la pantalla del jugador cargue rápido al ingresar.
//
// 1) "Perfil previo": cuando se inicia sesión ya se sabe cuál es el jugador (id y cédula).
//    Así la pantalla puede pedir TODO a la base al mismo tiempo, en vez de esperar primero
//    a que llegue el perfil para recién después pedir lo demás (un viaje de ida y vuelta menos).
// 2) "Copia del perfil": la última pantalla cargada se guarda en el celular. Al volver a entrar
//    se muestra de inmediato con esos datos y se actualiza por detrás.
// Todo va atado al usuario: otra cuenta en el mismo celular nunca ve estos datos.
const K_PREVIO = 'golmebol_perfil_previo'
const K_COPIA = 'golmebol_perfil_copia'

export function leerPerfilPrevio(userId) {
  try {
    const v = JSON.parse(localStorage.getItem(K_PREVIO) || 'null')
    return v && v.userId === userId && v.playerId ? v : null
  } catch { return null }
}

export function guardarPerfilPrevio(userId, playerId, cedula) {
  if (!userId || !playerId) return
  try { localStorage.setItem(K_PREVIO, JSON.stringify({ userId, playerId, cedula: cedula || '' })) } catch { /* sin almacenamiento: solo es un atajo */ }
}

export function leerCopiaPerfil() {
  try { return JSON.parse(localStorage.getItem(K_COPIA) || 'null') } catch { return null }
}

export function guardarCopiaPerfil(copia) {
  try { localStorage.setItem(K_COPIA, JSON.stringify(copia)) } catch { /* lleno o sin permiso: se sigue sin copia */ }
}

export function olvidarPerfilGuardado() {
  try { localStorage.removeItem(K_PREVIO); localStorage.removeItem(K_COPIA) } catch { /* nada */ }
}
