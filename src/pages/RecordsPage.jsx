import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Menu, Search, User, X, ChevronRight, Calendar, Users, Shield, Trophy, BarChart3, Home, Radio,
  Target, Flame, Sparkles, Medal, Handshake, Zap, Rocket, Crown,
  Lock, Unlock, Gift, PartyPopper, CreditCard,
} from 'lucide-react'
// lucide-react es genérico y no tiene íconos de deporte (balón, arquero,
// camiseta, etc.) — para esos puntuales se usa react-icons/gi (Game Icons),
// que sí trae específicos de deporte, minimalistas y de un solo color.
import { GiSoccerBall, GiGoalKeeper, GiTShirt } from 'react-icons/gi'
import { supabase } from '../lib/supabase'
import TablaPosiciones from '../components/TablaPosiciones'
import { registrarVisita } from '../lib/visitas'
import { calcularRecordsAutomaticos } from '../lib/recordsAutomaticos'
import { derivarEnVivo, extraerGoles, extraerTarjetas } from '../lib/liveMatch'
import { getPuntosTorneo } from '../lib/puntosTorneo'

// Icono de cada récord automático (los históricos traen el suyo — texto libre
// desde la BD — o si no, uno de estos componentes SVG según el tipo)
const ICONOS_RECORD = {
  max_goleador: GiSoccerBall, goles_partido: Flame, hat_tricks: Sparkles, victorias: Medal,
  mas_partidos: GiTShirt, racha_vic: Flame, racha_gol: Flame, arcos_cero: GiGoalKeeper,
  fair_play: Handshake, partido_goles: Zap, goleada: Rocket, eq_goles: Shield, eq_victorias: Crown,
}

const S = {
  bg:     '#07070e',
  card:   '#0f1623',
  border: '#1e2d3d',
  gold:   '#f9a825',
  cyan:   '#00ddd0',
  green:  '#22c55e',
  text:   '#e8f4fd',
  muted:  '#7a9ab5',
}

function TeamShield({ logo_url, name, size = 24 }) {
  const iniciales = (name || '?').split(/\s+/).map(w => w[0]).join('').substring(0, 2).toUpperCase()
  return (
    <div style={{ width: size, height: size, borderRadius: '7px', background: '#fff', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {logo_url
        ? <img src={logo_url} alt={name || ''} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '2px' }}/>
        : <span style={{ fontSize: size * .34, fontWeight: 800, color: '#1a3a8a' }}>{iniciales}</span>}
    </div>
  )
}

function ProgramacionRow({ m }) {
  const fecha = m.played_at ? new Date(m.played_at) : null
  // Antes esto se fijaba en si home_score no era null — pero un partido
  // recién programado ya trae 0-0 por defecto en la base, así que salía
  // como "jugado" (0-0) sin fecha ni hora. El estado real es m.status.
  const jugado = m.status === 'finished'
  // En fase de eliminatorias (cuartos, semifinal, etc.) mostramos la ronda
  // en vez del nombre del torneo — así se distingue de qué partido se trata
  // y, si es ida y vuelta, cuál de las dos es (m.ronda ya viene como
  // "Semifinal" / "Semifinal (vuelta)").
  const etiqueta = (m.fase && m.fase !== 'grupo') ? (m.ronda || m.fase) : m.tournaments?.name
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 4px', borderTop: `1px solid ${S.border}` }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
          <TeamShield logo_url={m.home?.logo_url} name={m.home?.name} size={16}/>
          <span style={{ color: S.text, fontSize: '.74rem', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.home?.name}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <TeamShield logo_url={m.away?.logo_url} name={m.away?.name} size={16}/>
          <span style={{ color: S.text, fontSize: '.74rem', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.away?.name}</span>
        </div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        {jugado ? (
          <div style={{ color: '#fff', fontWeight: '900', fontSize: '.95rem' }}>{m.home_score} - {m.away_score}</div>
        ) : (
          <>
            <div style={{ color: S.green, fontWeight: '800', fontSize: '.68rem' }}>{fecha ? fecha.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }).toUpperCase() : 'S/F'}</div>
            <div style={{ color: S.muted, fontSize: '.64rem' }}>{fecha ? fecha.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) : ''}</div>
          </>
        )}
        {etiqueta && (
          <div style={{ color: S.cyan, fontSize: '.58rem', fontWeight: '700', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '110px' }}>{etiqueta}</div>
        )}
      </div>
    </div>
  )
}

// Carrusel genérico de swipe horizontal con puntos — usado para torneos
// activos y (si hace falta) otras vitrinas. La sección de récords sigue
// usando su propio <Carrusel> de siempre, sin tocarlo.
function SwipeCarousel({ items, renderItem, keyFn }) {
  const ref = useRef(null)
  const [idx, setIdx] = useState(0)
  const total = items.length

  function scrollTo(i) {
    const newIdx = Math.max(0, Math.min(i, total - 1))
    setIdx(newIdx)
    if (ref.current) ref.current.scrollTo({ left: newIdx * ref.current.offsetWidth, behavior: 'smooth' })
  }
  function handleScroll() {
    if (ref.current) setIdx(Math.round(ref.current.scrollLeft / ref.current.offsetWidth))
  }
  if (total === 0) return null
  return (
    <div>
      <div ref={ref} onScroll={handleScroll}
        style={{ display: 'flex', overflowX: 'auto', scrollSnapType: 'x mandatory', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
        <style>{`div::-webkit-scrollbar{display:none}`}</style>
        {items.map((item, i) => (
          <div key={keyFn ? keyFn(item, i) : i} style={{ minWidth: '100%', scrollSnapAlign: 'start', boxSizing: 'border-box' }}>
            {renderItem(item, i)}
          </div>
        ))}
      </div>
      {total > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '5px', marginTop: '10px' }}>
          {items.map((_, i) => (
            <div key={i} onClick={() => scrollTo(i)}
              style={{ width: i === idx ? '20px' : '6px', height: '6px', borderRadius: '3px', background: i === idx ? S.green : S.border, cursor: 'pointer', transition: 'all .2s', flexShrink: 0 }}/>
          ))}
        </div>
      )}
    </div>
  )
}

// Misma tabla azul de siempre, pero colapsable con un encabezado — para
// mostrar un grupo a la vez cuando el torneo tiene varios grupos.
function TablaColapsableRecords({ titulo, rows, defaultOpen = false }) {
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
        <span style={{ color: '#7fb3ff', flexShrink: 0, transition: 'transform .15s', display: 'inline-block', transform: abierto ? 'rotate(180deg)' : 'none' }}>▾</span>
      </button>
      {abierto && (
        <div style={{ marginTop: '8px' }}>
          <TablaPosiciones rows={rows}/>
        </div>
      )}
    </div>
  )
}

function RecordCard({ titulo, nombre, subtitulo, descripcion, color, icono }) {
  // icono puede ser: un componente SVG (récord automático conocido), un
  // string (emoji personalizado que cargó el admin para un récord histórico
  // — eso sigue siendo texto libre desde la BD, no se puede forzar a SVG),
  // o nada (usa el trofeo por defecto).
  const Icono = typeof icono === 'function' ? icono : null
  return (
    <div className="gm-fade" style={{
      width: '100%',
      background: '#0a0f1e',
      border: `2px solid ${color}`,
      borderRadius: '6px',
      overflow: 'hidden',
    }}>
      {/* Banda superior */}
      <div style={{ background: color, padding: '8px 14px', textAlign: 'center' }}>
        <div style={{ fontWeight: '900', fontSize: '.78rem', color: '#fff', letterSpacing: '1.5px', textTransform: 'uppercase', lineHeight: 1.3 }}>
          {titulo}
        </div>
      </div>
      {/* Cuerpo */}
      <div style={{ padding: '14px 16px 18px', textAlign: 'center' }}>
        <div className="gm-trofeo" style={{ fontSize: '1.8rem', marginBottom: '6px', display: 'flex', justifyContent: 'center' }}>
          {Icono ? <Icono size={30} color="#fff"/> : (icono || <Trophy size={30} color="#fff"/>)}
        </div>
        <div style={{ fontWeight: '900', fontSize: '1.4rem', color: '#fff', letterSpacing: '.04em', lineHeight: 1.2, marginBottom: '10px', textTransform: 'uppercase' }}>
          {nombre}
        </div>
        {subtitulo && (
          <div style={{ fontWeight: '700', fontSize: '.78rem', color: color, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: descripcion ? '6px' : '0' }}>
            {subtitulo}
          </div>
        )}
        {descripcion && (
          <div style={{ fontWeight: '600', fontSize: '.68rem', color: 'rgba(255,255,255,.5)', letterSpacing: '.5px', textTransform: 'uppercase' }}>
            {descripcion}
          </div>
        )}
      </div>
    </div>
  )
}

