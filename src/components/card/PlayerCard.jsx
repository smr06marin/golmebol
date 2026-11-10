import { useState, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../../lib/supabase'
import { comprimirImagen } from '../../lib/imageCompress'
import { CARD_DESIGNS } from './designs/cardDesigns'
import { W, H, FUENTE, NOMBRE_NIVEL, arteDe, poligonoCss, ArteDefs, ArteFondo, ArteFrente, ESTILOS_ARTE } from './designs/cardArte'

// ── Tarjeta del jugador ───────────────────────────────────────────────────────────────────────
// Lo que se VE se dibuja en SVG sobre un lienzo fijo de 340×520 (se ve igual en cualquier tamaño y celular).
// Encima va una capa transparente con los botones (números, escudos, subir foto), ubicados por porcentaje.
// El arte de cada nivel vive en designs/cardArte.jsx.

const TORNEOS_DEFAULT = [
  { id: 't1', nombre: 'GOLM BCN', svg: `<svg viewBox="0 0 70 70" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="g1" cx="48%" cy="36%" r="56%"><stop offset="0%" stop-color="#ff99cc" stop-opacity=".74"/><stop offset="100%" stop-color="#260010" stop-opacity=".96"/></radialGradient></defs><circle cx="35" cy="35" r="33" fill="url(#g1)"/><circle cx="35" cy="35" r="33" fill="none" stroke="#ff66aa" stroke-width="2"/><text x="35" y="27.5" text-anchor="middle" fill="#fff" font-size="8" font-family="Impact">GOLM</text><text x="35" y="37.5" text-anchor="middle" fill="rgba(255,222,238,.92)" font-size="7" font-family="Impact">BCN</text><text x="35" y="46.5" text-anchor="middle" fill="rgba(255,200,225,.6)" font-size="4.5" font-family="Impact">T1 · 2025</text></svg>` },
  { id: 't2', nombre: 'NB BCN Q', svg: `<svg viewBox="0 0 70 70" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="g2" cx="48%" cy="36%" r="56%"><stop offset="0%" stop-color="#44cc66" stop-opacity=".72"/><stop offset="100%" stop-color="#001408" stop-opacity=".96"/></radialGradient></defs><circle cx="35" cy="35" r="33" fill="url(#g2)"/><circle cx="35" cy="35" r="33" fill="none" stroke="#33bb55" stroke-width="2"/><text x="35" y="37" text-anchor="middle" fill="#fff" font-size="10.5" font-family="Impact">NB</text><text x="35" y="47" text-anchor="middle" fill="rgba(180,255,200,.7)" font-size="4.5" font-family="Impact">BCN · Q</text></svg>` }
]

const EQUIPOS_DEFAULT = [
  { id: 'e1', nombre: 'ACR Armenia', svg: `<svg viewBox="0 0 70 70" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="g3" cx="48%" cy="34%" r="56%"><stop offset="0%" stop-color="#ff3366" stop-opacity=".68"/><stop offset="100%" stop-color="#140006" stop-opacity=".96"/></radialGradient></defs><circle cx="35" cy="35" r="33" fill="url(#g3)"/><circle cx="35" cy="35" r="33" fill="none" stroke="#ee2255" stroke-width="2"/><text x="35" y="32" text-anchor="middle" fill="#fff" font-size="8" font-family="Impact">ACR</text><text x="35" y="42.5" text-anchor="middle" fill="rgba(255,195,210,.72)" font-size="4.5" font-family="Impact">ARMENIA</text></svg>` },
  { id: 'e2', nombre: 'NB', svg: `<svg viewBox="0 0 70 70" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="g4" cx="48%" cy="34%" r="56%"><stop offset="0%" stop-color="#2266ff" stop-opacity=".68"/><stop offset="100%" stop-color="#000616" stop-opacity=".96"/></radialGradient></defs><circle cx="35" cy="35" r="33" fill="url(#g4)"/><circle cx="35" cy="35" r="33" fill="none" stroke="#1155ee" stroke-width="2"/><text x="35" y="38" text-anchor="middle" fill="#fff" font-size="11.5" font-family="Impact">NB</text></svg>` }
]

const STATS_DEFAULT = {
  pj: 12, golesContra: 28, promedio: 2.3,
  eficacia: 76, pg: 9, pe: 1, pp: 2,
  amarillas: 3, azules: 1,
}


// Elección guardada en el celular: la próxima vez la tarjeta muestra el torneo/equipo que la persona dejó
function leerSeleccion(playerId, clave, lista) {
  if (!playerId || !lista || lista.length === 0) return 0
  try {
    const id = JSON.parse(localStorage.getItem('gm_card_sel_' + playerId) || '{}')[clave]
    const i = lista.findIndex(x => String(x.id) === String(id))
    return i >= 0 ? i : 0
  } catch { return 0 }
}
function guardarSeleccion(playerId, clave, id) {
  if (!playerId) return
  try {
    const actual = JSON.parse(localStorage.getItem('gm_card_sel_' + playerId) || '{}')
    localStorage.setItem('gm_card_sel_' + playerId, JSON.stringify({ ...actual, [clave]: id }))
  } catch { /* sin almacenamiento: solo se pierde la memoria de la elección */ }
}


// Hoja que sube desde abajo con todas las opciones, grandes y con su nombre. Se dibuja fuera de la tarjeta
// (portal) porque la tarjeta tiene sombra/filtro y eso descolocaría una capa fija.
function HojaElegir({ titulo, items, indice, onElegir, onCerrar }) {
  const VERDE = '#6fcf3d'
  const letra = 'system-ui,-apple-system,"Segoe UI",Roboto,sans-serif'
  return createPortal(
    <div onClick={onCerrar} style={{ position: 'fixed', inset: 0, zIndex: 900, background: 'rgba(0,0,0,.72)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', fontFamily: letra }}>
      <div onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: '480px', maxHeight: '82vh', display: 'flex', flexDirection: 'column', background: '#161616', border: '1px solid #2a2a2a', borderBottom: 'none', borderRadius: '22px 22px 0 0', padding: '10px 16px calc(16px + env(safe-area-inset-bottom))', boxSizing: 'border-box' }}>
        <div style={{ width: '44px', height: '5px', borderRadius: '3px', background: '#3a3a3a', margin: '0 auto 14px' }}/>
        <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#fff', textAlign: 'center' }}>{titulo}</div>
        <div style={{ fontSize: '.95rem', color: '#a8a8a8', textAlign: 'center', margin: '4px 0 14px' }}>Toca el que quieres que se vea en tu tarjeta</div>
        <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', WebkitOverflowScrolling: 'touch' }}>
          {items.map((it, i) => {
            const activo = i === indice
            const nombre = it.nombre || it.name || ''
            return (
              <button key={it.id ?? i} type="button" onClick={() => onElegir(i)}
                style={{ display: 'flex', alignItems: 'center', gap: '14px', width: '100%', minHeight: '72px', padding: '10px 14px', boxSizing: 'border-box', textAlign: 'left', cursor: 'pointer', fontFamily: letra, background: activo ? 'rgba(111,207,61,.13)' : '#1c1c1c', border: `2px solid ${activo ? VERDE : '#2a2a2a'}`, borderRadius: '16px', color: '#fff' }}>
                <div style={{ width: '52px', height: '52px', borderRadius: '12px', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                  {it.logo_url
                    ? <img src={it.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }}/>
                    : it.svg
                      ? <div style={{ width: '44px', height: '44px' }} dangerouslySetInnerHTML={{ __html: it.svg }}/>
                      : <span style={{ fontWeight: 900, color: '#fff' }}>{nombre.substring(0, 2).toUpperCase()}</span>}
                </div>
                <div style={{ flex: 1, minWidth: 0, fontSize: '1.1rem', fontWeight: 800, lineHeight: 1.25 }}>{nombre}</div>
                {activo
                  ? <div style={{ flexShrink: 0, fontSize: '.8rem', fontWeight: 800, color: '#07110a', background: VERDE, borderRadius: '999px', padding: '6px 10px' }}>✓ En tu tarjeta</div>
                  : <div style={{ flexShrink: 0, fontSize: '.85rem', fontWeight: 700, color: VERDE }}>Elegir</div>}
              </button>
            )
          })}
        </div>
        <button type="button" onClick={onCerrar}
          style={{ marginTop: '14px', minHeight: '52px', background: 'transparent', border: '1px solid #3a3a3a', borderRadius: '14px', color: '#fff', fontSize: '1rem', fontWeight: 700, cursor: 'pointer', fontFamily: letra }}>
          Cerrar
        </button>
      </div>
    </div>,
    document.body
  )
}


