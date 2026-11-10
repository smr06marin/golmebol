import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { cargarDatosPrivadosEquipo, conDatosPrivados } from '../lib/equiposPrivado'
import { Shield, School, Hourglass, Users, ClipboardList, Wallet, Award, Trophy, GraduationCap, Pencil, Image as ImageIcon, X, User, AlertTriangle } from 'lucide-react'
import { GiSoccerBall } from 'react-icons/gi'
import { PaginaPanel, CuerpoPanel, EncabezadoPanel, Saludo, TarjetaPanel, CifrasPanel, BotonVerde, FilaPanel, AvisoPanel, MasOpciones, G } from '../components/PanelUI'

const S = {
  navy: G.bg, surface: G.card, card: G.card, card2: G.card2,
  border: G.border, cyan: G.green, cyanDim: G.greenBg,
  green: G.green, greenDim: G.greenBg, warn: G.gold,
  gold: G.gold, text: G.text, text2: G.text2, muted: G.muted,
}

const inp = { width:'100%', background:S.card, border:`1px solid ${S.border}`, borderRadius:'10px', padding:'13px 14px', color:S.text, fontSize:'1rem', outline:'none', boxSizing:'border-box' }
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
    const { data: { session } } = await supabase.auth.getSession(); const user = session?.user ?? null // sesión del propio teléfono: getUser() iba a la red en cada entrada
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
      const privEsc = esc ? await cargarDatosPrivadosEquipo(esc.id) : null
      setEscuela(conDatosPrivados(esc, privEsc) || null)
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

  const primerNombre = profesor.name?.split(' ')[0] || ''

  return (
    <PaginaPanel>
      <EncabezadoPanel nombre={escuela?.name || 'Sin club todavía'} rol={`${esCoordinador ? 'Coordinador' : 'Profesor'} · ${primerNombre}`}
        avatarUrl={escuela?.logo_url} icono={<Shield size={22} color={G.muted}/>}
        onAvatar={esCoordinador && escuela ? handleLogo : undefined} subiendoAvatar={subiendoLogo}
        usuario={profesor} actual="profesor" onLogout={handleLogout}/>

      <CuerpoPanel ancho={600}>
        <Saludo nombre={primerNombre}/>

        {/* Sin escuela todavía */}
        {!profesor.escuela_id && (
          esCoordinador ? (
            <TarjetaPanel icono={School} titulo="Crea tu club">
              <div style={{ fontSize:'.95rem', color:S.muted, marginBottom:'18px', lineHeight:1.5 }}>Ponle el nombre y la categoría. Después podrás agregar tus jugadores, la foto del club y a los demás profesores.</div>
              <div style={{ marginBottom:'14px' }}>
                <label style={lbl}>Nombre del club *</label>
                <input value={nombreEscuela} onChange={e => setNombreEscuela(e.target.value)} style={inp} placeholder="Ej: Club Chapecó"/>
              </div>
              <div style={{ marginBottom:'18px' }}>
                <label style={lbl}>Categoría</label>
                <input value={categoria} onChange={e => setCategoria(e.target.value)} style={inp} placeholder="Ej: Sub-10"/>
              </div>
              {error && <div style={{ color:'#ff7b72', fontSize:'.9rem', marginBottom:'12px', fontWeight:600 }}>{error}</div>}
              <BotonVerde onClick={handleCrearEscuela} deshabilitado={guardando}>{guardando ? 'Creando...' : 'Crear club'}</BotonVerde>
            </TarjetaPanel>
          ) : (
            <TarjetaPanel>
              <div style={{ textAlign:'center', padding:'6px 0' }}>
                <div style={{ marginBottom:'8px' }}><Hourglass size={30} color={S.muted}/></div>
                <div style={{ fontSize:'1rem', color:S.muted, lineHeight:1.5 }}>Tu coordinador todavía no te agregó a una escuela. Avísale para que lo haga desde su portal.</div>
              </div>
            </TarjetaPanel>
          )
        )}

        {/* Ya tiene escuela */}
        {profesor.escuela_id && escuela && (
          <>
            {esCoordinador && cMensualidad > 0 && (
              <AvisoPanel icono={AlertTriangle} titulo={`${cMensualidad} ${cMensualidad === 1 ? 'pago por vencer o vencido' : 'pagos por vencer o vencidos'}`}
                sub="Toca para ver quién debe" onClick={() => navigate('/escuela/mensualidades')}/>
            )}

            {/* Lo de todos los días: cuántos hay y a un toque marcar asistencia */}
            <TarjetaPanel icono={Users} titulo="Mi escuela" derecha={escuela.categoria || ''}>
              <CifrasPanel cifras={[
                { valor:numJugadores, etiqueta: numJugadores === 1 ? 'Jugador' : 'Jugadores', color:G.green },
                { valor:numProfesores, etiqueta: numProfesores === 1 ? 'Profesor' : 'Profesores', color:G.gold },
              ]}/>
              <BotonVerde onClick={() => navigate('/escuela/asistencia')}>Marcar asistencia</BotonVerde>
              <div style={{ marginTop:'10px' }}>
                <FilaPanel verde icono={GiSoccerBall} titulo="Día de partido" sub="Convocatoria, formación y en vivo" onClick={() => navigate('/escuela/partido')}/>
              </div>
            </TarjetaPanel>

            {/* Más opciones: cerradas para no abrumar */}
            <MasOpciones hayAvisos={esCoordinador && cMensualidad > 0}>
              <FilaPanel icono={Users} titulo="Jugadores" sub={esCoordinador ? 'Agrega y edita la plantilla' : 'Ver la plantilla de la escuela'} onClick={() => navigate('/escuela/jugadores')}/>
              {esCoordinador && <FilaPanel icono={Wallet} titulo="Mensualidades" sub="Avisos y cobros de cada jugador" aviso={cMensualidad > 0 ? `${cMensualidad} por vencer` : ''} onClick={() => navigate('/escuela/mensualidades')}/>}
              <FilaPanel icono={Trophy} titulo="Torneos" sub="Fase, resultado y premios" onClick={() => navigate('/escuela/torneos')}/>
              <FilaPanel icono={Award} titulo="Rankings" sub="Tabla de goles, minutos y evaluaciones" onClick={() => navigate('/escuela/rankings')}/>
              {esCoordinador && <FilaPanel icono={GraduationCap} titulo="Profesores" sub="Agrega a los demás profesores" onClick={() => navigate('/escuela/profesores')}/>}
              <FilaPanel icono={User} titulo="Mi perfil" sub="Tu vida futbolística y evaluación" onClick={() => navigate(`/escuela/profesores/${profesor.id}`)}/>
              {esCoordinador && <FilaPanel icono={Pencil} titulo="Editar escuela y página pública" sub="Nombre, ciudad, representante e imagen de fondo" onClick={abrirEditarEscuela}/>}
            </MasOpciones>
          </>
        )}
      </CuerpoPanel>

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
    </PaginaPanel>
  )
}
