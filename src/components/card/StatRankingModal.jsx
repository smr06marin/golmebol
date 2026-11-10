import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

// Colores iguales al resto de la app (negro, tarjetas planas, acento verde)
const S = {
  bg:'#0a0a0a', card:'#161616', card2:'#1c1c1c', border:'#2a2a2a',
  text:'#ffffff', text2:'#c9c9c9', muted:'#8a8a8a',
  green:'#6fcf3d', greenDim:'rgba(111,207,61,.13)',
  gold:'#f5a623', goldDim:'rgba(245,166,35,.14)',
}

// Partidos mínimos para entrar a los rankings de promedio y eficacia (con 1 partido un 100% no dice nada)
const MIN_PJ = 3

const STAT_CONFIG = {
  pj:   { label:'Partidos Jugados',   icon:'🎮', color:'#4c8dff', campo:'pj',       formato:v=>v,                        sufijo:'PJ',    minPj:0 },
  gc:   { label:'Goles',              icon:'⚽', color:'#6fcf3d', campo:'goles',    formato:v=>v,                        sufijo:'goles', minPj:0 },
  prom: { label:'Promedio',           icon:'📊', color:'#a779ff', campo:'promedio', formato:v=>parseFloat(v).toFixed(2), sufijo:'x PJ',  minPj:MIN_PJ },
  efic: { label:'Eficacia',           icon:'⚡', color:'#ff8a3d', campo:'eficacia', formato:v=>`${v}%`,                  sufijo:'',      minPj:MIN_PJ },
  pg:   { label:'Partidos Ganados',   icon:'🏆', color:'#f5a623', campo:'pg',       formato:v=>v,                        sufijo:'PG',    minPj:0 },
  pe:   { label:'Partidos Empatados', icon:'🤝', color:'#9aa0a6', campo:'pe',       formato:v=>v,                        sufijo:'PE',    minPj:0 },
  pp:   { label:'Partidos Perdidos',  icon:'📉', color:'#e5433d', campo:'pp',       formato:v=>v,                        sufijo:'PP',    minPj:0 },
}

const FELICITACIONES = [
  '¡Eres el #1! 🏆','¡Segundo lugar! 🥈','¡Top 3! Sigue así 🥉','¡Estás en el top 4! 💪','¡Top 5! Gran nivel 🔥',
]

const POS_FIELDS = ['posicion_futbol5','posicion_futbol7','posicion_futbol11']

// Misma regla que la tarjeta del jugador: si en CUALQUIER modalidad es portero, es portero.
function clasificar(p) {
  const pos = POS_FIELDS.map(f => p?.[f]).filter(Boolean)
  const esPortero = pos.includes('Portero')
  const esDefensa = !esPortero && pos.some(x => String(x).includes('Defens'))
  return { esPortero, esDefensa }
}

