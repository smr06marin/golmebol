import { useEffect, useState, useRef } from 'react'
import { STAT_CONFIG, ORDEN_STATS, armarLista, ordenar, rankingGlobal, obtenerAgregado, leerAgregadoGuardado } from '../../lib/rankingsJugadores'
import { useAuthStore } from '../../store/authStore'

// Colores iguales al resto de la app (negro, tarjetas planas, acento verde)
const S = {
  bg:'#0a0a0a', card:'#161616', card2:'#1c1c1c', border:'#2a2a2a',
  text:'#ffffff', text2:'#c9c9c9', muted:'#8a8a8a',
  green:'#6fcf3d', greenDim:'rgba(111,207,61,.13)',
  gold:'#f5a623', goldDim:'rgba(245,166,35,.14)',
}

const FELICITACIONES = [
  '¡Eres el #1! 🏆','¡Segundo lugar! 🥈','¡Top 3! Sigue así 🥉','¡Estás en el top 4! 💪','¡Top 5! Gran nivel 🔥',
]

function FilaRanking({ j, esYo, config }) {
  const val = config.formato(j[config.campo] ?? 0)
  const puesto = j.puesto
  const medalla = puesto===1?'🥇':puesto===2?'🥈':puesto===3?'🥉':null
  return (
    <div style={{ padding:'10px 20px', display:'flex', alignItems:'center', gap:'12px', background: esYo ? S.greenDim : 'transparent', borderLeft: esYo ? `3px solid ${S.green}` : '3px solid transparent' }}>
      <div style={{ width:'28px', textAlign:'center', flexShrink:0, fontWeight:'900', fontSize:medalla?'1.1rem':'.85rem', color: puesto<=3?S.gold:S.muted }}>
        {medalla || `#${puesto}`}
      </div>
      <div style={{ width:'32px', height:'32px', borderRadius:'50%', overflow:'hidden', background:S.border, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
        {j.foto?<img src={j.foto} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }}/>:<span style={{ fontSize:'.75rem' }}>👤</span>}
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:'.82rem', fontWeight: esYo?'800':'500', color: esYo?S.green:S.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          {j.nombre} {esYo && '← Tú'}
        </div>
        <div style={{ fontSize:'.65rem', color:S.muted, marginTop:'1px' }}>{j.posLabel||''} · {j.pj} PJ</div>
      </div>
      <div style={{ fontWeight:'900', fontSize:'1rem', color:esYo?S.green:config.color, flexShrink:0 }}>
        {val}<span style={{ fontSize:'.62rem', color:S.muted, fontWeight:'400', marginLeft:'2px' }}>{config.sufijo}</span>
      </div>
    </div>
  )
}

