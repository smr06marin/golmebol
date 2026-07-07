import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ArrowLeft, ChevronDown, ChevronUp, Shield } from 'lucide-react'

const FASE_LABEL = { grupo:'Grupos', octavos:'Octavos', cuartos:'Cuartos', semifinal:'Semifinal', tercero:'3er Puesto', final:'Final' }
const CRITERIOS  = [
  { key:'puntualidad',    label:'Puntualidad',       icon:'⏰' },
  { key:'presentacion',   label:'Presentación',      icon:'👔' },
  { key:'control_juego',  label:'Control',           icon:'🎯' },
  { key:'criterio',       label:'Criterio',          icon:'⚖️' },
  { key:'comunicacion',   label:'Comunicación',      icon:'🗣️' },
  { key:'posicionamiento',label:'Posicionamiento',   icon:'📍' },
]
const PRUEBAS = [
  { key:'cooper_metros',       label:'Cooper',          unit:'m' },
  { key:'sprint_segundos',     label:'Sprint 50m',      unit:'seg' },
  { key:'yoyo_nivel',          label:'Yo-Yo',           unit:'' },
  { key:'peso_kg',             label:'Peso',            unit:'kg' },
  { key:'talla_cm',            label:'Talla',           unit:'cm' },
  { key:'imc',                 label:'IMC',             unit:'' },
  { key:'presion_arterial',    label:'Presión arterial',unit:'' },
  { key:'flexibilidad_cm',     label:'Flexibilidad',    unit:'cm' },
  { key:'frecuencia_cardiaca', label:'Frec. cardíaca',  unit:'bpm' },
]