// Posición de una zona del lienzo, en porcentaje (para la capa de botones)
const zona = (x, y, w, h) => ({ position: 'absolute', left: `${(x / W) * 100}%`, top: `${(y / H) * 100}%`, width: `${(w / W) * 100}%`, height: `${(h / H) * 100}%` })

// Escudo del torneo o del equipo (ocupa todo su contenedor)
function EscudoImg({ item, acento }) {
  if (!item) return null
  if (item.logo_url) return <img src={item.logo_url} alt={item.nombre || item.name || ''} style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}/>
  if (item.svg) return <div style={{ width: '100%', height: '100%' }} dangerouslySetInnerHTML={{ __html: item.svg }}/>
  const iniciales = (item.nombre || item.name || '?').substring(0, 2).toUpperCase()
  return (
    <svg viewBox="0 0 48 48" style={{ width: '100%', height: '100%', display: 'block' }}>
      <circle cx="24" cy="24" r="22" fill="rgba(0,0,0,.55)" stroke={acento} strokeWidth="2"/>
      <text x="24" y="31" textAnchor="middle" fontFamily={FUENTE} fontSize="20" fill="#fff">{iniciales}</text>
    </svg>
  )
}

// Rectángulo de tarjeta (amarilla / azul / roja) dibujado, en vez de un emoji
const COLOR_TARJETA = { '🟨': '#f5c518', '🟦': '#3b82f6', '🟥': '#e5433d' }
const NOMBRE_TARJETA = { '🟨': 'Tarjetas amarillas', '🟦': 'Tarjetas azules', '🟥': 'Tarjetas rojas' }