// ── Trae TODAS las estadísticas, ya sumadas por jugador ─────────────────────────────────────────
// 1) Si existe la función ranking_jugadores_stats (migracion_ranking_jugadores.sql) la suma la hace la base: rápido y exacto.
// 2) Si no, se lee la tabla completa por páginas (Supabase entrega máximo 1000 filas por consulta;
//    antes se leía una sola página y por eso el ranking salía incompleto y con puestos equivocados).
async function traerAgregado() {
  try {
    const { data, error } = await supabase.rpc('ranking_jugadores_stats')
    if (!error && Array.isArray(data)) {
      return data.map(r => ({
        id: String(r.player_id), nombre: r.nombre, foto: r.foto,
        players: { posicion_futbol5: r.pos5, posicion_futbol7: r.pos7, posicion_futbol11: r.pos11 },
        pj: r.pj || 0, goles: r.goles || 0, recibidos: r.recibidos || 0,
        golesComoArquero: r.goles_arq || 0, pg: r.pg || 0, pe: r.pe || 0, pp: r.pp || 0,
      }))
    }
  } catch { /* se usa el método de respaldo */ }

  const PAGINA = 1000
  const filas = []
  for (let desde = 0; ; desde += PAGINA) {
    const { data, error } = await supabase
      .from('player_match_stats')
      .select('player_id, goals_scored, goals_conceded, team_result, fue_arquero')
      .order('match_id', { ascending: true }).order('player_id', { ascending: true })
      .range(desde, desde + PAGINA - 1)
    if (error) throw error
    filas.push(...(data || []))
    if (!data || data.length < PAGINA) break
    if (desde > 200000) break // tope de seguridad
  }

  const mapa = {}
  filas.forEach(s => {
    const id = String(s.player_id)
    const j = mapa[id] || (mapa[id] = { id, pj:0, goles:0, recibidos:0, golesComoArquero:0, pg:0, pe:0, pp:0 })
    j.pj++
    j.recibidos += s.goals_conceded || 0
    j.goles += s.goals_scored || 0
    if (s.fue_arquero) j.golesComoArquero += s.goals_scored || 0
    if (s.team_result === 'win')  j.pg++
    if (s.team_result === 'draw') j.pe++
    if (s.team_result === 'loss') j.pp++
  })

  // Datos de los jugadores (nombre, foto, posición) en tandas
  const ids = Object.keys(mapa)
  const info = {}
  for (let i = 0; i < ids.length; i += 150) {
    const { data } = await supabase.from('players')
      .select('id,name,photo_face_url,photo_url,posicion_futbol5,posicion_futbol7,posicion_futbol11')
      .in('id', ids.slice(i, i + 150))
    ;(data || []).forEach(p => { info[String(p.id)] = p })
  }
  return ids.map(id => {
    const p = info[id]
    return { ...mapa[id], nombre: p?.name || '?', foto: p?.photo_face_url || p?.photo_url || null, players: p || {} }
  })
}

function armarLista(agregado) {
  return agregado.map(j => {
    const { esPortero, esDefensa } = clasificar(j.players)
    return {
      ...j, esPortero, esDefensa,
      promedio: j.pj > 0 ? parseFloat((esPortero ? j.recibidos / j.pj : j.goles / j.pj).toFixed(2)) : 0,
      eficacia: j.pj > 0 ? Math.round((j.pg / j.pj) * 100) : 0,
      posLabel: esPortero ? '🧤 Arquero' : esDefensa ? '🛡️ Defensa' : '⚽ Campo',
    }
  })
}

// Ordena y asigna el puesto real (los empatados comparten puesto: 1, 2, 2, 4…).
// Promedio de arquero: MENOS goles recibidos es mejor. El resto: más es mejor (perdidos: menos es mejor).
function ordenar(lista, config, portero) {
  const asc = config.campo === 'pp' || (config.campo === 'promedio' && portero)
  const orden = [...lista].sort((a, b) => {
    const va = a[config.campo] ?? 0, vb = b[config.campo] ?? 0
    if (va !== vb) return asc ? va - vb : vb - va
    if (b.pj !== a.pj) return b.pj - a.pj            // desempate: quien jugó más
    return String(a.nombre).localeCompare(String(b.nombre))
  })
  let puestoPrevio = 0, valorPrevio = null
  return orden.map((j, i) => {
    const v = j[config.campo] ?? 0
    if (v !== valorPrevio) { puestoPrevio = i + 1; valorPrevio = v }
    return { ...j, puesto: puestoPrevio }
  })
}

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

