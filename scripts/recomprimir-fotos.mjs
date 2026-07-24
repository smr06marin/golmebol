#!/usr/bin/env node
// Recomprime retroactivamente las fotos YA subidas (jugadores y escudos de
// equipo) para que carguen rápido y se vean en todos los navegadores.
//
// Por qué hace falta: antes de este script, las fotos se subían tal cual
// salían del celular. Dos problemas:
//   1) Pesan varios MB -> lentas de cargar.
//   2) Muchos iPhones guardan fotos en formato HEIC. Casi ningún navegador
//      que no sea Safari puede MOSTRAR un HEIC (por eso "a muchos no les
//      carga la foto" — no está rota, es que el navegador no la puede
//      decodificar). Este script las re-codifica todas a JPEG.
//
// Requiere: npm install sharp --save-dev   (una sola vez)
//
// Uso:
//   node scripts/recomprimir-fotos.mjs            (SIMULACIÓN: solo reporta, no cambia nada)
//   node scripts/recomprimir-fotos.mjs --apply     (aplica los cambios de verdad)

import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))

function leerEnvLocal() {
  const env = {}
  try {
    const contenido = readFileSync(join(__dirname, '..', '.env.local'), 'utf8')
    contenido.split(/\r?\n/).forEach(linea => {
      const m = linea.match(/^([A-Z_]+)=(.*)$/)
      if (m) env[m[1]] = m[2].trim()
    })
  } catch {}
  return env
}

const env = leerEnvLocal()
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || env.VITE_SUPABASE_URL
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Falta VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY (revisá .env.local)')
  process.exit(1)
}
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

const APLICAR = process.argv.includes('--apply')
const MAX_SIZE_PERFIL  = 900
const MAX_SIZE_LOGO    = 500
const MAX_SIZE_CEDULA  = 1600 // más resolución que una foto de perfil para que el número siga siendo legible
const CALIDAD = 82
const CALIDAD_CEDULA = 85
const UMBRAL_OMITIR = 180 * 1024 // si ya pesa menos que esto Y ya es jpeg/png, no se toca

function parsearUrl(url) {
  // .../storage/v1/object/public/<bucket>/<path>?query
  const m = url.match(/\/object\/public\/([^/]+)\/([^?]+)/)
  if (!m) return null
  return { bucket: m[1], path: decodeURIComponent(m[2]) }
}

function esperar(ms) { return new Promise(r => setTimeout(r, ms)) }

// Descarga con 1 reintento — las descargas grandes a veces se cortan a mitad
// de camino (ECONNRESET) por una red inestable, no porque el archivo esté mal.
async function descargarConReintento(url) {
  for (let intento = 1; intento <= 2; intento++) {
    try {
      const resp = await fetch(url)
      if (!resp.ok) return { ok: false, http: resp.status }
      const buffer = Buffer.from(await resp.arrayBuffer())
      return { ok: true, buffer }
    } catch (e) {
      if (intento === 2) return { ok: false, error: e.message }
      await esperar(800)
    }
  }
}

async function procesarUno({ url, maxSize, calidad = CALIDAD }) {
  const info = parsearUrl(url)
  if (!info) return { estado: 'url_rara', url }

  // Cualquier cosa inesperada (red, sharp, supabase) cae acá y se reporta
  // como error de ESA foto puntual, en vez de tumbar el script completo.
  try {
    const descarga = await descargarConReintento(url)
    if (!descarga.ok) {
      if (descarga.http) return { estado: 'roto_404', url, ...info, http: descarga.http }
      return { estado: 'fetch_fallo', url, ...info, error: descarga.error }
    }
    const buffer = descarga.buffer

    let metadata
    try { metadata = await sharp(buffer).metadata() } catch (e) {
      return { estado: 'formato_no_decodificable', url, ...info, error: e.message, pesoOriginal: buffer.length }
    }

    const formatoRaro = !['jpeg', 'jpg', 'png', 'webp'].includes(metadata.format)
    const muyGrande = buffer.length > UMBRAL_OMITIR || (metadata.width || 0) > maxSize || (metadata.height || 0) > maxSize

    if (!formatoRaro && !muyGrande) return { estado: 'ya_ok', url, ...info, pesoOriginal: buffer.length, formato: metadata.format }

    let salida
    try {
      salida = await sharp(buffer)
        .rotate() // respeta la orientación EXIF antes de recomprimir
        .resize(maxSize, maxSize, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: calidad })
        .toBuffer()
    } catch (e) {
      return { estado: 'error_procesando', url, ...info, error: e.message, pesoOriginal: buffer.length, formatoOriginal: metadata.format }
    }

    if (APLICAR) {
      const { error } = await supabase.storage.from(info.bucket).upload(info.path, salida, { upsert: true, contentType: 'image/jpeg' })
      if (error) return { estado: 'error_subiendo', url, ...info, error: error.message }
    }

    return {
      estado: APLICAR ? 'recomprimida' : 'se_recomprimiria',
      url, ...info,
      formatoOriginal: metadata.format,
      pesoOriginal: buffer.length,
      pesoNuevo: salida.length,
    }
  } catch (e) {
    return { estado: 'error_inesperado', url, ...info, error: e.message }
  }
}

