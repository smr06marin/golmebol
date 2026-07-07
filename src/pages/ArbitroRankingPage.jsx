import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ArrowLeft, Upload, X } from 'lucide-react'

const inp  = { width:'100%', background:'#0d1117', border:'1px solid #1e2d3d', borderRadius:'8px', padding:'8px 12px', color:'#e8f4fd', fontSize:'.875rem', outline:'none', boxSizing:'border-box' }
const inp2 = { width:'100%', background:'#0d1117', border:'1px solid #1e2d3d', borderRadius:'8px', padding:'7px 10px', color:'#e8f4fd', fontSize:'.82rem', outline:'none', boxSizing:'border-box' }
const lbl  = { fontSize:'.72rem', fontWeight:'600', color:'#7a9ab5', display:'block', marginBottom:'3px' }

const CRITERIOS_EVAL = [
  { key:'puntualidad',    label:'Puntualidad',       icon:'⏰' },
  { key:'presentacion',   label:'Presentación',      icon:'👔' },
  { key:'control_juego',  label:'Control del juego', icon:'🎯' },
  { key:'criterio',       label:'Criterio',          icon:'⚖️' },
  { key:'comunicacion',   label:'Comunicación',      icon:'🗣️' },
  { key:'posicionamiento',label:'Posicionamiento',   icon:'📍' },
]

const PRUEBAS_FISICAS = [
  { key:'cooper_metros',      label:'Cooper',           unit:'metros',   tipo:'number', placeholder:'ej. 2400', desc:'Distancia recorrida en 12 minutos', ref_ok:2700 },
  { key:'sprint_segundos',    label:'Sprint 50m',        unit:'segundos', tipo:'number', placeholder:'ej. 7.2',  desc:'Tiempo en 50 metros', ref_ok:7.5 },
  { key:'yoyo_nivel',         label:'Yo-Yo Test',        unit:'nivel',    tipo:'text',   placeholder:'ej. 17.1', desc:'Nivel alcanzado', ref_ok:null },
  { key:'peso_kg',            label:'Peso',              unit:'kg',       tipo:'number', placeholder:'ej. 72',   desc:'Peso corporal', ref_ok:null },
  { key:'talla_cm',           label:'Talla',             unit:'cm',       tipo:'number', placeholder:'ej. 175',  desc:'Estatura', ref_ok:null },
  { key:'presion_arterial',   label:'Presión arterial',  unit:'',         tipo:'text',   placeholder:'120/80',   desc:'Sistólica/Diastólica', ref_ok:null },
  { key:'flexibilidad_cm',    label:'Flexibilidad',      unit:'cm',       tipo:'number', placeholder:'ej. 15',   desc:'Test de Wells (sit and reach)', ref_ok:10 },
  { key:'frecuencia_cardiaca',label:'Frec. cardíaca',    unit:'bpm',      tipo:'number', placeholder:'ej. 65',   desc:'En reposo', ref_ok:null },
]

function calcIMC(peso, talla) {
  if (!peso || !talla) return null
  const t = talla / 100
  return (peso / (t * t)).toFixed(1)
}

