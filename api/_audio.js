// Convierte una nota de voz de Telegram (OGG/Opus) a M4A (AAC), que suena en TODOS los celulares,
// incluido el iPhone (Safari no reproduce OGG). Usa ffmpeg-static; si no está disponible o falla
// devuelve null y el chat guarda el audio original (con enlace de descarga como respaldo).
import { spawn } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export async function oggAM4a(datos) {
  let ffmpeg
  try { ffmpeg = (await import('ffmpeg-static')).default } catch { return null }
  if (!ffmpeg) return null
  const dir = await mkdtemp(join(tmpdir(), 'audio-'))
  try {
    const entrada = join(dir, 'entrada.ogg')
    const salida = join(dir, 'salida.m4a')
    await writeFile(entrada, datos)
    await new Promise((ok, mal) => {
      const p = spawn(ffmpeg, ['-y', '-i', entrada, '-vn', '-c:a', 'aac', '-b:a', '64k', '-movflags', '+faststart', salida], { stdio: 'ignore' })
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
