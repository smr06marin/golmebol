import { useEffect, useMemo, useState } from 'react'
import { X, Share2 } from 'lucide-react'
import { GiSoccerBall } from 'react-icons/gi'
import { supabase } from '../lib/supabase'
import { hydratePlayersPublico } from '../lib/playersPublico'
import {
  COLOR_TARJETA, FASE_LABEL, TIPOS_TARJETA, agruparGoles, construirResumen, ordenarEventos, penalesDe,
} from '../lib/resumenPartido'
import FlyerResultadoPartido from './FlyerResultadoPartido'

// Resumen de un partido YA JUGADO (se abre al tocar un resultado en la página
// pública del torneo): marcador, pestaña "Resumen" (quién anotó y las
// tarjetas), pestaña "Minuto a minuto" (línea de tiempo con el marcador que va
// cambiando) y el botón para crear el flyer que los equipos publican en redes.
// Todo sale de match_events, que se guarda apenas se cierra el partido, así
// que sigue disponible aunque pasen semanas.

const nombreDe = e => e.players?.name || e.player_nombre || 'Jugador'

function EscudoMini({ url, nombre, size = 42 }) {
  const iniciales = (nombre || '?').split(' ').filter(Boolean).map(w => w[0]).join('').substring(0, 2).toUpperCase()
  return (
    <div style={{ width: size, height: size, borderRadius: 10, overflow: 'hidden', margin: '0 auto' }}>
      {url
        ? <img src={url} alt={nombre} style={{ width: '100%', height: '100%', objectFit: 'contain' }}/>
        : (
          <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, #1a73e8, #6c35de)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: size * 0.32, fontWeight: 800, color: '#fff', fontFamily: 'system-ui' }}>{iniciales}</span>
          </div>
        )}
    </div>
  )
}

function IconoTarjeta({ color }) {
  return <span style={{ display: 'inline-block', width: 9, height: 13, borderRadius: 2, background: COLOR_TARJETA[color] || '#999', flexShrink: 0 }}/>
}

const etiquetaTiempo = periodo => (periodo >= 2 ? '2T' : '1T')