export default function ArbitroPerfilPage() {
  const { id }   = useParams()
  const navigate = useNavigate()
  const [arbitro,   setArbitro]   = useState(null)
  const [partidos,  setPartidos]  = useState([])
  const [evals,     setEvals]     = useState([])
  const [exams,     setExams]     = useState([])
  const [reclamos,  setReclamos]  = useState([])
  const [loading,   setLoading]   = useState(true)
  const [esLider,   setEsLider]   = useState(false)
  const [abiertos,  setAbiertos]  = useState({ jugados:true, pendientes:false, evals:false, examenes:false, reclamos:false })
  const [tarjetasMap, setTarjetasMap] = useState({})

  useEffect(()=>{ fetchTodo() },[id])

  async function fetchTodo() {
    setLoading(true)
    // Verificar si el usuario actual es líder
    const { data:{user} } = await supabase.auth.getUser()
    if (user) {
      const { data:yo } = await supabase.from('players').select('es_arbitro_lider').eq('user_id',user.id).single()
      setEsLider(yo?.es_arbitro_lider||false)
    }

    const { data:arb } = await supabase.from('players').select('*').eq('id',id).single()
    setArbitro(arb)

    const { data:pts } = await supabase.from('matches')
      .select('*, tournaments(id,name), home:home_team_id(id,name,logo_url), away:away_team_id(id,name,logo_url)')
      .or(`arbitro1_id.eq.${id},arbitro2_id.eq.${id},arbitro3_id.eq.${id}`)
      .order('played_at',{ascending:false})

    // Tarjetas por partido
    if ((pts||[]).length>0) {
      const mIds = (pts||[]).map(p=>p.id)
      const { data:evts } = await supabase.from('match_events').select('match_id,event_type').in('match_id',mIds).in('event_type',['yellow_card','blue_card','red_card'])
      const tm = {}
      ;(evts||[]).forEach(e=>{ if(!tm[e.match_id]) tm[e.match_id]={amarillas:0,azules:0,rojas:0}; if(e.event_type==='yellow_card')tm[e.match_id].amarillas++; if(e.event_type==='blue_card')tm[e.match_id].azules++; if(e.event_type==='red_card')tm[e.match_id].rojas++ })
      setTarjetasMap(tm)
    }

    // Compañeros árbitros
    const { data:allArbs } = await supabase.from('players').select('id,name').or('rol.eq.arbitro,es_arbitro.eq.true')
    const arbsMap = {}; (allArbs||[]).forEach(a=>{ arbsMap[a.id]=a.name })

    setPartidos((pts||[]).map(p=>({
      ...p,
      rolArbitro: p.arbitro1_id===id?'Principal':p.arbitro2_id===id?'Asistente 1':'Asistente 2',
      companeros: [p.arbitro1_id,p.arbitro2_id,p.arbitro3_id].filter(aid=>aid&&aid!==id).map(aid=>arbsMap[aid]).filter(Boolean)
    })))

    const { data:ev } = await supabase.from('arbitro_evaluaciones').select('*').eq('arbitro_id',id).order('created_at',{ascending:false})
    setEvals(ev||[])

    const { data:ex } = await supabase.from('arbitro_examenes').select('*').eq('arbitro_id',id).order('created_at',{ascending:false})
    setExams(ex||[])

    const { data:rec } = await supabase.from('arbitro_reclamos')
      .select('*, matches(id,played_at,home:home_team_id(name),away:away_team_id(name))')
      .eq('arbitro_id',id).order('created_at',{ascending:false})
    setReclamos(rec||[])

    setLoading(false)
  }

  function toggle(key) { setAbiertos(prev=>({...prev,[key]:!prev[key]})) }

  if (loading) return <div style={{ minHeight:'100vh',background:'#07070e',display:'flex',alignItems:'center',justifyContent:'center',color:'#00ddd0' }}>Cargando...</div>
  if (!arbitro) return <div style={{ minHeight:'100vh',background:'#07070e',display:'flex',alignItems:'center',justifyContent:'center',color:'#7a9ab5' }}>Árbitro no encontrado</div>

  const jugados    = partidos.filter(p=>p.status==='finished')
  const pendientes = partidos.filter(p=>p.status!=='finished')
  const totalAm    = jugados.reduce((s,p)=>(tarjetasMap[p.id]?.amarillas||0)+s,0)
  const totalAz    = jugados.reduce((s,p)=>(tarjetasMap[p.id]?.azules||0)+s,0)
  const totalRj    = jugados.reduce((s,p)=>(tarjetasMap[p.id]?.rojas||0)+s,0)
  const finales    = jugados.filter(p=>p.fase==='final').length
  const semis      = jugados.filter(p=>p.fase==='semifinal').length
  const cuartos    = jugados.filter(p=>p.fase==='cuartos').length
  const octavos    = jugados.filter(p=>p.fase==='octavos').length
  const torneos    = new Set(jugados.map(p=>p.tournament_id)).size
  const promEval   = evals.length>0 ? Math.round(evals.reduce((s,e)=>s+e.total,0)/evals.length) : null
  const ultimoFis  = exams.find(e=>e.tipo==='fisico')
  const ultimoMed  = exams.find(e=>e.tipo==='medico')
  const companeroCount = {}
  jugados.forEach(p=>{ p.companeros.forEach(c=>{ companeroCount[c]=(companeroCount[c]||0)+1 }) })
  const topCompaneros = Object.entries(companeroCount).sort((a,b)=>b[1]-a[1]).slice(0,3)

  function SectionHeader({ title, stateKey, count, color='#e8f4fd' }) {
    return (
      <div onClick={()=>toggle(stateKey)} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px', cursor:'pointer', background:'#111827', borderRadius:'12px', marginBottom: abiertos[stateKey]?'0':'0', borderBottomLeftRadius: abiertos[stateKey]?0:12, borderBottomRightRadius: abiertos[stateKey]?0:12 }}>
        <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
          <span style={{ fontWeight:'700', fontSize:'.9rem', color }}>{title}</span>
          {count!==undefined && <span style={{ fontSize:'.72rem', color:'#7a9ab5', background:'#1e2d3d', borderRadius:'10px', padding:'1px 8px' }}>{count}</span>}
        </div>
        {abiertos[stateKey]?<ChevronUp size={16} color="#7a9ab5"/>:<ChevronDown size={16} color="#7a9ab5"/>}
      </div>
    )
  }

  function CardPartido({ p }) {
    const esJugado = p.status==='finished'
    const t = tarjetasMap[p.id]||{amarillas:0,azules:0,rojas:0}
    return (
      <div style={{ background:'#1e2d3d', borderRadius:'10px', padding:'11px 13px', marginBottom:'6px' }}>
        <div style={{ display:'flex', gap:'5px', flexWrap:'wrap', marginBottom:'6px' }}>
          <span style={{ fontSize:'.62rem', color:'#00ddd0', background:'rgba(0,221,208,.08)', borderRadius:'4px', padding:'1px 6px' }}>{p.tournaments?.name}</span>
          {p.fase && <span style={{ fontSize:'.62rem', color:'#f9a825', fontWeight:'700' }}>{FASE_LABEL[p.fase]||p.fase}</span>}
          <span style={{ fontSize:'.62rem', color:'#9955ff', background:'rgba(153,85,255,.08)', borderRadius:'4px', padding:'1px 6px' }}>{p.rolArbitro}</span>
          {p.played_at && <span style={{ fontSize:'.62rem', color:'#7a9ab5', marginLeft:'auto' }}>{new Date(p.played_at).toLocaleDateString('es-CO',{day:'2-digit',month:'short',year:'numeric'})}</span>}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'6px', marginBottom: esJugado?'7px':'0' }}>
          <div style={{ flex:1, display:'flex', alignItems:'center', gap:'5px', justifyContent:'flex-end' }}>
            {p.home?.logo_url&&<img src={p.home.logo_url} style={{ width:'18px', height:'18px', objectFit:'contain' }}/>}
            <span style={{ fontSize:'.82rem', fontWeight:'700', color:'#e8f4fd' }}>{p.home?.name}</span>
          </div>
          <div style={{ fontWeight:'900', fontSize:esJugado?'.95rem':'.78rem', color:esJugado?'#e8f4fd':'#7a9ab5', background:'#111827', padding:'3px 10px', borderRadius:'6px', flexShrink:0 }}>
            {esJugado?`${p.home_score}-${p.away_score}`:'VS'}
          </div>
          <div style={{ flex:1, display:'flex', alignItems:'center', gap:'5px' }}>
            <span style={{ fontSize:'.82rem', fontWeight:'700', color:'#e8f4fd' }}>{p.away?.name}</span>
            {p.away?.logo_url&&<img src={p.away.logo_url} style={{ width:'18px', height:'18px', objectFit:'contain' }}/>}
          </div>
        </div>
        {esJugado && (
          <div style={{ display:'flex', gap:'6px', flexWrap:'wrap', alignItems:'center' }}>
            {t.amarillas>0&&<span style={{ fontSize:'.65rem', color:'#f9a825', background:'rgba(249,168,37,.1)', borderRadius:'4px', padding:'1px 6px' }}>🟨 {t.amarillas}</span>}
            {t.azules>0   &&<span style={{ fontSize:'.65rem', color:'#1a73e8', background:'rgba(26,115,232,.1)',  borderRadius:'4px', padding:'1px 6px' }}>🟦 {t.azules}</span>}
            {t.rojas>0    &&<span style={{ fontSize:'.65rem', color:'#d93025', background:'rgba(217,48,37,.1)',   borderRadius:'4px', padding:'1px 6px' }}>🟥 {t.rojas}</span>}
            {!t.amarillas&&!t.azules&&!t.rojas&&<span style={{ fontSize:'.65rem', color:'#1e8e3e' }}>🟢 Sin tarjetas</span>}
            {p.companeros.length>0&&<span style={{ fontSize:'.62rem', color:'#7a9ab5', marginLeft:'auto' }}>con {p.companeros.join(', ')}</span>}
          </div>
        )}
        {!esJugado&&p.played_at&&<div style={{ fontSize:'.65rem', color:'#7a9ab5', marginTop:'3px' }}>🕐 {new Date(p.played_at).toLocaleTimeString('es-CO',{hour:'2-digit',minute:'2-digit'})}{p.location&&` · 📍 ${p.location}`}</div>}
      </div>
    )
  }

  return (
    <div style={{ minHeight:'100vh', background:'#07070e', fontFamily:'system-ui,sans-serif', color:'#e8f4fd', paddingBottom:'40px' }}>
      <div style={{ background:'#0d1117', borderBottom:'0.5px solid #1e2d3d', padding:'12px 16px', display:'flex', alignItems:'center', gap:'12px', position:'sticky', top:0, zIndex:50 }}>
        <button onClick={()=>navigate(-1)} style={{ background:'none', border:'1px solid #1e2d3d', borderRadius:'8px', padding:'6px 8px', cursor:'pointer', color:'#7a9ab5', display:'flex' }}><ArrowLeft size={18}/></button>
        <div style={{ fontWeight:'700', fontSize:'.95rem', color:'#e8f4fd' }}>Perfil árbitro</div>
      </div>

      <div style={{ maxWidth:'620px', margin:'0 auto', padding:'16px' }}>

        {/* Tarjeta principal */}
        <div style={{ background:'linear-gradient(135deg,#111827,#0d1117)', border:'1px solid #1e2d3d', borderRadius:'16px', padding:'20px', marginBottom:'14px' }}>
          <div style={{ display:'flex', gap:'16px', alignItems:'center', marginBottom:'16px' }}>
            <div style={{ width:'72px', height:'72px', borderRadius:'50%', overflow:'hidden', background:'#1e2d3d', border:'3px solid #f9a825', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
              {arbitro.photo_face_url||arbitro.photo_url?<img src={arbitro.photo_face_url||arbitro.photo_url} style={{ width:'100%', height:'100%', objectFit:'cover' }}/>:<span style={{ fontSize:'2rem' }}>👤</span>}
            </div>
            <div>
              <div style={{ fontWeight:'900', fontSize:'1.1rem', color:'#e8f4fd' }}>{arbitro.name}</div>
              <div style={{ fontSize:'.72rem', color:'#f9a825', fontWeight:'700', marginTop:'2px' }}>🟡 ÁRBITRO</div>
              <div style={{ fontSize:'.72rem', color:'#7a9ab5', marginTop:'6px', display:'flex', flexDirection:'column', gap:'2px' }}>
                {arbitro.numero_cedula && <span>🪪 {arbitro.numero_cedula}</span>}
                {arbitro.telefono      && <span>📞 {arbitro.telefono}</span>}
                {arbitro.city          && <span>📍 {arbitro.city}</span>}
                {arbitro.genero        && <span>👤 {arbitro.genero}</span>}
              </div>
            </div>
          </div>

          {/* Stats principales */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'8px', marginBottom:'12px' }}>
            {[
              { label:'Pitados',  value:jugados.length,   color:'#00ddd0', icon:'📋' },
              { label:'Torneos',  value:torneos,           color:'#1a73e8', icon:'🏆' },
              { label:'Puntaje',  value:promEval!==null?`${promEval}/60`:'—', color:'#f9a825', icon:'📝' },
              { label:'Reclamos', value:reclamos.length,  color: reclamos.length>0?'#d93025':'#1e8e3e', icon:'⚠️' },
            ].map(s=>(
              <div key={s.label} style={{ background:'#1e2d3d', borderRadius:'10px', padding:'10px 6px', textAlign:'center' }}>
                <div style={{ fontSize:'.9rem', marginBottom:'2px' }}>{s.icon}</div>
                <div style={{ fontSize:s.value.toString().length>4?'.9rem':'1.2rem', fontWeight:'900', color:s.color, lineHeight:1 }}>{s.value}</div>
                <div style={{ fontSize:'.6rem', color:'#7a9ab5', marginTop:'2px' }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Tarjetas */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'8px', marginBottom:'12px' }}>
            {[{label:'Amarillas',value:totalAm,color:'#f9a825',icon:'🟨'},{label:'Azules',value:totalAz,color:'#1a73e8',icon:'🟦'},{label:'Rojas',value:totalRj,color:'#d93025',icon:'🟥'}].map(s=>(
              <div key={s.label} style={{ background:'#1e2d3d', borderRadius:'10px', padding:'10px', textAlign:'center' }}>
                <div style={{ fontSize:'.9rem' }}>{s.icon}</div>
                <div style={{ fontSize:'1.2rem', fontWeight:'900', color:s.value>0?s.color:'#2a3a4a' }}>{s.value}</div>
                <div style={{ fontSize:'.6rem', color:'#7a9ab5' }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Fases dirigidas */}
          {(finales>0||semis>0||cuartos>0||octavos>0) && (
            <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
              {finales>0 &&<span style={{ fontSize:'.72rem', color:'#f9a825', background:'rgba(249,168,37,.1)', borderRadius:'7px', padding:'3px 10px', fontWeight:'700' }}>🏅 Final ×{finales}</span>}
              {semis>0   &&<span style={{ fontSize:'.72rem', color:'#00ddd0', background:'rgba(0,221,208,.08)',  borderRadius:'7px', padding:'3px 10px' }}>Semifinal ×{semis}</span>}
              {cuartos>0 &&<span style={{ fontSize:'.72rem', color:'#1a73e8', background:'rgba(26,115,232,.08)',borderRadius:'7px', padding:'3px 10px' }}>Cuartos ×{cuartos}</span>}
              {octavos>0 &&<span style={{ fontSize:'.72rem', color:'#7a9ab5', background:'rgba(122,154,181,.08)',borderRadius:'7px', padding:'3px 10px' }}>Octavos ×{octavos}</span>}
            </div>
          )}
        </div>

        {/* Evaluaciones */}
        {evals.length>0 && (
          <div style={{ background:'#111827', border:'1px solid #1e2d3d', borderRadius:'12px', marginBottom:'10px', overflow:'hidden' }}>
            <SectionHeader title="📝 Evaluaciones de veedor" stateKey="evals" count={evals.length} color="#1a73e8"/>
            {abiertos.evals && (
              <div style={{ padding:'12px 14px', borderTop:'0.5px solid #1e2d3d' }}>
                {/* Promedio por criterio */}
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'6px', marginBottom:'12px' }}>
                  {CRITERIOS.map(c=>{
                    const prom = evals.length>0 ? (evals.reduce((s,e)=>s+(e[c.key]||0),0)/evals.length).toFixed(1) : 0
                    return (
                      <div key={c.key} style={{ background:'#1e2d3d', borderRadius:'8px', padding:'8px', textAlign:'center' }}>
                        <div style={{ fontSize:'.8rem' }}>{c.icon}</div>
                        <div style={{ fontSize:'1rem', fontWeight:'900', color:parseFloat(prom)>=8?'#1e8e3e':parseFloat(prom)>=5?'#f9a825':'#d93025' }}>{prom}</div>
                        <div style={{ fontSize:'.58rem', color:'#7a9ab5' }}>{c.label}</div>
                      </div>
                    )
                  })}
                </div>
                {/* Historial */}
                {evals.map((e,i)=>(
                  <div key={e.id} style={{ background:'#0d1117', borderRadius:'8px', padding:'8px 10px', marginBottom:'6px', display:'flex', alignItems:'center', gap:'10px' }}>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:'.65rem', color:'#7a9ab5' }}>{new Date(e.created_at).toLocaleDateString('es-CO',{day:'2-digit',month:'short',year:'numeric'})}</div>
                      {e.observaciones && <div style={{ fontSize:'.72rem', color:'#b0c4d8', marginTop:'2px' }}>{e.observaciones}</div>}
                    </div>
                    <div style={{ textAlign:'center' }}>
                      <div style={{ fontSize:'1.1rem', fontWeight:'900', color:e.total>=48?'#1e8e3e':e.total>=30?'#f9a825':'#d93025' }}>{e.total}</div>
                      <div style={{ fontSize:'.58rem', color:'#7a9ab5' }}>/ 60</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Exámenes */}
        {(ultimoFis||ultimoMed) && (
          <div style={{ background:'#111827', border:'1px solid #1e2d3d', borderRadius:'12px', marginBottom:'10px', overflow:'hidden' }}>
            <SectionHeader title="🏥 Exámenes" stateKey="examenes" count={exams.length} color="#00ddd0"/>
            {abiertos.examenes && (
              <div style={{ padding:'12px 14px', borderTop:'0.5px solid #1e2d3d', display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px' }}>
                {/* Físico */}
                {ultimoFis && (
                  <div style={{ background:'#0d1117', borderRadius:'10px', padding:'10px 12px', border:`1px solid ${ultimoFis.resultado==='aprobado'?'rgba(30,142,62,.3)':ultimoFis.resultado==='reprobado'?'rgba(217,48,37,.3)':'#1e2d3d'}` }}>
                    <div style={{ fontSize:'.65rem', fontWeight:'700', color:'#7a9ab5', marginBottom:'6px' }}>🏃 FÍSICO · {ultimoFis.resultado==='aprobado'?'✅':ultimoFis.resultado==='reprobado'?'❌':'⏳'}</div>
                    {PRUEBAS.filter(p=>ultimoFis[p.key]).map(p=>(
                      <div key={p.key} style={{ display:'flex', justifyContent:'space-between', fontSize:'.65rem', marginBottom:'2px' }}>
                        <span style={{ color:'#7a9ab5' }}>{p.label}</span>
                        <span style={{ color:'#e8f4fd', fontWeight:'600' }}>{ultimoFis[p.key]}{p.unit&&' '+p.unit}</span>
                      </div>
                    ))}
                    {ultimoFis.archivo_url && <a href={ultimoFis.archivo_url} target="_blank" rel="noreferrer" style={{ fontSize:'.62rem', color:'#1a73e8', display:'block', marginTop:'4px' }}>📎 Ver archivo</a>}
                  </div>
                )}
                {/* Médico */}
                {ultimoMed && (
                  <div style={{ background:'#0d1117', borderRadius:'10px', padding:'10px 12px', border:`1px solid ${ultimoMed.resultado==='aprobado'?'rgba(30,142,62,.3)':ultimoMed.resultado==='reprobado'?'rgba(217,48,37,.3)':'#1e2d3d'}` }}>
                    <div style={{ fontSize:'.65rem', fontWeight:'700', color:'#7a9ab5', marginBottom:'6px' }}>🏥 MÉDICO · {ultimoMed.resultado==='aprobado'?'✅':ultimoMed.resultado==='reprobado'?'❌':'⏳'}</div>
                    {ultimoMed.notas && <div style={{ fontSize:'.68rem', color:'#b0c4d8', marginBottom:'4px' }}>{ultimoMed.notas}</div>}
                    {ultimoMed.fecha && <div style={{ fontSize:'.62rem', color:'#7a9ab5' }}>{new Date(ultimoMed.fecha).toLocaleDateString('es-CO')}</div>}
                    {ultimoMed.archivo_url && <a href={ultimoMed.archivo_url} target="_blank" rel="noreferrer" style={{ fontSize:'.62rem', color:'#1a73e8', display:'block', marginTop:'4px' }}>📎 Ver archivo</a>}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Reclamos — SOLO visible para el líder */}
        {esLider && reclamos.length>0 && (
          <div style={{ background:'#111827', border:'1px solid rgba(217,48,37,.3)', borderRadius:'12px', marginBottom:'10px', overflow:'hidden' }}>
            <SectionHeader title="⚠️ Reclamos" stateKey="reclamos" count={reclamos.length} color="#d93025"/>
            {abiertos.reclamos && (
              <div style={{ padding:'12px 14px', borderTop:'0.5px solid rgba(217,48,37,.2)' }}>
                {reclamos.map(r=>(
                  <div key={r.id} style={{ background:'#0d1117', borderRadius:'8px', padding:'10px 12px', marginBottom:'6px', border:`0.5px solid ${r.estado==='abierto'?'rgba(232,113,10,.3)':'#1e2d3d'}` }}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'4px' }}>
                      <span style={{ fontSize:'.68rem', color:r.tipo==='tecnico'?'#1a73e8':r.tipo==='disciplinario'?'#d93025':'#e8710a', fontWeight:'700' }}>{r.tipo}</span>
                      <span style={{ fontSize:'.65rem', color:r.estado==='abierto'?'#e8710a':r.estado==='resuelto'?'#1e8e3e':'#7a9ab5' }}>{r.estado}</span>
                    </div>
                    <div style={{ fontSize:'.78rem', color:'#e8f4fd', marginBottom:'4px' }}>{r.descripcion}</div>
                    {r.matches && <div style={{ fontSize:'.65rem', color:'#7a9ab5' }}>📋 {r.matches.home?.name} vs {r.matches.away?.name} · {r.matches.played_at&&new Date(r.matches.played_at).toLocaleDateString('es-CO',{day:'2-digit',month:'short'})}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Compañeros */}
        {topCompaneros.length>0 && (
          <div style={{ background:'#111827', border:'1px solid #1e2d3d', borderRadius:'12px', padding:'14px 16px', marginBottom:'10px' }}>
            <div style={{ fontSize:'.72rem', fontWeight:'700', color:'#7a9ab5', marginBottom:'10px', textTransform:'uppercase', letterSpacing:'.08em' }}>Compañeros frecuentes</div>
            {topCompaneros.map(([nombre,veces])=>(
              <div key={nombre} style={{ display:'flex', justifyContent:'space-between', padding:'5px 0', borderBottom:'0.5px solid #1e2d3d' }}>
                <span style={{ fontSize:'.82rem', color:'#e8f4fd' }}>🟡 {nombre}</span>
                <span style={{ fontSize:'.72rem', color:'#7a9ab5' }}>{veces} partido{veces>1?'s':''}</span>
              </div>
            ))}
          </div>
        )}

        {/* Pendientes */}
        {pendientes.length>0 && (
          <div style={{ background:'#111827', border:'1px solid #1e2d3d', borderRadius:'12px', marginBottom:'10px', overflow:'hidden' }}>
            <SectionHeader title="⏳ Pendientes" stateKey="pendientes" count={pendientes.length} color="#e8710a"/>
            {abiertos.pendientes && <div style={{ padding:'0 12px 12px', borderTop:'0.5px solid #1e2d3d' }}>{pendientes.map(p=><CardPartido key={p.id} p={p}/>)}</div>}
          </div>
        )}

        {/* Dirigidos */}
        <div style={{ background:'#111827', border:'1px solid #1e2d3d', borderRadius:'12px', overflow:'hidden' }}>
          <SectionHeader title="✅ Partidos dirigidos" stateKey="jugados" count={jugados.length} color="#1e8e3e"/>
          {abiertos.jugados && (
            <div style={{ padding:'0 12px 12px', borderTop:'0.5px solid #1e2d3d' }}>
              {jugados.length===0
                ? <div style={{ textAlign:'center', padding:'24px', color:'#7a9ab5', fontSize:'.85rem' }}>Sin partidos dirigidos</div>
                : jugados.map(p=><CardPartido key={p.id} p={p}/>)}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
