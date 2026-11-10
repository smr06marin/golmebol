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
  try {
    localStorage.removeItem(K_PREVIO); localStorage.removeItem(K_COPIA); localStorage.removeItem('golmebol_portales_ok')
    Object.keys(localStorage).filter(k => k.startsWith('gm_copia_')).forEach(k => localStorage.removeItem(k))
  } catch { /* nada */ }
}

// ── Copias de pantallas y portales ya verificados ─────────────────────────────────────────────
// Copia de lo último que vio cada persona en una pantalla (por ejemplo, su panel de árbitro o los horarios
// de su cancha): al volver a entrar se pinta de inmediato y los datos nuevos llegan detrás.
// Siempre atada a la cuenta: otra cuenta en el mismo celular nunca la ve. Se borra al cerrar sesión.
const P_COPIA = 'gm_copia_'

export function leerCopia(userId, nombre, maxMs = 24 * 60 * 60 * 1000) {
  if (!userId) return null
  try {
    const o = JSON.parse(localStorage.getItem(P_COPIA + nombre) || 'null')
    if (!o || o.u !== userId || Date.now() - o.t > maxMs) return null
    return o.v ?? null
  } catch { return null }
}

export function guardarCopia(userId, nombre, valor) {
  if (!userId) return
  try {
    const txt = JSON.stringify({ u: userId, t: Date.now(), v: valor })
    if (txt.length > 600000) return // muy grande: no vale la pena llenar el celular
    localStorage.setItem(P_COPIA + nombre, txt)
  } catch { /* lleno o sin permiso: se sigue sin copia */ }
}

export function borrarCopia(nombre) {
  try { localStorage.removeItem(P_COPIA + nombre) } catch { /* nada */ }
}

// Portales (árbitro, escuela, escenario, acudiente) que ya se comprobó que esta cuenta puede usar.
// Con eso la pantalla se abre DE UNA y la comprobación sigue por detrás: si resultara que ya no tiene el rol, se le saca.
const K_PORTALES = 'golmebol_portales_ok'

function leerPortales() {
  try { return JSON.parse(localStorage.getItem(K_PORTALES) || 'null') } catch { return null }
}

export function portalConocido(userId, portal) {
  const v = leerPortales()
  return !!(userId && v && v.userId === userId && v.portales && v.portales[portal])
}

export function marcarPortal(userId, portal) {
  if (!userId) return
  try {
    const v = leerPortales()
    const portales = v && v.userId === userId ? { ...(v.portales || {}) } : {}
    portales[portal] = true
    localStorage.setItem(K_PORTALES, JSON.stringify({ userId, portales }))
  } catch { /* nada */ }
}

export function olvidarPortal(userId, portal) {
  try {
    const v = leerPortales()
    if (!v || v.userId !== userId || !v.portales) return
    delete v.portales[portal]
    localStorage.setItem(K_PORTALES, JSON.stringify(v))
  } catch { /* nada */ }
}

// Del destino al que lleva el ingreso, deduce a qué portal pertenece
export function marcarPortalDeRuta(userId, ruta) {
  const r = String(ruta || '')
  if (r.startsWith('/arbitro')) marcarPortal(userId, 'arbitro')
  else if (r.startsWith('/escuela')) marcarPortal(userId, 'escuela')
  else if (r.startsWith('/escenario')) marcarPortal(userId, 'escenario')
  else if (r.startsWith('/acudiente')) marcarPortal(userId, 'acudiente')
}