export default function StatRankingModal({ statKey, playerId, esPortero, onClose }) {
  const [agregado, setAgregado] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(false)
  const [vista,    setVista]    = useState('global') // 'global' | 'posicion'
  const config = STAT_CONFIG[statKey]
  const miId = playerId == null ? null : String(playerId)

  // Se piden los datos una sola vez y se reutilizan al cambiar de estadística
  useEffect(()=>{
    let vivo = true
    setLoading(true); setError(false)
    traerAgregado()
      .then(a => { if (vivo) { setAgregado(a); setLoading(false) } })
      .catch(() => { if (vivo) { setError(true); setLoading(false) } })
    return () => { vivo = false }
  },[])

  if (!config) return null

  const lista = armarLista(agregado).filter(j => j.pj >= (config.minPj || 0))
  const yoCompleto = armarLista(agregado).find(j => j.id === miId)
  const soyPortero = yoCompleto ? yoCompleto.esPortero : !!esPortero

  // Promedio: arquero (goles recibidos) y jugador de campo (goles anotados) no se mezclan,
  // así que el global de promedio se compara contra los de tu mismo tipo.
  const baseGlobal = config.campo === 'promedio' ? lista.filter(j => j.esPortero === soyPortero) : lista
  const sorted     = ordenar(baseGlobal, config, soyPortero)

  // Por posición
  const arqueros  = ordenar(lista.filter(j=>j.esPortero), config, true)
  const defensas  = ordenar(lista.filter(j=>j.esDefensa), config, false)
  const campo     = ordenar(lista.filter(j=>!j.esPortero && !j.esDefensa), config, false)

  const miIdx = sorted.findIndex(j=>j.id===miId)
  const yo    = miIdx >= 0 ? sorted[miIdx] : yoCompleto
  const enTop5= miIdx>=0 && sorted[miIdx].puesto<=5
  const tituloGlobal = config.campo === 'promedio' ? (soyPortero ? 'Ranking Global · Arqueros' : 'Ranking Global · Jugadores de campo') : 'Ranking Global'

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.85)', zIndex:500, display:'flex', alignItems:'flex-end', justifyContent:'center' }} onClick={onClose}>
      <div style={{ background:S.bg, border:`1px solid ${S.border}`, borderRadius:'20px 20px 0 0', width:'100%', maxWidth:'480px', maxHeight:'88vh', overflow:'hidden', display:'flex', flexDirection:'column' }} onClick={e=>e.stopPropagation()}>

        {/* Header */}
        <div style={{ padding:'16px 20px 12px', borderBottom:`0.5px solid ${S.border}`, flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'12px' }}>
            <div>
              <div style={{ fontWeight:'800', fontSize:'1rem', color:S.text }}>{config.icon} {config.label}</div>
              {yo && (
                <div style={{ fontSize:'.72rem', color:S.muted, marginTop:'2px' }}>
                  {yo.posLabel}{miIdx>=0 ? ` · #${sorted[miIdx].puesto} de ${sorted.length}` : ''} · {yo.pj} PJ en todos tus torneos
                  {yo.golesComoArquero>0 && ` · 🧤 ${yo.golesComoArquero} como arq.`}
                  {yo.esPortero && (yo.goles-yo.golesComoArquero)>0 && ` · ⚽ ${yo.goles-yo.golesComoArquero} como jugador`}
                </div>
              )}
            </div>
            <button onClick={onClose} aria-label="Cerrar" style={{ background:S.card2, border:'none', borderRadius:'50%', width:'32px', height:'32px', cursor:'pointer', color:S.text2, fontSize:'1rem', display:'flex', alignItems:'center', justifyContent:'center' }}>✕</button>
          </div>
          {enTop5 && <div style={{ background:S.goldDim, borderRadius:'8px', padding:'6px 12px', fontSize:'.78rem', color:S.gold, fontWeight:'700', marginBottom:'8px' }}>{FELICITACIONES[Math.min(sorted[miIdx].puesto,5)-1]}</div>}
          {/* Tabs */}
          <div style={{ display:'flex', gap:'4px', background:S.card2, borderRadius:'8px', padding:'3px' }}>
            {[{id:'global',label:'🌍 Global'},{id:'posicion',label:'📍 Por posición'}].map(t=>(
              <button key={t.id} onClick={()=>setVista(t.id)}
                style={{ flex:1, padding:'6px', borderRadius:'6px', border:'none', cursor:'pointer', fontSize:'.75rem', fontWeight:'700', background:vista===t.id?S.green:'transparent', color:vista===t.id?'#0a1a05':S.muted }}>
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
            <SeccionRanking titulo={tituloGlobal} ranking={sorted} playerId={miId} config={config} color={config.color}/>
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
