import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ArrowLeft, X, Clock } from 'lucide-react'

const PREGUNTAS = [
  { key:'conocimiento_reglamento', label:'Conocimiento del reglamento',    desc:'¿Demuestra un buen conocimiento del reglamento?' },
  { key:'aplicacion_reglamento',   label:'Aplicación del reglamento',      desc:'¿Aplica el reglamento de manera justa y consistente?' },
  { key:'control_partido',         label:'Control del partido',             desc:'¿Mantiene el control del juego sin perder autoridad?' },
  { key:'imparcialidad',           label:'Imparcialidad',                   desc:'¿Actúa de forma imparcial con ambos equipos?' },
  { key:'comunicacion',            label:'Comunicación',                    desc:'¿Se comunica de manera clara con jugadores y compañeros?' },
  { key:'trabajo_equipo',          label:'Trabajo en equipo',               desc:'¿Trabaja adecuadamente con los asistentes?' },
  { key:'puntualidad',             label:'Puntualidad y responsabilidad',   desc:'¿Es puntual y cumple con sus compromisos?' },
  { key:'condicion_fisica',        label:'Condición física',                desc:'¿Tiene condición física adecuada para dirigir partidos?' },
  { key:'manejo_conflictos',       label:'Manejo de conflictos',            desc:'¿Controla adecuadamente las situaciones difíciles?' },
  { key:'profesionalismo',         label:'Profesionalismo',                 desc:'¿Demuestra respeto, ética y profesionalismo?' },
]

function getInterpretacion(total) {
  if (total >= 46) return { label:'Excelente',               color:'#1e8e3e', bg:'rgba(30,142,62,.1)' }
  if (total >= 41) return { label:'Muy bueno',               color:'#00ddd0', bg:'rgba(0,221,208,.1)' }
  if (total >= 36) return { label:'Bueno',                   color:'#1a73e8', bg:'rgba(26,115,232,.1)' }
  if (total >= 31) return { label:'Aceptable',               color:'#f9a825', bg:'rgba(249,168,37,.1)' }
  if (total >= 26) return { label:'Regular',                 color:'#e8710a', bg:'rgba(232,113,10,.1)' }
  return                  { label:'Requiere acompañamiento', color:'#d93025', bg:'rgba(217,48,37,.1)'  }
}

