import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Shield, Check, Users } from 'lucide-react'

const POSICIONES = {
  'Fútbol 5':  ['Portero', 'Cierre', 'Ala derecha', 'Ala izquierda', 'Pivot'],
  'Fútbol 7':  ['Portero', 'Defensa central', 'Lateral derecho', 'Lateral izquierdo', 'Mediocampista', 'Extremo derecho', 'Extremo izquierdo', 'Delantero'],
  'Fútbol 11': ['Portero', 'Defensa central', 'Lateral derecho', 'Lateral izquierdo', 'Mediocampista defensivo', 'Mediocampista central', 'Mediocampista ofensivo', 'Extremo derecho', 'Extremo izquierdo', 'Delantero centro', 'Segunda punta'],
}

const inputStyle = {
  width: '100%', background: '#fff', border: '1px solid #dadce0',
  borderRadius: '10px', padding: '10px 14px', color: '#202124',
  fontSize: '.9rem', outline: 'none', boxSizing: 'border-box',
  fontFamily: 'system-ui, sans-serif',
}
const labelStyle = {
  fontSize: '.75rem', fontWeight: '600', color: '#5f6368',
  display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '.05em',
}

const EMPTY_FORM = {
  name: '', telefono: '', city: '', genero: '', fecha_nacimiento: '',
  posicion_futbol5: '', posicion_futbol7: '', posicion_futbol11: '',
}

