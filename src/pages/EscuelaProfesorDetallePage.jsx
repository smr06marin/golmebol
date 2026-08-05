import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import EscuelaPageHeader from '../components/EscuelaPageHeader'
import EscuelaFeatureCard from '../components/EscuelaFeatureCard'
import EscuelaSheetModal from '../components/EscuelaSheetModal'
import { IdCard, Trophy, Star } from 'lucide-react'

const S = {
  navy: '#07070e', surface: '#0d1117', card: '#111827', card2: '#1a2234',
  border: '#1e2d3d', green: '#22c55e', greenDim: 'rgba(34,197,94,.14)',
  gold: '#f9a825', text: '#e8f4fd', text2: '#b8d4e8', muted: '#7a9ab5',
}

// Mismas fotos de fondo tenues que se usan en el resto del portal de escuela.
const IMG_DATOS = 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&q=60'
const IMG_VIDA  = 'https://images.unsplash.com/photo-1529900748604-07564a03e7a6?w=800&q=60'
const IMG_EVAL  = 'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=800&q=60'

const inp = { width:'100%', background:S.card2, border:`1px solid ${S.border}`, borderRadius:'10px', padding:'10px 13px', color:S.text, fontSize:'.85rem', outline:'none', boxSizing:'border-box' }
const lbl = { fontSize:'.7rem', fontWeight:'600', color:S.muted, display:'block', marginBottom:'4px', textTransform:'uppercase', letterSpacing:'.05em' }

const POSICIONES = ['Portero','Defensa','Mediocampista','Delantero','Cierre','Ala','Pívot']
const STAT_KEYS = ['partidos_jugados_prof','partidos_ganados_prof','partidos_empatados_prof','partidos_perdidos_prof']
const STAT_LABELS = {
  partidos_jugados_prof:'Partidos jugados', partidos_ganados_prof:'Ganados',
  partidos_empatados_prof:'Empatados', partidos_perdidos_prof:'Perdidos',
}
const TORNEO_STAT_KEYS = ['torneos_jugados_prof','torneos_campeon_prof','torneos_subcampeon_prof','torneos_tercero_prof']
const TORNEO_STAT_LABELS = { torneos_jugados_prof:'Torneos dirigidos', torneos_campeon_prof:'Campeón', torneos_subcampeon_prof:'Subcampeón', torneos_tercero_prof:'Tercer puesto' }

const EVAL_KEYS = ['puntualidad','conocimiento_tecnico','comunicacion','liderazgo','disciplina','compromiso']
const EVAL_LABELS = {
  puntualidad:'Puntualidad', conocimiento_tecnico:'Conocimiento técnico', comunicacion:'Comunicación',
  liderazgo:'Liderazgo', disciplina:'Disciplina', compromiso:'Compromiso',
}
const EVAL_VACIA = { puntualidad:'', conocimiento_tecnico:'', comunicacion:'', liderazgo:'', disciplina:'', compromiso:'', comentario:'' }

function promedioEval(ev) {
  const vals = EVAL_KEYS.map(k => ev[k]).filter(v => v != null)
  if (vals.length === 0) return null
  return (vals.reduce((a, b) => a + Number(b), 0) / vals.length).toFixed(1)
}

function FilaDato({ label, valor }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', gap:10, background:S.card2, borderRadius:8, padding:'8px 12px' }}>
      <span style={{ fontSize:'.72rem', color:S.muted }}>{label}</span>
      <span style={{ fontSize:'.78rem', fontWeight:700, textAlign:'right' }}>{valor}</span>
    </div>
  )
}

