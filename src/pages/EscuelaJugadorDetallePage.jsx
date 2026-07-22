import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import TarjetaEscuelaJugador from '../components/TarjetaEscuelaJugador'
import FichaEvolucion from '../components/FichaEvolucion'
import { CARD_DESIGNS } from '../components/card/designs/cardDesigns'

const S = {
  navy: '#07070e', surface: '#0d1117', card: '#111827', card2: '#1a2234',
  border: '#1e2d3d', cyan: '#00ddd0', cyanDim: 'rgba(0,221,208,.12)',
  gold: '#f9a825', text: '#e8f4fd', text2: '#b8d4e8', muted: '#7a9ab5',
}
const inp = { width:'100%', background:S.card2, border:`1px solid ${S.border}`, borderRadius:'10px', padding:'10px 13px', color:S.text, fontSize:'.85rem', outline:'none', boxSizing:'border-box' }
const lbl = { fontSize:'.7rem', fontWeight:'600', color:S.muted, display:'block', marginBottom:'4px', textTransform:'uppercase', letterSpacing:'.05em' }

const TIPOS_SANGRE = ['O+','O-','A+','A-','B+','B-','AB+','AB-']
const POSICIONES = ['Portero','Defensa','Mediocampista','Delantero','Cierre','Ala','Pívot']
const STAT_KEYS = ['goles_escuela','asistencias_escuela','amarillas_escuela','rojas_escuela','partidos_escuela','mvp_escuela']
const STAT_LABELS = { goles_escuela:'Goles', asistencias_escuela:'Asistencias', amarillas_escuela:'Amarillas', rojas_escuela:'Rojas', partidos_escuela:'Partidos', mvp_escuela:'MVP' }

export default function EscuelaJugadorDetallePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [profesor, setProfesor] = useState(null)
  const [escuela, setEscuela] = useState(null)
  const [jugador, setJugador] = useState(null)
  const [premios, setPremios] = useState([])
  const [premiosTorneo, setPremiosTorneo] = useState([])
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [subiendoFoto, setSubiendoFoto] = useState(false)
  const [msg, setMsg] = useState('')

  const [showPremioForm, setShowPremioForm] = useState(false)
  const [nuevoPremio, setNuevoPremio] = useState({ nombre:'', emoji:'🏆', tipo_stat:'goles_escuela', umbral:5, descripcion:'', card_type:'' })

  useEffect(() => { fetchTodo() }, [id])

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

    const { data: tp } = await supabase.from('team_players').select('*').eq('team_id', p.escuela_id).eq('player_id', id).maybeSingle()
    if (!tp) { navigate('/escuela/jugadores'); return }

    const { data: jug } = await supabase.from('players').select('*').eq('id', id).single()
    setJugador(jug)

    const { data: prem } = await supabase.from('escuela_premios').select('*').eq('escuela_id', p.escuela_id).order('umbral', { ascending:true })
    setPremios(prem || [])

    const { data: premTorneo } = await supabase.from('escuela_torneo_premios').select('*, torneo:torneo_id(nombre)').eq('jugador_id', id).order('created_at', { ascending:false })
    setPremiosTorneo(premTorneo || [])
    setLoading(false)
  }

  const esCoordinador = !!profesor?.es_profesor_coordinador

  function showMsg(t) { setMsg(t); setTimeout(() => setMsg(''), 2200) }

  async function handleGuardarCampo(campo, valor) {
    setJugador(j => ({ ...j, [campo]: valor }))
    await supabase.from('players').update({ [campo]: valor }).eq('id', id)
    showMsg('Guardado')
  }

  async function handleActivarAcceso() {
    const ti = (jugador.numero_cedula || '').trim()
    if (!ti) { showMsg('Falta la tarjeta de identidad'); return }
    const { data: yaExiste } = await supabase.from('players').select('id').eq('numero_cedula', ti).neq('id', id).maybeSingle()
    if (yaExiste) { showMsg('Ese número ya lo usa otra persona'); return }
    const email = `${ti}@golmebol.com`
    const { data: authData, error } = await supabase.auth.signUp({
      email, password: ti, options: { data: { player_id: id, cedula: ti } },
    })
    if (error) { showMsg('Error: ' + error.message); return }
    await supabase.from('players').update({ user_id: authData?.user?.id, es_jugador_escuela: true }).eq('id', id)
    setJugador(j => ({ ...j, user_id: authData?.user?.id, es_jugador_escuela: true }))
    showMsg('¡Acceso activado!')
  }

  async function handleFoto(file) {
    if (!file) return
    setSubiendoFoto(true)
    const ext = file.name.split('.').pop()
    const path = `fotos/${id}_cara.${ext}`
    const { error } = await supabase.storage.from('players').upload(path, file, { upsert:true })
    if (error) { showMsg('Error al subir foto'); setSubiendoFoto(false); return }
    const { data } = supabase.storage.from('players').getPublicUrl(path)
    await supabase.from('players').update({ photo_face_url: data.publicUrl }).eq('id', id)
    setJugador(j => ({ ...j, photo_face_url: data.publicUrl }))
    setSubiendoFoto(false)
    showMsg('Foto actualizada')
  }

  async function handleCrearPremio() {
    if (!nuevoPremio.nombre.trim()) return
    const { data, error } = await supabase.from('escuela_premios')
      .insert({ escuela_id: escuela.id, ...nuevoPremio, umbral: Number(nuevoPremio.umbral) || 1, card_type: nuevoPremio.card_type || null })
      .select().single()
    if (!error && data) {
      setPremios(p => [...p, data].sort((a,b) => a.umbral - b.umbral))
      setNuevoPremio({ nombre:'', emoji:'🏆', tipo_stat:'goles_escuela', umbral:5, descripcion:'', card_type:'' })
      setShowPremioForm(false)
    }
  }

  async function handleEliminarPremio(premioId) {
    if (!confirm('¿Eliminar este premio?')) return
    await supabase.from('escuela_premios').delete().eq('id', premioId)
    setPremios(p => p.filter(x => x.id !== premioId))
  }

  if (loading) return (
    <div style={{ minHeight:'100vh', background:S.navy, display:'flex', alignItems:'center', justifyContent:'center', color:S.cyan, fontSize:'.9rem' }}>Cargando...</div>
  )
  if (!jugador) return null

  return (
    <div style={{ minHeight:'100vh', background:S.navy, fontFamily:'system-ui,sans-serif', color:S.text, paddingBottom:'40px' }}>
      <div style={{ background:S.surface, borderBottom:`0.5px solid ${S.border}`, padding:'16px 20px' }}>
        <div style={{ maxWidth:'560px', margin:'0 auto' }}>
          <button onClick={() => navigate('/escuela/jugadores')} style={{ background:'none', border:`1px solid ${S.border}`, borderRadius:'8px', padding:'5px 12px', cursor:'pointer', color:S.muted, fontSize:'.75rem', marginBottom:'8px' }}>← Jugadores</button>
          <div style={{ fontWeight:800, fontSize:'1.05rem' }}>{jugador.name}</div>
        </div>
      </div>

      <div style={{ maxWidth:'560px', margin:'0 auto', padding:'20px 16px' }}>
        <TarjetaEscuelaJugador jugador={jugador} premios={premios} premiosTorneo={premiosTorneo}/>

        {!esCoordinador ? (
          <div style={{ textAlign:'center', color:S.muted, fontSize:'.78rem', marginTop:20 }}>Solo el profesor coordinador puede editar estos datos.</div>
        ) : (
          <div style={{ marginTop:24 }}>
            {msg && <div style={{ background:S.cyanDim, color:S.cyan, borderRadius:8, padding:'8px 12px', fontSize:'.78rem', marginBottom:14, textAlign:'center' }}>{msg}</div>}

            <div style={{ background:S.card, border:`1px solid ${S.border}`, borderRadius:14, padding:16, marginBottom:14 }}>
              <div style={{ fontWeight:700, fontSize:'.88rem', marginBottom:8 }}>Acceso del jugador</div>
              {jugador.user_id ? (
                <div style={{ fontSize:'.8rem', color:S.cyan }}>✅ Ya puede entrar con su tarjeta de identidad ({jugador.numero_cedula})</div>
              ) : jugador.numero_cedula ? (
                <div>
                  <div style={{ fontSize:'.72rem', color:S.muted, marginBottom:10 }}>Todavía no tiene acceso propio — puede entrar con su tarjeta de identidad ({jugador.numero_cedula}) una vez lo actives.</div>
                  <button onClick={handleActivarAcceso} style={{ width:'100%', padding:'9px', background:S.cyan, border:'none', borderRadius:8, cursor:'pointer', color:'#000', fontWeight:800, fontSize:'.8rem' }}>Activar acceso</button>
                </div>
              ) : (
                <div style={{ fontSize:'.72rem', color:S.muted }}>Agrégale un número de tarjeta de identidad para poder darle acceso.</div>
              )}
            </div>

            <div style={{ background:S.card, border:`1px solid ${S.border}`, borderRadius:14, padding:16, marginBottom:14 }}>
              <div style={{ fontWeight:700, fontSize:'.88rem', marginBottom:12 }}>Foto de perfil</div>
              <input type="file" accept="image/*" disabled={subiendoFoto} onChange={e => handleFoto(e.target.files[0] || null)} style={{ ...inp, padding:'8px' }}/>
              {subiendoFoto && <div style={{ fontSize:'.72rem', color:S.muted, marginTop:6 }}>Subiendo...</div>}
            </div>

            <div style={{ background:S.card, border:`1px solid ${S.border}`, borderRadius:14, padding:16, marginBottom:14 }}>
              <div style={{ fontWeight:700, fontSize:'.88rem', marginBottom:12 }}>Datos básicos</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                <div>
                  <label style={lbl}>Tipo de sangre</label>
                  <select value={jugador.tipo_sangre || ''} onChange={e => handleGuardarCampo('tipo_sangre', e.target.value)} style={inp}>
                    <option value="">Sin definir</option>
                    {TIPOS_SANGRE.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>Posición</label>
                  <select value={jugador.posicion || ''} onChange={e => handleGuardarCampo('posicion', e.target.value)} style={inp}>
                    <option value="">Sin definir</option>
                    {POSICIONES.map(p => <option key={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>Pie dominante</label>
                  <select value={jugador.pie_dominante || ''} onChange={e => handleGuardarCampo('pie_dominante', e.target.value)} style={inp}>
                    <option value="">Sin definir</option>
                    <option value="derecho">Derecho</option><option value="izquierdo">Izquierdo</option><option value="ambidiestro">Ambidiestro</option>
                  </select>
                </div>
                <div>
                  <label style={lbl}>Años jugando fútbol</label>
                  <input type="number" min="0" step="0.5" value={jugador.anios_jugando ?? ''}
                    onChange={e => setJugador(j => ({ ...j, anios_jugando:e.target.value }))}
                    onBlur={e => handleGuardarCampo('anios_jugando', e.target.value === '' ? null : Number(e.target.value))}
                    style={inp}/>
                </div>
              </div>
            </div>

            <div style={{ background:S.card, border:`1px solid ${S.border}`, borderRadius:14, padding:16, marginBottom:14 }}>
              <div style={{ fontWeight:700, fontSize:'.88rem', marginBottom:12 }}>Estadísticas (se actualizan solas al terminar cada partido, pero las puedes ajustar)</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                {STAT_KEYS.map(k => (
                  <div key={k}>
                    <label style={lbl}>{STAT_LABELS[k]}</label>
                    <input type="number" min="0" value={jugador[k] ?? 0}
                      onChange={e => setJugador(j => ({ ...j, [k]: e.target.value }))}
                      onBlur={e => handleGuardarCampo(k, Number(e.target.value) || 0)}
                      style={inp}/>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ background:S.card, border:`1px solid ${S.border}`, borderRadius:14, padding:16 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                <div style={{ fontWeight:700, fontSize:'.88rem' }}>Premios de la escuela</div>
                <button onClick={() => setShowPremioForm(s => !s)} style={{ background:S.cyanDim, border:`1px solid ${S.cyan}55`, color:S.cyan, borderRadius:8, padding:'5px 10px', fontSize:'.75rem', fontWeight:700, cursor:'pointer' }}>{showPremioForm ? 'Cancelar' : '+ Premio'}</button>
              </div>
              <div style={{ fontSize:'.72rem', color:S.muted, marginBottom:12 }}>Estos premios aplican a todos los jugadores de la escuela — se desbloquean solos cuando llegan al umbral.</div>

              {showPremioForm && (
                <div style={{ background:S.card2, borderRadius:10, padding:12, marginBottom:12 }}>
                  <div style={{ display:'grid', gridTemplateColumns:'50px 1fr', gap:8, marginBottom:8 }}>
                    <input value={nuevoPremio.emoji} onChange={e => setNuevoPremio(p => ({ ...p, emoji:e.target.value }))} style={{ ...inp, textAlign:'center' }}/>
                    <input value={nuevoPremio.nombre} onChange={e => setNuevoPremio(p => ({ ...p, nombre:e.target.value }))} style={inp} placeholder="Nombre del premio"/>
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:8 }}>
                    <select value={nuevoPremio.tipo_stat} onChange={e => setNuevoPremio(p => ({ ...p, tipo_stat:e.target.value }))} style={inp}>
                      {STAT_KEYS.map(k => <option key={k} value={k}>{STAT_LABELS[k]}</option>)}
                    </select>
                    <input type="number" min="1" value={nuevoPremio.umbral} onChange={e => setNuevoPremio(p => ({ ...p, umbral:e.target.value }))} style={inp} placeholder="Meta"/>
                  </div>
                  <input value={nuevoPremio.descripcion} onChange={e => setNuevoPremio(p => ({ ...p, descripcion:e.target.value }))} style={{ ...inp, marginBottom:10 }} placeholder="Descripción (opcional)"/>
                  <label style={lbl}>Desbloquea diseño de tarjeta (opcional)</label>
                  <select value={nuevoPremio.card_type} onChange={e => setNuevoPremio(p => ({ ...p, card_type:e.target.value }))} style={{ ...inp, marginBottom:10 }}>
                    <option value="">Ninguno — solo insignia</option>
                    {CARD_DESIGNS.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
                  </select>
                  <button onClick={handleCrearPremio} style={{ width:'100%', padding:'9px', background:S.cyan, border:'none', borderRadius:8, cursor:'pointer', color:'#000', fontWeight:800, fontSize:'.8rem' }}>Crear premio</button>
                </div>
              )}

              {premios.length === 0 ? (
                <div style={{ fontSize:'.78rem', color:S.muted, textAlign:'center', padding:'10px 0' }}>Todavía no hay premios creados.</div>
              ) : premios.map(p => (
                <div key={p.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 4px', borderBottom:`1px solid ${S.border}` }}>
                  <span>{p.emoji}</span>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:'.8rem', fontWeight:700 }}>{p.nombre}</div>
                    <div style={{ fontSize:'.68rem', color:S.muted }}>
                      {STAT_LABELS[p.tipo_stat]} ≥ {p.umbral}
                      {p.card_type && <span> · 🎴 desbloquea {CARD_DESIGNS.find(d => d.id === p.card_type)?.nombre || p.card_type}</span>}
                    </div>
                  </div>
                  <button onClick={() => handleEliminarPremio(p.id)} style={{ background:'none', border:'none', color:S.muted, cursor:'pointer', fontSize:'.85rem' }}>🗑️</button>
                </div>
              ))}
            </div>

            <FichaEvolucion jugadorId={id} editable/>
          </div>
        )}
      </div>
    </div>
  )
}