function Cronometro({ cierreAt }) {
  const [restante, setRestante] = useState('')
  const [vencida,  setVencida]  = useState(false)

  useEffect(() => {
    function calcular() {
      const diff = new Date(cierreAt) - new Date()
      if (diff <= 0) { setVencida(true); setRestante('Cerrada'); return }
      const h = Math.floor(diff / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setRestante(`${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`)
    }
    calcular()
    const t = setInterval(calcular, 1000)
    return () => clearInterval(t)
  }, [cierreAt])

  return (
    <span style={{ fontWeight:'700', color:vencida?'#d93025':'#f9a825', fontSize:'.82rem', display:'flex', alignItems:'center', gap:'4px' }}>
      <Clock size={13}/> {restante}
    </span>
  )
}

function ModalCrearEncuesta({ arbitros, liderId, onClose, onCreada }) {
  const [arbitroId, setArbitroId] = useState('')
  const [titulo,    setTitulo]    = useState('')
  const [horas,     setHoras]     = useState(24)
  const [loading,   setLoading]   = useState(false)

  async function handleCrear() {
    if (!arbitroId) return
    setLoading(true)
    const cierre = new Date(Date.now() + horas * 3600000).toISOString()
    const arb = arbitros.find(a=>a.id===arbitroId)
    const { data, error } = await supabase.from('encuestas_arbitros').insert({
      creada_por: liderId,
      arbitro_evaluado_id: arbitroId,
      titulo: titulo || `Evaluación de ${arb?.name}`,
      cierre_at: cierre,
      activa: true,
    }).select().single()
    if (!error) {
      // Notificar a todos los árbitros excepto el evaluado
      const otros = arbitros.filter(a=>a.id!==arbitroId)
      await Promise.all(otros.map(a=>
        supabase.from('notificaciones').insert({
          player_id: a.id,
          titulo: '📝 Nueva encuesta de evaluación',
          mensaje: `Tienes una encuesta pendiente: ${data.titulo}. Cierra en ${horas}h. Tu voto es anónimo.`,
          tipo: 'encuesta',
          referencia_id: data.id,
        })
      ))
      onCreada(data)
      onClose()
    }
    setLoading(false)
  }

  const inp = { width:'100%', background:'#0d1117', border:'1px solid #1e2d3d', borderRadius:'8px', padding:'8px 12px', color:'#e8f4fd', fontSize:'.875rem', outline:'none', boxSizing:'border-box' }
  const lbl = { fontSize:'.75rem', fontWeight:'600', color:'#7a9ab5', display:'block', marginBottom:'4px' }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.8)', zIndex:500, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px' }}>
      <div style={{ background:'#0d1117', borderRadius:'16px', padding:'24px', width:'100%', maxWidth:'440px', border:'1px solid #1e2d3d' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px' }}>
          <div>
            <div style={{ fontWeight:'700', color:'#e8f4fd', fontSize:'1rem' }}>Nueva encuesta</div>
            <div style={{ fontSize:'.72rem', color:'#7a9ab5' }}>Las respuestas son anónimas</div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'#7a9ab5' }}><X size={18}/></button>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:'12px', marginBottom:'16px' }}>
          <div>
            <label style={lbl}>Árbitro a evaluar *</label>
            <select value={arbitroId} onChange={e=>setArbitroId(e.target.value)} style={inp}>
              <option value="">Seleccionar árbitro...</option>
              {arbitros.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Título (opcional)</label>
            <input value={titulo} onChange={e=>setTitulo(e.target.value)} style={inp} placeholder={`Evaluación de ${arbitros.find(a=>a.id===arbitroId)?.name||'árbitro'}`}/>
          </div>
          <div>
            <label style={lbl}>Tiempo de cierre</label>
            <div style={{ display:'flex', gap:'6px' }}>
              {[12,24,48,72].map(h=>(
                <button key={h} onClick={()=>setHoras(h)}
                  style={{ flex:1, padding:'8px', borderRadius:'8px', border:`1px solid ${horas===h?'#1a73e8':'#1e2d3d'}`, background:horas===h?'#1a73e8':'transparent', color:horas===h?'#fff':'#7a9ab5', cursor:'pointer', fontSize:'.78rem', fontWeight:'700' }}>
                  {h}h
                </button>
              ))}
            </div>
          </div>
        </div>
        <div style={{ background:'rgba(26,115,232,.06)', border:'1px solid rgba(26,115,232,.15)', borderRadius:'8px', padding:'10px 12px', marginBottom:'14px', fontSize:'.75rem', color:'#7a9ab5' }}>
          📱 Todos los árbitros (excepto el evaluado) recibirán notificación para votar
        </div>
        <div style={{ display:'flex', gap:'8px' }}>
          <button onClick={handleCrear} disabled={loading||!arbitroId}
            style={{ flex:1, padding:'10px', background:'#1a73e8', border:'none', borderRadius:'8px', cursor:'pointer', color:'#fff', fontWeight:'700', opacity:loading||!arbitroId?.5:1 }}>
            {loading?'Creando...':'Crear encuesta'}
          </button>
          <button onClick={onClose} style={{ padding:'10px 14px', background:'none', border:'1px solid #1e2d3d', borderRadius:'8px', cursor:'pointer', color:'#7a9ab5' }}>Cancelar</button>
        </div>
      </div>
    </div>
  )
}

