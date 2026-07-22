import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import EscuelaRankingModal from '../components/EscuelaRankingModal'
import { RANKING_SECCIONES, fetchRosterConRanking } from '../lib/escuelaRankings'

const S = {
  navy: '#07070e', surface: '#0d1117', card: '#111827', card2: '#1a2234',
  border: '#1e2d3d', cyan: '#00ddd0', cyanDim: 'rgba(0,221,208,.12)',
  gold: '#f9a825', text: '#e8f4fd', text2: '#b8d4e8', muted: '#7a9ab5',
}

// Rankings completos de la escuela — solo para profesores/coordinador. Acá sí
// se ve la lista entera de cada categoría (a diferencia de la vista del
// jugador, que solo ve al #1 y su propia posición).
export default function EscuelaRankingsPage() {
  const navigate = useNavigate()
  const [profesor, setProfesor] = useState(null)
  const [escuela, setEscuela] = useState(null)
  const [roster, setRoster] = useState([])
  const [loading, setLoading] = useState(true)
  const [abierto, setAbierto] = useState(null)

  useEffect(() => { fetchTodo() }, [])

  async function fetchTodo() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { navigate('/jugador/login'); return }
    const { data: p } = await supabase.from('players').select('*').eq('user_id', user.id).single()
    if (!p || !(p.rol === 'profesor' || p.es_profesor || p.es_profesor_coordinador)) { navigate('/jugador'); return }
    if (!p.escuela_id) { navigate('/escuela'); return }
    setProfesor(p)

    const { data: esc } = await supabase.from('teams').select('*').eq('id', p.escuela_id).single()
    setEscuela(esc || null)

    const conRanking = await fetchRosterConRanking(p.escuela_id)
    setRoster(conRanking)
    setLoading(false)
  }

  if (loading) return (
    <div style={{ minHeight:'100vh', background:S.navy, display:'flex', alignItems:'center', justifyContent:'center', color:S.cyan, fontSize:'.9rem' }}>Cargando...</div>
  )

  return (
    <div style={{ minHeight:'100vh', background:S.navy, fontFamily:'system-ui,sans-serif', color:S.text, paddingBottom:'40px' }}>
      <div style={{ background:S.surface, borderBottom:`0.5px solid ${S.border}`, padding:'16px 20px' }}>
        <div style={{ maxWidth:'640px', margin:'0 auto' }}>
          <button onClick={() => navigate('/escuela')} style={{ background:'none', border:`1px solid ${S.border}`, borderRadius:'8px', padding:'5px 12px', cursor:'pointer', color:S.muted, fontSize:'.75rem', marginBottom:'10px' }}>← Escuela</button>
          <div style={{ fontWeight:'800', fontSize:'1.05rem' }}>🏅 Rankings</div>
          <div style={{ fontSize:'.72rem', color:S.muted }}>{escuela?.name}{escuela?.categoria ? ` · ${escuela.categoria}` : ''} · lista completa</div>
        </div>
      </div>

      <div style={{ maxWidth:'640px', margin:'0 auto', padding:'18px 16px' }}>
        {roster.length === 0 ? (
          <div style={{ textAlign:'center', padding:'40px 20px', color:S.muted, fontSize:'.85rem' }}>Todavía no hay jugadores en la escuela.</div>
        ) : RANKING_SECCIONES.map(sec => (
          <div key={sec.titulo} style={{ marginBottom: 20 }}>
            <div style={{ fontSize:'.78rem', fontWeight:700, color:S.text2, marginBottom:8 }}>{sec.titulo}</div>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {sec.items.map(item => {
                const filtrado = roster.filter(j => (!item.soloPortero || j.esPortero) && j[item.campo] != null)
                const top = filtrado.length > 0
                  ? [...filtrado].sort((a,b) => item.orden==='asc' ? a[item.campo]-b[item.campo] : b[item.campo]-a[item.campo])[0]
                  : null
                return (
                  <button key={item.key} onClick={() => setAbierto(item)}
                    style={{ display:'flex', alignItems:'center', gap:12, background:S.card, border:`1px solid ${S.border}`, borderRadius:12, padding:'12px 16px', cursor:'pointer', textAlign:'left' }}>
                    <span style={{ fontSize:'1.2rem' }}>{item.icon}</span>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:'.85rem', fontWeight:700, color:S.text }}>{item.label}</div>
                      <div style={{ fontSize:'.7rem', color:S.muted, marginTop:2 }}>
                        {top ? `🥇 ${top.nombre} — ${top[item.campo]}${item.unidad ? ` ${item.unidad}` : ''}` : 'Sin datos todavía'}
                      </div>
                    </div>
                    <span style={{ color:S.muted, fontSize:'.72rem' }}>{filtrado.length} →</span>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {abierto && (
        <EscuelaRankingModal item={abierto} roster={roster} playerId={profesor?.id} modoCompleto onClose={() => setAbierto(null)}/>
      )}
    </div>
  )
}
