// Helpers compartidos por todas las páginas del módulo Escenarios Deportivos
// (tienda + canchas). Centralizados acá para no repetir la lógica de horarios/
// slots en cada página (Canchas, Solicitudes, Panel, página pública, etc).

import { supabase } from './supabase'

export const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

export function fmtMoney(n) { return '$' + Math.round(n || 0).toLocaleString('es-CO') }

export function todayStr() { return new Date().toISOString().slice(0, 10) }

export function fmtDate(d) {
  const dt = new Date(d + 'T00:00:00')
  return dt.toLocaleDateString('es-CO', { weekday: 'short', day: '2-digit', month: 'short' })
}

// Horas del día según la config de apertura/cierre del escenario (default 8-22 si aún no tiene config).
export function getHours(escenario) {
  const apertura = escenario?.hora_apertura ?? 8
  const cierre = escenario?.hora_cierre ?? 22
  const arr = []
  for (let h = apertura; h < cierre; h++) arr.push(String(h).padStart(2, '0') + ':00')
  return arr
}

function horaEnRango(hora, r) {
  const inicio = parseInt(r.hora, 10)
  const fin = inicio + Math.ceil((r.duracion || 60) / 60)
  const h = parseInt(hora, 10)
  return h >= inicio && h < fin
}

// Estado de un horario puntual: 'libre' | 'pendiente' | 'ocupado'
export function slotEstado(reservas, cancha, fecha, hora) {
  const rs = (reservas || []).filter(r => r.cancha === cancha && r.fecha === fecha && horaEnRango(hora, r))
  if (rs.some(r => r.estado === 'aceptada' || r.estado === 'mantenimiento')) return 'ocupado'
  if (rs.some(r => r.estado === 'pendiente')) return 'pendiente'
  return 'libre'
}

// `canchas` es la lista de filas de escenario_canchas (id, slug, nombre,
// precio_hora, activa...) — reemplaza el viejo hardcode a solo
// ['futbol5','futbol7'], ahora el escenario puede tener las canchas que
// el encargado haya creado.
export function allSlotsForDate(escenario, canchas, reservas, fecha) {
  const slots = []
  ;(canchas || []).forEach(({ slug }) => {
    getHours(escenario).forEach(h => {
      slots.push({ cancha: slug, hora: h, estado: slotEstado(reservas, slug, fecha, h) })
    })
  })
  return slots
}

export function precioCancha(canchas, slug) {
  return (canchas || []).find(c => c.slug === slug)?.precio_hora ?? 0
}

export function nombreCancha(canchas, slug) {
  return (canchas || []).find(c => c.slug === slug)?.nombre || slug
}

// Genera un slug único y legible a partir del nombre que escribió el
// encargado (ej: "Cancha VIP" → "cancha-vip-4f2a"), para guardarlo en
// escenario_reservas.cancha.
export function slugifyCancha(nombre) {
  const base = (nombre || 'cancha')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // quita tildes
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'cancha'
  const suf = Math.random().toString(36).slice(2, 6)
  return `${base}-${suf}`
}

// Si el admin bloqueó el escenario (activo=false) o se venció la fecha
// pagada, el portal del encargado y la página pública de reservas dejan de
// funcionar. Sin fecha_vencimiento (o sin la columna todavía, si falta
// correr la migración) se considera activo mientras "activo" no sea false.
// Redimensiona y comprime una foto en el navegador antes de subirla (para
// que una foto de cámara de celular, que puede pesar varios MB, no se suba
// tal cual). Devuelve un Blob JPEG liviano listo para mandar a Storage.
export function comprimirImagen(file, { maxDim = 500, calidad = 0.72 } = {}) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      let { width, height } = img
      if (width > maxDim || height > maxDim) {
        if (width > height) { height = Math.round(height * maxDim / width); width = maxDim }
        else { width = Math.round(width * maxDim / height); height = maxDim }
      }
      const canvas = document.createElement('canvas')
      canvas.width = width; canvas.height = height
      canvas.getContext('2d').drawImage(img, 0, 0, width, height)
      canvas.toBlob(
        blob => blob ? resolve(blob) : reject(new Error('No se pudo comprimir la imagen')),
        'image/jpeg', calidad
      )
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo leer la imagen')) }
    img.src = url
  })
}

// Categorías sugeridas para el catálogo de la tienda del escenario — se
// guardan como texto libre, así que el encargado puede escribir cualquier
// otra si su negocio vende algo distinto.
export const CATEGORIAS_PRODUCTO = ['Bebidas', 'Papas', 'Dulces', 'Galletas', 'Comidas', 'Otros']

function cargarImagen(file) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo leer la imagen')) }
    img.src = url
  })
}

