import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ArrowLeft, Shield, ChevronDown, ChevronUp } from 'lucide-react'

const FASE_LABEL = {
  grupo:'Fase de Grupos', octavos:'Octavos de Final', cuartos:'Cuartos de Final',
  semifinal:'Semifinales', tercero:'Tercer Puesto', final:'Final'
}

export default function ArbitroPerfilPage() {
  const { id }   = useParams()
  const navigate = useNavigate()
  const [arbitro,   setArbitro]   = useState(null)
  const [partidos,  setPartidos]  = useState([])
  const [loading,   setLoading]   = useState(true)
  const [abiertos,  setAbiertos]  = useState({ jugados: true, pendientes: true })

  useEffect(() => { fetchTodo() }, [id])

  async function fetchTodo() {
    setLoading(true)
    const { data: arb } = await supabase.from('players').select('*').eq('id', id).single()
    setArbitro(arb)

    const { data: pts } = await supabase
      .from('matches')
      .select('*, tournaments(id,name,modalidad), home:home_team_id(id,name,logo_url), away:away_team_id(id,name,logo_url)')
      .or(`arbitro1_id.eq.${id},arbitro2_id.eq.${id},arbitro3_id.eq.${id}`)
      .order('played_at', { ascending: false })

    // Traer eventos (tarjetas) de cada partido
    if ((pts||[]).length > 0) {
      const matchIds = (pts||[]).map(p=>p.id)
      const { data: eventos } = await supabase
        .from('match_events')
        .select('match_id, event_type')
        .in('match_id', matchIds)
        .in('event_type', ['yellow_card','blue_card','red_card'])

      const tarjetasMap = {}
      ;(eventos||[]).forEach(e => {
        if (!tarjetasMap[e.match_id]) tarjetasMap[e.match_id] = { amarillas:0, azules:0, rojas:0 }
        if (e.event_type==='yellow_card') tarjetasMap[e.match_id].amarillas++
        if (e.event_type==='blue_card')   tarjetasMap[e.match_id].azules++
        if (e.event_type==='red_card')    tarjetasMap[e.match_id].rojas++
      })

      // Traer compañeros árbitros de cada partido
      const { data: allArbs } = await supabase.from('players').select('id,name').or('rol.eq.arbitro,es_arbitro.eq.true')
      const arbsMap = {}
      ;(allArbs||[]).forEach(a => { arbsMap[a.id] = a.name })

      setPartidos((pts||[]).map(p => ({
        ...p,
        tarjetas: tarjetasMap[p.id] || { amarillas:0, azules:0, rojas:0 },
        rolArbitro: p.arbitro1_id===id ? 'Principal' : p.arbitro2_id===id ? 'Asistente 1' : 'Asistente 2',
        companeros: [
          p.arbitro1_id && p.arbitro1_id!==id && arbsMap[p.arbitro1_id],
          p.arbitro2_id && p.arbitro2_id!==id && arbsMap[p.arbitro2_id],
          p.arbitro3_id && p.arbitro3_id!==id && arbsMap[p.arbitro3_id],
        ].filter(Boolean)
      })))
    } else {
      setPartidos([])
    }
    setLoading(false)
  }

  function toggle(key) { setAbiertos(prev => ({...prev, [key]: !prev[key]})) }

  if (loading) return <div style={{ minHeight:'100vh', background:'#07070e', display:'flex', alignItems:'center', justifyContent:'center', color:'#00ddd0' }}>Cargando...</div>
  if (!arbitro) return <div style={{ minHeight:'100vh', background:'#07070e', display:'flex', alignItems:'center', justifyContent:'center', color:'#7a9ab5' }}>Árbitro no encontrado</div>

  const jugados   = partidos.filter(p => p.status==='finished')
  const pendientes= partidos.filter(p => p.status!=='finished')

  // Estadísticas globales
  const totalAmarillas = jugados.reduce((s,p)=>s+p.tarjetas.amarillas,0)
  const totalAzules    = jugados.reduce((s,p)=>s+p.tarjetas.azules,0)
  const totalRojas     = jugados.reduce((s,p)=>s+p.tarjetas.rojas,0)
  const finales        = jugados.filter(p=>p.fase==='final').length
  const semifinales    = jugados.filter(p=>p.fase==='semifinal').length
  const cuartos        = jugados.filter(p=>p.fase==='cuartos').length
  const octavos        = jugados.filter(p=>p.fase==='octavos').length
  const torneos        = new Set(jugados.map(p=>p.tournament_id)).size

  // Compañeros frecuentes
  const companeroCount = {}
  jugados.forEach(p => { p.companeros.forEach(c => { companeroCount[c] = (companeroCount[c]||0)+1 }) })
  const topCompaneros  = Object.entries(companeroCount).sort((a,b)=>b[1]-a[1]).slice(0,3)

  function CardPartido({ p }) {
    const esJugado = p.status==='finished'
    return (
      <div style={{ background:'#1e2d3d', borderRadius:'10px', padding:'12px 14px', marginBottom:'8px', border:'0.5px solid #2a3a4a' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'8px' }}>
          <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
            <span style={{ fontSize:'.65rem', color:'#00ddd0', background:'rgba(0,221,208,.1)', borderRadius:'5px', padding:'1px 7px' }}>{p.tournaments?.name}</span>
            {p.fase && <span style={{ fontSize:'.65rem', color:'#f9a825', background:'rgba(249,168,37,.1)', borderRadius:'5px', padding:'1px 7px', fontWeight:'700' }}>{FASE_LABEL[p.fase]||p.fase}</span>}
            <span style={{ fontSize:'.65rem', color:'#9955ff', background:'rgba(153,85,255,.1)', borderRadius:'5px', padding:'1px 7px' }}>{p.rolArbitro}</span>
          </div>
          <span style={{ fontSize:'.65rem', color:'#7a9ab5' }}>
            {p.played_at && new Date(p.played_at).toLocaleDateString('es-CO',{day:'2-digit',month:'short',year:'numeric'})}
          </span>
        </div>

        {/* Marcador */}
        <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom: esJugado?'8px':'0' }}>
          <div style={{ flex:1, display:'flex', alignItems:'center', gap:'6px', justifyContent:'flex-end' }}>
            {p.home?.logo_url && <img src={p.home.logo_url} style={{ width:'22px', height:'22px', objectFit:'contain' }}/>}
            <span style={{ fontWeight:'700', fontSize:'.85rem', color:'#e8f4fd', textAlign:'right' }}>{p.home?.name}</span>
          </div>
          <div style={{ fontWeight:'900', fontSize: esJugado?'1rem':'.8rem', color: esJugado?'#e8f4fd':'#7a9ab5', background:'#111827', padding:'4px 12px', borderRadius:'7px', flexShrink:0 }}>
            {esJugado ? `${p.home_score} - ${p.away_score}` : 'VS'}
          </div>
          <div style={{ flex:1, display:'flex', alignItems:'center', gap:'6px' }}>
            <span style={{ fontWeight:'700', fontSize:'.85rem', color:'#e8f4fd' }}>{p.away?.name}</span>
            {p.away?.logo_url && <img src={p.away.logo_url} style={{ width:'22px', height:'22px', objectFit:'contain' }}/>}
          </div>
        </div>

        {/* Tarjetas y compañeros */}
        {esJugado && (
          <div style={{ display:'flex', gap:'8px', flexWrap:'wrap', alignItems:'center' }}>
            {p.tarjetas.amarillas>0 && <span style={{ fontSize:'.68rem', color:'#f9a825', background:'rgba(249,168,37,.1)', borderRadius:'5px', padding:'1px 7px' }}>🟨 {p.tarjetas.amarillas}</span>}
            {p.tarjetas.azules>0    && <span style={{ fontSize:'.68rem', color:'#1a73e8', background:'rgba(26,115,232,.1)',  borderRadius:'5px', padding:'1px 7px' }}>🟦 {p.tarjetas.azules}</span>}
            {p.tarjetas.rojas>0     && <span style={{ fontSize:'.68rem', color:'#d93025', background:'rgba(217,48,37,.1)',   borderRadius:'5px', padding:'1px 7px' }}>🟥 {p.tarjetas.rojas}</span>}
            {p.tarjetas.amarillas===0&&p.tarjetas.azules===0&&p.tarjetas.rojas===0 && <span style={{ fontSize:'.68rem', color:'#1e8e3e' }}>🟢 Sin tarjetas</span>}
            {p.companeros.length>0  && <span style={{ fontSize:'.65rem', color:'#7a9ab5', marginLeft:'auto' }}>con {p.companeros.join(', ')}</span>}
          </div>
        )}
        {!esJugado && p.played_at && (
          <div style={{ fontSize:'.68rem', color:'#7a9ab5', marginTop:'4px' }}>
            🕐 {new Date(p.played_at).toLocaleTimeString('es-CO',{hour:'2-digit',minute:'2-digit'})}
            {p.location && ` · 📍 ${p.location}`}
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ minHeight:'100vh', background:'#07070e', fontFamily:'system-ui,sans-serif', color:'#e8f4fd', paddingBottom:'40px' }}>

      {/* Header */}
      <div style={{ background:'#0d1117', borderBottom:'0.5px solid #1e2d3d', padding:'12px 16px', display:'flex', alignItems:'center', gap:'12px', position:'sticky', top:0, zIndex:50 }}>
        <button onClick={()=>navigate(-1)} style={{ background:'none', border:'1px solid #1e2d3d', borderRadius:'8px', padding:'6px 8px', cursor:'pointer', color:'#7a9ab5', display:'flex' }}>
          <ArrowLeft size={18}/>
        </button>
        <div style={{ fontWeight:'700', fontSize:'.95rem', color:'#e8f4fd' }}>Perfil árbitro</div>
      </div>

      <div style={{ maxWidth:'600px', margin:'0 auto', padding:'16px' }}>

        {/* Tarjeta perfil */}
        <div style={{ background:'linear-gradient(135deg,#111827,#0d1117)', border:'1px solid #1e2d3d', borderRadius:'16px', padding:'20px', marginBottom:'16px', display:'flex', gap:'16px', alignItems:'center' }}>
          <div style={{ width:'72px', height:'72px', borderRadius:'50%', overflow:'hidden', background:'#1e2d3d', border:'3px solid #f9a825', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
            {arbitro.photo_face_url||arbitro.photo_url
              ? <img src={arbitro.photo_face_url||arbitro.photo_url} style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
              : <span style={{ fontSize:'2rem' }}>👤</span>}
          </div>
          <div>
            <div style={{ fontWeight:'900', fontSize:'1.1rem', color:'#e8f4fd' }}>{arbitro.name}</div>
            <div style={{ fontSize:'.72rem', color:'#f9a825', fontWeight:'700', marginTop:'2px' }}>🟡 ÁRBITRO</div>
            <div style={{ fontSize:'.72rem', color:'#7a9ab5', marginTop:'4px', display:'flex', gap:'10px', flexWrap:'wrap' }}>
              {arbitro.numero_cedula && <span>🪪 {arbitro.numero_cedula}</span>}
              {arbitro.telefono      && <span>📞 {arbitro.telefono}</span>}
              {arbitro.city          && <span>📍 {arbitro.city}</span>}
            </div>
          </div>
        </div>

        {/* Stats generales */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'8px', marginBottom:'12px' }}>
          {[
            { label:'Dirigidos', value:jugados.length,  color:'#00ddd0', icon:'📋' },
            { label:'Torneos',   value:torneos,          color:'#1a73e8', icon:'🏆' },
            { label:'Finales',   value:finales,          color:'#f9a825', icon:'🏅' },
            { label:'Pendientes',value:pendientes.length,color:'#e8710a', icon:'⏳' },
          ].map(s=>(
            <div key={s.label} style={{ background:'#111827', border:'1px solid #1e2d3d', borderRadius:'10px', padding:'10px', textAlign:'center' }}>
              <div style={{ fontSize:'.9rem', marginBottom:'2px' }}>{s.icon}</div>
              <div style={{ fontSize:'1.3rem', fontWeight:'900', color:s.color, lineHeight:1 }}>{s.value}</div>
              <div style={{ fontSize:'.6rem', color:'#7a9ab5', marginTop:'2px' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Tarjetas */}
        <div style={{ background:'#111827', border:'1px solid #1e2d3d', borderRadius:'12px', padding:'14px 16px', marginBottom:'12px' }}>
          <div style={{ fontSize:'.72rem', fontWeight:'700', color:'#7a9ab5', marginBottom:'10px', textTransform:'uppercase', letterSpacing:'.08em' }}>Tarjetas mostradas</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'8px' }}>
            {[
              { label:'Amarillas', value:totalAmarillas, color:'#f9a825', icon:'🟨' },
              { label:'Azules',    value:totalAzules,    color:'#1a73e8', icon:'🟦' },
              { label:'Rojas',     value:totalRojas,     color:'#d93025', icon:'🟥' },
            ].map(s=>(
              <div key={s.label} style={{ textAlign:'center', background:'#0d1117', borderRadius:'8px', padding:'10px' }}>
                <div style={{ fontSize:'1rem', marginBottom:'2px' }}>{s.icon}</div>
                <div style={{ fontSize:'1.4rem', fontWeight:'900', color:s.color }}>{s.value}</div>
                <div style={{ fontSize:'.62rem', color:'#7a9ab5' }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Fases dirigidas */}
        {(finales>0||semifinales>0||cuartos>0||octavos>0) && (
          <div style={{ background:'#111827', border:'1px solid #1e2d3d', borderRadius:'12px', padding:'14px 16px', marginBottom:'12px' }}>
            <div style={{ fontSize:'.72rem', fontWeight:'700', color:'#7a9ab5', marginBottom:'10px', textTransform:'uppercase', letterSpacing:'.08em' }}>Fases dirigidas</div>
            <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
              {finales>0    && <span style={{ fontSize:'.78rem', color:'#f9a825', background:'rgba(249,168,37,.1)', borderRadius:'8px', padding:'4px 12px', fontWeight:'700' }}>🏅 Final ×{finales}</span>}
              {semifinales>0&& <span style={{ fontSize:'.78rem', color:'#00ddd0', background:'rgba(0,221,208,.1)',  borderRadius:'8px', padding:'4px 12px' }}>Semifinal ×{semifinales}</span>}
              {cuartos>0    && <span style={{ fontSize:'.78rem', color:'#1a73e8', background:'rgba(26,115,232,.1)', borderRadius:'8px', padding:'4px 12px' }}>Cuartos ×{cuartos}</span>}
              {octavos>0    && <span style={{ fontSize:'.78rem', color:'#7a9ab5', background:'rgba(122,154,181,.1)',borderRadius:'8px', padding:'4px 12px' }}>Octavos ×{octavos}</span>}
            </div>
          </div>
        )}

        {/* Compañeros frecuentes */}
        {topCompaneros.length>0 && (
          <div style={{ background:'#111827', border:'1px solid #1e2d3d', borderRadius:'12px', padding:'14px 16px', marginBottom:'16px' }}>
            <div style={{ fontSize:'.72rem', fontWeight:'700', color:'#7a9ab5', marginBottom:'10px', textTransform:'uppercase', letterSpacing:'.08em' }}>Compañeros frecuentes</div>
            {topCompaneros.map(([nombre,veces])=>(
              <div key={nombre} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'6px 0', borderBottom:'0.5px solid #1e2d3d' }}>
                <span style={{ fontSize:'.82rem', color:'#e8f4fd' }}>🟡 {nombre}</span>
                <span style={{ fontSize:'.72rem', color:'#7a9ab5' }}>{veces} partido{veces>1?'s':''}</span>
              </div>
            ))}
          </div>
        )}

        {/* Acordeón partidos pendientes */}
        {pendientes.length>0 && (
          <div style={{ background:'#111827', border:'1px solid #1e2d3d', borderRadius:'12px', overflow:'hidden', marginBottom:'10px' }}>
            <div onClick={()=>toggle('pendientes')} style={{ padding:'12px 16px', display:'flex', alignItems:'center', justifyContent:'space-between', cursor:'pointer' }}>
              <div>
                <span style={{ fontWeight:'700', fontSize:'.9rem', color:'#e8710a' }}>⏳ Partidos pendientes</span>
                <span style={{ fontSize:'.72rem', color:'#7a9ab5', marginLeft:'8px' }}>{pendientes.length}</span>
              </div>
              {abiertos.pendientes ? <ChevronUp size={16} color="#7a9ab5"/> : <ChevronDown size={16} color="#7a9ab5"/>}
            </div>
            {abiertos.pendientes && (
              <div style={{ padding:'0 12px 12px' }}>
                {pendientes.map(p=><CardPartido key={p.id} p={p}/>)}
              </div>
            )}
          </div>
        )}

        {/* Acordeón partidos dirigidos */}
        <div style={{ background:'#111827', border:'1px solid #1e2d3d', borderRadius:'12px', overflow:'hidden' }}>
          <div onClick={()=>toggle('jugados')} style={{ padding:'12px 16px', display:'flex', alignItems:'center', justifyContent:'space-between', cursor:'pointer' }}>
            <div>
              <span style={{ fontWeight:'700', fontSize:'.9rem', color:'#1e8e3e' }}>✅ Partidos dirigidos</span>
              <span style={{ fontSize:'.72rem', color:'#7a9ab5', marginLeft:'8px' }}>{jugados.length}</span>
            </div>
            {abiertos.jugados ? <ChevronUp size={16} color="#7a9ab5"/> : <ChevronDown size={16} color="#7a9ab5"/>}
          </div>
          {abiertos.jugados && (
            <div style={{ padding:'0 12px 12px' }}>
              {jugados.length===0
                ? <div style={{ textAlign:'center', color:'#7a9ab5', padding:'20px', fontSize:'.85rem' }}>Sin partidos dirigidos</div>
                : jugados.map(p=><CardPartido key={p.id} p={p}/>)}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
