import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Download, X } from 'lucide-react'
import { GiSoccerBall } from 'react-icons/gi'
import { supabase } from '../lib/supabase'
import { fmtHoraDate } from '../lib/horaHelpers'
import { descargarFlyer } from '../lib/flyerDescarga'
import { TEMAS_RESULTADO_PARTIDO } from '../lib/flyerTemas'
import { colorDominante } from '../lib/portadaYoutube'
import { COLOR_TARJETA, FASE_LABEL, acortarNombre, datosParaFlyer, penalesDe } from '../lib/resumenPartido'
import SelectorTemaFlyer from './SelectorTemaFlyer'
import LogoFlyer from './LogoFlyer'

// Flyer de RESULTADO que los equipos publican en sus redes.
//
// Diseño: fondo partido en diagonal (un color por equipo, sacado del escudo),
// escudos grandes a cada lado, marcador gigante con el ganador en dorado,
// goles y tarjetas por equipo, y la tarjeta roja del MVP del partido.
//
// Se dibuja siempre a tamaño real (1080 de ancho); la vista previa es una copia
// encogida con transform:scale() y la descarga captura otra copia oculta, sin
// transform, para que html2canvas dé exactamente 1080×1920 / 1080×1350. Solo usa
// degradados lineales, bordes, rotaciones y sombras de texto, que html2canvas
// dibuja igual que el navegador (nada de clip-path ni degradados cónicos).

const ANCHO = 1080
const FORMATOS = [
  { id: 'historia', nombre: 'Historia', sub: '1080×1920', alto: 1920, escudo: 270, score: 320, padY: 80 },
  { id: 'post',     nombre: 'Post',     sub: '1080×1350', alto: 1350, escudo: 180, score: 230, padY: 44 },
]

const F_TITULO = "'Bebas Neue', 'Barlow Condensed', Impact, sans-serif"
const F_TEXTO = "'Barlow Condensed', 'Arial Narrow', Arial, sans-serif"

const MIN_FILA = 40
const MAX_FILA = 58
const ALTO_CABECERA = 54
const ESPACIO_SECCION = 18
const ANGULO = 11 // inclinación de la diagonal, en grados

// ---------- color ----------

function aRgb(hex) {
  const h = (hex || '#000000').replace('#', '')
  const n = h.length === 3 ? h.split('').map(c => c + c).join('') : h.padEnd(6, '0')
  return [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16)]
}
function aHex(r, g, b) {
  return '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')
}
function lum(hex) { const [r, g, b] = aRgb(hex); return (0.299 * r + 0.587 * g + 0.114 * b) / 255 }
function mezclar(hex, con, t) {
  const a = aRgb(hex), b = aRgb(con)
  return aHex(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t)
}
function distancia(h1, h2) {
  const a = aRgb(h1), b = aRgb(h2)
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
}
// Oscurece un color hasta que el texto blanco se lea bien encima.
function paraFondo(hex) {
  let c = hex
  let n = 0
  while (lum(c) > 0.3 && n++ < 12) c = mezclar(c, '#000000', 0.12)
  return c
}

const COLOR_RESPALDO_YOUTUBE = '#f5b82e' // lo que devuelve colorDominante cuando el escudo no tiene un color claro

function cargarImagen(url) {
  return new Promise(resolve => {
    if (!url) { resolve(null); return }
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = url.startsWith('data:') ? url : url + (url.includes('?') ? '&' : '?') + 'gmcors=1'
  })
}

// Colores de fondo del flyer: en modo "equipos" salen del escudo de cada uno.
function useColoresEquipos(urlLocal, urlVisitante, tema) {
  const [auto, setAuto] = useState({ l: null, v: null })
  useEffect(() => {
    if (!tema.auto) return undefined
    let vivo = true
    Promise.all([cargarImagen(urlLocal), cargarImagen(urlVisitante)]).then(([a, b]) => {
      if (!vivo) return
      const dom = img => {
        if (!img) return null
        const c = colorDominante(img)
        return c && c.toLowerCase() !== COLOR_RESPALDO_YOUTUBE ? c : null
      }
      setAuto({ l: dom(a), v: dom(b) })
    })
    return () => { vivo = false }
  }, [urlLocal, urlVisitante, tema.auto])

  return useMemo(() => {
    if (!tema.auto) return { izq: tema.izq, der: tema.der }
    const izq = auto.l ? paraFondo(auto.l) : tema.izq
    let der = auto.v ? paraFondo(auto.v) : tema.der
    // Si los dos equipos tienen casi el mismo color, el visitante toma el de respaldo para que se note la diagonal.
    if (distancia(izq, der) < 70) der = distancia(izq, tema.der) < 90 ? tema.izq : tema.der
    return { izq, der }
  }, [tema, auto])
}