// Perfil individual de un profesor: su "vida futbolística" (partidos jugados,
// ganados, empatados, perdidos, goles, equipos, etc.) y el historial de
// evaluaciones que le hace el coordinador (escala 1-10 por criterio, con
// fecha y comentario). El coordinador puede editar todo; un profesor viendo
// su propio perfil solo puede consultarlo.
export default function EscuelaProfesorDetallePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [viewer, setViewer] = useState(null)
  const [escuela, setEscuela] = useState(null)
  const [prof, setProf] = useState(null)
  const [evaluaciones, setEvaluaciones] = useState([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')
  const [modalAbierto, setModalAbierto] = useState(null) // 'datos' | 'vida' | 'evaluacion' | null
  const [showEvalForm, setShowEvalForm] = useState(false)
  const [nuevaEval, setNuevaEval] = useState(EVAL_VACIA)
  const [guardandoEval, setGuardandoEval] = useState(false)

  useEffect(() => { fetchTodo() }, [id])

  async function fetchTodo() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { navigate('/jugador/login'); return }
    const { data: p } = await supabase.from('players').select('*').eq('user_id', user.id).single()
    if (!p || !(p.rol === 'profesor' || p.es_profesor || p.es_profesor_coordinador)) { navigate('/jugador'); return }
    if (!p.escuela_id) { navigate('/escuela'); return }
    // Cada profesor puede ver su propio perfil; el de los demás solo el coordinador.
    if (p.id !== id && !p.es_profesor_coordinador) { navigate('/escuela'); return }
    setViewer(p)

    const { data: esc } = await supabase.from('teams').select('*').eq('id', p.escuela_id).single()
    setEscuela(esc || null)

    const { data: target } = await supabase.from('players').select('*').eq('id', id).eq('escuela_id', p.escuela_id).maybeSingle()
    if (!target) { navigate('/escuela/profesores'); return }
    setProf(target)

    const { data: evs } = await supabase.from('escuela_profesor_evaluaciones').select('*').eq('profesor_id', id).order('fecha', { ascending:false })
    setEvaluaciones(evs || [])
    setLoading(false)
  }

  const esCoordinador = !!viewer?.es_profesor_coordinador

  function showMsg(t) { setMsg(t); setTimeout(() => setMsg(''), 2200) }

  async function handleGuardarCampo(campo, valor) {
    setProf(pr => ({ ...pr, [campo]: valor }))
    await supabase.from('players').update({ [campo]: valor }).eq('id', id)
    showMsg('Guardado')
  }

  async function handleGuardarEval() {
    setGuardandoEval(true)
    const payload = {
      profesor_id: id, evaluador_id: viewer.id,
      ...Object.fromEntries(EVAL_KEYS.map(k => [k, nuevaEval[k] === '' ? null : Number(nuevaEval[k])])),
      comentario: nuevaEval.comentario.trim() || null,
    }
    const { data, error } = await supabase.from('escuela_profesor_evaluaciones').insert(payload).select().single()
    setGuardandoEval(false)
    if (!error && data) {
      setEvaluaciones(e => [data, ...e])
      setNuevaEval(EVAL_VACIA)
      setShowEvalForm(false)
      showMsg('Evaluación guardada')
    }
  }

  if (loading) return (
    <div style={{ minHeight:'100vh', background:S.navy, display:'flex', alignItems:'center', justifyContent:'center', color:S.green, fontSize:'.9rem' }}>Cargando...</div>
  )
  if (!prof) return null

  const conPromedio = evaluaciones.map(ev => promedioEval(ev)).filter(v => v != null)
  const promedioGeneral = conPromedio.length > 0
    ? (conPromedio.reduce((a, b) => a + Number(b), 0) / conPromedio.length).toFixed(1)
    : null

  return (
    <div style={{ minHeight:'100vh', background:S.navy, fontFamily:'system-ui,sans-serif', color:S.text, paddingBottom:'40px' }}>
      <EscuelaPageHeader backTo="/escuela/profesores" logoUrl={prof.photo_face_url || prof.photo_url || escuela?.logo_url}
        kicker="PROFESORES" titulo={prof.name}
        subtitulo={prof.es_profesor_coordinador ? '👑 Coordinador' : 'Profesor'}/>

      <div style={{ maxWidth:'560px', margin:'0 auto', padding:'20px 16px' }}>
        {msg && <div style={{ background:S.greenDim, color:S.green, borderRadius:8, padding:'8px 12px', fontSize:'.78rem', marginBottom:14, textAlign:'center' }}>{msg}</div>}

        <div style={{ fontSize:'.72rem', color:S.muted, marginBottom:10 }}>
          {esCoordinador ? 'Toca una tarjeta para ver el detalle o editar.' : 'Tu vida futbolística y tus evaluaciones.'}
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:'10px', marginBottom:'16px' }}>
          <EscuelaFeatureCard onClick={() => setModalAbierto('datos')} bg={IMG_DATOS}
            icon={<IdCard size={24} color={S.green}/>} title="Datos básicos"
            desc={prof.posicion_prof || 'Sin definir'}/>
          <EscuelaFeatureCard onClick={() => setModalAbierto('vida')} bg={IMG_VIDA}
            icon={<Trophy size={24} color={S.green}/>} title="Vida futbolística"
            desc={`${prof.partidos_jugados_prof || 0} PJ · ${prof.partidos_ganados_prof || 0}G ${prof.partidos_empatados_prof || 0}E ${prof.partidos_perdidos_prof || 0}P`}/>
          <EscuelaFeatureCard onClick={() => setModalAbierto('evaluacion')} bg={IMG_EVAL} accent={S.gold}
            icon={<Star size={24} color={S.gold}/>} title="Evaluación"
            desc={promedioGeneral ? `${promedioGeneral}/10 · ${evaluaciones.length} eval.` : 'Sin evaluar'}/>
        </div>

        {modalAbierto === 'datos' && (
          <EscuelaSheetModal titulo="Datos básicos" onClose={() => setModalAbierto(null)}>
            {esCoordinador ? (
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                <div>
                  <label style={lbl}>Posición</label>
                  <select value={prof.posicion_prof || ''} onChange={e => handleGuardarCampo('posicion_prof', e.target.value)} style={inp}>
                    <option value="">Sin definir</option>
                    {POSICIONES.map(p => <option key={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>Años jugando fútbol</label>
                  <input type="number" min="0" step="0.5" value={prof.anios_jugando_prof ?? ''}
                    onChange={e => setProf(pr => ({ ...pr, anios_jugando_prof:e.target.value }))}
                    onBlur={e => handleGuardarCampo('anios_jugando_prof', e.target.value === '' ? null : Number(e.target.value))}
                    style={inp}/>
                </div>
                <div style={{ gridColumn:'1/-1' }}>
                  <label style={lbl}>Equipos en los que ha jugado</label>
                  <input value={prof.equipos_prof || ''} onChange={e => setProf(pr => ({ ...pr, equipos_prof:e.target.value }))}
                    onBlur={e => handleGuardarCampo('equipos_prof', e.target.value.trim() || null)}
                    style={inp} placeholder="Ej: Tigres del Quindío, Deportes Quindío..."/>
                </div>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                <FilaDato label="Posición" valor={prof.posicion_prof || 'Sin definir'}/>
                <FilaDato label="Años jugando fútbol" valor={prof.anios_jugando_prof ?? 'Sin definir'}/>
                <FilaDato label="Equipos" valor={prof.equipos_prof || 'Sin definir'}/>
              </div>
            )}
          </EscuelaSheetModal>
        )}

        {modalAbierto === 'vida' && (
          <EscuelaSheetModal titulo="Vida futbolística" subtitulo={esCoordinador ? 'Partidos jugados/ganados/empatados/perdidos se suman solos al terminar cada Día de partido que dirija. Los demás campos son editables.' : undefined} onClose={() => setModalAbierto(null)}>
            {esCoordinador ? (
              <>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12 }}>
                  {STAT_KEYS.map(k => (
                    <div key={k}>
                      <label style={lbl}>{STAT_LABELS[k]}</label>
                      <input type="number" min="0" value={prof[k] ?? 0}
                        onChange={e => setProf(pr => ({ ...pr, [k]: e.target.value }))}
                        onBlur={e => handleGuardarCampo(k, Number(e.target.value) || 0)}
                        style={inp}/>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize:'.7rem', fontWeight:700, color:S.muted, marginBottom:8, textTransform:'uppercase' }}>Torneos dirigidos</div>
                <div style={{ fontSize:9.5, color:S.muted, marginBottom:8 }}>Se suman solos cuando un torneo que dirigió termina (campeón, subcampeón o tercer puesto).</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12 }}>
                  {TORNEO_STAT_KEYS.map(k => (
                    <div key={k}>
                      <label style={lbl}>{TORNEO_STAT_LABELS[k]}</label>
                      <input type="number" min="0" value={prof[k] ?? 0}
                        onChange={e => setProf(pr => ({ ...pr, [k]: e.target.value }))}
                        onBlur={e => handleGuardarCampo(k, Number(e.target.value) || 0)}
                        style={inp}/>
                    </div>
                  ))}
                </div>
                <label style={lbl}>Logros / notas</label>
                <textarea value={prof.logros_prof || ''} onChange={e => setProf(pr => ({ ...pr, logros_prof:e.target.value }))}
                  onBlur={e => handleGuardarCampo('logros_prof', e.target.value.trim() || null)}
                  style={{ ...inp, minHeight:70, resize:'vertical' }} placeholder="Torneos ganados, reconocimientos, etc."/>
              </>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {STAT_KEYS.map(k => <FilaDato key={k} label={STAT_LABELS[k]} valor={prof[k] ?? 0}/>)}
                {TORNEO_STAT_KEYS.map(k => <FilaDato key={k} label={TORNEO_STAT_LABELS[k]} valor={prof[k] ?? 0}/>)}
                {prof.logros_prof && <FilaDato label="Logros / notas" valor={prof.logros_prof}/>}
              </div>
            )}
          </EscuelaSheetModal>
        )}

        {modalAbierto === 'evaluacion' && (
          <EscuelaSheetModal titulo="Evaluación del coordinador" subtitulo={esCoordinador ? undefined : 'Así te está evaluando tu coordinador.'} onClose={() => setModalAbierto(null)}>
            {promedioGeneral && (
              <div style={{ textAlign:'center', background:'rgba(249,168,37,.1)', border:`1px solid ${S.gold}44`, borderRadius:10, padding:14, marginBottom:14 }}>
                <div style={{ fontSize:'1.8rem', fontWeight:900, color:S.gold }}>{promedioGeneral}<span style={{ fontSize:'.9rem', color:S.muted }}>/10</span></div>
                <div style={{ fontSize:'.68rem', color:S.muted, marginTop:2 }}>Promedio de {evaluaciones.length} evaluación{evaluaciones.length === 1 ? '' : 'es'}</div>
              </div>
            )}

            {esCoordinador && (
              <div style={{ marginBottom:14 }}>
                <button onClick={() => setShowEvalForm(s => !s)} style={{ width:'100%', background:S.greenDim, border:`1px solid ${S.green}55`, color:S.green, borderRadius:8, padding:'9px', fontSize:'.8rem', fontWeight:700, cursor:'pointer' }}>
                  {showEvalForm ? 'Cancelar' : '+ Nueva evaluación'}
                </button>
                {showEvalForm && (
                  <div style={{ background:S.card2, borderRadius:10, padding:12, marginTop:10 }}>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:8 }}>
                      {EVAL_KEYS.map(k => (
                        <div key={k}>
                          <label style={lbl}>{EVAL_LABELS[k]}</label>
                          <input type="number" min="1" max="10" step="0.5" value={nuevaEval[k]}
                            onChange={e => setNuevaEval(v => ({ ...v, [k]: e.target.value }))} style={inp} placeholder="1-10"/>
                        </div>
                      ))}
                    </div>
                    <label style={lbl}>Comentario</label>
                    <textarea value={nuevaEval.comentario} onChange={e => setNuevaEval(v => ({ ...v, comentario: e.target.value }))}
                      style={{ ...inp, minHeight:60, resize:'vertical', marginBottom:10 }} placeholder="Observaciones sobre el desempeño..."/>
                    <button onClick={handleGuardarEval} disabled={guardandoEval}
                      style={{ width:'100%', padding:'9px', background:S.green, border:'none', borderRadius:8, cursor:'pointer', color:'#000', fontWeight:800, fontSize:'.8rem', opacity:guardandoEval?.7:1 }}>
                      {guardandoEval ? 'Guardando...' : 'Guardar evaluación'}
                    </button>
                  </div>
                )}
              </div>
            )}

            <div style={{ fontSize:'.7rem', fontWeight:700, color:S.muted, marginBottom:8, textTransform:'uppercase' }}>Historial</div>
            {evaluaciones.length === 0 ? (
              <div style={{ fontSize:'.78rem', color:S.muted, textAlign:'center', padding:'14px 0' }}>Todavía no hay evaluaciones.</div>
            ) : evaluaciones.map(ev => (
              <div key={ev.id} style={{ background:S.card2, borderRadius:10, padding:10, marginBottom:8 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                  <span style={{ fontSize:'.72rem', color:S.muted }}>{new Date(ev.fecha).toLocaleDateString('es-CO', { day:'2-digit', month:'long', year:'numeric' })}</span>
                  <span style={{ fontSize:'.82rem', fontWeight:800, color:S.gold }}>{promedioEval(ev) ?? '—'}/10</span>
                </div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:'4px 10px', marginBottom: ev.comentario ? 6 : 0 }}>
                  {EVAL_KEYS.filter(k => ev[k] != null).map(k => (
                    <span key={k} style={{ fontSize:'.66rem', color:S.text2 }}>{EVAL_LABELS[k]}: <b>{ev[k]}</b></span>
                  ))}
                </div>
                {ev.comentario && <div style={{ fontSize:'.74rem', color:S.text2, fontStyle:'italic' }}>"{ev.comentario}"</div>}
              </div>
            ))}
          </EscuelaSheetModal>
        )}
      </div>
    </div>
  )
}