function ModalEvaluar({ arbitro, partidos, evaluadorId, onClose, onGuardado }) {
  const [matchId, setMatchId] = useState('')
  const [scores,  setScores]  = useState({ puntualidad:0, presentacion:0, control_juego:0, criterio:0, comunicacion:0, posicionamiento:0 })
  const [obs,     setObs]     = useState('')
  const [loading, setLoading] = useState(false)

  const total = Object.values(scores).reduce((s,v)=>s+v,0)

  async function handleGuardar() {
    setLoading(true)
    await supabase.from('arbitro_evaluaciones').insert({
      arbitro_id:arbitro.id, match_id:matchId||null, evaluador_id:evaluadorId, ...scores, observaciones:obs
    })
    onGuardado(); onClose()
    setLoading(false)
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.8)', zIndex:500, display:'flex', alignItems:'flex-start', justifyContent:'center', padding:'16px', overflowY:'auto' }}>
      <div style={{ background:'#0d1117', borderRadius:'16px', padding:'24px', width:'100%', maxWidth:'500px', border:'1px solid #1e2d3d', margin:'20px auto' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px' }}>
          <div>
            <div style={{ fontWeight:'700', color:'#e8f4fd', fontSize:'.95rem' }}>Evaluar — {arbitro.name}</div>
            <div style={{ fontSize:'.7rem', color:'#7a9ab5' }}>Ficha de veedor · máx 60 pts</div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'#7a9ab5' }}><X size={18}/></button>
        </div>
        <div style={{ marginBottom:'14px' }}>
          <label style={lbl}>Partido evaluado (opcional)</label>
          <select value={matchId} onChange={e=>setMatchId(e.target.value)} style={inp}>
            <option value="">Evaluación general</option>
            {partidos.filter(p=>p.status==='finished'&&(p.arbitro1_id===arbitro.id||p.arbitro2_id===arbitro.id||p.arbitro3_id===arbitro.id)).map(p=>(
              <option key={p.id} value={p.id}>{p.home?.name} vs {p.away?.name} · {p.played_at?new Date(p.played_at).toLocaleDateString('es-CO',{day:'2-digit',month:'short'}):''}</option>
            ))}
          </select>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:'12px', marginBottom:'14px' }}>
          {CRITERIOS_EVAL.map(c=>(
            <div key={c.key}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'5px' }}>
                <label style={{ fontSize:'.8rem', color:'#e8f4fd', fontWeight:'600' }}>{c.icon} {c.label}</label>
                <span style={{ fontSize:'.9rem', fontWeight:'900', color:scores[c.key]>=8?'#1e8e3e':scores[c.key]>=5?'#f9a825':'#d93025', background:'#1e2d3d', borderRadius:'6px', padding:'2px 8px' }}>{scores[c.key]}</span>
              </div>
              <div style={{ display:'flex', gap:'3px' }}>
                {[1,2,3,4,5,6,7,8,9,10].map(n=>(
                  <button key={n} onClick={()=>setScores(s=>({...s,[c.key]:n}))}
                    style={{ flex:1, padding:'6px 0', borderRadius:'5px', border:'none', cursor:'pointer', fontSize:'.68rem', fontWeight:'700',
                      background:scores[c.key]>=n?(n>=8?'#1e8e3e':n>=5?'#e8710a':'#d93025'):'#1e2d3d',
                      color:scores[c.key]>=n?'#fff':'#7a9ab5', transition:'all .1s' }}>
                    {n}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div style={{ background:'rgba(0,221,208,.08)', border:'1px solid rgba(0,221,208,.2)', borderRadius:'10px', padding:'10px 14px', marginBottom:'12px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <span style={{ fontSize:'.82rem', color:'#7a9ab5', fontWeight:'600' }}>Total</span>
          <div style={{ textAlign:'right' }}>
            <span style={{ fontSize:'1.4rem', fontWeight:'900', color:total>=48?'#1e8e3e':total>=30?'#f9a825':'#d93025' }}>{total}</span>
            <span style={{ fontSize:'.75rem', color:'#7a9ab5' }}>/60</span>
          </div>
        </div>
        <div style={{ marginBottom:'14px' }}>
          <label style={lbl}>Observaciones del veedor</label>
          <textarea value={obs} onChange={e=>setObs(e.target.value)} rows={3} style={{...inp,resize:'vertical'}} placeholder="Comentarios generales..."/>
        </div>
        <div style={{ display:'flex', gap:'8px' }}>
          <button onClick={handleGuardar} disabled={loading} style={{ flex:1, padding:'10px', background:'#1a73e8', border:'none', borderRadius:'8px', cursor:'pointer', color:'#fff', fontWeight:'700', opacity:loading?.7:1 }}>{loading?'Guardando...':'Guardar evaluación'}</button>
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
  const [fisico,  setFisico]  = useState({
    cooper_metros:'', sprint_segundos:'', yoyo_nivel:'',
    peso_kg:'', talla_cm:'', presion_arterial:'',
    flexibilidad_cm:'', frecuencia_cardiaca:''
  })

  const imc = calcIMC(fisico.peso_kg, fisico.talla_cm)

  async function handleGuardar() {
    setLoading(true)
    let archivoUrl = null
    if (file) {
      const path = `examenes/${arbitro.id}_${Date.now()}.${file.name.split('.').pop()}`
      const { error:upErr } = await supabase.storage.from('players').upload(path, file, { upsert:true })
      if (!upErr) {
        const { data:u } = supabase.storage.from('players').getPublicUrl(path)
        archivoUrl = u.publicUrl
      }
    }
    const payload = {
      arbitro_id:arbitro.id, tipo, fecha:fecha||null, notas,
      resultado:result, archivo_url:archivoUrl, registrado_por:evaluadorId,
      imc: imc ? parseFloat(imc) : null,
    }
    if (tipo==='fisico') {
      PRUEBAS_FISICAS.forEach(p => { if (fisico[p.key]) payload[p.key] = p.tipo==='number' ? parseFloat(fisico[p.key]) : fisico[p.key] })
    }
    await supabase.from('arbitro_examenes').insert(payload)
    onGuardado(); onClose()
    setLoading(false)
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.8)', zIndex:500, display:'flex', alignItems:'flex-start', justifyContent:'center', padding:'16px', overflowY:'auto' }}>
      <div style={{ background:'#0d1117', borderRadius:'16px', padding:'24px', width:'100%', maxWidth:'520px', border:'1px solid #1e2d3d', margin:'20px auto' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px' }}>
          <div>
            <div style={{ fontWeight:'700', color:'#e8f4fd', fontSize:'.95rem' }}>Examen — {arbitro.name}</div>
            <div style={{ fontSize:'.7rem', color:'#7a9ab5' }}>Registro físico / médico</div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'#7a9ab5' }}><X size={18}/></button>
        </div>

        {/* Tipo */}
        <div style={{ display:'flex', gap:'8px', marginBottom:'16px' }}>
          {['fisico','medico'].map(t=>(
            <button key={t} onClick={()=>setTipo(t)}
              style={{ flex:1, padding:'9px', borderRadius:'8px', border:`1px solid ${tipo===t?'#1a73e8':'#1e2d3d'}`, background:tipo===t?'#1a73e8':'transparent', color:tipo===t?'#fff':'#7a9ab5', cursor:'pointer', fontWeight:'700', fontSize:'.85rem' }}>
              {t==='fisico'?'🏃 Físico':'🏥 Médico'}
            </button>
          ))}
        </div>

        {/* Pruebas físicas */}
        {tipo==='fisico' && (
          <div style={{ marginBottom:'14px' }}>
            <div style={{ fontSize:'.72rem', fontWeight:'700', color:'#f9a825', marginBottom:'10px', textTransform:'uppercase', letterSpacing:'.08em' }}>Pruebas físicas</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
              {PRUEBAS_FISICAS.map(p=>(
                <div key={p.key}>
                  <label style={lbl}>{p.label} {p.unit&&<span style={{ color:'#3a4a5a' }}>({p.unit})</span>}</label>
                  <input type={p.tipo} value={fisico[p.key]} onChange={e=>setFisico(f=>({...f,[p.key]:e.target.value}))}
                    style={inp2} placeholder={p.placeholder}/>
                  <div style={{ fontSize:'.6rem', color:'#3a4a5a', marginTop:'2px' }}>{p.desc}</div>
                </div>
              ))}
            </div>
            {/* IMC calculado */}
            {imc && (
              <div style={{ marginTop:'10px', background:'rgba(0,221,208,.06)', border:'1px solid rgba(0,221,208,.15)', borderRadius:'8px', padding:'8px 12px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span style={{ fontSize:'.78rem', color:'#7a9ab5' }}>IMC calculado</span>
                <span style={{ fontSize:'1rem', fontWeight:'900', color: parseFloat(imc)<18.5||parseFloat(imc)>=30?'#d93025':parseFloat(imc)<25?'#1e8e3e':'#e8710a' }}>
                  {imc} {parseFloat(imc)<18.5?'(Bajo peso)':parseFloat(imc)<25?'(Normal)':parseFloat(imc)<30?'(Sobrepeso)':'(Obesidad)'}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Resultado */}
        <div style={{ marginBottom:'12px' }}>
          <label style={lbl}>Resultado</label>
          <div style={{ display:'flex', gap:'8px' }}>
            {['aprobado','reprobado','pendiente'].map(r=>(
              <button key={r} onClick={()=>setResult(r)}
                style={{ flex:1, padding:'7px', borderRadius:'7px', border:`1px solid ${result===r?(r==='aprobado'?'#1e8e3e':r==='reprobado'?'#d93025':'#e8710a'):'#1e2d3d'}`,
                  background:result===r?(r==='aprobado'?'rgba(30,142,62,.2)':r==='reprobado'?'rgba(217,48,37,.2)':'rgba(232,113,10,.2)'):'transparent',
                  color:result===r?(r==='aprobado'?'#1e8e3e':r==='reprobado'?'#d93025':'#e8710a'):'#7a9ab5', cursor:'pointer', fontSize:'.72rem', fontWeight:'700' }}>
                {r==='aprobado'?'✅ Aprobado':r==='reprobado'?'❌ Reprobado':'⏳ Pendiente'}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:'10px', marginBottom:'14px' }}>
          <div><label style={lbl}>Fecha</label><input type="date" value={fecha} onChange={e=>setFecha(e.target.value)} style={inp}/></div>
          <div><label style={lbl}>Notas adicionales</label><textarea value={notas} onChange={e=>setNotas(e.target.value)} rows={2} style={{...inp,resize:'vertical'}} placeholder="Observaciones..."/></div>
          <div>
            <label style={lbl}>Archivo adjunto (PDF, imagen)</label>
            <label style={{ display:'block', border:`1px dashed ${file?'#00ddd0':'#1e2d3d'}`, borderRadius:'8px', padding:'12px', textAlign:'center', cursor:'pointer', background:'#111827' }}>
              <input type="file" onChange={e=>setFile(e.target.files[0])} style={{ display:'none' }}/>
              {file
                ? <span style={{ fontSize:'.8rem', color:'#00ddd0' }}>📎 {file.name}</span>
                : <span style={{ fontSize:'.78rem', color:'#7a9ab5', display:'flex', alignItems:'center', justifyContent:'center', gap:'6px' }}><Upload size={14}/> Subir archivo</span>}
            </label>
          </div>
        </div>

        <div style={{ display:'flex', gap:'8px' }}>
          <button onClick={handleGuardar} disabled={loading} style={{ flex:1, padding:'10px', background:'#1a73e8', border:'none', borderRadius:'8px', cursor:'pointer', color:'#fff', fontWeight:'700', opacity:loading?.7:1 }}>{loading?'Guardando...':'Guardar examen'}</button>
          <button onClick={onClose} style={{ padding:'10px 14px', background:'none', border:'1px solid #1e2d3d', borderRadius:'8px', cursor:'pointer', color:'#7a9ab5' }}>Cancelar</button>
        </div>
      </div>
    </div>
  )
}

function ModalReclamo({ arbitro, partidos, evaluadorId, onClose, onGuardado }) {
  const [matchId, setMatchId] = useState('')
  const [desc,    setDesc]    = useState('')
  const [tipo,    setTipo]    = useState('tecnico')
  const [loading, setLoading] = useState(false)

  const inp2 = { width:'100%', background:'#0d1117', border:'1px solid #1e2d3d', borderRadius:'8px', padding:'8px 12px', color:'#e8f4fd', fontSize:'.875rem', outline:'none', boxSizing:'border-box' }
  const lbl2 = { fontSize:'.72rem', fontWeight:'600', color:'#7a9ab5', display:'block', marginBottom:'3px' }

  async function handleGuardar() {
    if (!desc.trim()) return
    setLoading(true)
    await supabase.from('arbitro_reclamos').insert({
      arbitro_id:arbitro.id, match_id:matchId||null,
      registrado_por:evaluadorId, descripcion:desc, tipo
    })
    onGuardado(); onClose()
    setLoading(false)
  }

  const partidosArbitro = partidos.filter(p=>p.status==='finished'&&(p.arbitro1_id===arbitro.id||p.arbitro2_id===arbitro.id||p.arbitro3_id===arbitro.id))

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.75)', zIndex:500, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px' }}>
      <div style={{ background:'#0d1117', borderRadius:'16px', padding:'24px', width:'100%', maxWidth:'440px', border:'1px solid #1e2d3d' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px' }}>
          <div>
            <div style={{ fontWeight:'700', color:'#e8f4fd', fontSize:'.95rem' }}>Reclamo — {arbitro.name}</div>
            <div style={{ fontSize:'.7rem', color:'#7a9ab5' }}>Registrar reclamo sobre un partido</div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'#7a9ab5' }}><X size={18}/></button>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:'10px', marginBottom:'14px' }}>
          <div>
            <label style={lbl2}>Tipo de reclamo</label>
            <div style={{ display:'flex', gap:'6px' }}>
              {[{id:'tecnico',label:'⚽ Técnico'},{id:'disciplinario',label:'🟥 Disciplinario'},{id:'comportamiento',label:'🗣️ Comportamiento'}].map(t=>(
                <button key={t.id} onClick={()=>setTipo(t.id)}
                  style={{ flex:1, padding:'6px 4px', borderRadius:'7px', border:`1px solid ${tipo===t.id?'#d93025':'#1e2d3d'}`, background:tipo===t.id?'rgba(217,48,37,.15)':'transparent', color:tipo===t.id?'#d93025':'#7a9ab5', cursor:'pointer', fontSize:'.65rem', fontWeight:'600' }}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label style={lbl2}>Partido (opcional)</label>
            <select value={matchId} onChange={e=>setMatchId(e.target.value)} style={inp2}>
              <option value="">Reclamo general</option>
              {partidosArbitro.map(p=>(
                <option key={p.id} value={p.id}>{p.home?.name} vs {p.away?.name} · {p.played_at?new Date(p.played_at).toLocaleDateString('es-CO',{day:'2-digit',month:'short'}):''}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={lbl2}>Descripción del reclamo *</label>
            <textarea value={desc} onChange={e=>setDesc(e.target.value)} rows={4} style={{...inp2,resize:'vertical'}} placeholder="Describe detalladamente el reclamo..."/>
          </div>
        </div>
        <div style={{ display:'flex', gap:'8px' }}>
          <button onClick={handleGuardar} disabled={loading||!desc.trim()} style={{ flex:1, padding:'10px', background:'#d93025', border:'none', borderRadius:'8px', cursor:'pointer', color:'#fff', fontWeight:'700', opacity:loading||!desc.trim()?.7:1 }}>
            {loading?'Guardando...':'Registrar reclamo'}
          </button>
          <button onClick={onClose} style={{ padding:'10px 14px', background:'none', border:'1px solid #1e2d3d', borderRadius:'8px', cursor:'pointer', color:'#7a9ab5' }}>Cancelar</button>
        </div>
      </div>
    </div>
  )
}

function ModalReclamo({ arbitro, partido, liderId, onClose, onGuardado }) {
  const [tipo,    setTipo]    = useState('tecnico')
  const [desc,    setDesc]    = useState('')
  const [loading, setLoading] = useState(false)

  async function handleGuardar() {
    if (!desc.trim()) return
    setLoading(true)
    await supabase.from('arbitro_reclamos').insert({
      arbitro_id: arbitro.id,
      match_id:   partido.id,
      registrado_por: liderId,
      descripcion: desc,
      tipo,
      estado: 'abierto',
    })
    onGuardado(); onClose()
    setLoading(false)
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.8)', zIndex:600, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px' }}>
      <div style={{ background:'#0d1117', borderRadius:'16px', padding:'24px', width:'100%', maxWidth:'440px', border:'1px solid rgba(217,48,37,.3)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px' }}>
          <div>
            <div style={{ fontWeight:'700', color:'#e8f4fd', fontSize:'.95rem' }}>⚠️ Reclamo — {arbitro.name}</div>
            <div style={{ fontSize:'.7rem', color:'#7a9ab5', marginTop:'2px' }}>
              {partido.home?.name} vs {partido.away?.name}
              {partido.played_at && ` · ${new Date(partido.played_at).toLocaleDateString('es-CO',{day:'2-digit',month:'short'})}`}
            </div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'#7a9ab5' }}><X size={18}/></button>
        </div>
        {/* Tipo */}
        <div style={{ marginBottom:'12px' }}>
          <label style={lbl}>Tipo de reclamo</label>
          <div style={{ display:'flex', gap:'6px' }}>
            {[{id:'tecnico',label:'Técnico'},{id:'disciplinario',label:'Disciplinario'},{id:'comportamiento',label:'Comportamiento'}].map(t=>(
              <button key={t.id} onClick={()=>setTipo(t.id)}
                style={{ flex:1, padding:'6px', borderRadius:'7px', border:`1px solid ${tipo===t.id?'#d93025':'#1e2d3d'}`, background:tipo===t.id?'rgba(217,48,37,.15)':'transparent', color:tipo===t.id?'#d93025':'#7a9ab5', cursor:'pointer', fontSize:'.68rem', fontWeight:'600' }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
        {/* Descripción */}
        <div style={{ marginBottom:'16px' }}>
          <label style={lbl}>Descripción del reclamo *</label>
          <textarea value={desc} onChange={e=>setDesc(e.target.value)} rows={4}
            style={{...inp, resize:'vertical'}} placeholder="Describe el reclamo en detalle..."/>
        </div>
        <div style={{ display:'flex', gap:'8px' }}>
          <button onClick={handleGuardar} disabled={loading||!desc.trim()}
            style={{ flex:1, padding:'10px', background:'#d93025', border:'none', borderRadius:'8px', cursor:'pointer', color:'#fff', fontWeight:'700', opacity:loading||!desc.trim()?.5:1 }}>
            {loading?'Guardando...':'Registrar reclamo'}
          </button>
          <button onClick={onClose} style={{ padding:'10px 14px', background:'none', border:'1px solid #1e2d3d', borderRadius:'8px', cursor:'pointer', color:'#7a9ab5' }}>Cancelar</button>
        </div>
      </div>
    </div>
  )
}

export default function ArbitroRankingPage() {
  const navigate = useNavigate()
  const [lider,     setLider]     = useState(null)
  const [arbitros,  setArbitros]  = useState([])
  const [evals,     setEvals]     = useState([])
  const [examenes,  setExamenes]  = useState([])
  const [partidos,  setPartidos]  = useState([])
  const [matches,   setMatches]   = useState([]) // para tarjetas
  const [loading,   setLoading]   = useState(true)
  const [filtro,    setFiltro]    = useState('todos')
  const [tab,       setTab]       = useState('ranking')
  const [modalEval, setModalEval] = useState(null)
  const [modalExam, setModalExam] = useState(null)
  const [msg,       setMsg]       = useState(null)
  const [reclamos,  setReclamos]  = useState([])
  const [modalRec,  setModalRec]  = useState(null)

  useEffect(()=>{ fetchTodo() },[])

  async function fetchTodo() {
    setLoading(true)
    const { data:{user} } = await supabase.auth.getUser()
    const { data:p } = await supabase.from('players').select('*').eq('user_id', user.id).single()
    setLider(p)
    await Promise.all([fetchArbitros(), fetchEvals(), fetchExamenes(), fetchPartidos(), fetchMatchStats(), fetchReclamos()])
    setLoading(false)
  }

  async function fetchArbitros() {
    const { data } = await supabase.from('players').select('id,name,photo_url,photo_face_url').or('rol.eq.arbitro,es_arbitro.eq.true').order('name')
    setArbitros(data||[])
  }
  async function fetchEvals() {
    const { data } = await supabase.from('arbitro_evaluaciones').select('*').order('created_at',{ascending:false})
    setEvals(data||[])
  }
  async function fetchExamenes() {
    const { data } = await supabase.from('arbitro_examenes').select('*').order('created_at',{ascending:false})
    setExamenes(data||[])
  }
  async function fetchPartidos() {
    const { data } = await supabase.from('matches').select('id,played_at,status,arbitro1_id,arbitro2_id,arbitro3_id,tournament_id,fase,home:home_team_id(name),away:away_team_id(name)').order('played_at',{ascending:false})
    setPartidos(data||[])
  }
  async function fetchReclamos() {
    const { data } = await supabase.from('arbitro_reclamos').select('*, matches(id,played_at,home:home_team_id(name),away:away_team_id(name))').order('created_at',{ascending:false})
    setReclamos(data||[])
  }

  async function fetchMatchStats() {
    // Tarjetas por partido
    const { data } = await supabase.from('match_events').select('match_id,event_type').in('event_type',['yellow_card','blue_card','red_card'])
    setMatches(data||[])
  }

  async function fetchReclamos() {
    const { data } = await supabase.from('arbitro_reclamos')
      .select('*, matches(id,played_at,home:home_team_id(name),away:away_team_id(name))')
      .order('created_at',{ascending:false})
    setReclamos(data||[])
  }

  function showMsgFn(t,type='ok') { setMsg({text:t,type}); setTimeout(()=>setMsg(null),3000) }

  if (loading) return <div style={{ minHeight:'100vh',background:'#07070e',display:'flex',alignItems:'center',justifyContent:'center',color:'#00ddd0' }}>Cargando...</div>

  // Filtro temporal
  function pasaFiltro(fecha) {
    if (filtro==='todos') return true
    const d = new Date(fecha), now = new Date()
    if (filtro==='mes')  return d.getMonth()===now.getMonth() && d.getFullYear()===now.getFullYear()
    if (filtro==='anio') return d.getFullYear()===now.getFullYear()
    return true
  }

  const evalsFiltradas = evals.filter(e=>pasaFiltro(e.created_at))
  const partidosFiltrados = partidos.filter(p=>p.status==='finished' && pasaFiltro(p.played_at))

  // Construir ranking
  const ranking = arbitros.map(a => {
    const misEvals    = evalsFiltradas.filter(e=>e.arbitro_id===a.id)
    const misPartidos = partidosFiltrados.filter(p=>p.arbitro1_id===a.id||p.arbitro2_id===a.id||p.arbitro3_id===a.id)
    const misMatchIds = new Set(misPartidos.map(p=>p.id))
    const misTarjetas = matches.filter(m=>misMatchIds.has(m.match_id))
    const promEval    = misEvals.length>0 ? Math.round(misEvals.reduce((s,e)=>s+e.total,0)/misEvals.length) : null
    const finales     = misPartidos.filter(p=>p.fase==='final').length
    const semis       = misPartidos.filter(p=>p.fase==='semifinal').length
    return {
      ...a,
      evaluaciones:    misEvals.length,
      promedio:        promEval,
      partidos_pitados:misPartidos.length,
      amarillas:       misTarjetas.filter(t=>t.event_type==='yellow_card').length,
      azules:          misTarjetas.filter(t=>t.event_type==='blue_card').length,
      rojas:           misTarjetas.filter(t=>t.event_type==='red_card').length,
      finales, semis,
      reclamos_total: misReclamos.length,
      reclamos_abiertos: misReclamos.filter(r=>r.estado==='abierto').length,
    }
  }).sort((a,b)=> (b.promedio||0)-(a.promedio||0) || b.partidos_pitados-a.partidos_pitados)

  return (
    <div style={{ minHeight:'100vh', background:'#07070e', fontFamily:'system-ui,sans-serif', color:'#e8f4fd', paddingBottom:'40px' }}>
      {msg && <div style={{ position:'fixed', top:'20px', right:'20px', zIndex:600, padding:'12px 20px', background:msg.type==='ok'?'#e6f4ea':'#fce8e6', color:msg.type==='ok'?'#1e8e3e':'#d93025', borderRadius:'10px', fontWeight:'600', fontSize:'.875rem', boxShadow:'0 4px 16px rgba(0,0,0,.3)' }}>{msg.text}</div>}
      {modalRec && <ModalReclamo arbitro={modalRec} partidos={partidos} evaluadorId={lider?.id} onClose={()=>setModalRec(null)} onGuardado={()=>{ fetchReclamos(); showMsgFn('Reclamo registrado ✓') }}/>}
      {modalRec  && <ModalReclamo arbitro={modalRec.arbitro} partido={modalRec.partido} liderId={lider?.id} onClose={()=>setModalRec(null)} onGuardado={()=>{ fetchReclamos(); showMsgFn('Reclamo registrado ✓') }}/>}
      {modalEval && <ModalEvaluar arbitro={modalEval} partidos={partidos} evaluadorId={lider?.id} onClose={()=>setModalEval(null)} onGuardado={()=>{ fetchEvals(); showMsgFn('Evaluación guardada ✓') }}/>}
      {modalExam && <ModalExamen  arbitro={modalExam} evaluadorId={lider?.id} onClose={()=>setModalExam(null)} onGuardado={()=>{ fetchExamenes(); showMsgFn('Examen registrado ✓') }}/>}

      {/* Header */}
      <div style={{ background:'#0d1117', borderBottom:'0.5px solid #1e2d3d', padding:'12px 16px', display:'flex', alignItems:'center', gap:'12px', position:'sticky', top:0, zIndex:50 }}>
        <button onClick={()=>navigate('/arbitro/lider')} style={{ background:'none', border:'1px solid #1e2d3d', borderRadius:'8px', padding:'6px 8px', cursor:'pointer', color:'#7a9ab5', display:'flex' }}>
          <ArrowLeft size={18}/>
        </button>
        <div>
          <div style={{ fontWeight:'700', fontSize:'.95rem', color:'#e8f4fd' }}>Ranking árbitros</div>
          <div style={{ fontSize:'.7rem', color:'#7a9ab5' }}>Evaluaciones · Exámenes · Estadísticas</div>
        </div>
      </div>

      <div style={{ maxWidth:'700px', margin:'0 auto', padding:'16px' }}>

        {/* Tabs */}
        <div style={{ display:'flex', gap:'4px', marginBottom:'16px', background:'#111827', borderRadius:'10px', padding:'4px' }}>
          {[{id:'ranking',label:'🏆 Ranking'},{id:'evaluar',label:'📝 Evaluar'},{id:'examenes',label:'🏥 Exámenes'},{id:'reclamos',label:'⚠️ Reclamos'}].map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)}
              style={{ flex:1, padding:'8px', borderRadius:'8px', border:'none', cursor:'pointer', fontSize:'.8rem', fontWeight:'700', background:tab===t.id?'#1a73e8':'transparent', color:tab===t.id?'#fff':'#7a9ab5' }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Filtro temporal */}
        {tab !== 'examenes' && (
          <div style={{ display:'flex', gap:'6px', marginBottom:'14px' }}>
            {[{id:'todos',label:'Todos'},{id:'anio',label:'Este año'},{id:'mes',label:'Este mes'}].map(f=>(
              <button key={f.id} onClick={()=>setFiltro(f.id)}
                style={{ padding:'6px 16px', borderRadius:'20px', border:'none', cursor:'pointer', fontSize:'.78rem', fontWeight:'600', background:filtro===f.id?'#1a73e8':'#111827', color:filtro===f.id?'#fff':'#7a9ab5' }}>
                {f.label}
              </button>
            ))}
          </div>
        )}

        {/* ── RANKING ── */}
        {tab==='ranking' && (
          <div>
            {ranking.map((a,i)=>{
              const medalColor = i===0?'#f9a825':i===1?'#9aa0a6':i===2?'#cd7f32':'#1e2d3d'
              const pct = a.promedio ? Math.round((a.promedio/60)*100) : 0
              return (
                <div key={a.id} style={{ background:'#111827', border:`1px solid ${i<3?medalColor+'55':'#1e2d3d'}`, borderRadius:'14px', padding:'14px 16px', marginBottom:'10px' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'10px' }}>
                    {/* Posición */}
                    <div style={{ width:'38px', height:'38px', borderRadius:'50%', background:`${medalColor}22`, border:`2px solid ${medalColor}`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontWeight:'900', fontSize:'1rem', color:medalColor }}>
                      {i===0?'🥇':i===1?'🥈':i===2?'🥉':`${i+1}`}
                    </div>
                    {/* Foto */}
                    <div style={{ width:'42px', height:'42px', borderRadius:'50%', overflow:'hidden', background:'#1e2d3d', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                      {a.photo_face_url||a.photo_url?<img src={a.photo_face_url||a.photo_url} style={{ width:'100%', height:'100%', objectFit:'cover' }}/>:<span>👤</span>}
                    </div>
                    {/* Nombre */}
                    <div style={{ flex:1 }}>
                      <div onClick={()=>navigate(`/arbitro/perfil/${a.id}`)} style={{ fontWeight:'700', fontSize:'.92rem', color:'#00ddd0', cursor:'pointer', textDecoration:'underline', textDecorationColor:'rgba(0,221,208,.3)' }}>{a.name}</div>
                      {/* Barra eval */}
                      {a.promedio!==null && (
                        <div style={{ marginTop:'4px' }}>
                          <div style={{ height:'4px', background:'#1e2d3d', borderRadius:'2px', overflow:'hidden' }}>
                            <div style={{ height:'100%', width:`${pct}%`, background:pct>=80?'#1e8e3e':pct>=50?'#f9a825':'#d93025', borderRadius:'2px' }}/>
                          </div>
                        </div>
                      )}
                    </div>
                    {/* Puntaje eval */}
                    <div style={{ textAlign:'center', flexShrink:0 }}>
                      {a.promedio!==null ? (
                        <>
                          <div style={{ fontSize:'1.2rem', fontWeight:'900', color:a.promedio>=48?'#1e8e3e':a.promedio>=30?'#f9a825':'#d93025', lineHeight:1 }}>{a.promedio}</div>
                          <div style={{ fontSize:'.58rem', color:'#7a9ab5' }}>/ 60 pts</div>
                        </>
                      ) : <div style={{ fontSize:'.68rem', color:'#3a4a5a' }}>Sin eval.</div>}
                    </div>
                  </div>

                  {/* Stats detalle */}
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:'6px' }}>
                    {[
                      { label:'Partidos', value:a.partidos_pitados, color:'#00ddd0',  icon:'📋' },
                      { label:'Evals',    value:a.evaluaciones,     color:'#1a73e8',  icon:'📝' },
                      { label:'🟨',       value:a.amarillas,        color:'#f9a825',  icon:'' },
                      { label:'🟦',       value:a.azules,           color:'#1a73e8',  icon:'' },
                      { label:'🟥',       value:a.rojas,            color:'#d93025',  icon:'' },
                      { label:'Finales',   value:a.finales,           color:'#f9a825',  icon:'🏅' },
                      { label:'Reclamos',  value:a.reclamos_total,    color:'#d93025',  icon:'⚠️' },
                    ].map(s=>(
                      <div key={s.label} style={{ background:'#0d1117', borderRadius:'7px', padding:'6px 4px', textAlign:'center' }}>
                        <div style={{ fontSize:s.icon?'.75rem':'.82rem', marginBottom:'1px' }}>{s.icon||s.label}</div>
                        <div style={{ fontSize:'1rem', fontWeight:'900', color:s.value>0?s.color:'#2a3a4a', lineHeight:1 }}>{s.value}</div>
                        {s.icon && <div style={{ fontSize:'.55rem', color:'#7a9ab5', marginTop:'1px' }}>{s.label}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ── EVALUAR ── */}
        {tab==='evaluar' && (
          <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
            {arbitros.map(a=>{
              const misEvals = evalsFiltradas.filter(e=>e.arbitro_id===a.id)
              const ultimo   = misEvals[0]
              return (
                <div key={a.id} style={{ background:'#111827', border:'1px solid #1e2d3d', borderRadius:'12px', padding:'12px 14px', display:'flex', alignItems:'center', gap:'12px' }}>
                  <div style={{ width:'38px', height:'38px', borderRadius:'50%', overflow:'hidden', background:'#1e2d3d', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                    {a.photo_face_url||a.photo_url?<img src={a.photo_face_url||a.photo_url} style={{ width:'100%', height:'100%', objectFit:'cover' }}/>:<span>👤</span>}
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:'700', fontSize:'.88rem', color:'#e8f4fd' }}>{a.name}</div>
                    <div style={{ fontSize:'.68rem', color:'#7a9ab5', marginTop:'2px' }}>
                      {misEvals.length} evaluaciones {ultimo&&`· Última: ${ultimo.total}/60`}
                    </div>
                    {ultimo && (
                      <div style={{ display:'flex', gap:'3px', marginTop:'4px', flexWrap:'wrap' }}>
                        {CRITERIOS_EVAL.map(c=>(
                          <span key={c.key} style={{ fontSize:'.6rem', color:ultimo[c.key]>=8?'#1e8e3e':ultimo[c.key]>=5?'#f9a825':'#d93025', background:'#1e2d3d', borderRadius:'4px', padding:'1px 5px' }}>
                            {c.icon}{ultimo[c.key]}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <button onClick={()=>setModalEval(a)} style={{ padding:'7px 14px', background:'#1a73e8', border:'none', borderRadius:'8px', cursor:'pointer', color:'#fff', fontSize:'.78rem', fontWeight:'700', flexShrink:0 }}>+ Evaluar</button>
                </div>
              )
            })}
          </div>
        )}

        {/* ── RECLAMOS ── */}
        {tab==='reclamos' && (
          <div>
            <div style={{ fontSize:'.72rem', color:'#7a9ab5', marginBottom:'12px' }}>Reclamos por partido ya jugado — visibles solo para el líder</div>
            <div style={{ display:'flex', flexDirection:'column', gap:'8px', marginBottom:'20px' }}>
              {arbitros.map(a=>{
                const misRec = reclamos.filter(r=>r.arbitro_id===a.id)
                return (
                  <div key={a.id} style={{ background:'#111827', border:`1px solid ${misRec.some(r=>r.estado==='abierto')?'rgba(217,48,37,.3)':'#1e2d3d'}`, borderRadius:'12px', padding:'12px 14px' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom: misRec.length>0?'10px':'0' }}>
                      <div style={{ width:'36px', height:'36px', borderRadius:'50%', overflow:'hidden', background:'#1e2d3d', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                        {a.photo_face_url||a.photo_url?<img src={a.photo_face_url||a.photo_url} style={{ width:'100%', height:'100%', objectFit:'cover' }}/>:<span>👤</span>}
                      </div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontWeight:'700', fontSize:'.88rem', color:'#e8f4fd' }}>{a.name}</div>
                        <div style={{ fontSize:'.68rem', color:'#7a9ab5' }}>{misRec.length} reclamo{misRec.length!==1?'s':''} · {misRec.filter(r=>r.estado==='abierto').length} abierto{misRec.filter(r=>r.estado==='abierto').length!==1?'s':''}</div>
                      </div>
                      <button onClick={()=>setModalRec(a)} style={{ padding:'6px 12px', background:'none', border:'1px solid #d93025', borderRadius:'7px', cursor:'pointer', color:'#d93025', fontSize:'.75rem', fontWeight:'700' }}>+ Reclamo</button>
                    </div>
                    {misRec.map(r=>(
                      <div key={r.id} style={{ background:'#0d1117', borderRadius:'8px', padding:'8px 10px', marginBottom:'5px', borderLeft:`3px solid ${r.estado==='abierto'?'#d93025':r.estado==='resuelto'?'#1e8e3e':'#7a9ab5'}` }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'3px' }}>
                          <span style={{ fontSize:'.68rem', fontWeight:'700', color:r.estado==='abierto'?'#d93025':r.estado==='resuelto'?'#1e8e3e':'#7a9ab5' }}>
                            {r.estado==='abierto'?'⚠️ Abierto':r.estado==='resuelto'?'✅ Resuelto':'🔕 Desestimado'} · {r.tipo}
                          </span>
                          <span style={{ fontSize:'.62rem', color:'#3a4a5a' }}>{r.matches?.home?.name} vs {r.matches?.away?.name}</span>
                        </div>
                        <div style={{ fontSize:'.72rem', color:'#b8d4e8' }}>{r.descripcion}</div>
                        {r.resolucion && <div style={{ fontSize:'.68rem', color:'#7a9ab5', marginTop:'3px' }}>→ {r.resolucion}</div>}
                        <div style={{ display:'flex', gap:'6px', marginTop:'5px' }}>
                          {r.estado==='abierto' && (
                            <>
                              <button onClick={async()=>{ await supabase.from('arbitro_reclamos').update({estado:'resuelto'}).eq('id',r.id); fetchReclamos() }}
                                style={{ padding:'3px 8px', background:'rgba(30,142,62,.15)', border:'1px solid rgba(30,142,62,.3)', borderRadius:'5px', cursor:'pointer', color:'#1e8e3e', fontSize:'.65rem' }}>
                                Resolver
                              </button>
                              <button onClick={async()=>{ await supabase.from('arbitro_reclamos').update({estado:'desestimado'}).eq('id',r.id); fetchReclamos() }}
                                style={{ padding:'3px 8px', background:'rgba(122,154,181,.1)', border:'1px solid #1e2d3d', borderRadius:'5px', cursor:'pointer', color:'#7a9ab5', fontSize:'.65rem' }}>
                                Desestimar
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── EXÁMENES ── */}
        {tab==='examenes' && (
          <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
            {arbitros.map(a=>{
              const misExams  = examenes.filter(e=>e.arbitro_id===a.id)
              const ultimoFis = misExams.find(e=>e.tipo==='fisico')
              const ultimoMed = misExams.find(e=>e.tipo==='medico')
              return (
                <div key={a.id} style={{ background:'#111827', border:'1px solid #1e2d3d', borderRadius:'12px', padding:'14px 16px' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'10px' }}>
                    <div style={{ width:'38px', height:'38px', borderRadius:'50%', overflow:'hidden', background:'#1e2d3d', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                      {a.photo_face_url||a.photo_url?<img src={a.photo_face_url||a.photo_url} style={{ width:'100%', height:'100%', objectFit:'cover' }}/>:<span>👤</span>}
                    </div>
                    <div style={{ flex:1, fontWeight:'700', fontSize:'.9rem', color:'#e8f4fd' }}>{a.name}</div>
                    <button onClick={()=>setModalExam(a)} style={{ padding:'6px 12px', background:'none', border:'1px solid #1a73e8', borderRadius:'7px', cursor:'pointer', color:'#1a73e8', fontSize:'.75rem', fontWeight:'700' }}>+ Examen</button>
                  </div>

                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px' }}>
                    {/* Físico */}
                    <div style={{ background:'#0d1117', borderRadius:'10px', padding:'10px 12px', border:`1px solid ${ultimoFis?.resultado==='aprobado'?'rgba(30,142,62,.3)':ultimoFis?.resultado==='reprobado'?'rgba(217,48,37,.3)':'#1e2d3d'}` }}>
                      <div style={{ fontSize:'.65rem', fontWeight:'700', color:'#7a9ab5', marginBottom:'6px' }}>🏃 FÍSICO</div>
                      {ultimoFis ? (
                        <>
                          <div style={{ fontSize:'.78rem', fontWeight:'700', color:ultimoFis.resultado==='aprobado'?'#1e8e3e':ultimoFis.resultado==='reprobado'?'#d93025':'#e8710a', marginBottom:'6px' }}>
                            {ultimoFis.resultado==='aprobado'?'✅ Aprobado':ultimoFis.resultado==='reprobado'?'❌ Reprobado':'⏳ Pendiente'}
                          </div>
                          {/* Pruebas */}
                          <div style={{ display:'flex', flexDirection:'column', gap:'3px' }}>
                            {PRUEBAS_FISICAS.filter(p=>ultimoFis[p.key]).map(p=>(
                              <div key={p.key} style={{ display:'flex', justifyContent:'space-between', fontSize:'.65rem' }}>
                                <span style={{ color:'#7a9ab5' }}>{p.label}</span>
                                <span style={{ color:'#e8f4fd', fontWeight:'600' }}>{ultimoFis[p.key]} {p.unit}</span>
                              </div>
                            ))}
                            {ultimoFis.imc && (
                              <div style={{ display:'flex', justifyContent:'space-between', fontSize:'.65rem' }}>
                                <span style={{ color:'#7a9ab5' }}>IMC</span>
                                <span style={{ color: ultimoFis.imc<18.5||ultimoFis.imc>=30?'#d93025':ultimoFis.imc<25?'#1e8e3e':'#e8710a', fontWeight:'600' }}>{ultimoFis.imc}</span>
                              </div>
                            )}
                          </div>
                          {ultimoFis.fecha && <div style={{ fontSize:'.6rem', color:'#3a4a5a', marginTop:'4px' }}>{new Date(ultimoFis.fecha).toLocaleDateString('es-CO')}</div>}
                          {ultimoFis.archivo_url && <a href={ultimoFis.archivo_url} target="_blank" rel="noreferrer" style={{ fontSize:'.65rem', color:'#1a73e8', display:'block', marginTop:'3px' }}>📎 Ver archivo</a>}
                        </>
                      ) : <div style={{ fontSize:'.72rem', color:'#3a4a5a' }}>Sin registro</div>}
                    </div>

                    {/* Médico */}
                    <div style={{ background:'#0d1117', borderRadius:'10px', padding:'10px 12px', border:`1px solid ${ultimoMed?.resultado==='aprobado'?'rgba(30,142,62,.3)':ultimoMed?.resultado==='reprobado'?'rgba(217,48,37,.3)':'#1e2d3d'}` }}>
                      <div style={{ fontSize:'.65rem', fontWeight:'700', color:'#7a9ab5', marginBottom:'6px' }}>🏥 MÉDICO</div>
                      {ultimoMed ? (
                        <>
                          <div style={{ fontSize:'.78rem', fontWeight:'700', color:ultimoMed.resultado==='aprobado'?'#1e8e3e':ultimoMed.resultado==='reprobado'?'#d93025':'#e8710a', marginBottom:'4px' }}>
                            {ultimoMed.resultado==='aprobado'?'✅ Aprobado':ultimoMed.resultado==='reprobado'?'❌ Reprobado':'⏳ Pendiente'}
                          </div>
                          {ultimoMed.notas && <div style={{ fontSize:'.65rem', color:'#7a9ab5', marginBottom:'4px' }}>{ultimoMed.notas}</div>}
                          {ultimoMed.fecha && <div style={{ fontSize:'.6rem', color:'#3a4a5a', marginTop:'4px' }}>{new Date(ultimoMed.fecha).toLocaleDateString('es-CO')}</div>}
                          {ultimoMed.archivo_url && <a href={ultimoMed.archivo_url} target="_blank" rel="noreferrer" style={{ fontSize:'.65rem', color:'#1a73e8', display:'block', marginTop:'3px' }}>📎 Ver archivo</a>}
                        </>
                      ) : <div style={{ fontSize:'.72rem', color:'#3a4a5a' }}>Sin registro</div>}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
