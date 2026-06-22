import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function PlayerLoginPage() {
  const navigate  = useNavigate()
  const [cedula,  setCedula]  = useState('')
  const [pass,    setPass]    = useState('')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  async function handleLogin(e) {
    e.preventDefault()
    if (!cedula.trim()) { setError('Ingresa tu número de cédula'); return }
    if (!pass.trim())   { setError('Ingresa tu contraseña'); return }
    setLoading(true); setError('')

    const email = `${cedula.trim()}@golmebol.com`
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password: pass })

    if (authError) {
      setError('Cédula o contraseña incorrecta')
      setLoading(false); return
    }

    const { data: player } = await supabase
      .from('players')
      .select('id, activo_membresia, fecha_vencimiento')
      .eq('numero_cedula', cedula.trim())
      .single()

    if (!player || !player.activo_membresia) {
      await supabase.auth.signOut()
      setError('Tu membresía no está activa. Contacta al administrador.')
      setLoading(false); return
    }

    if (player.fecha_vencimiento && new Date(player.fecha_vencimiento) < new Date()) {
      await supabase.auth.signOut()
      setError('Tu membresía venció. Renueva tu suscripción para continuar.')
      setLoading(false); return
    }

    navigate('/jugador')
  }

  const inp = {
    width: '100%', background: '#fff', border: '1.5px solid #dadce0',
    borderRadius: '10px', padding: '12px 14px', color: '#202124',
    fontSize: '.95rem', outline: 'none', boxSizing: 'border-box',
    fontFamily: 'system-ui, sans-serif', transition: 'border-color .15s',
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8f9fa', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: '380px' }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '60px', height: '60px', borderRadius: '16px', background: '#1a73e8', marginBottom: '14px' }}>
            <span style={{ fontSize: '1.8rem' }}>⚽</span>
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#202124', letterSpacing: '.02em' }}>Golmebol</div>
          <div style={{ fontSize: '.85rem', color: '#5f6368', marginTop: '4px' }}>Portal del Jugador</div>
        </div>

        {/* Card */}
        <div style={{ background: '#fff', borderRadius: '16px', padding: '28px', boxShadow: '0 1px 3px rgba(0,0,0,.1), 0 4px 16px rgba(0,0,0,.06)' }}>
          <div style={{ fontSize: '1rem', fontWeight: '600', color: '#202124', marginBottom: '4px' }}>Iniciar sesión</div>
          <div style={{ fontSize: '.82rem', color: '#5f6368', marginBottom: '24px' }}>Ingresa con tu número de cédula</div>

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '.78rem', fontWeight: '500', color: '#5f6368', marginBottom: '6px' }}>Número de cédula</label>
              <input
                value={cedula} onChange={e => setCedula(e.target.value)}
                placeholder="Ej: 1094948981" type="number" style={inp}
                onFocus={e => e.target.style.borderColor = '#1a73e8'}
                onBlur={e => e.target.style.borderColor = '#dadce0'}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '.78rem', fontWeight: '500', color: '#5f6368', marginBottom: '6px' }}>Contraseña</label>
              <input
                value={pass} onChange={e => setPass(e.target.value)}
                placeholder="Tu contraseña" type="password" style={inp}
                onFocus={e => e.target.style.borderColor = '#1a73e8'}
                onBlur={e => e.target.style.borderColor = '#dadce0'}
              />
            </div>

            {error && (
              <div style={{ background: '#fce8e6', border: '1px solid #fad2cf', borderRadius: '8px', padding: '10px 12px', fontSize: '.82rem', color: '#d93025' }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading}
              style={{ marginTop: '4px', padding: '12px', background: loading ? '#dadce0' : '#1a73e8', border: 'none', borderRadius: '10px', cursor: loading ? 'not-allowed' : 'pointer', color: '#fff', fontWeight: '600', fontSize: '.95rem', transition: 'background .15s' }}>
              {loading ? 'Ingresando...' : 'Ingresar'}
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: '18px', fontSize: '.75rem', color: '#9aa0a6' }}>
            ¿Olvidaste tu contraseña? Contacta al administrador
          </div>
        </div>

        <button onClick={() => navigate('/login')}
          style={{ display: 'block', margin: '16px auto 0', background: 'none', border: 'none', cursor: 'pointer', color: '#9aa0a6', fontSize: '.75rem' }}>
          Acceso administrador →
        </button>
      </div>
    </div>
  )
}