// ---------- piezas ----------

function Escudo({ url, nombre, size, radio }) {
  const iniciales = (nombre || '?').split(' ').filter(Boolean).map(w => w[0]).join('').substring(0, 2).toUpperCase()
  if (url) return <LogoFlyer url={url} size={size} radio={radio} pad={Math.round(size * 0.07)}/>
  return (
    <div style={{ width: size, height: size, borderRadius: radio, background: '#fff', padding: Math.round(size * 0.07), boxSizing: 'border-box', flexShrink: 0 }}>
      <div style={{ width: '100%', height: '100%', borderRadius: radio * 0.6, background: 'linear-gradient(135deg, #1a73e8, #6c35de)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontFamily: F_TITULO, fontSize: size * 0.4, color: '#fff', letterSpacing: 2 }}>{iniciales}</span>
      </div>
    </div>
  )
}

function IconoCalendario({ color, size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="16" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="3" x2="8" y2="7"/><line x1="16" y1="3" x2="16" y2="7"/>
    </svg>
  )
}
function IconoReloj({ color, size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15.5 14"/>
    </svg>
  )
}
function IconoUbicacion({ color, size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.6"/>
    </svg>
  )
}

function CabeceraSeccion({ texto, tema, icono }) {
  return (
    <div style={{ height: ALTO_CABECERA, display: 'flex', alignItems: 'center', gap: 22, marginBottom: 6 }}>
      <div style={{ flex: 1, height: 3, background: `linear-gradient(90deg, rgba(255,255,255,0), ${tema.acento})` }}/>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 14, fontFamily: F_TITULO, fontSize: 42, letterSpacing: 7, color: tema.acento, lineHeight: 1 }}>
        {icono}{texto}
      </span>
      <div style={{ flex: 1, height: 3, background: `linear-gradient(270deg, rgba(255,255,255,0), ${tema.acento})` }}/>
    </div>
  )
}

// Un equipo en una sección: a la izquierda el nombre pegado a la izquierda y
// los íconos después; a la derecha los íconos y luego el nombre pegado a la derecha.
function FilaEquipo({ lado, texto, icono, rowH, vacio }) {
  const derecha = lado === 'visitante'
  const fuente = Math.min(38, Math.round(rowH * 0.64))
  const nombre = (
    <span key="n" style={{ flex: 1, minWidth: 0, textAlign: derecha ? 'right' : 'left', fontFamily: F_TEXTO, fontWeight: 700, fontSize: fuente, color: vacio ? 'rgba(255,255,255,.45)' : '#fff', whiteSpace: 'nowrap', overflow: 'hidden', lineHeight: 1 }}>{texto}</span>
  )
  return (
    <div style={{ height: rowH, display: 'flex', alignItems: 'center', gap: 12, boxSizing: 'border-box', borderBottom: '2px solid rgba(255,255,255,.12)' }}>
      {derecha ? [icono, nombre] : [nombre, icono]}
    </div>
  )
}

function Balones({ cantidad, rowH, color }) {
  const t = Math.round(rowH * 0.66)
  if (cantidad > 3) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0, fontFamily: F_TITULO, fontSize: Math.round(rowH * 0.72), color, lineHeight: 1 }}>
        <GiSoccerBall size={t} color="#fff"/>×{cantidad}
      </span>
    )
  }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
      {Array.from({ length: cantidad }).map((_, i) => <GiSoccerBall key={i} size={t} color="#fff"/>)}
    </span>
  )
}

function Tarjeta({ color, rowH }) {
  return <span style={{ width: Math.round(rowH * 0.36), height: Math.round(rowH * 0.52), borderRadius: 5, background: COLOR_TARJETA[color] || '#999', flexShrink: 0, boxShadow: '0 2px 6px rgba(0,0,0,.35)' }}/>
}

