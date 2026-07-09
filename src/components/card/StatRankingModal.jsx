import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

const S = {
  navy:'#07070e', card:'#111827', border:'#1e2d3d',
  cyan:'#00ddd0', cyanDim:'rgba(0,221,208,.12)',
  gold:'#f9a825', goldDim:'rgba(249,168,37,.1)',
  text:'#e8f4fd', muted:'#7a9ab5', win:'#1e8e3e', loss:'#d93025',
}

const STAT_CONFIG = {
  pj:   { label:'Partidos Jugados',   icon:'🎮', color:'#1a73e8', campo:'pj',       formato:v=>v,                        sufijo:'PJ'    },
  gc:   { label:'Goles',              icon:'⚽', color:'#1e8e3e', campo:'goles',    formato:v=>v,                        sufijo:'goles' },
  prom: { label:'Promedio',           icon:'📊', color:'#6c35de', campo:'promedio', formato:v=>parseFloat(v).toFixed(2), sufijo:'x PJ'  },
  efic: { label:'Eficacia',           icon:'⚡', color:'#e8710a', campo:'eficacia', formato:v=>`${v}%`,                  sufijo:''      },
  pg:   { label:'Partidos Ganados',   icon:'🏆', color:'#f9a825', campo:'pg',       formato:v=>v,                        sufijo:'PG'    },
  pe:   { label:'Partidos Empatados', icon:'🤝', color:'#9aa0a6', campo:'pe',       formato:v=>v,                        sufijo:'PE'    },
  pp:   { label:'Partidos Perdidos',  icon:'📉', color:'#d93025', campo:'pp',       formato:v=>v,                        sufijo:'PP'    },
}

const FELICITACIONES = [
  '¡Eres el #1! 🏆','¡Segundo lugar! 🥈','¡Top 3! Sigue así 🥉','¡Estás en el top 4! 💪','¡Top 5! Gran nivel 🔥',
]

