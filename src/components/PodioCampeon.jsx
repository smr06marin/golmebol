import { useEffect } from 'react'
import { urlMini, alFallarMini } from '../lib/imagenMini'
import { celebrar } from '../lib/celebracion'

// ── Campeón del torneo + partidos de la final y del 3.er puesto ─────────────
// Sale arriba en la página pública del torneo apenas se juega la final. Al entrar lanza confeti y fuegos artificiales.
// Muestra cada partido de la final (y del tercer puesto, si hubo): si fue ida y vuelta, los dos partidos con el
// GLOBAL; si se definió por penales, también el marcador de los penales.
//
// llaveFinal / llaveTercero: { matches, teamA, teamB, golesA, golesB, ganador, porPenales } (armarLlaves).

const ORO = '#f5c84b'
const BRONCE = '#d08a4e'

function Escudo({ logo, name, size = 34, borde }) {
  const iniciales = (name || '?').split(/\s+/).map(w => w[0]).join('').substring(0, 2).toUpperCase()
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: '#fff', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: borde ? `0 0 0 3px ${borde}, 0 6px 20px rgba(0,0,0,.45)` : '0 2px 6px rgba(0,0,0,.35)' }}>
      {logo
        ? <img src={urlMini(logo, Math.max(size, 48))} onError={alFallarMini} alt={name || ''} decoding="async" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: size > 50 ? '6px' : '3px' }}/>
        : <span style={{ color: '#1a3a8a', fontWeight: 900, fontSize: size * 0.34 }}>{iniciales}</span>}
    </div>
  )
}

// Penales de la llave contados para teamA / teamB (o null si no hubo)
function penalesDeLlave(ll) {
  const m = [...(ll.matches || [])].reverse().find(x => x.penales_local != null && x.penales_visitante != null && (x.penales_local !== x.penales_visitante || x.penales_ganador))
  if (!m) return null
  const aEsLocal = m.home_team_id === ll.teamA.id
  return { a: aEsLocal ? m.penales_local : m.penales_visitante, b: aEsLocal ? m.penales_visitante : m.penales_local }
}

// Nombre del equipo: hasta 2 renglones (no se corta con "..." en celulares angostos)
const NOMBRE = { fontWeight: 800, fontSize: '.74rem', lineHeight: 1.15, overflow: 'hidden', display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2, wordBreak: 'break-word' }

const fecha = d => (d ? new Date(d).toLocaleDateString('es-CO', { weekday: 'short', day: '2-digit', month: 'short' }) : '')

function TarjetaLlave({ titulo, icono, color, ll, onVerPartido }) {
  const partidos = [...(ll.matches || [])].sort((x, y) => new Date(x.played_at || 0) - new Date(y.played_at || 0))
  const idaVuelta = partidos.length > 1
  const pen = penalesDeLlave(ll)
  const ganaA = ll.ganador?.id === ll.teamA.id
  return (
    <div style={{ background: 'rgba(0,0,0,.28)', border: `1px solid ${color}66`, borderRadius: '14px', padding: '12px 12px 10px' }}>
      <div style={{ textAlign: 'center', color, fontWeight: 900, fontSize: '.7rem', letterSpacing: '.16em', marginBottom: '8px' }}>{icono} {titulo}</div>
      {partidos.map((m, i) => {
        const gl = m.home_score ?? 0, gv = m.away_score ?? 0
        return (
          <button key={m.id} type="button" onClick={() => onVerPartido && onVerPartido(m)}
            style={{ width: '100%', display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto minmax(0,1fr)', alignItems: 'center', gap: '8px', padding: '8px 4px', background: 'none', border: 'none', borderTop: i > 0 ? '1px solid rgba(255,255,255,.08)' : 'none', color: '#fff', cursor: onVerPartido ? 'pointer' : 'default', fontFamily: 'inherit', textAlign: 'left' }}>
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '7px', minWidth: 0 }}>
              <span style={{ ...NOMBRE, textAlign: 'right' }}>{m.home?.name}</span>
              <Escudo logo={m.home?.logo_url} name={m.home?.name} size={28}/>
            </span>
            <span style={{ textAlign: 'center', minWidth: '62px' }}>
              {idaVuelta && <span style={{ display: 'block', fontSize: '.55rem', fontWeight: 800, color: 'rgba(255,255,255,.6)', letterSpacing: '.08em' }}>{i === 0 ? 'IDA' : 'VUELTA'}</span>}
              <span style={{ display: 'block', fontWeight: 900, fontSize: '1.15rem', letterSpacing: '.03em' }}>{gl} - {gv}</span>
              {m.played_at && <span style={{ display: 'block', fontSize: '.55rem', color: 'rgba(255,255,255,.55)' }}>{fecha(m.played_at)}</span>}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '7px', minWidth: 0 }}>
              <Escudo logo={m.away?.logo_url} name={m.away?.name} size={28}/>
              <span style={NOMBRE}>{m.away?.name}</span>
            </span>
          </button>
        )
      })}
      {(idaVuelta || pen) && (
        <div style={{ marginTop: '6px', paddingTop: '8px', borderTop: `1px dashed ${color}66`, display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
          {idaVuelta && (
            <span style={{ fontSize: '.74rem', fontWeight: 800, color: '#fff' }}>
              <span style={{ color, letterSpacing: '.08em', fontSize: '.62rem', marginRight: '6px' }}>GLOBAL</span>
              {ll.teamA.name} <b style={{ color, fontSize: '.95rem' }}>{ll.golesA} - {ll.golesB}</b> {ll.teamB.name}
            </span>
          )}
          {pen && (
            <span style={{ fontSize: '.74rem', fontWeight: 800, color: '#fff' }}>
              <span style={{ color, letterSpacing: '.08em', fontSize: '.62rem', marginRight: '6px' }}>PENALES</span>
              {ll.teamA.name} <b style={{ color, fontSize: '.95rem' }}>{pen.a} - {pen.b}</b> {ll.teamB.name}
            </span>
          )}
        </div>
      )}
      {ll.ganador && (
        <div style={{ textAlign: 'center', marginTop: '6px', fontSize: '.66rem', color: 'rgba(255,255,255,.75)', fontWeight: 700 }}>
          Ganó <b style={{ color }}>{(ganaA ? ll.teamA : ll.teamB).name}</b>{ll.porPenales ? ' por penales' : idaVuelta ? ' en el global' : ''}
        </div>
      )}
    </div>
  )
}

