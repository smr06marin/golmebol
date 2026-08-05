import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import PortalBanner from '../components/PortalBanner'
import { Shield, Crown, GraduationCap, School, Hourglass, Users, ClipboardList, Wallet, Award, Trophy, Building2, ArrowRight, Pencil, Image as ImageIcon, X, User } from 'lucide-react'
import { GiSoccerBall } from 'react-icons/gi'
import EscuelaFeatureCard from '../components/EscuelaFeatureCard'

const S = {
  navy: '#07070e', surface: '#0d1117', card: '#111827', card2: '#1a2234',
  border: '#1e2d3d', cyan: '#00ddd0', cyanDim: 'rgba(0,221,208,.12)',
  green: '#22c55e', greenDim: 'rgba(34,197,94,.14)', warn: '#f9a825',
  gold: '#f9a825', text: '#e8f4fd', text2: '#b8d4e8', muted: '#7a9ab5',
}

// Fotos de fondo (muy tenues, solo de ambiente) para cada tarjeta del panel
// — las mismas que ya se usan para las tarjetas de jugador en otras partes
// de la app, así no se depende de subir imágenes nuevas.
const IMG_JUGADORES      = 'https://images.unsplash.com/photo-1529900748604-07564a03e7a6?w=800&q=60'
const IMG_PROFESORES     = 'https://images.unsplash.com/photo-1518604666860-9ed391f76460?w=800&q=60'
const IMG_ASISTENCIA     = 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&q=60'
const IMG_MENSUALIDADES  = 'https://images.unsplash.com/photo-1486286701208-1d58e9338013?w=800&q=60'
const IMG_RANKINGS       = 'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=800&q=60'
const IMG_DIA_PARTIDO    = 'https://images.unsplash.com/photo-1518604666860-9ed391f76460?w=800&q=60'
const IMG_TORNEOS        = 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&q=60'

const inp = { width:'100%', background:S.card, border:`1px solid ${S.border}`, borderRadius:'10px', padding:'11px 14px', color:S.text, fontSize:'.9rem', outline:'none', boxSizing:'border-box' }
const lbl = { fontSize:'.72rem', fontWeight:'600', color:S.muted, display:'block', marginBottom:'5px', textTransform:'uppercase', letterSpacing:'.05em' }

