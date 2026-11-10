import { useEffect, useState } from 'react'
import { STAT_CONFIG, ORDEN_STATS, misPuestos, obtenerAgregado, leerAgregadoGuardado } from '../../lib/rankingsJugadores'

// "Tus puestos": fichas debajo de la tarjeta con la posición REAL del jugador en cada ranking de Golmebol.
// Es la invitación a tocar: se ve dónde está parado, y al tocar una ficha abre el top completo.
const G = { card:'#161616', card2:'#1c1c1c', border:'#2a2a2a', text:'#fff', text2:'#c9c9c9', muted:'#8a8a8a', green:'#6fcf3d', gold:'#f5a623' }

function Ficha({ k, dato, onAbrir, i }) {
  const c = STAT_CONFIG[k]
  const medalla = dato.puesto === 1 ? '🥇' : dato.puesto === 2 ? '🥈' : dato.puesto === 3 ? '🥉' : null
  const destacado = dato.puesto <= 3
  const borde = destacado ? G.gold : G.border
  return (
    <button type="button" onClick={() => onAbrir(k)} aria-label={`${c.label}: puesto ${dato.puesto} de ${dato.total}. Ver ranking`}
      className="gm-ficha"
      style={{ flex:'0 0 auto', width:'118px', minHeight:'96px', padding:'12px 12px 10px', textAlign:'left', cursor:'pointer', background:G.card, border:`1.5px solid ${borde}`, borderRadius:'16px',
        display:'flex', flexDirection:'column', justifyContent:'space-between', gap:'6px', fontFamily:'inherit', scrollSnapAlign:'start',
        animation:`gmFadeUp .35s ease-out ${i * 0.05}s both` }}>
      <span style={{ fontSize:'.74rem', fontWeight:700, color:G.text2, letterSpacing:'.02em', whiteSpace:'nowrap' }}>{c.icon} {c.corto}</span>
      <span style={{ display:'flex', alignItems:'baseline', gap:'4px' }}>
        <span style={{ fontSize:'1.7rem', fontWeight:900, lineHeight:1, color: destacado ? G.gold : c.color }}>#{dato.puesto}</span>
        {medalla && <span style={{ fontSize:'1.05rem' }}>{medalla}</span>}
      </span>
      <span style={{ fontSize:'.68rem', color:G.muted, whiteSpace:'nowrap' }}>de {dato.total} · Top {dato.top}%</span>
    </button>
  )
}

function Esqueleto() {
  return (
    <div style={{ display:'flex', gap:'10px', overflow:'hidden' }}>
      {[0,1,2,3].map(i => (
        <div key={i} style={{ flex:'0 0 auto', width:'118px', height:'96px', borderRadius:'16px', background:G.card, border:`1.5px solid ${G.border}`, position:'relative', overflow:'hidden' }}>
          <div style={{ position:'absolute', top:0, bottom:0, width:'40%', background:'linear-gradient(90deg,transparent,rgba(255,255,255,.06),transparent)', animation:'gmShimmer 1.6s ease-in-out infinite' }}/>
        </div>
      ))}
    </div>
  )
}

export default function MisPuestos({ playerId, userId, pj, onAbrir }) {
  const [agregado, setAgregado] = useState(() => leerAgregadoGuardado(userId))
  const [fallo, setFallo] = useState(false)

  useEffect(() => {
    if (!pj) return // sin partidos todavía: no hay nada que pedir
    let vivo = true
    obtenerAgregado(userId)
      .then(a => { if (vivo) { setAgregado(a); setFallo(false) } })
      .catch(() => { if (vivo && !leerAgregadoGuardado(userId)) setFallo(true) })
    return () => { vivo = false }
  }, [pj, userId])

  // Jugador nuevo: invitación suave, sin ranking todavía
  if (!pj) {
    return (
      <div style={{ position:'relative', zIndex:1, maxWidth:'400px', margin:'20px auto 0', padding:'14px 16px', background:G.card, border:`1px solid ${G.border}`, borderRadius:'16px', textAlign:'center', fontSize:'.92rem', color:G.text2, lineHeight:1.5 }}>
        <b style={{ color:G.text }}>Tu tarjeta cobra vida con tu primer partido.</b><br/>
        Desde ahí aparecerás en los rankings de goles, partidos y más.
      </div>
    )
  }
  if (fallo) return null // si no hay conexión, simplemente no se muestra (la tarjeta sigue funcionando)

  const calc = agregado ? misPuestos(agregado, playerId) : null
  const claves = calc ? ORDEN_STATS.filter(k => calc.puestos[k]) : []
  if (agregado && claves.length === 0) return null

  return (
    <div style={{ position:'relative', zIndex:1, maxWidth:'440px', margin:'22px auto 0' }}>
      <div style={{ padding:'0 4px 10px' }}>
        <div style={{ fontSize:'1.05rem', fontWeight:900, color:G.text }}>Tus puestos en Golmebol</div>
        <div style={{ fontSize:'.85rem', color:G.muted, marginTop:'2px', lineHeight:1.4 }}>Toca una ficha o un número de tu tarjeta para ver el top completo.</div>
      </div>
      <div className="gm-fichas-fila" style={{ display:'flex', gap:'10px', overflowX:'auto', padding:'2px 4px 8px', margin:'0 -4px', scrollSnapType:'x proximity', scrollbarWidth:'none', WebkitOverflowScrolling:'touch' }}>
        {calc
          ? claves.map((k, i) => <Ficha key={k} k={k} dato={calc.puestos[k]} onAbrir={onAbrir} i={i}/>)
          : <Esqueleto/>}
      </div>
    </div>
  )
}
