import { useEffect, useState } from 'react'
import { GraduationCap } from 'lucide-react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { comprimirImagen } from '../lib/imageCompress'
import { useFormDraft, limpiarBorrador } from '../hooks/useFormDraft'

const S = {
  navy: '#07070e', surface: '#0d1117', card: '#111827', card2: '#1a2234',
  border: '#1e2d3d', cyan: '#00ddd0', cyanDim: 'rgba(0,221,208,.12)',
  gold: '#f9a825', text: '#e8f4fd', text2: '#b8d4e8', muted: '#7a9ab5',
}
const inp = { width:'100%', background:S.card2, border:`1px solid ${S.border}`, borderRadius:'10px', padding:'11px 13px', color:S.text, fontSize:'.88rem', outline:'none', boxSizing:'border-box' }
const lbl = { fontSize:'.72rem', fontWeight:'600', color:S.muted, display:'block', marginBottom:'5px', textTransform:'uppercase', letterSpacing:'.05em' }

const TIPOS_SANGRE = ['O+','O-','A+','A-','B+','B-','AB+','AB-']
const POSICIONES = ['Portero','Defensa','Mediocampista','Delantero','Cierre','Ala','Pívot']

function calcularEdad(fecha) {
  if (!fecha) return null
  const hoy = new Date(), nac = new Date(fecha)
  let edad = hoy.getFullYear() - nac.getFullYear()
  const m = hoy.getMonth() - nac.getMonth()
  if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) edad--
  return edad
}

const EMPTY_ACUDIENTE = { nombre:'', cedula:'', telefono:'' }
const EMPTY_JUGADOR = { name:'', fecha_nacimiento:'', numero_cedula:'', tipo_sangre:'', genero:'', telefono:'', posicion:'', pie_dominante:'', anios_jugando:'' }