export default function PlayerCard({
  playerName      = 'JHONATAN',
  stats           = STATS_DEFAULT,
  cardType        = 'nivel1_verde',
  customDesign    = null,
  onStatClick,
  hideShields     = false,
  photoUrlExterno = null,
  playerId        = null,   // si viene, "Subir mi foto" queda guardada de una vez como foto de tarjeta (players.photo_url)
  onFotoSubida    = null,   // (nuevaUrl) => ... para sincronizar el estado del padre
  esPortero       = false,
  esDefensa       = false,
  torneosData     = null,
  equiposData     = null,
  // Modo escuela: no hay torneo de club que mostrar (solo el escudo de la escuela), y las estadísticas
  // son las de la ficha de evolución del niño en vez de las de un jugador de club.
  modoEscuela     = false,
  // Invitación a tocar: un brillo suave recorre los números (se apaga cuando la persona toca uno)
  pista           = false,
  subtitulo       = null,   // texto bajo el nombre; si no viene se arma con la posición y el equipo
  mini            = false,  // miniatura para la colección: sin botones ni animaciones
  inclinable      = false,  // se inclina un poco al pasar el dedo o el mouse
}) {
  const [tI, setTI] = useState(() => leerSeleccion(playerId, 't', torneosData))
  const [eI, setEI] = useState(() => leerSeleccion(playerId, 'e', equiposData))
  const [hoja, setHoja] = useState(null) // 'torneo' | 'equipo' | null: hoja para elegir
  const [photoLocal, setPhotoLocal] = useState(null)
  const [subiendoFoto, setSubiendoFoto] = useState(false)
  const [errorFoto, setErrorFoto] = useState('')
  const photoUrl = photoUrlExterno || photoLocal
  const uid = 'gc' + useId().replace(/[^a-zA-Z0-9]/g, '')
  const refInclina = useRef(null)
  const refLuz = useRef(null)

  const TORNEOS = (torneosData && torneosData.length > 0) ? torneosData : TORNEOS_DEFAULT
  const EQUIPOS = (equiposData && equiposData.length > 0) ? equiposData : EQUIPOS_DEFAULT

  const design = CARD_DESIGNS.find(d => d.id === cardType) || customDesign || CARD_DESIGNS[0]
  const c = arteDe(design)
  const conFoto = !!photoUrl
  const animado = !mini
  const acento = c.clara ? c.a : c.b

  // Antes esto solo hacía un preview local (FileReader) y nunca se guardaba
  // en ningún lado: al recargar la página desaparecía y la foto de "tarjeta"
  // seguía pendiente en todos lados. Ahora, si hay playerId, sube de una vez
  // a Storage y la guarda como players.photo_url (la foto de tarjeta) — igual
  // que el formulario de abajo (SubidaFotoJugador con campo="photo_url") —
  // así solo queda pendiente la foto de perfil.
  async function handlePhoto(e) {
    const file = e.target.files[0]
    if (!file) return
    setErrorFoto('')
    // Preview instantáneo mientras se sube de verdad en segundo plano.
    const reader = new FileReader()
    reader.onload = ev => setPhotoLocal(ev.target.result)
    reader.readAsDataURL(file)

    if (!playerId) return // sin playerId no hay dónde guardarla (p.ej. tarjetas de ejemplo/demo)

    setSubiendoFoto(true)
    try {
      const archivo = await comprimirImagen(file)
      const ext = (archivo.name.split('.').pop() || 'jpg').toLowerCase()
      const path = `fotos/${playerId}_tarjeta.${ext}`
      const { error: errUp } = await supabase.storage.from('players').upload(path, archivo, { upsert: true })
      if (errUp) throw errUp
      const { data: urlData } = supabase.storage.from('players').getPublicUrl(path)
      const nuevaUrl = `${urlData.publicUrl}?v=${Date.now()}`
      const { error: errDb } = await supabase.from('players').update({ photo_url: nuevaUrl, foto_cambiar_tarjeta: false }).eq('id', playerId)
      if (errDb) throw errDb
      onFotoSubida?.(nuevaUrl)
    } catch (err) {
      setErrorFoto('No se pudo guardar la foto. Intenta de nuevo.')
      setPhotoLocal(null)
    }
    setSubiendoFoto(false)
  }


  // ── Datos que muestra la tarjeta ──
  const eficacia = stats.eficacia ?? (stats.pj > 0 ? Math.round(((stats.pg || 0) / stats.pj) * 100) : 0)
  const fila1 = modoEscuela
    ? (esPortero
        ? [
            { label: 'ESTATURA', value: stats.estatura ? `${stats.estatura}` : '—', key: 'alt',    nombre: 'Estatura en centímetros' },
            { label: 'TÉCNICA',  value: stats.promTecnico ?? '—',                  key: 'tec',    nombre: 'Promedio técnico' },
            { label: 'ASISTENCIAS', value: stats.asistencias || 0,                 key: 'ast_gk', nombre: 'Asistencias' },
          ]
        : [
            { label: 'GOLES',    value: stats.golesEscuela ?? 0,  key: 'goles_esc', nombre: 'Goles' },
            { label: 'TÉCNICA',  value: stats.promTecnico ?? '—', key: 'tec',       nombre: 'Promedio técnico' },
            { label: 'ASISTENCIAS', value: stats.asistencias || 0, key: 'ast',      nombre: 'Asistencias' },
          ])
    : [
        { label: esPortero ? 'RECIBIDOS' : 'GOLES', value: stats.golesContra ?? 0, key: 'gc',   nombre: esPortero ? 'Goles recibidos' : 'Goles' },
        { label: 'GANADOS',  value: stats.pg ?? 0,    key: 'pg',   nombre: 'Partidos ganados' },
        { label: 'EFICACIA', value: `${eficacia}%`,   key: 'efic', nombre: 'Eficacia (partidos ganados de cada 100)' },
      ]
  const fila2 = modoEscuela
    ? [
        { label: 'MVP', value: stats.mvp || 0,       key: 'mvp_esc',  nombre: 'Veces figura del partido' },
        { label: '🟨',  value: stats.amarillas || 0, key: 'ama_esc' },
        { label: '🟥',  value: stats.rojas || 0,     key: 'roja_esc' },
      ]
    : [
        { label: 'EMPATES',  value: stats.pe ?? 0,        key: 'pe', nombre: 'Partidos empatados' },
        { label: 'PERDIDOS', value: stats.pp ?? 0,        key: 'pp', nombre: 'Partidos perdidos' },
        { label: '🟨',       value: stats.amarillas || 0, key: 'am_club' },
        { label: '🟦',       value: stats.azules || 0,    key: 'az_club' },
      ]
  const X1 = [74, 170, 266]
  const X2 = fila2.length === 4 ? [66, 148, 222, 274] : [74, 170, 266]
  const A2 = fila2.length === 4 ? [80, 84, 52, 52] : [96, 96, 96]

  const nombre = String(playerName || '').toUpperCase()
  const tamNombre = nombre.length <= 7 ? 46 : nombre.length <= 9 ? 40 : nombre.length <= 11 ? 33 : nombre.length <= 14 ? 27 : 22
  const equipoActual = EQUIPOS[eI]
  const rol = esPortero ? 'ARQUERO' : esDefensa ? 'DEFENSA' : (modoEscuela ? 'JUGADOR' : 'JUGADOR DE CAMPO')
  const nombreEquipo = (!hideShields && (equiposData && equiposData.length > 0)) ? String(equipoActual?.nombre || equipoActual?.name || '').toUpperCase() : ''
  let sub = subtitulo != null ? String(subtitulo).toUpperCase() : [rol, nombreEquipo].filter(Boolean).join(' · ')
  if (sub.length > 36) sub = sub.slice(0, 35).trimEnd() + '…'

  const tintaArriba = conFoto ? '#ffffff' : c.arriba
  const sombraTexto = conFoto ? { paintOrder: 'stroke', stroke: 'rgba(0,0,0,.45)', strokeWidth: 3, strokeLinejoin: 'round' } : null
  const interactiva = !mini && !!onStatClick
  const verEscudos = !hideShields
  const yTorneo = 172, yEquipo = modoEscuela ? 172 : 238

  // Inclinación suave al mover el dedo o el mouse (solo transform: liviano en cualquier celular)
  function mover(e) {
    const el = refInclina.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height
    el.style.transform = `perspective(900px) rotateY(${((px - .5) * 9).toFixed(2)}deg) rotateX(${((.5 - py) * 7).toFixed(2)}deg)`
    if (refLuz.current) { refLuz.current.style.opacity = '1'; refLuz.current.style.background = `radial-gradient(circle at ${(px * 100).toFixed(0)}% ${(py * 100).toFixed(0)}%, rgba(255,255,255,.22), rgba(255,255,255,0) 46%)` }
  }
  function soltar() {
    if (refInclina.current) refInclina.current.style.transform = 'perspective(900px) rotateY(0deg) rotateX(0deg)'
    if (refLuz.current) refLuz.current.style.opacity = '0'
  }
  const eventosInclina = inclinable && !mini ? { onPointerMove: mover, onPointerLeave: soltar, onPointerUp: soltar, onPointerCancel: soltar } : null

  const botonInvisible = { background: 'transparent', border: 'none', padding: 0, margin: 0, cursor: 'pointer', borderRadius: '10px', WebkitTapHighlightColor: 'rgba(255,255,255,.12)' }

  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: '400px', margin: '0 auto', filter: mini ? undefined : `drop-shadow(0 12px 28px rgba(0,0,0,.7)) drop-shadow(0 0 12px ${c.clara ? '#e9c75e' : c.a}44)` }}>
      {!mini && <style>{ESTILOS_ARTE}</style>}
      {hoja === 'torneo' && (
        <HojaElegir titulo="Elige el torneo" items={TORNEOS} indice={tI}
          onElegir={i => { setTI(i); guardarSeleccion(playerId, 't', TORNEOS[i]?.id); setHoja(null) }} onCerrar={() => setHoja(null)}/>
      )}
      {hoja === 'equipo' && (
        <HojaElegir titulo={modoEscuela ? 'Elige la escuela' : 'Elige tu equipo'} items={EQUIPOS} indice={eI}
          onElegir={i => { setEI(i); guardarSeleccion(playerId, 'e', EQUIPOS[i]?.id); setHoja(null) }} onCerrar={() => setHoja(null)}/>
      )}

      <div ref={refInclina} {...eventosInclina}
        style={{ position: 'relative', width: '100%', paddingBottom: `${(H / W) * 100}%`, transition: 'transform .18s ease-out', willChange: inclinable ? 'transform' : undefined, touchAction: 'pan-y' }}>

        {/* 1 · Fondo del material */}
        <svg viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }} aria-hidden="true">
          <ArteDefs c={c} uid={uid}/>
          <ArteFondo c={c} uid={uid}/>
          {!conFoto && (
            <g clipPath={`url(#${uid}f)`} fill={c.arriba} opacity={c.clara ? .16 : .13}>
              <circle cx="204" cy="150" r="36"/>
              <path d="M 126 322 Q 126 216 204 208 Q 282 216 282 322 Z"/>
            </g>
          )}
        </svg>

        {/* 2 · Foto del jugador, recortada con la silueta de la tarjeta */}
        {conFoto && (
          <div style={{ position: 'absolute', inset: 0, clipPath: poligonoCss(c.n), WebkitClipPath: poligonoCss(c.n), pointerEvents: 'none' }}>
            <img src={photoUrl} alt="" data-foto-tarjeta="1"
              style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '63%', objectFit: 'cover', objectPosition: 'top center', display: 'block' }}/>
          </div>
        )}

        {/* 3 · Placa, marco, adornos y textos */}
        <svg viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }}
          role="img" aria-label={`Tarjeta de ${nombre}: ${stats.pj ?? 0} partidos jugados`}>
          <ArteFrente c={c} uid={uid} conFoto={conFoto} animado={animado}/>

          {/* Partidos jugados */}
          {pista && interactiva && <rect x="26" y="46" width="96" height="78" rx="14" fill={conFoto ? '#fff' : c.a} fillOpacity=".1" className="gmc-pista"/>}
          <text x="34" y="101" fontFamily={FUENTE} fontSize="68" fill={tintaArriba} style={sombraTexto}>{stats.pj ?? 0}</text>
          <text x="36" y="117" fontFamily={FUENTE} fontSize="12.5" letterSpacing="2.4" fill={tintaArriba} opacity=".92" style={conFoto ? { paintOrder: 'stroke', stroke: 'rgba(0,0,0,.5)', strokeWidth: 2 } : null}>
            {stats.pj === 1 ? 'PARTIDO' : 'PARTIDOS'}
          </text>

          {/* Bases de los escudos */}
          {verEscudos && (
            <g>
              {!modoEscuela && (
                <>
                  <text x="34" y={yTorneo - 32} fontFamily={FUENTE} fontSize="9.5" letterSpacing="2" fill={tintaArriba} opacity=".8" style={conFoto ? { paintOrder: 'stroke', stroke: 'rgba(0,0,0,.5)', strokeWidth: 2 } : null}>TORNEO</text>
                  <circle cx="58" cy={yTorneo} r="26" fill={c.clara && !conFoto ? 'rgba(255,255,255,.6)' : 'rgba(0,0,0,.5)'} stroke={conFoto ? '#fff' : acento} strokeOpacity={conFoto ? .55 : .8} strokeWidth="1.4"/>
                </>
              )}
              <text x="34" y={yEquipo - 32} fontFamily={FUENTE} fontSize="9.5" letterSpacing="2" fill={tintaArriba} opacity=".8" style={conFoto ? { paintOrder: 'stroke', stroke: 'rgba(0,0,0,.5)', strokeWidth: 2 } : null}>{modoEscuela ? 'ESCUELA' : 'EQUIPO'}</text>
              <circle cx="58" cy={yEquipo} r="26" fill={c.clara && !conFoto ? 'rgba(255,255,255,.6)' : 'rgba(0,0,0,.5)'} stroke={conFoto ? '#fff' : acento} strokeOpacity={conFoto ? .55 : .8} strokeWidth="1.4"/>
            </g>
          )}

          {/* Nombre */}
          <text x="170" y="332" textAnchor="middle" fontFamily={FUENTE} fontSize={tamNombre} letterSpacing="2.5" fill={c.tinta}>{nombre}</text>
          {sub && <text x="170" y="350" textAnchor="middle" fontFamily={FUENTE} fontSize="12" letterSpacing="2.2" fill={acento}>{sub}</text>}
          <line x1="70" y1="358" x2="270" y2="358" stroke={acento} strokeOpacity=".5" strokeWidth="1"/>

          {/* Fila principal: tres datos grandes */}
          {fila1.map((s, i) => (
            <g key={s.key}>
              {pista && interactiva && <rect x={X1[i] - 44} y="363" width="88" height="46" rx="12" fill={c.a} fillOpacity={c.clara ? .14 : .16} className="gmc-pista" style={{ animationDelay: `${0.6 + i * 0.55}s` }}/>}
              <text x={X1[i]} y="391" textAnchor="middle" fontFamily={FUENTE} fontSize="34" fill={c.tinta}>{s.value}</text>
              <text x={X1[i]} y="405" textAnchor="middle" fontFamily={FUENTE} fontSize="12" letterSpacing="1.8" fill={c.suave}>{s.label}</text>
              {i > 0 && <line x1={X1[i] - 48} y1="367" x2={X1[i] - 48} y2="403" stroke={acento} strokeOpacity=".35" strokeWidth="1"/>}
            </g>
          ))}
          <line x1="44" y1="413" x2="296" y2="413" stroke={c.tinta} strokeOpacity=".14" strokeWidth="1"/>

          {/* Fila secundaria: datos de apoyo */}
          {fila2.map((s, i) => {
            const tarjeta = COLOR_TARJETA[s.label]
            return tarjeta ? (
              <g key={s.key}>
                <rect x={X2[i] - 13} y="419" width="9" height="13" rx="1.6" fill={tarjeta} stroke="rgba(0,0,0,.35)" strokeWidth=".6"/>
                <text x={X2[i] + 2} y="431.5" fontFamily={FUENTE} fontSize="18" fill={c.tinta}>{s.value}</text>
              </g>
            ) : (
              <text key={s.key} x={X2[i]} y="431.5" textAnchor="middle" fontFamily={FUENTE} fill={c.tinta}>
                <tspan fontSize="11" letterSpacing="1.2" fill={c.suave}>{s.label}</tspan>
                <tspan fontSize="18" dx="5">{s.value}</tspan>
              </text>
            )
          })}

          {/* Cinta del nivel: nombre + los 5 pasos del nivel */}
          <text x="170" y="455" textAnchor="middle" fontFamily={FUENTE} fontSize="12.5" letterSpacing="3.4" fill={acento}>{c.p ? NOMBRE_NIVEL[c.n] : 'GOLMEBOL'}</text>
          {c.p > 0 && [0, 1, 2, 3, 4].map(i => (
            <circle key={i} cx={146 + i * 12} cy="469" r="3.2" fill={i < c.p ? acento : 'none'} stroke={acento} strokeWidth="1.1" opacity={i < c.p ? 1 : .55}/>
          ))}
        </svg>

        {/* Luz que sigue al dedo */}
        {inclinable && !mini && (
          <div ref={refLuz} style={{ position: 'absolute', inset: 0, opacity: 0, transition: 'opacity .25s', pointerEvents: 'none', clipPath: poligonoCss(c.n), WebkitClipPath: poligonoCss(c.n), mixBlendMode: 'screen' }}/>
        )}

        {/* 4 · Capa de botones (transparente) */}
        {verEscudos && (
          <>
            {!modoEscuela && (
              <button type="button" onClick={() => !mini && onStatClick?.(TORNEOS[tI]?.id)} aria-label={`Torneo: ${TORNEOS[tI]?.nombre || ''}`} tabIndex={mini ? -1 : 0}
                style={{ ...botonInvisible, ...zona(38, yTorneo - 20, 40, 40), borderRadius: '50%', overflow: 'hidden', pointerEvents: mini ? 'none' : 'auto' }}>
                <EscudoImg item={TORNEOS[tI]} acento={c.a}/>
              </button>
            )}
            <button type="button" onClick={() => !mini && onStatClick?.(EQUIPOS[eI]?.id)} aria-label={`${modoEscuela ? 'Escuela' : 'Equipo'}: ${equipoActual?.nombre || ''}`} tabIndex={mini ? -1 : 0}
              style={{ ...botonInvisible, ...zona(38, yEquipo - 20, 40, 40), borderRadius: '50%', overflow: 'hidden', pointerEvents: mini ? 'none' : 'auto' }}>
              <EscudoImg item={equipoActual} acento={c.a}/>
            </button>
            {!mini && !modoEscuela && TORNEOS.length > 1 && (
              <BotonCambiar y={yTorneo} total={TORNEOS.length} actual={tI} onClick={() => setHoja('torneo')} acento={conFoto ? '#ffffff' : acento} queCambia="torneo"/>
            )}
            {!mini && EQUIPOS.length > 1 && (
              <BotonCambiar y={yEquipo} total={EQUIPOS.length} actual={eI} onClick={() => setHoja('equipo')} acento={conFoto ? '#ffffff' : acento} queCambia={modoEscuela ? 'escuela' : 'equipo'}/>
            )}
          </>
        )}

        {interactiva && (
          <>
            <button type="button" onClick={() => onStatClick('pj')} aria-label={`Partidos jugados: ${stats.pj ?? 0}. Ver ranking`} style={{ ...botonInvisible, ...zona(24, 44, 100, 82) }}/>
            {fila1.map((s, i) => (
              <button key={s.key} type="button" onClick={() => onStatClick(s.key)} aria-label={`${s.nombre}: ${s.value}. Ver ranking`} style={{ ...botonInvisible, ...zona(X1[i] - 47, 361, 94, 50) }}/>
            ))}
            {fila2.map((s, i) => (
              <button key={s.key} type="button" onClick={() => onStatClick(s.key)} aria-label={`${s.nombre || NOMBRE_TARJETA[s.label] || s.label}: ${s.value}`} style={{ ...botonInvisible, ...zona(X2[i] - A2[i] / 2, 414, A2[i], 28) }}/>
            ))}
          </>
        )}

        {/* Subir la foto de la tarjeta (solo si todavía no hay) */}
        {!conFoto && !mini && !hideShields && (
          <div style={{ ...zona(110, 246, 200, 60), height: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', minHeight: '44px', padding: '0 16px', borderRadius: '999px', cursor: subiendoFoto ? 'default' : 'pointer',
              background: c.clara ? 'rgba(29,22,6,.86)' : 'rgba(0,0,0,.6)', border: `1.5px solid ${c.clara ? '#e9c75e' : c.a}`, color: '#fff', fontFamily: 'system-ui,-apple-system,"Segoe UI",Roboto,sans-serif', fontSize: '14px', fontWeight: 800, whiteSpace: 'nowrap' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.5"/></svg>
              {subiendoFoto ? 'Subiendo…' : 'Subir mi foto'}
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhoto} disabled={subiendoFoto}/>
            </label>
            {errorFoto && <span style={{ fontFamily: 'system-ui,sans-serif', fontSize: '13px', fontWeight: 700, color: '#fff', background: 'rgba(229,67,61,.92)', padding: '4px 10px', borderRadius: '8px', textAlign: 'center' }}>{errorFoto}</span>}
          </div>
        )}
      </div>
    </div>
  )
}