// ── Pestaña "Resumen": goles y tarjetas por equipo ─────────────────────────
function TabResumen({ partido, eventos }) {
  const ord = ordenarEventos(eventos)
  const goles = ord.filter(e => e.event_type === 'goal')
  const golesLocal = goles.filter(e => e.team_id === partido.home_team_id)
  const golesVis = goles.filter(e => e.team_id === partido.away_team_id)
  const tarjetas = ord.filter(e => TIPOS_TARJETA[e.event_type])
  const tarjetasLocal = tarjetas.filter(e => e.team_id === partido.home_team_id)
  const tarjetasVis = tarjetas.filter(e => e.team_id === partido.away_team_id)

  if (goles.length === 0 && tarjetas.length === 0) {
    return <div style={{ textAlign: 'center', color: '#9aa0a6', fontSize: '.85rem', padding: '20px 0' }}>No quedó registrado el detalle de goles ni tarjetas de este partido</div>
  }

  const titulo = { fontSize: '.62rem', fontWeight: 800, color: '#9aa0a6', letterSpacing: '.08em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }
  const filaIzq = { fontSize: '.78rem', color: '#202124', padding: '4px 0', display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }
  const filaDer = { ...filaIzq, justifyContent: 'flex-end', textAlign: 'right' }

  return (
    <>
      {goles.length > 0 && (
        <div style={{ marginBottom: 18 }}>
          <div style={titulo}><GiSoccerBall size={11} color="#9aa0a6"/> GOLES</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              {golesLocal.length === 0 && <div style={{ color: '#9aa0a6', fontSize: '.72rem' }}>—</div>}
              {agruparGoles(golesLocal, nombreDe).map((gg, i) => (
                <div key={i} style={filaIzq}>
                  {gg.jugador} {Array.from({ length: gg.cantidad }).map((_, j) => <GiSoccerBall key={j} size={10} color="#202124"/>)}
                  {gg.minutos.length > 0 && <span style={{ color: '#9aa0a6' }}>· {gg.minutos.join(', ')}</span>}
                </div>
              ))}
            </div>
            <div>
              {golesVis.length === 0 && <div style={{ color: '#9aa0a6', fontSize: '.72rem', textAlign: 'right' }}>—</div>}
              {agruparGoles(golesVis, nombreDe).map((gg, i) => (
                <div key={i} style={filaDer}>
                  {gg.minutos.length > 0 && <span style={{ color: '#9aa0a6' }}>{gg.minutos.join(', ')} ·</span>}
                  {gg.jugador} {Array.from({ length: gg.cantidad }).map((_, j) => <GiSoccerBall key={j} size={10} color="#202124"/>)}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tarjetas.length > 0 && (
        <div>
          <div style={titulo}><IconoTarjeta color="amarilla"/> TARJETAS</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              {tarjetasLocal.map(e => (
                <div key={e.id} style={{ ...filaIzq, flexWrap: 'nowrap' }}>
                  <IconoTarjeta color={TIPOS_TARJETA[e.event_type]}/> <span>{nombreDe(e)}</span>
                  {e.minute && <span style={{ color: '#9aa0a6' }}>· {e.minute}</span>}
                </div>
              ))}
            </div>
            <div>
              {tarjetasVis.map(e => (
                <div key={e.id} style={{ ...filaDer, flexWrap: 'nowrap' }}>
                  {e.minute && <span style={{ color: '#9aa0a6' }}>{e.minute} ·</span>}
                  <span>{nombreDe(e)}</span> <IconoTarjeta color={TIPOS_TARJETA[e.event_type]}/>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ── Pestaña "Minuto a minuto": línea de tiempo con marcador acumulado ───────
function IconoEvento({ tipo }) {
  if (tipo === 'gol') return <GiSoccerBall size={15} color="#202124"/>
  if (tipo === 'falta') return <span style={{ fontSize: '.6rem', fontWeight: 800, color: '#9aa0a6', border: '1px solid #dadce0', borderRadius: 4, padding: '0 3px', lineHeight: '14px' }}>F</span>
  return <IconoTarjeta color={tipo}/>
}

const TEXTO_TIPO = { gol: 'Gol', amarilla: 'Tarjeta amarilla', azul: 'Tarjeta azul', roja: 'Tarjeta roja' }

function CeldaEvento({ fila, derecha }) {
  const esGol = fila.tipo === 'gol'
  const esFalta = fila.tipo === 'falta'
  return (
    <div style={{ display: 'flex', flexDirection: derecha ? 'row-reverse' : 'row', alignItems: 'flex-start', gap: 8, padding: '9px 0' }}>
      <div style={{ paddingTop: 2, flexShrink: 0 }}><IconoEvento tipo={fila.tipo}/></div>
      <div style={{ minWidth: 0, textAlign: derecha ? 'right' : 'left', overflowWrap: 'anywhere' }}>
        <div style={{ fontSize: '.8rem', fontWeight: esGol ? 800 : 600, color: esFalta ? '#80868b' : '#202124', lineHeight: 1.25 }}>{fila.jugador}</div>
        <div style={{ fontSize: '.66rem', color: '#9aa0a6', marginTop: 1 }}>
          {esFalta ? `Falta n.º ${fila.numeroFalta} del equipo (${etiquetaTiempo(fila.periodo)})` : TEXTO_TIPO[fila.tipo]}
        </div>
        {esGol && <div style={{ fontSize: '.74rem', fontWeight: 800, color: 'var(--color-primario, #1a73e8)', marginTop: 2 }}>{fila.marcador}</div>}
      </div>
    </div>
  )
}

function FilaLinea({ fila, partido }) {
  if (fila.tipo === 'hito') {
    const esPenales = fila.id === 'hito-penales'
    const ganador = esPenales ? (fila.ganador === 'local' ? partido.home?.name : partido.away?.name) : null
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0' }}>
        <div style={{
          background: fila.final ? '#202124' : '#f1f3f4', color: fila.final ? '#fff' : '#5f6368', borderRadius: 20,
          padding: '5px 14px', fontSize: '.7rem', fontWeight: 800, letterSpacing: '.03em', textAlign: 'center',
        }}>
          {fila.texto}{fila.marcador ? ` · ${fila.marcador}` : ''}{ganador ? ` · gana ${ganador}` : ''}
        </div>
      </div>
    )
  }
  const centro = (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', paddingTop: 8 }}>
      <div style={{ position: 'absolute', left: '50%', marginLeft: -1, top: 0, bottom: 0, width: 2, background: '#e8eaed' }}/>
      <div style={{ position: 'relative', zIndex: 1, background: '#fff', border: '1px solid #dadce0', borderRadius: 8, padding: '2px 6px', textAlign: 'center', minWidth: 46 }}>
        <div style={{ fontSize: '.72rem', fontWeight: 800, color: '#202124', fontVariantNumeric: 'tabular-nums' }}>{fila.minuto || '—'}</div>
        <div style={{ fontSize: '.55rem', fontWeight: 700, color: '#9aa0a6' }}>{etiquetaTiempo(fila.periodo)}</div>
      </div>
    </div>
  )
  if (!fila.lado) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 76px 1fr' }}>
        <div/>
        {centro}
        <CeldaEvento fila={fila} derecha={false}/>
      </div>
    )
  }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 76px 1fr' }}>
      <div>{fila.lado === 'local' && <CeldaEvento fila={fila} derecha/>}</div>
      {centro}
      <div>{fila.lado === 'visitante' && <CeldaEvento fila={fila} derecha={false}/>}</div>
    </div>
  )
}

function TabMinutoAMinuto({ partido, eventos }) {
  const [verFaltas, setVerFaltas] = useState(false)
  const resumen = useMemo(() => construirResumen(partido, eventos, nombreDe, { incluirFaltas: verFaltas }), [partido, eventos, verFaltas])
  const eventosReales = resumen.filas.filter(f => f.tipo !== 'hito').length
  const hayAlgo = eventos.some(e => e.event_type === 'goal' || TIPOS_TARJETA[e.event_type])

  if (!hayAlgo && resumen.totalFaltas === 0) {
    return <div style={{ textAlign: 'center', color: '#9aa0a6', fontSize: '.85rem', padding: '20px 0' }}>No quedó registrado el minuto a minuto de este partido</div>
  }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 76px 1fr', marginBottom: 6 }}>
        <div style={{ textAlign: 'right', fontSize: '.7rem', fontWeight: 800, color: '#5f6368', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{partido.home?.name}</div>
        <div/>
        <div style={{ textAlign: 'left', fontSize: '.7rem', fontWeight: 800, color: '#5f6368', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{partido.away?.name}</div>
      </div>

      {resumen.totalFaltas > 0 && (
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 6 }}>
          <button type="button" onClick={() => setVerFaltas(v => !v)}
            style={{ background: verFaltas ? '#e8f0fe' : '#f1f3f4', color: verFaltas ? '#1a73e8' : '#5f6368', border: 'none', borderRadius: 16, padding: '5px 12px', cursor: 'pointer', fontSize: '.7rem', fontWeight: 700 }}>
            {verFaltas ? 'Ocultar faltas' : `Mostrar faltas (${resumen.totalFaltas})`}
          </button>
        </div>
      )}

      {resumen.filas.map(f => <FilaLinea key={f.id} fila={f} partido={partido}/>)}

      {resumen.detalleIncompleto && eventosReales > 0 && (
        <div style={{ marginTop: 12, background: '#fff8e1', color: '#8a6d00', borderRadius: 10, padding: '8px 12px', fontSize: '.72rem', textAlign: 'center' }}>
          El detalle registrado no suma todos los goles del marcador final.
        </div>
      )}
    </div>
  )
}

export default function PartidoDetalleModal({ partido, torneo, onClose }) {
  const [eventos, setEventos] = useState(null) // null = cargando
  const [errorCarga, setErrorCarga] = useState(null)
  const [tab, setTab] = useState('resumen')
  const [verFlyer, setVerFlyer] = useState(false)

  // Bloquear el scroll del fondo mientras el modal está abierto: si no, en
  // Android el gesto de scroll dentro del modal se "escapa" hacia la página
  // de atrás apenas llega al borde (scroll chaining) y rebota.
  useEffect(() => {
    if (!partido) return
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = original }
  }, [!!partido]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!partido) return
    // (el estado arranca en null/null: quien lo usa le pone key={partido.id}, así que cada partido es una instancia nueva)
    let activo = true
    // OJO: los nombres NO se piden con el embed players!player_id(name): al público la base le niega la
    // tabla "players" (solo puede leer la vista segura players_publico), y con el embed TODA la consulta
    // fallaba con "permission denied for table players". Se traen los eventos solos y los nombres aparte.
    supabase.from('match_events')
      .select('id, event_type, minute, periodo, team_id, player_id, player_nombre')
      .eq('match_id', partido.id)
      .then(async ({ data, error }) => {
        if (!activo) return
        if (error) { setErrorCarga(error.message); setEventos([]); return }
        let filas = data || []
        try { filas = await hydratePlayersPublico(filas, { columns: 'id, name' }) } catch { /* sin nombres: se muestran como "Jugador" o con player_nombre */ }
        if (!activo) return
        setEventos(filas)
      })
    return () => { activo = false }
  }, [partido?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!partido) return null

  const sinJuego = !!partido.tipo_resultado
  const cargado = eventos !== null && !errorCarga
  const penales = penalesDe(partido)

  const tabBtn = activo => ({
    flex: 1, padding: '9px 6px', border: 'none', cursor: 'pointer', borderRadius: 9, fontSize: '.8rem', fontWeight: 800,
    background: activo ? '#fff' : 'transparent', color: activo ? '#202124' : '#80868b',
    boxShadow: activo ? '0 1px 4px rgba(0,0,0,.14)' : 'none',
  })

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', zIndex: 520, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 540, maxHeight: '88vh', overflowY: 'auto', overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch', padding: '20px 20px 28px', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <div style={{ fontWeight: 800, color: '#202124', fontSize: '.95rem' }}>Resumen del partido</div>
            <div style={{ fontSize: '.72rem', color: '#9aa0a6', marginTop: 2 }}>
              {partido.played_at && new Date(partido.played_at).toLocaleDateString('es-CO', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
              {partido.matchday && ` · J${partido.matchday}`}
              {partido.fase && partido.fase !== 'grupo' && ` · ${FASE_LABEL[partido.fase]}`}
            </div>
          </div>
          <button onClick={onClose} aria-label="Cerrar" style={{ background: '#f1f3f4', border: 'none', borderRadius: '50%', width: 32, height: 32, cursor: 'pointer', color: '#5f6368', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={16}/>
          </button>
        </div>

        {/* Marcador */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 14, background: '#f8f9fa', borderRadius: 12, padding: 16 }}>
          <div style={{ flex: 1, textAlign: 'center', minWidth: 0 }}>
            <EscudoMini url={partido.home?.logo_url} nombre={partido.home?.name}/>
            <div style={{ fontWeight: 700, color: '#202124', fontSize: '.78rem', marginTop: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{partido.home?.name}</div>
          </div>
          <div style={{ textAlign: 'center', flexShrink: 0 }}>
            <div style={{ fontWeight: 900, fontSize: '1.5rem', color: '#202124' }}>{partido.home_score} - {partido.away_score}</div>
            {penales && <div style={{ fontSize: '.68rem', fontWeight: 800, color: '#5f6368', marginTop: 2 }}>Penales {penales.local} - {penales.visitante}</div>}
          </div>
          <div style={{ flex: 1, textAlign: 'center', minWidth: 0 }}>
            <EscudoMini url={partido.away?.logo_url} nombre={partido.away?.name}/>
            <div style={{ fontWeight: 700, color: '#202124', fontSize: '.78rem', marginTop: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{partido.away?.name}</div>
          </div>
        </div>

        {/* Flyer para redes */}
        <button type="button" onClick={() => setVerFlyer(true)} disabled={!cargado}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 16, border: 'none',
            borderRadius: 12, padding: '12px', cursor: cargado ? 'pointer' : 'default', color: '#fff', fontWeight: 800, fontSize: '.85rem',
            background: 'linear-gradient(135deg, var(--color-secundario, #1a3a8a), var(--color-primario, #1a73e8))', opacity: cargado ? 1 : 0.5,
          }}>
          <Share2 size={16}/> Crear flyer para mis redes
        </button>

        {partido.tipo_resultado && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ textAlign: 'center', fontWeight: 700, fontSize: '.8rem', color: partido.tipo_resultado === 'w' ? '#1e8e3e' : '#5f6368', background: partido.tipo_resultado === 'w' ? '#e6f4ea' : '#f1f3f4', borderRadius: 10, padding: '8px 12px', marginBottom: 12 }}>
              {partido.tipo_resultado === 'w' ? '🏆 Partido ganado por W' : '❌ Partido desierto'}
            </div>
            {partido.foto_w_url && (
              <div>
                <div style={{ fontSize: '.62rem', fontWeight: 800, color: '#9aa0a6', letterSpacing: '.08em', marginBottom: 8 }}>FOTO DEL EQUIPO QUE SE PRESENTÓ</div>
                <img src={partido.foto_w_url} alt="Equipo que se presentó" style={{ width: '100%', maxHeight: 320, objectFit: 'cover', borderRadius: 12 }}/>
              </div>
            )}
          </div>
        )}

        {!sinJuego && (
          <div style={{ display: 'flex', gap: 4, background: '#f1f3f4', borderRadius: 12, padding: 4, marginBottom: 16 }}>
            <button type="button" onClick={() => setTab('resumen')} style={tabBtn(tab === 'resumen')}>Resumen</button>
            <button type="button" onClick={() => setTab('minuto')} style={tabBtn(tab === 'minuto')}>Minuto a minuto</button>
          </div>
        )}

        {eventos === null ? (
          <div style={{ textAlign: 'center', color: '#9aa0a6', fontSize: '.85rem', padding: '20px 0' }}>Cargando...</div>
        ) : errorCarga ? (
          <div style={{ textAlign: 'center', color: '#d93025', fontSize: '.8rem', padding: '20px 14px', background: '#fce8e6', borderRadius: 10 }}>No se pudo cargar el detalle: {errorCarga}</div>
        ) : sinJuego ? null : tab === 'resumen' ? (
          <TabResumen partido={partido} eventos={eventos}/>
        ) : (
          <TabMinutoAMinuto partido={partido} eventos={eventos}/>
        )}
      </div>

      {verFlyer && cargado && (
        <div onClick={e => e.stopPropagation()}>
          <FlyerResultadoPartido partido={partido} torneo={torneo} eventos={eventos} nombreDe={nombreDe} onClose={() => setVerFlyer(false)}/>
        </div>
      )}
    </div>
  )
}