// Prepara una foto de producto: la redimensiona y, si se pide, le quita el
// fondo. No usa ninguna librería externa de IA (las que hay son de pago o
// con licencia AGPL, que obligaría a liberar el código fuente de toda la
// plataforma) — en vez de eso, estima el color del fondo muestreando las
// esquinas de la foto y vuelve transparente todo lo que se le parezca, con
// un borde suave para que el corte no se vea tan duro. Funciona bien con
// fotos de producto sobre fondo liso (mesa, pared, blanco) — si el fondo es
// muy complejo, conviene subir la foto sin esta opción.
export async function prepararFotoProducto(file, { maxDim = 500, quitarFondo = false, tolerancia = 32, difuminado = 22 } = {}) {
  const img = await cargarImagen(file)
  let { width, height } = img
  if (width > maxDim || height > maxDim) {
    if (width > height) { height = Math.round(height * maxDim / width); width = maxDim }
    else { width = Math.round(width * maxDim / height); height = maxDim }
  }
  const canvas = document.createElement('canvas')
  canvas.width = width; canvas.height = height
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0, width, height)

  if (quitarFondo && width > 4 && height > 4) {
    const imageData = ctx.getImageData(0, 0, width, height)
    const data = imageData.data
    const muestra = (x, y) => { const i = (y * width + x) * 4; return [data[i], data[i + 1], data[i + 2]] }
    const esquinas = [muestra(1, 1), muestra(width - 2, 1), muestra(1, height - 2), muestra(width - 2, height - 2)]
    const bg = [0, 1, 2].map(c => Math.round(esquinas.reduce((a, e) => a + e[c], 0) / esquinas.length))
    for (let i = 0; i < data.length; i += 4) {
      const dist = Math.sqrt((data[i] - bg[0]) ** 2 + (data[i + 1] - bg[1]) ** 2 + (data[i + 2] - bg[2]) ** 2)
      if (dist < tolerancia) data[i + 3] = 0
      else if (dist < tolerancia + difuminado) data[i + 3] = Math.round(255 * (dist - tolerancia) / difuminado)
    }
    ctx.putImageData(imageData, 0, 0)
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => blob ? resolve(blob) : reject(new Error('No se pudo procesar la imagen')),
      quitarFondo ? 'image/png' : 'image/jpeg', quitarFondo ? undefined : 0.72
    )
  })
}

// Mantiene generadas las próximas `semanas` ocurrencias de cada reserva fija
// activa del escenario, como filas reales de escenario_reservas (para que
// aparezcan en la agenda/disponibilidad igual que cualquier otra reserva).
// Es una "ventana móvil" sin fecha de corte: cada vez que se abre cualquier
// pantalla que lea reservas, se vuelve a completar la ventana desde HOY hacia
// adelante — así el horario fijo dura para siempre, semana tras semana, hasta
// que el encargado lo desactive manualmente (no hay que "renovarlo" nunca).
// No duplica nada: cada ocurrencia queda enlazada a su regla vía
// reserva_fija_id, así que si ya existe para esa fecha no se vuelve a crear
// (y si el encargado canceló puntualmente una fecha, esa cancelación queda
// como está, no se regenera).
export async function asegurarReservasFijas(escenarioId, semanas = 12) {
  const { data: fijas } = await supabase.from('escenario_reservas_fijas').select('*').eq('escenario_id', escenarioId).eq('activa', true)
  if (!fijas || fijas.length === 0) return

  const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
  const desde = hoy.toISOString().slice(0, 10)
  const { data: existentes } = await supabase.from('escenario_reservas').select('reserva_fija_id, fecha')
    .eq('escenario_id', escenarioId).not('reserva_fija_id', 'is', null).gte('fecha', desde)
  const yaExiste = new Set((existentes || []).map(r => `${r.reserva_fija_id}_${r.fecha}`))

  const filas = []
  fijas.forEach(f => {
    for (let i = 0; i < semanas * 7; i++) {
      const d = new Date(hoy); d.setDate(d.getDate() + i)
      if (d.getDay() !== f.dia_semana) continue
      const fecha = d.toISOString().slice(0, 10)
      if (yaExiste.has(`${f.id}_${fecha}`)) continue
      filas.push({
        escenario_id: escenarioId, cancha: f.cancha, fecha, hora: f.hora, duracion: f.duracion,
        nombre: f.nombre, telefono: f.telefono || '', equipo: f.equipo || null,
        estado: 'aceptada', pago: 'pendiente', monto: f.monto, monto_pagado: 0,
        reserva_fija_id: f.id,
      })
    }
  })
  if (filas.length > 0) await supabase.from('escenario_reservas').insert(filas)
}

export function escenarioActivo(escenario) {
  if (!escenario) return false
  if (escenario.activo === false) return false
  if (escenario.fecha_vencimiento && new Date(escenario.fecha_vencimiento) < new Date()) return false
  return true
}
