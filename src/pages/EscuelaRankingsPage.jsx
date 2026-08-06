import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import EscuelaRankingModal from '../components/EscuelaRankingModal'
import { RANKING_SECCIONES, fetchRosterConRanking, PROFESOR_RANKING_SECCIONES, fetchProfesoresConRanking } from '../lib/escuelaRankings'
import EscuelaPageHeader from '../components/EscuelaPageHeader'
import EscuelaFeatureCard from '../components/EscuelaFeatureCard'

const S = {
  navy: '#07070e', surface: '#0d1117', card: '#111827', card2: '#1a2234',
  border: '#1e2d3d', cyan: '#00ddd0', cyanDim: 'rgba(0,221,208,.12)',
  green: '#22c55e', greenDim: 'rgba(34,197,94,.14)',
  gold: '#f9a825', text: '#e8f4fd', text2: '#b8d4e8', muted: '#7a9ab5',
}

// Mismas fotos de fondo tenues que se usan en el resto del portal de
// escuela — una por sección, para que se vea igual sin subir imágenes nuevas.
const IMG_POR_SECCION = {
  '⚽ Rendimiento en cancha':      'https://images.unsplash.com/photo-1529900748604-07564a03e7a6?w=800&q=60',
  '🧤 Arqueros':                   'https://images.unsplash.com/photo-1486286701208-1d58e9338013?w=800&q=60',
  '⚡ Pruebas físicas':            'https://images.unsplash.com/photo-1518604666860-9ed391f76460?w=800&q=60',
  '📏 Medidas':                    'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&q=60',
  '📋 Evaluaciones del profesor':  'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=800&q=60',
}

const IMG_POR_SECCION_PROF = {
  '📋 Dirección técnica':              'https://images.unsplash.com/photo-1518604666860-9ed391f76460?w=800&q=60',
  '🏆 Torneos':                        'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&q=60',
  '⭐ Evaluación del coordinador':      'https://images.unsplash.com/photo-1486286701208-1d58e9338013?w=800&q=60',
}

// Rankings completos de la escuela — solo para profesores/coordinador. Acá sí
// se ve la lista entera de cada categoría (a diferencia de la vista del
// jugador, que solo ve al #1 y su propia posición).
export default function EscuelaRankingsPage() {
  const navigate = useNavigate()
  const [profesor, setProfesor] = useState(null)
  const [escuela, setEscuela] = useState(null)
  const [roster, setRoster] = useState([])
  const [rosterProf, setRosterProf] = useState([])
  const [loading, setLoading] = useState(true)
  const [abierto, setAbierto] = useState(null)
  const [abiertoProf, setAbiertoProf] = useState(null)

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

    const profesoresConRanking = await fetchProfesoresConRanking(p.escuela_id)
    setRosterProf(profesoresConRanking)
    setLoading(false)
  }

  if (loading) return (
    <div style={{ minHeight:'100vh', background:S.navy, display:'flex', alignItems:'center', justifyContent:'center', color:S.green, fontSize:'.9rem' }}>Cargando...</div>
  )

  return (
    <div style={{ minHeight:'100vh', background:S.navy, fontFamily:'system-ui,sans-serif', color:S.text, paddingBottom:'40px' }}>
      <EscuelaPageHeader escuela={escuela} kicker={escuela?.name} titulo="RANKINGS"
        subtitulo={`${escuela?.categoria || 'Libre'} · lista completa`}/>

      <div style={{ maxWidth:'640px', margin:'0 auto', padding:'18px 16px' }}>
        {roster.length === 0 ? (
          <div style={{ textAlign:'center', padding:'40px 20px', color:S.muted, fontSize:'.85rem' }}>Todavía no hay jugadores en la escuela.</div>
        ) : (
          <>
            <div style={{ fontSize:'.72rem', color:S.muted, marginBottom:14 }}>Toca una tarjeta para ver la lista completa de esa categoría.</div>
            {RANKING_SECCIONES.map(sec => (
              <div key={sec.titulo} style={{ marginBottom: 20 }}>
                <div style={{ fontSize:'.78rem', fontWeight:700, color:S.text2, marginBottom:8 }}>{sec.titulo}</div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:10 }}>
                  {sec.items.map(item => {
                    const filtrado = roster.filter(j => (!item.soloPortero || j.esPortero) && j[item.campo] != null)
                    const top = filtrado.length > 0
                      ? [...filtrado].sort((a,b) => item.orden==='asc' ? a[item.campo]-b[item.campo] : b[item.campo]-a[item.campo])[0]
                      : null
                    return (
                      <EscuelaFeatureCard key={item.key} onClick={() => setAbierto(item)} bg={IMG_POR_SECCION[sec.titulo]}
                        icon={<span style={{ fontSize:'1.5rem' }}>{item.icon}</span>}
                        title={item.label}
                        desc={top ? `🥇 ${top.nombre.split(' ')[0]} — ${top[item.campo]}${item.unidad ? ` ${item.unidad}` : ''}` : 'Sin datos'}/>
                    )
                  })}
                </div>
              </div>
            ))}
          </>
        )}

        {rosterProf.length > 0 && (
          <>
            <div style={{ fontSize:'.78rem', fontWeight:800, color:S.gold, marginTop:8, marginBottom:12, paddingTop:16, borderTop:`1px solid ${S.border}` }}>🧑‍🏫 Profesores</div>
            {PROFESOR_RANKING_SECCIONES.map(sec => (
              <div key={sec.titulo} style={{ marginBottom: 20 }}>
                <div style={{ fontSize:'.78rem', fontWeight:700, color:S.text2, marginBottom:8 }}>{sec.titulo}</div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:10 }}>
                  {sec.items.map(item => {
                    const filtrado = rosterProf.filter(p => p[item.campo] != null)
                    const top = filtrado.length > 0
                      ? [...filtrado].sort((a,b) => item.orden==='asc' ? a[item.campo]-b[item.campo] : b[item.campo]-a[item.campo])[0]
                      : null
                    return (
                      <EscuelaFeatureCard key={item.key} onClick={() => setAbiertoProf(item)} bg={IMG_POR_SECCION_PROF[sec.titulo]} accent={S.gold}
                        icon={<span style={{ fontSize:'1.5rem' }}>{item.icon}</span>}
                        title={item.label}
                        desc={top ? `🥇 ${top.nombre.split(' ')[0]} — ${top[item.campo]}${item.unidad ? ` ${item.unidad}` : ''}` : 'Sin datos'}/>
                    )
                  })}
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {abierto && (
        <EscuelaRankingModal item={abierto} roster={roster} playerId={profesor?.id} modoCompleto onClose={() => setAbierto(null)}/>
      )}
      {abiertoProf && (
        <EscuelaRankingModal item={abiertoProf} roster={rosterProf} playerId={profesor?.id} modoCompleto onClose={() => setAbiertoProf(null)}/>
      )}
    </div>
  )
}
