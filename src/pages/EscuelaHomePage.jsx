import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import PortalesMenu from '../components/PortalesMenu'

const S = {
  navy: '#07070e', surface: '#0d1117', card: '#111827', card2: '#1a2234',
  border: '#1e2d3d', cyan: '#00ddd0', cyanDim: 'rgba(0,221,208,.12)',
  gold: '#f9a825', text: '#e8f4fd', text2: '#b8d4e8', muted: '#7a9ab5',
}
const inp = { width:'100%', background:S.card, border:`1px solid ${S.border}`, borderRadius:'10px', padding:'11px 14px', color:S.text, fontSize:'.9rem', outline:'none', boxSizing:'border-box' }
const lbl = { fontSize:'.72rem', fontWeight:'600', color:S.muted, display:'block', marginBottom:'5px', textTransform:'uppercase', letterSpacing:'.05em' }

export default function EscuelaHomePage() {
  const navigate = useNavigate()
  const [profesor,   setProfesor]   = useState(null)
  const [escuela,    setEscuela]    = useState(null)
  const [numJugadores, setNumJugadores] = useState(0)
  const [numProfesores, setNumProfesores] = useState(0)
  const [loading,    setLoading]    = useState(true)
  const [nombreEscuela, setNombreEscuela] = useState('')
  const [categoria,     setCategoria]     = useState('')
  const [guardando,     setGuardando]     = useState(false)
  const [error,         setError]         = useState('')
  const [subiendoLogo,  setSubiendoLogo]  = useState(false)

  useEffect(() => { fetchTodo() }, [])

  async function fetchTodo() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { navigate('/jugador/login'); return }
    const { data: p } = await supabase.from('players').select('*').eq('user_id', user.id).single()
    if (!p) { navigate('/jugador/login'); return }
    // Portal exclusivo para profesores de escuela — cualquier otra cuenta
    // (jugador puro, árbitro puro) va a su portal correspondiente.
    if (!(p.rol === 'profesor' || p.es_profesor || p.es_profesor_coordinador)) {
      navigate('/jugador'); return
    }
    setProfesor(p)

    if (p.escuela_id) {
      const { data: esc } = await supabase.from('teams').select('*').eq('id', p.escuela_id).single()
      setEscuela(esc || null)
      const { count: cJug } = await supabase.from('team_players').select('id', { count: 'exact', head: true }).eq('team_id', p.escuela_id)
      setNumJugadores(cJug || 0)
      const { count: cProf } = await supabase.from('players').select('id', { count: 'exact', head: true }).eq('escuela_id', p.escuela_id).or('rol.eq.profesor,es_profesor.eq.true')
      setNumProfesores(cProf || 0)
    }
    setLoading(false)
  }

  async function handleLogout() {
    await supabase.auth.signOut(); navigate('/jugador/login')
  }

  async function handleLogo(file) {
    if (!file || !escuela) return
    setSubiendoLogo(true)
    const ext = file.name.split('.').pop()
    const path = `logos/${escuela.id}.${ext}`
    const { error: errUp } = await supabase.storage.from('teams').upload(path, file, { upsert: true })
    if (!errUp) {
      const { data: urlData } = supabase.storage.from('teams').getPublicUrl(path)
      await supabase.from('teams').update({ logo_url: urlData.publicUrl }).eq('id', escuela.id)
      setEscuela(e => ({ ...e, logo_url: urlData.publicUrl }))
    }
    setSubiendoLogo(false)
  }

  async function handleCrearEscuela() {
    setError('')
    if (!nombreEscuela.trim()) { setError('Ponle un nombre a tu escuela'); return }
    setGuardando(true)
    const { data: nuevoEquipo, error: errTeam } = await supabase.from('teams')
      .insert({ name: nombreEscuela.trim(), tipo: 'escuela', categoria: categoria.trim() || null })
      .select().single()
    if (errTeam || !nuevoEquipo) { setError('No se pudo crear la escuela: ' + (errTeam?.message || '')); setGuardando(false); return }
    const { error: errUpd } = await supabase.from('players').update({ escuela_id: nuevoEquipo.id }).eq('id', profesor.id)
    setGuardando(false)
    if (errUpd) { setError('La escuela se creó pero no se pudo vincular a tu cuenta: ' + errUpd.message); return }
    fetchTodo()
  }

  if (loading) return (
    <div style={{ minHeight:'100vh', background:S.navy, display:'flex', alignItems:'center', justifyContent:'center', color:S.cyan, fontSize:'.9rem' }}>Cargando...</div>
  )

  if (!profesor) return null

  const esCoordinador = !!profesor.es_profesor_coordinador

  return (
    <div style={{ minHeight:'100vh', background:S.navy, fontFamily:'system-ui,sans-serif', color:S.text, paddingBottom:'40px' }}>
      {/* Banner del club */}
      <div style={{ background:`linear-gradient(160deg, ${S.surface}, ${S.navy})`, borderBottom:`1px solid ${S.border}` }}>
        <div style={{ maxWidth:'600px', margin:'0 auto', padding:'14px 20px 20px' }}>

          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:'8px', marginBottom:'18px' }}>
            <PortalesMenu usuario={profesor} actual="profesor" theme="dark"/>
            <button onClick={handleLogout} style={{ background:'none', border:`1px solid ${S.border}`, borderRadius:'8px', padding:'6px 13px', cursor:'pointer', color:S.muted, fontSize:'.75rem', fontWeight:'600', flexShrink:0 }}>Salir</button>
          </div>

          <div style={{ display:'flex', alignItems:'center', gap:'16px' }}>
            <div style={{ position:'relative', width:'64px', height:'64px', flexShrink:0 }}>
              <div style={{ width:'64px', height:'64px', borderRadius:'16px', background:S.card2, border:`2px solid ${S.cyan}55`, overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 4px 14px rgba(0,0,0,.35)' }}>
                {escuela?.logo_url ? <img src={escuela.logo_url} style={{ width:'100%', height:'100%', objectFit:'cover' }}/> : <span style={{ fontSize:'1.6rem' }}>🛡️</span>}
              </div>
              {esCoordinador && escuela && (
                <label style={{ position:'absolute', bottom:'-4px', right:'-4px', width:'24px', height:'24px', borderRadius:'50%', background:S.cyan, display:'flex', alignItems:'center', justifyContent:'center', cursor: subiendoLogo?'default':'pointer', border:`2px solid ${S.navy}`, opacity:subiendoLogo?.6:1 }}
                  title="Cambiar foto/escudo del club">
                  <span style={{ fontSize:'.65rem' }}>📷</span>
                  <input type="file" accept="image/*" style={{ display:'none' }} disabled={subiendoLogo} onChange={e => handleLogo(e.target.files[0] || null)}/>
                </label>
              )}
            </div>
            <div style={{ minWidth:0 }}>
              <div style={{ fontSize:'.66rem', color:S.muted, textTransform:'uppercase', letterSpacing:'.12em' }}>🏟️ Club</div>
              <div style={{ fontWeight:'900', fontSize:'1.35rem', color:S.text, lineHeight:1.15, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{escuela?.name || 'Sin club todavía'}</div>
              <div style={{ fontSize:'.74rem', color: esCoordinador ? S.gold : S.muted, fontWeight:'700', marginTop:'4px' }}>
                {esCoordinador ? '👑 Coordinador' : '🧑‍🏫 Profesor'} · {profesor.name?.split(' ')[0]}
              </div>
            </div>
          </div>

        </div>
      </div>

      <div style={{ maxWidth:'600px', margin:'0 auto', padding:'20px 16px' }}>

        {/* Sin escuela todavía */}
        {!profesor.escuela_id && (
          esCoordinador ? (
            <div style={{ background:S.card, border:`1px solid ${S.border}`, borderRadius:'16px', padding:'22px' }}>
              <div style={{ fontSize:'2rem', marginBottom:'8px' }}>🏫</div>
              <div style={{ fontWeight:'800', fontSize:'1.05rem', marginBottom:'4px' }}>Crea tu club</div>
              <div style={{ fontSize:'.8rem', color:S.muted, marginBottom:'18px' }}>Ponle el nombre y la categoría — después podrás agregar tus jugadores, la foto del club y a los demás profesores.</div>
              <div style={{ marginBottom:'12px' }}>
                <label style={lbl}>Nombre del club *</label>
                <input value={nombreEscuela} onChange={e => setNombreEscuela(e.target.value)} style={inp} placeholder="Ej: Club Chapecó"/>
              </div>
              <div style={{ marginBottom:'16px' }}>
                <label style={lbl}>Categoría</label>
                <input value={categoria} onChange={e => setCategoria(e.target.value)} style={inp} placeholder="Ej: Sub-10"/>
              </div>
              {error && <div style={{ color:'#ff6b6b', fontSize:'.78rem', marginBottom:'12px' }}>{error}</div>}
              <button onClick={handleCrearEscuela} disabled={guardando}
                style={{ width:'100%', padding:'13px', background:S.cyan, border:'none', borderRadius:'12px', cursor:'pointer', color:'#000', fontWeight:'800', fontSize:'.9rem', opacity:guardando?.7:1 }}>
                {guardando ? 'Creando...' : 'CREAR CLUB →'}
              </button>
            </div>
          ) : (
            <div style={{ background:S.card, border:`1px solid ${S.border}`, borderRadius:'16px', padding:'22px', textAlign:'center' }}>
              <div style={{ fontSize:'2rem', marginBottom:'8px' }}>⏳</div>
              <div style={{ fontSize:'.85rem', color:S.muted }}>Tu coordinador todavía no te agregó a una escuela. Avísale para que lo haga desde su portal.</div>
            </div>
          )
        )}

        {/* Ya tiene escuela */}
        {profesor.escuela_id && escuela && (
          <div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'16px' }}>
              <div style={{ background:S.card, border:`1px solid ${S.border}`, borderRadius:'12px', padding:'14px', textAlign:'center' }}>
                <div style={{ fontSize:'1.6rem', fontWeight:'900', color:S.cyan }}>{numJugadores}</div>
                <div style={{ fontSize:'.68rem', color:S.muted, marginTop:'2px' }}>Jugadores</div>
              </div>
              <div style={{ background:S.card, border:`1px solid ${S.border}`, borderRadius:'12px', padding:'14px', textAlign:'center' }}>
                <div style={{ fontSize:'1.6rem', fontWeight:'900', color:S.gold }}>{numProfesores}</div>
                <div style={{ fontSize:'.68rem', color:S.muted, marginTop:'2px' }}>Profesores</div>
              </div>
            </div>

            <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
              <button onClick={() => navigate('/escuela/jugadores')}
                style={{ display:'flex', alignItems:'center', gap:'12px', padding:'16px', background:S.card, border:`1px solid ${S.border}`, borderRadius:'14px', cursor:'pointer', color:S.text, textAlign:'left' }}>
                <span style={{ fontSize:'1.4rem' }}>👥</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:'700', fontSize:'.9rem' }}>Jugadores</div>
                  <div style={{ fontSize:'.72rem', color:S.muted }}>{esCoordinador ? 'Agrega y edita la plantilla de la escuela' : 'Ver la plantilla de la escuela'}</div>
                </div>
                <span style={{ color:S.muted }}>→</span>
              </button>

              {esCoordinador && (
                <button onClick={() => navigate('/escuela/profesores')}
                  style={{ display:'flex', alignItems:'center', gap:'12px', padding:'16px', background:S.card, border:`1px solid ${S.border}`, borderRadius:'14px', cursor:'pointer', color:S.text, textAlign:'left' }}>
                  <span style={{ fontSize:'1.4rem' }}>🧑‍🏫</span>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:'700', fontSize:'.9rem' }}>Profesores</div>
                    <div style={{ fontSize:'.72rem', color:S.muted }}>Agrega a los demás profesores de tu escuela</div>
                  </div>
                  <span style={{ color:S.muted }}>→</span>
                </button>
              )}

              <button onClick={() => navigate('/escuela/partido')}
                style={{ display:'flex', alignItems:'center', gap:'12px', padding:'16px', background:S.card, border:`1px solid ${S.border}`, borderRadius:'14px', cursor:'pointer', color:S.text, textAlign:'left' }}>
                <span style={{ fontSize:'1.4rem' }}>⚽</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:'700', fontSize:'.9rem' }}>Día de partido</div>
                  <div style={{ fontSize:'.72rem', color:S.muted }}>Convocatoria, formación y partido en vivo</div>
                  <div style={{ fontSize:'.72rem', color:S.muted }}>Convocatoria, formación y partido en vivo</div>
                </div>
                <span style={{ color:S.muted }}>→</span>
              </button>

              <button onClick={() => navigate('/escuela/torneos')}
                style={{ display:'flex', alignItems:'center', gap:'12px', padding:'16px', background:S.card, border:`1px solid ${S.border}`, borderRadius:'14px', cursor:'pointer', color:S.text, textAlign:'left' }}>
                <span style={{ fontSize:'1.4rem' }}>🏆</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:'700', fontSize:'.9rem' }}>Torneos</div>
                  <div style={{ fontSize:'.72rem', color:S.muted }}>Fase, resultado y premios de los torneos donde juega la escuela</div>
                </div>
                <span style={{ color:S.muted }}>→</span>
              </button>

              <button onClick={() => navigate('/jugador')}
              style={{ display:'flex', alignItems:'center', gap:'12px', padding:'16px', background:S.card, border:`1px solid ${S.border}`, borderRadius:'14px', cursor:'pointer', color:S.text, textAlign:'left' }}>
                <span style={{ fontSize:'1.4rem' }}>🎮</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:'700', fontSize:'.9rem' }}>Ver mis torneos</div>
                  <div style={{ fontSize:'.72rem', color:S.muted }}>Si también juegas en algún torneo de Golmebol, entra aquí</div>
                </div>
                <span style={{ color:S.muted }}>→</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