async function procesarLote(items, concurrencia = 4) {
  const resultados = []
  let i = 0
  async function trabajador() {
    while (i < items.length) {
      const idx = i++
      resultados[idx] = await procesarUno(items[idx])
      const r = resultados[idx]
      const pct = `${i}/${items.length}`
      if (r.estado === 'ya_ok') console.log(`[${pct}] ok, no toca — ${r.path}`)
      else if (r.estado === 'roto_404') console.log(`[${pct}] ROTA (404) — ${r.path || r.url}`)
      else if (r.estado === 'formato_no_decodificable') console.log(`[${pct}] NO SE PUDO LEER — ${r.path} (${r.error})`)
      else console.log(`[${pct}] ${r.estado} — ${r.path} ${r.pesoOriginal ? (r.pesoOriginal/1024).toFixed(0)+'KB' : ''}${r.pesoNuevo ? ' -> ' + (r.pesoNuevo/1024).toFixed(0)+'KB' : ''}`)
    }
  }
  await Promise.all(Array.from({ length: concurrencia }, trabajador))
  return resultados
}

async function main() {
  console.log(APLICAR ? '=== MODO APLICAR (se van a sobreescribir fotos en Storage) ===' : '=== MODO SIMULACIÓN (no cambia nada, solo reporta) ===')

  const { data: jugadores, error: errJ } = await supabase.from('players').select('id, name, photo_url, photo_face_url, cedula_frontal_url, cedula_trasera_url')
  if (errJ) { console.error('No se pudo leer players:', errJ.message); process.exit(1) }
  const { data: equipos, error: errE } = await supabase.from('teams').select('id, name, logo_url')
  if (errE) { console.error('No se pudo leer teams:', errE.message); process.exit(1) }

  const items = []
  jugadores.forEach(p => {
    if (p.photo_url)          items.push({ url: p.photo_url,          maxSize: MAX_SIZE_PERFIL })
    if (p.photo_face_url)     items.push({ url: p.photo_face_url,     maxSize: MAX_SIZE_PERFIL })
    if (p.cedula_frontal_url) items.push({ url: p.cedula_frontal_url, maxSize: MAX_SIZE_CEDULA, calidad: CALIDAD_CEDULA })
    if (p.cedula_trasera_url) items.push({ url: p.cedula_trasera_url, maxSize: MAX_SIZE_CEDULA, calidad: CALIDAD_CEDULA })
  })
  equipos.forEach(t => { if (t.logo_url) items.push({ url: t.logo_url, maxSize: MAX_SIZE_LOGO }) })

  console.log(`Total de fotos a revisar: ${items.length}\n`)

  const resultados = await procesarLote(items)

  const resumen = {}
  resultados.forEach(r => { resumen[r.estado] = (resumen[r.estado] || 0) + 1 })
  console.log('\n=== RESUMEN ===')
  console.log(resumen)

  const rotas = resultados.filter(r => r.estado === 'roto_404')
  if (rotas.length) {
    console.log(`\n${rotas.length} foto(s) rota(s) (el archivo ya no existe en Storage — conviene borrar esa referencia para que la app pida subirla de nuevo):`)
    rotas.forEach(r => console.log(' -', r.url))
  }

  const noDecodificables = resultados.filter(r => r.estado === 'formato_no_decodificable')
  if (noDecodificables.length) {
    console.log(`\n${noDecodificables.length} archivo(s) que ni este script pudo leer (revisar a mano):`)
    noDecodificables.forEach(r => console.log(' -', r.url, r.error))
  }

  const pesoAntes = resultados.reduce((s, r) => s + (r.pesoOriginal || 0), 0)
  const pesoDespues = resultados.reduce((s, r) => s + (r.pesoNuevo ?? r.pesoOriginal ?? 0), 0)
  console.log(`\nPeso total antes: ${(pesoAntes/1024/1024).toFixed(1)}MB — después: ${(pesoDespues/1024/1024).toFixed(1)}MB`)

  if (!APLICAR) console.log('\nEsto fue una SIMULACIÓN. Para aplicar de verdad: node scripts/recomprimir-fotos.mjs --apply')
}

main().catch(e => { console.error('FALLÓ:', e); process.exit(1) })
