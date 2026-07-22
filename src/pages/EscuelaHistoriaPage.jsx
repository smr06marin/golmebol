import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const S = {
  navy: '#07070e', surface: '#0d1117', card: '#111827', card2: '#1a2234',
  border: '#1e2d3d', cyan: '#00ddd0', cyanDim: 'rgba(0,221,208,.12)',
  gold: '#f9a825', text: '#e8f4fd', text2: '#b8d4e8', muted: '#7a9ab5',
}

function iconoResultado(r) {
  if (!r) return '🏆'
  const t = r.toLowerCase()
  if (t.includes('campe') && !t.includes('sub')) return '🏆'
  if (t.includes('subcampe')) return '🥈'
  if (t.includes('semi')) return '🥉'
  return '🏆'
}

const EV_ICONS = { goal:'⚽', assist:'🎯', yellow:'🟨', blue:'🟦', red:'🟥', sub:'🔄', highlight:'⭐', injury:'🩹', mvp:'👑', note:'📝', save:'🧤', goal_against:'🥅' }

function fmtFechaCorta(f) {
  if (!f) return ''
  const d = new Date(f + 'T00:00:00')
  return d.toLocaleDateString('es-CO', { day:'2-digit', month:'short', year:'numeric' })
}

function FilaPartidoEquipo({ p }) {
  const [abierto, setAbierto] = useState(false)
  const resultado = p.score_home > p.score_away ? 'G' : p.score_home < p.score_away ? 'P' : 'E'
  const color = resultado === 'G' ? '#1e8e3e' : resultado === 'P' ? '#d93025' : S.muted
  return (
    <div onClick={() => setAbierto(a => !a)} style={{ background:S.card, border:`1px solid ${S.border}`, borderRadius:'14px', padding:'12px 16px', marginBottom:'8px', cursor:'pointer' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, minWidth:0 }}>
          <span style={{ width:22, height:22, borderRadius:'50%', background:color, color:'#000', fontWeight:900, fontSize:'.68rem', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>{resultado}</span>
          <div style={{ minWidth:0 }}>
            <div style={{ fontWeight:'700', fontSize:'.85rem', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>vs {p.rival || 'Rival'}</div>
            <div style={{ fontSize:'.7rem', color:S.muted, marginTop:2 }}>{fmtFechaCorta(p.fecha)}{p.torneo ? ` · ${p.torneo}` : ''}</div>
          </div>
        </div>
        <div style={{ fontSize:'1.1rem', fontWeight:900, color:S.cyan, flexShrink:0 }}>{p.score_home} – {p.score_away}</div>
      </div>
      {abierto && (
        <div style={{ marginTop:12, paddingTop:12, borderTop:`1px solid ${S.border}` }}>
          {p.mvp?.first && <div style={{ fontSize:12, marginBottom:8 }}>👑 MVP: {(p.lineup||[]).find(x => String(x.id) === String(p.mvp.first))?.name || '—'}</div>}
          {p.observaciones && <div style={{ fontSize:'.75rem', color:S.text2, marginBottom:8, fontStyle:'italic' }}>"{p.observaciones}"</div>}
          {(p.eventos||[]).length === 0 ? (
            <div style={{ fontSize:'.72rem', color:S.muted }}>Sin eventos registrados</div>
          ) : (p.eventos||[]).slice(0,25).map(ev => (
            <div key={ev.id} style={{ display:'flex', gap:6, fontSize:'.74rem', padding:'3px 0' }}>
              <span style={{ color:S.cyan, fontFamily:'monospace', minWidth:26 }}>{ev.min}'</span>
              <span>{EV_ICONS[ev.type]||''}</span>
              <span style={{ color:S.text2 }}>{ev.player}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Vista pública (para cualquier jugador de la escuela) del recorrido
// completo de su escuela: torneos externos jugados, resultado de cada uno,
// y los premios individuales que se entregaron en cada uno.
export default function EscuelaHistoriaPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [escuela, setEscuela] = useState(null)
  const [torneos, setTorneos] = useState([])
  const [premiosPorTorneo, setPremiosPorTorneo] = useState({})
  const [partidos, setPartidos] = useState([])
  const [tab, setTab] = useState('partidos') // 'partidos' | 'torneos'
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchTodo() }, [id])

  async function fetchTodo() {
    if (!id) { setLoading(false); return }
    setLoading(true)
    const { data: esc } = await supabase.from('teams').select('*').eq('id', id).single()
    setEscuela(esc || null)

    const { data: t } = await supabase.from('escuela_torneos').select('*').eq('escuela_id', id).order('fecha_inicio', { ascending: false })
    setTorneos(t || [])

    if (t && t.length > 0) {
      const { data: prem } = await supabase.from('escuela_torneo_premios')
        .select('*, players(name)')
        .in('torneo_id', t.map(x => x.id))
      const agrupado = {}
      ;(prem || []).forEach(p => {
        if (!agrupado[p.torneo_id]) agrupado[p.torneo_id] = []
        agrupado[p.torneo_id].push(p)
      })
      setPremiosPorTorneo(agrupado)
    }

    const { data: parts } = await supabase.from('escuela_partidos').select('*')
      .eq('escuela_id', id).eq('estado', 'finalizado')
      .order('fecha', { ascending: false }).order('created_at', { ascending: false })
    setPartidos(parts || [])

    setLoading(false)
  }

  if (loading) return (
    <div style={{ minHeight:'100vh', background:S.navy, display:'flex', alignItems:'center', justifyContent:'center', color:S.cyan, fontSize:'.9rem' }}>Cargando...</div>
  )
  if (!escuela) return (
    <div style={{ minHeight:'100vh', background:S.navy, display:'flex', alignItems:'center', justifyContent:'center', color:S.muted, fontSize:'.9rem' }}>No se encontró la escuela</div>
  )

  const finalizados = torneos.filter(t => t.estado === 'finalizado')
  const enCurso     = torneos.filter(t => t.estado !== 'finalizado')
  const campeonatos = finalizados.filter(t => (t.resultado_final || '').toLowerCase().includes('campe') && !(t.resultado_final || '').toLowerCase().includes('sub'))

  return (
    <div style={{ minHeight:'100vh', background:S.navy, fontFamily:'system-ui,sans-serif', color:S.text, paddingBottom:'40px' }}>
      <div style={{ background:S.surface, borderBottom:`0.5px solid ${S.border}`, padding:'16px 20px' }}>
        <div style={{ maxWidth:'500px', margin:'0 auto', display:'flex', alignItems:'center', gap:'12px' }}>
          <button onClick={() => navigate(-1)} style={{ background:'none', border:`1px solid ${S.border}`, borderRadius:'8px', padding:'7px 10px', cursor:'pointer', color:S.muted, fontSize:'.85rem' }}>←</button>
          <div style={{ width:'40px', height:'40px', borderRadius:'10px', overflow:'hidden', flexShrink:0, background:S.card2, display:'flex', alignItems:'center', justifyContent:'center' }}>
            {escuela.logo_url ? <img src={escuela.logo_url} style={{ width:'100%', height:'100%', objectFit:'contain', padding:'3px' }}/> : <span style={{ fontSize:'1.1rem' }}>🛡️</span>}
          </div>
          <div>
            <div style={{ fontSize:'.65rem', color:S.muted, textTransform:'uppercase', letterSpacing:'.1em' }}>Recorrido de la escuela</div>
            <div style={{ fontWeight:'800', fontSize:'1.05rem' }}>{escuela.name}</div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth:'500px', margin:'0 auto', padding:'20px 16px' }}>
        {/* Resumen */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:'8px', marginBottom:'18px' }}>
          {[
            { label:'Partidos', valor: partidos.length, icon:'⚽' },
            { label:'Ganados', valor: partidos.filter(p=>p.score_home>p.score_away).length, icon:'✅' },
            { label:'Torneos', valor: torneos.length, icon:'📅' },
            { label:'Campeonatos', valor: campeonatos.length, icon:'🏆' },
          ].map(s => (
            <div key={s.label} style={{ background:S.card, border:`1px solid ${S.border}`, borderRadius:'12px', padding:'12px 6px', textAlign:'center' }}>
              <div style={{ fontSize:'1.1rem' }}>{s.icon}</div>
              <div style={{ fontSize:'1.2rem', fontWeight:'900', color:S.cyan, marginTop:'2px' }}>{s.valor}</div>
              <div style={{ fontSize:'.58rem', color:S.muted, marginTop:'2px' }}>{s.label}</div>
            </div>
          ))}
        </div>

        <div style={{ display:'flex', gap:'6px', marginBottom:'16px' }}>
          {[{ id:'partidos', label:`⚽ Partidos (${partidos.length})` }, { id:'torneos', label:`🏆 Torneos (${torneos.length})` }].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{ flex:1, padding:'9px', borderRadius:'10px', border:`1px solid ${tab===t.id?S.cyan:S.border}`, background:tab===t.id?S.cyanDim:'transparent', color:tab===t.id?S.cyan:S.muted, fontSize:'.78rem', fontWeight:700, cursor:'pointer' }}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'partidos' && (
          partidos.length === 0 ? (
            <div style={{ textAlign:'center', color:S.muted, padding:'48px 16px' }}>
              <div style={{ fontSize:'2rem', marginBottom:'8px' }}>⚽</div>
              <div style={{ fontSize:'.85rem' }}>Esta escuela todavía no tiene partidos guardados</div>
            </div>
          ) : (
            <div>{partidos.map(p => <FilaPartidoEquipo key={p.id} p={p}/>)}</div>
          )
        )}

        {tab === 'torneos' && (torneos.length === 0 ? (
          <div style={{ textAlign:'center', color:S.muted, padding:'48px 16px' }}>
            <div style={{ fontSize:'2rem', marginBottom:'8px' }}>📋</div>
            <div style={{ fontSize:'.85rem' }}>Esta escuela todavía no tiene torneos registrados</div>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
            {torneos.map(t => {
              const premios = premiosPorTorneo[t.id] || []
              return (
                <div key={t.id} style={{ background:S.card, border:`1px solid ${S.border}`, borderRadius:'14px', padding:'14px 16px' }}>
                  <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'8px' }}>
                    <div>
                      <div style={{ fontWeight:'800', fontSize:'.95rem', color:S.text }}>{t.nombre}</div>
                      <div style={{ fontSize:'.68rem', color:S.muted, marginTop:'2px' }}>
                        {t.temporada && <span>{t.temporada}</span>}
                        {t.fase_actual && <span> · {t.fase_actual}</span>}
                      </div>
                    </div>
                    <span style={{ fontSize:'.68rem', fontWeight:'700', padding:'3px 10px', borderRadius:'20px', flexShrink:0, background: t.estado==='finalizado' ? 'rgba(249,168,37,.12)' : S.cyanDim, color: t.estado==='finalizado' ? S.gold : S.cyan }}>
                      {t.estado === 'finalizado' ? 'Finalizado' : 'En curso'}
                    </span>
                  </div>
                  {t.resultado_final && (
                    <div style={{ marginTop:'8px', display:'flex', alignItems:'center', gap:'8px', padding:'8px 10px', borderRadius:'10px', background:'rgba(249,168,37,.08)', border:`1px solid ${S.gold}44` }}>
                      <span style={{ fontSize:'1.1rem' }}>{iconoResultado(t.resultado_final)}</span>
                      <span style={{ fontSize:'.8rem', fontWeight:'700', color:S.gold }}>{t.resultado_final}</span>
                    </div>
                  )}
                  {premios.length > 0 && (
                    <div style={{ marginTop:'10px', display:'flex', flexDirection:'column', gap:'5px' }}>
                      {premios.map(p => (
                        <div key={p.id} style={{ display:'flex', alignItems:'center', gap:'8px', fontSize:'.75rem', color:S.text2 }}>
                          <span>{p.emoji || '🏆'}</span>
                          <span style={{ fontWeight:'600' }}>{p.players?.name}</span>
                          <span style={{ color:S.muted }}>— {p.nombre}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