// Recorta una lista a `max` filas; si sobran, la última fila pasa a ser "+N más".
function recortar(lista, max) {
  if (lista.length <= max) return { visibles: lista, mas: 0 }
  const v = Math.max(0, max - 1)
  return { visibles: lista.slice(0, v), mas: lista.length - v }
}

function SeccionDoble({ titulo, icono, izq, der, filas, rowH, tema, render }) {
  const col = (lista, lado) => {
    const { visibles, mas } = recortar(lista, filas)
    const usadas = visibles.length + (mas ? 1 : 0) || 1
    const relleno = filas - usadas
    return (
      <div style={{ flex: 1, minWidth: 0 }}>
        {visibles.length === 0 && !mas && <FilaEquipo lado={lado} texto="—" vacio rowH={rowH}/>}
        {visibles.map((it, i) => render(it, i, lado))}
        {mas > 0 && <FilaEquipo lado={lado} texto={`+${mas} más`} rowH={rowH} vacio/>}
        {relleno > 0 && <div style={{ height: relleno * rowH }}/>}
      </div>
    )
  }
  return (
    <div>
      <CabeceraSeccion texto={titulo} icono={icono} tema={tema}/>
      <div style={{ display: 'flex', gap: 56 }}>
        {col(izq, 'local')}
        {col(der, 'visitante')}
      </div>
    </div>
  )
}

