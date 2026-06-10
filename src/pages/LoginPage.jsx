import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [mensaje, setMensaje] = useState('')

  async function handleLogin() {
    setLoading(true)
    setMensaje('')
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    console.log('Login result:', { data, error })
    if (error) {
      setMensaje('Error: ' + error.message)
      setLoading(false)
      return
    }
    setLoading(false)
  }

  async function handleRegistro() {
    setLoading(true)
    setMensaje('')
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) setMensaje('Error: ' + error.message)
    else setMensaje('✅ Revisa tu email para confirmar tu cuenta')
    setLoading(false)
  }

  return (
    <div style={{ width: '100%', maxWidth: '380px', padding: '3rem 1.5rem' }}>
      <h1 style={{
        fontFamily: 'var(--font-display)',
        fontSize: '3rem',
        letterSpacing: '.2em',
        background: 'linear-gradient(90deg, #00ddd0, #9955ff)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        marginBottom: '2rem',
        textAlign: 'center'
      }}>
        GOLMEBOL
      </h1>
      <input type="email" placeholder="tu@email.com" value={email}
        onChange={e => setEmail(e.target.value)}
        style={{ display: 'block', width: '100%', padding: '.7rem', marginBottom: '.8rem', background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.15)', borderRadius: '8px', color: 'white', fontSize: '1rem' }}
      />
      <input type="password" placeholder="Contraseña" value={password}
        onChange={e => setPassword(e.target.value)}
        style={{ display: 'block', width: '100%', padding: '.7rem', marginBottom: '1rem', background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.15)', borderRadius: '8px', color: 'white', fontSize: '1rem' }}
      />
      <button onClick={handleLogin} disabled={loading}
        style={{ width: '100%', padding: '.75rem', background: 'var(--color-primary)', border: 'none', borderRadius: '8px', color: '#000', fontFamily: 'var(--font-display)', fontSize: '1.1rem', cursor: 'pointer', marginBottom: '.6rem' }}>
        {loading ? 'CARGANDO...' : 'ENTRAR'}
      </button>
      <button onClick={handleRegistro} disabled={loading}
        style={{ width: '100%', padding: '.75rem', background: 'transparent', border: '1px solid var(--color-primary)', borderRadius: '8px', color: 'var(--color-primary)', fontFamily: 'var(--font-display)', fontSize: '1.1rem', cursor: 'pointer' }}>
        CREAR CUENTA
      </button>
      {mensaje && <p style={{ marginTop: '1rem', color: 'var(--color-gold)', textAlign: 'center' }}>{mensaje}</p>}
    </div>
  )
}