export default function RegistroEscuelaPage() {
  const { escuelaId } = useParams()
  const [escuela, setEscuela] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [acudiente, setAcudiente] = useState(EMPTY_ACUDIENTE)
  const [jugador, setJugador] = useState(EMPTY_JUGADOR)
  // Si el celular mata la pestaña al salir a otra app (ej. WhatsApp) mientras
  // se llena este registro, se recupera solo al volver.
  useFormDraft(`draft_registro_escuela_acud_${escuelaId || 'x'}`, acudiente, setAcudiente)
  useFormDraft(`draft_registro_escuela_jug_${escuelaId || 'x'}`, jugador, setJugador)
  const [fotoFrontal, setFotoFrontal] = useState(null)
  const [fotoTrasera, setFotoTrasera] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [exito, setExito] = useState(false)

  useEffect(() => { fetchEscuela() }, [escuelaId])

  async function fetchEscuela() {
    setLoading(true)
    const { data } = await supabase.from('teams').select('*').eq('id', escuelaId).eq('tipo', 'escuela').maybeSingle()
    if (!data) setNotFound(true)
    setEscuela(data)
    setLoading(false)
  }

  async function subirFotos(playerId) {
    let frontalExt = null
    let traseraExt = null
    if (fotoFrontal) {
      const archivo = await comprimirImagen(fotoFrontal, { maxSize: 1600, calidad: 0.85 })
      const ext = archivo.name.split('.').pop()
      const path = `${playerId}_frontal.${ext}`
      const { error } = await supabase.storage.from('cedulas').upload(path, archivo, { upsert: true })
      if (error) throw new Error('Error al subir documento (frente): ' + error.message)
      frontalExt = ext
    }
    if (fotoTrasera) {
      const archivo = await comprimirImagen(fotoTrasera, { maxSize: 1600, calidad: 0.85 })
      const ext = archivo.name.split('.').pop()
      const path = `${playerId}_trasera.${ext}`
      const { error } = await supabase.storage.from('cedulas').upload(path, archivo, { upsert: true })
      if (error) throw new Error('Error al subir documento (atrás): ' + error.message)
      traseraExt = ext
    }
    if (frontalExt || traseraExt) {
      const { error } = await supabase.rpc('confirmar_cedula_urls', {
        p_player_id: playerId,
        p_frontal_ext: frontalExt,
        p_trasera_ext: traseraExt,
      })
      if (error) throw new Error('Error al guardar documentos: ' + error.message)
    }
  }

  async function vincularAuthSiPuede(playerId, cedulaDoc) {
    const email = `${cedulaDoc}@golmebol.com`
    const password = cedulaDoc
    const { data: authData, error: errAuth } = await supabase.auth.signUp({
      email, password,
      options: { data: { player_id: playerId, cedula: cedulaDoc } },
    })
    if (!errAuth && authData?.user) {
      await supabase.rpc('vincular_auth_player', { p_player_id: playerId })
      return
    }
    // Cuenta de auth ya creada de un intento previo: entrar y vincular
    const { data: signInData } = await supabase.auth.signInWithPassword({ email, password })
    if (signInData?.user) {
      await supabase.rpc('vincular_auth_player', { p_player_id: playerId })
    }
  }

  async function handleRegistrar() {
    setError('')
    if (!acudiente.nombre.trim())        return setError('Falta el nombre del acudiente')
    if (!acudiente.cedula.trim())        return setError('Falta la cédula del acudiente')
    if (!acudiente.telefono.trim())      return setError('Falta el teléfono del acudiente')
    if (!jugador.name.trim())            return setError('Falta el nombre del jugador')
    if (!jugador.fecha_nacimiento)       return setError('Falta la fecha de nacimiento del jugador')
    if (!jugador.numero_cedula.trim())   return setError('Falta el número de tarjeta de identidad del jugador (lo va a usar para entrar a ver su tarjeta)')
    setGuardando(true)

    try {
      const { data, error } = await supabase.rpc('registrar_escuela', {
        p_escuela_id: escuela.id,
        p_acudiente_nombre: acudiente.nombre.trim(),
        p_acudiente_cedula: acudiente.cedula.trim(),
        p_acudiente_telefono: acudiente.telefono.trim(),
        p_jugador_name: jugador.name.trim(),
        p_jugador_fecha_nacimiento: jugador.fecha_nacimiento,
        p_jugador_cedula: jugador.numero_cedula.trim(),
        p_tipo_sangre: jugador.tipo_sangre || null,
        p_genero: jugador.genero || null,
        p_telefono: jugador.telefono.trim() || null,
        p_posicion: jugador.posicion || null,
        p_pie_dominante: jugador.pie_dominante || null,
        p_anios_jugando: jugador.anios_jugando === '' ? null : Number(jugador.anios_jugando),
      })
      if (error || !data?.jugador_id) throw new Error(error?.message || 'No se pudo registrar')

      // Auth del acudiente + vínculo user_id
      await vincularAuthSiPuede(data.acudiente_id, acudiente.cedula.trim())
      // Auth del jugador (TI) + vínculo
      await vincularAuthSiPuede(data.jugador_id, jugador.numero_cedula.trim())

      await subirFotos(data.jugador_id)

      limpiarBorrador(`draft_registro_escuela_acud_${escuelaId || 'x'}`)
      limpiarBorrador(`draft_registro_escuela_jug_${escuelaId || 'x'}`)
      setExito(true)
    } catch (e) {
      setError(e.message || 'Ocurrió un error, intenta de nuevo')
    } finally {
      setGuardando(false)
    }
  }

  if (loading) return (
    <div style={{ minHeight:'100vh', background:S.navy, display:'flex', alignItems:'center', justifyContent:'center', color:S.cyan, fontSize:'.9rem' }}>Cargando...</div>
  )

  if (notFound) return (
    <div style={{ minHeight:'100vh', background:S.navy, display:'flex', alignItems:'center', justifyContent:'center', color:S.muted, fontSize:'.9rem', padding:20, textAlign:'center' }}>Este link de registro no es válido.</div>
  )

  if (exito) return (
    <div style={{ minHeight:'100vh', background:S.navy, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div style={{ background:S.card, border:`1px solid ${S.border}`, borderRadius:16, padding:28, textAlign:'center', maxWidth:380 }}>
        <div style={{ fontSize:'2.4rem', marginBottom:10 }}>✅</div>
        <div style={{ fontWeight:800, fontSize:'1.05rem', color:S.text, marginBottom:8 }}>¡{jugador.name} ya quedó registrado en {escuela.name}!</div>
        <div style={{ fontSize:'.82rem', color:S.text2, lineHeight:1.5 }}>
          {acudiente.nombre} ya puede iniciar sesión en Golmebol con su cédula (<b>{acudiente.cedula}</b>) para ver la tarjeta y el progreso de {jugador.name}.
          <br/><br/>
          {jugador.name} también puede entrar directamente con su número de tarjeta de identidad (<b>{jugador.numero_cedula}</b>) para ver su propia tarjeta.
        </div>
        <button onClick={() => { setJugador(EMPTY_JUGADOR); setFotoFrontal(null); setFotoTrasera(null); setExito(false) }}
          style={{ marginTop:18, width:'100%', padding:'12px', background:S.cyan, border:'none', borderRadius:10, cursor:'pointer', color:'#000', fontWeight:800, fontSize:'.85rem' }}>
          Registrar otro hijo/a en esta escuela
        </button>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight:'100vh', background:S.navy, fontFamily:'system-ui,sans-serif', color:S.text, paddingBottom:'40px' }}>
      <div style={{
        position:'relative', padding:'34px 16px 22px', textAlign:'center', overflow:'hidden',
        borderBottom:`0.5px solid ${S.border}`,
        ...(escuela?.imagen_fondo_url
          ? { backgroundImage:`linear-gradient(180deg, rgba(7,7,14,.55), rgba(7,7,14,.92)), url(${escuela.imagen_fondo_url})`, backgroundSize:'cover', backgroundPosition:'center' }
          : { background:S.surface }),
      }}>
        {escuela?.logo_url && (
          <img src={escuela.logo_url} style={{ width:'56px', height:'56px', borderRadius:'14px', objectFit:'cover', marginBottom:'10px', border:`2px solid ${S.border}` }}/>
        )}
        <div style={{ fontSize:'.7rem', color:S.muted, textTransform:'uppercase', letterSpacing:'.1em', display:'flex', alignItems:'center', justifyContent:'center', gap:'5px' }}><GraduationCap size={11}/> Registro de jugador · Golmebol</div>
        <div style={{ fontWeight:900, fontSize:'1.2rem', marginTop:4 }}>{escuela?.name}</div>
        {escuela?.categoria && <div style={{ fontSize:'.78rem', color:S.text2, marginTop:2 }}>{escuela.categoria}</div>}
      </div>

      <div style={{ maxWidth:'520px', margin:'0 auto', padding:'20px 16px' }}>
        <div style={{ background:S.card, border:`1px solid ${S.border}`, borderRadius:16, padding:'18px' }}>

          <div style={{ fontWeight:800, fontSize:'.95rem', marginBottom:4 }}>Datos del acudiente</div>
          <div style={{ fontSize:'.75rem', color:S.muted, marginBottom:14 }}>Con esta cédula vas a poder entrar después a ver la tarjeta de tu hijo/a.</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', marginBottom:'20px' }}>
            <div style={{ gridColumn:'1/-1' }}>
              <label style={lbl}>Nombre completo *</label>
              <input value={acudiente.nombre} onChange={e => setAcudiente(a => ({ ...a, nombre:e.target.value }))} style={inp} placeholder="Tu nombre"/>
            </div>
            <div>
              <label style={lbl}>Cédula *</label>
              <input value={acudiente.cedula} onChange={e => setAcudiente(a => ({ ...a, cedula:e.target.value.replace(/\D/g,'') }))} style={inp} placeholder="Tu cédula"/>
            </div>
            <div>
              <label style={lbl}>Teléfono *</label>
              <input value={acudiente.telefono} onChange={e => setAcudiente(a => ({ ...a, telefono:e.target.value }))} style={inp} placeholder="WhatsApp"/>
            </div>
          </div>

          <div style={{ fontWeight:800, fontSize:'.95rem', marginBottom:4 }}>Datos del jugador</div>
          <div style={{ fontSize:'.75rem', color:S.muted, marginBottom:14 }}>
            {calcularEdad(jugador.fecha_nacimiento) !== null && calcularEdad(jugador.fecha_nacimiento) < 18
              ? 'Como es menor de edad, el número de documento es su Tarjeta de Identidad.'
              : 'Datos del niño o niña que se va a registrar en la escuela.'}
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', marginBottom:'16px' }}>
            <div style={{ gridColumn:'1/-1' }}>
              <label style={lbl}>Nombre completo *</label>
              <input value={jugador.name} onChange={e => setJugador(j => ({ ...j, name:e.target.value }))} style={inp} placeholder="Nombre del jugador"/>
            </div>
            <div>
              <label style={lbl}>Fecha de nacimiento *</label>
              <input type="date" value={jugador.fecha_nacimiento} onChange={e => setJugador(j => ({ ...j, fecha_nacimiento:e.target.value }))} style={inp}/>
            </div>
            <div>
              <label style={lbl}>Género</label>
              <select value={jugador.genero} onChange={e => setJugador(j => ({ ...j, genero:e.target.value }))} style={inp}>
                <option value="">Seleccionar...</option><option>Masculino</option><option>Femenino</option>
              </select>
            </div>
            <div>
              <label style={lbl}>{calcularEdad(jugador.fecha_nacimiento) !== null && calcularEdad(jugador.fecha_nacimiento) < 18 ? 'Tarjeta de identidad' : 'Cédula'}</label>
              <input value={jugador.numero_cedula} onChange={e => setJugador(j => ({ ...j, numero_cedula:e.target.value }))} style={inp} placeholder="Número de documento"/>
            </div>
            <div>
              <label style={lbl}>Tipo de sangre</label>
              <select value={jugador.tipo_sangre} onChange={e => setJugador(j => ({ ...j, tipo_sangre:e.target.value }))} style={inp}>
                <option value="">Seleccionar...</option>
                {TIPOS_SANGRE.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Posición</label>
              <select value={jugador.posicion} onChange={e => setJugador(j => ({ ...j, posicion:e.target.value }))} style={inp}>
                <option value="">Seleccionar...</option>
                {POSICIONES.map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Pie dominante</label>
              <select value={jugador.pie_dominante} onChange={e => setJugador(j => ({ ...j, pie_dominante:e.target.value }))} style={inp}>
                <option value="">Seleccionar...</option>
                <option value="derecho">Derecho</option><option value="izquierdo">Izquierdo</option><option value="ambidiestro">Ambidiestro</option>
              </select>
            </div>
            <div>
              <label style={lbl}>Años jugando fútbol</label>
              <input type="number" min="0" step="0.5" value={jugador.anios_jugando} onChange={e => setJugador(j => ({ ...j, anios_jugando:e.target.value }))} style={inp} placeholder="Opcional"/>
            </div>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', marginBottom:'18px' }}>
            <div>
              <label style={lbl}>Foto documento (frente)</label>
              <input type="file" accept="image/*" onChange={e => setFotoFrontal(e.target.files[0] || null)} style={{ ...inp, padding:'8px' }}/>
            </div>
            <div>
              <label style={lbl}>Foto documento (atrás)</label>
              <input type="file" accept="image/*" onChange={e => setFotoTrasera(e.target.files[0] || null)} style={{ ...inp, padding:'8px' }}/>
            </div>
          </div>

          {error && <div style={{ color:'#ff6b6b', fontSize:'.8rem', marginBottom:'14px' }}>{error}</div>}

          <button onClick={handleRegistrar} disabled={guardando}
            style={{ width:'100%', padding:'14px', background:S.cyan, border:'none', borderRadius:12, cursor:'pointer', color:'#000', fontWeight:800, fontSize:'.9rem', opacity:guardando?.7:1 }}>
            {guardando ? 'Registrando...' : 'REGISTRAR JUGADOR'}
          </button>
        </div>
      </div>
    </div>
  )
}
