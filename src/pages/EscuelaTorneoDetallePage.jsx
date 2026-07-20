import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const S = {
  navy: '#07070e', surface: '#0d1117', card: '#111827', card2: '#1a2234',
  border: '#1e2d3d', cyan: '#00ddd0', cyanDim: 'rgba(0,221,208,.12)',
  gold: '#f9a825', text: '#e8f4fd', text2: '#b8d4e8', muted: '#7a9ab5',
}
const inp = { width:'100%', background:S.card2, border:`1px solid ${S.border}`, borderRadius:'10px', padding:'10px 13px', color:S.text, fontSize:'.85rem', outline:'none', boxSizing:'border-box' }
const lbl = { fontSize:'.7rem', fontWeight:'600', color:S.muted, display:'block', marginBottom:'4px', textTransform:'uppercase', letterSpacing:'.05em' }

export default function EscuelaTorneoDetallePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [profesor, setProfesor] = useState(null)
  const [torneo, setTorneo] = useState(null)
  const [partidos, setPartidos] = useState([])
  const [roster, setRoster] = useState([])
  const [premios, setPremios] = useState([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')

  const [showPremioForm, setShowPremioForm] = useState(false)
  const [nuevoPremio, setNuevoPremio] = useState({ jugador_id:'', nombre:'', emoji:'🏆', descripcion:'' })

  useEffect(() => { fetchTodo() }, [id])

  async function fetchTodo() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { navigate('/jugador/login'); return }
    const { data: p } = await supabase.from('players').select('*').eq('user_id', user.id).single()
    if (!p || !(p.rol === 'profesor' || p.es_profesor || p.es_profesor_coordinador)) { navigate('/jugador'); return }
    if (!p.escuela_id) { navigate('/escuela'); return }
    setProfesor(p)

    const { data: t } = await supabase.from('escuela_torneos').select('*').eq('id', id).eq('escuela_id', p.escuela_id).maybeSingle()
    if (!t) { navigate('/escuela/torneos'); return }
    setTorneo(t)

    const { data: parts } = await supabase.from('escuela_partidos').select('*').eq('torneo_id', id).order('fecha', { ascending:false })
    setPartidos(parts || [])

    const { data: tp } = await supabase.from('team_players').select('*, players(*)').eq('team_id', p.escuela_id)
    setRoster((tp || []).map(x => x.players).filter(Boolean).sort((a,b) => a.name.localeCompare(b.name)))

    const { data: prem } = await supabase.from('escuela_torneo_premios').select('*, jugador:jugador_id(name)').eq('torneo_id', id).order('created_at', { ascending:false })
    setPremios(prem || [])
    setLoading(false)
  }

  const esCoordinador = !!profesor?.es_profesor_coordinador

  function showMsg(t) { setMsg(t); setTimeout(() => setMsg(''), 2000) }

  async function handleGuardarCampo(campo, valor) {
    setTorneo(t => ({ ...t, [campo]: valor }))
    await supabase.from('escuela_torneos').update({ [campo]: valor, updated_at: new Date().toISOString() }).eq('id', id)
    showMsg('Guardado')
  }

  async function handleCrearPremio() {
    if (!nuevoPremio.jugador_id || !nuevoPremio.nombre.trim()) return
    const { data, error } = await supabase.from('escuela_torneo_premios')
      .insert({ torneo_id:id, ...nuevoPremio })
      .select('*, jugador:jugador_id(name)').single()
    if (!error && data) {
      setPremios(p => [data, ...p])
      setNuevoPremio({ jugador_id:'', nombre:'', emoji:'🏆', descripcion:'' })
      setShowPremioForm(false)
    }
  }

  async function handleEliminarPremio(premioId) {
    if (!confirm('¿Eliminar este premio?')) return
    await supabase.from('escuela_torneo_premios').delete().eq('id', premioId)
    setPremios(p => p.filter(x => x.id !== premioId))
  }

  async function handleEliminarTorneo() {
    if (!confirm('¿Eliminar este torneo? Los partidos vinculados quedan sin torneo, no se borran.')) return
    await supabase.from('escuela_torneos').delete().eq('id', id)
    navigate('/escuela/torneos')
  }

  if (loading) return (
    <div style={{ minHeight:'100vh', background:S.navy, display:'flex', alignItems:'center', justifyContent:'center', color:S.cyan, fontSize:'.9rem' }}>Cargando...</div>
  )
  if (!torneo) return null

  return (
    <div style={{ minHeight:'100vh', background:S.navy, fontFamily:'system-ui,sans-serif', color:S.text, paddingBottom:'40px' }}>
      <div style={{ background:S.surface, borderBottom:`0.5px solid ${S.border}`, padding:'16px 20px' }}>
        <div style={{ maxWidth:'560px', margin:'0 auto' }}>
          <button onClick={() => navigate('/escuela/torneos')} style={{ background:'none', border:`1px solid ${S.border}`, borderRadius:'8px', padding:'5px 12px', cursor:'pointer', color:S.muted, fontSize:'.75rem', marginBottom:'10px' }}>← Torneos</button>
          <div style={{ fontWeight:800, fontSize:'1.05rem' }}>{torneo.nombre}</div>
          {torneo.temporada && <div style={{ fontSize:'.72rem', color:S.muted, marginTop:2 }}>{torneo.temporada}</div>}
        </div>
      </div>

      <div style={{ maxWidth:'560px', margin:'0 auto', padding:'20px 16px' }}>
        {msg && <div style={{ background:S.cyanDim, color:S.cyan, borderRadius:8, padding:'8px 12px', fontSize:'.78rem', marginBottom:14, textAlign:'center' }}>{msg}</div>}

        <div style={{ background:S.card, border:`1px solid ${S.border}`, borderRadius:14, padding:16, marginBottom:14 }}>
          <div style={{ fontWeight:700, fontSize:'.88rem', marginBottom:12 }}>Estado del torneo</div>
          {esCoordinador ? (
            <>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
                <div>
                  <label style={lbl}>Estado</label>
                  <select value={torneo.estado} onChange={e => handleGuardarCampo('estado', e.target.value)} style={inp}>
                    <option value="en_curso">En curso</option>
                    <option value="finalizado">Finalizado</option>
                  </select>
                </div>
                <div>
                  <label style={lbl}>Fase actual</label>
                  <input defaultValue={torneo.fase_actual || ''} onBlur={e => handleGuardarCampo('fase_actual', e.target.value)} style={inp} placeholder="Ej: Cuartos de final"/>
                </div>
              </div>
              <div style={{ marginBottom:10 }}>
                <label style={lbl}>Resultado final</label>
                <input defaultValue={torneo.resultado_final || ''} onBlur={e => handleGuardarCampo('resultado_final', e.target.value)} style={inp} placeholder="Ej: Campeón, Subcampeón, Semifinalista..."/>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
                <div>
                  <label style={lbl}>Fecha de inicio</label>
                  <input type="date" defaultValue={torneo.fecha_inicio || ''} onBlur={e => handleGuardarCampo('fecha_inicio', e.target.value || null)} style={inp}/>
                </div>
                <div>
                  <label style={lbl}>Fecha de fin</label>
                  <input type="date" defaultValue={torneo.fecha_fin || ''} onBlur={e => handleGuardarCampo('fecha_fin', e.target.value || null)} style={inp}/>
                </div>
              </div>
              <div>
                <label style={lbl}>Observaciones</label>
                <textarea defaultValue={torneo.observaciones || ''} onBlur={e => handleGuardarCampo('observaciones', e.target.value)} style={{ ...inp, minHeight:60, resize:'vertical' }} placeholder="Notas sobre el torneo..."/>
              </div>
            </>
          ) : (
            <div style={{ fontSize:'.8rem', color:S.text2 }}>
              {torneo.fase_actual && <div>Fase: {torneo.fase_actual}</div>}
              {torneo.resultado_final && <div style={{ marginTop:4 }}>Resultado: {torneo.resultado_final}</div>}
              {!torneo.fase_actual && !torneo.resultado_final && <div style={{ color:S.muted }}>Sin información todavía.</div>}
            </div>
          )}
        </div>

        <div style={{ background:S.card, border:`1px solid ${S.border}`, borderRadius:14, padding:16, marginBottom:14 }}>
          <div style={{ fontWeight:700, fontSize:'.88rem', marginBottom:10 }}>Partidos de este torneo ({partidos.length})</div>
          {partidos.length === 0 ? (
            <div style={{ fontSize:'.78rem', color:S.muted }}>Todavía no hay partidos vinculados. Se vinculan desde "Día de partido" al crear uno nuevo.</div>
          ) : partidos.map(p => (
            <div key={p.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderBottom:`1px solid ${S.border}` }}>
              <div>
                <div style={{ fontSize:'.82rem', fontWeight:700 }}>vs {p.rival || 'Rival'}</div>
                <div style={{ fontSize:'.68rem', color:S.muted }}>{p.fecha} · {p.estado === 'finalizado' ? 'Finalizado' : p.estado === 'en_curso' ? 'En curso' : 'Pendiente'}</div>
              </div>
              {p.estado === 'finalizado' && <div style={{ fontWeight:900, color:S.cyan }}>{p.score_home} – {p.score_away}</div>}
            </div>
          ))}
        </div>

        <div style={{ background:S.card, border:`1px solid ${S.border}`, borderRadius:14, padding:16, marginBottom:14 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
            <div style={{ fontWeight:700, fontSize:'.88rem' }}>Premios individuales</div>
            {esCoordinador && (
              <button onClick={() => setShowPremioForm(s => !s)} style={{ background:S.cyanDim, border:`1px solid ${S.cyan}55`, color:S.cyan, borderRadius:8, padding:'5px 10px', fontSize:'.75rem', fontWeight:700, cursor:'pointer' }}>{showPremioForm ? 'Cancelar' : '+ Premio'}</button>
            )}
          </div>

          {showPremioForm && (
            <div style={{ background:S.card2, borderRadius:10, padding:12, marginBottom:12 }}>
              <div style={{ marginBottom:8 }}>
                <label style={lbl}>Jugador</label>
                <select value={nuevoPremio.jugador_id} onChange={e => setNuevoPremio(p => ({ ...p, jugador_id:e.target.value }))} style={inp}>
                  <option value="">Seleccionar...</option>
                  {roster.map(j => <option key={j.id} value={j.id}>{j.name}</option>)}
                </select>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'50px 1fr', gap:8, marginBottom:8 }}>
                <input value={nuevoPremio.emoji} onChange={e => setNuevoPremio(p => ({ ...p, emoji:e.target.value }))} style={{ ...inp, textAlign:'center' }}/>
                <input value={nuevoPremio.nombre} onChange={e => setNuevoPremio(p => ({ ...p, nombre:e.target.value }))} style={inp} placeholder="Ej: Goleador del torneo"/>
              </div>
              <input value={nuevoPremio.descripcion} onChange={e => setNuevoPremio(p => ({ ...p, descripcion:e.target.value }))} style={{ ...inp, marginBottom:10 }} placeholder="Descripción (opcional)"/>
              <button onClick={handleCrearPremio} style={{ width:'100%', padding:'9px', background:S.cyan, border:'none', borderRadius:8, cursor:'pointer', color:'#000', fontWeight:800, fontSize:'.8rem' }}>Agregar premio</button>
            </div>
          )}

          {premios.length === 0 ? (
            <div style={{ fontSize:'.78rem', color:S.muted }}>Todavía no hay premios individuales en este torneo.</div>
          ) : premios.map(p => (
            <div key={p.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 4px', borderBottom:`1px solid ${S.border}` }}>
              <span>{p.emoji}</span>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:'.8rem', fontWeight:700 }}>{p.jugador?.name}</div>
                <div style={{ fontSize:'.68rem', color:S.muted }}>{p.nombre}{p.descripcion ? ` · ${p.descripcion}` : ''}</div>
              </div>
              {esCoordinador && <button onClick={() => handleEliminarPremio(p.id)} style={{ background:'none', border:'none', color:S.muted, cursor:'pointer', fontSize:'.85rem' }}>🗑️</button>}
            </div>
          ))}
        </div>

        {esCoordinador && (
          <button onClick={handleEliminarTorneo} style={{ width:'100%', padding:'10px', background:'none', border:`1px solid #ff6b6b55`, borderRadius:10, cursor:'pointer', color:'#ff6b6b', fontSize:'.78rem' }}>Eliminar torneo</button>
        )}
      </div>
    </div>
  )
}
