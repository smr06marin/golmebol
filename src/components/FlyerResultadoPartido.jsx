import { useEffect, useMemo, useRef, useState } from 'react'
import { Download, X } from 'lucide-react'
import { GiSoccerBall } from 'react-icons/gi'
import { supabase } from '../lib/supabase'
import { fmtHoraDate } from '../lib/horaHelpers'
import { descargarFlyer } from '../lib/flyerDescarga'
import { TEMAS_RESULTADO_PARTIDO } from '../lib/flyerTemas'
import { colorDominante } from '../lib/portadaYoutube'
import { FASE_LABEL, acortarNombre, datosParaFlyer, penalesDe } from '../lib/resumenPartido'
import SelectorTemaFlyer from './SelectorTemaFlyer'
import LogoFlyer from './LogoFlyer'
import FranjaPatrocinadoresFlyer from './FranjaPatrocinadoresFlyer'
import { usePatrocinadoresFlyer } from '../lib/patrocinadoresFlyer'

// Flyer de RESULTADO que los equipos publican en sus redes.
//
// Diseño: dos mitades (un color por equipo, sacado del escudo) divididas por una
// línea dorada. Cada mitad lleva el escudo grande, el nombre y el resultado
// grande (el ganador en dorado); en el centro, montado sobre la línea, va el MVP
// del partido; abajo, los goleadores de cada equipo con los minutos. Sin tarjetas.
//
// Se dibuja siempre a tamaño real (1080 de ancho); la vista previa es una copia
// encogida con transform:scale() y la descarga captura otra copia oculta, sin
// transform, para que html2canvas dé exactamente 1080×1920 / 1080×1350. Solo usa
// degradados lineales, bordes, rotaciones y sombras de texto, que html2canvas
// dibuja igual que el navegador (nada de clip-path ni degradados cónicos).

const ANCHO = 1080
const FORMATOS = [
  { id: 'historia', nombre: 'Historia', sub: '1080×1920', alto: 1920, escudo: 270, score: 330, padY: 76 },
  { id: 'post',     nombre: 'Post',     sub: '1080×1350', alto: 1350, escudo: 180, score: 240, padY: 44 },
]

const F_TITULO = "'Bebas Neue', 'Barlow Condensed', Impact, sans-serif"
const F_TEXTO = "'Barlow Condensed', 'Arial Narrow', Arial, sans-serif"


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

// "12:34" (reloj del cronómetro) -> "12'"
function minutoCorto(m) {
  const mm = /^(\d+):\d{2}$/.exec(String(m || ''))
  return mm ? `${Number(mm[1])}'` : ''
}

