import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ArrowLeft, ChevronDown, Upload, X, Check } from 'lucide-react'

const inp = { width:'100%', background:'#0d1117', border:'1px solid #1e2d3d', borderRadius:'8px', padding:'8px 12px', color:'#e8f4fd', fontSize:'.875rem', outline:'none', boxSizing:'border-box' }
const lbl = { fontSize:'.75rem', fontWeight:'500', color:'#7a9ab5', display:'block', marginBottom:'4px' }

const CRITERIOS = [
  { key:'puntualidad',    label:'Puntualidad',      icon:'⏰' },
  { key:'presentacion',   label:'Presentación',     icon:'👔' },
  { key:'control_juego',  label:'Control del juego',icon:'🎯' },
  { key:'criterio',       label:'Criterio',         icon:'⚖️' },
  { key:'comunicacion',   label:'Comunicación',     icon:'🗣️' },
  { key:'posicionamiento',label:'Posicionamiento',  icon:'📍' },
]

function ModalEvaluar({ arbitro, partidos, evaluadorId, onClose, onGuardado }) {
  const [matchId,  setMatchId]  = useState('')
  const [scores,   setScores]   = useState({ puntualidad:0, presentacion:0, control_juego:0, criterio:0, comunicacion:0, posicionamiento:0 })
  const [obs,      setObs]      = useState('')
  const [loading,  setLoading]  = useState(false)

  async function handleGuardar() {
    setLoading(true)
    const payload = {
      arbitro_id: arbitro.id,
      match_id: matchId || null,
      evaluador_id: evaluadorId,
      ...scores,
      observaciones: obs,
    }
    const { error } = await supabase.from('arbitro_evaluaciones').insert(payload)
    if (!error) { onGuardado(); onClose() }
    setLoading(false)
  }

  const total = Object.values(scores).reduce((s,v)=>s+v,0)

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.75)', zIndex:500, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px', overflowY:'auto' }}>
      <div style={{ background:'#0d1117', borderRadius:'16px', padding:'24px', width:'100%', maxWidth:'480px', border:'1px solid #1e2d3d', margin:'auto' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px' }}>
          <div>
            <div style={{ fontWeight:'700', color:'#e8f4fd', fontSize:'.95rem' }}>Evaluar — {arbitro.name}</div>
            <div style={{ fontSize:'.7rem', color:'#7a9ab5', marginTop:'2px' }}>Ficha de evaluación de veedor</div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'#7a9ab5' }}><X size={18}/></button>
        </div>

        {/* Partido */}
        <div style={{ marginBottom:'14px' }}>
          <label style={lbl}>Partido evaluado (opcional)</label>
          <select value={matchId} onChange={e=>setMatchId(e.target.value)} style={inp}>
            <option value="">Evaluación general</option>
            {partidos.filter(p=>p.status==='finished'&&(p.arbitro1_id===arbitro.id||p.arbitro2_id===arbitro.id||p.arbitro3_id===arbitro.id)).map(p=>(
              <option key={p.id} value={p.id}>{p.home?.name} vs {p.away?.name} · {p.played_at?new Date(p.played_at).toLocaleDateString('es-CO',{day:'2-digit',month:'short'}):''}</option>
            ))}
          </select>
        </div>

        {/* Criterios */}
        <div style={{ display:'flex', flexDirection:'column', gap:'10px', marginBottom:'14px' }}>
          {CRITERIOS.map(c=>(
            <div key={c.key}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'4px' }}>
                <label style={{ fontSize:'.78rem', color:'#e8f4fd', fontWeight:'500' }}>{c.icon} {c.label}</label>
                <span style={{ fontSize:'.82rem', fontWeight:'700', color: scores[c.key]>=8?'#1e8e3e':scores[c.key]>=5?'#f9a825':'#d93025' }}>{scores[c.key]}/10</span>
              </div>
              <div style={{ display:'flex', gap:'4px' }}>
                {[1,2,3,4,5,6,7,8,9,10].map(n=>(
                  <button key={n} onClick={()=>setScores(s=>({...s,[c.key]:n}))}
                    style={{ flex:1, padding:'5px 0', borderRadius:'5px', border:'none', cursor:'pointer', fontSize:'.65rem', fontWeight:'700',
                      background: scores[c.key]>=n ? (n>=8?'#1e8e3e':n>=5?'#f9a825':'#d93025') : '#1e2d3d',
                      color: scores[c.key]>=n ? '#fff' : '#7a9ab5' }}>
                    {n}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Total */}
        <div style={{ background:'rgba(0,221,208,.08)', border:'1px solid rgba(0,221,208,.2)', borderRadius:'10px', padding:'10px 14px', marginBottom:'12px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <span style={{ fontSize:'.8rem', color:'#7a9ab5', fontWeight:'600' }}>Puntaje total</span>
          <span style={{ fontSize:'1.3rem', fontWeight:'900', color: total>=48?'#1e8e3e':total>=30?'#f9a825':'#d93025' }}>{total}<span style={{ fontSize:'.7rem', color:'#7a9ab5' }}>/60</span></span>
        </div>

        {/* Observaciones */}
        <div style={{ marginBottom:'14px' }}>
          <label style={lbl}>Observaciones</label>
          <textarea value={obs} onChange={e=>setObs(e.target.value)} rows={3}
            style={{...inp, resize:'vertical'}} placeholder="Comentarios del veedor..."/>
        </div>

        <div style={{ display:'flex', gap:'8px' }}>
          <button onClick={handleGuardar} disabled={loading} style={{ flex:1, padding:'10px', background:'#1a73e8', border:'none', borderRadius:'8px', cursor:'pointer', color:'#fff', fontWeight:'700', opacity:loading?.7:1 }}>
            {loading?'Guardando...':'Guardar evaluación'}
          </button>
          <button onClick={onClose} style={{ padding:'10px 14px', background:'none', border:'1px solid #1e2d3d', borderRadius:'8px', cursor:'pointer', color:'#7a9ab5' }}>Cancelar</button>
        </div>
      </div>
    </div>
  )
}

function ModalExamen({ arbitro, evaluadorId, onClose, onGuardado }) {
  const [tipo,    setTipo]    = useState('fisico')
  const [fecha,   setFecha]   = useState('')
  const [notas,   setNotas]   = useState('')
  const [result,  setResult]  = useState('pendiente')
  const [file,    setFile]    = useState(null)
  const [loading, setLoading] = useState(false)

  async function handleGuardar() {
    setLoading(true)
    let archivoUrl = null
    if (file) {
      const path = `examenes/${arbitro.id}_${Date.now()}.${file.name.split('.').pop()}`
      const { error: upErr } = await supabase.storage.from('players').upload(path, file, { upsert:true })
      if (!upErr) {
        const { data: u } = supabase.storage.from('players').getPublicUrl(path)
        archivoUrl = u.publicUrl
      }
    }
    await supabase.from('arbitro_examenes').insert({
      arbitro_id: arbitro.id, tipo, fecha: fecha||null, notas,
      resultado: result, archivo_url: archivoUrl, registrado_por: evaluadorId,
    })
    onGuardado(); onClose()
    setLoading(false)
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.75)', zIndex:500, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px' }}>
      <div style={{ background:'#0d1117', borderRadius:'16px', padding:'24px', width:'100%', maxWidth:'420px', border:'1px solid #1e2d3d' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px' }}>
          <div>
            <div style={{ fontWeight:'700', color:'#e8f4fd', fontSize:'.95rem' }}>Examen — {arbitro.name}</div>
            <div style={{ fontSize:'.7rem', color:'#7a9ab5' }}>Registro físico / médico</div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'#7a9ab5' }}><X size={18}/></button>
        </div>
        <div style={{ display:'flex', gap:'8px', marginBottom:'14px' }}>
          {['fisico','medico'].map(t=>(
            <button key={t} onClick={()=>setTipo(t)}
              style={{ flex:1, padding:'8px', borderRadius:'8px', border:`1px solid ${tipo===t?'#1a73e8':'#1e2d3d'}`, background:tipo===t?'#1a73e8':'transparent', color:tipo===t?'#fff':'#7a9ab5', cursor:'pointer', fontWeight:'700', fontSize:'.82rem' }}>
              {t==='fisico'?'🏃 Físico':'🏥 Médico'}
            </button>
          ))}
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:'10px', marginBottom:'14px' }}>
          <div><label style={lbl}>Fecha del examen</label><input type="date" value={fecha} onChange={e=>setFecha(e.target.value)} style={inp}/></div>
          <div>
            <label style={lbl}>Resultado</label>
            <div style={{ display:'flex', gap:'8px' }}>
              {['aprobado','reprobado','pendiente'].map(r=>(
                <button key={r} onClick={()=>setResult(r)}
                  style={{ flex:1, padding:'7px', borderRadius:'7px', border:`1px solid ${result===r?(r==='aprobado'?'#1e8e3e':r==='reprobado'?'#d93025':'#e8710a'):'#1e2d3d'}`,
                    background:result===r?(r==='aprobado'?'rgba(30,142,62,.2)':r==='reprobado'?'rgba(217,48,37,.2)':'rgba(232,113,10,.2)'):'transparent',
                    color:result===r?(r==='aprobado'?'#1e8e3e':r==='reprobado'?'#d93025':'#e8710a'):'#7a9ab5', cursor:'pointer', fontSize:'.72rem', fontWeight:'600', textTransform:'capitalize' }}>
                  {r==='aprobado'?'✅ Aprobado':r==='reprobado'?'❌ Reprobado':'⏳ Pendiente'}
                </button>
              ))}
            </div>
          </div>
          <div><label style={lbl}>Notas</label><textarea value={notas} onChange={e=>setNotas(e.target.value)} rows={3} style={{...inp,resize:'vertical'}} placeholder="Observaciones del examen..."/></div>
          <div>
            <label style={lbl}>Archivo (PDF, imagen)</label>
            <label style={{ display:'block', border:'1px dashed #1e2d3d', borderRadius:'8px', padding:'12px', textAlign:'center', cursor:'pointer', background:'#111827' }}>
              <input type="file" onChange={e=>setFile(e.target.files[0])} style={{ display:'none' }}/>
              {file ? <span style={{ fontSize:'.8rem', color:'#00ddd0' }}>📎 {file.name}</span> : <span style={{ fontSize:'.78rem', color:'#7a9ab5' }}><Upload size={14} style={{ display:'inline', marginRight:'6px' }}/>Subir archivo</span>}
            </label>
          </div>
        </div>
        <div style={{ display:'flex', gap:'8px' }}>
          <button onClick={handleGuardar} disabled={loading} style={{ flex:1, padding:'10px', background:'#1a73e8', border:'none', borderRadius:'8px', cursor:'pointer', color:'#fff', fontWeight:'700', opacity:loading?.7:1 }}>
            {loading?'Guardando...':'Guardar examen'}
          </button>
          <button onClick={onClose} style={{ padding:'10px 14px', background:'none', border:'1px solid #1e2d3d', borderRadius:'8px', cursor:'pointer', color:'#7a9ab5' }}>Cancelar</button>
        </div>
      </div>
    </div>
  )
}