export default function EscuelaHomePage() {
  const navigate = useNavigate()
  const [profesor,   setProfesor]   = useState(null)
  const [escuela,    setEscuela]    = useState(null)
  const [numJugadores, setNumJugadores] = useState(0)
  const [numProfesores, setNumProfesores] = useState(0)
  const [cMensualidad, setCMensualidad] = useState(0)
  const [loading,    setLoading]    = useState(true)
  const [nombreEscuela, setNombreEscuela] = useState('')
  const [categoria,     setCategoria]     = useState('')
  const [guardando,     setGuardando]     = useState(false)
  const [error,         setError]         = useState('')
  const [subiendoLogo,  setSubiendoLogo]  = useState(false)

  // Editar escuela (solo coordinador): nombre, categoría, ciudad,
  // representante e imagen de fondo de la página pública de registro.
  const [editandoEscuela,   setEditandoEscuela]   = useState(false)
  const [formEscuela,       setFormEscuela]       = useState(null)
  const [guardandoEdicion,  setGuardandoEdicion]  = useState(false)
  const [subiendoFondo,     setSubiendoFondo]     = useState(false)
  const [errorEdicion,      setErrorEdicion]      = useState('')

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

      // Cuántos jugadores tienen la mensualidad por vencer (próximos 3 días) o vencida.
      if (p.es_profesor_coordinador) {
        const { data: tp } = await supabase.from('team_players').select('players(fecha_vencimiento)').eq('team_id', p.escuela_id)
        const hoy = new Date(); hoy.setHours(0,0,0,0)
        const pendientes = (tp || []).filter(t => {
          const fv = t.players?.fecha_vencimiento
          if (!fv) return false
          const dias = Math.round((new Date(fv).setHours(0,0,0,0) - hoy) / (1000*60*60*24))
          return dias <= 3
        }).length
        setCMensualidad(pendientes)
      }
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

  function abrirEditarEscuela() {
    if (!escuela) return
    setFormEscuela({
      name: escuela.name || '', categoria: escuela.categoria || '', city: escuela.city || '',
      representante_nombre: escuela.representante_nombre || '', representante_telefono: escuela.representante_telefono || '',
    })
    setErrorEdicion(''); setEditandoEscuela(true)
  }

  async function handleFondo(file) {
    if (!file || !escuela) return
    setSubiendoFondo(true)
    const ext = file.name.split('.').pop()
    const path = `fondos/${escuela.id}.${ext}`
    const { error: errUp } = await supabase.storage.from('teams').upload(path, file, { upsert: true })
    if (!errUp) {
      const { data: urlData } = supabase.storage.from('teams').getPublicUrl(path)
      // imagen_fondo_url es columna nueva (migracion_escuela_fondo.sql); si
      // todavía no se corrió esa migración, el update falla silenciosamente
      // acá y se avisa igual desde handleGuardarEscuela cuando se detecte.
      const { error: errCol } = await supabase.from('teams').update({ imagen_fondo_url: urlData.publicUrl }).eq('id', escuela.id)
      if (errCol && errCol.message?.includes('imagen_fondo_url')) {
        setErrorEdicion('No se pudo guardar la imagen: falta ejecutar migracion_escuela_fondo.sql en Supabase')
      } else {
        setEscuela(e => ({ ...e, imagen_fondo_url: urlData.publicUrl }))
      }
    }
    setSubiendoFondo(false)
  }

  async function handleGuardarEscuela() {
    if (!escuela || !formEscuela) return
    if (!formEscuela.name.trim()) { setErrorEdicion('El nombre de la escuela es obligatorio'); return }
    setGuardandoEdicion(true); setErrorEdicion('')
    const payload = {
      name: formEscuela.name.trim(), categoria: formEscuela.categoria.trim() || null, city: formEscuela.city.trim() || null,
      representante_nombre: formEscuela.representante_nombre.trim() || null, representante_telefono: formEscuela.representante_telefono.trim() || null,
    }
    const { error: errUpd } = await supabase.from('teams').update(payload).eq('id', escuela.id)
    setGuardandoEdicion(false)
    if (errUpd) { setErrorEdicion('Error al guardar: ' + errUpd.message); return }
    setEscuela(e => ({ ...e, ...payload }))
    setEditandoEscuela(false)
  }

  if (loading) return (
    <div style={{ minHeight:'100vh', background:S.navy, display:'flex', alignItems:'center', justifyContent:'center', color:S.cyan, fontSize:'.9rem' }}>Cargando...</div>
  )

  if (!profesor) return null

  const esCoordinador = !!profesor.es_profesor_coordinador

  return (
    <div style={{ minHeight:'100vh', background:S.navy, fontFamily:'system-ui,sans-serif', color:S.text, paddingBottom:'40px' }}>
      <PortalBanner theme="dark" sticky
        avatarUrl={escuela?.logo_url} avatarEmoji={<Shield size={22}/>} avatarShape="rounded"
        onAvatarUpload={esCoordinador && escuela ? handleLogo : undefined} uploadingAvatar={subiendoLogo}
        kicker={<span style={{display:'inline-flex',alignItems:'center',gap:'4px'}}><Building2 size={11}/> Club</span>} title={escuela?.name || 'Sin club todavía'}
        subtitle={<span style={{display:'inline-flex',alignItems:'center',gap:'4px'}}>{esCoordinador ? <Crown size={11}/> : <GraduationCap size={11}/>} {esCoordinador ? 'Coordinador' : 'Profesor'} · {profesor.name?.split(' ')[0]}</span>}
        subtitleColor={esCoordinador ? S.gold : S.muted}
        usuario={profesor} actual="profesor" onLogout={handleLogout}
      />

      <div style={{ maxWidth:'600px', margin:'0 auto', padding:'20px 16px' }}>

        {/* Sin escuela todavía */}
        {!profesor.escuela_id && (
          esCoordinador ? (
            <div style={{ background:S.card, border:`1px solid ${S.border}`, borderRadius:'16px', padding:'22px' }}>
              <div style={{ marginBottom:'8px' }}><School size={28} color={S.cyan}/></div>
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
              <div style={{ marginBottom:'8px' }}><Hourglass size={28} color={S.muted}/></div>
              <div style={{ fontSize:'.85rem', color:S.muted }}>Tu coordinador todavía no te agregó a una escuela. Avísale para que lo haga desde su portal.</div>
            </div>
          )
        )}

        {/* Ya tiene escuela */}
        {profesor.escuela_id && escuela && (
          <div>
            {esCoordinador && (
              <button onClick={abrirEditarEscuela}
                style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'6px', width:'100%', padding:'10px', marginBottom:'14px', background:S.cyanDim, border:`1px solid ${S.cyan}`, borderRadius:'10px', cursor:'pointer', color:S.cyan, fontSize:'.8rem', fontWeight:'700' }}>
                <Pencil size={13}/> Editar escuela y página pública
              </button>
            )}

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'16px' }}>
              <div style={{ background:S.card, border:`1px solid ${S.green}44`, borderRadius:'12px', padding:'14px', textAlign:'center' }}>
                <div style={{ display:'flex', justifyContent:'center', marginBottom:'6px' }}><Users size={18} color={S.green}/></div>
                <div style={{ fontSize:'1.6rem', fontWeight:'900', color:S.green, lineHeight:1 }}>{numJugadores}</div>
                <div style={{ fontSize:'.72rem', color:S.text, marginTop:'4px', fontWeight:'700' }}>Jugadores</div>
                <div style={{ fontSize:'.62rem', color:S.muted, marginTop:'1px' }}>Activos en la escuela</div>
              </div>
              <div style={{ background:S.card, border:`1px solid ${S.gold}44`, borderRadius:'12px', padding:'14px', textAlign:'center' }}>
                <div style={{ display:'flex', justifyContent:'center', marginBottom:'6px' }}><GraduationCap size={18} color={S.gold}/></div>
                <div style={{ fontSize:'1.6rem', fontWeight:'900', color:S.gold, lineHeight:1 }}>{numProfesores}</div>
                <div style={{ fontSize:'.72rem', color:S.text, marginTop:'4px', fontWeight:'700' }}>Profesores</div>
                <div style={{ fontSize:'.62rem', color:S.muted, marginTop:'1px' }}>En el cuerpo técnico</div>
              </div>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:'10px' }}>
              <EscuelaFeatureCard onClick={() => navigate('/escuela/jugadores')} bg={IMG_JUGADORES}
                icon={<Users size={24} color={S.green}/>} title="Jugadores"
                desc={esCoordinador ? 'Agrega y edita la plantilla' : 'Ver la plantilla de la escuela'}/>

              <EscuelaFeatureCard onClick={() => navigate(`/escuela/profesores/${profesor.id}`)} bg={IMG_PROFESORES}
                icon={<User size={24} color={S.green}/>} title="Mi perfil"
                desc="Tu vida futbolística y evaluación"/>

              {esCoordinador && (
                <EscuelaFeatureCard onClick={() => navigate('/escuela/profesores')} bg={IMG_PROFESORES}
                  icon={<GraduationCap size={24} color={S.green}/>} title="Profesores"
                  desc="Agrega a los demás profesores"/>
              )}

              <EscuelaFeatureCard onClick={() => navigate('/escuela/asistencia')} bg={IMG_ASISTENCIA}
                icon={<ClipboardList size={24} color={S.green}/>} title="Asistencia"
                desc="Marca quién vino a entrenar"/>

              {esCoordinador && (
                <EscuelaFeatureCard onClick={() => navigate('/escuela/mensualidades')} bg={IMG_MENSUALIDADES}
                  icon={<Wallet size={24} color={S.green}/>} title="Mensualidades"
                  desc={cMensualidad > 0 ? 'Hay pagos por vencer o vencidos' : 'Avisos y cobros por WhatsApp'}
                  badge={cMensualidad} warn={cMensualidad > 0}/>
              )}

              <EscuelaFeatureCard onClick={() => navigate('/escuela/rankings')} bg={IMG_RANKINGS}
                icon={<Award size={24} color={S.green}/>} title="Rankings"
                desc="Tabla de goles, minutos y evaluaciones"/>

              <EscuelaFeatureCard onClick={() => navigate('/escuela/partido')} bg={IMG_DIA_PARTIDO}
                icon={<GiSoccerBall size={22} color={S.green}/>} title="Día de partido"
                desc="Convocatoria, formación y en vivo"/>

              <EscuelaFeatureCard onClick={() => navigate('/escuela/torneos')} bg={IMG_TORNEOS}
                icon={<Trophy size={24} color={S.green}/>} title="Torneos"
                desc="Fase, resultado y premios"/>
            </div>
          </div>
        )}
      </div>

      {/* Modal: editar escuela + imagen de fondo de la página pública */}
      {editandoEscuela && formEscuela && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.6)', zIndex:500, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px' }}>
          <div style={{ background:S.card, border:`1px solid ${S.border}`, borderRadius:'16px', padding:'22px', width:'420px', maxWidth:'100%', maxHeight:'88vh', overflowY:'auto' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'18px' }}>
              <div style={{ fontWeight:'800', fontSize:'1rem' }}>Editar escuela</div>
              <button onClick={() => setEditandoEscuela(false)} style={{ background:'none', border:'none', cursor:'pointer', color:S.muted }}><X size={18}/></button>
            </div>

            <div style={{ marginBottom:'12px' }}>
              <label style={lbl}>Nombre de la escuela *</label>
              <input value={formEscuela.name} onChange={e => setFormEscuela(f => ({ ...f, name:e.target.value }))} style={inp} placeholder="Nombre de la escuela"/>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'12px' }}>
              <div><label style={lbl}>Categoría</label><input value={formEscuela.categoria} onChange={e => setFormEscuela(f => ({ ...f, categoria:e.target.value }))} style={inp} placeholder="Ej: Sub-10"/></div>
              <div><label style={lbl}>Ciudad</label><input value={formEscuela.city} onChange={e => setFormEscuela(f => ({ ...f, city:e.target.value }))} style={inp} placeholder="Ciudad"/></div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'18px' }}>
              <div><label style={lbl}>Representante</label><input value={formEscuela.representante_nombre} onChange={e => setFormEscuela(f => ({ ...f, representante_nombre:e.target.value }))} style={inp} placeholder="Nombre"/></div>
              <div><label style={lbl}>Tel. representante</label><input value={formEscuela.representante_telefono} onChange={e => setFormEscuela(f => ({ ...f, representante_telefono:e.target.value }))} style={inp} placeholder="WhatsApp"/></div>
            </div>

            <div style={{ marginBottom:'18px' }}>
              <label style={lbl}>Imagen de fondo (página pública de registro)</label>
              <div style={{ fontSize:'.72rem', color:S.muted, marginBottom:'8px' }}>Se muestra de fondo en el link de registro que le mandas a los acudientes.</div>
              {escuela?.imagen_fondo_url && (
                <div style={{ width:'100%', height:'90px', borderRadius:'10px', overflow:'hidden', marginBottom:'8px', border:`1px solid ${S.border}` }}>
                  <img src={escuela.imagen_fondo_url} style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
                </div>
              )}
              <label style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'6px', padding:'10px', background:S.card2, border:`1px dashed ${S.border}`, borderRadius:'10px', cursor:'pointer', color:S.text2, fontSize:'.8rem', fontWeight:'600' }}>
                <ImageIcon size={14}/> {subiendoFondo ? 'Subiendo...' : escuela?.imagen_fondo_url ? 'Cambiar imagen de fondo' : 'Subir imagen de fondo'}
                <input type="file" accept="image/*" style={{ display:'none' }} disabled={subiendoFondo} onChange={e => handleFondo(e.target.files[0])}/>
              </label>
            </div>

            {errorEdicion && <div style={{ color:'#ff6b6b', fontSize:'.8rem', marginBottom:'14px' }}>{errorEdicion}</div>}

            <div style={{ display:'flex', gap:'8px' }}>
              <button onClick={handleGuardarEscuela} disabled={guardandoEdicion}
                style={{ flex:1, padding:'12px', background:S.cyan, border:'none', borderRadius:'10px', cursor:'pointer', color:'#000', fontWeight:'800', fontSize:'.85rem', opacity:guardandoEdicion?.7:1 }}>
                {guardandoEdicion ? 'Guardando...' : 'Guardar cambios'}
              </button>
              <button onClick={() => setEditandoEscuela(false)} style={{ padding:'12px 18px', background:'none', border:`1px solid ${S.border}`, borderRadius:'10px', cursor:'pointer', color:S.muted, fontSize:'.85rem' }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