function TarjetaMvp({ mvp, tema, gran }) {
  const nombre = acortarNombre(mvp.nombre, 20).toUpperCase()
  const fuenteNombre = Math.max(gran ? 42 : 34, (gran ? 66 : 54) - Math.max(0, nombre.length - 12) * (gran ? 2.8 : 2.4))
  const ini = (mvp.nombre || '?').split(' ').filter(Boolean).map(w => w[0]).join('').substring(0, 2).toUpperCase()
  // Parámetro extra: evita que el navegador reutilice una copia de la foto guardada sin permisos CORS (rompería la descarga).
  const foto = mvp.foto && !mvp.foto.startsWith('data:') ? mvp.foto + (mvp.foto.includes('?') ? '&' : '?') + 'gmcors=1' : mvp.foto
  const badge = gran ? 150 : 118
  const partes = []
  if (mvp.equipo) partes.push(mvp.equipo.toUpperCase())
  if (mvp.goles > 0) partes.push(`${mvp.goles} ${mvp.goles === 1 ? 'GOL' : 'GOLES'}`)
  return (
    <div style={{
      position: 'relative', overflow: 'hidden', flexShrink: 0, boxSizing: 'border-box', borderRadius: 30,
      background: `linear-gradient(135deg, ${tema.mvp[0]} 0%, ${tema.mvp[1]} 100%)`, border: '3px solid rgba(255,255,255,.28)',
      padding: gran ? '26px 34px' : '18px 30px', display: 'flex', alignItems: 'center', gap: gran ? 30 : 24,
    }}>
      <span style={{ position: 'absolute', right: 18, bottom: gran ? -34 : -26, fontFamily: F_TITULO, fontSize: gran ? 230 : 170, lineHeight: 1, letterSpacing: 4, color: 'rgba(255,255,255,.13)' }}>
        {mvp.goles > 0 ? mvp.goles : 'MVP'}
      </span>
      {foto ? (
        <img src={foto} alt="" crossOrigin="anonymous" style={{ width: badge, height: badge, borderRadius: '50%', objectFit: 'cover', objectPosition: 'center top', border: `6px solid ${tema.acento}`, boxSizing: 'border-box', flexShrink: 0, background: '#fff', position: 'relative' }}/>
      ) : (
        <div style={{ width: badge, height: badge, borderRadius: '50%', background: tema.acento, border: '6px solid rgba(255,255,255,.55)', boxSizing: 'border-box', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
          <span style={{ fontFamily: F_TITULO, fontSize: badge * 0.46, color: '#14142a', letterSpacing: 2, lineHeight: 1, paddingTop: 4 }}>{ini}</span>
        </div>
      )}
      <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: F_TITULO, fontSize: gran ? 40 : 32, letterSpacing: 7, color: tema.acentoSuave, lineHeight: 1 }}>MVP DEL PARTIDO</div>
        <div style={{ marginTop: 8, fontFamily: F_TEXTO, fontWeight: 800, fontSize: fuenteNombre, lineHeight: 1.05, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden' }}>{nombre}</div>
        {partes.length > 0 && (
          <div style={{ marginTop: 10, fontFamily: F_TEXTO, fontWeight: 600, fontSize: gran ? 32 : 27, letterSpacing: 2, color: 'rgba(255,255,255,.85)', whiteSpace: 'nowrap', overflow: 'hidden' }}>{partes.join('  ·  ')}</div>
        )}
      </div>
    </div>
  )
}

// ---------- el flyer ----------

function Flyer({ partido, torneo, datos, tema, colores, mvp, formato }) {
  const statsRef = useRef(null)
  const [alturaStats, setAlturaStats] = useState(0)

  useLayoutEffect(() => {
    const el = statsRef.current
    if (!el) return undefined
    const medir = () => setAlturaStats(el.clientHeight)
    medir()
    if (typeof ResizeObserver === 'undefined') return undefined
    const obs = new ResizeObserver(medir)
    obs.observe(el)
    return () => obs.disconnect()
  }, [formato.id, !!mvp]) // eslint-disable-line react-hooks/exhaustive-deps

  const { golesLocal, golesVisitante, tarjetasLocal, tarjetasVisitante } = datos
  const esW = partido.tipo_resultado === 'w'
  const esDesierto = partido.tipo_resultado === 'desierto'
  const hayGoles = golesLocal.length + golesVisitante.length > 0
  const hayTarjetas = tarjetasLocal.length + tarjetasVisitante.length > 0
  const sinEstadisticas = !!partido.tipo_resultado || (!hayGoles && !hayTarjetas)

  // Cuántas filas caben en el espacio que queda para goles + tarjetas.
  const nSecciones = (hayGoles ? 1 : 0) + (hayTarjetas ? 1 : 0)
  const disponible = alturaStats > 0 ? alturaStats - nSecciones * (ALTO_CABECERA + 6) - Math.max(0, nSecciones - 1) * ESPACIO_SECCION - 6 : 0
  const cap = alturaStats > 0 ? Math.max(2, Math.floor(disponible / MIN_FILA)) : 99
  const gNec = Math.max(golesLocal.length, golesVisitante.length)
  const tNec = Math.max(tarjetasLocal.length, tarjetasVisitante.length)
  let gFilas = hayGoles ? gNec : 0
  let tFilas = hayTarjetas ? tNec : 0
  if (gFilas + tFilas > cap) {
    if (!hayTarjetas) gFilas = cap
    else if (!hayGoles) tFilas = cap
    else {
      tFilas = Math.max(1, Math.min(tNec, cap - gFilas))
      if (tFilas < Math.min(tNec, 3)) { tFilas = Math.min(tNec, 3); gFilas = Math.max(1, cap - tFilas) }
    }
  }
  const rowH = alturaStats > 0
    ? Math.max(MIN_FILA, Math.min(MAX_FILA, Math.floor(disponible / Math.max(1, gFilas + tFilas))))
    : 48

  const hs = Number(partido.home_score) || 0
  const as = Number(partido.away_score) || 0
  const pen = penalesDe(partido)
  const ganaLocal = pen ? pen.ganador === 'local' : hs > as
  const ganaVisitante = pen ? pen.ganador === 'visitante' : as > hs
  const hayGanador = ganaLocal || ganaVisitante
  const colorScore = gana => (!hayGanador || gana ? tema.acento : 'rgba(255,255,255,.42)')
  const brillo = gana => (hayGanador && gana ? `0 0 44px ${tema.acento}66, 0 6px 0 rgba(0,0,0,.25)` : '0 6px 0 rgba(0,0,0,.2)')

  const fecha = partido.played_at
    ? new Date(partido.played_at).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : ''
  const fechaTxt = fecha ? fecha.charAt(0).toUpperCase() + fecha.slice(1) : ''
  const hora = partido.played_at ? fmtHoraDate(partido.played_at) : ''
  const faseTxt = partido.fase && partido.fase !== 'grupo'
    ? (FASE_LABEL[partido.fase] || partido.fase).toUpperCase()
    : (partido.matchday ? `FECHA ${partido.matchday}` : 'FASE DE GRUPOS')

  const nombreTorneo = (torneo?.name || '').toUpperCase()
  const gran = formato.id === 'historia'
  const tam = {
    chip: gran ? 40 : 34,
    nombreEquipo: gran ? 54 : 44,
    meta: gran ? 36 : 30,
    torneo: (gran ? 56 : 46) * (nombreTorneo.length > 34 ? 0.76 : nombreTorneo.length > 24 ? 0.9 : 1),
    logo: gran ? 128 : 100,
  }
  const digitos = String(hs).length + String(as).length
  const fuenteScore = digitos > 2 ? formato.score * 0.78 : formato.score
  const ladoEquipo = { textAlign: 'center', fontFamily: F_TEXTO, fontWeight: 800, fontSize: tam.nombreEquipo, lineHeight: 1.02, textTransform: 'uppercase', maxHeight: tam.nombreEquipo * 2.15, overflow: 'hidden' }

  const ganador = visible => (
    <div style={{ height: gran ? 44 : 36, marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {visible && <span style={{ fontFamily: F_TITULO, fontSize: gran ? 38 : 31, letterSpacing: 8, lineHeight: 1, color: tema.acento }}>GANADOR</span>}
    </div>
  )

  const H = formato.alto

  return (
    <div style={{ width: ANCHO, height: H, position: 'relative', overflow: 'hidden', boxSizing: 'border-box', background: `linear-gradient(180deg, ${colores.izq} 0%, ${mezclar(colores.izq, '#000000', 0.55)} 100%)`, color: '#fff', fontFamily: F_TEXTO }}>
      {/* Mitad del visitante: un panel girado cuyo borde izquierdo es la diagonal */}
      <div style={{ position: 'absolute', left: ANCHO / 2, top: -H * 0.6, width: ANCHO * 1.6, height: H * 2.2, transform: `rotate(${ANGULO}deg)`, transformOrigin: '0 50%', background: `linear-gradient(180deg, ${colores.der} 0%, ${mezclar(colores.der, '#000000', 0.55)} 100%)` }}/>
      {/* Línea dorada de la diagonal */}
      <div style={{ position: 'absolute', left: ANCHO / 2 - 3, top: -H * 0.6, width: 6, height: H * 2.2, transform: `rotate(${ANGULO}deg)`, transformOrigin: '3px 50%', background: `linear-gradient(180deg, rgba(255,201,38,0) 0%, ${tema.acento} 18%, ${tema.acento} 82%, rgba(255,201,38,0) 100%)`, opacity: 0.9 }}/>
      {/* Luz suave arriba y sombra abajo */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: H * 0.5, background: 'radial-gradient(ellipse at 50% 0%, rgba(255,255,255,.18) 0%, rgba(255,255,255,0) 65%)' }}/>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: H * 0.35, background: 'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,.45) 100%)' }}/>

      <div style={{ position: 'relative', zIndex: 2, height: '100%', boxSizing: 'border-box', padding: `${formato.padY}px 56px ${formato.padY - 6}px`, display: 'flex', flexDirection: 'column' }}>

        {/* Torneo + FINAL */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 26 }}>
          {torneo?.logo_url && <LogoFlyer url={torneo.logo_url} size={tam.logo} radio={28} pad={10}/>}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: F_TEXTO, fontWeight: 800, fontSize: tam.torneo, lineHeight: 1.02, letterSpacing: 1, textTransform: 'uppercase', maxHeight: tam.torneo * 2.1, overflow: 'hidden' }}>{nombreTorneo}</div>
            <div style={{ marginTop: 8, fontFamily: F_TEXTO, fontWeight: 700, fontSize: tam.chip - 4, letterSpacing: 5, lineHeight: 1, color: tema.acento }}>{faseTxt}</div>
          </div>
          <span style={{ alignSelf: 'flex-start', fontFamily: F_TITULO, fontSize: tam.chip + 6, letterSpacing: 5, lineHeight: 1, background: tema.acento, color: '#14142a', borderRadius: 14, padding: '12px 28px 8px', flexShrink: 0 }}>FINAL</span>
        </div>

        <div style={sinEstadisticas ? { flex: '1 1 auto', display: 'flex', flexDirection: 'column', justifyContent: 'center' } : undefined}>
          {/* Escudos + marcador */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', columnGap: 8, marginTop: gran ? 54 : 28 }}>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <Escudo url={partido.home?.logo_url} nombre={partido.home?.name} size={formato.escudo} radio={Math.round(formato.escudo * 0.2)}/>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: F_TITULO, lineHeight: 0.9, fontSize: fuenteScore, letterSpacing: 4 }}>
              <span style={{ color: colorScore(ganaLocal), textShadow: brillo(ganaLocal) }}>{hs}</span>
              <span style={{ color: 'rgba(255,255,255,.8)', fontSize: fuenteScore * 0.5, margin: '0 14px', position: 'relative', top: -fuenteScore * 0.04 }}>-</span>
              <span style={{ color: colorScore(ganaVisitante), textShadow: brillo(ganaVisitante) }}>{as}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <Escudo url={partido.away?.logo_url} nombre={partido.away?.name} size={formato.escudo} radio={Math.round(formato.escudo * 0.2)}/>
            </div>
          </div>
          {/* Nombres (el que perdió, apagado) y GANADOR */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', columnGap: 8, marginTop: 20, alignItems: 'start' }}>
            <div>
              <div style={{ ...ladoEquipo, color: hayGanador && !ganaLocal ? 'rgba(255,255,255,.55)' : '#fff' }}>{partido.home?.name}</div>
              {ganador(ganaLocal)}
            </div>
            <div style={{ width: fuenteScore * (digitos > 2 ? 0.8 : 0.95) }}/>
            <div>
              <div style={{ ...ladoEquipo, color: hayGanador && !ganaVisitante ? 'rgba(255,255,255,.55)' : '#fff' }}>{partido.away?.name}</div>
              {ganador(ganaVisitante)}
            </div>
          </div>

          {(pen || esW || esDesierto) && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 14 }}>
              <span style={{ fontFamily: F_TITULO, fontSize: tam.chip, letterSpacing: 4, lineHeight: 1, color: tema.acentoSuave, border: '2px solid rgba(255,255,255,.25)', background: 'rgba(0,0,0,.28)', borderRadius: 40, padding: '10px 30px 8px' }}>
                {pen ? `PENALES ${pen.local} - ${pen.visitante}` : esW ? 'GANADO POR W' : 'PARTIDO DESIERTO'}
              </span>
            </div>
          )}
        </div>

        {/* Goles y tarjetas */}
        {!sinEstadisticas && (
          <div ref={statsRef} style={{ flex: '1 1 0', minHeight: 0, overflow: 'hidden', marginTop: gran ? 36 : 22, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            {hayGoles && (
              <SeccionDoble titulo="GOLES" icono={<GiSoccerBall size={38} color={tema.acento}/>} izq={golesLocal} der={golesVisitante}
                filas={gFilas} rowH={rowH} tema={tema}
                render={(g, i, lado) => (
                  <FilaEquipo key={i} lado={lado} rowH={rowH} texto={acortarNombre(g.jugador, 19)} icono={<Balones key="b" cantidad={g.cantidad} rowH={rowH} color={tema.acento}/>}/>
                )}/>
            )}
            {hayGoles && hayTarjetas && <div style={{ height: ESPACIO_SECCION }}/>}
            {hayTarjetas && (
              <SeccionDoble titulo="TARJETAS" izq={tarjetasLocal} der={tarjetasVisitante} filas={tFilas} rowH={rowH} tema={tema}
                render={(t, i, lado) => (
                  <FilaEquipo key={i} lado={lado} rowH={rowH} texto={acortarNombre(t.jugador, 21)} icono={<Tarjeta key="t" color={t.color} rowH={rowH}/>}/>
                )}/>
            )}
          </div>
        )}

        {/* MVP */}
        {mvp && <div style={{ marginTop: gran ? 28 : 18 }}><TarjetaMvp mvp={mvp} tema={tema} gran={gran}/></div>}

        {/* Fecha, hora, lugar y marca */}
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', columnGap: 38, rowGap: 8, marginTop: gran ? 28 : 18, fontFamily: F_TEXTO, fontWeight: 600, fontSize: tam.meta, color: 'rgba(255,255,255,.9)' }}>
          {fechaTxt && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}><IconoCalendario color={tema.acento} size={tam.meta + 2}/>{fechaTxt}</span>}
          {hora && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}><IconoReloj color={tema.acento} size={tam.meta + 2}/>{hora}</span>}
          {partido.location && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}><IconoUbicacion color={tema.acento} size={tam.meta + 2}/>{acortarNombre(partido.location, 34)}</span>}
        </div>
        <div style={{ textAlign: 'center', marginTop: gran ? 22 : 12, fontFamily: F_TITULO, fontSize: gran ? 34 : 28, letterSpacing: 8, color: 'rgba(255,255,255,.6)', lineHeight: 1 }}>GOLMEBOL.COM</div>
      </div>
    </div>
  )
}