function ModalVotar({ encuesta, votanteId, onClose, onVotado }) {
  const [scores, setScores] = useState(Object.fromEntries(PREGUNTAS.map(p=>[p.key,0])))
  const [fortaleza, setFortaleza] = useState('')
  const [mejora,    setMejora]    = useState('')
  const [asignaria, setAsignaria] = useState('')
  const [comentarios,setComentarios]=useState('')
  const [loading,   setLoading]   = useState(false)

  const total = Object.values(scores).reduce((s,v)=>s+v,0)
  const interp = total>0 ? getInterpretacion(total) : null

  async function handleVotar() {
    if (Object.values(scores).some(v=>v===0)) return alert('Responde todas las preguntas')
    if (!asignaria) return alert('Indica si asignarías partidos importantes')
    setLoading(true)
    const esAuto = !!encuesta._esAuto
    await supabase.from('encuesta_respuestas').insert({
      encuesta_id: encuesta.id,
      votante_id: votanteId,
      ...scores, fortaleza, mejora, asignaria_partidos:asignaria, comentarios,
      es_autoevaluacion: esAuto,
    })
    onVotado()
    onClose()
    setLoading(false)
  }

  const inp = { width:'100%', background:'#0d1117', border:'1px solid #1e2d3d', borderRadius:'8px', padding:'7px 10px', color:'#e8f4fd', fontSize:'.82rem', outline:'none', resize:'vertical', boxSizing:'border-box' }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.85)', zIndex:500, display:'flex', alignItems:'flex-start', justifyContent:'center', padding:'16px', overflowY:'auto' }}>
      <div style={{ background:'#0d1117', borderRadius:'16px', padding:'24px', width:'100%', maxWidth:'540px', border:'1px solid #1e2d3d', margin:'20px auto' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'8px' }}>
          <div>
            <div style={{ fontWeight:'700', color:'#e8f4fd', fontSize:'.95rem' }}>{encuesta.titulo}</div>
            <div style={{ fontSize:'.7rem', color:'#7a9ab5', marginTop:'2px' }}>🔒 Tu voto es completamente anónimo</div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'#7a9ab5' }}><X size={18}/></button>
        </div>

        {encuesta._esAuto && (
          <div style={{ background:'rgba(153,85,255,.08)', border:'1px solid rgba(153,85,255,.2)', borderRadius:'8px', padding:'8px 12px', marginBottom:'10px', fontSize:'.75rem', color:'#9955ff', fontWeight:'600' }}>
            🪞 Autoevaluación — el árbitro líder verá tu respuesta por separado
          </div>
        )}
        <div style={{ background:'rgba(26,115,232,.06)', border:'1px solid rgba(26,115,232,.15)', borderRadius:'8px', padding:'8px 12px', marginBottom:'16px', fontSize:'.72rem', color:'#7a9ab5' }}>
          Escala: 1=Muy deficiente · 2=Deficiente · 3=Aceptable · 4=Bueno · 5=Excelente
        </div>

        {/* Preguntas */}
        <div style={{ display:'flex', flexDirection:'column', gap:'14px', marginBottom:'16px' }}>
          {PREGUNTAS.map((p,i)=>(
            <div key={p.key}>
              <div style={{ fontSize:'.8rem', fontWeight:'700', color:'#e8f4fd', marginBottom:'2px' }}>{i+1}. {p.label}</div>
              <div style={{ fontSize:'.68rem', color:'#7a9ab5', marginBottom:'6px' }}>{p.desc}</div>
              <div style={{ display:'flex', gap:'6px' }}>
                {[1,2,3,4,5].map(n=>(
                  <button key={n} onClick={()=>setScores(s=>({...s,[p.key]:n}))}
                    style={{ flex:1, padding:'8px 0', borderRadius:'8px', border:`1px solid ${scores[p.key]===n?'#1a73e8':'#1e2d3d'}`, background:scores[p.key]===n?'#1a73e8':'#111827', color:scores[p.key]===n?'#fff':'#7a9ab5', cursor:'pointer', fontWeight:'700', fontSize:'.85rem', transition:'all .1s' }}>
                    {n}{'⭐'.repeat(n).slice(0,1)}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Total parcial */}
        {total>0 && interp && (
          <div style={{ background:interp.bg, border:`1px solid ${interp.color}44`, borderRadius:'10px', padding:'10px 14px', marginBottom:'16px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <span style={{ fontSize:'.82rem', color:'#7a9ab5' }}>Puntaje parcial</span>
            <div>
              <span style={{ fontSize:'1.3rem', fontWeight:'900', color:interp.color }}>{total}</span>
              <span style={{ fontSize:'.72rem', color:'#7a9ab5' }}>/50 · {interp.label}</span>
            </div>
          </div>
        )}

        {/* Preguntas abiertas */}
        <div style={{ display:'flex', flexDirection:'column', gap:'10px', marginBottom:'16px' }}>
          <div>
            <label style={{ fontSize:'.78rem', fontWeight:'700', color:'#e8f4fd', display:'block', marginBottom:'4px' }}>¿Cuál es la mayor fortaleza de este árbitro?</label>
            <textarea value={fortaleza} onChange={e=>setFortaleza(e.target.value)} rows={2} style={inp} placeholder="Describe su principal fortaleza..."/>
          </div>
          <div>
            <label style={{ fontSize:'.78rem', fontWeight:'700', color:'#e8f4fd', display:'block', marginBottom:'4px' }}>¿Qué aspecto debería mejorar?</label>
            <textarea value={mejora} onChange={e=>setMejora(e.target.value)} rows={2} style={inp} placeholder="Aspecto de mejora..."/>
          </div>
          <div>
            <label style={{ fontSize:'.78rem', fontWeight:'700', color:'#e8f4fd', display:'block', marginBottom:'6px' }}>¿Le asignarías partidos importantes?</label>
            <div style={{ display:'flex', gap:'8px' }}>
              {['Sí','No','Depende'].map(op=>(
                <button key={op} onClick={()=>setAsignaria(op)}
                  style={{ flex:1, padding:'8px', borderRadius:'8px', border:`1px solid ${asignaria===op?'#1a73e8':'#1e2d3d'}`, background:asignaria===op?'#1a73e8':'transparent', color:asignaria===op?'#fff':'#7a9ab5', cursor:'pointer', fontWeight:'700', fontSize:'.85rem' }}>
                  {op}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label style={{ fontSize:'.78rem', fontWeight:'700', color:'#e8f4fd', display:'block', marginBottom:'4px' }}>Comentarios adicionales (opcional)</label>
            <textarea value={comentarios} onChange={e=>setComentarios(e.target.value)} rows={2} style={inp} placeholder="Cualquier otro comentario..."/>
          </div>
        </div>

        <div style={{ display:'flex', gap:'8px' }}>
          <button onClick={handleVotar} disabled={loading}
            style={{ flex:1, padding:'11px', background:'#1a73e8', border:'none', borderRadius:'8px', cursor:'pointer', color:'#fff', fontWeight:'700', opacity:loading?.7:1 }}>
            {loading?'Enviando...':'Enviar evaluación anónima'}
          </button>
          <button onClick={onClose} style={{ padding:'11px 14px', background:'none', border:'1px solid #1e2d3d', borderRadius:'8px', cursor:'pointer', color:'#7a9ab5' }}>Cancelar</button>
        </div>
      </div>
    </div>
  )
}

function ModalResultados({ encuesta, arbitros, votantes, onClose }) {
  const [respuestas, setRespuestas] = useState([])
  const [loading,    setLoading]    = useState(true)

  useEffect(()=>{ fetchRespuestas() },[])

  async function fetchRespuestas() {
    const { data } = await supabase.from('encuesta_respuestas').select('*').eq('encuesta_id', encuesta.id)
    setRespuestas(data||[])
    setLoading(false)
  }

  if (loading) return null

  const total = respuestas.length
  const respsNormales  = respuestas.filter(r=>!r.es_autoevaluacion)
  const totalNormal    = respsNormales.length
  const promPorPregunta = PREGUNTAS.map(p=>({
    ...p,
    promedio: totalNormal>0 ? (respsNormales.reduce((s,r)=>s+(r[p.key]||0),0)/totalNormal).toFixed(1) : 0
  }))
  const promTotal = totalNormal>0 ? Math.round(respsNormales.reduce((s,r)=>s+(r.total||0),0)/totalNormal) : 0
  const interp    = promTotal>0 ? getInterpretacion(promTotal) : null

  // Quiénes NO votaron (solo el líder lo sabe)
  const votaronIds = new Set(respuestas.map(r=>r.votante_id))
  const sinVotar   = votantes.filter(v=>!votaronIds.has(v.id))

  // Conteo asignaría
  const siCount  = respuestas.filter(r=>r.asignaria_partidos==='Sí').length
  const noCount  = respuestas.filter(r=>r.asignaria_partidos==='No').length
  const depCount = respuestas.filter(r=>r.asignaria_partidos==='Depende').length

  const arbEval = arbitros.find(a=>a.id===encuesta.arbitro_evaluado_id)

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.85)', zIndex:500, display:'flex', alignItems:'flex-start', justifyContent:'center', padding:'16px', overflowY:'auto' }}>
      <div style={{ background:'#0d1117', borderRadius:'16px', padding:'24px', width:'100%', maxWidth:'600px', border:'1px solid #1e2d3d', margin:'20px auto' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px' }}>
          <div>
            <div style={{ fontWeight:'700', color:'#e8f4fd', fontSize:'1rem' }}>Resultados — {encuesta.titulo}</div>
            <div style={{ fontSize:'.72rem', color:'#7a9ab5', marginTop:'2px' }}>{totalNormal} compañero{totalNormal!==1?'s':''} votaron · {respuestas.filter(r=>r.es_autoevaluacion).length>0?'✅ Se autoevaluó':'⏳ Sin autoevaluar'}</div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'#7a9ab5' }}><X size={18}/></button>
        </div>

        {/* Árbitro evaluado */}
        <div style={{ display:'flex', alignItems:'center', gap:'12px', background:'#111827', border:'1px solid #1e2d3d', borderRadius:'12px', padding:'14px', marginBottom:'16px' }}>
          <div style={{ width:'48px', height:'48px', borderRadius:'50%', overflow:'hidden', background:'#1e2d3d', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
            {arbEval?.photo_face_url||arbEval?.photo_url?<img src={arbEval.photo_face_url||arbEval.photo_url} style={{ width:'100%', height:'100%', objectFit:'cover' }}/>:<span style={{ fontSize:'1.2rem' }}>👤</span>}
          </div>
          <div style={{ flex:1 }}>
            <div style={{ fontWeight:'700', fontSize:'.95rem', color:'#e8f4fd' }}>{arbEval?.name}</div>
            <div style={{ fontSize:'.7rem', color:'#7a9ab5' }}>Árbitro evaluado</div>
          </div>
          {interp && (
            <div style={{ textAlign:'center' }}>
              <div style={{ fontSize:'1.8rem', fontWeight:'900', color:interp.color }}>{promTotal}</div>
              <div style={{ fontSize:'.6rem', color:interp.color, fontWeight:'700' }}>/ 50 · {interp.label}</div>
            </div>
          )}
        </div>

        {/* Autoevaluación — visible solo para el líder */}
        {respuestas.filter(r=>r.es_autoevaluacion).map(r=>{
          const interp2 = getInterpretacion(r.total||0)
          return (
            <div key={r.id} style={{ background:'rgba(153,85,255,.06)', border:'1px solid rgba(153,85,255,.3)', borderRadius:'12px', padding:'12px 14px', marginBottom:'14px' }}>
              <div style={{ fontSize:'.72rem', fontWeight:'700', color:'#9955ff', marginBottom:'8px' }}>🪞 AUTOEVALUACIÓN del árbitro</div>
              <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'8px' }}>
                <div style={{ flex:1 }}>
                  <div style={{ display:'flex', gap:'4px', flexWrap:'wrap' }}>
                    {PREGUNTAS.map(p=>(
                      <span key={p.key} title={p.label}
                        style={{ fontSize:'.65rem', color:r[p.key]>=4?'#1e8e3e':r[p.key]>=3?'#f9a825':'#d93025', background:'#1e2d3d', borderRadius:'4px', padding:'1px 5px' }}>
                        {r[p.key]}
                      </span>
                    ))}
                  </div>
                  {r.asignaria_partidos && <div style={{ fontSize:'.65rem', color:'#7a9ab5', marginTop:'4px' }}>¿Se asignaría partidos? <b style={{ color:'#9955ff' }}>{r.asignaria_partidos}</b></div>}
                  {r.fortaleza  && <div style={{ fontSize:'.72rem', color:'#e8f4fd', marginTop:'4px' }}>💪 <b>Fortaleza:</b> {r.fortaleza}</div>}
                  {r.mejora     && <div style={{ fontSize:'.72rem', color:'#e8f4fd', marginTop:'2px' }}>📈 <b>Mejora:</b> {r.mejora}</div>}
                  {r.comentarios&& <div style={{ fontSize:'.72rem', color:'#e8f4fd', marginTop:'2px' }}>💬 {r.comentarios}</div>}
                </div>
                <div style={{ textAlign:'center', flexShrink:0 }}>
                  <div style={{ fontSize:'1.3rem', fontWeight:'900', color:interp2.color }}>{r.total}</div>
                  <div style={{ fontSize:'.6rem', color:'#7a9ab5' }}>/50</div>
                </div>
              </div>
            </div>
          )
        })}

        {/* Resultados individuales anónimos (excluye autoevaluación) */}
        <div style={{ marginBottom:'16px' }}>
          <div style={{ fontSize:'.72rem', fontWeight:'700', color:'#7a9ab5', marginBottom:'10px', textTransform:'uppercase', letterSpacing:'.08em' }}>Votaciones individuales (anónimas)</div>
          {respuestas.filter(r=>!r.es_autoevaluacion).length===0 ? (
            <div style={{ textAlign:'center', padding:'20px', color:'#7a9ab5', fontSize:'.85rem' }}>Sin respuestas aún</div>
          ) : respuestas.filter(r=>!r.es_autoevaluacion).map((r,i)=>{
            const interp2 = getInterpretacion(r.total||0)
            return (
              <div key={r.id} style={{ background:'#111827', border:'1px solid #1e2d3d', borderRadius:'10px', padding:'10px 14px', marginBottom:'6px', display:'flex', alignItems:'center', gap:'10px' }}>
                <div style={{ width:'32px', height:'32px', borderRadius:'50%', background:'#1e2d3d', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:'700', color:'#7a9ab5', fontSize:'.82rem' }}>
                  A{i+1}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ display:'flex', gap:'4px', flexWrap:'wrap' }}>
                    {PREGUNTAS.map(p=>(
                      <span key={p.key} title={p.label}
                        style={{ fontSize:'.65rem', color: r[p.key]>=4?'#1e8e3e':r[p.key]>=3?'#f9a825':'#d93025', background:'#1e2d3d', borderRadius:'4px', padding:'1px 5px' }}>
                        {r[p.key]}
                      </span>
                    ))}
                  </div>
                  {r.asignaria_partidos && <div style={{ fontSize:'.65rem', color:'#7a9ab5', marginTop:'3px' }}>¿Asignaría partidos? <b style={{ color:'#e8f4fd' }}>{r.asignaria_partidos}</b></div>}
                </div>
                <div style={{ textAlign:'center', flexShrink:0 }}>
                  <div style={{ fontSize:'1.1rem', fontWeight:'900', color:interp2.color }}>{r.total}</div>
                  <div style={{ fontSize:'.58rem', color:'#7a9ab5' }}>/50</div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Promedio por criterio */}
        <div style={{ marginBottom:'16px' }}>
          <div style={{ fontSize:'.72rem', fontWeight:'700', color:'#7a9ab5', marginBottom:'10px', textTransform:'uppercase', letterSpacing:'.08em' }}>Promedio global por criterio</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'6px' }}>
            {promPorPregunta.map(p=>(
              <div key={p.key} style={{ background:'#111827', border:'1px solid #1e2d3d', borderRadius:'8px', padding:'8px 10px', display:'flex', alignItems:'center', gap:'8px' }}>
                <div style={{ flex:1, fontSize:'.72rem', color:'#b0c4d8' }}>{p.label}</div>
                <div style={{ fontWeight:'900', color: parseFloat(p.promedio)>=4?'#1e8e3e':parseFloat(p.promedio)>=3?'#f9a825':'#d93025', fontSize:'.95rem' }}>{p.promedio}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ¿Asignaría partidos? */}
        {total>0 && (
          <div style={{ background:'#111827', border:'1px solid #1e2d3d', borderRadius:'10px', padding:'12px 14px', marginBottom:'16px' }}>
            <div style={{ fontSize:'.72rem', fontWeight:'700', color:'#7a9ab5', marginBottom:'8px' }}>¿Le asignarías partidos importantes?</div>
            <div style={{ display:'flex', gap:'8px' }}>
              {[{l:'Sí',v:siCount,c:'#1e8e3e'},{l:'No',v:noCount,c:'#d93025'},{l:'Depende',v:depCount,c:'#f9a825'}].map(x=>(
                <div key={x.l} style={{ flex:1, textAlign:'center', background:'#0d1117', borderRadius:'8px', padding:'8px' }}>
                  <div style={{ fontSize:'1.3rem', fontWeight:'900', color:x.c }}>{x.v}</div>
                  <div style={{ fontSize:'.68rem', color:'#7a9ab5' }}>{x.l}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Comentarios abiertos */}
        {respuestas.some(r=>r.fortaleza||r.mejora||r.comentarios) && (
          <div style={{ marginBottom:'16px' }}>
            <div style={{ fontSize:'.72rem', fontWeight:'700', color:'#7a9ab5', marginBottom:'8px', textTransform:'uppercase', letterSpacing:'.08em' }}>Comentarios anónimos</div>
            {respuestas.filter(r=>r.fortaleza||r.mejora||r.comentarios).map((r,i)=>(
              <div key={r.id} style={{ background:'#111827', border:'1px solid #1e2d3d', borderRadius:'8px', padding:'10px 12px', marginBottom:'6px' }}>
                <div style={{ fontSize:'.65rem', color:'#f9a825', fontWeight:'700', marginBottom:'4px' }}>Árbitro {i+1}</div>
                {r.fortaleza  && <div style={{ fontSize:'.75rem', color:'#e8f4fd', marginBottom:'3px' }}>💪 <b>Fortaleza:</b> {r.fortaleza}</div>}
                {r.mejora     && <div style={{ fontSize:'.75rem', color:'#e8f4fd', marginBottom:'3px' }}>📈 <b>Mejora:</b> {r.mejora}</div>}
                {r.comentarios&& <div style={{ fontSize:'.75rem', color:'#e8f4fd' }}>💬 {r.comentarios}</div>}
              </div>
            ))}
          </div>
        )}

        {/* Quiénes no votaron — solo el líder lo ve */}
        <div style={{ background:'rgba(217,48,37,.06)', border:'1px solid rgba(217,48,37,.2)', borderRadius:'10px', padding:'12px 14px' }}>
          <div style={{ fontSize:'.72rem', fontWeight:'700', color:'#d93025', marginBottom:'8px' }}>⏳ Pendientes por votar ({sinVotar.length})</div>
          {sinVotar.length===0 ? (
            <div style={{ fontSize:'.78rem', color:'#1e8e3e' }}>✅ Todos votaron</div>
          ) : sinVotar.map(v=>(
            <div key={v.id} style={{ fontSize:'.78rem', color:'#e8f4fd', marginBottom:'3px' }}>• {v.name}</div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function EncuestaArbitrosPage() {
  const navigate   = useNavigate()
  const [user,      setUser]      = useState(null)
  const [lider,     setLider]     = useState(null)
  const [arbitros,  setArbitros]  = useState([])
  const [encuestas, setEncuestas] = useState([])
  const [loading,   setLoading]   = useState(true)
  const [esLider,   setEsLider]   = useState(false)
  const [modalNueva,setModalNueva]= useState(false)
  const [modalVotar,setModalVotar]= useState(null)
  const [modalRes,  setModalRes]  = useState(null)
  const [misVotos,  setMisVotos]  = useState(new Set())
  const [msg,       setMsg]       = useState(null)

  useEffect(()=>{ fetchTodo() },[])

  async function fetchTodo() {
    setLoading(true)
    const { data:{user:u} } = await supabase.auth.getUser()
    setUser(u)
    if (!u) { navigate('/jugador/login'); return }
    const { data:p } = await supabase.from('players').select('*').eq('user_id', u.id).single()
    setLider(p)
    setEsLider(p?.es_arbitro_lider||false)
    await Promise.all([fetchArbitros(), fetchEncuestas(p?.id)])
    setLoading(false)
  }

  async function fetchArbitros() {
    const { data } = await supabase.from('players').select('id,name,photo_url,photo_face_url,es_arbitro,es_arbitro_lider,rol').or('rol.eq.arbitro,es_arbitro.eq.true')
    setArbitros(data||[])
  }

  async function fetchEncuestas(playerId) {
    const { data } = await supabase.from('encuestas_arbitros')
      .select('*, arbitro_evaluado:arbitro_evaluado_id(id,name,photo_url,photo_face_url)')
      .order('created_at',{ascending:false})
    setEncuestas(data||[])
    // Ver en cuáles ya voté
    if (playerId) {
      const { data:votos } = await supabase.from('encuesta_respuestas').select('encuesta_id').eq('votante_id', playerId)
      setMisVotos(new Set((votos||[]).map(v=>v.encuesta_id)))
    }
  }

  function showMsgFn(t,type='ok') { setMsg({text:t,type}); setTimeout(()=>setMsg(null),3000) }

  if (loading) return <div style={{ minHeight:'100vh',background:'#07070e',display:'flex',alignItems:'center',justifyContent:'center',color:'#00ddd0' }}>Cargando...</div>

  const encuestasActivas  = encuestas.filter(e=>e.activa && new Date(e.cierre_at)>new Date())
  const encuestasCerradas = encuestas.filter(e=>!e.activa || new Date(e.cierre_at)<=new Date())

  return (
    <div style={{ minHeight:'100vh', background:'#07070e', fontFamily:'system-ui,sans-serif', color:'#e8f4fd', paddingBottom:'40px' }}>
      {msg && <div style={{ position:'fixed', top:'20px', right:'20px', zIndex:600, padding:'12px 20px', background:msg.type==='ok'?'#e6f4ea':'#fce8e6', color:msg.type==='ok'?'#1e8e3e':'#d93025', borderRadius:'10px', fontWeight:'600', boxShadow:'0 4px 16px rgba(0,0,0,.3)' }}>{msg.text}</div>}
      {modalNueva && <ModalCrearEncuesta arbitros={arbitros} liderId={lider?.id} onClose={()=>setModalNueva(false)} onCreada={()=>{ fetchEncuestas(lider?.id); showMsgFn('Encuesta creada ✓') }}/>}
      {modalVotar && <ModalVotar encuesta={modalVotar} votanteId={lider?.id} onClose={()=>setModalVotar(null)} onVotado={()=>{ fetchEncuestas(lider?.id); showMsgFn('Voto enviado ✓ — anónimo') }}/>}
      {modalRes   && <ModalResultados encuesta={modalRes} arbitros={arbitros} votantes={arbitros} onClose={()=>setModalRes(null)}/>}

      {/* Header */}
      <div style={{ background:'#0d1117', borderBottom:'0.5px solid #1e2d3d', padding:'12px 16px', display:'flex', alignItems:'center', gap:'12px', position:'sticky', top:0, zIndex:50 }}>
        <button onClick={()=>navigate(-1)} style={{ background:'none', border:'1px solid #1e2d3d', borderRadius:'8px', padding:'6px 8px', cursor:'pointer', color:'#7a9ab5', display:'flex' }}>
          <ArrowLeft size={18}/>
        </button>
        <div style={{ flex:1 }}>
          <div style={{ fontWeight:'700', fontSize:'.95rem', color:'#e8f4fd' }}>📝 Evaluación entre árbitros</div>
          <div style={{ fontSize:'.7rem', color:'#7a9ab5' }}>Anónima · 10 criterios · máx 50 pts</div>
        </div>
        {esLider && (
          <button onClick={()=>setModalNueva(true)}
            style={{ padding:'7px 14px', background:'#1a73e8', border:'none', borderRadius:'8px', cursor:'pointer', color:'#fff', fontSize:'.82rem', fontWeight:'700' }}>
            + Nueva
          </button>
        )}
      </div>

      <div style={{ maxWidth:'640px', margin:'0 auto', padding:'16px' }}>

        {/* Encuestas activas */}
        {encuestasActivas.length>0 && (
          <div style={{ marginBottom:'20px' }}>
            <div style={{ fontSize:'.78rem', fontWeight:'700', color:'#f9a825', marginBottom:'10px', display:'flex', alignItems:'center', gap:'6px' }}>
              <Clock size={14}/> ABIERTAS ({encuestasActivas.length})
            </div>
            {encuestasActivas.map(e=>{
              const yaVote    = misVotos.has(e.id)
              const esEvaluado= e.arbitro_evaluado_id === lider?.id
              const arb       = e.arbitro_evaluado
              return (
                <div key={e.id} style={{ background:'#111827', border:`1px solid ${yaVote?'rgba(30,142,62,.3)':'rgba(249,168,37,.3)'}`, borderRadius:'14px', padding:'16px', marginBottom:'10px' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'12px' }}>
                    <div style={{ width:'44px', height:'44px', borderRadius:'50%', overflow:'hidden', background:'#1e2d3d', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                      {arb?.photo_face_url||arb?.photo_url?<img src={arb.photo_face_url||arb.photo_url} style={{ width:'100%', height:'100%', objectFit:'cover' }}/>:<span style={{ fontSize:'1.1rem' }}>👤</span>}
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:'700', fontSize:'.92rem', color:'#e8f4fd' }}>{e.titulo}</div>
                      <div style={{ fontSize:'.7rem', color:'#7a9ab5', marginTop:'2px' }}>Evaluando a: <b style={{ color:'#00ddd0' }}>{esEvaluado?'Ti mismo (no puedes votar)':arb?.name}</b></div>
                    </div>
                    <Cronometro cierreAt={e.cierre_at}/>
                  </div>
                  <div style={{ display:'flex', gap:'8px' }}>
                    {!esEvaluado && !yaVote && (
                      <button onClick={()=>setModalVotar(e)}
                        style={{ flex:1, padding:'9px', background:'#1a73e8', border:'none', borderRadius:'8px', cursor:'pointer', color:'#fff', fontWeight:'700', fontSize:'.85rem' }}>
                        🗳️ Votar (anónimo)
                      </button>
                    )}
                    {!esEvaluado && yaVote && (
                      <div style={{ flex:1, padding:'9px', background:'rgba(30,142,62,.1)', border:'1px solid rgba(30,142,62,.3)', borderRadius:'8px', color:'#1e8e3e', fontWeight:'700', fontSize:'.85rem', textAlign:'center' }}>
                        ✅ Ya votaste
                      </div>
                    )}
                    {esEvaluado && !yaVote && (
                      <button onClick={()=>setModalVotar({...e, _esAuto:true})}
                        style={{ flex:1, padding:'9px', background:'rgba(153,85,255,.1)', border:'1px solid rgba(153,85,255,.3)', borderRadius:'8px', cursor:'pointer', color:'#9955ff', fontWeight:'700', fontSize:'.85rem' }}>
                        🪞 Autoevaluarme
                      </button>
                    )}
                    {esEvaluado && yaVote && (
                      <div style={{ flex:1, padding:'9px', background:'rgba(153,85,255,.08)', border:'1px solid rgba(153,85,255,.2)', borderRadius:'8px', color:'#9955ff', fontSize:'.82rem', textAlign:'center', fontWeight:'600' }}>
                        ✅ Ya te autoevaluaste
                      </div>
                    )}
                    {esLider && (
                      <button onClick={()=>setModalRes(e)}
                        style={{ padding:'9px 14px', background:'rgba(249,168,37,.1)', border:'1px solid rgba(249,168,37,.3)', borderRadius:'8px', cursor:'pointer', color:'#f9a825', fontSize:'.82rem', fontWeight:'700' }}>
                        Ver resultados
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Encuestas cerradas */}
        {encuestasCerradas.length>0 && (
          <div>
            <div style={{ fontSize:'.78rem', fontWeight:'700', color:'#7a9ab5', marginBottom:'10px' }}>CERRADAS ({encuestasCerradas.length})</div>
            {encuestasCerradas.map(e=>{
              const arb = e.arbitro_evaluado
              return (
                <div key={e.id} style={{ background:'#111827', border:'1px solid #1e2d3d', borderRadius:'12px', padding:'14px 16px', marginBottom:'8px', display:'flex', alignItems:'center', gap:'12px', opacity:.75 }}>
                  <div style={{ width:'36px', height:'36px', borderRadius:'50%', overflow:'hidden', background:'#1e2d3d', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                    {arb?.photo_face_url||arb?.photo_url?<img src={arb.photo_face_url||arb.photo_url} style={{ width:'100%', height:'100%', objectFit:'cover' }}/>:<span>👤</span>}
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:'600', fontSize:'.88rem', color:'#e8f4fd' }}>{e.titulo}</div>
                    <div style={{ fontSize:'.68rem', color:'#7a9ab5' }}>Cerrada · {new Date(e.cierre_at).toLocaleDateString('es-CO')}</div>
                  </div>
                  {esLider && (
                    <button onClick={()=>setModalRes(e)}
                      style={{ padding:'6px 12px', background:'none', border:'1px solid #1e2d3d', borderRadius:'7px', cursor:'pointer', color:'#7a9ab5', fontSize:'.75rem' }}>
                      Ver resultados
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {encuestas.length===0 && (
          <div style={{ textAlign:'center', padding:'60px 20px', color:'#7a9ab5' }}>
            <div style={{ fontSize:'3rem', marginBottom:'12px' }}>📝</div>
            <div style={{ fontWeight:'700', fontSize:'1rem', marginBottom:'6px' }}>Sin encuestas</div>
            <div style={{ fontSize:'.85rem' }}>{esLider?'Crea una nueva encuesta con el botón +':'El árbitro líder creará encuestas de evaluación'}</div>
          </div>
        )}
      </div>
    </div>
  )
}
