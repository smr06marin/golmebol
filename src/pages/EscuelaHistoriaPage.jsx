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

// Vista pública (para cualquier jugador de la escuela) del recorrido
// completo de su escuela: torneos externos jugados, resultado de cada uno,
// y los premios individuales que se entregaron en cada uno.
export default function EscuelaHistoriaPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [escuela, setEscuela] = useState(null)
  const [torneos, setTorneos] = useState([])
  const [premiosPorTorneo, setPremiosPorTorneo] = useState({})
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
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'8px', marginBottom:'22px' }}>
          {[
            { label:'Torneos jugados', valor: torneos.length, icon:'📅' },
            { label:'Campeonatos', valor: campeonatos.length, icon:'🏆' },
            { label:'En curso', valor: enCurso.length, icon:'⏳' },
          ].map(s => (
            <div key={s.label} style={{ background:S.card, border:`1px solid ${S.border}`, borderRadius:'12px', padding:'12px 8px', textAlign:'center' }}>
              <div style={{ fontSize:'1.1rem' }}>{s.icon}</div>
              <div style={{ fontSize:'1.3rem', fontWeight:'900', color:S.cyan, marginTop:'2px' }}>{s.valor}</div>
              <div style={{ fontSize:'.6rem', color:S.muted, marginTop:'2px' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {torneos.length === 0 ? (
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
        )}
      </div>
    </div>
  )
}
