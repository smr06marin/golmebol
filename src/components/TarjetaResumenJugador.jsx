import { useEffect, useMemo, useRef, useState } from 'react'
import { Camera } from 'lucide-react'
import { compartirOBajarBlob } from '../lib/flyerDescarga'
import { armarModelo, dibujarTarjeta, temaDesdeImagen } from '../lib/tarjetaCanvas'
import { focoDeFoto } from '../lib/focoRostro'

// ── "Mi tarjeta": imagen del resumen del jugador, lista para compartir ──────
// Botón en el perfil público del jugador. Arma una imagen vertical 9:16 (1080×1920,
// la medida de los estados de WhatsApp e Instagram) con foto, nombre, equipo, cifras,
// palmarés (campeón, subcampeón, semifinales, cuartos…), MVP, reconocimientos y un
// QR que abre su perfil completo. Se manda a la hoja de compartir del celular (o se
// descarga en computador).
//
// RÁPIDA: la imagen se dibuja directo en un canvas (ver lib/tarjetaCanvas.js), sin
// librerías pesadas, y se deja hecha de antemano un momento después de abrir el
// perfil: al tocar el botón solo se comparte.

// Imágenes (foto, escudos, QR): se bajan una sola vez y se guardan en memoria.
const imagenes = new Map()
function cargarImagen(url) {
  if (!url) return Promise.resolve(null)
  if (imagenes.has(url)) return imagenes.get(url)
  const p = (async () => {
    // 1) descarga como archivo: así la imagen queda "limpia" para el canvas (sin problemas de CORS al exportar)
    try {
      const r = await fetch(url, { mode: 'cors', cache: 'force-cache' })
      if (r.ok) {
        const blob = await r.blob()
        if (typeof createImageBitmap === 'function') {
          try { return await createImageBitmap(blob) } catch { /* se prueba con <img> */ }
        }
        const objeto = URL.createObjectURL(blob)
        try {
          const img = new Image()
          img.src = objeto
          await img.decode()
          return img
        } finally { URL.revokeObjectURL(objeto) }
      }
    } catch { /* se prueba el método 2 */ }
    // 2) <img> con permiso CORS
    return new Promise(ok => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => ok(img)
      img.onerror = () => ok(null)
      img.src = url
    })
  })()
  imagenes.set(url, p)
  return p
}

function imagenQr(id) {
  const clave = `qr:${id}`
  if (imagenes.has(clave)) return imagenes.get(clave)
  const p = import('qrcode')
    .then(({ default: QRCode }) => QRCode.toDataURL(`${window.location.origin}/j/${id}`, { width: 240, margin: 1, color: { dark: '#050b1f', light: '#ffffff' } }))
    .then(cargarImagen)
    .catch(() => null)
  imagenes.set(clave, p)
  return p
}

let fuentesListas = null
function cargarFuentes() {
  if (!fuentesListas) {
    fuentesListas = Promise.all([
      document.fonts.load("600 22px 'Barlow Condensed'"),
      document.fonts.load("800 34px 'Barlow Condensed'"),
      document.fonts.load("900 48px 'Barlow Condensed'"),
      document.fonts.load("900 12px 'Poppins'"),
    ]).catch(() => { /* se usa la letra de respaldo */ })
  }
  return fuentesListas
}

export default function TarjetaResumenJugador({ jugador, totales, puestos, equipoActual, posicion, arq, porTorneo, logros, partidos, estilo }) {
  const [ocupado, setOcupado] = useState(false)
  const archivoRef = useRef(null)      // { blob, clave }: imagen ya hecha
  const generandoRef = useRef(null)    // promesa de la imagen en curso

  const fotoUrl = jugador.photo_face_url || jugador.photo_url
  const logoUrl = equipoActual?.logo_url || null

  const modelo = useMemo(
    () => armarModelo({ jugador, totales, puestos, equipoActual, posicion, arq, porTorneo, logros, partidos }),
    [jugador, totales, puestos, equipoActual, posicion, arq, porTorneo, logros, partidos],
  )
  // Si cambia algo que se ve en la tarjeta (ej. llegan los puestos), la imagen se rehace
  const clave = useMemo(() => JSON.stringify([jugador.id, fotoUrl, logoUrl, modelo]), [jugador.id, fotoUrl, logoUrl, modelo])

  async function generarArchivo() {
    const claveAhora = clave
    // escudos de los equipos que aparecen en el palmarés (los mismos se repiten: se piden una vez)
    const equiposFilas = {}
    modelo.palmares.filas.slice(0, 10).forEach(f => { if (f.equipo?.id && f.equipo.logo_url) equiposFilas[f.equipo.id] = f.equipo.logo_url })
    const idsEq = Object.keys(equiposFilas)
    const [foto, escudo, qr, escudosFilas] = await Promise.all([
      cargarImagen(fotoUrl),
      cargarImagen(logoUrl),
      imagenQr(jugador.id),
      Promise.all(idsEq.map(id => cargarImagen(equiposFilas[id]))),
      cargarFuentes(),
    ])
    const escudosCache = {}
    idsEq.forEach((id, i) => { if (escudosFilas[i]) escudosCache[id] = escudosFilas[i] })
    // Dónde está la cara en la foto (para que se vean los ojos). La primera vez en un celular puede
    // tardar un poco (baja el detector); si pasa de 4 s se usa el encuadre normal y la próxima vez ya queda guardado.
    const foco = foto ? await Promise.race([focoDeFoto(fotoUrl, foto), new Promise(ok => setTimeout(() => ok(null), 4000))]) : null
    const canvas = document.createElement('canvas')
    dibujarTarjeta(canvas, { ...modelo, foto, foco, escudo, qr, tema: temaDesdeImagen(escudo), escudosCache })
    const blob = await new Promise(ok => canvas.toBlob(ok, 'image/png'))
    if (!blob) throw new Error('No se pudo crear la imagen')
    archivoRef.current = { blob, clave: claveAhora }
    return archivoRef.current
  }

  // Imagen hecha de antemano, un momento después de abrir el perfil (sin estorbar la carga de la página)
  useEffect(() => {
    archivoRef.current = null
    const t = setTimeout(() => {
      generandoRef.current = generarArchivo().catch(() => null).finally(() => { generandoRef.current = null })
    }, 400)
    return () => clearTimeout(t)
  }, [clave]) // eslint-disable-line react-hooks/exhaustive-deps

  async function compartir() {
    setOcupado(true)
    try {
      if (generandoRef.current) await generandoRef.current
      let hecho = archivoRef.current && archivoRef.current.clave === clave ? archivoRef.current : null
      if (!hecho) hecho = await generarArchivo()
      await compartirOBajarBlob(hecho?.blob, {
        filename: `golmebol_${(jugador.name || 'jugador').replace(/\s+/g, '_')}.png`,
        shareTitle: `${jugador.name} · Golmebol`,
        shareText: `Mi resumen en Golmebol 👉 ${window.location.origin}/j/${jugador.id}`,
      })
    } catch (e) {
      console.error('No se pudo generar la tarjeta:', e)
    } finally {
      setOcupado(false)
    }
  }

  return (
    <button type="button" onClick={compartir} disabled={ocupado} aria-label="Compartir mi tarjeta como imagen"
      style={estilo || { display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 14px', borderRadius: '999px', border: '1px solid rgba(255,255,255,.35)', background: 'rgba(255,255,255,.16)', color: '#fff', fontSize: '.8rem', fontWeight: 700, cursor: 'pointer' }}>
      <Camera size={15}/> {ocupado ? 'Generando…' : 'Mi tarjeta'}
    </button>
  )
}
