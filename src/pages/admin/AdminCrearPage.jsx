import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Plus, Trophy, Shield, Users, Search, X, Check, ChevronDown, ChevronUp } from 'lucide-react'
import { buscarEquiposParecidos } from '../../lib/equiposParecidos'
import { buscarPersonaPorCedula, buscarDuenoEquipoPorCedula, rolActualLabel } from '../../lib/personaPorCedula'
import ModalEquipoParecido from '../../components/ModalEquipoParecido'

const input = {
  width: '100%', background: '#fff', border: '1px solid #dadce0',
  borderRadius: '8px', padding: '8px 12px', color: '#202124',
  fontSize: '.875rem', outline: 'none', boxSizing: 'border-box',
  fontFamily: 'system-ui, sans-serif',
}
const label = {
  fontSize: '.75rem', fontWeight: '500', color: '#5f6368',
  display: 'block', marginBottom: '4px',
}

export default function AdminCrearPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState(null) // 'torneo' | 'equipo'

  // ── Inscribir equipo ──
  const [torneos, setTorneos] = useState([])
  const [equipos, setEquipos] = useState([])
  const [torneoSel, setTorneoSel] = useState('')
  const [equipoSearch, setEquipoSearch] = useState('')
  const [equipoSel, setEquipoSel] = useState(null)
  const [jugadoresEquipo, setJugadoresEquipo] = useState([]) // todos los jugadores del equipo en BD
  const [jugadoresInscritos, setJugadoresInscritos] = useState([]) // inscritos en este torneo
  const [jugadoresSearch, setJugadoresSearch] = useState('')
  const [msg, setMsg] = useState(null)
  const [loading, setLoading] = useState(false)
  const [expandedEquipo, setExpandedEquipo] = useState(null)
  const [equiposInscritos, setEquiposInscritos] = useState([])
  const [mostrarCrearEquipo, setMostrarCrearEquipo] = useState(false)
  const [nuevoEquipoForm,    setNuevoEquipoForm]    = useState({ name: '', city: '', representante_nombre: '', representante_cedula: '', representante_telefono: '' })
  const [creandoEquipo,      setCreandoEquipo]      = useState(false)
  const [nuevoEquipoLogo,        setNuevoEquipoLogo]        = useState(null)
  const [nuevoEquipoLogoPreview, setNuevoEquipoLogoPreview] = useState(null)
  const [parecidosCrear, setParecidosCrear] = useState([]) // equipos ya existentes con nombre parecido
  const [personaCedula, setPersonaCedula] = useState(null) // jugador/árbitro ya registrado con esa cédula
  const creandoEquipoRef = useRef(false)

  useEffect(() => {
    supabase.from('tournaments').select('*').eq('status', 'active').then(({ data }) => setTorneos(data || []))
    supabase.from('teams').select('*').order('name').then(({ data }) => setEquipos(data || []))
  }, [])

  useEffect(() => {
    if (torneoSel) fetchEquiposInscritos()
  }, [torneoSel])

  function showMsg(text, type = 'ok') {
    setMsg({ text, type })
    setTimeout(() => setMsg(null), 3500)
  }

  async function fetchEquiposInscritos() {
    const { data } = await supabase
      .from('tournament_teams')
      .select('*, teams(*)')
      .eq('tournament_id', torneoSel)
    setEquiposInscritos(data || [])
  }

  async function handleSeleccionarEquipo(equipo) {
    setEquipoSel(equipo)
    setEquipoSearch('')
    // Traer todos los jugadores del equipo desde BD
    const { data: jugadores } = await supabase
      .from('players')
      .select('*')
      .order('name')
    setJugadoresEquipo(jugadores || [])
    // Traer jugadores ya inscritos en este torneo+equipo
    const { data: inscritos } = await supabase
      .from('tournament_player_registrations')
      .select('*, players(*)')
      .eq('tournament_id', torneoSel)
      .eq('team_id', equipo.id)
      .eq('activo', true)
    setJugadoresInscritos(inscritos || [])
  }

  async function handleInscribirEquipo() {
    if (!torneoSel || !equipoSel) return showMsg('Selecciona torneo y equipo', 'error')
    setLoading(true)
    // Verificar si ya está inscrito
    const { data: existe } = await supabase
      .from('tournament_teams')
      .select('id')
      .eq('tournament_id', torneoSel)
      .eq('team_id', equipoSel.id)
      .single()
    if (existe) {
      showMsg('Este equipo ya está inscrito en este torneo', 'error')
      setLoading(false)
      return
    }
    const { error } = await supabase.from('tournament_teams').insert({
      tournament_id: torneoSel,
      team_id: equipoSel.id,
    })
    if (error) showMsg('Error al inscribir equipo', 'error')
    else { showMsg('Equipo inscrito ✓'); fetchEquiposInscritos() }
    setLoading(false)
  }

  function abrirCrearEquipo() {
    setNuevoEquipoForm({ name: equipoSearch, city: '', representante_nombre: '', representante_cedula: '', representante_telefono: '' })
    setPersonaCedula(null)
    setNuevoEquipoLogo(null); setNuevoEquipoLogoPreview(null)
    setMostrarCrearEquipo(true)
  }

  // La cédula solo debe tener UN nombre en toda la plataforma. Primero se
  // busca si ya es un jugador/árbitro registrado; si no, si ya es dueño de
  // otro equipo. En cualquier caso se autocompletan nombre y teléfono.
  async function buscarDuenoPorCedula(cedula) {
    const c = (cedula || '').trim()
    if (!c) { setPersonaCedula(null); return }
    const persona = await buscarPersonaPorCedula(c)
    if (persona) {
      setPersonaCedula(persona)
      setNuevoEquipoForm(f => ({ ...f, representante_nombre: persona.name || f.representante_nombre, representante_telefono: persona.telefono || f.representante_telefono }))
      showMsg(`👤 ${persona.name} ya está registrado en Golmebol — datos completados`)
      return
    }
    setPersonaCedula(null)
    const equipo = await buscarDuenoEquipoPorCedula(c)
    if (equipo) {
      setNuevoEquipoForm(f => ({ ...f, representante_nombre: equipo.representante_nombre || f.representante_nombre, representante_telefono: equipo.representante_telefono || f.representante_telefono }))
      showMsg(`👤 Dueño encontrado: ${equipo.representante_nombre} — datos completados`)
    }
  }

  function handleNuevoEquipoLogo(file) {
    if (!file) return
    setNuevoEquipoLogo(file)
    setNuevoEquipoLogoPreview(URL.createObjectURL(file))
  }

  // Usa un equipo ya existente (con nombre parecido) en vez de crear uno
  // nuevo — lo inscribe en este torneo (si no lo estaba ya) y lo deja
  // seleccionado, conservando toda su historia.
  async function usarEquipoExistente(equipo) {
    if (creandoEquipoRef.current) return
    creandoEquipoRef.current = true
    setCreandoEquipo(true)
    try {
      const { data: existe } = await supabase.from('tournament_teams').select('id')
        .eq('tournament_id', torneoSel).eq('team_id', equipo.id).single()
      if (!existe) {
        const { error: errorLink } = await supabase.from('tournament_teams').insert({ tournament_id: torneoSel, team_id: equipo.id })
        if (errorLink) { showMsg('No se pudo inscribir el equipo', 'error'); return }
      }
      showMsg(`${equipo.name} inscrito en el torneo ✓ — se conserva toda su historia`)
      setParecidosCrear([])
      setMostrarCrearEquipo(false)
      await handleSeleccionarEquipo(equipo)
      fetchEquiposInscritos()
    } finally {
      creandoEquipoRef.current = false
      setCreandoEquipo(false)
    }
  }

  // Crea el equipo (con su representante y escudo), lo inscribe en el torneo y lo deja seleccionado
  async function handleCrearEquipoYSeleccionar(forzar = false) {
    if (creandoEquipoRef.current) return
    if (!nuevoEquipoForm.name.trim())                 return showMsg('El nombre del equipo es obligatorio', 'error')
    if (!nuevoEquipoForm.representante_nombre.trim()) return showMsg('El representante del equipo es obligatorio', 'error')
    creandoEquipoRef.current = true
    setCreandoEquipo(true)
    try {
      if (!forzar) {
        const parecidos = await buscarEquiposParecidos(nuevoEquipoForm.name)
        if (parecidos.length > 0) { setParecidosCrear(parecidos); return }
      }
      setParecidosCrear([])
      let { data: nuevo, error } = await supabase.from('teams').insert({
        name: nuevoEquipoForm.name.trim(),
        city: nuevoEquipoForm.city.trim() || null,
        representante_nombre: nuevoEquipoForm.representante_nombre.trim(),
        representante_cedula: nuevoEquipoForm.representante_cedula.trim() || null,
        representante_telefono: nuevoEquipoForm.representante_telefono.trim() || null,
      }).select().single()
      if (error && (error.message || '').includes('representante_cedula')) {
        // BD sin la migración de la cédula: crear sin ella para no bloquear
        ;({ data: nuevo, error } = await supabase.from('teams').insert({
          name: nuevoEquipoForm.name.trim(), city: nuevoEquipoForm.city.trim() || null,
          representante_nombre: nuevoEquipoForm.representante_nombre.trim(),
          representante_telefono: nuevoEquipoForm.representante_telefono.trim() || null,
        }).select().single())
      }
      if (error) { showMsg('Error al crear el equipo', 'error'); return }
      if (nuevoEquipoLogo) {
        const path = `logos/${nuevo.id}.${nuevoEquipoLogo.name.split('.').pop()}`
        const { error: errorLogo } = await supabase.storage.from('teams').upload(path, nuevoEquipoLogo, { upsert: true })
        if (!errorLogo) {
          const { data: urlData } = supabase.storage.from('teams').getPublicUrl(path)
          await supabase.from('teams').update({ logo_url: urlData.publicUrl }).eq('id', nuevo.id)
          nuevo.logo_url = urlData.publicUrl
        }
      }
      const { error: errorLink } = await supabase.from('tournament_teams').insert({ tournament_id: torneoSel, team_id: nuevo.id })
      if (errorLink) { showMsg('Equipo creado pero no se pudo inscribir en el torneo', 'error'); return }
      setEquipos(prev => [...prev, nuevo].sort((a, b) => a.name.localeCompare(b.name)))
      showMsg(`${nuevo.name} creado e inscrito en el torneo ✓`)
      setMostrarCrearEquipo(false)
      await handleSeleccionarEquipo(nuevo)
      fetchEquiposInscritos()
    } finally {
      creandoEquipoRef.current = false
      setCreandoEquipo(false)
    }
  }

  async function handleAgregarJugador(jugador) {
  const yaInscrito = jugadoresInscritos.find(j => j.player_id === jugador.id)
  if (yaInscrito) return showMsg('Jugador ya inscrito', 'error')

  const limite = torneos.find(t => t.id === torneoSel)?.limite_jugadores_equipo
  if (limite && jugadoresInscritos.length >= limite) {
    return showMsg(`${equipoSel.name} ya llegó al límite de ${limite} jugadores para este torneo`, 'error')
  }

  // 1. Inscribir al torneo
  const { error } = await supabase.from('tournament_player_registrations').insert({
    tournament_id: torneoSel,
    team_id: equipoSel.id,
    player_id: jugador.id,
    activo: true,
  })
  if (error) return showMsg('Error al agregar jugador', 'error')

  // 2. Agregar al equipo global si no existe
  const { data: yaEnEquipo } = await supabase
    .from('team_players')
    .select('id')
    .eq('team_id', equipoSel.id)
    .eq('player_id', jugador.id)
    .single()

  if (!yaEnEquipo) {
    await supabase.from('team_players').insert({
      team_id: equipoSel.id,
      player_id: jugador.id,
      activo: true,
    })
  }

  showMsg('Jugador agregado ✓')
  handleSeleccionarEquipo(equipoSel)
}

  async function handleEliminarJugador(inscripcionId) {
    await supabase.from('tournament_player_registrations').update({ activo: false }).eq('id', inscripcionId)
    handleSeleccionarEquipo(equipoSel)
    showMsg('Jugador removido')
  }

  async function handleEliminarEquipo(tournamentTeamId) {
    if (!confirm('¿Eliminar equipo del torneo?')) return
    await supabase.from('tournament_teams').delete().eq('id', tournamentTeamId)
    fetchEquiposInscritos()
    showMsg('Equipo eliminado del torneo')
  }

  const equiposFiltrados = equipos.filter(e =>
    e.name?.toLowerCase().includes(equipoSearch.toLowerCase())
  )
  const jugadoresFiltrados = jugadoresEquipo.filter(j =>
    j.numero_cedula?.includes(jugadoresSearch) ||
    j.name?.toLowerCase().includes(jugadoresSearch.toLowerCase())
  )
  const torneoNombre = torneos.find(t => t.id === torneoSel)?.name

  return (
    <div>
      {msg && (
        <div style={{ position: 'fixed', top: '1rem', left: '50%', transform: 'translateX(-50%)', background: msg.type === 'error' ? '#d93025' : '#1e8e3e', color: '#fff', borderRadius: '8px', padding: '10px 24px', zIndex: 200, fontSize: '.875rem', boxShadow: '0 4px 12px rgba(0,0,0,.2)' }}>
          {msg.text}
        </div>
      )}

      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#202124', margin: 0 }}>Crear</h1>
        <p style={{ color: '#5f6368', margin: '4px 0 0', fontSize: '.875rem' }}>¿Qué quieres crear?</p>
      </div>

      {/* Opciones */}
      {!tab && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', maxWidth: '500px' }}>
          <div onClick={() => navigate('/admin/torneos')}
            style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', padding: '24px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', boxShadow: '0 1px 3px rgba(0,0,0,.08)', transition: 'all .2s' }}
            onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,.12)'}
            onMouseLeave={e => e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,.08)'}
          >
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#e8f0fe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Trophy size={24} color="#1a73e8"/>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontWeight: '600', color: '#202124', fontSize: '.9rem' }}>Nuevo Torneo</div>
              <div style={{ color: '#9aa0a6', fontSize: '.75rem', marginTop: '4px' }}>Crea y configura un torneo</div>
            </div>
          </div>

          <div onClick={() => setTab('equipo')}
            style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', padding: '24px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', boxShadow: '0 1px 3px rgba(0,0,0,.08)', transition: 'all .2s' }}
            onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,.12)'}
            onMouseLeave={e => e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,.08)'}
          >
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#e6f4ea', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Shield size={24} color="#1e8e3e"/>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontWeight: '600', color: '#202124', fontSize: '.9rem' }}>Inscribir Equipo</div>
              <div style={{ color: '#9aa0a6', fontSize: '.75rem', marginTop: '4px' }}>Agrega equipos a un torneo</div>
            </div>
          </div>
        </div>
      )}

      {/* ── Inscribir equipo ── */}
      {tab === 'equipo' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
            <button onClick={() => { setTab(null); setEquipoSel(null); setTorneoSel('') }}
              style={{ background: 'none', border: '1px solid #dadce0', borderRadius: '8px', padding: '6px 14px', cursor: 'pointer', color: '#5f6368', fontSize: '.875rem' }}>
              ← Volver
            </button>
            <h2 style={{ fontSize: '1rem', fontWeight: '600', color: '#202124', margin: 0 }}>Inscribir equipo a torneo</h2>
          </div>

          {/* Paso 1 — Seleccionar torneo */}
          <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', padding: '20px', marginBottom: '16px', boxShadow: '0 1px 3px rgba(0,0,0,.08)' }}>
            <div style={{ fontWeight: '600', color: '#202124', fontSize: '.9rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#1a73e8', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '.75rem', fontWeight: '700' }}>1</div>
              Selecciona el torneo
            </div>
            <select value={torneoSel} onChange={e => { setTorneoSel(e.target.value); setEquipoSel(null) }} style={input}>
              <option value="">Seleccionar torneo...</option>
              {torneos.map(t => <option key={t.id} value={t.id}>{t.name} {t.season && `· ${t.season}`}</option>)}
            </select>
          </div>

          {torneoSel && (
            <>
              {/* Paso 2 — Buscar y seleccionar equipo */}
              <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', padding: '20px', marginBottom: '16px', boxShadow: '0 1px 3px rgba(0,0,0,.08)' }}>
                <div style={{ fontWeight: '600', color: '#202124', fontSize: '.9rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#1a73e8', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '.75rem', fontWeight: '700' }}>2</div>
                  Busca y selecciona el equipo
                </div>

                {equipoSel ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#e6f4ea', borderRadius: '8px', border: '1px solid #ceead6' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {equipoSel.logo_url
                        ? <img src={equipoSel.logo_url} style={{ width: '32px', height: '32px', borderRadius: '6px', objectFit: 'contain' }}/>
                        : <Shield size={20} color="#1e8e3e"/>
                      }
                      <div>
                        <div style={{ fontWeight: '600', color: '#202124', fontSize: '.875rem' }}>{equipoSel.name}</div>
                        {equipoSel.representante_nombre && <div style={{ fontSize: '.72rem', color: '#5f6368' }}>👤 {equipoSel.representante_nombre}</div>}
                      </div>
                    </div>
                    <button onClick={() => setEquipoSel(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#5f6368' }}><X size={16}/></button>
                  </div>
                ) : mostrarCrearEquipo ? (
                  <div>
                    <div style={{ fontSize: '.8rem', color: '#5f6368', marginBottom: '14px' }}>
                      Se crea el equipo y queda inscrito en este torneo de una vez.
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <label style={{ width: '56px', height: '56px', borderRadius: '10px', border: '2px dashed #dadce0', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, overflow: 'hidden', background: '#f8f9fa' }}>
                          {nuevoEquipoLogoPreview
                            ? <img src={nuevoEquipoLogoPreview} style={{ width: '100%', height: '100%', objectFit: 'contain' }}/>
                            : <Shield size={22} color="#9aa0a6"/>
                          }
                          <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleNuevoEquipoLogo(e.target.files[0])}/>
                        </label>
                        <div>
                          <div style={{ fontSize: '.8rem', fontWeight: '600', color: '#202124' }}>Escudo del equipo</div>
                          <div style={{ fontSize: '.72rem', color: '#9aa0a6' }}>{nuevoEquipoLogoPreview ? 'Imagen seleccionada' : 'Opcional — podés subirlo después'}</div>
                        </div>
                      </div>
                      <div><label style={label}>Nombre del equipo *</label><input value={nuevoEquipoForm.name} onChange={e => setNuevoEquipoForm(f => ({ ...f, name: e.target.value }))} placeholder="Nombre del equipo" style={input}/></div>
                      <div><label style={label}>Ciudad</label><input value={nuevoEquipoForm.city} onChange={e => setNuevoEquipoForm(f => ({ ...f, city: e.target.value }))} placeholder="Ciudad" style={input}/></div>
                      <div>
                        <label style={label}>Cédula del dueño</label>
                        <input value={nuevoEquipoForm.representante_cedula} onChange={e => { setNuevoEquipoForm(f => ({ ...f, representante_cedula: e.target.value })); setPersonaCedula(null) }} onBlur={e => buscarDuenoPorCedula(e.target.value)} placeholder="Número de cédula" type="number" style={input}/>
                        {personaCedula ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#e8f0fe', border: '1px solid #aecbfa', borderRadius: '10px', padding: '8px 10px', marginTop: '6px' }}>
                            <span style={{ fontSize: '.78rem', color: '#202124' }}>👤 <strong>{personaCedula.name}</strong> ya está registrado como {rolActualLabel(personaCedula)}</span>
                            <a href={`/admin/jugadores/${personaCedula.id}`} target="_blank" rel="noreferrer" style={{ fontSize: '.72rem', color: '#1a73e8', fontWeight: '700', textDecoration: 'none', marginLeft: 'auto', whiteSpace: 'nowrap' }}>Ver perfil →</a>
                          </div>
                        ) : (
                          <div style={{ fontSize: '.68rem', color: '#9aa0a6', marginTop: '3px' }}>Si ya está registrada en Golmebol (jugador, árbitro o dueño de otro equipo), se completan nombre y teléfono solos</div>
                        )}
                      </div>
                      <div><label style={label}>Representante / dueño del equipo *</label><input value={nuevoEquipoForm.representante_nombre} onChange={e => setNuevoEquipoForm(f => ({ ...f, representante_nombre: e.target.value }))} placeholder="Nombre completo" style={input}/></div>
                      <div><label style={label}>Teléfono del representante</label><input value={nuevoEquipoForm.representante_telefono} onChange={e => setNuevoEquipoForm(f => ({ ...f, representante_telefono: e.target.value }))} placeholder="300 000 0000" style={input}/></div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                      <button onClick={() => handleCrearEquipoYSeleccionar()} disabled={creandoEquipo}
                        style={{ flex: 1, padding: '9px', background: '#1e8e3e', border: 'none', borderRadius: '8px', cursor: 'pointer', color: '#fff', fontSize: '.875rem', fontWeight: '600', opacity: creandoEquipo ? .7 : 1 }}>
                        {creandoEquipo ? 'Creando...' : '+ Crear e inscribir'}
                      </button>
                      <button onClick={() => { setMostrarCrearEquipo(false); setParecidosCrear([]) }} style={{ padding: '9px 16px', background: '#fff', border: '1px solid #dadce0', borderRadius: '8px', cursor: 'pointer', color: '#5f6368' }}>Volver</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ position: 'relative' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', border: '1px solid #dadce0', borderRadius: '8px', background: '#fff' }}>
                      <Search size={16} color="#9aa0a6"/>
                      <input
                        value={equipoSearch}
                        onChange={e => setEquipoSearch(e.target.value)}
                        placeholder="Buscar equipo..."
                        style={{ border: 'none', outline: 'none', flex: 1, fontSize: '.875rem', color: '#202124', background: 'transparent' }}
                      />
                    </div>
                    {equipoSearch && (
                      <div style={{ position: 'absolute', top: '44px', left: 0, right: 0, background: '#fff', border: '1px solid #e8eaed', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,.12)', zIndex: 50, maxHeight: '260px', overflowY: 'auto' }}>
                        {equiposFiltrados.length === 0 ? (
                          <div style={{ padding: '14px 16px', textAlign: 'center' }}>
                            <div style={{ color: '#9aa0a6', fontSize: '.875rem', marginBottom: '10px' }}>No se encontró ningún equipo con ese nombre</div>
                            <button onClick={abrirCrearEquipo} style={{ padding: '7px 16px', background: '#1e8e3e', border: 'none', borderRadius: '8px', cursor: 'pointer', color: '#fff', fontSize: '.8rem', fontWeight: '600' }}>+ Crear equipo nuevo</button>
                          </div>
                        ) : (
                          <>
                            <div style={{ padding: '8px 16px 0', fontSize: '.68rem', color: '#9aa0a6' }}>Revisá el escudo y el representante — puede haber nombres parecidos.</div>
                            {equiposFiltrados.map(e => (
                              <div key={e.id} onClick={() => handleSeleccionarEquipo(e)}
                                style={{ padding: '10px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid #f1f3f4' }}
                                onMouseEnter={ev => ev.currentTarget.style.background = '#f8f9fa'}
                                onMouseLeave={ev => ev.currentTarget.style.background = '#fff'}
                              >
                                {e.logo_url
                                  ? <img src={e.logo_url} style={{ width: '28px', height: '28px', borderRadius: '6px', objectFit: 'contain' }}/>
                                  : <Shield size={18} color="#9aa0a6"/>
                                }
                                <div>
                                  <div style={{ fontWeight: '500', color: '#202124', fontSize: '.875rem' }}>{e.name}</div>
                                  {e.city && <div style={{ color: '#9aa0a6', fontSize: '.75rem' }}>{e.city}</div>}
                                  <div style={{ fontSize: '.7rem', color: e.representante_nombre ? '#1a73e8' : '#d93025' }}>
                                    {e.representante_nombre ? `👤 ${e.representante_nombre}` : '⚠️ Sin representante'}
                                  </div>
                                </div>
                              </div>
                            ))}
                            <div style={{ padding: '8px 16px' }}>
                              <button onClick={abrirCrearEquipo} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#5f6368', fontSize: '.75rem', textDecoration: 'underline' }}>¿No es ninguno de estos? Crear equipo nuevo</button>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {equipoSel && (
                  <button onClick={handleInscribirEquipo} disabled={loading}
                    style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px', background: '#1a73e8', border: 'none', borderRadius: '8px', padding: '8px 16px', cursor: 'pointer', color: '#fff', fontSize: '.875rem', fontWeight: '500', opacity: loading ? .7 : 1 }}>
                    <Plus size={16}/> {loading ? 'Inscribiendo...' : 'Inscribir equipo'}
                  </button>
                )}
              </div>

              {/* Paso 3 — Gestionar jugadores inscritos */}
              {equipoSel && (
                <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', padding: '20px', marginBottom: '16px', boxShadow: '0 1px 3px rgba(0,0,0,.08)' }}>
                  <div style={{ fontWeight: '600', color: '#202124', fontSize: '.9rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#1a73e8', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '.75rem', fontWeight: '700' }}>3</div>
                    Jugadores inscritos en {equipoSel.name} — {torneoNombre}
                  </div>

                  {/* Jugadores ya inscritos */}
                  {jugadoresInscritos.length > 0 && (
                    <div style={{ marginBottom: '16px' }}>
                      <div style={{ fontSize: '.75rem', fontWeight: '600', color: '#1e8e3e', marginBottom: '8px' }}>INSCRITOS ({jugadoresInscritos.length})</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {jugadoresInscritos.map(ins => (
                          <div key={ins.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: '#e6f4ea', borderRadius: '8px', border: '1px solid #ceead6' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              {ins.players?.photo_url
                                ? <img src={ins.players.photo_url} style={{ width: '30px', height: '30px', borderRadius: '50%', objectFit: 'cover' }}/>
                                : <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: '#ceead6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Users size={14} color="#1e8e3e"/></div>
                              }
                              <div>
                                <div style={{ fontWeight: '500', color: '#202124', fontSize: '.875rem' }}>{ins.players?.name}</div>
                                <div style={{ color: '#9aa0a6', fontSize: '.72rem' }}>
                                  {ins.players?.posicion_futbol5 && `F5: ${ins.players.posicion_futbol5}`}
                                  {ins.players?.posicion_futbol7 && ` · F7: ${ins.players.posicion_futbol7}`}
                                  {ins.players?.posicion_futbol11 && ` · F11: ${ins.players.posicion_futbol11}`}
                                </div>
                              </div>
                            </div>
                            <button onClick={() => handleEliminarJugador(ins.id)}
                              style={{ background: 'none', border: '1px solid #fad2cf', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', color: '#d93025', display: 'flex', alignItems: 'center' }}>
                              <X size={14}/>
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Buscar y agregar jugadores */}
                  <div style={{ fontSize: '.75rem', fontWeight: '600', color: '#5f6368', marginBottom: '8px' }}>AGREGAR JUGADORES</div>
                  <input
  value={jugadoresSearch}
  onChange={e => setJugadoresSearch(e.target.value)}
  placeholder="Buscar por número de cédula..."
                    style={{ ...input, marginBottom: '8px' }}
                  />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '200px', overflowY: 'auto' }}>
                    {jugadoresFiltrados.map(j => {
                      const yaInscrito = jugadoresInscritos.find(ins => ins.player_id === j.id)
                      return (
                        <div key={j.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: yaInscrito ? '#f8f9fa' : '#fff', borderRadius: '8px', border: '1px solid #e8eaed' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            {j.photo_url
                              ? <img src={j.photo_url} style={{ width: '30px', height: '30px', borderRadius: '50%', objectFit: 'cover' }}/>
                              : <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: '#f1f3f4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Users size={14} color="#9aa0a6"/></div>
                            }
                            <div>
                              <div style={{ fontWeight: '500', color: yaInscrito ? '#9aa0a6' : '#202124', fontSize: '.875rem' }}>{j.name}</div>
                              <div style={{ color: '#9aa0a6', fontSize: '.72rem' }}>{j.city} {j.telefono && `· ${j.telefono}`}</div>
                            </div>
                          </div>
                          {yaInscrito ? (
                            <span style={{ fontSize: '.75rem', color: '#1e8e3e', display: 'flex', alignItems: 'center', gap: '4px' }}><Check size={14}/> Inscrito</span>
                          ) : (
                            <button onClick={() => handleAgregarJugador(j)}
                              style={{ background: '#1a73e8', border: 'none', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', color: '#fff', fontSize: '.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Plus size={13}/> Agregar
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Equipos ya inscritos en el torneo */}
              {equiposInscritos.length > 0 && (
                <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,.08)' }}>
                  <div style={{ fontWeight: '600', color: '#202124', fontSize: '.9rem', marginBottom: '16px' }}>
                    Equipos inscritos en {torneoNombre} ({equiposInscritos.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {equiposInscritos.map(ei => (
                      <div key={ei.id}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#f8f9fa', borderRadius: '8px', border: '1px solid #e8eaed' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}
                            onClick={() => setExpandedEquipo(expandedEquipo === ei.id ? null : ei.id)}>
                            {ei.teams?.logo_url
                              ? <img src={ei.teams.logo_url} style={{ width: '32px', height: '32px', borderRadius: '6px', objectFit: 'contain' }}/>
                              : <Shield size={20} color="#9aa0a6"/>
                            }
                            <span style={{ fontWeight: '500', color: '#202124', fontSize: '.875rem' }}>{ei.teams?.name}</span>
                            {expandedEquipo === ei.id ? <ChevronUp size={16} color="#9aa0a6"/> : <ChevronDown size={16} color="#9aa0a6"/>}
                          </div>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button onClick={() => handleSeleccionarEquipo(ei.teams)}
                              style={{ background: 'none', border: '1px solid #1a73e8', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', color: '#1a73e8', fontSize: '.75rem' }}>
                              Gestionar
                            </button>
                            <button onClick={() => handleEliminarEquipo(ei.id)}
                              style={{ background: 'none', border: '1px solid #fad2cf', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', color: '#d93025', display: 'flex', alignItems: 'center' }}>
                              <X size={14}/>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {parecidosCrear.length > 0 && (
        <ModalEquipoParecido
          equipos={parecidosCrear}
          creando={creandoEquipo}
          onUsar={usarEquipoExistente}
          onCrearNuevo={() => handleCrearEquipoYSeleccionar(true)}
          onCancelar={() => setParecidosCrear([])}
        />
      )}
    </div>
  )
}
