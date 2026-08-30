import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Trophy, MapPin, Calendar, ChevronDown, Shield, X } from 'lucide-react'
import { GiSoccerBall } from 'react-icons/gi'
import RankingPoster from '../components/RankingPoster'
import TablaPosiciones from '../components/TablaPosiciones'
import VallaEquipos from '../components/VallaEquipos'
import { registrarVisita } from '../lib/visitas'
import { getPuntosTorneo } from '../lib/puntosTorneo'
import { hydratePlayersPublico } from '../lib/playersPublico'
import { fmtHoraDate } from '../lib/horaHelpers'

// Árbol de eliminatorias, público y de solo lectura — mismo orden de fases
// que usa el admin para armar el bracket real.
const FASE_ORDEN_ELIM = ['octavos', 'cuartos', 'semifinal', 'final']
const FASE_LABEL_ELIM = { octavos: '⚔️ Octavos', cuartos: '🔥 Cuartos', semifinal: '⚡ Semifinal', final: '🏆 Final' }

// Nombre/fase de cada ronda de la VISTA PREVIA (antes de que existan
// partidos reales de eliminatorias) — misma lógica que usa el admin en
// AdminTorneoDetallePage para armar su vista previa en vivo.
function getRondaNombrePreview(total) {
  if (total === 16) return 'Octavos de final'
  if (total === 8)  return 'Cuartos de final'
  if (total === 4 || total === 3) return 'Semifinal'
  if (total === 2)  return 'Final'
  return `Ronda de ${total}`
}
function getFaseValuePreview(total) {
  if (total > 8) return 'octavos'
  if (total > 4) return 'cuartos'
  if (total > 2) return 'semifinal'
  return 'final'
}

function TeamLogo({ logo_url, name, size = 28 }) {
  const iniciales = (name || '?').split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase()
  if (logo_url) return <img src={logo_url} alt={name} style={{ width: '100%', height: '100%', objectFit: 'contain' }}/>
  return (
    <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, #1a73e8, #6c35de)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ fontSize: size * 0.32 + 'px', fontWeight: '800', color: '#fff', fontFamily: 'system-ui' }}>{iniciales}</span>
    </div>
  )
}

const FASE_LABEL = { grupo: 'Grupo', octavos: 'Octavos', cuartos: 'Cuartos de final', semifinal: 'Semifinal', final: 'Final' }

const MEDALLA = ['#f9a825', '#c9cdd2', '#cd7f32']

// Misma tabla azul de siempre, pero colapsable con un encabezado — para
// mostrar un grupo a la vez sin saturar la pantalla cuando el torneo tiene
// varios grupos.
function TablaColapsable({ titulo, rows, defaultOpen = false, onClickEquipo }) {
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
          <TablaPosiciones rows={rows} onClickEquipo={onClickEquipo}/>
        </div>
      )}
    </div>
  )
}