export default function ArbitroRankingPage() {
  const navigate  = useNavigate()
  const [lider,      setLider]      = useState(null)
  const [arbitros,   setArbitros]   = useState([])
  const [evals,      setEvals]      = useState([])
  const [examenes,   setExamenes]   = useState([])
  const [partidos,   setPartidos]   = useState([])
  const [loading,    setLoading]    = useState(true)
  const [filtroMes,  setFiltroMes]  = useState('todos')
  const [tab,        setTab]        = useState('ranking')
  const [modalEval,  setModalEval]  = useState(null)
  const [modalExam,  setModalExam]  = useState(null)
  const [msg,        setMsg]        = useState(null)

  useEffect(()=>{ fetchTodo() },[])

  async function fetchTodo() {
    setLoading(true)
    const { data:{user} } = await supabase.auth.getUser()
    const { data:p } = await supabase.from('players').select('*').eq('user_id', user.id).single()
    setLider(p)
    await Promise.all([fetchArbitros(), fetchEvals(), fetchExamenes(), fetchPartidos()])
    setLoading(false)
  }

  async function fetchArbitros() {
    const { data } = await supabase.from('players').select('id,name,photo_url,photo_face_url').or('rol.eq.arbitro,es_arbitro.eq.true').order('name')
    setArbitros(data||[])
  }
  async function fetchEvals() {
    const { data } = await supabase.from('arbitro_evaluaciones').select('*').order('created_at', { ascending:false })
    setEvals(data||[])
  }
  async function fetchExamenes() {
    const { data } = await supabase.from('arbitro_examenes').select('*').order('created_at', { ascending:false })
    setExamenes(data||[])
  }
  async function fetchPartidos() {
    const { data } = await supabase.from('matches').select('id,played_at,status,arbitro1_id,arbitro2_id,arbitro3_id,home:home_team_id(name),away:away_team_id(name)').order('played_at',{ascending:false})
    setPartidos(data||[])
  }

  function showMsgFn(t,type='ok') { setMsg({text:t,type}); setTimeout(()=>setMsg(null),3000) }

  if (loading) return <div style={{ minHeight:'100vh',background:'#07070e',display:'flex',alignItems:'center',justifyContent:'center',color:'#00ddd0' }}>Cargando...</div>

  // Filtrar evaluaciones por mes/año
  const evalsFiltradas = evals.filter(e => {
    if (filtroMes==='todos') return true
    const fecha = new Date(e.created_at)
    const ahora = new Date()
    if (filtroMes==='mes') return fecha.getMonth()===ahora.getMonth() && fecha.getFullYear()===ahora.getFullYear()
    if (filtroMes==='anio') return fecha.getFullYear()===ahora.getFullYear()
    return true
  })

  // Calcular ranking
  const rankingMap = {}
  arbitros.forEach(a => {
    const misEvals = evalsFiltradas.filter(e=>e.arbitro_id===a.id)
    const misPartidos = partidos.filter(p=>p.status==='finished'&&(p.arbitro1_id===a.id||p.arbitro2_id===a.id||p.arbitro3_id===a.id))
    const promedio = misEvals.length > 0 ? Math.round(misEvals.reduce((s,e)=>s+e.total,0)/misEvals.length) : null
    rankingMap[a.id] = { ...a, evaluaciones:misEvals.length, promedio, partidos_pitados:misPartidos.length }
  })
  const ranking = Object.values(rankingMap)
    .sort((a,b)=> (b.promedio||0)-(a.promedio||0) || b.partidos_pitados-a.partidos_pitados)

  return (
    <div style={{ minHeight:'100vh', background:'#07070e', fontFamily:'system-ui,sans-serif', color:'#e8f4fd', paddingBottom:'40px' }}>
      {msg && <div style={{ position:'fixed', top:'20px', right:'20px', zIndex:600, padding:'12px 20px', background:msg.type==='ok'?'#e6f4ea':'#fce8e6', color:msg.type==='ok'?'#1e8e3e':'#d93025', borderRadius:'10px', fontWeight:'600', fontSize:'.875rem', boxShadow:'0 4px 16px rgba(0,0,0,.3)' }}>{msg.text}</div>}
      {modalEval && <ModalEvaluar arbitro={modalEval} partidos={partidos} evaluadorId={lider?.id} onClose={()=>setModalEval(null)} onGuardado={()=>{ fetchEvals(); showMsgFn('Evaluación guardada ✓') }}/>}
      {modalExam && <ModalExamen  arbitro={modalExam} evaluadorId={lider?.id} onClose={()=>setModalExam(null)} onGuardado={()=>{ fetchExamenes(); showMsgFn('Examen registrado ✓') }}/>}

      {/* Header */}
      <div style={{ background:'#0d1117', borderBottom:'0.5px solid #1e2d3d', padding:'12px 16px', display:'flex', alignItems:'center', gap:'12px', position:'sticky', top:0, zIndex:50 }}>
        <button onClick={()=>navigate('/arbitro/lider')} style={{ background:'none', border:'1px solid #1e2d3d', borderRadius:'8px', padding:'6px 8px', cursor:'pointer', color:'#7a9ab5', display:'flex' }}>
          <ArrowLeft size={18}/>
        </button>
        <div>
          <div style={{ fontWeight:'700', fontSize:'.95rem', color:'#e8f4fd' }}>Ranking árbitros</div>
          <div style={{ fontSize:'.7rem', color:'#7a9ab5' }}>Evaluaciones · Exámenes</div>
        </div>
      </div>

      <div style={{ maxWidth:'680px', margin:'0 auto', padding:'16px' }}>

        {/* Tabs */}
        <div style={{ display:'flex', gap:'4px', marginBottom:'16px', background:'#111827', borderRadius:'10px', padding:'4px' }}>
          {[{id:'ranking',label:'🏆 Ranking'},{id:'evaluar',label:'📝 Evaluar'},{id:'examenes',label:'🏥 Exámenes'}].map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)}
              style={{ flex:1, padding:'8px', borderRadius:'8px', border:'none', cursor:'pointer', fontSize:'.8rem', fontWeight:'700', background:tab===t.id?'#1a73e8':'transparent', color:tab===t.id?'#fff':'#7a9ab5' }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* TAB RANKING */}
        {tab==='ranking' && (
          <div>
            {/* Filtro tiempo */}
            <div style={{ display:'flex', gap:'6px', marginBottom:'14px' }}>
              {[{id:'todos',label:'Todos'},{id:'anio',label:'Este año'},{id:'mes',label:'Este mes'}].map(f=>(
                <button key={f.id} onClick={()=>setFiltroMes(f.id)}
                  style={{ padding:'6px 16px', borderRadius:'20px', border:'none', cursor:'pointer', fontSize:'.78rem', fontWeight:'600', background:filtroMes===f.id?'#1a73e8':'#111827', color:filtroMes===f.id?'#fff':'#7a9ab5' }}>
                  {f.label}
                </button>
              ))}
            </div>

            {ranking.map((a,i)=>{
              const color = i===0?'#f9a825':i===1?'#9aa0a6':i===2?'#cd7f32':'#7a9ab5'
              const pct   = a.promedio ? Math.round((a.promedio/60)*100) : 0
              return (
                <div key={a.id} style={{ background:'#111827', border:`1px solid ${i<3?color+'44':'#1e2d3d'}`, borderRadius:'12px', padding:'14px 16px', marginBottom:'8px', display:'flex', alignItems:'center', gap:'12px' }}>
                  {/* Posición */}
                  <div style={{ width:'36px', height:'36px', borderRadius:'50%', background:`${color}22`, border:`2px solid ${color}`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontWeight:'900', fontSize:'1rem', color }}>
                    {i===0?'🥇':i===1?'🥈':i===2?'🥉':`${i+1}`}
                  </div>
                  {/* Foto */}
                  <div style={{ width:'40px', height:'40px', borderRadius:'50%', overflow:'hidden', background:'#1e2d3d', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                    {a.photo_face_url||a.photo_url?<img src={a.photo_face_url||a.photo_url} style={{ width:'100%', height:'100%', objectFit:'cover' }}/>:<span>👤</span>}
                  </div>
                  {/* Info */}
                  <div style={{ flex:1, minWidth:0 }}>
                    <div onClick={()=>navigate(`/arbitro/perfil/${a.id}`)} style={{ fontWeight:'700', fontSize:'.9rem', color:'#00ddd0', cursor:'pointer', textDecoration:'underline', textDecorationColor:'rgba(0,221,208,.3)' }}>{a.name}</div>
                    <div style={{ display:'flex', gap:'10px', marginTop:'4px', flexWrap:'wrap' }}>
                      <span style={{ fontSize:'.68rem', color:'#7a9ab5' }}>📋 {a.partidos_pitados} partidos</span>
                      <span style={{ fontSize:'.68rem', color:'#7a9ab5' }}>📝 {a.evaluaciones} eval.</span>
                    </div>
                    {/* Barra de progreso */}
                    {a.promedio !== null && (
                      <div style={{ marginTop:'6px' }}>
                        <div style={{ height:'4px', background:'#1e2d3d', borderRadius:'2px', overflow:'hidden' }}>
                          <div style={{ height:'100%', width:`${pct}%`, background: pct>=80?'#1e8e3e':pct>=50?'#f9a825':'#d93025', borderRadius:'2px', transition:'width .3s' }}/>
                        </div>
                      </div>
                    )}
                  </div>
                  {/* Puntaje */}
                  <div style={{ textAlign:'center', flexShrink:0 }}>
                    {a.promedio!==null ? (
                      <>
                        <div style={{ fontSize:'1.3rem', fontWeight:'900', color: a.promedio>=48?'#1e8e3e':a.promedio>=30?'#f9a825':'#d93025', lineHeight:1 }}>{a.promedio}</div>
                        <div style={{ fontSize:'.6rem', color:'#7a9ab5' }}>/ 60 pts</div>
                      </>
                    ) : (
                      <div style={{ fontSize:'.72rem', color:'#3a4a5a' }}>Sin eval.</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* TAB EVALUAR */}
        {tab==='evaluar' && (
          <div>
            <div style={{ fontSize:'.72rem', color:'#7a9ab5', marginBottom:'12px' }}>
              Selecciona un árbitro para agregar su ficha de evaluación de veedor (máx 60 pts)
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
              {arbitros.map(a=>{
                const misEvals = evals.filter(e=>e.arbitro_id===a.id)
                const ultimo   = misEvals[0]
                return (
                  <div key={a.id} style={{ background:'#111827', border:'1px solid #1e2d3d', borderRadius:'12px', padding:'12px 14px', display:'flex', alignItems:'center', gap:'12px' }}>
                    <div style={{ width:'38px', height:'38px', borderRadius:'50%', overflow:'hidden', background:'#1e2d3d', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                      {a.photo_face_url||a.photo_url?<img src={a.photo_face_url||a.photo_url} style={{ width:'100%', height:'100%', objectFit:'cover' }}/>:<span>👤</span>}
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:'700', fontSize:'.88rem', color:'#e8f4fd' }}>{a.name}</div>
                      <div style={{ fontSize:'.68rem', color:'#7a9ab5', marginTop:'2px' }}>
                        {misEvals.length} evaluaciones
                        {ultimo && ` · Última: ${ultimo.total}/60 pts`}
                      </div>
                      {/* Desglose último */}
                      {ultimo && (
                        <div style={{ display:'flex', gap:'4px', marginTop:'4px', flexWrap:'wrap' }}>
                          {CRITERIOS.map(c=>(
                            <span key={c.key} style={{ fontSize:'.6rem', color: ultimo[c.key]>=8?'#1e8e3e':ultimo[c.key]>=5?'#f9a825':'#d93025', background:'#1e2d3d', borderRadius:'4px', padding:'1px 5px' }}>
                              {c.icon}{ultimo[c.key]}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <button onClick={()=>setModalEval(a)}
                      style={{ padding:'7px 14px', background:'#1a73e8', border:'none', borderRadius:'8px', cursor:'pointer', color:'#fff', fontSize:'.78rem', fontWeight:'700', flexShrink:0 }}>
                      + Evaluar
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* TAB EXÁMENES */}
        {tab==='examenes' && (
          <div>
            <div style={{ fontSize:'.72rem', color:'#7a9ab5', marginBottom:'12px' }}>
              Registro de exámenes físicos y médicos por árbitro
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
              {arbitros.map(a=>{
                const misExams = examenes.filter(e=>e.arbitro_id===a.id)
                const fisico   = misExams.filter(e=>e.tipo==='fisico')
                const medico   = misExams.filter(e=>e.tipo==='medico')
                const ultimoFis = fisico[0]
                const ultimoMed = medico[0]
                return (
                  <div key={a.id} style={{ background:'#111827', border:'1px solid #1e2d3d', borderRadius:'12px', padding:'12px 14px' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'8px' }}>
                      <div style={{ width:'36px', height:'36px', borderRadius:'50%', overflow:'hidden', background:'#1e2d3d', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                        {a.photo_face_url||a.photo_url?<img src={a.photo_face_url||a.photo_url} style={{ width:'100%', height:'100%', objectFit:'cover' }}/>:<span>👤</span>}
                      </div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontWeight:'700', fontSize:'.88rem', color:'#e8f4fd' }}>{a.name}</div>
                      </div>
                      <button onClick={()=>setModalExam(a)}
                        style={{ padding:'6px 12px', background:'none', border:'1px solid #1a73e8', borderRadius:'7px', cursor:'pointer', color:'#1a73e8', fontSize:'.75rem', fontWeight:'700' }}>
                        + Examen
                      </button>
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px' }}>
                      {/* Físico */}
                      <div style={{ background:'#0d1117', borderRadius:'8px', padding:'8px 10px', border:`1px solid ${ultimoFis?.resultado==='aprobado'?'rgba(30,142,62,.3)':ultimoFis?.resultado==='reprobado'?'rgba(217,48,37,.3)':'#1e2d3d'}` }}>
                        <div style={{ fontSize:'.65rem', color:'#7a9ab5', fontWeight:'600', marginBottom:'3px' }}>🏃 FÍSICO</div>
                        {ultimoFis ? (
                          <>
                            <div style={{ fontSize:'.75rem', fontWeight:'700', color: ultimoFis.resultado==='aprobado'?'#1e8e3e':ultimoFis.resultado==='reprobado'?'#d93025':'#e8710a' }}>
                              {ultimoFis.resultado==='aprobado'?'✅ Aprobado':ultimoFis.resultado==='reprobado'?'❌ Reprobado':'⏳ Pendiente'}
                            </div>
                            {ultimoFis.fecha && <div style={{ fontSize:'.62rem', color:'#7a9ab5', marginTop:'2px' }}>{new Date(ultimoFis.fecha).toLocaleDateString('es-CO')}</div>}
                            {ultimoFis.archivo_url && <a href={ultimoFis.archivo_url} target="_blank" rel="noreferrer" style={{ fontSize:'.62rem', color:'#1a73e8' }}>📎 Ver archivo</a>}
                          </>
                        ) : <div style={{ fontSize:'.72rem', color:'#3a4a5a' }}>Sin registro</div>}
                      </div>
                      {/* Médico */}
                      <div style={{ background:'#0d1117', borderRadius:'8px', padding:'8px 10px', border:`1px solid ${ultimoMed?.resultado==='aprobado'?'rgba(30,142,62,.3)':ultimoMed?.resultado==='reprobado'?'rgba(217,48,37,.3)':'#1e2d3d'}` }}>
                        <div style={{ fontSize:'.65rem', color:'#7a9ab5', fontWeight:'600', marginBottom:'3px' }}>🏥 MÉDICO</div>
                        {ultimoMed ? (
                          <>
                            <div style={{ fontSize:'.75rem', fontWeight:'700', color: ultimoMed.resultado==='aprobado'?'#1e8e3e':ultimoMed.resultado==='reprobado'?'#d93025':'#e8710a' }}>
                              {ultimoMed.resultado==='aprobado'?'✅ Aprobado':ultimoMed.resultado==='reprobado'?'❌ Reprobado':'⏳ Pendiente'}
                            </div>
                            {ultimoMed.fecha && <div style={{ fontSize:'.62rem', color:'#7a9ab5', marginTop:'2px' }}>{new Date(ultimoMed.fecha).toLocaleDateString('es-CO')}</div>}
                            {ultimoMed.archivo_url && <a href={ultimoMed.archivo_url} target="_blank" rel="noreferrer" style={{ fontSize:'.62rem', color:'#1a73e8' }}>📎 Ver archivo</a>}
                          </>
                        ) : <div style={{ fontSize:'.72rem', color:'#3a4a5a' }}>Sin registro</div>}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