function SeccionRanking({ titulo, ranking, playerId, config, color }) {
  const miIdx   = ranking.findIndex(j=>j.id===playerId)
  const fuera5  = miIdx >= 5
  const top5    = ranking.slice(0,5)
  const ctxStart= Math.max(5, miIdx-2)
  const ctxEnd  = Math.min(ranking.length, miIdx+3)
  const contexto= fuera5 ? ranking.slice(ctxStart, ctxEnd) : []
  const hayGap  = fuera5 && ctxStart>5

  return (
    <div style={{ marginBottom:'16px' }}>
      <div style={{ padding:'8px 20px', background:S.card2, display:'flex', alignItems:'center', gap:'8px' }}>
        <div style={{ width:'4px', height:'16px', borderRadius:'2px', background:color||config.color }}/>
        <span style={{ fontSize:'.75rem', fontWeight:'700', color:S.text, letterSpacing:'.06em' }}>{titulo}</span>
        <span style={{ fontSize:'.65rem', color:S.muted }}>({ranking.length} jugadores)</span>
      </div>
      {ranking.length===0 ? (
        <div style={{ padding:'16px 20px', color:S.muted, fontSize:'.8rem' }}>Sin datos</div>
      ) : (
        <>
          {top5.map(j=><FilaRanking key={j.id} j={j} esYo={j.id===playerId} config={config}/>)}
          {hayGap && (
            <div style={{ padding:'8px 20px', display:'flex', alignItems:'center', gap:'8px' }}>
              <div style={{ flex:1, height:'1px', background:S.border }}/>
              <span style={{ fontSize:'.75rem', color:S.muted, fontWeight:'700', letterSpacing:'.15em' }}>• • •</span>
              <div style={{ flex:1, height:'1px', background:S.border }}/>
            </div>
          )}
          {fuera5 && contexto.length>0 && (
            <>
              <div style={{ padding:'4px 20px', background:S.greenDim }}>
                <span style={{ fontSize:'.63rem', fontWeight:'700', color:S.green, letterSpacing:'.1em' }}>TU POSICIÓN · #{ranking[miIdx].puesto}</span>
              </div>
              {contexto.map(j=><FilaRanking key={j.id} j={j} esYo={j.id===playerId} config={config}/>)}
            </>
          )}
          {miIdx < 0 && (
            <div style={{ padding:'12px 20px', textAlign:'center', color:S.muted, borderTop:`0.5px solid ${S.border}`, fontSize:'.78rem' }}>
              {config.minPj > 0
                ? `Necesitas mínimo ${config.minPj} partidos jugados para aparecer en este ranking`
                : 'Sin registros aún — juega partidos para aparecer'}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// Frase que invita a seguir subiendo: cuánto le falta para pasar al de arriba
function Empujon({ ranking, miIdx, config }) {
  if (miIdx < 0 || config.campo === 'pp' || config.campo === 'promedio') return null
  const yo = ranking[miIdx]
  const primero = yo.puesto === 1
  let texto = null
  if (primero) {
    const segundo = ranking.find(j => j.puesto > 1)
    if (segundo) {
      const d = (yo[config.campo] ?? 0) - (segundo[config.campo] ?? 0)
      texto = `Vas de líder. ${String(segundo.nombre).split(' ')[0]} te sigue a ${d} ${d === 1 ? 'de diferencia' : 'de diferencia'}.`
    } else texto = 'Vas de líder del ranking 🏆'
  } else {
    const arriba = [...ranking].reverse().find(j => j.puesto < yo.puesto)
    if (arriba) {
      const falta = (arriba[config.campo] ?? 0) - (yo[config.campo] ?? 0)
      if (falta > 0) {
        const u = config.unidad
        const cuanto = config.campo === 'eficacia' ? `${falta} ${falta === 1 ? 'punto' : 'puntos'}` : `${falta} ${u}${falta === 1 ? '' : 's'}`
        texto = `Te ${falta === 1 ? 'falta' : 'faltan'} ${cuanto} para pasar a ${String(arriba.nombre).split(' ')[0]} y subir al #${arriba.puesto}.`
      }
    }
  }
  if (!texto) return null
  return (
    <div style={{ margin:'12px 20px 4px', padding:'10px 12px', borderRadius:'12px', background:S.card, border:`1px solid ${S.border}`, fontSize:'.8rem', color:S.text2, lineHeight:1.45 }}>
      <span style={{ color:S.green, fontWeight:800 }}>↑ </span>{texto}
    </div>
  )
}

export default function StatRankingModal({ statKey, playerId, esPortero, onClose }) {
  const userId = useAuthStore(s => s.user?.id)
  const [agregado, setAgregado] = useState(() => leerAgregadoGuardado(userId) || [])
  const [loading,  setLoading]  = useState(() => !leerAgregadoGuardado(userId))
  const [error,    setError]    = useState(false)
  const [vista,    setVista]    = useState('global') // 'global' | 'posicion'
  const [clave,    setClave]    = useState(STAT_CONFIG[statKey] ? statKey : 'pj')
  const chipsRef = useRef(null)
  const config = STAT_CONFIG[clave]
  const miId = playerId == null ? null : String(playerId)

  // Con la copia guardada se pinta al instante; los datos frescos llegan detrás y la reemplazan
  useEffect(()=>{
    let vivo = true
    obtenerAgregado(userId)
      .then(a => { if (vivo) { setAgregado(a); setLoading(false); setError(false) } })
      .catch(() => { if (vivo) { setLoading(false); setError(agregado.length === 0) } })
    return () => { vivo = false }
  },[])

  // El chip de la estadística elegida queda a la vista
  useEffect(()=>{
    const el = chipsRef.current?.querySelector('[data-activo="1"]')
    el?.scrollIntoView?.({ block:'nearest', inline:'center', behavior:'smooth' })
  },[clave])

  const todos = armarLista(agregado)
  const yoCompleto = todos.find(j => j.id === miId)
  const soyPortero = yoCompleto ? yoCompleto.esPortero : !!esPortero

  const sorted = rankingGlobal(todos, clave, soyPortero)
  const lista  = todos.filter(j => j.pj >= (config.minPj || 0))

  // Por posición
  const arqueros  = ordenar(lista.filter(j=>j.esPortero), config, true)
  const defensas  = ordenar(lista.filter(j=>j.esDefensa), config, false)
  const campo     = ordenar(lista.filter(j=>!j.esPortero && !j.esDefensa), config, false)

  const miIdx = sorted.findIndex(j=>j.id===miId)
  const yo    = miIdx >= 0 ? sorted[miIdx] : yoCompleto
  const enTop5= miIdx>=0 && sorted[miIdx].puesto<=5
  const tituloGlobal = config.campo === 'promedio' ? (soyPortero ? 'Ranking Global · Arqueros' : 'Ranking Global · Jugadores de campo') : 'Ranking Global'
  const topPct = miIdx>=0 ? Math.max(1, Math.ceil((sorted[miIdx].puesto / sorted.length) * 100)) : null

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.85)', zIndex:500, display:'flex', alignItems:'flex-end', justifyContent:'center' }} onClick={onClose}>
      <div style={{ background:S.bg, border:`1px solid ${S.border}`, borderRadius:'20px 20px 0 0', width:'100%', maxWidth:'480px', maxHeight:'88vh', overflow:'hidden', display:'flex', flexDirection:'column', animation:'gmFadeUp .25s ease-out' }} onClick={e=>e.stopPropagation()}>

        {/* Header */}
        <div style={{ padding:'16px 20px 12px', borderBottom:`0.5px solid ${S.border}`, flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'12px', gap:'12px' }}>
            <div style={{ minWidth:0 }}>
              <div style={{ fontWeight:'800', fontSize:'1rem', color:S.text }}>{config.icon} {config.label}</div>
              {yo && (
                <div style={{ fontSize:'.72rem', color:S.muted, marginTop:'2px' }}>
                  {yo.posLabel} · {yo.pj} PJ en todos tus torneos
                  {yo.golesComoArquero>0 && ` · 🧤 ${yo.golesComoArquero} como arq.`}
                  {yo.esPortero && (yo.goles-yo.golesComoArquero)>0 && ` · ⚽ ${yo.goles-yo.golesComoArquero} como jugador`}
                </div>
              )}
            </div>
            <button onClick={onClose} aria-label="Cerrar" style={{ background:S.card2, border:'none', borderRadius:'50%', width:'36px', height:'36px', cursor:'pointer', color:S.text2, fontSize:'1rem', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>✕</button>
          </div>

          {/* Mi puesto, grande */}
          {miIdx >= 0 && (
            <div style={{ display:'flex', alignItems:'baseline', gap:'10px', marginBottom:'10px' }}>
              <span style={{ fontWeight:900, fontSize:'2.4rem', lineHeight:1, color: sorted[miIdx].puesto<=3 ? S.gold : S.green }}>#{sorted[miIdx].puesto}</span>
              <span style={{ fontSize:'.85rem', color:S.text2 }}>de {sorted.length} jugadores · <b style={{ color:S.text }}>Top {topPct}%</b></span>
            </div>
          )}
          {enTop5 && <div style={{ background:S.goldDim, borderRadius:'8px', padding:'6px 12px', fontSize:'.78rem', color:S.gold, fontWeight:'700', marginBottom:'10px' }}>{FELICITACIONES[Math.min(sorted[miIdx].puesto,5)-1]}</div>}

          {/* Cambiar de estadística sin cerrar */}
          <div ref={chipsRef} style={{ display:'flex', gap:'6px', overflowX:'auto', paddingBottom:'8px', margin:'0 -20px 4px', padding:'0 20px 8px', scrollbarWidth:'none' }}>
            {ORDEN_STATS.map(k => {
              const c = STAT_CONFIG[k], on = k === clave
              return (
                <button key={k} data-activo={on ? '1' : '0'} onClick={()=>setClave(k)}
                  style={{ flexShrink:0, minHeight:'36px', padding:'0 12px', borderRadius:'999px', cursor:'pointer', whiteSpace:'nowrap', fontSize:'.78rem', fontWeight:700,
                    background: on ? c.color+'26' : S.card, color: on ? S.text : S.muted, border:`1.5px solid ${on ? c.color : S.border}` }}>
                  {c.icon} {c.corto}
                </button>
              )
            })}
          </div>

          {/* Tabs */}
          <div style={{ display:'flex', gap:'4px', background:S.card2, borderRadius:'8px', padding:'3px' }}>
            {[{id:'global',label:'🌍 Global'},{id:'posicion',label:'📍 Por posición'}].map(t=>(
              <button key={t.id} onClick={()=>setVista(t.id)}
                style={{ flex:1, padding:'8px', borderRadius:'6px', border:'none', cursor:'pointer', fontSize:'.78rem', fontWeight:'700', background:vista===t.id?S.green:'transparent', color:vista===t.id?'#0a1a05':S.muted }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Contenido */}
        <div style={{ flex:1, overflowY:'auto' }}>
          {loading ? (
            <div style={{ padding:'40px', textAlign:'center', color:S.muted }}>Cargando...</div>
          ) : error ? (
            <div style={{ padding:'40px 20px', textAlign:'center', color:S.muted, fontSize:'.85rem' }}>No se pudo cargar el ranking. Revisa tu conexión e inténtalo de nuevo.</div>
          ) : vista==='global' ? (
            <>
              <Empujon ranking={sorted} miIdx={miIdx} config={config}/>
              <div style={{ height:'8px' }}/>
              <SeccionRanking titulo={tituloGlobal} ranking={sorted} playerId={miId} config={config} color={config.color}/>
            </>
          ) : (
            <>
              {arqueros.length>0  && <SeccionRanking titulo="🧤 Arqueros"          ranking={arqueros} playerId={miId} config={config} color="#4c8dff"/>}
              {defensas.length>0  && <SeccionRanking titulo="🛡️ Defensas"          ranking={defensas} playerId={miId} config={config} color="#a779ff"/>}
              {campo.length>0     && <SeccionRanking titulo="⚽ Mediocampistas / Delanteros" ranking={campo} playerId={miId} config={config} color={S.green}/>}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