export default function RegistroEquipoPage() {
  const { token } = useParams()

  const [equipo,         setEquipo]         = useState(null)
  const [loading,        setLoading]        = useState(true)
  const [cedula,         setCedula]         = useState('')
  const [buscando,       setBuscando]       = useState(false)
  const [jugadorExiste,  setJugadorExiste]  = useState(null)
  const [mostrarNuevo,   setMostrarNuevo]   = useState(false)
  const [formNuevo,      setFormNuevo]      = useState(EMPTY_FORM)
  const [guardando,      setGuardando]      = useState(false)
  const [msg,            setMsg]            = useState(null)
  const [yaRegistrado,   setYaRegistrado]   = useState(false)
  const [exito,          setExito]          = useState(false)

  useEffect(() => { fetchEquipo() }, [token])

  async function fetchEquipo() {
    const { data } = await supabase.from('teams').select('*').eq('registro_token', token).single()
    setEquipo(data)
    setLoading(false)
  }

  function showMsg(text, type = 'error') {
    setMsg({ text, type })
    setTimeout(() => setMsg(null), 4000)
  }

  async function handleBuscarCedula() {
    if (!cedula.trim()) return showMsg('Ingresa tu número de cédula')
    setBuscando(true)
    setJugadorExiste(null)
    setMostrarNuevo(false)
    setYaRegistrado(false)

    // Buscar si ya está en el equipo
    const { data: jugador } = await supabase.from('players').select('*').eq('numero_cedula', cedula.trim()).single()

    if (jugador) {
      // Verificar si ya está en team_players
      const { data: yaEsta } = await supabase.from('team_players').select('id').eq('team_id', equipo.id).eq('player_id', jugador.id).single()
      if (yaEsta) {
        setYaRegistrado(true)
        setBuscando(false)
        return
      }
      setJugadorExiste(jugador)
    } else {
      setMostrarNuevo(true)
      setFormNuevo({ ...EMPTY_FORM, numero_cedula: cedula.trim() })
    }
    setBuscando(false)
  }

  async function handleConfirmarExistente() {
    setGuardando(true)
    const { error } = await supabase.from('team_players').insert({ team_id: equipo.id, player_id: jugadorExiste.id, activo: false })
    if (error) { showMsg('Error al registrarte. Intenta de nuevo.'); setGuardando(false); return }
    setExito(true)
    setGuardando(false)
  }

  async function handleCrearYRegistrar() {
    if (!formNuevo.name)             return showMsg('El nombre es obligatorio')
    if (!formNuevo.telefono)         return showMsg('El teléfono es obligatorio')
    if (!formNuevo.city)             return showMsg('La ciudad es obligatoria')
    if (!formNuevo.genero)           return showMsg('El género es obligatorio')
    if (!formNuevo.fecha_nacimiento) return showMsg('La fecha de nacimiento es obligatoria')
    if (!formNuevo.posicion_futbol5 && !formNuevo.posicion_futbol7 && !formNuevo.posicion_futbol11)
      return showMsg('Selecciona al menos una posición')

    setGuardando(true)
    const { data: nuevo, error } = await supabase.from('players').insert({ ...formNuevo, numero_cedula: cedula.trim() }).select().single()
    if (error) { showMsg('Error al crear el jugador. Intenta de nuevo.'); setGuardando(false); return }

    const { error: e2 } = await supabase.from('team_players').insert({ team_id: equipo.id, player_id: nuevo.id, activo: false })
    if (e2) { showMsg('Jugador creado pero error al unirte al equipo.'); setGuardando(false); return }

    setExito(true)
    setGuardando(false)
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#f8f9fa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#1a73e8', fontSize: '.9rem' }}>Cargando...</div>
    </div>
  )

  if (!equipo) return (
    <div style={{ minHeight: '100vh', background: '#f8f9fa', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '12px' }}>
      <Shield size={48} color="#dadce0"/>
      <div style={{ color: '#9aa0a6', fontSize: '.9rem' }}>Link de registro inválido o expirado</div>
    </div>
  )

  if (exito) return (
    <div style={{ minHeight: '100vh', background: '#f8f9fa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: '16px', padding: '40px', textAlign: 'center', maxWidth: '360px', width: '90%', boxShadow: '0 4px 20px rgba(0,0,0,.08)' }}>
        <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#e6f4ea', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <Check size={32} color="#1e8e3e"/>
        </div>
        <div style={{ fontSize: '1.2rem', fontWeight: '700', color: '#202124', marginBottom: '8px' }}>¡Registrado!</div>
        <div style={{ fontSize: '.875rem', color: '#5f6368', lineHeight: 1.5 }}>
          Ya eres parte del equipo <strong>{equipo.name}</strong>.<br/>
          El admin del equipo te asignará a los torneos correspondientes.
        </div>
        <div style={{ marginTop: '20px', padding: '12px', background: '#f8f9fa', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#e8f0fe', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {equipo.logo_url ? <img src={equipo.logo_url} style={{ width: '100%', height: '100%', objectFit: 'contain' }}/> : <Shield size={20} color="#1a73e8"/>}
          </div>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontWeight: '600', color: '#202124', fontSize: '.875rem' }}>{equipo.name}</div>
            {equipo.city && <div style={{ fontSize: '.75rem', color: '#9aa0a6' }}>📍 {equipo.city}</div>}
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#f8f9fa' }}>

      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #1a237e 0%, #1a73e8 100%)', padding: '32px 20px', textAlign: 'center' }}>
        <div style={{ width: '72px', height: '72px', borderRadius: '16px', background: 'rgba(255,255,255,.15)', border: '2px solid rgba(255,255,255,.3)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
          {equipo.logo_url ? <img src={equipo.logo_url} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '6px' }}/> : <Shield size={36} color="#fff"/>}
        </div>
        <h1 style={{ color: '#fff', fontSize: '1.4rem', fontWeight: '800', margin: '0 0 4px' }}>{equipo.name}</h1>
        <div style={{ color: 'rgba(255,255,255,.7)', fontSize: '.85rem' }}>Registro de jugadores</div>
      </div>

      <div style={{ maxWidth: '480px', margin: '0 auto', padding: '24px 16px' }}>

        {msg && (
          <div style={{ background: msg.type === 'ok' ? '#e6f4ea' : '#fce8e6', border: `1px solid ${msg.type === 'ok' ? '#ceead6' : '#fad2cf'}`, color: msg.type === 'ok' ? '#1e8e3e' : '#d93025', borderRadius: '10px', padding: '12px 16px', marginBottom: '16px', fontSize: '.875rem' }}>
            {msg.text}
          </div>
        )}

        {/* Paso 1 — Cédula */}
        {!jugadorExiste && !mostrarNuevo && !yaRegistrado && (
          <div style={{ background: '#fff', borderRadius: '16px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,.06)', border: '1px solid #e8eaed' }}>
            <div style={{ fontWeight: '700', color: '#202124', fontSize: '1rem', marginBottom: '4px' }}>Ingresa tu cédula</div>
            <div style={{ fontSize: '.8rem', color: '#9aa0a6', marginBottom: '20px' }}>Con tu número de cédula verificamos si ya estás registrado en Golmebol</div>
            <label style={labelStyle}>Número de cédula</label>
            <input
              value={cedula}
              onChange={e => setCedula(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleBuscarCedula()}
              placeholder="Ej: 1094948981"
              style={inputStyle}
              type="number"
            />
            <button onClick={handleBuscarCedula} disabled={buscando}
              style={{ width: '100%', marginTop: '14px', padding: '12px', background: '#1a73e8', border: 'none', borderRadius: '10px', cursor: 'pointer', color: '#fff', fontSize: '.9rem', fontWeight: '600', opacity: buscando ? .7 : 1 }}>
              {buscando ? 'Buscando...' : 'Continuar →'}
            </button>
          </div>
        )}

        {/* Ya registrado */}
        {yaRegistrado && (
          <div style={{ background: '#fff', borderRadius: '16px', padding: '28px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,.06)', border: '1px solid #e8eaed' }}>
            <div style={{ fontSize: '2rem', marginBottom: '12px' }}>✅</div>
            <div style={{ fontWeight: '700', color: '#202124', fontSize: '1rem', marginBottom: '8px' }}>Ya eres parte del equipo</div>
            <div style={{ fontSize: '.875rem', color: '#5f6368' }}>La cédula <strong>{cedula}</strong> ya está registrada en <strong>{equipo.name}</strong>.</div>
            <button onClick={() => { setCedula(''); setYaRegistrado(false) }} style={{ marginTop: '16px', padding: '8px 20px', background: '#f1f3f4', border: 'none', borderRadius: '8px', cursor: 'pointer', color: '#5f6368', fontSize: '.875rem' }}>
              Registrar otra cédula
            </button>
          </div>
        )}

        {/* Jugador encontrado */}
        {jugadorExiste && (
          <div style={{ background: '#fff', borderRadius: '16px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,.06)', border: '1px solid #e8eaed' }}>
            <div style={{ background: '#e6f4ea', border: '1px solid #ceead6', borderRadius: '10px', padding: '16px', marginBottom: '20px' }}>
              <div style={{ fontSize: '.72rem', fontWeight: '700', color: '#1e8e3e', marginBottom: '10px', letterSpacing: '.05em' }}>✓ JUGADOR ENCONTRADO EN GOLMEBOL</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: '#ceead6', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {jugadorExiste.photo_url ? <img src={jugadorExiste.photo_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/> : <Users size={24} color="#1e8e3e"/>}
                </div>
                <div>
                  <div style={{ fontWeight: '700', color: '#202124', fontSize: '1rem' }}>{jugadorExiste.name}</div>
                  <div style={{ fontSize: '.8rem', color: '#5f6368', marginTop: '2px' }}>🪪 {jugadorExiste.numero_cedula}</div>
                  {jugadorExiste.city && <div style={{ fontSize: '.8rem', color: '#5f6368' }}>📍 {jugadorExiste.city}</div>}
                </div>
              </div>
            </div>
            <div style={{ fontSize: '.85rem', color: '#5f6368', marginBottom: '16px' }}>
              ¿Eres tú? Confirma para unirte al equipo <strong>{equipo.name}</strong>.
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={handleConfirmarExistente} disabled={guardando}
                style={{ flex: 1, padding: '12px', background: '#1a73e8', border: 'none', borderRadius: '10px', cursor: 'pointer', color: '#fff', fontSize: '.9rem', fontWeight: '600', opacity: guardando ? .7 : 1 }}>
                {guardando ? 'Registrando...' : '✓ Confirmar y unirme'}
              </button>
              <button onClick={() => { setJugadorExiste(null); setCedula('') }}
                style={{ padding: '12px 16px', background: '#f1f3f4', border: 'none', borderRadius: '10px', cursor: 'pointer', color: '#5f6368', fontSize: '.875rem' }}>
                No soy yo
              </button>
            </div>
          </div>
        )}

        {/* Jugador nuevo */}
        {mostrarNuevo && (
          <div style={{ background: '#fff', borderRadius: '16px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,.06)', border: '1px solid #e8eaed' }}>
            <div style={{ background: '#fce8e6', border: '1px solid #fad2cf', borderRadius: '10px', padding: '12px 16px', marginBottom: '20px' }}>
              <div style={{ fontSize: '.8rem', color: '#d93025', fontWeight: '600' }}>
                ⚠️ Cédula <strong>{cedula}</strong> no está registrada en Golmebol
              </div>
              <div style={{ fontSize: '.75rem', color: '#d93025', marginTop: '4px' }}>Completa tus datos para registrarte</div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={labelStyle}>Nombre completo *</label>
                <input value={formNuevo.name} onChange={e => setFormNuevo(f => ({ ...f, name: e.target.value }))} style={inputStyle} placeholder="Tu nombre completo"/>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>Teléfono *</label>
                  <input value={formNuevo.telefono} onChange={e => setFormNuevo(f => ({ ...f, telefono: e.target.value }))} style={inputStyle} placeholder="300 000 0000" type="tel"/>
                </div>
                <div>
                  <label style={labelStyle}>Ciudad *</label>
                  <input value={formNuevo.city} onChange={e => setFormNuevo(f => ({ ...f, city: e.target.value }))} style={inputStyle} placeholder="Tu ciudad"/>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>Género *</label>
                  <select value={formNuevo.genero} onChange={e => setFormNuevo(f => ({ ...f, genero: e.target.value }))} style={inputStyle}>
                    <option value="">Seleccionar</option>
                    <option value="Masculino">Masculino</option>
                    <option value="Femenino">Femenino</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Fecha de nacimiento *</label>
                  <input type="date" value={formNuevo.fecha_nacimiento} onChange={e => setFormNuevo(f => ({ ...f, fecha_nacimiento: e.target.value }))} style={inputStyle}/>
                </div>
              </div>

              <div>
                <label style={{ ...labelStyle, marginBottom: '10px' }}>Posición *</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {Object.entries(POSICIONES).map(([mod, posiciones]) => (
                    <div key={mod}>
                      <div style={{ fontSize: '.72rem', color: '#9aa0a6', marginBottom: '4px', fontWeight: '500' }}>{mod}</div>
                      <select value={formNuevo[`posicion_${mod.toLowerCase().replace('ú','u').replace(' ','')}`]}
                        onChange={e => setFormNuevo(f => ({ ...f, [`posicion_${mod.toLowerCase().replace('ú','u').replace(' ','')}`]: e.target.value }))}
                        style={inputStyle}>
                        <option value="">No juego {mod}</option>
                        {posiciones.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '20px' }}>
              <button onClick={handleCrearYRegistrar} disabled={guardando}
                style={{ flex: 1, padding: '12px', background: '#1a73e8', border: 'none', borderRadius: '10px', cursor: 'pointer', color: '#fff', fontSize: '.9rem', fontWeight: '600', opacity: guardando ? .7 : 1 }}>
                {guardando ? 'Registrando...' : '⚽ Registrarme en Golmebol'}
              </button>
              <button onClick={() => { setMostrarNuevo(false); setCedula('') }}
                style={{ padding: '12px 16px', background: '#f1f3f4', border: 'none', borderRadius: '10px', cursor: 'pointer', color: '#5f6368' }}>
                ←
              </button>
            </div>
          </div>
        )}

        <div style={{ textAlign: 'center', marginTop: '24px' }}>
          <span style={{ fontSize: '.75rem', color: '#9aa0a6' }}>Powered by </span>
          <span style={{ fontSize: '.75rem', fontWeight: '700', color: '#1a73e8' }}>GOLMEBOL</span>
        </div>
      </div>
    </div>
  )
}
