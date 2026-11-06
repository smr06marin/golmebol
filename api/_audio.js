// Conversión de audio con ffmpeg-static.
//  · oggAM4a : nota de voz de Telegram (OGG/Opus) → M4A (AAC), que suena en TODOS los celulares, incluido el iPhone.
//  · aOggOpus: audio grabado en el navegador (MP4/WebM "fragmentado", sin duración) → OGG/Opus, el formato real de
//              las notas de voz de Telegram. Sin esto Telegram lo muestra en 0:00 y no lo reproduce.
// Si ffmpeg no está disponible o falla, devuelven null y quien llama sigue con el archivo original.
import { spawn } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

async function convertir(datos, extEntrada, extSalida, argumentos) {
  let ffmpeg
  try { ffmpeg = (await import('ffmpeg-static')).default } catch { return null }
  if (!ffmpeg) return null
  const dir = await mkdtemp(join(tmpdir(), 'audio-'))
  try {
    const entrada = join(dir, `entrada.${extEntrada}`)
    const salida = join(dir, `salida.${extSalida}`)
    await writeFile(entrada, datos)
    await new Promise((ok, mal) => {
      const p = spawn(ffmpeg, ['-y', '-i', entrada, '-vn', ...argumentos, salida], { stdio: 'ignore' })
      const corte = setTimeout(() => { try { p.kill() } catch { /* ya terminó */ } mal(new Error('ffmpeg tardó demasiado')) }, 40000)
      p.on('error', e => { clearTimeout(corte); mal(e) })
      p.on('exit', c => { clearTimeout(corte); c === 0 ? ok() : mal(new Error(`ffmpeg salió con ${c}`)) })
    })
    return await readFile(salida)
  } catch (e) {
    console.error('audio:', e?.message || e)
    return null
  } finally {
    rm(dir, { recursive: true, force: true }).catch(() => {})
  }
}

export const oggAM4a = datos => convertir(datos, 'ogg', 'm4a', ['-c:a', 'aac', '-b:a', '64k', '-movflags', '+faststart'])
export const aOggOpus = (datos, extEntrada = 'm4a') => convertir(datos, extEntrada, 'ogg', ['-c:a', 'libopus', '-b:a', '32k', '-ar', '48000', '-ac', '1', '-f', 'ogg'])
