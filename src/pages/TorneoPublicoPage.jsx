import { useState, useEffect, useLayoutEffect, useRef, useMemo } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Trophy, MapPin, Calendar, ChevronDown, Shield, X, Radio, ArrowLeft } from 'lucide-react'
import { GiSoccerBall } from 'react-icons/gi'
import RankingPoster from '../components/RankingPoster'
import TablaPosiciones from '../components/TablaPosiciones'
import VallaEquipos from '../components/VallaEquipos'
import { registrarVisita } from '../lib/visitas'
import { getPuntosTorneo, puntosVictoria, cargarDescuentos } from '../lib/puntosTorneo'
import { computeTablaGeneral, computeVallaEquipos, conMarcadorEnVivo, mergeGoleadoresConVivo, enVivoDe, agregarForma, compararPosiciones, aplicarDescuentos, crearDetectorIntergrupo } from '../lib/torneoTablas'
import { hydratePlayersPublico } from '../lib/playersPublico'
import { cargarRostersTorneo, cargarRosterEquipo } from '../lib/rosterTorneo'
import { fmtHoraDate } from '../lib/horaHelpers'
import { guardarCacheRapido, leerCacheRapido, fechaCacheRapido } from '../lib/cacheRapido'
import { traerPartidosTorneo, derivarBracket } from '../lib/partidosPublicos'
import { cargarTorneoPublico } from '../lib/torneoPublicoDatos'
import PantallaCargaTorneo from '../components/PantallaCargaTorneo'
import { urlMini, alFallarMini } from '../lib/imagenMini'
import { BotonAvisosTorneo } from '../components/BotonAvisos'
import PartidoDetalleModal from '../components/PartidoDetalleModal'
import { aplicarMarcaPagina, esHostPropioGolmebol } from '../lib/marcaPagina'
import { derivarEnVivo, extraerGoles, extraerTarjetas, buscarPartidoHermano, marcadorGlobal } from '../lib/liveMatch'

// Árbol de eliminatorias, público y de solo lectura — mismo orden de fases
// que usa el admin para armar el bracket real.
const FASE_ORDEN_ELIM = ['octavos', 'cuartos', 'semifinal', 'final']

// Nombre/fase de cada ronda de la VISTA PREVIA (antes de que existan
// partidos reales de eliminatorias) — misma lógica que usa el admin en
// AdminTorneoDetallePage para armar su vista previa en vivo (ahora en
// src/lib/bracketHelpers.js, compartida entre las tres vistas).

function TeamLogo({ logo_url, name, size = 28 }) {
  const iniciales = (name || '?').split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase()
  if (logo_url) return <img src={urlMini(logo_url, Math.max(size, 40))} onError={alFallarMini} loading="lazy" decoding="async" alt={name} style={{ width: '100%', height: '100%', objectFit: 'contain' }}/>
  return (
    <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, #1a73e8, #6c35de)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ fontSize: size * 0.32 + 'px', fontWeight: '800', color: '#fff', fontFamily: 'system-ui' }}>{iniciales}</span>
    </div>
  )
}

const FASE_LABEL = { grupo: 'Grupo', octavos: 'Octavos', cuartos: 'Cuartos de final', semifinal: 'Semifinal', final: 'Final', otra: 'Otra fase' }

// Tamaño de letra del nombre del equipo según su largo — así un nombre
// largo se ve completo (más chiquito) en vez de cortarse con "..." o
// desbordarse de la tarjeta.
function tamNombreEquipo(nombre) {
  const len = (nombre || '').length
  if (len > 20) return '.64rem'
  if (len > 15) return '.7rem'
  if (len > 11) return '.76rem'
  return '.84rem'
}

// Etiqueta corta del momento del partido en vivo: "1T · 12:34" o "DESCANSO"
// — mismo formato que usa la página de inicio de Golmebol.
function labelTiempoVivo(vivo) {
  if (vivo.descanso) return 'DESCANSO'
  const per = vivo.periodo === 2 ? '2T' : '1T'
  return `${per} · ${vivo.reloj}`
}

// Une goles y tarjetas de un partido en vivo en una sola línea de tiempo,
// ordenada minuto a minuto — mismo criterio que la página de inicio.
function eventosDelPartidoVivo(m) {
  const goles    = extraerGoles(m).map(g => ({ ...g, tipoEvento: 'gol' }))
  const tarjetas = extraerTarjetas(m).map(t => ({ ...t, tipoEvento: 'tarjeta' }))
  return [...goles, ...tarjetas].sort((a, b) => (a.periodo - b.periodo) || ((parseInt(a.minuto) || 0) - (parseInt(b.minuto) || 0)))
}

const COLOR_TARJETA_VIVO = { amarilla: '#f9c400', azul: '#1a73e8', roja: '#d93025' }