// Un gol por jugador: balón + nombre + minutos en que lo metió. El equipo de la
// izquierda va pegado a la izquierda; el de la derecha, espejo (pegado a la derecha).
function FilaGol({ g, lado, rowH, acento }) {
  const derecha = lado === 'visitante'
  const fuente = Math.min(36, Math.round(rowH * 0.66))
  const mins = (g.minutos || []).map(minutoCorto).filter(Boolean)
  const textoMin = mins.length ? mins.join(' · ') : (g.cantidad > 1 ? `×${g.cantidad}` : '')
  const balon = <GiSoccerBall key="b" size={Math.round(rowH * 0.62)} color="#fff" style={{ flexShrink: 0 }}/>
  const nombre = <span key="n" style={{ fontFamily: F_TEXTO, fontWeight: 700, fontSize: fuente, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', lineHeight: 1, minWidth: 0 }}>{acortarNombre(g.jugador, 17)}</span>
  const min = <span key="m" style={{ fontFamily: F_TEXTO, fontWeight: 700, fontSize: Math.round(fuente * 0.84), color: acento, whiteSpace: 'nowrap', lineHeight: 1, flexShrink: 0 }}>{textoMin}</span>
  return (
    <div style={{ height: rowH, display: 'flex', alignItems: 'center', gap: 12, justifyContent: derecha ? 'flex-end' : 'flex-start', borderBottom: '2px solid rgba(255,255,255,.14)', boxSizing: 'border-box' }}>
      {derecha ? [min, nombre, balon] : [balon, nombre, min]}
    </div>
  )
}

function ColumnaGoles({ goles, lado, filas, rowH, acento }) {
  const { visibles, mas } = recortar(goles, filas)
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      {visibles.map((g, i) => <FilaGol key={i} g={g} lado={lado} rowH={rowH} acento={acento}/>)}
      {mas > 0 && (
        <div style={{ height: rowH, display: 'flex', alignItems: 'center', justifyContent: lado === 'visitante' ? 'flex-end' : 'flex-start', fontFamily: F_TEXTO, fontWeight: 700, fontSize: Math.round(rowH * 0.6), color: 'rgba(255,255,255,.6)' }}>+{mas} más</div>
      )}
    </div>
  )
}

// Recorta una lista a `max` filas; si sobran, la última fila pasa a ser "+N más".
function recortar(lista, max) {
  if (lista.length <= max) return { visibles: lista, mas: 0 }
  const v = Math.max(0, max - 1)
  return { visibles: lista.slice(0, v), mas: lista.length - v }
}

// Etiqueta con el nombre del equipo, ligeramente girada (como un recorte pegado).
function EtiquetaEquipo({ nombre, color, grados, gran, apagado }) {
  const n = (nombre || '').toUpperCase()
  // El texto cabe en una sola línea: el tamaño baja según cuántas letras tiene el nombre.
  const fuente = Math.min(gran ? 84 : 64, Math.floor((gran ? 436 : 340) / (0.5 * Math.max(n.length, 6))))
  return (
    <div style={{ transform: `rotate(${grados}deg)`, background: color, padding: gran ? '10px 24px 4px' : '8px 18px 2px', maxWidth: gran ? 480 : 380, boxSizing: 'border-box', opacity: apagado ? 0.8 : 1, boxShadow: '0 6px 16px rgba(0,0,0,.3)' }}>
      <div style={{ fontFamily: F_TITULO, fontSize: fuente, letterSpacing: 2, lineHeight: 1.05, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textAlign: 'center' }}>{n}</div>
    </div>
  )
}

// MVP en el centro, montado sobre la línea que divide los dos equipos.
function BloqueMvp({ mvp, tema, gran, k = 1 }) {
  const nombre = acortarNombre(mvp.nombre, 20).toUpperCase()
  const fuenteNombre = Math.max(gran ? 40 : 32, (gran ? 62 : 50) - Math.max(0, nombre.length - 12) * (gran ? 2.6 : 2.2))
  const ini = (mvp.nombre || '?').split(' ').filter(Boolean).map(w => w[0]).join('').substring(0, 2).toUpperCase()
  // Parámetro extra: evita que el navegador reutilice una copia de la foto guardada sin permisos CORS (rompería la descarga).
  const foto = mvp.foto && !mvp.foto.startsWith('data:') ? mvp.foto + (mvp.foto.includes('?') ? '&' : '?') + 'gmcors=1' : mvp.foto
  const badge = Math.round((gran ? 240 : 180) * k)
  const partes = []
  if (mvp.equipo) partes.push(mvp.equipo.toUpperCase())
  if (mvp.goles > 0) partes.push(`${mvp.goles} ${mvp.goles === 1 ? 'GOL' : 'GOLES'}`)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {foto ? (
        <img src={foto} alt="" crossOrigin="anonymous" style={{ width: badge, height: badge, borderRadius: '50%', objectFit: 'cover', objectPosition: 'center top', border: `9px solid ${tema.acento}`, boxSizing: 'border-box', background: '#fff', boxShadow: '0 10px 30px rgba(0,0,0,.45)' }}/>
      ) : (
        <div style={{ width: badge, height: badge, borderRadius: '50%', background: tema.acento, border: '9px solid rgba(255,255,255,.6)', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 10px 30px rgba(0,0,0,.45)' }}>
          <span style={{ fontFamily: F_TITULO, fontSize: badge * 0.44, color: '#14142a', letterSpacing: 2, lineHeight: 1, paddingTop: 6 }}>{ini}</span>
        </div>
      )}
      <div style={{ marginTop: gran ? -34 : -26, transform: 'rotate(-1.5deg)', background: `linear-gradient(135deg, ${tema.mvp[0]} 0%, ${tema.mvp[1]} 100%)`, border: '3px solid rgba(255,255,255,.35)', padding: gran ? '12px 36px 14px' : '8px 28px 10px', textAlign: 'center', maxWidth: 800, boxSizing: 'border-box', boxShadow: '0 8px 22px rgba(0,0,0,.4)' }}>
        <div style={{ fontFamily: F_TITULO, fontSize: gran ? 34 : 26, letterSpacing: 8, color: tema.acentoSuave, lineHeight: 1 }}>MVP DEL PARTIDO</div>
        <div style={{ marginTop: 4, fontFamily: F_TEXTO, fontWeight: 800, fontSize: fuenteNombre, lineHeight: 1.05, color: '#fff', whiteSpace: 'nowrap' }}>{nombre}</div>
        {partes.length > 0 && <div style={{ marginTop: 4, fontFamily: F_TEXTO, fontWeight: 600, fontSize: gran ? 28 : 22, letterSpacing: 2, color: 'rgba(255,255,255,.88)', whiteSpace: 'nowrap' }}>{partes.join('  ·  ')}</div>}
      </div>
    </div>
  )
}

// ---------- el flyer ----------

function Flyer({ partido, torneo, datos, tema, colores, mvp, formato }) {
  const { golesLocal, golesVisitante } = datos
  const esW = partido.tipo_resultado === 'w'
  const esDesierto = partido.tipo_resultado === 'desierto'
  const hayGoles = !partido.tipo_resultado && golesLocal.length + golesVisitante.length > 0
  const gran = formato.id === 'historia'
  const H = formato.alto
  const filasMax = gran ? 4 : 3
  const k = Math.min(1, H / (gran ? 1920 : 1350)) * (!gran && H < 1350 ? 0.88 : 1)
  const rowH = Math.round((gran ? 56 : 46) * (k < 1 ? (gran ? 0.9 : 0.8) : 1))
  const filas = Math.min(filasMax, Math.max(golesLocal.length, golesVisitante.length))

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
  const tam = {
    chip: gran ? 40 : 34,
    meta: Math.round((gran ? 34 : 28) * (H < (gran ? 1920 : 1350) ? 0.92 : 1)),
    torneo: (gran ? 54 : 44) * (nombreTorneo.length > 34 ? 0.76 : nombreTorneo.length > 24 ? 0.9 : 1),
    logo: gran ? 120 : 92,
  }
  // Con la franja de patrocinadores el flyer tiene menos alto: los bloques grandes se achican en proporción.
  const escudo = Math.round((gran ? 330 : 230) * k)
  const fuenteScore = (Math.max(String(hs).length, String(as).length) > 1 ? formato.score * 0.78 : formato.score) * k
  const etiquetaL = mezclar(colores.izq, '#ffffff', 0.3)
  const etiquetaV = mezclar(colores.der, '#ffffff', 0.3)

  const mitad = (lado) => {
    const local = lado === 'local'
    const equipo = local ? partido.home : partido.away
    const gana = local ? ganaLocal : ganaVisitante
    const score = local ? hs : as
    return (
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <Escudo url={equipo?.logo_url} nombre={equipo?.name} size={escudo} radio={Math.round(escudo * 0.2)}/>
        <div style={{ marginTop: gran ? 22 : 14 }}>
          <EtiquetaEquipo nombre={equipo?.name} color={local ? etiquetaL : etiquetaV} grados={local ? -2 : 2} gran={gran} apagado={hayGanador && !gana}/>
        </div>
        <div style={{ marginTop: gran ? 6 : 2, fontFamily: F_TITULO, fontSize: fuenteScore, lineHeight: 1, letterSpacing: 4, color: colorScore(gana), textShadow: brillo(gana) }}>{score}</div>
      </div>
    )
  }

  return (
    <div style={{ width: ANCHO, height: H, position: 'relative', overflow: 'hidden', boxSizing: 'border-box', background: colores.izq, color: '#fff', fontFamily: F_TEXTO }}>
      {/* Dos mitades: el equipo local a la izquierda, el visitante a la derecha */}
      <div style={{ position: 'absolute', left: 0, top: 0, width: ANCHO / 2, height: H, background: `linear-gradient(180deg, ${mezclar(colores.izq, '#ffffff', 0.08)} 0%, ${colores.izq} 40%, ${mezclar(colores.izq, '#000000', 0.6)} 100%)` }}/>
      <div style={{ position: 'absolute', left: ANCHO / 2, top: 0, width: ANCHO / 2, height: H, background: `linear-gradient(180deg, ${mezclar(colores.der, '#ffffff', 0.08)} 0%, ${colores.der} 40%, ${mezclar(colores.der, '#000000', 0.6)} 100%)` }}/>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: H * 0.4, background: 'radial-gradient(ellipse at 50% 0%, rgba(255,255,255,.16) 0%, rgba(255,255,255,0) 65%)' }}/>
      {/* Línea dorada que divide */}
      <div style={{ position: 'absolute', left: ANCHO / 2 - 3, top: 0, width: 6, height: H, background: `linear-gradient(180deg, rgba(255,201,38,0) 0%, ${tema.acento} 14%, ${tema.acento} 86%, rgba(255,201,38,0) 100%)` }}/>

      <div style={{ position: 'relative', zIndex: 2, height: '100%', boxSizing: 'border-box', padding: `${formato.padY}px 44px ${formato.padY - 6}px`, display: 'flex', flexDirection: 'column' }}>

        {/* Torneo + FINAL */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          {torneo?.logo_url && <LogoFlyer url={torneo.logo_url} size={tam.logo} radio={26} pad={10}/>}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: F_TEXTO, fontWeight: 800, fontSize: tam.torneo, lineHeight: 1.02, letterSpacing: 1, textTransform: 'uppercase', maxHeight: tam.torneo * 2.1, overflow: 'hidden', textShadow: '0 3px 8px rgba(0,0,0,.45)' }}>{nombreTorneo}</div>
            <div style={{ marginTop: 6, fontFamily: F_TEXTO, fontWeight: 700, fontSize: tam.chip - 6, letterSpacing: 5, lineHeight: 1, color: tema.acento, textShadow: '0 2px 6px rgba(0,0,0,.5)' }}>{faseTxt}</div>
          </div>
          <span style={{ alignSelf: 'flex-start', fontFamily: F_TITULO, fontSize: tam.chip + 4, letterSpacing: 5, lineHeight: 1, background: tema.acento, color: '#14142a', borderRadius: 12, padding: '10px 24px 6px', flexShrink: 0 }}>FINAL</span>
        </div>

        {/* Zona central: escudos, nombres y resultado a cada lado + MVP en medio */}
        <div style={{ flex: '1 1 auto', display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: 0 }}>
          <div style={{ display: 'flex', gap: 0, marginTop: gran ? 24 : 12 }}>
            {mitad('local')}
            {mitad('visitante')}
          </div>

          {(pen || esW || esDesierto) && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: gran ? 6 : 2 }}>
              <span style={{ fontFamily: F_TITULO, fontSize: tam.chip, letterSpacing: 4, lineHeight: 1, color: tema.acentoSuave, border: '2px solid rgba(255,255,255,.3)', background: 'rgba(0,0,0,.4)', borderRadius: 40, padding: '10px 30px 8px' }}>
                {pen ? `PENALES ${pen.local} - ${pen.visitante}` : esW ? 'GANADO POR W' : 'PARTIDO DESIERTO'}
              </span>
            </div>
          )}

          {mvp && <div style={{ marginTop: gran ? 26 : 14 }}><BloqueMvp mvp={mvp} tema={tema} gran={gran} k={k}/></div>}

          {hayGoles && (
            <div style={{ marginTop: gran ? 30 : 16 }}>
              <div style={{ height: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, fontFamily: F_TITULO, fontSize: gran ? 40 : 32, letterSpacing: 8, color: tema.acento, lineHeight: 1, marginBottom: 4 }}>
                <GiSoccerBall size={gran ? 36 : 28} color={tema.acento}/>GOLES
              </div>
              <div style={{ display: 'flex', gap: 72 }}>
                <ColumnaGoles goles={golesLocal} lado="local" filas={filas} rowH={rowH} acento={tema.acento}/>
                <ColumnaGoles goles={golesVisitante} lado="visitante" filas={filas} rowH={rowH} acento={tema.acento}/>
              </div>
            </div>
          )}
        </div>

        {/* Fecha, hora, lugar y marca */}
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', columnGap: 34, rowGap: 6, marginTop: gran ? 18 : 10, fontFamily: F_TEXTO, fontWeight: 600, fontSize: tam.meta, color: 'rgba(255,255,255,.92)', textShadow: '0 2px 6px rgba(0,0,0,.5)' }}>
          {fechaTxt && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}><IconoCalendario color={tema.acento} size={tam.meta + 2}/>{fechaTxt}</span>}
          {hora && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}><IconoReloj color={tema.acento} size={tam.meta + 2}/>{hora}</span>}
          {partido.location && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}><IconoUbicacion color={tema.acento} size={tam.meta + 2}/>{acortarNombre(partido.location, 34)}</span>}
        </div>
        <div style={{ textAlign: 'center', marginTop: gran ? 14 : 8, fontFamily: F_TITULO, fontSize: gran ? 32 : 26, letterSpacing: 8, color: 'rgba(255,255,255,.65)', lineHeight: 1 }}>GOLMEBOL.COM</div>
      </div>
    </div>
  )
}