// Botón redondo al lado del escudo: toca para elegir entre todos los torneos o equipos.
// Late unas veces al abrir para que se note; el número dice cuántos hay.
function BotonCambiar({ y, total, actual, onClick, acento, queCambia }) {
  return (
    <button type="button" onClick={onClick} aria-label={`Elegir otro ${queCambia} (${actual + 1} de ${total})`}
      style={{ ...zona(88, y - 17, 34, 34), background: 'rgba(0,0,0,.72)', border: `2px solid ${acento}`, borderRadius: '50%', color: '#fff', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'gmPulsoCambiar 1.6s ease-out 4' }}>
      <style>{`@keyframes gmPulsoCambiar { 0% { box-shadow: 0 0 0 0 rgba(255,255,255,.55) } 70% { box-shadow: 0 0 0 9px rgba(255,255,255,0) } 100% { box-shadow: 0 0 0 0 rgba(255,255,255,0) } }`}</style>
      <svg viewBox="0 0 24 24" style={{ width: '58%', height: '58%' }} fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M8 4v15M8 4 4.5 7.5M8 4l3.5 3.5M16 20V5M16 20l-3.5-3.5M16 20l3.5-3.5"/>
      </svg>
      <span style={{ position: 'absolute', left: '100%', top: '50%', transform: 'translateY(-50%)', marginLeft: '4px', fontFamily: 'system-ui,sans-serif', fontSize: '10px', fontWeight: 800, color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,.9)', whiteSpace: 'nowrap' }}>{actual + 1}/{total}</span>
    </button>
  )
}