function FilaRanking({ j, puesto, esYo, config }) {
  const val = config.formato(j[config.campo] ?? 0)
  const medalla = puesto===1?'🥇':puesto===2?'🥈':puesto===3?'🥉':null
  return (
    <div style={{ padding:'10px 20px', display:'flex', alignItems:'center', gap:'12px', background: esYo ? S.cyanDim : 'transparent', borderLeft: esYo ? `3px solid ${S.cyan}` : 'none' }}>
      <div style={{ width:'28px', textAlign:'center', flexShrink:0, fontWeight:'900', fontSize:medalla?'1.1rem':'.85rem', color: puesto<=3?S.gold:S.muted }}>
        {medalla || `#${puesto}`}
      </div>
      <div style={{ width:'32px', height:'32px', borderRadius:'50%', overflow:'hidden', background:S.border, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
        {j.foto?<img src={j.foto} style={{ width:'100%', height:'100%', objectFit:'cover' }}/>:<span style={{ fontSize:'.75rem' }}>👤</span>}
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:'.82rem', fontWeight: esYo?'800':'500', color: esYo?S.cyan:S.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          {j.nombre} {esYo && '← Tú'}
        </div>
        <div style={{ fontSize:'.65rem', color:S.muted, marginTop:'1px' }}>{j.posLabel||''} · {j.pj} PJ</div>
      </div>
      <div style={{ fontWeight:'900', fontSize:'1rem', color:esYo?S.cyan:config.color, flexShrink:0 }}>
        {val}<span style={{ fontSize:'.62rem', color:S.muted, fontWeight:'400', marginLeft:'2px' }}>{config.sufijo}</span>
      </div>
    </div>
  )
}

function SeccionRanking({ titulo, ranking, playerId, config, color }) {
  const miIdx   = ranking.findIndex(j=>j.id===playerId)
  const miPuesto= miIdx>=0 ? { puesto:miIdx+1, idx:miIdx } : null
  const enTop5  = miPuesto && miPuesto.puesto<=5
  const fuera5  = miPuesto && miPuesto.puesto>5
  const top5    = ranking.slice(0,5)
  const ctxStart= Math.max(5, miIdx-2)
  const ctxEnd  = Math.min(ranking.length, miIdx+3)
  const contexto= fuera5 ? ranking.slice(ctxStart, ctxEnd) : []
  const hayGap  = fuera5 && ctxStart>5

  return (
    <div style={{ marginBottom:'16px' }}>
      <div style={{ padding:'8px 20px', background:S.border, display:'flex', alignItems:'center', gap:'8px' }}>
        <div style={{ width:'4px', height:'16px', borderRadius:'2px', background:color||config.color }}/>
        <span style={{ fontSize:'.75rem', fontWeight:'700', color:S.text, letterSpacing:'.06em' }}>{titulo}</span>
        <span style={{ fontSize:'.65rem', color:S.muted }}>({ranking.length} jugadores)</span>
      </div>
      {ranking.length===0 ? (
        <div style={{ padding:'16px 20px', color:S.muted, fontSize:'.8rem' }}>Sin datos</div>
      ) : (
        <>
          {top5.map((j,i)=><FilaRanking key={j.id} j={j} puesto={i+1} esYo={j.id===playerId} config={config}/>)}
          {hayGap && (
            <div style={{ padding:'8px 20px', display:'flex', alignItems:'center', gap:'8px' }}>
              <div style={{ flex:1, height:'1px', background:S.border }}/>
              <span style={{ fontSize:'.75rem', color:S.muted, fontWeight:'700', letterSpacing:'.15em' }}>• • •</span>
              <div style={{ flex:1, height:'1px', background:S.border }}/>
            </div>
          )}
          {fuera5 && contexto.length>0 && (
            <>
              <div style={{ padding:'4px 20px', background:'rgba(0,221,208,.06)' }}>
                <span style={{ fontSize:'.63rem', fontWeight:'700', color:S.cyan, letterSpacing:'.1em' }}>TU POSICIÓN · #{miPuesto.puesto}</span>
              </div>
              {contexto.map((j,i)=><FilaRanking key={j.id} j={j} puesto={ctxStart+i+1} esYo={j.id===playerId} config={config}/>)}
            </>
          )}
          {!miPuesto && (
            <div style={{ padding:'12px 20px', textAlign:'center', color:S.muted, borderTop:`0.5px solid ${S.border}`, fontSize:'.78rem' }}>
              Sin registros aún — juega partidos para aparecer
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default function StatRankingModal({ statKey, playerId, esPortero, onClose }) {
  const [jugadores, setJugadores] = useState([])
  const [loading,   setLoading]   = useState(true)
  const [vista,     setVista]     = useState('global') // 'global' | 'posicion'
  const config = STAT_CONFIG[statKey]

  useEffect(()=>{ if(config) fetchRanking() },[statKey])

  async function fetchRanking() {
    setLoading(true)
    const { data: allStats } = await supabase
      .from('player_match_stats')
      .select('player_id, goals_scored, goals_conceded, team_result, fue_arquero, players(id,name,photo_face_url,photo_url,posicion_futbol5,posicion_futbol7,posicion_futbol11)')

    if (!allStats) { setLoading(false); return }

    const mapa = {}
    allStats.forEach(s => {
      const pid = s.player_id
      if (!mapa[pid]) {
        const pos = s.players?.posicion_futbol5 || s.players?.posicion_futbol7 || s.players?.posicion_futbol11 || 'Campo'
        mapa[pid] = {
          id: pid,
          nombre: s.players?.name || '?',
          foto: s.players?.photo_face_url || s.players?.photo_url || null,
          posicion: pos,
          esPortero: pos === 'Portero',
          pj:0, goles:0, golesComoJugador:0, golesComoArquero:0,
          recibidos:0, pg:0, pe:0, pp:0,
        }
      }
      const j = mapa[pid]
      j.pj++
      j.recibidos += s.goals_conceded || 0
      // Separar goles: si fue arquero en ese partido y metió gol → gol como arquero
      const golesPartido = s.goals_scored || 0
      if (s.fue_arquero) {
        j.golesComoArquero += golesPartido
      } else {
        j.golesComoJugador += golesPartido
      }
      j.goles += golesPartido
      if (s.team_result==='win')  j.pg++
      if (s.team_result==='draw') j.pe++
      if (s.team_result==='loss') j.pp++
    })

    const lista = Object.values(mapa).map(j=>({
      ...j,
      promedio: j.pj>0 ? parseFloat((j.esPortero ? j.recibidos/j.pj : j.goles/j.pj).toFixed(2)) : 0,
      eficacia: j.pj>=3 ? Math.round((j.pg/j.pj)*100) : 0,
      posLabel: j.esPortero ? '🧤 Arquero' : j.posicion==='Defensa'||j.posicion==='Defensor'?'🛡️ Defensa' : '⚽ Campo',
    }))

    setJugadores(lista)
    setLoading(false)
  }

  if (!config) return null

  const sorted = [...jugadores].sort((a,b)=>{
    const va = a[config.campo]??0, vb = b[config.campo]??0
    return config.campo==='pp'||config.campo==='recibidos' ? va-vb : vb-va
  })

  // Por posición
  const arqueros  = sorted.filter(j=>j.esPortero)
  const defensas  = sorted.filter(j=>!j.esPortero && (j.posicion==='Defensa'||j.posicion==='Defensor'))
  const campo     = sorted.filter(j=>!j.esPortero && j.posicion!=='Defensa' && j.posicion!=='Defensor')

  // Info del jugador actual
  const miIdx = sorted.findIndex(j=>j.id===playerId)
  const yo    = jugadores.find(j=>j.id===playerId)
  const enTop5= miIdx>=0 && miIdx<5

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.85)', zIndex:500, display:'flex', alignItems:'flex-end', justifyContent:'center' }} onClick={onClose}>
      <div style={{ background:S.navy, borderRadius:'20px 20px 0 0', width:'100%', maxWidth:'480px', maxHeight:'88vh', overflow:'hidden', display:'flex', flexDirection:'column' }} onClick={e=>e.stopPropagation()}>

        {/* Header */}
        <div style={{ padding:'16px 20px 12px', borderBottom:`0.5px solid ${S.border}`, flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'12px' }}>
            <div>
              <div style={{ fontWeight:'800', fontSize:'1rem', color:S.text }}>{config.icon} {config.label}</div>
              {yo && (
                <div style={{ fontSize:'.72rem', color:S.muted, marginTop:'2px' }}>
                  {yo.posLabel} · #{miIdx+1} de {sorted.length}
                  {yo.golesComoArquero>0 && ` · 🧤 ${yo.golesComoArquero} como arq.`}
                  {yo.golesComoJugador>0 && yo.esPortero && ` · ⚽ ${yo.golesComoJugador} como jugador`}
                </div>
              )}
            </div>
            <button onClick={onClose} style={{ background:S.border, border:'none', borderRadius:'50%', width:'32px', height:'32px', cursor:'pointer', color:S.muted, fontSize:'1rem', display:'flex', alignItems:'center', justifyContent:'center' }}>✕</button>
          </div>
          {enTop5 && <div style={{ background:S.goldDim, borderRadius:'8px', padding:'6px 12px', fontSize:'.78rem', color:S.gold, fontWeight:'700', marginBottom:'8px' }}>{FELICITACIONES[miIdx]}</div>}
          {/* Tabs */}
          <div style={{ display:'flex', gap:'4px', background:S.border, borderRadius:'8px', padding:'3px' }}>
            {[{id:'global',label:'🌍 Global'},{id:'posicion',label:'📍 Por posición'}].map(t=>(
              <button key={t.id} onClick={()=>setVista(t.id)}
                style={{ flex:1, padding:'6px', borderRadius:'6px', border:'none', cursor:'pointer', fontSize:'.75rem', fontWeight:'700', background:vista===t.id?'#1a73e8':'transparent', color:vista===t.id?'#fff':S.muted }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Contenido */}
        <div style={{ flex:1, overflowY:'auto' }}>
          {loading ? (
            <div style={{ padding:'40px', textAlign:'center', color:S.muted }}>Cargando...</div>
          ) : vista==='global' ? (
            <SeccionRanking titulo="Ranking Global" ranking={sorted} playerId={playerId} config={config} color={config.color}/>
          ) : (
            <>
              {arqueros.length>0  && <SeccionRanking titulo="🧤 Arqueros"          ranking={arqueros} playerId={playerId} config={config} color="#1a73e8"/>}
              {defensas.length>0  && <SeccionRanking titulo="🛡️ Defensas"          ranking={defensas} playerId={playerId} config={config} color="#9955ff"/>}
              {campo.length>0     && <SeccionRanking titulo="⚽ Mediocampistas / Delanteros" ranking={campo} playerId={playerId} config={config} color="#1e8e3e"/>}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