// El MVP que escogieron al planillar: se busca su registro, su foto y cuántos goles hizo en este partido.
function useMvpDelPartido(partido, eventos) {
  const [estado, setEstado] = useState({ id: null, mvp: null })
  useEffect(() => {
    if (!partido?.id) return undefined
    let vivo = true
    ;(async () => {
      let mvp = null
      try {
        const { data: logro } = await supabase.from('tournament_logros').select('player_id')
          .eq('match_id', partido.id).eq('tipo', 'mvp').limit(1).maybeSingle()
        if (logro?.player_id) {
          const { data: jug } = await supabase.from('players_publico')
            .select('id, name, photo_url, photo_face_url').eq('id', logro.player_id).maybeSingle()
          const delJugador = (eventos || []).filter(e => e.player_id === logro.player_id)
          const evGol = delJugador.filter(e => e.event_type === 'goal')
          const teamId = (delJugador.find(e => e.team_id) || {}).team_id || null
          const equipo = teamId === partido.home_team_id ? partido.home?.name : teamId === partido.away_team_id ? partido.away?.name : null
          const nombre = jug?.name || delJugador.map(e => e.player_nombre).find(Boolean) || ''
          if (nombre) mvp = { nombre, foto: jug?.photo_face_url || jug?.photo_url || null, goles: evGol.length, equipo }
        }
      } catch { /* sin MVP: el flyer sale igual, sin esa tarjeta */ }
      if (vivo) setEstado({ id: partido.id, mvp })
    })()
    return () => { vivo = false }
  }, [partido?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  return estado.id === partido?.id ? { cargado: true, mvp: estado.mvp } : { cargado: false, mvp: null }
}

export default function FlyerResultadoPartido({ partido, torneo, eventos, nombreDe, onClose }) {
  const wrapperRef = useRef(null)
  const flyerRef = useRef(null)
  const [formatoId, setFormatoId] = useState('historia')
  const [temaId, setTemaId] = useState(TEMAS_RESULTADO_PARTIDO[0].id)
  const [escala, setEscala] = useState(0.4)
  const [descargando, setDescargando] = useState(false)
  const [errorDescarga, setErrorDescarga] = useState('')

  const formato = FORMATOS.find(f => f.id === formatoId) || FORMATOS[0]
  const tema = TEMAS_RESULTADO_PARTIDO.find(t => t.id === temaId) || TEMAS_RESULTADO_PARTIDO[0]
  const datos = useMemo(() => datosParaFlyer(partido, eventos || [], nombreDe), [partido, eventos, nombreDe])
  const { cargado: mvpCargado, mvp } = useMvpDelPartido(partido, eventos)
  const colores = useColoresEquipos(partido.home?.logo_url, partido.away?.logo_url, tema)

  useEffect(() => {
    const wrapper = wrapperRef.current
    if (!wrapper) return undefined
    const calcular = () => setEscala(Math.min(1, wrapper.offsetWidth / ANCHO) || 0.3)
    calcular()
    if (typeof ResizeObserver === 'undefined') return undefined
    const obs = new ResizeObserver(calcular)
    obs.observe(wrapper)
    return () => obs.disconnect()
  }, [])

  async function handleDescargar() {
    if (!flyerRef.current) return
    setDescargando(true)
    setErrorDescarga('')
    try {
      const base = `${torneo?.name || 'golmebol'}_${partido.home?.name || 'local'}_vs_${partido.away?.name || 'visitante'}`
        .replace(/[^\p{L}\p{N}]+/gu, '_').replace(/^_+|_+$/g, '')
      await descargarFlyer(flyerRef.current, {
        filename: `${base}_${formato.id}.png`,
        opcionesCanvas: { scale: 1, width: ANCHO, height: formato.alto, backgroundColor: tema.abajo },
        shareTitle: `${partido.home?.name} ${partido.home_score} - ${partido.away_score} ${partido.away?.name}`,
      })
    } catch (e) {
      console.error('Flyer de resultado: no se pudo generar la imagen', e)
      setErrorDescarga('No se pudo generar la imagen. Intenta de nuevo.')
    } finally {
      setDescargando(false)
    }
  }

  const boton = activo => ({
    flex: 1, padding: '10px 8px', borderRadius: 10, cursor: 'pointer', fontSize: '.8rem', fontWeight: 700,
    border: activo ? '2px solid #1a73e8' : '1px solid #dadce0',
    background: activo ? '#e8f0fe' : '#fff', color: activo ? '#1a73e8' : '#5f6368',
  })
  const bloqueado = descargando || !mvpCargado

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.8)', zIndex: 620, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#fff', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 540, maxHeight: '94vh', overflowY: 'auto',
        overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch', padding: '18px 18px 22px', boxSizing: 'border-box',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div>
            <div style={{ fontWeight: 800, color: '#202124', fontSize: '.95rem' }}>Flyer para tus redes</div>
            <div style={{ fontSize: '.72rem', color: '#9aa0a6', marginTop: 2 }}>Elige formato y color, y descárgalo o compártelo</div>
          </div>
          <button onClick={onClose} aria-label="Cerrar" style={{ background: '#f1f3f4', border: 'none', borderRadius: '50%', width: 32, height: 32, cursor: 'pointer', color: '#5f6368', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={16}/>
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          {FORMATOS.map(f => (
            <button key={f.id} type="button" onClick={() => setFormatoId(f.id)} style={boton(f.id === formatoId)}>
              {f.nombre} <span style={{ fontWeight: 500, opacity: 0.75 }}>· {f.sub}</span>
            </button>
          ))}
        </div>
        <SelectorTemaFlyer temas={TEMAS_RESULTADO_PARTIDO} temaId={temaId} onElegir={setTemaId}/>

        {/* Vista previa: el flyer mide ANCHO×alto reales; solo se encoge por transform */}
        <div ref={wrapperRef} style={{ width: '100%' }}>
          <div style={{ width: ANCHO * escala, height: formato.alto * escala, margin: '0 auto', position: 'relative', overflow: 'hidden', borderRadius: 10, boxShadow: '0 6px 24px rgba(0,0,0,.25)' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, width: ANCHO, height: formato.alto, transform: `scale(${escala})`, transformOrigin: 'top left' }}>
              <Flyer partido={partido} torneo={torneo} datos={datos} tema={tema} colores={colores} mvp={mvp} formato={formato}/>
            </div>
          </div>
        </div>

        {/* Copia a tamaño real, fuera de pantalla y SIN transform: es la que se
            captura. html2canvas mide mal un elemento que vive dentro de un
            contenedor con transform:scale (la vista previa de arriba). */}
        <div aria-hidden="true" style={{ position: 'fixed', left: -20000, top: 0, width: ANCHO, height: formato.alto, pointerEvents: 'none' }}>
          <div ref={flyerRef} style={{ width: ANCHO, height: formato.alto }}>
            <Flyer partido={partido} torneo={torneo} datos={datos} tema={tema} colores={colores} mvp={mvp} formato={formato}/>
          </div>
        </div>

        {errorDescarga && <div style={{ marginTop: 12, color: '#d93025', fontSize: '.8rem', textAlign: 'center' }}>{errorDescarga}</div>}
        <button onClick={handleDescargar} disabled={bloqueado}
          style={{ marginTop: 16, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: '#1a73e8', border: 'none', borderRadius: 12, padding: '14px', cursor: bloqueado ? 'wait' : 'pointer', color: '#fff', fontSize: '.95rem', fontWeight: 800, opacity: bloqueado ? 0.7 : 1 }}>
          <Download size={18}/> {descargando ? 'Generando imagen...' : !mvpCargado ? 'Preparando flyer...' : 'Descargar / Compartir'}
        </button>
        <button onClick={onClose}
          style={{ marginTop: 10, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: '#f1f3f4', border: '1px solid #dadce0', borderRadius: 12, padding: '13px', cursor: 'pointer', color: '#3c4043', fontWeight: 800, fontSize: '.95rem' }}>
          <X size={18}/> Cerrar flyer
        </button>
        <div style={{ marginTop: 8, textAlign: 'center', fontSize: '.7rem', color: '#9aa0a6' }}>En el celular se abre "Guardar imagen" para que quede en tu galería.</div>
      </div>
    </div>
  )
}