// Modal con foto grande + nombre de cada jugador REGISTRADO de un equipo en
// este torneo — para que cualquiera pueda verificar en cancha quién sí está
// inscrito.
function RosterModal({ rosterModal, onClose, torneoNombre }) {
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
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', zIndex: 500, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: '720px', maxHeight: '88vh', overflowY: 'auto', overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch', padding: '20px 18px 28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
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

        <div style={{ fontSize: '.78rem', color: '#5f6368', marginBottom: '18px', lineHeight: 1.5 }}>
          Jugadores registrados de <b>{team.name}</b> en <b>{torneoNombre}</b>.
        </div>

        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#9aa0a6', fontSize: '.85rem' }}>Cargando jugadores...</div>
        ) : jugadores.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#9aa0a6', fontSize: '.85rem' }}>Este equipo aún no tiene jugadores registrados en este torneo</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))', gap: '16px' }}>
            {jugadores.map(j => {
              const tieneTag = !!(j.es_elite || j.es_profesional || j.es_mayor_35 || j.etiqueta_personalizada)
              return (
              <div key={j.id} style={{ textAlign: 'center' }}>
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
                {tieneTag && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '5px', alignItems: 'center' }}>
                    {j.es_elite && <span style={{ fontSize: '.62rem', color: '#1a1305', background: '#f5c542', borderRadius: '8px', padding: '1px 7px', fontWeight: '800' }}>💎 Élite</span>}
                    {j.es_profesional && <span style={{ fontSize: '.62rem', color: '#fff', background: '#7b3ff2', borderRadius: '8px', padding: '1px 7px', fontWeight: '800' }}>🎓 Profesional</span>}
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
  )
}

const TIPOS_TARJETA = { yellow_card: 'amarilla', blue_card: 'azul', red_card: 'roja' }
const COLOR_TARJETA = { amarilla: '#f9c400', azul: '#1a73e8', roja: '#d93025' }
function IconoTarjeta({ color }) {
  return <span style={{ display: 'inline-block', width: '9px', height: '13px', borderRadius: '2px', background: COLOR_TARJETA[color] || '#999', flexShrink: 0 }}/>
}

// Agrupa eventos de gol de un mismo jugador en una sola fila: en vez de
// repetir el nombre una vez por gol, lo muestra una sola vez seguido de un
// balón por cada gol que anotó (y la lista de minutos, si se conocen).
// `nombreDe` resuelve el nombre a mostrar; se agrupa por player_id cuando
// existe (más confiable que el nombre) y si no por el nombre mismo.
function agruparGoles(eventosGol, nombreDe) {
  const orden = []
  const porJugador = new Map()
  eventosGol.forEach(e => {
    const key = e.player_id || nombreDe(e)
    if (!porJugador.has(key)) { porJugador.set(key, { jugador: nombreDe(e), cantidad: 0, minutos: [] }); orden.push(key) }
    const acc = porJugador.get(key)
    acc.cantidad += 1
    if (e.minute) acc.minutos.push(e.minute)
  })
  return orden.map(key => porJugador.get(key))
}

// Historial de un partido ya jugado: marcador + quién anotó cada gol y las
// tarjetas, sacado de match_events (a diferencia del detalle "en vivo", este
// se guarda en la base apenas se cierra el partido, así que sigue
// disponible después, aunque hayan pasado semanas).
function PartidoDetalleModal({ partido, onClose }) {
  const [eventos, setEventos] = useState(null) // null = cargando
  const [errorCarga, setErrorCarga] = useState(null)

  // Bloquear el scroll del fondo mientras el modal está abierto: si no, en
  // Android el gesto de scroll dentro del modal se "escapa" hacia la página
  // de atrás apenas llega al borde (scroll chaining) y rebota, dando la
  // sensación de que no deja bajar a ver el resto (ej. las tarjetas).
  useEffect(() => {
    if (!partido) return
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = original }
  }, [!!partido])

  useEffect(() => {
    if (!partido) return
    let activo = true
    setEventos(null)
    setErrorCarga(null)
    // players!player_id (no players(...) a secas): match_events tiene más de
    // una relación hacia players, así que hay que decirle a PostgREST cuál
    // columna usar para el embed — si no, tira "more than one relationship
    // was found for match_events and players".
    supabase.from('match_events')
      .select('id, event_type, minute, periodo, team_id, player_id, player_nombre, players!player_id(name)')
      .eq('match_id', partido.id)
      .order('minute', { ascending: true })
      .then(({ data, error }) => {
        if (!activo) return
        if (error) { setErrorCarga(error.message); setEventos([]); return }
        setEventos(data || [])
      })
    return () => { activo = false }
  }, [partido?.id])

  if (!partido) return null

  const nombreDe = e => e.players?.name || e.player_nombre || 'Jugador'
  const goles = (eventos || []).filter(e => e.event_type === 'goal')
  const golesLocal = goles.filter(e => e.team_id === partido.home_team_id)
  const golesVis   = goles.filter(e => e.team_id === partido.away_team_id)
  const tarjetas = (eventos || []).filter(e => TIPOS_TARJETA[e.event_type])
  const tarjetasLocal = tarjetas.filter(e => e.team_id === partido.home_team_id)
  const tarjetasVis   = tarjetas.filter(e => e.team_id === partido.away_team_id)

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', zIndex: 520, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: '540px', maxHeight: '85vh', overflowY: 'auto', overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch', padding: '20px 18px 28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div>
            <div style={{ fontWeight: '800', color: '#202124', fontSize: '.95rem' }}>Resumen del partido</div>
            <div style={{ fontSize: '.72rem', color: '#9aa0a6', marginTop: '2px' }}>
              {partido.played_at && new Date(partido.played_at).toLocaleDateString('es-CO', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
              {partido.matchday && ` · J${partido.matchday}`}
              {partido.fase && partido.fase !== 'grupo' && ` · ${FASE_LABEL[partido.fase]}`}
            </div>
          </div>
          <button onClick={onClose} style={{ background: '#f1f3f4', border: 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', color: '#5f6368', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><X size={16}/></button>
        </div>

        {/* Marcador */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', marginBottom: '20px', background: '#f8f9fa', borderRadius: '12px', padding: '16px' }}>
          <div style={{ flex: 1, textAlign: 'center', minWidth: 0 }}>
            <div style={{ width: '42px', height: '42px', borderRadius: '10px', overflow: 'hidden', margin: '0 auto' }}>
              <TeamLogo logo_url={partido.home?.logo_url} name={partido.home?.name} size={42}/>
            </div>
            <div style={{ fontWeight: '700', color: '#202124', fontSize: '.78rem', marginTop: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{partido.home?.name}</div>
          </div>
          <div style={{ fontWeight: '900', fontSize: '1.5rem', color: '#202124', flexShrink: 0 }}>{partido.home_score} - {partido.away_score}</div>
          <div style={{ flex: 1, textAlign: 'center', minWidth: 0 }}>
            <div style={{ width: '42px', height: '42px', borderRadius: '10px', overflow: 'hidden', margin: '0 auto' }}>
              <TeamLogo logo_url={partido.away?.logo_url} name={partido.away?.name} size={42}/>
            </div>
            <div style={{ fontWeight: '700', color: '#202124', fontSize: '.78rem', marginTop: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{partido.away?.name}</div>
          </div>
        </div>

        {partido.tipo_resultado && (
          <div style={{ marginBottom: '16px' }}>
            <div style={{ textAlign: 'center', fontWeight: '700', fontSize: '.8rem', color: partido.tipo_resultado === 'w' ? '#1e8e3e' : '#5f6368', background: partido.tipo_resultado === 'w' ? '#e6f4ea' : '#f1f3f4', borderRadius: '8px', padding: '8px', marginBottom: partido.foto_w_url ? '12px' : 0 }}>
              {partido.tipo_resultado === 'w' ? '🏆 Partido ganado por W' : '❌ Partido desierto'}
            </div>
            {partido.foto_w_url && (
              <div>
                <div style={{ fontSize: '.62rem', fontWeight: '800', color: '#9aa0a6', letterSpacing: '.08em', marginBottom: '8px' }}>FOTO DEL EQUIPO QUE SE PRESENTÓ</div>
                <img src={partido.foto_w_url} alt="Equipo que se presentó" style={{ width: '100%', maxHeight: '320px', objectFit: 'cover', borderRadius: '12px' }}/>
              </div>
            )}
          </div>
        )}

        {eventos === null ? (
          <div style={{ textAlign: 'center', color: '#9aa0a6', fontSize: '.85rem', padding: '20px 0' }}>Cargando...</div>
        ) : errorCarga ? (
          <div style={{ textAlign: 'center', color: '#d93025', fontSize: '.8rem', padding: '20px 14px', background: '#fce8e6', borderRadius: '10px' }}>No se pudo cargar el detalle: {errorCarga}</div>
        ) : partido.tipo_resultado ? null : goles.length === 0 && tarjetas.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#9aa0a6', fontSize: '.85rem', padding: '20px 0' }}>No quedó registrado el detalle de goles ni tarjetas de este partido</div>
        ) : (
          <>
            {goles.length > 0 && (
              <div style={{ marginBottom: '18px' }}>
                <div style={{ fontSize: '.62rem', fontWeight: '800', color: '#9aa0a6', letterSpacing: '.08em', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '5px' }}><GiSoccerBall size={11} color="#9aa0a6"/> GOLES</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    {golesLocal.length === 0 && <div style={{ color: '#9aa0a6', fontSize: '.72rem' }}>—</div>}
                    {agruparGoles(golesLocal, nombreDe).map((gg, i) => (
                      <div key={i} style={{ fontSize: '.78rem', color: '#202124', padding: '4px 0', display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
                        {gg.jugador} {Array.from({ length: gg.cantidad }).map((_, j) => <GiSoccerBall key={j} size={10} color="#202124"/>)} {gg.minutos.length > 0 ? <span style={{ color: '#9aa0a6' }}>· {gg.minutos.map(m => `${m}'`).join(', ')}</span> : null}
                      </div>
                    ))}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    {golesVis.length === 0 && <div style={{ color: '#9aa0a6', fontSize: '.72rem' }}>—</div>}
                    {agruparGoles(golesVis, nombreDe).map((gg, i) => (
                      <div key={i} style={{ fontSize: '.78rem', color: '#202124', padding: '4px 0', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '5px', flexWrap: 'wrap' }}>
                        {gg.minutos.length > 0 ? <span style={{ color: '#9aa0a6' }}>{gg.minutos.map(m => `${m}'`).join(', ')} ·</span> : null} {gg.jugador} {Array.from({ length: gg.cantidad }).map((_, j) => <GiSoccerBall key={j} size={10} color="#202124"/>)}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {tarjetas.length > 0 && (
              <div>
                <div style={{ fontSize: '.62rem', fontWeight: '800', color: '#9aa0a6', letterSpacing: '.08em', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}><IconoTarjeta color="amarilla"/> TARJETAS</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    {tarjetasLocal.map(e => (
                      <div key={e.id} style={{ fontSize: '.78rem', color: '#202124', padding: '4px 0', display: 'flex', alignItems: 'center', gap: '6px' }}><IconoTarjeta color={TIPOS_TARJETA[e.event_type]}/> {nombreDe(e)} {e.minute ? <span style={{ color: '#9aa0a6' }}>· {e.minute}'</span> : null}</div>
                    ))}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    {tarjetasVis.map(e => (
                      <div key={e.id} style={{ fontSize: '.78rem', color: '#202124', padding: '4px 0', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>{e.minute ? <span style={{ color: '#9aa0a6' }}>{e.minute}' ·</span> : null} {nombreDe(e)} <IconoTarjeta color={TIPOS_TARJETA[e.event_type]}/></div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
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

export default function TorneoPublicoPage({ tournamentId } = {}) {
  const params = useParams()
  const id = tournamentId || params.id

  const [torneo,    setTorneo]    = useState(null)
  const [equipos,   setEquipos]   = useState([])
  const [partidos,  setPartidos]  = useState([])
  const [goleadores, setGoleadores] = useState([])
  const [porteros,  setPorteros]  = useState([]) // { team_id, id, name, photo_url, photo_face_url }
  const [grupos,       setGrupos]       = useState([])
  const [grupoEquipos, setGrupoEquipos] = useState([])
  const [bracket,   setBracket]   = useState([]) // partidos de eliminatorias (todas las fases), para el árbol público
  const [sponsors,  setSponsors]  = useState([])
  const [loading,   setLoading]   = useState(true)
  const [tab,       setTab]       = useState('posiciones')

  // Apenas hay árbol de eliminatorias, lo mostramos de una — sin que el
  // visitante tenga que buscar la pestaña.
  useEffect(() => {
    if (bracket.length > 0 && tab === 'posiciones') setTab('llaves')
  }, [bracket.length]) // eslint-disable-line react-hooks/exhaustive-deps

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
        refetchTimer.current = setTimeout(() => { fetchPartidos(); fetchBracket() }, 600)
      })
      .subscribe()
    return () => { clearTimeout(refetchTimer.current); supabase.removeChannel(channel) }
  }, [id])

  async function fetchPartidos() {
    const { data } = await supabase
      .from('matches')
      .select('*, home:home_team_id(name,logo_url), away:away_team_id(name,logo_url)')
      .eq('tournament_id', id)
      .order('played_at', { ascending: true })
    setPartidos(data || [])
  }

  // Todos los partidos de eliminatorias (todas las fases) para armar el árbol completo.
  async function fetchBracket() {
    const { data } = await supabase
      .from('matches')
      .select('*, home:home_team_id(name,logo_url), away:away_team_id(name,logo_url)')
      .eq('tournament_id', id)
      .neq('fase', 'grupo')
      .order('ronda').order('played_at', { ascending: true })
    setBracket(data || [])
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

  // Favicon dinámico del torneo (no se revierte al salir)
  useEffect(() => {
    if (!torneo?.favicon_url) return
    const links = document.querySelectorAll("link[rel='icon'], link[rel='shortcut icon']")
    if (links.length === 0) {
      const link = document.createElement('link')
      link.rel = 'icon'
      link.href = torneo.favicon_url
      document.head.appendChild(link)
      return
    }
    links.forEach(link => { link.href = torneo.favicon_url })
  }, [torneo?.favicon_url])

  async function abrirRoster(team, stats) {
    if (!team?.id) return
    setRosterModal({ team, jugadores: [], loading: true, stats })
    const { data } = await supabase
      .from('tournament_player_registrations')
      .select('player_id')
      .eq('tournament_id', id)
      .eq('team_id', team.id)
      .eq('activo', true)
    const hydrated = await hydratePlayersPublico(data || [], {
      columns: 'id, name, photo_url, photo_face_url, es_elite, es_profesional, es_mayor_35, etiqueta_personalizada',
    })
    const jugadores = hydrated.map(r => r.players).filter(Boolean).sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    setRosterModal({ team, jugadores, loading: false, stats })
  }

  // Al tocar un equipo en la tabla de posiciones: misma ficha de siempre
  // (RosterModal), pero además con sus estadísticas del torneo (PJ/PG/PE/
  // PP/GF/GC/PTS) y ciudad/categoría — así "ver info del equipo" desde la
  // tabla muestra algo más completo que solo la lista de jugadores.
  function abrirEquipoInfo(row) {
    abrirRoster(row.equipo, { pj: row.pj, pg: row.pg, pe: row.pe, pp: row.pp, gf: row.gf, gc: row.gc, pts: row.pts })
  }

  useEffect(() => {
    async function fetchAll() {
      setLoading(true)
      const [{ data: t }, { data: teData }, { data: pData }, { data: gData }, { data: spData }] = await Promise.all([
        supabase.from('tournaments').select('*').eq('id', id).single(),
        supabase.from('tournament_teams').select('*, teams(*)').eq('tournament_id', id),
        supabase.from('matches').select('*, home:home_team_id(name,logo_url), away:away_team_id(name,logo_url)').eq('tournament_id', id).order('played_at', { ascending: true }),
        supabase.from('goleadores_por_torneo').select('*').eq('tournament_id', id).gt('total_goals', 0).order('total_goals', { ascending: false }),
        supabase.from('tournament_sponsors').select('*').eq('tournament_id', id).order('orden', { ascending: true }),
      ])
      setTorneo(t)
      setEquipos((teData || []).map(d => ({ ...d.teams })))
      setPartidos(pData || [])
      setGoleadores(gData || [])
      setSponsors(spData || [])
      fetchBracket()

      // Grupos del torneo (si los tiene) para mostrar la tabla dividida
      const { data: grps } = await supabase.from('tournament_grupos').select('*').eq('tournament_id', id).order('orden')
      setGrupos(grps || [])
      if (grps?.length) {
        const { data: ge } = await supabase.from('grupo_equipos').select('*, teams(id,name,logo_url)').in('grupo_id', grps.map(g => g.id))
        setGrupoEquipos(ge || [])
      } else {
        setGrupoEquipos([])
      }

      // Arqueros de cada equipo del torneo (para la valla menos vencida)
      const teamIds = (teData || []).map(d => d.teams?.id).filter(Boolean)
      if (teamIds.length > 0) {
        const { data: tpData } = await supabase
          .from('team_players')
          .select('team_id, player_id')
          .in('team_id', teamIds)
        const hydrated = await hydratePlayersPublico(tpData || [], {
          columns: 'id, name, photo_url, photo_face_url, posicion_futbol5, posicion_futbol7, posicion_futbol11',
        })
        const modalidad = t?.modalidad || ''
        const campoPos = modalidad.includes('11') ? 'posicion_futbol11' : modalidad.includes('7') ? 'posicion_futbol7' : 'posicion_futbol5'
        const arqueros = hydrated
          .filter(tp => tp.players && (tp.players[campoPos] === 'Portero' || tp.players.posicion_futbol5 === 'Portero' || tp.players.posicion_futbol7 === 'Portero' || tp.players.posicion_futbol11 === 'Portero'))
          .map(tp => ({ team_id: tp.team_id, ...tp.players }))
        setPorteros(arqueros)
      } else {
        setPorteros([])
      }

      setLoading(false)
    }
    fetchAll()
  }, [id])

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#07070e', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#00ddd0', fontFamily: 'system-ui', fontSize: '1rem', letterSpacing: '.1em' }}>
      Cargando...
    </div>
  )

  if (!torneo) return (
    <div style={{ minHeight: '100vh', background: '#07070e', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9aa0a6', fontFamily: 'system-ui' }}>
      Torneo no encontrado
    </div>
  )

  const partidosJugados    = partidos.filter(p => p.status === 'finished').slice().reverse()
  const partidosPendientes = partidos.filter(p => p.status !== 'finished')

  // Tabla de posiciones
  const P = getPuntosTorneo(torneo)
  const tabla = {}
  equipos.forEach(e => { tabla[e.id] = { equipo: e, pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, pts: 0 } })
  partidos.filter(p => p.status === 'finished' && (!p.fase || p.fase === 'grupo')).forEach(p => {
    if (tabla[p.home_team_id]) {
      tabla[p.home_team_id].pj++; tabla[p.home_team_id].gf += p.home_score || 0; tabla[p.home_team_id].gc += p.away_score || 0
      if (p.home_score > p.away_score) { tabla[p.home_team_id].pg++; tabla[p.home_team_id].pts += P.victoria }
      else if (p.home_score === p.away_score) { tabla[p.home_team_id].pe++; tabla[p.home_team_id].pts += P.empate }
      else { tabla[p.home_team_id].pp++; tabla[p.home_team_id].pts += P.derrota }
    }
    if (tabla[p.away_team_id]) {
      tabla[p.away_team_id].pj++; tabla[p.away_team_id].gf += p.away_score || 0; tabla[p.away_team_id].gc += p.home_score || 0
      if (p.away_score > p.home_score) { tabla[p.away_team_id].pg++; tabla[p.away_team_id].pts += P.victoria }
      else if (p.away_score === p.home_score) { tabla[p.away_team_id].pe++; tabla[p.away_team_id].pts += P.empate }
      else { tabla[p.away_team_id].pp++; tabla[p.away_team_id].pts += P.derrota }
    }
  })
  const tablaOrdenada = Object.values(tabla).sort((a, b) => b.pts - a.pts || (b.gf - b.gc) - (a.gf - a.gc))

  // Tabla de un grupo específico — solo cuenta partidos entre equipos de ese
  // mismo grupo en fase de grupos (misma lógica que usa el jugador/admin).
  function getTablaGrupo(grupoId) {
    const eqIds = grupoEquipos.filter(ge => ge.grupo_id === grupoId).map(ge => ge.team_id)
    const partGrupo = partidos.filter(p => (!p.fase || p.fase === 'grupo') && eqIds.includes(p.home_team_id) && eqIds.includes(p.away_team_id))
    const t = {}
    eqIds.forEach(eid => {
      const eq = equipos.find(e => e.id === eid)
      if (eq) t[eid] = { equipo: eq, pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, pts: 0 }
    })
    partGrupo.filter(p => p.status === 'finished').forEach(p => {
      if (t[p.home_team_id]) {
        t[p.home_team_id].pj++; t[p.home_team_id].gf += p.home_score || 0; t[p.home_team_id].gc += p.away_score || 0
        if (p.home_score > p.away_score) { t[p.home_team_id].pg++; t[p.home_team_id].pts += P.victoria }
        else if (p.home_score === p.away_score) { t[p.home_team_id].pe++; t[p.home_team_id].pts += P.empate }
        else { t[p.home_team_id].pp++; t[p.home_team_id].pts += P.derrota }
      }
      if (t[p.away_team_id]) {
        t[p.away_team_id].pj++; t[p.away_team_id].gf += p.away_score || 0; t[p.away_team_id].gc += p.home_score || 0
        if (p.away_score > p.home_score) { t[p.away_team_id].pg++; t[p.away_team_id].pts += P.victoria }
        else if (p.away_score === p.home_score) { t[p.away_team_id].pe++; t[p.away_team_id].pts += P.empate }
        else { t[p.away_team_id].pp++; t[p.away_team_id].pts += P.derrota }
      }
    })
    return Object.values(t).sort((a, b) => b.pts - a.pts || (b.gf - b.gc) - (a.gf - a.gc))
  }

  // Vista previa en vivo del árbol de eliminatorias: mientras el organizador
  // todavía no crea las llaves reales (bracket.length === 0), se arma igual
  // según la tabla de posiciones actual y la configuración que dejó guardada
  // en el admin (tournaments.preview_config / preview_calendario) — así el
  // hincha ve exactamente lo mismo que el organizador mientras se juega la
  // fase de grupos, sin tener que esperar a que se "oficialice" el árbol.
  // Misma lógica que usa AdminTorneoDetallePage para su propia vista previa.
  function getClasificadosPreview() {
    const porGrupo = torneo?.equipos_clasifican || 2
    const clasificados = []
    for (const grupo of grupos) {
      const tg = getTablaGrupo(grupo.id)
      tg.slice(0, porGrupo).forEach((row, pos) => {
        if (row.equipo) clasificados.push({ ...row.equipo, posicion: pos + 1, grupo: grupo.nombre, pts: row.pts, dg: row.gf - row.gc })
      })
    }
    return clasificados.sort((a, b) => a.posicion - b.posicion || b.pts - a.pts || b.dg - a.dg)
  }
  function getParticipantesElimPreview(n) {
    const directos = grupos.length > 0 ? getClasificadosPreview() : []
    let lista = [...directos]
    if (lista.length > n) lista = lista.slice(0, n)
    if (lista.length < n) {
      const idsYa = new Set(lista.map(e => e.id))
      tablaOrdenada.forEach(row => {
        if (lista.length >= n || !row.equipo || idsYa.has(row.equipo.id)) return
        lista.push({ ...row.equipo, posicion: 99, grupo: directos.length > 0 ? 'Mejor perdedor' : null, pts: row.pts, dg: row.gf - row.gc, mejorPerdedor: directos.length > 0 })
        idsYa.add(row.equipo.id)
      })
    }
    return lista
  }

  const previewConfig = torneo?.preview_config || {}
  const previewCalendario = torneo?.preview_calendario || {}
  const numClasifElimPreview = previewConfig.numClasifElim || (grupos.length > 0 ? (torneo?.equipos_clasifican || 2) * grupos.length : Math.min(8, equipos.length))
  const estiloLlavesPreview = previewConfig.estiloLlaves || 'consecutivo'
  const modoImparPreview = previewConfig.modoImpar || 'mejor_perdedor'

  function getParticipantesConImparPreview() {
    const base = getParticipantesElimPreview(numClasifElimPreview)
    if (base.length < 2 || base.length % 2 === 0) return { participantes: base, byeTeam: null }
    if (modoImparPreview === 'mejor_perdedor') return { participantes: getParticipantesElimPreview(numClasifElimPreview + 1), byeTeam: null }
    const idBye = previewConfig.equipoByeId && base.some(t => String(t.id) === String(previewConfig.equipoByeId)) ? previewConfig.equipoByeId : base[base.length - 1].id
    const byeTeam = base.find(t => String(t.id) === String(idBye))
    return { participantes: base.filter(t => String(t.id) !== String(idBye)), byeTeam }
  }

  const hayBasePreview = bracket.length === 0 && (grupos.length > 0 || equipos.length >= 2)
  const { participantes: participantesPreview, byeTeam: byeInicialPreview } = hayBasePreview
    ? getParticipantesConImparPreview()
    : { participantes: [], byeTeam: null }

  const mapaPreview = new Map(participantesPreview.map(p => [String(p.id), p]))
  const idsOrdenPreview = previewConfig.previewOrden && previewConfig.previewOrden.length === participantesPreview.length
    ? previewConfig.previewOrden.map(String)
    : participantesPreview.map(p => String(p.id))
  const ordenPreview = idsOrdenPreview.map(pid => mapaPreview.get(pid)).filter(Boolean)

  const parejasPreview = []
  const totalOrdenPreview = ordenPreview.length
  if (estiloLlavesPreview === 'cruzado') {
    for (let i = 0; i < Math.floor(totalOrdenPreview / 2); i++) parejasPreview.push([ordenPreview[i], ordenPreview[totalOrdenPreview - 1 - i]])
  } else {
    for (let i = 0; i < totalOrdenPreview - 1; i += 2) parejasPreview.push([ordenPreview[i], ordenPreview[i + 1]])
  }
  const totalPreview = parejasPreview.length * 2 + (byeInicialPreview ? 1 : 0)

  const columnasPreview = []
  if (parejasPreview.length > 0 || byeInicialPreview) {
    let llavesRonda = parejasPreview.map(([a, b]) => ({ a, b }))
    let totalRonda = totalPreview
    while (true) {
      columnasPreview.push({ total: totalRonda, fase: getFaseValuePreview(totalRonda), llaves: llavesRonda })
      if (llavesRonda.length <= 1) break
      const siguienteN = Math.max(Math.floor(llavesRonda.length / 2), 1)
      llavesRonda = Array.from({ length: siguienteN }, () => null)
      totalRonda = Math.max(Math.floor(totalRonda / 2), 2)
    }
  }
  const previewDisponible = hayBasePreview && (parejasPreview.length > 0 || byeInicialPreview)

  // Valla menos vencida GLOBAL por equipo: ranking por goles en contra, con
  // los arqueros registrados de cada equipo (fotos y nombres). A diferencia
  // de la tabla de posiciones (que en fase de grupos ya no cuenta partidos
  // de eliminación directa), acá los goles en contra deben seguir sumando
  // aunque el torneo ya esté en eliminatorias.
  const gcTotal = {}, pjValla = {}
  partidos.filter(p => p.status === 'finished').forEach(p => {
    if (tabla[p.home_team_id]) { gcTotal[p.home_team_id] = (gcTotal[p.home_team_id] || 0) + (p.away_score || 0); pjValla[p.home_team_id] = (pjValla[p.home_team_id] || 0) + 1 }
    if (tabla[p.away_team_id]) { gcTotal[p.away_team_id] = (gcTotal[p.away_team_id] || 0) + (p.home_score || 0); pjValla[p.away_team_id] = (pjValla[p.away_team_id] || 0) + 1 }
  })
  const vallaEquipos = equipos.filter(e => pjValla[e.id] > 0)
    .map(e => ({
      equipo: e, gc: gcTotal[e.id] || 0, pj: pjValla[e.id] || 0,
      arqueros: porteros.filter(p => p.team_id === e.id).map(p => ({ name: p.name, foto: p.photo_face_url || p.photo_url })),
    }))
    .sort((a, b) => a.gc - b.gc || b.pj - a.pj)

  // "Fase eliminatoria" (el árbol de llaves) aparece como una pestaña MÁS,
  // sin tapar Posiciones — así la gente puede seguir viendo la tabla de
  // grupos y también, en vivo, cómo va el árbol de eliminación apenas
  // arranca (antes una tapaba a la otra).
  const tabs = [
    { id: 'posiciones', label: 'Posiciones' },
    ...(bracket.length > 0 || previewDisponible ? [{ id: 'llaves', label: bracket.length > 0 ? '🏆 Fase eliminatoria' : '🏆 Fase eliminatoria (vista previa)' }] : []),
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div style={{ width: '72px', height: '72px', borderRadius: '16px', background: 'rgba(255,255,255,.18)', border: '2px solid rgba(255,255,255,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
              {torneo.logo_url
                ? <img src={torneo.logo_url} alt="logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }}/>
                : <Trophy size={36} color="#fff"/>}
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '800', color: '#fff', lineHeight: 1.2 }}>{torneo.name}</h1>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
                {torneo.modalidad && <span style={{ fontSize: '.8rem', background: 'rgba(255,255,255,.22)', color: '#fff', borderRadius: '20px', padding: '3px 12px', fontWeight: '600' }}>{torneo.modalidad}</span>}
                {torneo.genero    && <span style={{ fontSize: '.8rem', background: 'rgba(255,255,255,.15)', color: '#fff', borderRadius: '20px', padding: '3px 12px' }}>{torneo.genero}</span>}
                {torneo.categoria && <span style={{ fontSize: '.8rem', background: 'rgba(255,255,255,.15)', color: '#fff', borderRadius: '20px', padding: '3px 12px' }}>{torneo.categoria}</span>}
                {torneo.city      && <span style={{ fontSize: '.8rem', color: 'rgba(255,255,255,.8)', display: 'flex', alignItems: 'center', gap: '4px' }}><MapPin size={12}/>{torneo.city}</span>}
                {torneo.season    && <span style={{ fontSize: '.8rem', color: 'rgba(255,255,255,.8)', display: 'flex', alignItems: 'center', gap: '4px' }}><Calendar size={12}/>{torneo.season}</span>}
              </div>
            </div>
          </div>

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
                <TablaColapsable key={g.id} titulo={`Grupo ${g.nombre}`} rows={getTablaGrupo(g.id)} defaultOpen onClickEquipo={abrirEquipoInfo}/>
              ))}
              <TablaColapsable titulo="Tabla general — todos los equipos" rows={tablaOrdenada} onClickEquipo={abrirEquipoInfo}/>
            </div>
          ) : (
            <TablaPosiciones titulo="Tabla de posiciones" rows={tablaOrdenada} onClickEquipo={abrirEquipoInfo}/>
          )
        )}

        {/* LLAVES (árbol de eliminatorias, público y de solo lectura) */}
        {tab === 'llaves' && bracket.length > 0 && (() => {
          const porFase = getLlavesPorFaseElim()
          const fasesExist = FASE_ORDEN_ELIM.filter(f => porFase[f])
          if (fasesExist.length === 0) return null

          const llaveFinal = porFase['final']?.find(l => !(l.matches[0].ronda || '').toLowerCase().includes('tercer'))
          const campeon = llaveFinal?.ganador || null
          const subcampeon = campeon ? (llaveFinal.ganador.id === llaveFinal.teamA.id ? llaveFinal.teamB : llaveFinal.teamA) : null
          const llaveTercer = porFase['final']?.find(l => (l.matches[0].ronda || '').toLowerCase().includes('tercer'))
          const tercerPuestoEq = llaveTercer?.ganador || null

          // Columnas del árbol: fases jugadas + placeholders "por definir" hasta la final
          const columnas = []
          let n = porFase[fasesExist[0]].length
          let ultimaLlavesReales = null
          for (let idx = FASE_ORDEN_ELIM.indexOf(fasesExist[0]); idx < FASE_ORDEN_ELIM.length; idx++) {
            const f = FASE_ORDEN_ELIM[idx]
            if (porFase[f]) {
              columnas.push({ fase: f, llaves: porFase[f] })
              n = porFase[f].length
              ultimaLlavesReales = porFase[f]
            } else {
              n = Math.max(Math.floor(n / 2), 1)
              columnas.push({ fase: f, llaves: Array.from({ length: n }, () => null), feeder: ultimaLlavesReales })
              ultimaLlavesReales = null
            }
          }

          return (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '.66rem', fontWeight: '800', color: '#d93025', background: '#fce8e6', borderRadius: '20px', padding: '3px 10px', letterSpacing: '.04em' }}>
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#d93025', display: 'inline-block' }}/>
                  EN VIVO
                </span>
                <span style={{ fontSize: '.75rem', color: '#5f6368' }}>
                  Así va el árbol — se actualiza solo apenas se registra un resultado.
                </span>
              </div>

              {/* Campeón */}
              {campeon && (
                <div style={{ background: 'linear-gradient(135deg, #fff8e1, #ffecb3)', border: '2px solid #f9a825', borderRadius: '14px', padding: '16px 20px', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '1.8rem' }}>🏆</span>
                    <div style={{ width: '40px', height: '40px', borderRadius: '10px', overflow: 'hidden', flexShrink: 0, background: '#fff', border: '1px solid #e8eaed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {campeon.logo_url ? <img src={campeon.logo_url} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '2px' }}/> : <Shield size={18} color="#9aa0a6"/>}
                    </div>
                    <div>
                      <div style={{ fontSize: '.65rem', fontWeight: '800', color: '#e8710a', letterSpacing: '2px' }}>CAMPEÓN DEL TORNEO</div>
                      <div style={{ fontWeight: '900', color: '#202124', fontSize: '1.05rem' }}>{campeon.name}</div>
                    </div>
                  </div>
                  {(subcampeon || tercerPuestoEq) && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', justifyContent: 'center', marginTop: '10px', flexWrap: 'wrap' }}>
                      {subcampeon && <span style={{ fontSize: '.76rem', color: '#5f6368', fontWeight: '600' }}>🥈 Subcampeón: {subcampeon.name}</span>}
                      {tercerPuestoEq && <span style={{ fontSize: '.76rem', color: '#5f6368', fontWeight: '600' }}>🥉 Tercer puesto: {tercerPuestoEq.name}</span>}
                    </div>
                  )}
                </div>
              )}

              {/* Árbol */}
              <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '10px', alignItems: 'stretch' }}>
                {columnas.map(col => (
                  <div key={col.fase} style={{ minWidth: '210px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ textAlign: 'center', fontSize: '.68rem', fontWeight: '800', color: '#e8710a', letterSpacing: '1.2px', marginBottom: '10px', background: '#fff4e5', borderRadius: '8px', padding: '6px' }}>
                      {FASE_LABEL_ELIM[col.fase].toUpperCase()}
                    </div>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-around', gap: '10px' }}>
                      {col.llaves.map((ll, i) => ll ? (
                        <div key={i}
                          style={{ background: '#fff', border: '1.5px solid #c4c9d0', borderLeft: '4px solid #e8710a', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,.1)' }}>
                          {(ll.matches[0].ronda || '').toLowerCase().includes('repechaje') && (
                            <div style={{ padding: '3px 12px', background: '#f3e8fd', fontSize: '.6rem', fontWeight: '800', color: '#9955ff', letterSpacing: '1px' }}>🔁 REPECHAJE</div>
                          )}
                          {(ll.matches[0].ronda || '').toLowerCase().includes('tercer') && (
                            <div style={{ padding: '3px 12px', background: '#fff4e5', fontSize: '.6rem', fontWeight: '800', color: '#cd7f32', letterSpacing: '1px' }}>🥉 TERCER PUESTO</div>
                          )}
                          {[{ team: ll.teamA, goles: ll.golesA }, { team: ll.teamB, goles: ll.golesB }].map(({ team, goles }, ti) => {
                            const esGanador  = ll.ganador?.id === team.id
                            const esPerdedor = ll.terminada && ll.ganador && !esGanador
                            return (
                              <div key={ti} style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '7px 10px', background: esGanador ? '#e6f4ea' : ti === 1 ? '#f8f9fa' : '#fff', opacity: esPerdedor ? .45 : 1, borderBottom: ti === 0 ? '2px solid #dadce0' : 'none' }}>
                                <div style={{ width: '20px', height: '20px', borderRadius: '5px', overflow: 'hidden', flexShrink: 0, background: '#f1f3f4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  {team.logo_url ? <img src={team.logo_url} style={{ width: '100%', height: '100%', objectFit: 'contain' }}/> : <Shield size={10} color="#9aa0a6"/>}
                                </div>
                                <span style={{ flex: 1, fontWeight: esGanador ? '800' : '500', color: '#202124', fontSize: '.76rem', textDecoration: esPerdedor ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{team.name}</span>
                                <span style={{ fontWeight: '900', fontSize: '.9rem', color: esGanador ? '#1e8e3e' : '#9aa0a6', flexShrink: 0 }}>
                                  {ll.matches.some(m => m.status === 'finished') ? goles : '—'}
                                </span>
                                {esGanador && <span style={{ fontSize: '.7rem', flexShrink: 0 }}>✓</span>}
                              </div>
                            )
                          })}
                          <div style={{ padding: '5px 10px', background: '#f8f9fa', fontSize: '.62rem', color: ll.terminada && !ll.ganador ? '#d93025' : '#9aa0a6', fontWeight: ll.terminada && !ll.ganador ? '700' : '400' }}>
                            {!ll.terminada
                              ? `${ll.matches.length > 1 ? 'Ida y vuelta · ' : ''}${ll.matches[0].played_at ? new Date(ll.matches[0].played_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }) + ' · ' + fmtHoraDate(ll.matches[0].played_at) : '📅 Por definir'}`
                              : !ll.ganador
                                ? '⚠️ Empate — pendiente de penales'
                                : `${ll.matches.length > 1 ? `Global ${ll.golesA}-${ll.golesB}` : 'Jugado'}${ll.porPenales ? ' · Penales' : ''}`}
                          </div>
                        </div>
                      ) : (() => {
                        const feederA = col.feeder?.[i * 2], feederB = col.feeder?.[i * 2 + 1]
                        const conocidoA = feederA?.terminada && feederA?.ganador ? feederA.ganador : null
                        const conocidoB = feederB?.terminada && feederB?.ganador ? feederB.ganador : null
                        const hayConocido = conocidoA || conocidoB
                        return (
                          <div key={i} style={{ border: '2px dashed #b0b6bd', borderRadius: '10px', padding: '16px', textAlign: 'center', color: '#9aa0a6', fontSize: '.7rem', fontWeight: '600', background: '#f1f3f4' }}>
                            {hayConocido ? (
                              [conocidoA, conocidoB].map((t, ti) => (
                                <div key={ti} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 2px', justifyContent: 'center' }}>
                                  {t ? (
                                    <>
                                      <div style={{ width: '18px', height: '18px', borderRadius: '4px', overflow: 'hidden', flexShrink: 0, background: '#fff' }}>
                                        {t.logo_url ? <img src={t.logo_url} style={{ width: '100%', height: '100%', objectFit: 'contain' }}/> : <Shield size={10} color="#9aa0a6"/>}
                                      </div>
                                      <span style={{ fontSize: '.74rem', fontWeight: '800', color: '#1e8e3e' }}>{t.name} ✓</span>
                                    </>
                                  ) : (
                                    <span style={{ fontSize: '.66rem', color: '#9aa0a6', fontStyle: 'italic' }}>rival por definir</span>
                                  )}
                                </div>
                              ))
                            ) : 'Por definir'}
                          </div>
                        )
                      })())}
                    </div>
                  </div>
                ))}

                {/* Columna campeón */}
                <div style={{ minWidth: '150px', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ textAlign: 'center', fontSize: '.68rem', fontWeight: '800', color: '#f9a825', letterSpacing: '1.2px', marginBottom: '10px', background: '#fff8e1', borderRadius: '8px', padding: '6px' }}>
                    🏆 CAMPEÓN
                  </div>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                    {campeon ? (
                      <div style={{ width: '100%', background: 'linear-gradient(135deg, #fff8e1, #ffecb3)', border: '2px solid #f9a825', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
                        <div style={{ width: '34px', height: '34px', borderRadius: '8px', overflow: 'hidden', margin: '0 auto 6px', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {campeon.logo_url ? <img src={campeon.logo_url} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '2px' }}/> : <Shield size={16} color="#9aa0a6"/>}
                        </div>
                        <div style={{ fontWeight: '900', color: '#202124', fontSize: '.78rem' }}>{campeon.name}</div>
                      </div>
                    ) : (
                      <div style={{ width: '100%', border: '1px dashed #f9a825', borderRadius: '10px', padding: '16px', textAlign: 'center', color: '#f9a825', fontSize: '.68rem', background: '#fffdf5' }}>
                        Por definir
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )
        })()}

        {/* LLAVES — VISTA PREVIA (todavía no hay árbol real creado por el
            organizador, pero ya se puede proyectar según la tabla actual) */}
        {tab === 'llaves' && bracket.length === 0 && previewDisponible && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '.66rem', fontWeight: '800', color: '#e8710a', background: '#fff4e5', borderRadius: '20px', padding: '3px 10px', letterSpacing: '.04em' }}>
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#e8710a', display: 'inline-block' }}/>
                VISTA PREVIA
              </span>
              <span style={{ fontSize: '.75rem', color: '#5f6368' }}>
                Así quedaría el árbol si la fase de grupos terminara ahora — se va actualizando solo con cada resultado. Todavía no está en firme.
              </span>
            </div>

            {byeInicialPreview && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', padding: '8px 12px', background: '#e6f4ea', border: '1px solid #a8dab5', borderRadius: '10px' }}>
                <div style={{ width: '20px', height: '20px', borderRadius: '4px', overflow: 'hidden', flexShrink: 0 }}>
                  {byeInicialPreview.logo_url ? <img src={byeInicialPreview.logo_url} style={{ width: '100%', height: '100%', objectFit: 'contain' }}/> : <Shield size={10} color="#9aa0a6"/>}
                </div>
                <span style={{ fontSize: '.76rem', fontWeight: '700', color: '#1e8e3e' }}>⏭️ {byeInicialPreview.name} pasaría directo a la siguiente ronda sin jugar (número impar de clasificados)</span>
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '10px', alignItems: 'stretch' }}>
              {columnasPreview.map((col, ci) => (
                <div key={ci} style={{ minWidth: '210px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ textAlign: 'center', fontSize: '.68rem', fontWeight: '800', color: '#e8710a', letterSpacing: '1.2px', marginBottom: '10px', background: '#fff4e5', borderRadius: '8px', padding: '6px' }}>
                    {getRondaNombrePreview(col.total).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-around', gap: '10px' }}>
                    {col.llaves.map((ll, i) => ll ? (
                      <div key={i} style={{ background: '#fffaf3', border: '1.5px dashed #e8710a', borderLeft: '4px dashed #e8710a', borderRadius: '10px', overflow: 'hidden' }}>
                        {[ll.a, ll.b].map((eq, ti) => (
                          <div key={ti} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 10px', borderBottom: ti === 0 ? '1px solid #f1e0c8' : 'none' }}>
                            <div style={{ width: '20px', height: '20px', borderRadius: '4px', overflow: 'hidden', flexShrink: 0 }}>
                              {eq?.logo_url ? <img src={eq.logo_url} style={{ width: '100%', height: '100%', objectFit: 'contain' }}/> : <Shield size={10} color="#9aa0a6"/>}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: '.78rem', fontWeight: '600', color: '#202124', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{eq?.name || '— por definir —'}</div>
                              {eq?.grupo && <div style={{ fontSize: '.6rem', color: '#9aa0a6' }}>{eq.grupo}</div>}
                            </div>
                            {eq?.posicion && <span style={{ fontSize: '.62rem', color: eq.mejorPerdedor ? '#e8710a' : '#9aa0a6', fontWeight: '700', flexShrink: 0 }}>{eq.mejorPerdedor ? '🎟️' : `#${eq.posicion}`}</span>}
                          </div>
                        ))}
                        {previewCalendario?.[col.fase]?.[i]?.fecha && (
                          <div style={{ padding: '5px 10px', background: '#f8f9fa', fontSize: '.62rem', color: '#5f6368', fontWeight: '600' }}>
                            📅 {new Date(previewCalendario[col.fase][i].fecha + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}{previewCalendario[col.fase][i].hora ? ` · ${previewCalendario[col.fase][i].hora}` : ''}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div key={i} style={{ border: '2px dashed #b0b6bd', borderRadius: '10px', padding: '16px', textAlign: 'center', color: '#9aa0a6', fontSize: '.7rem', fontWeight: '600', background: '#f1f3f4' }}>
                        Por definir
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {/* Espacio reservado para 3° y 4° puesto — solo si el organizador
                  activó esa opción en la vista previa en vivo */}
              {previewConfig.crearTercerPuesto && totalPreview >= 4 && (
                <div style={{ minWidth: '150px', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ textAlign: 'center', fontSize: '.68rem', fontWeight: '800', color: '#cd7f32', letterSpacing: '1.2px', marginBottom: '10px', background: '#fff4e5', borderRadius: '8px', padding: '6px' }}>
                    🥉 3° Y 4° PUESTO
                  </div>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                    <div style={{ width: '100%', border: '2px dashed #d4a574', borderRadius: '10px', padding: '18px', textAlign: 'center', color: '#a5732f', fontSize: '.72rem', fontWeight: '700', background: '#fffaf3' }}>
                      Por definir
                    </div>
                  </div>
                </div>
              )}

              {/* Columna campeón */}
              <div style={{ minWidth: '150px', display: 'flex', flexDirection: 'column' }}>
                <div style={{ textAlign: 'center', fontSize: '.68rem', fontWeight: '800', color: '#f9a825', letterSpacing: '1.2px', marginBottom: '10px', background: '#fff8e1', borderRadius: '8px', padding: '6px' }}>
                  🏆 CAMPEÓN
                </div>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                  <div style={{ width: '100%', border: '2px dashed #ffd66b', borderRadius: '10px', padding: '18px', textAlign: 'center', color: '#e8b93a', fontSize: '.72rem', fontWeight: '700', background: '#fffaf0' }}>
                    Por definir
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* RESULTADOS */}
        {tab === 'resultados' && (
          <div style={s.card}>
            <div style={s.cardTitle}>Resultados</div>
            {partidosJugados.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#9aa0a6' }}>No hay resultados aún</div>
            ) : partidosJugados.map((p, i) => {
              const homeWin = p.home_score > p.away_score
              const awayWin = p.away_score > p.home_score
              return (
                <div key={p.id} onClick={() => setPartidoDetalle(p)} style={{ padding: '14px 18px', borderTop: i > 0 ? '1px solid #f1f3f4' : 'none', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    {p.matchday && <span style={{ fontSize: '.7rem', background: '#e8f0fe', color: '#1a73e8', borderRadius: '10px', padding: '2px 8px', fontWeight: '600' }}>J{p.matchday}</span>}
                    {p.fase && p.fase !== 'grupo' && <span style={{ fontSize: '.7rem', background: '#fce8d9', color: '#e8710a', borderRadius: '10px', padding: '2px 8px', fontWeight: '700' }}>{FASE_LABEL[p.fase]}</span>}
                    {p.played_at && <span style={{ fontSize: '.72rem', color: '#9aa0a6' }}>{new Date(p.played_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}</span>}
                    {p.location && <span style={{ fontSize: '.72rem', color: '#9aa0a6', display: 'flex', alignItems: 'center', gap: '3px' }}><MapPin size={10}/>{p.location}</span>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div onClick={e => { e.stopPropagation(); abrirRoster({ id: p.home_team_id, name: p.home?.name, logo_url: p.home?.logo_url }) }}
                      style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end', cursor: 'pointer' }}>
                      <span style={{ fontWeight: homeWin ? '800' : '500', color: homeWin ? '#202124' : '#5f6368', fontSize: '.9rem', textAlign: 'right' }}>{p.home?.name}</span>
                      <div style={{ width: '28px', height: '28px', borderRadius: '7px', overflow: 'hidden', flexShrink: 0 }}>
                        <TeamLogo logo_url={p.home?.logo_url} name={p.home?.name} size={28}/>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#f1f3f4', borderRadius: '10px', padding: '6px 14px', flexShrink: 0 }}>
                      <span style={{ fontWeight: '800', fontSize: '1.15rem', color: homeWin ? 'var(--color-primario)' : '#202124', minWidth: '20px', textAlign: 'center' }}>{p.home_score}</span>
                      <span style={{ color: '#9aa0a6', fontSize: '.85rem', fontWeight: '400' }}>-</span>
                      <span style={{ fontWeight: '800', fontSize: '1.15rem', color: awayWin ? 'var(--color-primario)' : '#202124', minWidth: '20px', textAlign: 'center' }}>{p.away_score}</span>
                    </div>
                    <div onClick={e => { e.stopPropagation(); abrirRoster({ id: p.away_team_id, name: p.away?.name, logo_url: p.away?.logo_url }) }}
                      style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                      <div style={{ width: '28px', height: '28px', borderRadius: '7px', overflow: 'hidden', flexShrink: 0 }}>
                        <TeamLogo logo_url={p.away?.logo_url} name={p.away?.name} size={28}/>
                      </div>
                      <span style={{ fontWeight: awayWin ? '800' : '500', color: awayWin ? '#202124' : '#5f6368', fontSize: '.9rem' }}>{p.away?.name}</span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'center', marginTop: '8px' }}>
                    <span style={{ fontSize: '.65rem', color: '#9aa0a6' }}>👆 Toca el partido para ver el resumen (goles y tarjetas)</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* PRÓXIMOS */}
        {tab === 'proximos' && (
          <div style={s.card}>
            <div style={s.cardTitle}>Próximos partidos</div>
            {partidosPendientes.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#9aa0a6' }}>No hay partidos programados</div>
            ) : partidosPendientes.map((p, i) => (
              <div key={p.id} style={{ padding: '14px 18px', borderTop: i > 0 ? '1px solid #f1f3f4' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  {p.matchday && <span style={{ fontSize: '.7rem', background: '#e8f0fe', color: '#1a73e8', borderRadius: '10px', padding: '2px 8px', fontWeight: '600' }}>J{p.matchday}</span>}
                  {p.fase && p.fase !== 'grupo' && <span style={{ fontSize: '.7rem', background: '#fce8d9', color: '#e8710a', borderRadius: '10px', padding: '2px 8px', fontWeight: '700' }}>{FASE_LABEL[p.fase]}</span>}
                  {p.played_at && (
                    <span style={{ fontSize: '.72rem', color: '#202124', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '3px' }}>
                      <Calendar size={10} color="#1a73e8"/>
                      {new Date(p.played_at).toLocaleDateString('es-CO', { weekday: 'short', day: '2-digit', month: 'short' })}
                      {' · '}
                      {fmtHoraDate(p.played_at)}
                    </span>
                  )}
                  {p.location && <span style={{ fontSize: '.72rem', color: '#9aa0a6', display: 'flex', alignItems: 'center', gap: '3px' }}><MapPin size={10}/>{p.location}</span>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div onClick={() => abrirRoster({ id: p.home_team_id, name: p.home?.name, logo_url: p.home?.logo_url })}
                    style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end', cursor: 'pointer' }}>
                    <span style={{ fontWeight: '600', color: '#202124', fontSize: '.9rem', textAlign: 'right' }}>{p.home?.name}</span>
                    <div style={{ width: '30px', height: '30px', borderRadius: '8px', overflow: 'hidden', flexShrink: 0 }}>
                      <TeamLogo logo_url={p.home?.logo_url} name={p.home?.name} size={30}/>
                    </div>
                  </div>
                  <span style={{ fontWeight: '700', color: '#9aa0a6', fontSize: '.9rem', flexShrink: 0, background: '#f1f3f4', padding: '4px 12px', borderRadius: '8px' }}>VS</span>
                  <div onClick={() => abrirRoster({ id: p.away_team_id, name: p.away?.name, logo_url: p.away?.logo_url })}
                    style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <div style={{ width: '30px', height: '30px', borderRadius: '8px', overflow: 'hidden', flexShrink: 0 }}>
                      <TeamLogo logo_url={p.away?.logo_url} name={p.away?.name} size={30}/>
                    </div>
                    <span style={{ fontWeight: '600', color: '#202124', fontSize: '.9rem' }}>{p.away?.name}</span>
                  </div>
                </div>
                <div style={{ textAlign: 'center', marginTop: '6px' }}>
                  <span style={{ fontSize: '.65rem', color: '#9aa0a6' }}>👆 Toca un equipo para ver sus jugadores registrados</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* GOLEADORES */}
        {tab === 'goleadores' && (
          <>
          <RankingPoster
            titulo="⚽ Top goleadores"
            statLabel="goles" statColor="#ffd54a"
            vacio="Sin estadísticas aún"
            rows={goleadores.map(g => ({
              id: `${g.player_id}-${g.team_id}`,
              nombre: g.player_name,
              foto: g.photo_url,
              teamName: g.team_name,
              teamLogo: g.team_logo,
              valor: g.total_goals,
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

      <RosterModal rosterModal={rosterModal} onClose={() => setRosterModal(null)} torneoNombre={torneo.name}/>
      <PartidoDetalleModal partido={partidoDetalle} onClose={() => setPartidoDetalle(null)}/>
    </div>
  )
}