// Si el torneo lo organiza Golmebol, al pie va la franja blanca con los patrocinadores: el flyer
// conserva su tamaño total (1080×1920 / 1080×1350) y el diseño se acomoda en el alto que queda.
function FlyerConBanda({ patrocinadores, ...props }) {
  const { formato } = props
  const alturaBanda = patrocinadores.length ? (formato.id === 'historia' ? 150 : 120) : 0
  if (!alturaBanda) return <Flyer {...props}/>
  return (
    <div style={{ width: ANCHO, height: formato.alto, background: '#fff', overflow: 'hidden' }}>
      <div style={{ width: ANCHO, height: formato.alto - alturaBanda, overflow: 'hidden' }}>
        <Flyer {...props} formato={{ ...formato, alto: formato.alto - alturaBanda }}/>
      </div>
      <FranjaPatrocinadoresFlyer patrocinadores={patrocinadores} ancho={ANCHO} alto={alturaBanda}/>
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
  const { lista: patrocinadores, listo: patroListo } = usePatrocinadoresFlyer({ id: partido.tournament_id || torneo?.id, organizador_id: torneo?.organizador_id })

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
  const bloqueado = descargando || !mvpCargado || !patroListo

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
              <FlyerConBanda partido={partido} torneo={torneo} datos={datos} tema={tema} colores={colores} mvp={mvp} formato={formato} patrocinadores={patrocinadores}/>
            </div>
          </div>
        </div>

        {/* Copia a tamaño real, fuera de pantalla y SIN transform: es la que se
            captura. html2canvas mide mal un elemento que vive dentro de un
            contenedor con transform:scale (la vista previa de arriba). */}
        <div aria-hidden="true" style={{ position: 'fixed', left: -20000, top: 0, width: ANCHO, height: formato.alto, pointerEvents: 'none' }}>
          <div ref={flyerRef} style={{ width: ANCHO, height: formato.alto }}>
            <FlyerConBanda partido={partido} torneo={torneo} datos={datos} tema={tema} colores={colores} mvp={mvp} formato={formato} patrocinadores={patrocinadores}/>
          </div>
        </div>

        {errorDescarga && <div style={{ marginTop: 12, color: '#d93025', fontSize: '.8rem', textAlign: 'center' }}>{errorDescarga}</div>}
        <button onClick={handleDescargar} disabled={bloqueado}
          style={{ marginTop: 16, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: '#1a73e8', border: 'none', borderRadius: 12, padding: '14px', cursor: bloqueado ? 'wait' : 'pointer', color: '#fff', fontSize: '.95rem', fontWeight: 800, opacity: bloqueado ? 0.7 : 1 }}>
          <Download size={18}/> {descargando ? 'Generando imagen...' : (!mvpCargado || !patroListo) ? 'Preparando flyer...' : 'Descargar / Compartir'}
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