export default function PodioCampeon({ torneoNombre, llaveFinal, llaveTercero, onVerPartido }) {
  const campeon = llaveFinal?.ganador || null
  const sub = campeon ? (campeon.id === llaveFinal.teamA.id ? llaveFinal.teamB : llaveFinal.teamA) : null
  const tercero = llaveTercero?.ganador || null

  // Apenas entran a la página del campeón: confeti dorado + fuegos artificiales
  useEffect(() => {
    if (!campeon?.id) return
    const t = setTimeout(() => celebrar('ambos'), 450)
    return () => clearTimeout(t)
  }, [campeon?.id])

  if (!campeon) return null
  return (
    <section style={{ position: 'relative', overflow: 'hidden', borderRadius: '20px', marginBottom: '18px', padding: '20px 14px 14px', color: '#fff',
      background: 'radial-gradient(120% 80% at 50% 0%, rgba(245,200,75,.32) 0%, rgba(245,200,75,0) 60%), linear-gradient(165deg,#1b1606 0%,#0d0f1a 55%,#090b14 100%)',
      border: `1px solid ${ORO}88`, boxShadow: '0 10px 30px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,241,184,.18)' }}>
      <style>{`@keyframes gmPodioBrillo { 0% { background-position: 130% 0 } 100% { background-position: -130% 0 } }
.gm-podio-oro { background: linear-gradient(110deg,#c9971c 0%,#f7d774 38%,#fff1b8 50%,#f7d774 62%,#c9971c 100%); background-size: 220% 100%; -webkit-background-clip: text; background-clip: text; color: transparent; animation: gmPodioBrillo 3.4s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) { .gm-podio-oro { animation: none; } }`}</style>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '.66rem', fontWeight: 900, letterSpacing: '.28em', color: 'rgba(255,241,184,.8)' }}>{torneoNombre ? torneoNombre.toUpperCase() : 'TORNEO'}</div>
        <div className="gm-podio-oro" style={{ fontSize: '1.7rem', fontWeight: 900, letterSpacing: '.14em', margin: '6px 0 12px' }}>🏆 CAMPEÓN</div>
        <button type="button" onClick={() => celebrar('ambos')} aria-label="Celebrar otra vez"
          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '10px', fontFamily: 'inherit', color: '#fff' }}>
          <Escudo logo={campeon.logo_url} name={campeon.name} size={92} borde={ORO}/>
          <span style={{ fontSize: '1.25rem', fontWeight: 900, letterSpacing: '.04em', textTransform: 'uppercase', lineHeight: 1.15, maxWidth: '280px' }}>{campeon.name}</span>
        </button>
        <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '6px 14px', marginTop: '10px', fontSize: '.74rem', fontWeight: 700, color: 'rgba(255,255,255,.85)' }}>
          {sub && <span>🥈 Subcampeón: <b style={{ color: '#e9eef5' }}>{sub.name}</b></span>}
          {tercero && <span>🥉 Tercero: <b style={{ color: '#f3c69b' }}>{tercero.name}</b></span>}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '16px' }}>
        <TarjetaLlave titulo="GRAN FINAL" icono="🏆" color={ORO} ll={llaveFinal} onVerPartido={onVerPartido}/>
        {llaveTercero?.terminada && <TarjetaLlave titulo="TERCER PUESTO" icono="🥉" color={BRONCE} ll={llaveTercero} onVerPartido={onVerPartido}/>}
      </div>
      <div style={{ textAlign: 'center', marginTop: '10px' }}>
        <button type="button" onClick={() => celebrar('ambos')}
          style={{ background: 'rgba(245,200,75,.12)', border: `1px solid ${ORO}77`, color: '#ffe39a', borderRadius: '999px', padding: '0 16px', minHeight: '36px', fontWeight: 800, fontSize: '.74rem', cursor: 'pointer', fontFamily: 'inherit' }}>
          🎉 Celebrar otra vez
        </button>
      </div>
    </section>
  )
}

// Fuegos artificiales al abrir una sección (ej. la pestaña Resultados cuando ya se jugó la final)
export function FuegosAlEntrar({ modo = 'fuegos' }) {
  useEffect(() => {
    const t = setTimeout(() => celebrar(modo), 300)
    return () => clearTimeout(t)
  }, [modo])
  return null
}