// Detalle de un partido EN VIVO (marcador + reloj + minuto a minuto) — se lee
// del mismo snapshot que ya sube en tiempo real la planilla del árbitro
// (matches.live_state / live_state_rapida), igual que en la página de
// inicio de Golmebol, para que esto también se vea en el dominio propio de
// cada organizador (antes solo estaba en golmebol.com).
function LiveMatchDetalle({ m, onClose }) {
  useEffect(() => {
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = original }
  }, [])

  const eventos = eventosDelPartidoVivo(m)

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', zIndex: 600, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: '540px', maxHeight: '88vh', overflowY: 'auto', overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch', padding: '20px 18px 28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <span style={{ fontWeight: 900, color: m.vivo.descanso ? '#e8710a' : '#d93025', fontSize: '.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Radio size={14}/> {m.vivo.descanso ? 'DESCANSO' : `EN VIVO · ${labelTiempoVivo(m.vivo)}`}
          </span>
          <button onClick={onClose} style={{ background: '#f1f3f4', border: 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', color: '#5f6368', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><X size={16}/></button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '22px', margin: '10px 0 20px' }}>
          <div style={{ flex: 1, textAlign: 'center', minWidth: 0 }}>
            <div style={{ width: '52px', height: '52px', borderRadius: '12px', overflow: 'hidden', margin: '0 auto' }}><TeamLogo logo_url={m.home?.logo_url} name={m.home?.name} size={52}/></div>
            <div style={{ fontWeight: 800, color: '#202124', fontSize: '.8rem', marginTop: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.home?.name}</div>
          </div>
          {m.hermano && m.global ? (
            <div style={{ textAlign: 'center', flexShrink: 0 }}>
              <div style={{ fontSize: '.6rem', color: '#9aa0a6', fontWeight: 800, letterSpacing: '.04em' }}>IDA</div>
              <div style={{ fontSize: '.95rem', fontWeight: 800, color: '#5f6368' }}>{m.idaLocal} - {m.idaVisitante}</div>
              <div style={{ fontSize: '.6rem', color: '#d93025', fontWeight: 800, letterSpacing: '.04em', marginTop: '8px' }}>VUELTA · EN VIVO</div>
              <div style={{ fontWeight: 900, fontSize: '1.6rem', color: '#202124' }}>{m.vivo.golesLocal} - {m.vivo.golesVis}</div>
              <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #e8eaed' }}>
                <div style={{ fontSize: '.62rem', color: '#1a73e8', fontWeight: 900, letterSpacing: '.04em' }}>GLOBAL</div>
                <div style={{ fontWeight: 900, fontSize: '1.6rem', color: '#1a73e8' }}>{m.global.local} - {m.global.visitante}</div>
              </div>
            </div>
          ) : (
            <div style={{ fontWeight: 900, fontSize: '1.8rem', color: '#202124' }}>{m.vivo.golesLocal} - {m.vivo.golesVis}</div>
          )}
          <div style={{ flex: 1, textAlign: 'center', minWidth: 0 }}>
            <div style={{ width: '52px', height: '52px', borderRadius: '12px', overflow: 'hidden', margin: '0 auto' }}><TeamLogo logo_url={m.away?.logo_url} name={m.away?.name} size={52}/></div>
            <div style={{ fontWeight: 800, color: '#202124', fontSize: '.8rem', marginTop: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.away?.name}</div>
          </div>
        </div>

        <div style={{ background: '#f8f9fa', border: '1px solid #e8eaed', borderRadius: '14px', padding: '16px' }}>
          <div style={{ fontSize: '.62rem', fontWeight: 800, color: '#9aa0a6', letterSpacing: '.08em', marginBottom: '10px', textAlign: 'center' }}>MINUTO A MINUTO</div>
          {eventos.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#9aa0a6', fontSize: '.8rem', padding: '18px 0' }}>Aún no hay goles ni tarjetas</div>
          ) : (
            eventos.map((ev, i) => {
              const esLocal = ev.equipo === 'local'
              const icono = ev.tipoEvento === 'gol' ? <GiSoccerBall size={13} color="#202124"/> : <span style={{ display: 'inline-block', width: '9px', height: '13px', borderRadius: '2px', background: COLOR_TARJETA_VIVO[ev.color] || '#999', flexShrink: 0 }}/>
              return (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 48px 1fr', alignItems: 'center', gap: '6px', padding: '8px 0', borderTop: i > 0 ? '1px solid #e8eaed' : 'none' }}>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '6px', textAlign: 'right', minWidth: 0 }}>
                    {esLocal && <>
                      <span style={{ fontWeight: 700, fontSize: '.8rem', color: '#202124', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.jugador}</span>
                      <span style={{ flexShrink: 0, display: 'flex' }}>{icono}</span>
                    </>}
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <span style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '999px', padding: '3px 8px', fontSize: '.64rem', fontWeight: 800, color: '#5f6368', whiteSpace: 'nowrap' }}>{ev.minuto ? `${ev.minuto}'` : '—'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                    {!esLocal && <>
                      <span style={{ flexShrink: 0, display: 'flex' }}>{icono}</span>
                      <span style={{ fontWeight: 700, fontSize: '.8rem', color: '#202124', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.jugador}</span>
                    </>}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

const MEDALLA = ['#f9a825', '#c9cdd2', '#cd7f32']

// Misma tabla azul de siempre, pero colapsable con un encabezado — para
// mostrar un grupo a la vez sin saturar la pantalla cuando el torneo tiene
// varios grupos.
function TablaColapsable({ titulo, rows, defaultOpen = false, onClickEquipo, clasifican, eliminados, rivales, mejoresPerdedores }) {
  const [abierto, setAbierto] = useState(defaultOpen)
  return (
    <div>
      <button onClick={() => setAbierto(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px',
          background: 'linear-gradient(170deg,#0e2258,#08122e)', border: '1px solid #1e3a7a', borderRadius: '14px',
          padding: '14px 16px', cursor: 'pointer', boxShadow: '0 3px 14px rgba(0,0,0,.3)',
        }}>
        <span style={{ color: '#fff', fontWeight: 900, fontSize: '.88rem', letterSpacing: '.08em', textTransform: 'uppercase', textAlign: 'left' }}>{titulo}</span>
        <ChevronDown size={18} color="#7fb3ff" style={{ flexShrink: 0, transition: 'transform .15s', transform: abierto ? 'rotate(180deg)' : 'none' }}/>
      </button>
      {abierto && (
        <div style={{ marginTop: '8px' }}>
          <TablaPosiciones rows={rows} onClickEquipo={onClickEquipo} clasifican={clasifican} eliminados={eliminados} rivales={rivales} mejoresPerdedores={mejoresPerdedores}/>
        </div>
      )}
    </div>
  )
}

// Modal con foto grande + nombre de cada jugador REGISTRADO de un equipo en
// este torneo — para que cualquiera pueda verificar en cancha quién sí está
// inscrito.
function RosterModal({ rosterModal, onClose, torneoNombre, onVerEquipo, onVerJugador, porJugador = false }) {
  // Bloquear el scroll del fondo mientras el modal está abierto: si no, en
  // Android el gesto de scroll dentro del modal se "escapa" hacia la página
  // de atrás apenas llega al borde (scroll chaining) y rebota, dando la
  // sensación de que no deja bajar a ver el resto de la lista.
  useEffect(() => {
    if (!rosterModal) return
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = original }
  }, [!!rosterModal])

  if (!rosterModal) return null
  const { team, jugadores, loading, stats } = rosterModal
  const infoTeam = [team.city, team.categoria, team.modalidad, team.genero].filter(Boolean).join(' · ')
  // Inscripción POR JUGADOR: cada uno paga lo suyo, así que se ve quién ya pagó y quién debe. Solo si la marca llegó
  // (si no, no se muestra nada raro). Los que deben salen primero.
  const mostrarPago = !!porJugador && (jugadores || []).some(j => typeof j.inscripcion_pagada === 'boolean')
  const nDeben = mostrarPago ? jugadores.filter(j => j.inscripcion_pagada !== true).length : 0
  const listaJug = mostrarPago ? [...jugadores].sort((a, b) => (a.inscripcion_pagada === true) - (b.inscripcion_pagada === true) || (a.name || '').localeCompare(b.name || '')) : jugadores
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', zIndex: 500, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: '720px', maxHeight: '88vh', overflowY: 'auto', overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch' }}>
        {/* Encabezado fijo (sticky): si el equipo tiene muchos jugadores y hay
            que bajar para verlos a todos, la X para cerrar y pasar a ver otro
            equipo no se puede quedar escondida arriba del scroll — por eso
            siempre queda visible, sin importar cuánto se baje. */}
        <div style={{ position: 'sticky', top: 0, zIndex: 2, background: '#fff', padding: '20px 18px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '9px', overflow: 'hidden', flexShrink: 0 }}>
              <TeamLogo logo_url={team.logo_url} name={team.name} size={36}/>
            </div>
            <div>
              <div style={{ fontWeight: '800', color: '#202124', fontSize: '1.05rem', lineHeight: 1.2 }}>{team.name}</div>
              {infoTeam && <div style={{ fontSize: '.72rem', color: '#9aa0a6', marginTop: '2px' }}>{infoTeam}</div>}
            </div>
          </div>
          <button onClick={onClose} style={{ background: '#f1f3f4', border: 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', color: '#5f6368', fontSize: '1rem', fontWeight: '700', flexShrink: 0 }}>✕</button>
        </div>

        <div style={{ padding: '0 18px 28px' }}>
        {stats && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', margin: '14px 0', background: '#f8f9fa', border: '1px solid #e8eaed', borderRadius: '10px', padding: '10px 6px' }}>
            {[['PJ', stats.pj], ['PG', stats.pg], ['PE', stats.pe], ['PP', stats.pp], ['GF', stats.gf], ['GC', stats.gc], ['PTS', stats.pts]].map(([label, val]) => (
              <div key={label} style={{ textAlign: 'center' }}>
                <div style={{ fontWeight: '900', color: label === 'PTS' ? '#1a73e8' : '#202124', fontSize: '.9rem' }}>{val ?? 0}</div>
                <div style={{ fontSize: '.6rem', color: '#9aa0a6', fontWeight: '700', letterSpacing: '.04em', marginTop: '1px' }}>{label}</div>
              </div>
            ))}
          </div>
        )}

        {onVerEquipo && team.id && (
          <button onClick={() => onVerEquipo(team.id)}
            style={{ width: '100%', marginBottom: '14px', padding: '11px', borderRadius: '10px', border: 'none', background: 'var(--color-primario, #1a73e8)', color: '#fff', fontWeight: 700, fontSize: '.84rem', cursor: 'pointer', fontFamily: 'inherit' }}>
            Ver perfil completo del equipo →
          </button>
        )}
        <div style={{ fontSize: '.78rem', color: '#5f6368', marginBottom: '18px', lineHeight: 1.5 }}>
          Jugadores registrados de <b>{team.name}</b> en <b>{torneoNombre}</b>.
        </div>
        {mostrarPago && !loading && !rosterModal.error && jugadores.length > 0 && (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', margin: '-6px 0 16px' }}>
            <span style={{ fontSize: '.74rem', fontWeight: '800', color: '#137333', background: '#e6f4ea', borderRadius: '8px', padding: '4px 10px' }}>✓ Pagaron: {jugadores.length - nDeben}</span>
            <span style={{ fontSize: '.74rem', fontWeight: '800', color: nDeben ? '#b3261e' : '#5f6368', background: nDeben ? '#fce8e6' : '#f1f3f4', borderRadius: '8px', padding: '4px 10px' }}>Deben: {nDeben}</span>
          </div>
        )}

        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#9aa0a6', fontSize: '.85rem' }}>Cargando jugadores...</div>
        ) : rosterModal.error ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#d93025', fontSize: '.85rem' }}>No se pudo cargar la plantilla. Revisa tu conexión y vuelve a tocar el equipo.</div>
        ) : jugadores.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#9aa0a6', fontSize: '.85rem' }}>Este equipo aún no tiene jugadores registrados en este torneo</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))', gap: '16px' }}>
            {listaJug.map(j => {
              const tieneTag = !!(j.es_elite || j.es_profesional || j.es_exprofesional || j.es_mayor_35 || j.etiqueta_personalizada)
              return (
              <div key={j.id} role={onVerJugador ? 'link' : undefined} tabIndex={onVerJugador ? 0 : undefined} onClick={onVerJugador ? () => onVerJugador(j.id) : undefined}
                style={{ textAlign: 'center', cursor: onVerJugador ? 'pointer' : 'default' }}>
                {/* Aro de color tipo "historia de Instagram" alrededor de la foto,
                    para resaltar de un vistazo a los jugadores con alguna etiqueta */}
                <div style={{ width: '92px', height: '92px', borderRadius: '50%', margin: '0 auto', padding: tieneTag ? '3px' : '0',
                  background: tieneTag ? 'linear-gradient(45deg, #f9ce34, #ee2a7b, #6228d7)' : 'transparent' }}>
                  <div style={{ width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden', background: '#f1f3f4', border: tieneTag ? '3px solid #fff' : '2px solid #e8eaed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {(j.photo_face_url || j.photo_url)
                      ? <img src={j.photo_face_url || j.photo_url} alt={j.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
                      : <span style={{ fontSize: '2rem' }}>👤</span>}
                  </div>
                </div>
                <div style={{ marginTop: '8px', fontWeight: '700', color: '#202124', fontSize: '.82rem', lineHeight: 1.25 }}>{j.name}</div>
                {mostrarPago && (j.inscripcion_pagada === true
                  ? <div style={{ marginTop: '4px' }}><span style={{ fontSize: '.62rem', color: '#137333', background: '#e6f4ea', borderRadius: '8px', padding: '1px 7px', fontWeight: '800' }}>✓ Pagó</span></div>
                  : <div style={{ marginTop: '4px' }}><span style={{ fontSize: '.64rem', color: '#fff', background: '#d93025', borderRadius: '8px', padding: '1px 8px', fontWeight: '800', letterSpacing: '.03em' }}>DEBE</span></div>)}
                {tieneTag && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '5px', alignItems: 'center' }}>
                    {j.es_elite && <span style={{ fontSize: '.62rem', color: '#1a1305', background: '#f5c542', borderRadius: '8px', padding: '1px 7px', fontWeight: '800' }}>💎 Élite</span>}
                    {j.es_profesional && <span style={{ fontSize: '.62rem', color: '#fff', background: '#7b3ff2', borderRadius: '8px', padding: '1px 7px', fontWeight: '800' }}>🎓 Profesional</span>}
                    {j.es_exprofesional && <span style={{ fontSize: '.62rem', color: '#fff', background: '#d97706', borderRadius: '8px', padding: '1px 7px', fontWeight: '800' }}>⚽ Exprofesional</span>}
                    {j.es_mayor_35 && <span style={{ fontSize: '.62rem', color: '#202124', background: '#f1f3f4', borderRadius: '8px', padding: '1px 7px', fontWeight: '700' }}>🕒 Mayor de 35</span>}
                    {j.etiqueta_personalizada && <span style={{ fontSize: '.62rem', color: '#fff', background: '#5b9dff', borderRadius: '8px', padding: '1px 7px', fontWeight: '800' }}>⭐ {j.etiqueta_personalizada}</span>}
                  </div>
                )}
              </div>
              )
            })}
          </div>
        )}
        </div>
      </div>
    </div>
  )
}

// Banner estilo "poster" con el podio de goleadores y la valla menos vencida del torneo
function TopGoleadoresBanner({ goleadores, vallaRow, vallaArqueros }) {
  const top3 = goleadores.slice(0, 3)
  if (top3.length === 0 && !vallaRow) return null

  return (
    <div style={{
      background: 'radial-gradient(circle at 50% 0%, #241a05 0%, #0a0a12 55%, #07070e 100%)',
      borderRadius: '18px',
      padding: '26px 16px 22px',
      marginBottom: '16px',
      border: '1px solid #2a2410',
      boxShadow: '0 8px 30px rgba(0,0,0,.25)',
    }}>
      {top3.length > 0 && (
        <>
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <div style={{ fontSize: '1.7rem', marginBottom: '4px' }}>🏆</div>
            <div style={{ fontWeight: '900', color: '#fff', fontSize: '1.05rem', letterSpacing: '.02em', textTransform: 'uppercase', lineHeight: 1.3 }}>
              Top Goleadores
            </div>
            <div style={{ color: '#f9a825', fontWeight: '800', fontSize: '.68rem', letterSpacing: '.18em', marginTop: '2px' }}>
              DEL TORNEO
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {top3.map((g, i) => (
              <div key={`${g.player_id}-${g.team_id}`} style={{ width: '104px', textAlign: 'center' }}>
                <div style={{ width: '74px', height: '74px', borderRadius: '50%', margin: '0 auto', border: `3px solid ${MEDALLA[i]}`, overflow: 'hidden', background: '#1a1a24', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 16px ${MEDALLA[i]}55` }}>
                  {g.photo_url ? <img src={g.photo_url} alt={g.player_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/> : <span style={{ fontSize: '1.6rem' }}>👤</span>}
                </div>
                <div style={{ marginTop: '-13px', display: 'flex', justifyContent: 'center' }}>
                  <div style={{ background: MEDALLA[i], color: '#000', fontWeight: '900', fontSize: '.7rem', borderRadius: '10px', padding: '2px 9px', border: '2px solid #0a0a12', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span>{g.total_goals}</span>
                    <div style={{ width: '11px', height: '11px', borderRadius: '2px', overflow: 'hidden', flexShrink: 0 }}>
                      <TeamLogo logo_url={g.team_logo} name={g.team_name} size={11}/>
                    </div>
                  </div>
                </div>
                <div style={{ marginTop: '7px', color: '#fff', fontWeight: '800', fontSize: '.7rem', textTransform: 'uppercase', lineHeight: 1.2 }}>{g.player_name}</div>
                <div style={{ color: '#8a8f9a', fontSize: '.62rem', marginTop: '2px' }}>{g.team_name}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {vallaRow && (
        <div style={{ marginTop: top3.length > 0 ? '22px' : '0', paddingTop: top3.length > 0 ? '18px' : '0', borderTop: top3.length > 0 ? '1px solid rgba(255,255,255,.08)' : 'none', textAlign: 'center' }}>
          <div style={{ color: '#00ddd0', fontWeight: '800', fontSize: '.68rem', letterSpacing: '.14em', marginBottom: '10px' }}>🧤 VALLA MENOS VENCIDA</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: vallaArqueros.length > 0 ? '12px' : '0', flexWrap: 'wrap' }}>
            <div style={{ width: '30px', height: '30px', borderRadius: '6px', overflow: 'hidden', flexShrink: 0 }}>
              <TeamLogo logo_url={vallaRow.equipo.logo_url} name={vallaRow.equipo.name} size={30}/>
            </div>
            <div style={{ color: '#fff', fontWeight: '800', fontSize: '.85rem' }}>{vallaRow.equipo.name}</div>
            <div style={{ background: '#00ddd0', color: '#000', fontWeight: '900', fontSize: '.68rem', borderRadius: '10px', padding: '2px 10px' }}>{vallaRow.gc} gol{vallaRow.gc === 1 ? '' : 'es'} en contra</div>
          </div>
          {vallaArqueros.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '14px', flexWrap: 'wrap' }}>
              {vallaArqueros.map(a => (
                <div key={a.id} style={{ textAlign: 'center', width: '68px' }}>
                  <div style={{ width: '50px', height: '50px', borderRadius: '50%', margin: '0 auto', border: '2px solid #00ddd0', overflow: 'hidden', background: '#1a1a24', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {a.photo_url || a.photo_face_url ? <img src={a.photo_face_url || a.photo_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/> : <span style={{ fontSize: '1.1rem' }}>🧤</span>}
                  </div>
                  <div style={{ marginTop: '5px', color: '#fff', fontWeight: '700', fontSize: '.6rem', lineHeight: 1.2 }}>{a.name}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// PRÓXIMOS partidos del torneo: un panel por día (colores del torneo) y cada partido en una franja blanca:
// escudo | EQUIPO · VS · EQUIPO | escudo, con la hora y la sede debajo. Limpio y fácil de leer en celular.
function ProximosPartidos({ partidos, abrirRoster, esIntergrupo = () => false }) {
  const ordenados = partidos.slice().sort((x, y) => (x.played_at ? new Date(x.played_at).getTime() : Infinity) - (y.played_at ? new Date(y.played_at).getTime() : Infinity))
  const inicioHoy = new Date(); inicioHoy.setHours(0, 0, 0, 0)
  const claveDia = d => { const x = new Date(d); return `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}` }
  const grupos = []
  ordenados.forEach(p => {
    const k = p.played_at ? claveDia(p.played_at) : 'sin-fecha'
    let g = grupos[grupos.length - 1]
    if (!g || g.k !== k) { g = { k, fecha: p.played_at || null, partidos: [] }; grupos.push(g) }
    g.partidos.push(p)
  })
  const etiquetaDia = fecha => {
    if (!fecha) return { titulo: 'Por programar', sub: 'Sin fecha asignada', marca: null }
    const d = new Date(fecha)
    const dia = new Date(d); dia.setHours(0, 0, 0, 0)
    const diff = Math.round((dia - inicioHoy) / 86400000)
    const titulo = d.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })
    if (diff === 0) return { titulo, sub: null, marca: { txt: 'HOY', bg: '#1e8e3e', color: '#fff' } }
    if (diff === 1) return { titulo, sub: null, marca: { txt: 'MAÑANA', bg: '#fff', color: '#1a56db' } }
    if (diff < 0)   return { titulo, sub: 'Pasó la fecha y no tiene resultado', marca: { txt: 'SIN JUGAR', bg: '#fbbc04', color: '#3c2a00' } }
    return { titulo, sub: null, marca: null }
  }
  const escudo = { width: '46px', height: '46px', borderRadius: '10px', overflow: 'hidden', background: '#fff', padding: '3px', boxSizing: 'border-box', boxShadow: '0 3px 8px rgba(0,0,0,.3)', flexShrink: 0, cursor: 'pointer' }
  const nombre = (n, alinear) => ({ flex: 1, minWidth: 0, textAlign: alinear, fontWeight: 800, textTransform: 'uppercase', color: '#14213d', fontSize: tamNombreEquipo(n), lineHeight: 1.15, wordBreak: 'break-word', cursor: 'pointer', padding: '0 4px' })
  return (
    <div>
      <div style={{ fontWeight: '800', fontSize: '.85rem', color: '#3c4043', letterSpacing: '.04em', textTransform: 'uppercase', marginBottom: '4px', paddingLeft: '2px' }}>Próximos partidos</div>
      <div style={{ fontSize: '.72rem', color: '#80868b', marginBottom: '14px', paddingLeft: '2px' }}>👆 Toca un equipo para ver sus jugadores registrados</div>
      {ordenados.length === 0 ? (
        <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '14px', boxShadow: '0 1px 4px rgba(0,0,0,.06)', padding: '40px', textAlign: 'center', color: '#9aa0a6' }}>No hay partidos programados</div>
      ) : grupos.map(g => {
        const et = etiquetaDia(g.fecha)
        return (
          <div key={g.k} style={{ marginBottom: '22px', borderRadius: '16px', overflow: 'hidden', background: 'linear-gradient(160deg, var(--color-secundario) 0%, var(--color-primario) 85%)', boxShadow: '0 6px 16px rgba(0,0,0,.18)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap', padding: '12px 14px', background: 'rgba(255,255,255,.16)' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ color: '#fff', fontWeight: '900', fontSize: '1rem', letterSpacing: '.03em', textTransform: 'uppercase', lineHeight: 1.2 }}>{et.titulo}</div>
                <div style={{ color: 'rgba(255,255,255,.82)', fontSize: '.7rem', marginTop: '2px' }}>{g.partidos.length} {g.partidos.length === 1 ? 'partido' : 'partidos'}{et.sub ? ` · ${et.sub}` : ''}</div>
              </div>
              {et.marca && <span style={{ fontSize: '.68rem', fontWeight: '900', letterSpacing: '.06em', background: et.marca.bg, color: et.marca.color, borderRadius: '8px', padding: '4px 10px', flexShrink: 0 }}>{et.marca.txt}</span>}
            </div>
            <div style={{ padding: '16px 12px 4px' }}>
              {g.partidos.map(p => {
                const detalle = [p.location, p.matchday ? `Jornada ${p.matchday}` : null, p.fase && p.fase !== 'grupo' ? FASE_LABEL[p.fase] : null].filter(Boolean).join(' · ')
                return (
                  <div key={p.id} style={{ marginBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <div onClick={() => abrirRoster({ id: p.home_team_id, name: p.home?.name, logo_url: p.home?.logo_url })} style={escudo}>
                        <TeamLogo logo_url={p.home?.logo_url} name={p.home?.name} size={40}/>
                      </div>
                      <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', background: '#fff', minHeight: '46px', padding: '0 4px' }}>
                        <div onClick={() => abrirRoster({ id: p.home_team_id, name: p.home?.name, logo_url: p.home?.logo_url })} style={nombre(p.home?.name, 'right')}>{p.home?.name}</div>
                        <div style={{ flexShrink: 0, width: '30px', height: '30px', margin: '0 2px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-primario)', color: '#fff', fontWeight: '900', fontSize: '.62rem', borderRadius: '50%' }}>VS</div>
                        <div onClick={() => abrirRoster({ id: p.away_team_id, name: p.away?.name, logo_url: p.away?.logo_url })} style={nombre(p.away?.name, 'left')}>{p.away?.name}</div>
                      </div>
                      <div onClick={() => abrirRoster({ id: p.away_team_id, name: p.away?.name, logo_url: p.away?.logo_url })} style={escudo}>
                        <TeamLogo logo_url={p.away?.logo_url} name={p.away?.name} size={40}/>
                      </div>
                    </div>
                    <div style={{ textAlign: 'center', marginTop: '7px' }}>
                      <span style={{ display: 'inline-block', background: 'rgba(255,255,255,.95)', color: '#14213d', fontWeight: '800', fontSize: '.78rem', letterSpacing: '.03em', borderRadius: '6px', padding: '3px 14px' }}>{p.played_at ? fmtHoraDate(p.played_at) : 'Hora por definir'}</span>
                      {esIntergrupo(p) && <div style={{ marginTop: '5px' }}><span title="Partido entre equipos de grupos distintos: cuenta para la tabla de cada grupo y la general" style={{ display: 'inline-block', fontSize: '.6rem', fontWeight: '900', letterSpacing: '.06em', background: '#f9c400', color: '#1a1a1a', borderRadius: '6px', padding: '2px 8px' }}>INTERGRUPO</span></div>}
                      {detalle && <div style={{ fontSize: '.7rem', color: 'rgba(255,255,255,.85)', marginTop: '4px' }}>{detalle}</div>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// Hace cuánto es la copia que se está mostrando, en palabras
function haceCuanto(ms) {
  if (!ms) return 'antes'
  const min = Math.round((Date.now() - ms) / 60000)
  if (min < 2) return 'hace un momento'
  if (min < 60) return `hace ${min} minutos`
  const h = Math.round(min / 60)
  if (h < 24) return h === 1 ? 'hace 1 hora' : `hace ${h} horas`
  const d = Math.round(h / 24)
  return d === 1 ? 'ayer' : `hace ${d} días`
}

// Aviso de "estás viendo datos de antes". Mientras llegan los frescos solo aparece si tardan (con buena
// señal no alcanza a verse); si no hay señal queda fijo, con botón para reintentar.
function AvisoFrescura({ frescura, onReintentar }) {
  const [tarda, setTarda] = useState(0) // 0 = aún no se muestra · 1 = "Actualizando…" · 2 = "la señal está lenta"
  useEffect(() => {
    setTarda(0)
    if (frescura.estado !== 'actualizando') return
    const a = setTimeout(() => setTarda(1), 1500)
    const b = setTimeout(() => setTarda(2), 10000)
    return () => { clearTimeout(a); clearTimeout(b) }
  }, [frescura.estado])

  const { estado, desde } = frescura
  if (estado === 'fresco' || (estado === 'actualizando' && tarda === 0)) return null
  const alerta = estado !== 'actualizando' || tarda === 2
  const texto = estado === 'actualizando'
    ? (tarda === 2 ? `La señal está lenta. Estás viendo los datos de ${haceCuanto(desde)}.` : `Actualizando… estás viendo los datos de ${haceCuanto(desde)}.`)
    : estado === 'viejo'
      ? `Sin conexión. Estás viendo los datos de ${haceCuanto(desde)}: puede faltar lo más reciente.`
      : 'No se pudieron cargar todos los datos. Puede faltar información.'
  return (
    <div role="status" style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '14px', padding: '12px 14px', borderRadius: '14px', fontFamily: 'system-ui,-apple-system,"Segoe UI",Roboto,sans-serif',
      background: alerta ? '#fff7e0' : '#eef4ff', border: `1px solid ${alerta ? '#f0c04a' : '#c7d7fe'}`, color: alerta ? '#6b4200' : '#1e3a8a' }}>
      {estado === 'actualizando' && <span aria-hidden="true" style={{ width: '18px', height: '18px', borderRadius: '50%', border: '2.5px solid currentColor', borderTopColor: 'transparent', animation: 'gmSpin .8s linear infinite', flexShrink: 0 }}/>}
      <span style={{ flex: 1, minWidth: '180px', fontSize: '.95rem', fontWeight: 700, lineHeight: 1.4 }}>{texto}</span>
      {alerta && (
        <button type="button" onClick={onReintentar}
          style={{ minHeight: '42px', padding: '0 18px', borderRadius: '12px', border: 'none', background: '#6b4200', color: '#fff', fontWeight: 800, fontSize: '.95rem', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
          Reintentar
        </button>
      )}
    </div>
  )
}

export default function TorneoPublicoPage({ tournamentId } = {}) {
  const params = useParams()
  const id = tournamentId || params.id
  const navigate = useNavigate()

  const [torneo,    setTorneo]    = useState(null)
  const [ediciones, setEdiciones] = useState([]) // otras ediciones de este mismo torneo (hermanas)
  const [campeonVigente, setCampeonVigente] = useState(null) // campeón de la edición más reciente que ya tenga uno guardado
  const [equipos,   setEquipos]   = useState([])
  const [partidos,  setPartidos]  = useState([])
  // Descuentos de puntos del torneo (sanciones): se suman a la tabla con su motivo.
  const [descuentos, setDescuentos] = useState([])
  useEffect(() => {
    if (!torneo?.id) return undefined
    let vivo = true
    cargarDescuentos(torneo.id).then(d => { if (vivo) setDescuentos(d) })
    return () => { vivo = false }
  }, [torneo?.id])
  const [goleadores, setGoleadores] = useState([])
  const [porteros,  setPorteros]  = useState([]) // { team_id, id, name, photo_url, photo_face_url }
  const [grupos,       setGrupos]       = useState([])
  const [grupoEquipos, setGrupoEquipos] = useState([])
  const [bracket,   setBracket]   = useState([]) // partidos de eliminatorias (todas las fases), para el árbol público
  const [sponsors,  setSponsors]  = useState([])
  const [loading,   setLoading]   = useState(true)
  const [datosListos, setDatosListos] = useState(false) // llegaron los datos; la pantalla de carga termina de llenarse y suelta
  // ¿Lo que se ve es de AHORA o es la copia guardada? 'fresco' | 'actualizando' | 'viejo' (no hubo señal) | 'incompleto'
  const [frescura,  setFrescura]  = useState({ estado: 'fresco', desde: null })
  const [intento,   setIntento]   = useState(0)     // sube para volver a pedir los datos (botón Reintentar, vuelve la señal, se reabre la app)
  const [errorCarga, setErrorCarga] = useState(false) // no hay copia guardada y tampoco hubo señal
  const idCargado = useRef(null)
  const ultimaBuena = useRef(null)                   // cuándo llegaron datos frescos por última vez
  const [tab,       setTab]       = useState('posiciones')
  // Partidos en vivo de ESTE torneo — antes esto solo existía en la página
  // de inicio de Golmebol (golmebol.com), así que en el dominio propio de un
  // organizador (ej. centegol.com) un partido que se está jugando ahora
  // mismo no se veía en ningún lado. Reusa el mismo snapshot en vivo
  // (matches.live_state / live_state_rapida) que ya sube la planilla del
  // árbitro, y la suscripción realtime de más abajo (fetchPartidos) ya
  // mantiene "partidos" al día solo, sin necesidad de otro polling.
  const [tick, setTick] = useState(0)
  const [detalleVivoId, setDetalleVivoId] = useState(null)
  useEffect(() => {
    const t = setInterval(() => setTick(x => x + 1), 1000)
    return () => clearInterval(t)
  }, [])
  const partidosVivo = useMemo(() => {
    void tick
    return partidos.map(m => ({ ...m, vivo: derivarEnVivo(m) })).filter(m => m.vivo).map(m => {
      // Ida y vuelta: si el hermano de la llave ya se jugó, se le pega acá
      // para poder mostrar "Ida / Vuelta (en vivo) / Global" — nunca en fase
      // de grupos, ahí cada partido cuenta aparte.
      if (!m.fase || m.fase === 'grupo') return m
      const hermano = buscarPartidoHermano(m, partidos)
      if (!hermano || hermano.status !== 'finished') return m
      const invertido = hermano.home_team_id === m.away_team_id
      const idaLocal      = invertido ? (hermano.away_score || 0) : (hermano.home_score || 0)
      const idaVisitante  = invertido ? (hermano.home_score || 0) : (hermano.away_score || 0)
      return { ...m, hermano, idaLocal, idaVisitante, global: marcadorGlobal(m, hermano) }
    })
  }, [partidos, tick])

  // En vivo: apenas el árbitro/admin carga un resultado o se crea un partido
  // nuevo (ej. al avanzar de ronda), esta página pública se actualiza sola,
  // sin que el visitante tenga que recargar.
  const refetchTimer = useRef(null)
  useEffect(() => {
    if (!id) return
    const channel = supabase
      .channel(`publico-torneo-${id}-matches`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches', filter: `tournament_id=eq.${id}` }, () => {
        clearTimeout(refetchTimer.current)
        refetchTimer.current = setTimeout(() => { fetchPartidos() }, 600)
      })
      .subscribe()
    return () => { clearTimeout(refetchTimer.current); supabase.removeChannel(channel) }
  }, [id])

  // Un solo viaje a la base: el árbol de eliminatorias sale de estos mismos
  // partidos (antes se pedía aparte, descargando otra vez los partidos de
  // llaves con todas sus columnas).
  async function fetchPartidos() {
    const data = await traerPartidosTorneo(id)
    setPartidos(data)
    setBracket(derivarBracket(data))
  }

  // Agrupa los partidos del bracket en llaves por fase, con marcador global y ganador
  function getLlavesPorFaseElim() {
    const porFase = {}
    FASE_ORDEN_ELIM.forEach(f => {
      const ms = bracket.filter(p => p.fase === f)
      if (ms.length === 0) return
      const map = {}
      ms.forEach(m => {
        const key = [m.home_team_id, m.away_team_id].sort().join('|')
        if (!map[key]) map[key] = []
        map[key].push(m)
      })
      porFase[f] = Object.values(map).map(matches => {
        const primero = matches[0]
        const teamA = { id: primero.home_team_id, name: primero.home?.name, logo_url: primero.home?.logo_url }
        const teamB = { id: primero.away_team_id, name: primero.away?.name, logo_url: primero.away?.logo_url }
        const terminada = matches.every(m => m.status === 'finished')
        let golesA = 0, golesB = 0
        matches.forEach(m => {
          if (m.status !== 'finished') return
          if (m.home_team_id === teamA.id) { golesA += m.home_score || 0; golesB += m.away_score || 0 }
          else                             { golesA += m.away_score || 0; golesB += m.home_score || 0 }
        })
        let ganador = null, porPenales = false
        if (terminada) {
          if (golesA > golesB) ganador = teamA
          else if (golesB > golesA) ganador = teamB
          else {
            const conPenales = [...matches].reverse().find(m => m.penales_ganador || (m.penales_local != null && m.penales_visitante != null && m.penales_local !== m.penales_visitante))
            if (conPenales) {
              porPenales = true
              const ganaHome = conPenales.penales_ganador ? conPenales.penales_ganador === 'home' : conPenales.penales_local > conPenales.penales_visitante
              const idGanador = ganaHome ? conPenales.home_team_id : conPenales.away_team_id
              ganador = idGanador === teamA.id ? teamA : teamB
            }
          }
        }
        return { matches, teamA, teamB, golesA, golesB, terminada, ganador, porPenales, slotIndex: primero.slot_index }
      })
      // Mismo orden de casillas que usa el admin (0, 1, 2...) — la llave i
      // de esta fase corresponde a ganador(2i) vs ganador(2i+1) de la fase
      // anterior. Partidos viejos sin slot_index quedan al final.
      porFase[f].sort((a, b) => (a.slotIndex ?? 999) - (b.slotIndex ?? 999))
    })
    return porFase
  }

  // Planilla de jugadores registrados de un equipo (foto + nombre grande) —
  // se abre al tocar un equipo en la programación, para que el rival pueda
  // verificar en cancha quién sí está inscrito y reportar si alguien juega
  // sin aparecer en esta lista.
  const [rosterModal, setRosterModal] = useState(null) // { team, jugadores, loading }
  const [partidoDetalle, setPartidoDetalle] = useState(null) // partido (de Resultados) del que se está viendo el resumen (goles/tarjetas)

  useEffect(() => { registrarVisita('torneo_publico', id) }, [id])

  // Entró desde un aviso (/t/<torneo>?partido=<id>): abre directo lo que el aviso anunciaba.
  // Resultado final -> el resumen minuto a minuto (goles y tarjetas); en vivo -> el detalle en vivo;
  // partido nuevo / cambio / recordatorio -> la pestaña de próximos partidos.
  const ubicacion = useLocation()
  const partidoDelAviso = new URLSearchParams(ubicacion.search).get('partido')
  const avisoAtendido = useRef(null)
  useEffect(() => {
    if (!partidoDelAviso || avisoAtendido.current === partidoDelAviso || !partidos.length) return
    const m = partidos.find(p => String(p.id) === partidoDelAviso)
    if (!m) return
    avisoAtendido.current = partidoDelAviso
    if (m.status === 'finished') { setTab('resultados'); setPartidoDetalle(m) }
    else if (derivarEnVivo(m)) setDetalleVivoId(m.id)
    else setTab('proximos')
  }, [partidoDelAviso, partidos])

  // Favicon dinámico del torneo (no se revierte al salir)
  // En un dominio propio (ej. centegol.com) el título y el ícono son SIEMPRE los del
  // torneo (si no tiene favicon, se usa su logo), nunca los de Golmebol.
  useEffect(() => {
    if (!torneo) return
    const propio = esHostPropioGolmebol()
    const icono = torneo.favicon_url || (propio ? null : torneo.logo_url)
    aplicarMarcaPagina({ titulo: propio ? null : torneo.name, iconoUrl: icono })
  }, [torneo?.favicon_url, torneo?.logo_url, torneo?.name])

  // Plantillas de todos los equipos del torneo, ya cargadas en segundo plano:
  // al tocar un equipo se muestran al instante. Si aún no llegaron, se pide solo ese equipo.
  const rostersRef = useRef({ listos: false, fresco: false, porEquipo: {} })

  async function abrirRoster(team, stats) {
    if (!team?.id) return
    const pre = rostersRef.current
    // Con la copia guardada solo se usa el equipo si ya estaba en ella (un equipo nuevo se pide aparte)
    if (pre.listos && (pre.fresco || pre.porEquipo[team.id])) {
      setRosterModal({ team, jugadores: pre.porEquipo[team.id] || [], loading: false, stats })
      return
    }
    setRosterModal({ team, jugadores: [], loading: true, stats })
    try {
      const jugadores = await cargarRosterEquipo(id, team.id)
      setRosterModal(prev => (prev && prev.team?.id === team.id ? { team, jugadores, loading: false, stats } : prev))
    } catch (e) {
      console.error('No se pudo cargar la plantilla:', e)
      setRosterModal(prev => (prev && prev.team?.id === team.id ? { team, jugadores: [], loading: false, stats, error: true } : prev))
    }
  }

  // Al tocar un equipo en la tabla de posiciones: misma ficha de siempre
  // (RosterModal), pero además con sus estadísticas del torneo (PJ/PG/PE/
  // PP/GF/GC/PTS) y ciudad/categoría — así "ver info del equipo" desde la
  // tabla muestra algo más completo que solo la lista de jugadores.
  function abrirEquipoInfo(row) {
    abrirRoster(row.equipo, { pj: row.pj, pg: row.pg, pe: row.pe, pp: row.pp, gf: row.gf, gc: row.gc, pts: row.pts })
  }

  function aplicarBaseTorneo(d) {
    setTorneo(d.t)
    setEquipos(d.equipos)
    setPartidos(d.partidos)
    setBracket(derivarBracket(d.partidos))
    if (d.goleadores !== undefined) setGoleadores(d.goleadores)
    if (d.sponsors !== undefined) setSponsors(d.sponsors)
    setGrupos(d.grupos)
    setGrupoEquipos(d.grupoEquipos)
  }

  // Copia de lo último visto de ESTE torneo: se pinta antes del primer
  // fotograma (useLayoutEffect), así no hay ni un parpadeo de "Cargando...".
  useLayoutEffect(() => {
    const cache = leerCacheRapido(`torneo_${id}`)
    if (cache?.t) { aplicarBaseTorneo(cache); setDatosListos(true) } // la animación de entrada se muestra SIEMPRE; con copia guardada solo se llena más rápido
    ultimaBuena.current = null
    setErrorCarga(false)
    // Se está mostrando la copia guardada: se avisa hasta que lleguen los datos de ahora
    setFrescura(cache?.t ? { estado: 'actualizando', desde: fechaCacheRapido(`torneo_${id}`) } : { estado: 'fresco', desde: null })
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Carga rápida de la página pública: lo que se necesita para pintar la TABLA
  // y los GOLEADORES (torneo, equipos, partidos, goleadores, patrocinadores y
  // grupos) se pide TODO a la vez y la página se muestra apenas llega. Lo
  // demás (otras ediciones, campeón vigente, arqueros para la valla) se trae
  // después, en segundo plano, sin hacer esperar a nadie — antes eran ~8
  // consultas una detrás de otra y la tabla no salía hasta que terminaba la
  // última. Además se guarda una copia de lo último visto: al volver a entrar
  // se pinta al instante y los datos frescos la reemplazan enseguida.
  useEffect(() => {
    let cancelado = false
    const claveCache = `torneo_${id}`
    const copiaRoster = leerCacheRapido(`roster_${id}`)
    rostersRef.current = copiaRoster ? { listos: true, fresco: false, porEquipo: copiaRoster } : { listos: false, fresco: false, porEquipo: {} }

    // Otras ediciones de este mismo torneo (para el botón "Edición N") y el
    // campeón vigente: si esta edición todavía no tiene uno propio (recién
    // empezando), se muestra el de la edición completada más reciente —
    // para que no desaparezca el campeón mientras se juega la siguiente.
    async function cargarEdiciones(t) {
      const raizId = t?.torneo_padre_id || t?.id
      if (!raizId) { setEdiciones([]); setCampeonVigente(null); return }
      let { data: edsData, error: errEds } = await supabase.from('tournaments').select('id, name, edicion, archivado, status')
        .or(`id.eq.${raizId},torneo_padre_id.eq.${raizId}`)
      if (errEds && (errEds.message || '').includes('archivado')) {
        // Falta migracion_archivar_torneos.sql: se reintenta sin esa columna
        // para que el botón de ediciones y el campeón vigente no se queden
        // sin mostrar solo por eso.
        ;({ data: edsData } = await supabase.from('tournaments').select('id, name, edicion, status')
          .or(`id.eq.${raizId},torneo_padre_id.eq.${raizId}`))
      }
      if (cancelado) return
      const edicionesList = (edsData || []).sort((a, b) => (a.edicion || 1) - (b.edicion || 1))
      setEdiciones(edicionesList)
      if (edicionesList.length <= 1) { setCampeonVigente(null); return }
      // Ojo: NO se puede pedir "teams(...)" embebido acá — tournament_logros
      // no tiene una relación declarada hacia teams en Supabase (solo hacia
      // tournaments y players), así que ese embed falla en silencio y nunca
      // llegaba ningún campeón. Se hace en dos pasos: primero el campeón
      // (team_id) de la edición más reciente que ya tenga uno, después se
      // busca ese equipo aparte.
      const { data: camps } = await supabase.from('tournament_logros')
        .select('tournament_id, team_id')
        .in('tournament_id', edicionesList.map(e => e.id)).eq('tipo', 'campeon').limit(500)
      const edMap = Object.fromEntries(edicionesList.map(e => [e.id, e.edicion || 1]))
      let mejor = null
      ;(camps || []).forEach(c => {
        if (!c.team_id) return
        const ed = edMap[c.tournament_id] || 0
        if (!mejor || ed > mejor.edicion) mejor = { edicion: ed, tournament_id: c.tournament_id, team_id: c.team_id }
      })
      if (mejor) {
        const { data: teamData } = await supabase.from('teams').select('id,name,logo_url').eq('id', mejor.team_id).maybeSingle()
        mejor.team = teamData || null
      }
      if (!cancelado) setCampeonVigente(mejor)
    }

    // Arqueros de cada equipo del torneo (para la valla menos vencida)
    async function cargarPorteros(equiposTorneo, t) {
      const teamIds = (equiposTorneo || []).map(e => e?.id).filter(Boolean)
      if (teamIds.length === 0) { setPorteros([]); return }
      const { data: tpData } = await supabase.from('team_players').select('team_id, player_id').in('team_id', teamIds)
      const hydrated = await hydratePlayersPublico(tpData || [], {
        columns: 'id, name, photo_url, photo_face_url, posicion_futbol5, posicion_futbol7, posicion_futbol11',
      })
      if (cancelado) return
      const modalidad = t?.modalidad || ''
      const campoPos = modalidad.includes('11') ? 'posicion_futbol11' : modalidad.includes('7') ? 'posicion_futbol7' : 'posicion_futbol5'
      const arqueros = hydrated
        .filter(tp => tp.players && (tp.players[campoPos] === 'Portero' || tp.players.posicion_futbol5 === 'Portero' || tp.players.posicion_futbol7 === 'Portero' || tp.players.posicion_futbol11 === 'Portero'))
        .map(tp => ({ team_id: tp.team_id, ...tp.players }))
      setPorteros(arqueros)
    }

    async function fetchAll() {
      const cache = leerCacheRapido(claveCache)
      const primeraVez = idCargado.current !== id
      idCargado.current = id
      // La animación de entrada solo al ENTRAR al torneo; un reintento actualiza sin tapar la pantalla
      if (primeraVez) { setDatosListos(!!cache?.t); setLoading(true) }
      else setFrescura(f => ({ estado: 'actualizando', desde: ultimaBuena.current || f.desde }))

      // Los datos pueden venir ya adelantados (al pasar por la tarjeta del
      // torneo en la portada) o pedirse ahora: es el mismo pedido, sin duplicar.
      let r = null
      try { r = await cargarTorneoPublico(id) } catch (e) { r = null }
      if (cancelado) return
      const fallo = !r || r.incompleto
      const hayAlgoEnPantalla = !!cache?.t || !!ultimaBuena.current
      // Sin señal y ya se estaba mostrando algo: se deja eso (no se borra) y se AVISA que es de antes.
      if (fallo && hayAlgoEnPantalla) {
        setFrescura({ estado: 'viejo', desde: ultimaBuena.current || fechaCacheRapido(claveCache) })
        setDatosListos(true)
        return
      }
      // Sin señal y sin nada guardado: pantalla de "no se pudo cargar" con botón para reintentar
      // (si el torneo de verdad no existe, la base contesta que no hay fila: eso NO es un error de señal)
      if (!r || (!r.base.t && r.errorTorneo && r.errorTorneo.code !== 'PGRST116')) {
        setErrorCarga(true); setDatosListos(true)
        return
      }
      setErrorCarga(false)
      const t = r.base.t

      // La tabla sale YA; goleadores y patrocinadores se suman cuando llegan.
      aplicarBaseTorneo({ ...r.base, goleadores: cache?.t ? undefined : [], sponsors: cache?.t ? undefined : [] })
      // El logo termina de llenarse y recién ahí se entra (siempre, haya o no copia guardada).
      setDatosListos(true)
      if (fallo) setFrescura({ estado: 'incompleto', desde: null })   // llegó el torneo pero faltó algo (p. ej. los partidos)
      else { ultimaBuena.current = Date.now(); setFrescura({ estado: 'fresco', desde: null }) }
      r.extras.then(ex => {
        if (cancelado) return
        setGoleadores(ex.goleadores)
        setSponsors(ex.sponsors)
      }).catch(() => {})

      // Segundo plano: no frena la tabla ni los goleadores.
      if (t) {
        cargarEdiciones(t).catch(() => {})
        cargarPorteros(r.base.equipos, t).catch(() => {})
        // Plantillas de todos los equipos: así abrir un equipo desde la tabla es instantáneo
        cargarRostersTorneo(id).then(porEquipo => {
          if (cancelado) return
          rostersRef.current = { listos: true, fresco: true, porEquipo }
          guardarCacheRapido(`roster_${id}`, porEquipo)
        }).catch(e => console.error('No se pudieron precargar las plantillas:', e))
      } else {
        setEdiciones([]); setCampeonVigente(null); setPorteros([])
      }
    }
    fetchAll()
    return () => { cancelado = true }
  }, [id, intento])

  // Si quedó mostrando datos de antes (o no cargó), se vuelve a intentar solo: cuando vuelve la señal
  // y cada 20 segundos (hasta 6 veces). También al reabrir la app después de un rato, por si quedó vieja.
  const reintentos = useRef(0)
  useEffect(() => { reintentos.current = 0 }, [id])
  useEffect(() => {
    const pendiente = errorCarga || frescura.estado === 'viejo' || frescura.estado === 'incompleto'
    const otraVez = () => setIntento(n => n + 1)
    let reloj = null
    if (pendiente) {
      window.addEventListener('online', otraVez)
      if (reintentos.current < 6) reloj = setTimeout(() => { reintentos.current++; otraVez() }, 20000)
    }
    let ocultoDesde = null
    const alVolver = () => {
      if (document.visibilityState === 'hidden') { ocultoDesde = Date.now(); return }
      if (pendiente || (ocultoDesde && Date.now() - ocultoDesde > 60000)) { reintentos.current = 0; otraVez() }
      ocultoDesde = null
    }
    document.addEventListener('visibilitychange', alVolver)
    return () => { window.removeEventListener('online', otraVez); clearTimeout(reloj); document.removeEventListener('visibilitychange', alVolver) }
  }, [frescura.estado, errorCarga])

  if (loading) return <PantallaCargaTorneo key={id} id={id} listo={datosListos} onTerminar={() => setLoading(false)}/>

  if (!torneo) return (
    <div style={{ minHeight: '100vh', background: '#07070e', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', padding: '24px', textAlign: 'center', color: '#c9c9c9', fontFamily: 'system-ui' }}>
      {errorCarga ? (
        <>
          <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#fff' }}>No se pudo cargar el torneo</div>
          <div style={{ fontSize: '1rem', lineHeight: 1.5, maxWidth: '320px' }}>Parece que no hay señal o está muy lenta. Revisa tu internet y vuelve a intentar.</div>
          <button type="button" onClick={() => setIntento(n => n + 1)}
            style={{ minHeight: '52px', padding: '0 28px', border: 'none', borderRadius: '14px', background: '#6fcf3d', color: '#0a1a05', fontWeight: 900, fontSize: '1.05rem', cursor: 'pointer', fontFamily: 'inherit' }}>
            Reintentar
          </button>
        </>
      ) : 'Torneo no encontrado'}
    </div>
  )

  const partidosJugados    = partidos.filter(p => p.status === 'finished').slice().reverse()
  const partidosPendientes = partidos.filter(p => p.status !== 'finished')

  // Tabla de posiciones
  const P = getPuntosTorneo(torneo)
  const tablaOrdenada = computeTablaGeneral(equipos, partidos, { ...torneo, descuentos })
  // Goleadores con los goles del partido en vivo sumados encima (ver
  // mergeGoleadoresConVivo) — así el ranking también se actualiza solo
  // mientras el árbitro va llenando la planilla, sin esperar el guardado final.
  const goleadoresConVivo = mergeGoleadoresConVivo(goleadores, partidos, equipos)

  // Tabla de un grupo específico — solo cuenta partidos entre equipos de ese
  // mismo grupo en fase de grupos (misma lógica que usa el jugador/admin).
  const esIntergrupo = crearDetectorIntergrupo(grupoEquipos) // partido entre equipos de grupos distintos → etiqueta INTERGRUPO
  function getTablaGrupo(grupoId) {
    const eqIds = grupoEquipos.filter(ge => ge.grupo_id === grupoId).map(ge => ge.team_id)
    const partGrupo = conMarcadorEnVivo(partidos).filter(p => (!p.fase || p.fase === 'grupo') && (eqIds.includes(p.home_team_id) || eqIds.includes(p.away_team_id)))
    const t = {}
    eqIds.forEach(eid => {
      const eq = equipos.find(e => e.id === eid)
      if (eq) t[eid] = { equipo: eq, pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, pts: 0 }
    })
    partGrupo.filter(p => p.status === 'finished').forEach(p => {
      if (t[p.home_team_id]) {
        if (p._enVivo) t[p.home_team_id].enVivo = enVivoDe(p, true, t[p.away_team_id]?.equipo?.name)
        t[p.home_team_id].pj++; t[p.home_team_id].gf += p.home_score || 0; t[p.home_team_id].gc += p.away_score || 0
        if (p.home_score > p.away_score) { t[p.home_team_id].pg++; t[p.home_team_id].pts += puntosVictoria(P, p) }
        else if (p.home_score === p.away_score) { t[p.home_team_id].pe++; t[p.home_team_id].pts += P.empate }
        else { t[p.home_team_id].pp++; t[p.home_team_id].pts += P.derrota }
      }
      if (t[p.away_team_id]) {
        if (p._enVivo) t[p.away_team_id].enVivo = enVivoDe(p, false, t[p.home_team_id]?.equipo?.name)
        t[p.away_team_id].pj++; t[p.away_team_id].gf += p.away_score || 0; t[p.away_team_id].gc += p.home_score || 0
        if (p.away_score > p.home_score) { t[p.away_team_id].pg++; t[p.away_team_id].pts += puntosVictoria(P, p) }
        else if (p.away_score === p.home_score) { t[p.away_team_id].pe++; t[p.away_team_id].pts += P.empate }
        else { t[p.away_team_id].pp++; t[p.away_team_id].pts += P.derrota }
      }
    })
    return agregarForma(aplicarDescuentos(Object.values(t), descuentos).sort(compararPosiciones), partGrupo)
  }

  // Valla menos vencida GLOBAL por equipo: ranking por goles en contra, con
  // los arqueros registrados de cada equipo (fotos y nombres). A diferencia
  // de la tabla de posiciones (que en fase de grupos ya no cuenta partidos
  // de eliminación directa), acá los goles en contra deben seguir sumando
  // aunque el torneo ya esté en eliminatorias.
  const vallaEquipos = computeVallaEquipos(equipos, partidos, porteros).map(row => ({
    ...row,
    arqueros: row.arqueros.map(p => ({ name: p.name, foto: p.photo_face_url || p.photo_url })),
  }))

  // Equipos eliminados (para marcarlos en rojo en las tablas) y contra quién juegan
  // ahora. NO se muestra árbol: solo los partidos creados (Resultados / Próximos).
  // Eliminado = perdió su llave ya terminada, o no entró al primer cruce de eliminatorias
  // (solo si ese cruce ya está completo). Los que juegan final o tercer puesto no se marcan.
  const MEJORES_PERDEDORES = 2 // cuántos "mejores perdedores" se marcan cuando termina una fase
  const { eliminadosIds, rivalDe, mejoresPerdedores } = (() => {
    const elim = new Set(), rival = {}, mejores = {}
    if (bracket.length === 0) return { eliminadosIds: elim, rivalDe: rival, mejoresPerdedores: mejores }
    const porFase = getLlavesPorFaseElim()
    const esTercer = ll => (ll.matches[0].ronda || '').toLowerCase().includes('tercer')
    const enTercer = new Set(), enBracket = new Set()
    FASE_ORDEN_ELIM.forEach(f => (porFase[f] || []).forEach(ll => {
      enBracket.add(ll.teamA.id); enBracket.add(ll.teamB.id)
      if (esTercer(ll)) { enTercer.add(ll.teamA.id); enTercer.add(ll.teamB.id) }
    }))
    const perdedoresPorFase = {}
    FASE_ORDEN_ELIM.forEach(f => (porFase[f] || []).forEach(ll => {
      if (f === 'final' || esTercer(ll) || !ll.terminada || !ll.ganador) return
      const gano = ll.ganador.id === ll.teamA.id
      const perdedor = gano ? ll.teamB : ll.teamA
      if (enTercer.has(perdedor.id)) return
      elim.add(perdedor.id)
      const gfP = gano ? ll.golesB : ll.golesA
      const gfG = gano ? ll.golesA : ll.golesB
      ;(perdedoresPorFase[f] = perdedoresPorFase[f] || []).push({ id: perdedor.id, dif: Math.max(0, gfG - gfP), gf: gfP })
    }))
    const primera = FASE_ORDEN_ELIM.find(f => porFase[f])
    const esperadas = { octavos: 8, cuartos: 4, semifinal: 2, final: 1 }
    if (primera && porFase[primera].filter(ll => !esTercer(ll)).length >= esperadas[primera]) {
      equipos.forEach(eq => { if (!enBracket.has(eq.id)) elim.add(eq.id) })
    }
    bracket.forEach(m => {
      if (m.status === 'finished' || !m.home_team_id || !m.away_team_id) return
      elim.delete(m.home_team_id); elim.delete(m.away_team_id)
      if (!rival[m.home_team_id]) rival[m.home_team_id] = m.away?.name || null
      if (!rival[m.away_team_id]) rival[m.away_team_id] = m.home?.name || null
    })
    // Mejores perdedores de la última fase ya terminada (todas sus llaves jugadas):
    // 1) perdió con menos diferencia de gol, 2) hizo más goles, 3) está más arriba en la tabla general.
    const faseTerminada = f => (porFase[f] || []).filter(ll => !esTercer(ll)).every(ll => ll.terminada && ll.ganador)
    const ultimaFase = ['octavos', 'cuartos', 'semifinal'].filter(f => porFase[f] && faseTerminada(f)).pop()
    if (ultimaFase && perdedoresPorFase[ultimaFase]) {
      const puestoGeneral = {}
      tablaOrdenada.forEach((r, i) => { puestoGeneral[r.equipo.id] = i })
      perdedoresPorFase[ultimaFase]
        .filter(x => elim.has(x.id))
        .sort((a, b) => a.dif - b.dif || b.gf - a.gf || (puestoGeneral[a.id] ?? 999) - (puestoGeneral[b.id] ?? 999))
        .slice(0, MEJORES_PERDEDORES)
        .forEach((x, i) => { mejores[x.id] = { puesto: i + 1, dif: x.dif, gf: x.gf } })
    }
    return { eliminadosIds: elim, rivalDe: rival, mejoresPerdedores: mejores }
  })()

  // Pestañas: ya no hay árbol de eliminatorias, solo los partidos creados.
  const tabs = [
    { id: 'posiciones', label: 'Posiciones' },
    { id: 'resultados', label: 'Resultados' },
    { id: 'proximos',   label: 'Próximos' },
    { id: 'goleadores', label: 'Goleadores' },
    ...(sponsors.length > 0 ? [{ id: 'patrocinadores', label: 'Patrocinadores' }] : []),
  ]

  const colorPrimario   = torneo.color_primario   || '#1a73e8'
  const colorSecundario = torneo.color_secundario || '#1a237e'

  const s = {
    page: {
      minHeight: '100vh', background: '#f4f6fb', fontFamily: 'system-ui, sans-serif',
      ['--color-primario']: colorPrimario,
      ['--color-secundario']: colorSecundario,
    },
    header: {
      background: 'linear-gradient(135deg, var(--color-secundario) 0%, var(--color-primario) 60%, #00bcd4 100%)',
      padding: '0',
      position: 'relative',
      overflow: 'hidden',
    },
    headerInner: { maxWidth: '720px', margin: '0 auto', padding: '32px 20px 24px', position: 'relative', zIndex: 1 },
    body: { maxWidth: '720px', margin: '0 auto', padding: '24px 16px' },
    tabBar: { display: 'flex', gap: '4px', marginBottom: '20px', background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', padding: '4px', boxShadow: '0 1px 4px rgba(0,0,0,.06)', overflowX: 'auto' },
    card: { background: '#fff', border: '1px solid #e8eaed', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,.06)', marginBottom: '16px' },
    cardTitle: { padding: '14px 18px', fontWeight: '700', fontSize: '.85rem', color: '#3c4043', borderBottom: '1px solid #f1f3f4', background: '#fafbfc', letterSpacing: '.04em', textTransform: 'uppercase' },
  }

  return (
    <div style={s.page}>
      {/* HEADER */}
      <div style={s.header}>
        <div style={{ position: 'absolute', inset: 0, opacity: .07, backgroundImage: 'radial-gradient(circle at 20% 50%, #fff 1px, transparent 1px), radial-gradient(circle at 80% 20%, #fff 1px, transparent 1px)', backgroundSize: '40px 40px' }}/>
        <div style={s.headerInner}>
          {/* Volver al inicio de Golmebol — solo en golmebol.com (en el dominio propio
              de un organizador "/" ya es su propia página y no hay inicio de Golmebol). */}
          {esHostPropioGolmebol() && (
            <button onClick={() => navigate('/')} aria-label="Volver al inicio de Golmebol"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginBottom: '16px', padding: '7px 14px 7px 10px', borderRadius: '999px', border: '1px solid rgba(255,255,255,.35)', background: 'rgba(255,255,255,.16)', color: '#fff', fontSize: '.8rem', fontWeight: 700, cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}>
              <ArrowLeft size={16}/> Inicio
            </button>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div style={{ width: '72px', height: '72px', borderRadius: '16px', background: 'rgba(255,255,255,.18)', border: '2px solid rgba(255,255,255,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
              {torneo.logo_url
                ? <img src={urlMini(torneo.logo_url, 112)} onError={alFallarMini} alt="logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }}/>
                : <Trophy size={36} color="#fff"/>}
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '800', color: '#fff', lineHeight: 1.2 }}>{torneo.name}</h1>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
                {torneo.modalidad && <span style={{ fontSize: '.8rem', background: 'rgba(255,255,255,.22)', color: '#fff', borderRadius: '20px', padding: '3px 12px', fontWeight: '600' }}>{torneo.modalidad}</span>}
                {torneo.genero    && <span style={{ fontSize: '.8rem', background: 'rgba(255,255,255,.15)', color: '#fff', borderRadius: '20px', padding: '3px 12px' }}>{torneo.genero}</span>}
                {torneo.categoria && <span style={{ fontSize: '.8rem', background: 'rgba(255,255,255,.15)', color: '#fff', borderRadius: '20px', padding: '3px 12px' }}>{torneo.categoria}</span>}
                {torneo.city      && <span style={{ fontSize: '.8rem', color: 'rgba(255,255,255,.8)', display: 'flex', alignItems: 'center', gap: '4px' }}><MapPin size={12}/>{torneo.city}</span>}
                {torneo.season    && <span style={{ fontSize: '.8rem', color: 'rgba(255,255,255,.8)', display: 'flex', alignItems: 'center', gap: '4px' }}><Calendar size={12}/>{/^\d+$/.test(String(torneo.season).trim()) ? `Temporada ${String(torneo.season).trim()}` : torneo.season}</span>}
              </div>
              {ediciones.length > 1 && (
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center', marginTop: '9px' }}>
                  <span style={{ fontSize: '.68rem', color: 'rgba(255,255,255,.65)' }}>Ediciones:</span>
                  {ediciones.map(e => (
                    <button key={e.id} onClick={() => e.id !== torneo.id && navigate(`/t/${e.id}`)}
                      title={e.name}
                      style={{ border: 'none', borderRadius: '20px', padding: '2px 10px', fontSize: '.7rem', fontWeight: '700', cursor: e.id === torneo.id ? 'default' : 'pointer',
                        background: e.id === torneo.id ? '#fff' : 'rgba(255,255,255,.18)', color: e.id === torneo.id ? 'var(--color-primario)' : '#fff' }}>
                      Edición {e.edicion || 1}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Avisos de este torneo: partidos nuevos, cambios y resultados */}
          <BotonAvisosTorneo torneoId={torneo.id} nombre={torneo.name} sobreColor/>

          {/* Campeón vigente — de la edición completada más reciente, aunque
              se esté jugando una edición nueva que todavía no tiene resultados */}
          {campeonVigente?.team && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '16px', background: 'rgba(255,255,255,.14)', border: '1px solid rgba(255,255,255,.25)', borderRadius: '12px', padding: '9px 14px', width: 'fit-content' }}>
              <span style={{ fontSize: '1.3rem' }}>🏆</span>
              <div style={{ width: '30px', height: '30px', borderRadius: '8px', overflow: 'hidden', flexShrink: 0, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {campeonVigente.team.logo_url ? <img src={urlMini(campeonVigente.team.logo_url, 48)} onError={alFallarMini} loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '2px' }}/> : <Shield size={14} color="#9aa0a6"/>}
              </div>
              <div>
                <div style={{ fontSize: '.6rem', fontWeight: '800', color: '#ffd54f', letterSpacing: '1.5px' }}>
                  CAMPEÓN VIGENTE{campeonVigente.tournament_id !== torneo.id ? ` · EDICIÓN ${campeonVigente.edicion}` : ''}
                </div>
                <div style={{ fontWeight: '800', color: '#fff', fontSize: '.85rem' }}>{campeonVigente.team.name}</div>
              </div>
            </div>
          )}

          {/* Stats rápidas */}
          <div style={{ display: 'flex', gap: '12px', marginTop: '20px', flexWrap: 'wrap' }}>
            {[
              { label: 'Equipos',  val: equipos.length,        color: '#fff' },
              { label: 'Partidos', val: partidos.length,        color: '#fff' },
              { label: 'Jugados',  val: partidosJugados.length, color: '#a5f3fc' },
              { label: 'Próximos', val: partidosPendientes.length, color: '#fde68a' },
            ].map(st => (
              <div key={st.label} style={{ background: 'rgba(255,255,255,.12)', borderRadius: '10px', padding: '8px 16px', textAlign: 'center', minWidth: '70px' }}>
                <div style={{ fontSize: '1.3rem', fontWeight: '800', color: st.color, lineHeight: 1 }}>{st.val}</div>
                <div style={{ fontSize: '.7rem', color: 'rgba(255,255,255,.75)', marginTop: '2px' }}>{st.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* BODY */}
      <div style={s.body}>
        <AvisoFrescura frescura={frescura} onReintentar={() => { reintentos.current = 0; setIntento(n => n + 1) }}/>
        {/* EN VIVO — partido(s) de este torneo que se están jugando ahora mismo */}
        {partidosVivo.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '12px', marginBottom: '18px' }}>
            {partidosVivo.map(m => (
              <div key={m.id} onClick={() => setDetalleVivoId(m.id)} style={{ background: '#fff', border: '1px solid #f8b4b0', borderRadius: '16px', padding: '14px', cursor: 'pointer', boxShadow: '0 2px 10px rgba(217,48,37,.08)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <span style={{ fontSize: '.65rem', fontWeight: '900', padding: '4px 9px', borderRadius: '999px', background: '#fce8e6', color: '#d93025', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#d93025', display: 'inline-block' }}/> EN VIVO
                  </span>
                  <span style={{ fontSize: '.68rem', color: '#9aa0a6', fontWeight: '700' }}>{esIntergrupo(m) ? 'Intergrupo · ' : ''}{m.matchday ? `Fecha ${m.matchday}` : m.fase && m.fase !== 'grupo' ? FASE_LABEL[m.fase] : ''}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', flex: 1, minWidth: 0 }}>
                    <div style={{ width: '34px', height: '34px', borderRadius: '8px', overflow: 'hidden' }}><TeamLogo logo_url={m.home?.logo_url} name={m.home?.name} size={34}/></div>
                    <span style={{ fontSize: '.68rem', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>{m.home?.name}</span>
                  </div>
                  <div style={{ textAlign: 'center', flexShrink: 0 }}>
                    <div style={{ fontWeight: '900', fontSize: '1.3rem', color: '#202124' }}>{m.vivo.golesLocal} - {m.vivo.golesVis}</div>
                    <div style={{ fontSize: '.6rem', color: '#d93025', fontWeight: '800', marginTop: '2px' }}>{m.vivo.descanso ? 'DESCANSO' : m.vivo.reloj}</div>
                    {m.global && <div style={{ fontSize: '.6rem', color: '#1a73e8', fontWeight: '800', marginTop: '2px' }}>Global {m.global.local}-{m.global.visitante}</div>}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', flex: 1, minWidth: 0 }}>
                    <div style={{ width: '34px', height: '34px', borderRadius: '8px', overflow: 'hidden' }}><TeamLogo logo_url={m.away?.logo_url} name={m.away?.name} size={34}/></div>
                    <span style={{ fontSize: '.68rem', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>{m.away?.name}</span>
                  </div>
                </div>
                <div style={{ textAlign: 'center', color: '#9aa0a6', fontSize: '.62rem', fontWeight: '700', marginTop: '10px' }}>Toca para ver quién anotó ⚽</div>
              </div>
            ))}
          </div>
        )}

        {/* Tab bar */}
        <div style={s.tabBar}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ flex: '1 1 auto', padding: '8px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '.82rem', fontWeight: '600', whiteSpace: 'nowrap', transition: 'all .15s', background: tab === t.id ? 'var(--color-primario)' : 'transparent', color: tab === t.id ? '#fff' : '#5f6368' }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* POSICIONES */}
        {tab === 'posiciones' && (
          grupos.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {grupos.map(g => (
                <TablaColapsable key={g.id} titulo={`Grupo ${g.nombre}`} rows={getTablaGrupo(g.id)} defaultOpen onClickEquipo={abrirEquipoInfo} clasifican={Number(torneo.equipos_clasifican) || 0} eliminados={eliminadosIds} rivales={rivalDe} mejoresPerdedores={mejoresPerdedores}/>
              ))}
              <TablaColapsable titulo="Tabla general — todos los equipos" rows={tablaOrdenada} onClickEquipo={abrirEquipoInfo} eliminados={eliminadosIds} rivales={rivalDe} mejoresPerdedores={mejoresPerdedores}/>
            </div>
          ) : (
            <TablaPosiciones titulo="Tabla de posiciones" rows={tablaOrdenada} onClickEquipo={abrirEquipoInfo} eliminados={eliminadosIds} rivales={rivalDe} mejoresPerdedores={mejoresPerdedores}/>
          )
        )}

        {/* RESULTADOS — cada partido en su propia tarjeta con degradado de
            colores del torneo (los mismos del encabezado), para que se vea
            con vida y no plano como una lista blanca de toda la vida */}
        {tab === 'resultados' && (
          <div>
            <div style={{ fontWeight: '800', fontSize: '.85rem', color: '#3c4043', letterSpacing: '.04em', textTransform: 'uppercase', marginBottom: '12px', paddingLeft: '2px' }}>Resultados</div>
            {partidosJugados.length === 0 ? (
              <div style={{ ...s.card, padding: '40px', textAlign: 'center', color: '#9aa0a6' }}>No hay resultados aún</div>
            ) : partidosJugados.map((p) => {
              const homeWin = p.home_score > p.away_score
              const awayWin = p.away_score > p.home_score
              return (
                <div key={p.id} onClick={() => setPartidoDetalle(p)} style={{
                  position: 'relative', overflow: 'hidden', borderRadius: '16px', marginBottom: '14px',
                  padding: '16px 14px 14px', cursor: 'pointer',
                  background: 'linear-gradient(135deg, var(--color-secundario) 0%, var(--color-primario) 65%, #00bcd4 130%)',
                  boxShadow: '0 6px 16px rgba(0,0,0,.18)',
                }}>
                  {/* puntitos sutiles de fondo, igual que el encabezado del torneo */}
                  <div style={{ position: 'absolute', inset: 0, opacity: .08, backgroundImage: 'radial-gradient(circle at 15% 25%, #fff 1px, transparent 1px), radial-gradient(circle at 85% 75%, #fff 1px, transparent 1px)', backgroundSize: '32px 32px', pointerEvents: 'none' }}/>
                  <div style={{ position: 'relative', zIndex: 1 }}>
                    {/* Nombre del torneo — para que salga aunque le tomen pantallazo
                        solo a la tarjeta del partido para compartirlo */}
                    <div style={{ textAlign: 'center', fontSize: '.66rem', fontWeight: '800', color: 'rgba(255,255,255,.85)', letterSpacing: '.04em', textTransform: 'uppercase', marginBottom: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>🏆 {torneo.name}</div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '14px' }}>
                      {p.matchday && <span style={{ fontSize: '.68rem', background: 'rgba(255,255,255,.18)', border: '1px solid rgba(255,255,255,.28)', color: '#fff', borderRadius: '10px', padding: '2px 9px', fontWeight: '700' }}>J{p.matchday}</span>}
                      {p.fase && p.fase !== 'grupo' && <span style={{ fontSize: '.68rem', background: 'rgba(255,255,255,.18)', border: '1px solid rgba(255,255,255,.28)', color: '#fff', borderRadius: '10px', padding: '2px 9px', fontWeight: '700' }}>{FASE_LABEL[p.fase]}</span>}
                      {esIntergrupo(p) && <span title="Partido entre equipos de grupos distintos" style={{ fontSize: '.62rem', background: '#f9c400', color: '#1a1a1a', borderRadius: '10px', padding: '2px 9px', fontWeight: '900', letterSpacing: '.05em' }}>INTERGRUPO</span>}
                      {p.played_at && <span style={{ fontSize: '.72rem', color: 'rgba(255,255,255,.8)' }}>{new Date(p.played_at).toLocaleDateString('es-CO', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}</span>}
                      {p.location && <span style={{ fontSize: '.72rem', color: 'rgba(255,255,255,.8)', display: 'flex', alignItems: 'center', gap: '3px' }}><MapPin size={10} color="rgba(255,255,255,.8)"/>{p.location}</span>}
                    </div>
                    {/* Escudos + marcador, todos alineados en la misma fila para que
                        quede parejo aunque los nombres de abajo tengan largos distintos */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: '6px' }}>
                      <div onClick={e => { e.stopPropagation(); abrirRoster({ id: p.home_team_id, name: p.home?.name, logo_url: p.home?.logo_url }) }}
                        style={{ display: 'flex', justifyContent: 'center', cursor: 'pointer' }}>
                        <div style={{ width: '50px', height: '50px', borderRadius: '12px', overflow: 'hidden', flexShrink: 0, background: '#fff', padding: '3px', boxSizing: 'border-box', boxShadow: '0 3px 10px rgba(0,0,0,.28)' }}>
                          <TeamLogo logo_url={p.home?.logo_url} name={p.home?.name} size={44}/>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '7px', background: 'rgba(255,255,255,.16)', border: '1px solid rgba(255,255,255,.3)', borderRadius: '10px', padding: '7px 14px', flexShrink: 0 }}>
                        <span style={{ fontWeight: '900', fontSize: '1.25rem', color: homeWin ? '#ffd54a' : '#fff' }}>{p.home_score}</span>
                        <span style={{ color: 'rgba(255,255,255,.5)', fontSize: '.85rem', fontWeight: '400' }}>-</span>
                        <span style={{ fontWeight: '900', fontSize: '1.25rem', color: awayWin ? '#ffd54a' : '#fff' }}>{p.away_score}</span>
                      </div>
                      <div onClick={e => { e.stopPropagation(); abrirRoster({ id: p.away_team_id, name: p.away?.name, logo_url: p.away?.logo_url }) }}
                        style={{ display: 'flex', justifyContent: 'center', cursor: 'pointer' }}>
                        <div style={{ width: '50px', height: '50px', borderRadius: '12px', overflow: 'hidden', flexShrink: 0, background: '#fff', padding: '3px', boxSizing: 'border-box', boxShadow: '0 3px 10px rgba(0,0,0,.28)' }}>
                          <TeamLogo logo_url={p.away?.logo_url} name={p.away?.name} size={44}/>
                        </div>
                      </div>
                    </div>
                    {/* Nombres debajo de cada escudo — se enchiquitan solos si son
                        largos y se parten en 2 líneas en vez de cortarse */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '6px', marginTop: '9px' }}>
                      <div style={{ textAlign: 'center', fontWeight: homeWin ? '800' : '600', color: '#fff', opacity: homeWin ? 1 : .82, fontSize: tamNombreEquipo(p.home?.name), lineHeight: 1.25, wordBreak: 'break-word', padding: '0 2px' }}>{p.home?.name}</div>
                      <div style={{ width: '1px' }}/>
                      <div style={{ textAlign: 'center', fontWeight: awayWin ? '800' : '600', color: '#fff', opacity: awayWin ? 1 : .82, fontSize: tamNombreEquipo(p.away?.name), lineHeight: 1.25, wordBreak: 'break-word', padding: '0 2px' }}>{p.away?.name}</div>
                    </div>
                    <div style={{ textAlign: 'center', marginTop: '12px' }}>
                      <span style={{ fontSize: '.64rem', color: 'rgba(255,255,255,.7)' }}>👆 Toca el partido para ver el resumen (goles y tarjetas)</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {tab === 'proximos' && <ProximosPartidos partidos={partidosPendientes} abrirRoster={abrirRoster} esIntergrupo={esIntergrupo}/>}

        {/* GOLEADORES */}
        {tab === 'goleadores' && (
          <>
          <RankingPoster
            titulo="⚽ Top goleadores"
            statLabel="goles" statColor="#ffd54a"
            vacio="Sin estadísticas aún"
            onClickFila={r => r.playerId && navigate(`/j/${r.playerId}`)}
            rows={goleadoresConVivo.map(g => ({
              id: `${g.player_id}-${g.team_id}`,
              playerId: g.player_id,
              nombre: g.player_name,
              foto: g.photo_url,
              teamName: g.team_name,
              teamLogo: g.team_logo,
              valor: g.total_goals,
              vivo: g.golesVivo || 0,
              sub: `${g.partidos_jugados} PJ${(g.total_yellow||0)>0?` · 🟨${g.total_yellow}`:''}${(g.total_red||0)>0?` · 🟥${g.total_red}`:''}`,
            }))}
          />
          <div style={{ marginTop: '16px' }}>
            <VallaEquipos rows={vallaEquipos}/>
          </div>
          </>
        )}

        {/* PATROCINADORES */}
        {tab === 'patrocinadores' && sponsors.length > 0 && (
          <div style={s.card}>
            <div style={s.cardTitle}>Patrocinadores</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '16px', padding: '20px 18px' }}>
              {sponsors.map(sp => {
                const inner = (
                  <div style={{
                    background: '#f8f9fa', border: '1px solid #e8eaed', borderRadius: '12px',
                    padding: '16px 12px', textAlign: 'center', minHeight: '110px',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px',
                    transition: 'border-color .15s',
                  }}>
                    <div style={{ width: '100%', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {sp.logo_url
                        ? <img src={sp.logo_url} alt={sp.nombre || 'Patrocinador'} style={{ maxWidth: '100%', maxHeight: '56px', objectFit: 'contain' }}/>
                        : <span style={{ fontSize: '.75rem', color: '#9aa0a6', fontWeight: '600' }}>{sp.nombre || 'Sin logo'}</span>}
                    </div>
                    {sp.nombre && (
                      <div style={{ fontSize: '.78rem', fontWeight: '700', color: '#202124', lineHeight: 1.25 }}>{sp.nombre}</div>
                    )}
                  </div>
                )
                if (sp.link) {
                  return (
                    <a key={sp.id} href={sp.link} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', color: 'inherit' }}>
                      {inner}
                    </a>
                  )
                }
                return <div key={sp.id}>{inner}</div>
              })}
            </div>
          </div>
        )}

        <div style={{ textAlign: 'center', marginTop: '24px', color: '#c4c7ca', fontSize: '.72rem' }}>
          golmebol.com
        </div>
      </div>

      <RosterModal rosterModal={rosterModal} onClose={() => setRosterModal(null)} torneoNombre={torneo.name} porJugador={torneo.finanzas_config?.inscripcion_modo === 'jugador'}
        onVerEquipo={eid => { setRosterModal(null); navigate(`/e/${eid}`) }}
        onVerJugador={jid => { setRosterModal(null); navigate(`/j/${jid}`) }}/>
      <PartidoDetalleModal key={partidoDetalle?.id || 'cerrado'} partido={partidoDetalle} torneo={torneo} onClose={() => setPartidoDetalle(null)}/>
      {detalleVivoId && partidosVivo.some(p => p.id === detalleVivoId) && <LiveMatchDetalle m={partidosVivo.find(p => p.id === detalleVivoId)} onClose={() => setDetalleVivoId(null)}/>}
    </div>
  )
}