function Carrusel({ records }) {
  const ref   = useRef(null)
  const [idx, setIdx] = useState(0)
  const total = records.length

  function scrollTo(i) {
    const newIdx = Math.max(0, Math.min(i, total - 1))
    setIdx(newIdx)
    if (ref.current) {
      ref.current.scrollTo({ left: newIdx * ref.current.offsetWidth, behavior: 'smooth' })
    }
  }

  function handleScroll() {
    if (ref.current) {
      setIdx(Math.round(ref.current.scrollLeft / ref.current.offsetWidth))
    }
  }

  if (total === 0) return null

  return (
    <div>
      <div ref={ref} onScroll={handleScroll}
        style={{ display: 'flex', overflowX: 'auto', scrollSnapType: 'x mandatory', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
        <style>{`div::-webkit-scrollbar{display:none}`}</style>
        {records.map((r, i) => (
          <div key={r.id || i} style={{ minWidth: '100%', scrollSnapAlign: 'start', padding: '0 20px', boxSizing: 'border-box' }}>
            <RecordCard {...r} icono={r.icono || ICONOS_RECORD[r.id] || Trophy}/>
          </div>
        ))}
      </div>

      {/* Controles */}
      {total > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginTop: '18px' }}>
          <button onClick={() => scrollTo(idx - 1)} disabled={idx === 0}
            style={{ width: '36px', height: '36px', borderRadius: '50%', background: idx === 0 ? S.border : S.gold, border: 'none', cursor: idx === 0 ? 'default' : 'pointer', color: idx === 0 ? S.muted : '#000', fontSize: '1.2rem', fontWeight: '900', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            ‹
          </button>
          <div style={{ fontSize: '.75rem', color: S.muted, fontWeight: '700', minWidth: '50px', textAlign: 'center' }}>{idx + 1} / {total}</div>
          <button onClick={() => scrollTo(idx + 1)} disabled={idx === total - 1}
            style={{ width: '36px', height: '36px', borderRadius: '50%', background: idx === total - 1 ? S.border : S.gold, border: 'none', cursor: idx === total - 1 ? 'default' : 'pointer', color: idx === total - 1 ? S.muted : '#000', fontSize: '1.2rem', fontWeight: '900', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            ›
          </button>
        </div>
      )}

      {/* Dots */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '5px', marginTop: '12px', flexWrap: 'wrap', padding: '0 20px' }}>
        {records.map((_, i) => (
          <div key={i} onClick={() => scrollTo(i)}
            style={{ width: i === idx ? '20px' : '6px', height: '6px', borderRadius: '3px', background: i === idx ? S.gold : S.border, cursor: 'pointer', transition: 'all .2s', flexShrink: 0 }}/>
        ))}
      </div>
    </div>
  )
}

// ── Tarjeta grande de un torneo activo (carrusel destacado) ──
function TorneoFeaturedCard({ t, onVerTabla }) {
  const proximo = t.proximo
  return (
    <div style={{
      background: 'linear-gradient(135deg, #0c3018 0%, #071f10 65%, #051608 100%)',
      border: `1px solid ${S.green}55`, borderRadius: '18px', padding: '18px', margin: '0 2px',
      boxShadow: '0 6px 24px rgba(0,0,0,.35)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div style={{ width: '76px', height: '76px', borderRadius: '16px', background: '#fff', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 18px ${S.green}44` }}>
          {t.logo_url ? <img src={t.logo_url} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '5px' }}/> : <Trophy size={32} color="#1a3a8a"/>}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'inline-block', background: t.enElim ? S.gold : S.green, color: '#04220c', fontSize: '.62rem', fontWeight: '900', letterSpacing: '.06em', borderRadius: '20px', padding: '3px 10px', marginBottom: '6px' }}>
            {t.estado.toUpperCase()}
          </span>
          <div style={{ fontWeight: '900', color: '#fff', fontSize: '1.1rem', lineHeight: 1.2, textTransform: 'uppercase' }}>{t.name}</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
        {[
          { icono: <Users size={13} color={S.green}/>, val: t.equipos, label: 'EQUIPOS' },
          { icono: <Shield size={13} color={S.green}/>, val: t.estado, label: 'FASE' },
          { icono: <Calendar size={13} color={S.green}/>, val: t.totalPartidos, label: 'PARTIDOS' },
        ].map((st, i) => (
          <div key={i} style={{ flex: 1, textAlign: 'center', background: 'rgba(255,255,255,.05)', borderRadius: '10px', padding: '8px 4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', marginBottom: '2px' }}>{st.icono}</div>
            <div style={{ color: '#fff', fontWeight: '800', fontSize: '.78rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{st.val}</div>
            <div style={{ color: 'rgba(255,255,255,.5)', fontSize: '.58rem', fontWeight: '700', letterSpacing: '.05em' }}>{st.label}</div>
          </div>
        ))}
      </div>

      <button onClick={() => onVerTabla(t)}
        style={{ width: '100%', marginTop: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', background: S.green, border: 'none', borderRadius: '10px', padding: '12px', cursor: 'pointer', color: '#04220c', fontWeight: '900', fontSize: '.85rem' }}>
        VER TORNEO <ChevronRight size={16}/>
      </button>

      {proximo && (
        <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
          <div style={{ fontSize: '.66rem', color: 'rgba(255,255,255,.65)', fontWeight: '700' }}>
            PRÓXIMO PARTIDO{proximo.played_at ? ` · ${new Date(proximo.played_at).toLocaleDateString('es-CO', { weekday: 'short', day: '2-digit', month: 'short' }).toUpperCase()} - ${new Date(proximo.played_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}` : ''}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <TeamShield logo_url={proximo.home?.logo_url} name={proximo.home?.name} size={20}/>
            <span style={{ color: 'rgba(255,255,255,.5)', fontSize: '.6rem', fontWeight: '800' }}>VS</span>
            <TeamShield logo_url={proximo.away?.logo_url} name={proximo.away?.name} size={20}/>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Tarjeta grande de partido en vivo ──
// Etiqueta corta del momento del partido: "1T · 12:34", "2T · 12:34" o "DESCANSO"
function labelTiempo(vivo, corto = false) {
  if (vivo.descanso) return 'DESCANSO'
  const per = vivo.periodo === 2 ? '2T' : '1T'
  return corto ? `${per} · ${vivo.reloj.split(':')[0]}'` : `${per} · ${vivo.reloj}`
}

function LiveMatchFeatured({ m, onClick }) {
  return (
    <div onClick={onClick} style={{ background: 'linear-gradient(135deg,#1a0505,#0a0a0a)', border: '1px solid #7a1f1f', borderRadius: '16px', padding: '18px', textAlign: 'center', cursor: 'pointer' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '20px' }}>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <TeamShield logo_url={m.home?.logo_url} name={m.home?.name} size={48}/>
          <div style={{ color: '#fff', fontWeight: '800', fontSize: '.72rem', marginTop: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.home?.name}</div>
        </div>
        <div>
          <div style={{ color: '#fff', fontWeight: '900', fontSize: '1.8rem', letterSpacing: '.05em' }}>{m.vivo.golesLocal} - {m.vivo.golesVis}</div>
          <div style={{ color: m.vivo.descanso ? '#f9a825' : '#ff5252', fontWeight: '800', fontSize: '.78rem', marginTop: '2px' }}>{labelTiempo(m.vivo)}</div>
        </div>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <TeamShield logo_url={m.away?.logo_url} name={m.away?.name} size={48}/>
          <div style={{ color: '#fff', fontWeight: '800', fontSize: '.72rem', marginTop: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.away?.name}</div>
        </div>
      </div>
      {m.tournaments?.modalidad && (
        <div style={{ marginTop: '10px', color: 'rgba(255,255,255,.5)', fontSize: '.64rem', fontWeight: '700', letterSpacing: '.08em' }}>{m.tournaments.modalidad.toUpperCase()}</div>
      )}
      <div style={{ marginTop: '6px', color: 'rgba(255,255,255,.4)', fontSize: '.6rem', fontWeight: '600', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>Toca para ver los goles <GiSoccerBall size={11}/></div>
    </div>
  )
}

function LiveMatchRow({ m, onClick }) {
  return (
    <div onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 0', borderTop: `1px solid ${S.border}`, cursor: 'pointer' }}>
      <TeamShield logo_url={m.home?.logo_url} name={m.home?.name} size={18}/>
      <span style={{ flex: 1, color: S.text, fontSize: '.75rem', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.home?.name}</span>
      <span style={{ color: '#fff', fontWeight: '800', fontSize: '.8rem' }}>{m.vivo.golesLocal}</span>
      <span style={{ color: S.muted, fontSize: '.7rem' }}>-</span>
      <span style={{ color: '#fff', fontWeight: '800', fontSize: '.8rem' }}>{m.vivo.golesVis}</span>
      <span style={{ flex: 1, color: S.text, fontSize: '.75rem', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.away?.name}</span>
      <TeamShield logo_url={m.away?.logo_url} name={m.away?.name} size={18}/>
      <span style={{ color: m.vivo.descanso ? '#f9a825' : '#ff5252', fontWeight: '800', fontSize: '.68rem', minWidth: '52px', textAlign: 'right' }}>{labelTiempo(m.vivo, true)}</span>
    </div>
  )
}

// ── Detalle de un partido en vivo: marcador, reloj y lista de goles ──
const COLOR_TARJETA = { amarilla: '#f9c400', azul: '#1a73e8', roja: '#d93025' }
function IconoTarjeta({ color }) {
  return <span style={{ display: 'inline-block', width: '9px', height: '13px', borderRadius: '2px', background: COLOR_TARJETA[color] || '#999', flexShrink: 0 }}/>
}

function LiveMatchDetalle({ m, onClose }) {
  const goles = extraerGoles(m)
  const golesLocal = goles.filter(g => g.equipo === 'local')
  const golesVis    = goles.filter(g => g.equipo === 'visitante')
  const tarjetas = extraerTarjetas(m)
  const tarjetasLocal = tarjetas.filter(t => t.equipo === 'local')
  const tarjetasVis    = tarjetas.filter(t => t.equipo === 'visitante')
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)', zIndex: 560, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: S.bg, border: `1px solid ${S.border}`, borderRadius: '18px 18px 0 0', width: '100%', maxWidth: '480px', maxHeight: '85vh', overflowY: 'auto', padding: '18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <span style={{ fontWeight: '900', color: m.vivo.descanso ? '#f9a825' : '#ff5252', fontSize: '.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}><Radio size={14}/> {m.vivo.descanso ? 'DESCANSO' : `EN VIVO · ${labelTiempo(m.vivo)}`}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: S.muted, cursor: 'pointer', display: 'flex' }}><X size={18}/></button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '20px', marginBottom: '18px' }}>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <TeamShield logo_url={m.home?.logo_url} name={m.home?.name} size={46}/>
            <div style={{ color: '#fff', fontWeight: '800', fontSize: '.75rem', marginTop: '6px' }}>{m.home?.name}</div>
          </div>
          <div style={{ color: '#fff', fontWeight: '900', fontSize: '1.6rem' }}>{m.vivo.golesLocal} - {m.vivo.golesVis}</div>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <TeamShield logo_url={m.away?.logo_url} name={m.away?.name} size={46}/>
            <div style={{ color: '#fff', fontWeight: '800', fontSize: '.75rem', marginTop: '6px' }}>{m.away?.name}</div>
          </div>
        </div>

        {goles.length === 0 ? (
          <div style={{ textAlign: 'center', color: S.muted, fontSize: '.8rem', padding: '20px 0' }}>Aún no hay goles</div>
        ) : (
          <div>
            <div style={{ fontSize: '.62rem', fontWeight: '800', color: S.muted, letterSpacing: '.08em', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '5px' }}><GiSoccerBall size={11} color={S.muted}/> GOLES</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                {golesLocal.length === 0 && <div style={{ color: S.muted, fontSize: '.72rem' }}>—</div>}
                {golesLocal.map((g, i) => (
                  <div key={i} style={{ fontSize: '.78rem', color: S.text, padding: '4px 0', display: 'flex', alignItems: 'center', gap: '5px' }}><GiSoccerBall size={10} color={S.text}/> {g.jugador} {g.minuto ? <span style={{ color: S.muted }}>· {g.minuto}'</span> : null}</div>
                ))}
              </div>
              <div style={{ textAlign: 'right' }}>
                {golesVis.length === 0 && <div style={{ color: S.muted, fontSize: '.72rem' }}>—</div>}
                {golesVis.map((g, i) => (
                  <div key={i} style={{ fontSize: '.78rem', color: S.text, padding: '4px 0', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '5px' }}>{g.minuto ? <span style={{ color: S.muted }}>{g.minuto}' ·</span> : null} {g.jugador} <GiSoccerBall size={10} color={S.text}/></div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tarjetas.length > 0 && (
          <div style={{ marginTop: '18px' }}>
            <div style={{ fontSize: '.62rem', fontWeight: '800', color: S.muted, letterSpacing: '.08em', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}><IconoTarjeta color="amarilla"/> TARJETAS</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                {tarjetasLocal.map((t, i) => (
                  <div key={i} style={{ fontSize: '.78rem', color: S.text, padding: '4px 0', display: 'flex', alignItems: 'center', gap: '6px' }}><IconoTarjeta color={t.color}/> {t.jugador} {t.minuto ? <span style={{ color: S.muted }}>· {t.minuto}'</span> : null}</div>
                ))}
              </div>
              <div style={{ textAlign: 'right' }}>
                {tarjetasVis.map((t, i) => (
                  <div key={i} style={{ fontSize: '.78rem', color: S.text, padding: '4px 0', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>{t.minuto ? <span style={{ color: S.muted }}>{t.minuto}' ·</span> : null} {t.jugador} <IconoTarjeta color={t.color}/></div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Buscador simple de jugadores/equipos por nombre ──
function BuscadorSimple({ onClose }) {
  const [q, setQ] = useState('')
  const [jugadores, setJugadores] = useState([])
  const [equipos, setEquipos] = useState([])
  const [buscando, setBuscando] = useState(false)

  useEffect(() => {
    const texto = q.trim()
    if (texto.length < 2) { setJugadores([]); setEquipos([]); return }
    setBuscando(true)
    const t = setTimeout(async () => {
      const [{ data: js }, { data: es }] = await Promise.all([
        supabase.from('players_publico').select('id, name, photo_face_url, photo_url').ilike('name', `%${texto}%`).limit(8),
        supabase.from('teams').select('id, name, logo_url').ilike('name', `%${texto}%`).limit(8),
      ])
      setJugadores(js || [])
      setEquipos(es || [])
      setBuscando(false)
    }, 350)
    return () => clearTimeout(t)
  }, [q])

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.8)', zIndex: 600, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '16px' }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: S.bg, border: `1px solid ${S.border}`, borderRadius: '16px', width: '100%', maxWidth: '480px', maxHeight: '85vh', overflowY: 'auto', marginTop: '40px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 16px', borderBottom: `1px solid ${S.border}`, position: 'sticky', top: 0, background: S.bg }}>
          <Search size={16} color={S.muted}/>
          <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar jugador o equipo..."
            style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: S.text, fontSize: '.9rem' }}/>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: S.muted, cursor: 'pointer', display: 'flex' }}><X size={18}/></button>
        </div>
        <div style={{ padding: '10px 16px 24px' }}>
          {q.trim().length < 2 ? (
            <div style={{ padding: '30px 0', textAlign: 'center', color: S.muted, fontSize: '.8rem' }}>Escribe al menos 2 letras...</div>
          ) : buscando ? (
            <div style={{ padding: '30px 0', textAlign: 'center', color: S.cyan, fontSize: '.8rem' }}>Buscando...</div>
          ) : (jugadores.length === 0 && equipos.length === 0) ? (
            <div style={{ padding: '30px 0', textAlign: 'center', color: S.muted, fontSize: '.8rem' }}>Sin resultados</div>
          ) : (
            <>
              {equipos.length > 0 && (
                <div style={{ marginBottom: '14px' }}>
                  <div style={{ fontSize: '.62rem', fontWeight: '800', color: S.muted, letterSpacing: '.08em', margin: '10px 0 6px' }}>EQUIPOS</div>
                  {equipos.map(e => (
                    <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 6px', borderRadius: '10px' }}>
                      <TeamShield logo_url={e.logo_url} name={e.name} size={30}/>
                      <span style={{ color: S.text, fontWeight: '600', fontSize: '.85rem' }}>{e.name}</span>
                    </div>
                  ))}
                </div>
              )}
              {jugadores.length > 0 && (
                <div>
                  <div style={{ fontSize: '.62rem', fontWeight: '800', color: S.muted, letterSpacing: '.08em', margin: '10px 0 6px' }}>JUGADORES</div>
                  {jugadores.map(j => (
                    <div key={j.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 6px', borderRadius: '10px' }}>
                      <div style={{ width: '30px', height: '30px', borderRadius: '50%', overflow: 'hidden', flexShrink: 0, background: S.card, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {(j.photo_face_url || j.photo_url) ? <img src={j.photo_face_url || j.photo_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/> : <User size={14} color={S.muted}/>}
                      </div>
                      <span style={{ color: S.text, fontWeight: '600', fontSize: '.85rem' }}>{j.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Menú lateral (hamburguesa / "Más") ──
function DrawerMenu({ onClose, onIrTorneos, onIrRecords, navigate }) {
  const opciones = [
    { label: 'Torneos', icono: <Trophy size={16} color={S.green}/>, onClick: onIrTorneos },
    { label: 'Estadísticas y récords', icono: <BarChart3 size={16} color={S.gold}/>, onClick: onIrRecords },
    { label: 'Ingresar al portal (jugador / árbitro / escuela)', icono: <User size={16} color={S.cyan}/>, onClick: () => navigate('/jugador/login') },
    { label: 'Acceso administrador', icono: <Shield size={16} color={S.muted}/>, onClick: () => navigate('/login') },
  ]
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 600, display: 'flex' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.6)' }}/>
      <div style={{ position: 'relative', width: '78%', maxWidth: '300px', height: '100%', background: S.bg, borderRight: `1px solid ${S.border}`, padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
          <span style={{ fontWeight: '900', color: S.cyan, letterSpacing: '.15em', fontSize: '1rem' }}>GOLMEBOL</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: S.muted, cursor: 'pointer', display: 'flex' }}><X size={20}/></button>
        </div>
        {opciones.map(o => (
          <button key={o.label} onClick={() => { o.onClick(); onClose() }}
            style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'none', border: 'none', borderRadius: '10px', padding: '13px 10px', cursor: 'pointer', color: S.text, fontSize: '.85rem', fontWeight: '600', textAlign: 'left' }}>
            {o.icono}{o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

// Pantalla de bienvenida con los campeones de los últimos 15 días
function SplashCampeones({ campeones, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 9000)
    return () => clearTimeout(t)
  }, [])
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'radial-gradient(circle at 50% 28%, #1c1305, #07070e 72%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', overflowY: 'auto' }}>
      <style>{`
        @keyframes splashPop  { 0% { transform: scale(.55); opacity: 0 } 65% { transform: scale(1.07) } 100% { transform: scale(1); opacity: 1 } }
        @keyframes splashGlow { 0%,100% { box-shadow: 0 0 26px rgba(249,168,37,.35) } 50% { box-shadow: 0 0 64px rgba(249,168,37,.75) } }
        @keyframes splashFloat { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-7px) } }
      `}</style>
      <div style={{ marginBottom: '4px', animation: 'splashFloat 2.4s ease-in-out infinite', display: 'flex', justifyContent: 'center' }}><Trophy size={42} color={S.gold}/></div>
      <div style={{ fontWeight: '900', letterSpacing: '4px', color: S.gold, fontSize: '1.15rem', marginBottom: '4px', textAlign: 'center' }}>
        {campeones.length > 1 ? '¡TENEMOS CAMPEONES!' : '¡TENEMOS CAMPEÓN!'}
      </div>
      <div style={{ color: S.muted, fontSize: '.72rem', letterSpacing: '2px', marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}><PartyPopper size={13}/> FELICITACIONES <PartyPopper size={13}/></div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '18px', justifyContent: 'center', maxWidth: '760px' }}>
        {campeones.map((c, i) => {
          const iniciales = (c.team_name || '?').split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase()
          return (
            <div key={`${c.team_id}-${c.tournament_id}`} style={{ animation: `splashPop .7s ease ${i * 0.25}s both`, background: S.card, border: `2px solid ${S.gold}`, borderRadius: '18px', padding: '28px 32px', textAlign: 'center', minWidth: '230px', maxWidth: '300px' }}>
              <div style={{ width: '116px', height: '116px', borderRadius: '50%', margin: '0 auto 16px', background: '#0a0f1e', border: `3px solid ${S.gold}`, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'splashGlow 2.2s ease-in-out infinite' }}>
                {c.logo_url
                  ? <img src={c.logo_url} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '10px' }}/>
                  : <span style={{ fontSize: '2.4rem', fontWeight: '900', color: S.gold }}>{iniciales}</span>}
              </div>
              <div style={{ fontWeight: '900', fontSize: '1.25rem', color: '#fff', textTransform: 'uppercase', letterSpacing: '.05em', lineHeight: 1.2 }}>{c.team_name}</div>
              <div style={{ marginTop: '8px', color: '#000', background: S.gold, display: 'inline-block', borderRadius: '20px', padding: '3px 14px', fontWeight: '900', fontSize: '.68rem', letterSpacing: '2px' }}>CAMPEÓN</div>
              <div style={{ marginTop: '8px', color: S.muted, fontSize: '.78rem' }}>del torneo</div>
              <div style={{ color: S.cyan, fontWeight: '700', fontSize: '.85rem', marginTop: '2px' }}>{c.tournament_name}</div>
            </div>
          )
        })}
      </div>
      <button onClick={onClose}
        style={{ marginTop: '30px', background: S.gold, color: '#000', border: 'none', borderRadius: '10px', padding: '13px 42px', fontWeight: '900', letterSpacing: '2px', fontSize: '.85rem', cursor: 'pointer' }}>
        ENTRAR →
      </button>
    </div>
  )
}

export default function RecordsPage() {
  const navigate = useNavigate()
  const [loading,  setLoading]  = useState(true)
  const [records,  setRecords]  = useState([])
  const [campeones,  setCampeones]  = useState([])
  const [showSplash, setShowSplash] = useState(false)
  // Torneos activos (vitrina pública) y tabla de posiciones del torneo elegido
  const [torneosActivos, setTorneosActivos] = useState([])
  const [torneoTabla,    setTorneoTabla]    = useState(null) // { torneo, filas } | 'cargando'
  // Stats del encabezado, partidos en vivo, chrome nuevo (buscador/menú)
  const [stats, setStats] = useState({ torneos: 0, jugadores: 0, equipos: 0, goles: 0 })
  const [matchesVivoRaw, setMatchesVivoRaw] = useState([])
  const [showBuscador, setShowBuscador] = useState(false)
  const [showDrawer,   setShowDrawer]   = useState(false)
  const [showVivoModal, setShowVivoModal] = useState(false)
  const [detalleVivoId, setDetalleVivoId] = useState(null)
  const [tick, setTick] = useState(0) // fuerza recalcular el reloj de "en vivo" cada segundo
  // Dentro del modal de un torneo (torneoTabla): alternar entre ver la tabla
  // de posiciones y la programación (jugados / por jugar) de ESE torneo.
  const [torneoTablaTab, setTorneoTablaTab] = useState('tabla') // 'tabla' | 'programacion'
  const [torneoProgFiltro, setTorneoProgFiltro] = useState('proximos') // 'proximos' | 'jugados'

  const torneosRef = useRef(null)
  const recordsRef = useRef(null)

  useEffect(() => {
    fetchTodo(); fetchCampeonesRecientes(); fetchTorneosActivos(); fetchStats(); fetchPartidosVivo()
    registrarVisita('inicio')
  }, [])

  // Reloj de los partidos en vivo: recalcula localmente cada segundo (sin
  // pegarle a la base de datos), y cada 20s sí refresca de verdad por si
  // hubo un gol nuevo, terminó el partido, o empezó uno nuevo.
  useEffect(() => {
    const tRelog = setInterval(() => setTick(x => x + 1), 1000)
    const tRefetch = setInterval(fetchPartidosVivo, 20000)
    return () => { clearInterval(tRelog); clearInterval(tRefetch) }
  }, [])

  // Además del poll de 20s (respaldo), escuchar por websocket cualquier
  // cambio en matches (ej. el árbitro marca un gol en la planilla) y
  // refrescar casi al instante, para que el gol salga en vivo sin esperar.
  const refetchVivoTimer = useRef(null)
  useEffect(() => {
    const channel = supabase
      .channel('records-partidos-vivo')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, () => {
        clearTimeout(refetchVivoTimer.current)
        refetchVivoTimer.current = setTimeout(fetchPartidosVivo, 400)
      })
      .subscribe()
    return () => { clearTimeout(refetchVivoTimer.current); supabase.removeChannel(channel) }
  }, [])

  const partidosVivo = useMemo(() => {
    void tick
    return matchesVivoRaw.map(m => ({ ...m, vivo: derivarEnVivo(m) })).filter(m => m.vivo)
  }, [matchesVivoRaw, tick])

  async function fetchPartidosVivo() {
    const { data } = await supabase.from('matches')
      .select('id, tournament_id, status, live_state, live_state_updated_at, live_state_rapida, live_state_rapida_updated_at, home:home_team_id(name,logo_url), away:away_team_id(name,logo_url), tournaments(name, modalidad)')
      .eq('status', 'scheduled')
      .or('live_state.not.is.null,live_state_rapida.not.is.null')
    setMatchesVivoRaw(data || [])
  }

  // ── Estadísticas rápidas del encabezado ──
  async function fetchStats() {
    const [{ count: cTorneos }, { count: cJugadores }, { count: cEquipos }, { data: golesData }] = await Promise.all([
      supabase.from('tournaments').select('id', { count: 'exact', head: true }),
      supabase.from('players_publico').select('id', { count: 'exact', head: true }),
      supabase.from('teams').select('id', { count: 'exact', head: true }),
      supabase.from('matches').select('home_score, away_score').eq('status', 'finished'),
    ])
    const goles = (golesData || []).reduce((s, m) => s + (m.home_score || 0) + (m.away_score || 0), 0)
    setStats({ torneos: cTorneos || 0, jugadores: cJugadores || 0, equipos: cEquipos || 0, goles })
  }

  // ── TORNEOS ACTIVOS ────────────────────────────────────────────────────────
  async function fetchTorneosActivos() {
    // pts_victoria/pts_empate/pts_derrota son columnas nuevas (migracion_sistema_puntos.sql);
    // si todavía no se corrió esa migración en Supabase, se reintenta sin
    // ellas para no dejar la vitrina de torneos vacía por un error de columna.
    let torsRes = await supabase.from('tournaments').select('id, name, logo_url, modalidad, season, fase_actual, pts_victoria, pts_empate, pts_derrota').eq('status', 'active')
    if (torsRes.error) torsRes = await supabase.from('tournaments').select('id, name, logo_url, modalidad, season, fase_actual').eq('status', 'active')
    const [{ data: tts }, { data: ms }] = await Promise.all([
      supabase.from('tournament_teams').select('tournament_id'),
      supabase.from('matches').select('tournament_id, matchday, fase, status, played_at, home:home_team_id(name,logo_url), away:away_team_id(name,logo_url)'),
    ])
    const tors = torsRes.data
    const cuentaEq = {}
    ;(tts || []).forEach(t => { cuentaEq[t.tournament_id] = (cuentaEq[t.tournament_id] || 0) + 1 })
    const FASES = { octavos: 'Octavos de final', cuartos: 'Cuartos de final', semifinal: 'Semifinales', final: '¡Gran Final!' }
    const PESO  = { octavos: 1, cuartos: 2, semifinal: 3, final: 4 }
    setTorneosActivos((tors || []).map(t => {
      const mts = (ms || []).filter(m => m.tournament_id === t.id)
      const elim = mts.filter(m => m.fase && m.fase !== 'grupo').sort((a, b) => (PESO[b.fase] || 0) - (PESO[a.fase] || 0))[0]
      const maxFecha = Math.max(0, ...mts.filter(m => m.matchday).map(m => m.matchday))
      const estado = elim ? (FASES[elim.fase] || 'Eliminatorias') : maxFecha > 0 ? `Fecha ${maxFecha}` : 'Por comenzar'
      const proximo = mts.filter(m => m.status !== 'finished').sort((a, b) => {
        if (!a.played_at && !b.played_at) return 0
        if (!a.played_at) return 1
        if (!b.played_at) return -1
        return new Date(a.played_at) - new Date(b.played_at)
      })[0]
      return { ...t, equipos: cuentaEq[t.id] || 0, estado, enElim: !!elim, totalPartidos: mts.length, proximo }
    }))
  }

  // Tabla de posiciones PÚBLICA del torneo (solo la clasificación)
  async function abrirTablaTorneo(t) {
    setTorneoTabla('cargando')
    setTorneoTablaTab('tabla')
    setTorneoProgFiltro('proximos')
    registrarVisita('tabla_torneo', t.id)
    const [{ data: tts }, { data: ms }, { data: grps }, { data: golData }] = await Promise.all([
      supabase.from('tournament_teams').select('*, teams(id, name, logo_url)').eq('tournament_id', t.id),
      supabase.from('matches').select('id, home_team_id, away_team_id, home_score, away_score, status, fase, ronda, played_at').eq('tournament_id', t.id),
      supabase.from('tournament_grupos').select('*').eq('tournament_id', t.id).order('orden'),
      supabase.from('goleadores_por_torneo').select('*').eq('tournament_id', t.id).gt('total_goals', 0).order('total_goals', { ascending: false }).limit(5),
    ])
    let ge = []
    if (grps?.length) {
      const { data: geData } = await supabase.from('grupo_equipos').select('*').in('grupo_id', grps.map(g => g.id))
      ge = geData || []
    }
    const equiposMap = {}
    ;(tts || []).forEach(r => { if (r.teams) equiposMap[r.teams.id] = r.teams })
    const tabla = {}
    Object.values(equiposMap).forEach(eq => { tabla[eq.id] = { equipo: eq, pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, pts: 0 } })
    const Ppts = getPuntosTorneo(t)
    ;(ms || []).filter(m => m.status === 'finished' && (!m.fase || m.fase === 'grupo')).forEach(m => {
      const L = tabla[m.home_team_id], V = tabla[m.away_team_id]
      if (L) { L.pj++; L.gf += m.home_score || 0; L.gc += m.away_score || 0
        if (m.home_score > m.away_score) { L.pg++; L.pts += Ppts.victoria } else if (m.home_score === m.away_score) { L.pe++; L.pts += Ppts.empate } else { L.pp++; L.pts += Ppts.derrota } }
      if (V) { V.pj++; V.gf += m.away_score || 0; V.gc += m.home_score || 0
        if (m.away_score > m.home_score) { V.pg++; V.pts += Ppts.victoria } else if (m.away_score === m.home_score) { V.pe++; V.pts += Ppts.empate } else { V.pp++; V.pts += Ppts.derrota } }
    })
    const filas = Object.values(tabla).sort((a, b) => b.pts - a.pts || (b.gf - b.gc) - (a.gf - a.gc))
    setTorneoTabla({ torneo: t, filas, grupos: grps || [], grupoEquipos: ge, partidos: ms || [], equiposMap, goleadores: golData || [] })
  }

  // Tabla de un grupo específico — solo cuenta partidos entre equipos de ese
  // mismo grupo en fase de grupos.
  function getTablaGrupoRecords(grupoId, tt) {
    const eqIds = tt.grupoEquipos.filter(ge => ge.grupo_id === grupoId).map(ge => ge.team_id)
    const partGrupo = tt.partidos.filter(m => (!m.fase || m.fase === 'grupo') && eqIds.includes(m.home_team_id) && eqIds.includes(m.away_team_id))
    const t = {}
    const Ppts = getPuntosTorneo(tt.torneo)
    eqIds.forEach(eid => { if (tt.equiposMap[eid]) t[eid] = { equipo: tt.equiposMap[eid], pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, pts: 0 } })
    partGrupo.filter(m => m.status === 'finished').forEach(m => {
      if (t[m.home_team_id]) {
        const L = t[m.home_team_id]
        L.pj++; L.gf += m.home_score || 0; L.gc += m.away_score || 0
        if (m.home_score > m.away_score) { L.pg++; L.pts += Ppts.victoria } else if (m.home_score === m.away_score) { L.pe++; L.pts += Ppts.empate } else { L.pp++; L.pts += Ppts.derrota }
      }
      if (t[m.away_team_id]) {
        const V = t[m.away_team_id]
        V.pj++; V.gf += m.away_score || 0; V.gc += m.home_score || 0
        if (m.away_score > m.home_score) { V.pg++; V.pts += Ppts.victoria } else if (m.away_score === m.home_score) { V.pe++; V.pts += Ppts.empate } else { V.pp++; V.pts += Ppts.derrota }
      }
    })
    return Object.values(t).sort((a, b) => b.pts - a.pts || (b.gf - b.gc) - (a.gf - a.gc))
  }

  // Campeones coronados en los últimos 15 días (se muestran a todo el que entre)
  async function fetchCampeonesRecientes() {
    if (sessionStorage.getItem('golmebol_splash_campeones')) return
    const desde = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString()
    const { data } = await supabase.from('tournament_logros')
      .select('team_id, tournament_id, created_at, teams(name, logo_url), tournaments(name)')
      .eq('tipo', 'campeon')
      .not('team_id', 'is', null)
      .gte('created_at', desde)
      .order('created_at', { ascending: false })
    const unicos = []
    ;(data || []).forEach(l => {
      if (!unicos.some(u => u.team_id === l.team_id && u.tournament_id === l.tournament_id)) {
        unicos.push({ team_id: l.team_id, tournament_id: l.tournament_id, team_name: l.teams?.name, logo_url: l.teams?.logo_url, tournament_name: l.tournaments?.name })
      }
    })
    if (unicos.length > 0) { setCampeones(unicos); setShowSplash(true) }
  }

  function cerrarSplash() {
    sessionStorage.setItem('golmebol_splash_campeones', '1')
    setShowSplash(false)
  }

  async function fetchTodo() {
    setLoading(true)
    const [recsAuto, recsHist, ocultos] = await Promise.all([fetchAutomaticos(), fetchHistoricos(), fetchOcultos()])
    const visibles = (recsAuto || []).filter(r => !ocultos.has(r.id))
    setRecords([...visibles, ...(recsHist || [])])
    setLoading(false)
  }

  // Récords automáticos que el admin apagó manualmente (aunque haya datos, no se muestran)
  async function fetchOcultos() {
    const { data } = await supabase.from('records_config').select('id').eq('visible', false)
    return new Set((data || []).map(r => r.id))
  }

  async function fetchHistoricos() {
    const { data } = await supabase
      .from('records_historicos')
      .select('*')
      .eq('activo', true)
      .order('orden')
    return data || []
  }

  // El cálculo en sí vive en lib/recordsAutomaticos.js (compartido con el admin,
  // que lo usa para mostrarle al admin qué dato real se mostraría antes de decidir
  // si oculta cada récord).
  async function fetchAutomaticos() {
    return calcularRecordsAutomaticos()
  }

  function irA(ref) {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: S.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '12px' }}>
      {showSplash && campeones.length > 0 && <SplashCampeones campeones={campeones} onClose={cerrarSplash}/>}
      <Trophy size={32} color={S.gold}/>
      <div style={{ color: S.cyan, fontSize: '.9rem', fontWeight: '600' }}>Cargando récords...</div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: S.bg, color: S.text, paddingBottom: '76px' }}>
      {showSplash && campeones.length > 0 && <SplashCampeones campeones={campeones} onClose={cerrarSplash}/>}
      {showBuscador && <BuscadorSimple onClose={() => setShowBuscador(false)}/>}
      {showDrawer && <DrawerMenu onClose={() => setShowDrawer(false)} onIrTorneos={() => irA(torneosRef)} onIrRecords={() => irA(recordsRef)} navigate={navigate}/>}

      {/* Header */}
      <div style={{ background: 'linear-gradient(180deg, #0a0a14 0%, #07070e 100%)', padding: '14px 14px 20px', borderBottom: `1px solid ${S.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
          <button onClick={() => setShowDrawer(true)} style={{ background: 'none', border: 'none', color: S.text, cursor: 'pointer', display: 'flex', padding: '4px' }}><Menu size={22}/></button>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.15rem', fontWeight: '800', color: S.cyan, letterSpacing: '4px' }}>GOLMEBOL</div>
            <div style={{ fontSize: '.58rem', color: S.muted, letterSpacing: '2px', fontWeight: '700' }}>LA CASA DEL MICROFÚTBOL</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button onClick={() => setShowBuscador(true)} style={{ background: 'none', border: 'none', color: S.text, cursor: 'pointer', display: 'flex', padding: '4px' }}><Search size={19}/></button>
            <button onClick={() => navigate('/jugador/login')} style={{ background: 'none', border: `1.5px solid ${S.green}`, borderRadius: '50%', color: S.green, cursor: 'pointer', display: 'flex', padding: '5px' }}><User size={16}/></button>
          </div>
        </div>

        {/* Stats rápidas */}
        <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
          {[
            { icono: <Trophy size={14} color={S.gold}/>, val: stats.torneos, label: 'TORNEOS' },
            { icono: <Users size={14} color={S.cyan}/>, val: stats.jugadores, label: 'JUGADORES' },
            { icono: <Shield size={13} color={S.green}/>, val: stats.goles, label: 'GOLES' },
            { icono: <Shield size={13} color="#9955ff"/>, val: stats.equipos, label: 'EQUIPOS' },
          ].map((st, i) => (
            <div key={i} style={{ flex: 1, background: S.card, border: `1px solid ${S.border}`, borderRadius: '10px', padding: '9px 4px', textAlign: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>{st.icono}<span style={{ color: '#fff', fontWeight: '800', fontSize: '.92rem' }}>{st.val.toLocaleString('es-CO')}</span></div>
              <div style={{ color: S.muted, fontSize: '.55rem', fontWeight: '700', letterSpacing: '.05em', marginTop: '2px' }}>{st.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── TORNEOS ACTIVOS ── */}
      {torneosActivos.length > 0 && (
        <div ref={torneosRef} style={{ padding: '22px 16px 6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <div style={{ height: '2px', flex: 1, background: `linear-gradient(90deg, transparent, ${S.green})` }}/>
            <div style={{ fontWeight: '900', color: S.green, fontSize: '.95rem', letterSpacing: '.14em' }}>TORNEOS ACTIVOS</div>
            <div style={{ height: '2px', flex: 1, background: `linear-gradient(90deg, ${S.green}, transparent)` }}/>
          </div>
          <div style={{ textAlign: 'center', color: S.muted, fontSize: '.68rem', marginBottom: '14px' }}>Elige un torneo para seguirlo en tiempo real</div>
          <div style={{ maxWidth: '460px', margin: '0 auto' }}>
            <SwipeCarousel items={torneosActivos} keyFn={t => t.id}
              renderItem={t => <TorneoFeaturedCard t={t} onVerTabla={abrirTablaTorneo}/>}/>
          </div>
        </div>
      )}

      {/* ── PARTIDOS EN VIVO ── */}
      {partidosVivo.length > 0 && (
        <div style={{ padding: '26px 16px 6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', maxWidth: '460px', margin: '0 auto 12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Radio size={14} color="#ff5252"/>
              <span style={{ fontWeight: '900', color: '#ff5252', fontSize: '.88rem', letterSpacing: '.1em' }}>PARTIDOS EN VIVO</span>
            </div>
            {partidosVivo.length > 1 && (
              <button onClick={() => setShowVivoModal(true)} style={{ background: 'none', border: 'none', color: S.green, fontWeight: '700', fontSize: '.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}>
                Ver todos <ChevronRight size={13}/>
              </button>
            )}
          </div>
          <div style={{ maxWidth: '460px', margin: '0 auto' }}>
            <LiveMatchFeatured m={partidosVivo[0]} onClick={() => setDetalleVivoId(partidosVivo[0].id)}/>
            {partidosVivo.length > 1 && (
              <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: '12px', padding: '4px 12px', marginTop: '10px' }}>
                {partidosVivo.slice(1, 4).map(m => <LiveMatchRow key={m.id} m={m} onClick={() => setDetalleVivoId(m.id)}/>)}
              </div>
            )}
          </div>
        </div>
      )}

      {showVivoModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)', zIndex: 550, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={e => e.target === e.currentTarget && setShowVivoModal(false)}>
          <div style={{ background: S.bg, border: `1px solid ${S.border}`, borderRadius: '18px 18px 0 0', width: '100%', maxWidth: '480px', maxHeight: '80vh', overflowY: 'auto', padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <span style={{ fontWeight: '900', color: '#ff5252', fontSize: '.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}><Radio size={14}/> TODOS LOS PARTIDOS EN VIVO</span>
              <button onClick={() => setShowVivoModal(false)} style={{ background: 'none', border: 'none', color: S.muted, cursor: 'pointer', display: 'flex' }}><X size={18}/></button>
            </div>
            {partidosVivo.map(m => <LiveMatchRow key={m.id} m={m} onClick={() => { setShowVivoModal(false); setDetalleVivoId(m.id) }}/>)}
          </div>
        </div>
      )}

      {detalleVivoId && (() => {
        const m = partidosVivo.find(x => x.id === detalleVivoId)
        return m ? <LiveMatchDetalle m={m} onClose={() => setDetalleVivoId(null)}/> : null
      })()}

      {/* ── RÉCORDS GOLMEBOL ── */}
      <div ref={recordsRef} style={{ padding: '26px 16px 8px', textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '4px' }}>
          <div style={{ height: '2px', flex: 1, background: `linear-gradient(90deg, transparent, ${S.gold})` }}/>
          <div style={{ fontWeight: '900', color: S.gold, fontSize: '1.1rem', letterSpacing: '.1em', lineHeight: 1.3, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Trophy size={18}/> SALÓN DE LOS RÉCORDS
          </div>
          <div style={{ height: '2px', flex: 1, background: `linear-gradient(90deg, ${S.gold}, transparent)` }}/>
        </div>
        <div style={{ fontSize: '.62rem', color: S.muted, letterSpacing: '2px', fontWeight: '700' }}>
          RÉCORDS GOLMEBOL · {records.length} REGISTRADOS
        </div>
      </div>

      {/* Carrusel único */}
      <div style={{ padding: '8px 0 32px' }}>
        <Carrusel records={records}/>
      </div>

      {/* ── INICIA SESIÓN PARA DESBLOQUEAR ── */}
      <div style={{ padding: '28px 16px 48px', borderTop: `1px solid ${S.border}`, background: 'rgba(0,0,0,.3)' }}>
        <div style={{ maxWidth: '440px', margin: '0 auto', textAlign: 'center' }}>
          <div style={{ marginBottom: '8px', display: 'flex', justifyContent: 'center' }}><Lock size={26} color="#fff"/></div>
          <div style={{ fontWeight: '900', color: '#fff', fontSize: '1rem', letterSpacing: '.02em', marginBottom: '16px' }}>
            Desbloquea todas las funciones
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '22px' }}>
            {[
              { icono: <BarChart3 size={18} color={S.cyan}/>, label: 'Estadísticas' },
              { icono: <Calendar size={18} color={S.cyan}/>, label: 'Historial' },
              { icono: <Shield size={18} color={S.cyan}/>, label: 'Goles' },
              { icono: <Trophy size={18} color={S.gold}/>, label: 'Logros' },
              { icono: <Gift size={18} color={S.cyan}/>, label: 'Premios' },
              { icono: <Target size={18} color={S.cyan}/>, label: 'Predix' },
              { icono: <CreditCard size={18} color={S.cyan}/>, label: 'Tarjeta' },
              { icono: <User size={18} color={S.cyan}/>, label: 'Perfil' },
            ].map(b => (
              <div key={b.label} style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: '12px', padding: '12px 4px', textAlign: 'center' }}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '6px' }}>{b.icono}</div>
                <div style={{ fontSize: '.58rem', color: S.muted, fontWeight: '700' }}>{b.label}</div>
              </div>
            ))}
          </div>
          <button onClick={() => navigate('/jugador/login')}
            style={{ width: '100%', maxWidth: '320px', padding: '15px', background: `linear-gradient(90deg, ${S.green}, ${S.cyan})`, border: 'none', borderRadius: '12px', cursor: 'pointer', color: '#000', fontWeight: '900', fontSize: '1rem', letterSpacing: '.5px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', margin: '0 auto 12px', boxShadow: `0 4px 20px ${S.green}44` }}>
            <Unlock size={17}/> Ingresar al portal
          </button>
          <button onClick={() => navigate('/login')}
            style={{ padding: '9px 24px', background: 'none', border: `1px solid ${S.border}`, borderRadius: '10px', cursor: 'pointer', color: S.muted, fontSize: '.75rem' }}>
            Acceso administrador →
          </button>
        </div>
      </div>

      {/* ── TABLA PÚBLICA DEL TORNEO (solo posiciones) ── */}
      {torneoTabla && (
        <div style={{ position: 'fixed', inset: 0, background: S.bg, zIndex: 500, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <div style={{ maxWidth: '560px', margin: '0 auto', padding: '16px 14px 40px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <button onClick={() => setTorneoTabla(null)}
                style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: '10px', padding: '8px 12px', cursor: 'pointer', color: S.text, fontSize: '.85rem', fontWeight: '700', flexShrink: 0 }}>
                ← Volver
              </button>
              {torneoTabla !== 'cargando' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                  {torneoTabla.torneo.logo_url && <img src={torneoTabla.torneo.logo_url} style={{ width: '34px', height: '34px', objectFit: 'contain', flexShrink: 0 }}/>}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: '800', color: '#fff', fontSize: '.9rem', textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{torneoTabla.torneo.name}</div>
                    <div style={{ fontSize: '.62rem', color: S.cyan, fontWeight: '700', letterSpacing: '.08em' }}>{torneoTabla.torneo.estado?.toUpperCase()}</div>
                  </div>
                </div>
              )}
            </div>
            {torneoTabla === 'cargando' ? (
              <div style={{ textAlign: 'center', padding: '60px 0', color: S.cyan, fontWeight: '700', fontSize: '.85rem' }}>Cargando tabla...</div>
            ) : (
              <>
                <div style={{ display: 'flex', gap: '6px', marginBottom: '16px' }}>
                  <button onClick={() => setTorneoTablaTab('tabla')}
                    style={{ flex: 1, padding: '9px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: '800', fontSize: '.78rem', background: torneoTablaTab === 'tabla' ? S.cyan : S.card, color: torneoTablaTab === 'tabla' ? '#07070e' : S.muted }}>
                    <BarChart3 size={14} style={{ verticalAlign: 'middle', marginRight: '5px' }}/> Tabla
                  </button>
                  <button onClick={() => setTorneoTablaTab('programacion')}
                    style={{ flex: 1, padding: '9px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: '800', fontSize: '.78rem', background: torneoTablaTab === 'programacion' ? S.cyan : S.card, color: torneoTablaTab === 'programacion' ? '#07070e' : S.muted }}>
                    <Calendar size={14} style={{ verticalAlign: 'middle', marginRight: '5px' }}/> Programación
                  </button>
                  <button onClick={() => setTorneoTablaTab('goleadores')}
                    style={{ flex: 1, padding: '9px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: '800', fontSize: '.78rem', background: torneoTablaTab === 'goleadores' ? S.cyan : S.card, color: torneoTablaTab === 'goleadores' ? '#07070e' : S.muted }}>
                    <GiSoccerBall size={13} style={{ verticalAlign: 'middle', marginRight: '5px' }}/> Goleadores
                  </button>
                </div>

                {torneoTablaTab === 'tabla' ? (
                  torneoTabla.grupos?.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {torneoTabla.grupos.map(g => (
                        <TablaColapsableRecords key={g.id} titulo={`Grupo ${g.nombre}`} rows={getTablaGrupoRecords(g.id, torneoTabla)} defaultOpen/>
                      ))}
                      <TablaColapsableRecords titulo="Tabla general — todos los equipos" rows={torneoTabla.filas}/>
                    </div>
                  ) : (
                    <TablaPosiciones titulo="Tabla de posiciones" rows={torneoTabla.filas}/>
                  )
                ) : torneoTablaTab === 'programacion' ? (() => {
                  const conEquipos = (torneoTabla.partidos || []).map(m => ({ ...m, home: torneoTabla.equiposMap[m.home_team_id], away: torneoTabla.equiposMap[m.away_team_id] }))
                  const jugados  = conEquipos.filter(m => m.status === 'finished').sort((a, b) => new Date(b.played_at || 0) - new Date(a.played_at || 0))
                  const porJugar = conEquipos.filter(m => m.status !== 'finished').sort((a, b) => new Date(a.played_at || 0) - new Date(b.played_at || 0))
                  const lista = torneoProgFiltro === 'proximos' ? porJugar : jugados
                  return (
                    <div>
                      <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
                        <button onClick={() => setTorneoProgFiltro('proximos')}
                          style={{ flex: 1, padding: '8px', borderRadius: '8px', border: `1px solid ${S.border}`, cursor: 'pointer', fontWeight: '800', fontSize: '.72rem', background: torneoProgFiltro === 'proximos' ? S.green : 'transparent', color: torneoProgFiltro === 'proximos' ? '#07070e' : S.muted }}>
                          Por jugar
                        </button>
                        <button onClick={() => setTorneoProgFiltro('jugados')}
                          style={{ flex: 1, padding: '8px', borderRadius: '8px', border: `1px solid ${S.border}`, cursor: 'pointer', fontWeight: '800', fontSize: '.72rem', background: torneoProgFiltro === 'jugados' ? S.green : 'transparent', color: torneoProgFiltro === 'jugados' ? '#07070e' : S.muted }}>
                          Jugados
                        </button>
                      </div>
                      <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: '12px', padding: '2px 12px' }}>
                        {lista.length === 0 ? (
                          <div style={{ textAlign: 'center', color: S.muted, fontSize: '.75rem', padding: '20px 0' }}>
                            {torneoProgFiltro === 'proximos' ? 'No hay partidos programados' : 'Todavía no hay partidos jugados'}
                          </div>
                        ) : lista.map(m => <ProgramacionRow key={m.id} m={m}/>)}
                      </div>
                    </div>
                  )
                })() : (() => {
                  const vallaMenosVencida = [...torneoTabla.filas].filter(f => f.pj > 0).sort((a, b) => a.gc - b.gc || b.pj - a.pj).slice(0, 5)
                  return (
                    <div>
                      <div style={{ fontSize: '.68rem', fontWeight: '800', color: S.muted, letterSpacing: '.08em', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <GiSoccerBall size={12} color={S.muted}/> TOP 5 GOLEADORES
                      </div>
                      {torneoTabla.goleadores.length === 0 ? (
                        <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: '12px', padding: '20px', textAlign: 'center', color: S.muted, fontSize: '.75rem', marginBottom: '18px' }}>Sin goles registrados todavía</div>
                      ) : (
                        <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: '12px', padding: '4px 12px', marginBottom: '18px' }}>
                          {torneoTabla.goleadores.map((g, i) => (
                            <div key={`${g.player_id}-${g.team_id}`} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 0', borderBottom: i < torneoTabla.goleadores.length - 1 ? `1px solid ${S.border}` : 'none' }}>
                              <div style={{ width: '20px', fontSize: '.75rem', fontWeight: '900', color: i === 0 ? S.gold : S.muted, flexShrink: 0, textAlign: 'center' }}>{i + 1}</div>
                              <div style={{ width: '28px', height: '28px', borderRadius: '50%', overflow: 'hidden', flexShrink: 0, background: S.card2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {g.photo_url ? <img src={g.photo_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/> : <User size={13} color={S.muted}/>}
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: '.8rem', fontWeight: '700', color: S.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.player_name}</div>
                                <div style={{ fontSize: '.65rem', color: S.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.team_name}</div>
                              </div>
                              <div style={{ fontSize: '1rem', fontWeight: '900', color: S.gold, flexShrink: 0 }}>{g.total_goals}</div>
                            </div>
                          ))}
                        </div>
                      )}

                      <div style={{ fontSize: '.68rem', fontWeight: '800', color: S.muted, letterSpacing: '.08em', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <GiGoalKeeper size={13} color={S.muted}/> VALLA MENOS VENCIDA
                      </div>
                      {vallaMenosVencida.length === 0 ? (
                        <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: '12px', padding: '20px', textAlign: 'center', color: S.muted, fontSize: '.75rem' }}>Sin partidos jugados todavía</div>
                      ) : (
                        <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: '12px', padding: '4px 12px' }}>
                          {vallaMenosVencida.map((f, i) => (
                            <div key={f.equipo.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 0', borderBottom: i < vallaMenosVencida.length - 1 ? `1px solid ${S.border}` : 'none' }}>
                              <div style={{ width: '20px', fontSize: '.75rem', fontWeight: '900', color: i === 0 ? S.cyan : S.muted, flexShrink: 0, textAlign: 'center' }}>{i + 1}</div>
                              <div style={{ width: '24px', height: '24px', borderRadius: '6px', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <TeamShield logo_url={f.equipo.logo_url} name={f.equipo.name} size={24}/>
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: '.8rem', fontWeight: '700', color: S.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.equipo.name}</div>
                                <div style={{ fontSize: '.65rem', color: S.muted }}>{f.pj} PJ</div>
                              </div>
                              <div style={{ fontSize: '1rem', fontWeight: '900', color: S.cyan, flexShrink: 0 }}>{f.gc}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })()}
                {/* CTA: lo demás se desbloquea con sesión */}
                <div style={{ marginTop: '18px', background: S.card, border: `1px solid ${S.border}`, borderRadius: '16px', padding: '18px', textAlign: 'center' }}>
                  <div style={{ fontSize: '.82rem', color: S.text, fontWeight: '700', marginBottom: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}><Lock size={13}/> ¿Tus estadísticas y tu perfil?</div>
                  <div style={{ fontSize: '.7rem', color: S.muted, marginBottom: '14px' }}>Inicia sesión para desbloquear toda la experiencia Golmebol</div>
                  <button onClick={() => navigate('/jugador/login')}
                    style={{ padding: '12px 32px', background: `linear-gradient(90deg, ${S.cyan}, #1a73e8)`, border: 'none', borderRadius: '10px', cursor: 'pointer', color: '#000', fontWeight: '900', fontSize: '.85rem' }}>
                    Iniciar sesión
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── BOTTOM NAV ── */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#0a0a14', borderTop: `1px solid ${S.border}`, display: 'flex', zIndex: 200, paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {[
          { icono: <Home size={18}/>, label: 'Inicio', onClick: () => window.scrollTo({ top: 0, behavior: 'smooth' }), activo: true },
          { icono: <Calendar size={18}/>, label: 'Partidos', onClick: () => irA(torneosRef) },
          { icono: <Trophy size={18}/>, label: 'Torneos', onClick: () => irA(torneosRef) },
          { icono: <BarChart3 size={18}/>, label: 'Estadísticas', onClick: () => irA(recordsRef) },
          { icono: <Menu size={18}/>, label: 'Más', onClick: () => setShowDrawer(true) },
        ].map(it => (
          <button key={it.label} onClick={it.onClick}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', background: 'none', border: 'none', cursor: 'pointer', padding: '9px 2px', color: it.activo ? S.green : S.muted }}>
            {it.icono}
            <span style={{ fontSize: '.58rem', fontWeight: '700' }}>{it.label.toUpperCase()}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
