import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

// ── WebAuthn helpers ──────────────────────────────────────────
function bufferToBase64(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
}
function base64ToBuffer(base64) {
  const bin = atob(base64)
  return Uint8Array.from(bin, c => c.charCodeAt(0)).buffer
}

const RP_ID   = window.location.hostname        // ej: "golmebol.vercel.app"
const RP_NAME = 'Golmebol'

async function registerFaceId(userId, email) {
  const challenge = crypto.getRandomValues(new Uint8Array(32))
  const credential = await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { id: RP_ID, name: RP_NAME },
      user: {
        id: new TextEncoder().encode(userId),
        name: email,
        displayName: email,
      },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7  },   // ES256
        { type: 'public-key', alg: -257 },  // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',  // Face ID / huella del dispositivo
        userVerification: 'required',
      },
      timeout: 60000,
    },
  })
  // Guardar credentialId en localStorage vinculado al userId
  const credId = bufferToBase64(credential.rawId)
  localStorage.setItem(`golmebol_credId_${userId}`, credId)
  localStorage.setItem('golmebol_lastUser', JSON.stringify({ userId, email }))
  return credId
}

async function loginWithFaceId(userId) {
  const credId = localStorage.getItem(`golmebol_credId_${userId}`)
  if (!credId) throw new Error('No hay Face ID registrado')
  const challenge = crypto.getRandomValues(new Uint8Array(32))
  await navigator.credentials.get({
    publicKey: {
      challenge,
      rpId: RP_ID,
      allowCredentials: [{ type: 'public-key', id: base64ToBuffer(credId) }],
      userVerification: 'required',
      timeout: 60000,
    },
  })
  // Si llega aquí, la verificación biométrica fue exitosa
  return true
}

function isFaceIdAvailable() {
  return window.PublicKeyCredential !== undefined
}

// ─────────────────────────────────────────────────────────────

export default function LoginPage({ enRecuperacion, onRecuperada }) {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [mensaje, setMensaje]   = useState('')
  const [faceAvailable, setFaceAvailable] = useState(false)
  const [lastUser, setLastUser] = useState(null)          // { userId, email }
  const [showRegisterFace, setShowRegisterFace] = useState(false)
  const [pendingSession, setPendingSession] = useState(null)

  // ── Recuperar contraseña (organizador/admin) ───────────────
  const [showRecuperar, setShowRecuperar]       = useState(false)
  const [emailRecuperar, setEmailRecuperar]     = useState('')
  const [loadingRecuperar, setLoadingRecuperar] = useState(false)
  const [mensajeRecuperar, setMensajeRecuperar] = useState('')
  const [linkEnviado, setLinkEnviado]           = useState(false)

  // ── Crear nueva contraseña (viene del link del correo) ─────
  const [nuevaPass, setNuevaPass]   = useState('')
  const [nuevaPass2, setNuevaPass2] = useState('')
  const [loadingNueva, setLoadingNueva] = useState(false)
  const [errorNueva, setErrorNueva]     = useState('')
  const [passActualizada, setPassActualizada] = useState(false)

  useEffect(() => {
    setFaceAvailable(isFaceIdAvailable())
    const saved = localStorage.getItem('golmebol_lastUser')
    if (saved) setLastUser(JSON.parse(saved))
  }, [])

  // ── Login normal ──────────────────────────────────────────
  async function handleLogin() {
    setLoading(true)
    setMensaje('')
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setMensaje('Error: ' + error.message)
      setLoading(false)
      return
    }
    const userId = data.user.id
    const credId = localStorage.getItem(`golmebol_credId_${userId}`)

    // Si tiene Face ID registrado en este dispositivo, no preguntar de nuevo
    if (faceAvailable && !credId) {
      setPendingSession(data)
      setShowRegisterFace(true)
    }
    setLoading(false)
  }

  // ── Registrar Face ID después del login normal ──────────
  async function handleRegisterFaceId() {
    try {
      setLoading(true)
      await registerFaceId(pendingSession.user.id, pendingSession.user.email)
      setMensaje('✅ Face ID activado')
      setShowRegisterFace(false)
    } catch (e) {
      setMensaje('No se pudo activar Face ID: ' + e.message)
    }
    setLoading(false)
  }

  // ── Login con Face ID ─────────────────────────────────────
  async function handleFaceLogin() {
    if (!lastUser) return
    setLoading(true)
    setMensaje('')
    try {
      await loginWithFaceId(lastUser.userId)
      // Biométrico OK — necesitamos una sesión activa
      // Pedimos al usuario que confirme con su contraseña guardada si no hay sesión
      // Alternativa: usar una custom token desde un edge function (avanzado)
      // Por ahora: si pasa el biométrico, intentamos refrescar sesión existente
      const { data } = await supabase.auth.getSession()
      if (!data.session) {
        setMensaje('Sesión expirada. Ingresa con email y contraseña una vez.')
        setLoading(false)
        return
      }
      // Sesión válida + biométrico OK = acceso concedido
    } catch (e) {
      setMensaje('Face ID cancelado o no reconocido')
    }
    setLoading(false)
  }

  // ── Registro ──────────────────────────────────────────────
  async function handleRegistro() {
    if (!email.trim()) { setMensaje('Escribe tu correo arriba y luego dale a Crear Cuenta'); return }
    if (!password || password.length < 6) { setMensaje('Escribe una contraseña de mínimo 6 caracteres'); return }
    setLoading(true)
    setMensaje('')
    const { error } = await supabase.auth.signUp({ email: email.trim().toLowerCase(), password })
    if (error) setMensaje('Error: ' + error.message)
    else setMensaje('✅ Cuenta creada. Si te llega un correo de confirmación, ábrelo antes de entrar')
    setLoading(false)
  }

  // ── Pedir link para recuperar contraseña ───────────────────
  async function handleEnviarRecuperacion() {
    if (!emailRecuperar.trim()) { setMensajeRecuperar('Escribe tu correo'); return }
    setLoadingRecuperar(true)
    setMensajeRecuperar('')
    const { error } = await supabase.auth.resetPasswordForEmail(emailRecuperar.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/login`,
    })
    setLoadingRecuperar(false)
    if (error) setMensajeRecuperar('Error: ' + error.message)
    else setLinkEnviado(true)
  }

  // ── Guardar la nueva contraseña (ya con la sesión de recuperación activa) ──
  async function handleGuardarNuevaPass() {
    if (!nuevaPass || nuevaPass.length < 6) { setErrorNueva('Mínimo 6 caracteres'); return }
    if (nuevaPass !== nuevaPass2) { setErrorNueva('Las contraseñas no coinciden'); return }
    setLoadingNueva(true)
    setErrorNueva('')
    const { error } = await supabase.auth.updateUser({ password: nuevaPass })
    setLoadingNueva(false)
    if (error) { setErrorNueva('Error: ' + error.message); return }
    setPassActualizada(true)
  }

  // ── Pantalla: crear nueva contraseña (llegó del link del correo) ──
  if (enRecuperacion) {
    return (
      <div style={{ width: '100%', maxWidth: '380px', padding: '3rem 1.5rem' }}>
        <h1 style={{
          fontFamily: 'var(--font-display)', fontSize: '3rem', letterSpacing: '.2em',
          background: 'linear-gradient(90deg, #00ddd0, #9955ff)', WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent', marginBottom: '1.5rem', textAlign: 'center',
        }}>
          GOLMEBOL
        </h1>
        {!passActualizada ? (
          <>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', letterSpacing: '.08em', color: '#00ddd0', marginBottom: '.6rem', textAlign: 'center' }}>
              CREA TU NUEVA CONTRASEÑA
            </div>
            <input type="password" placeholder="Nueva contraseña" value={nuevaPass}
              onChange={e => setNuevaPass(e.target.value)} autoFocus
              style={{ display: 'block', width: '100%', padding: '.7rem', marginBottom: '.8rem', background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.15)', borderRadius: '8px', color: 'white', fontSize: '1rem', boxSizing: 'border-box' }}
            />
            <input type="password" placeholder="Repite la contraseña" value={nuevaPass2}
              onChange={e => setNuevaPass2(e.target.value)}
              style={{ display: 'block', width: '100%', padding: '.7rem', marginBottom: '1rem', background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.15)', borderRadius: '8px', color: 'white', fontSize: '1rem', boxSizing: 'border-box' }}
            />
            {errorNueva && <p style={{ marginBottom: '1rem', color: '#ff6b6b', textAlign: 'center', fontSize: '.85rem' }}>{errorNueva}</p>}
            <button onClick={handleGuardarNuevaPass} disabled={loadingNueva} style={{
              width: '100%', padding: '.75rem', background: 'var(--color-primary)', border: 'none',
              borderRadius: '8px', color: '#000', fontFamily: 'var(--font-display)', fontSize: '1.1rem', cursor: 'pointer',
            }}>
              {loadingNueva ? 'GUARDANDO...' : 'GUARDAR CONTRASEÑA'}
            </button>
          </>
        ) : (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', marginBottom: '.6rem' }}>✅</div>
            <div style={{ color: 'rgba(255,255,255,.8)', marginBottom: '1.2rem', fontSize: '.9rem' }}>Contraseña actualizada</div>
            <button onClick={onRecuperada} style={{
              width: '100%', padding: '.75rem', background: 'var(--color-primary)', border: 'none',
              borderRadius: '8px', color: '#000', fontFamily: 'var(--font-display)', fontSize: '1.1rem', cursor: 'pointer',
            }}>
              IR AL PANEL →
            </button>
          </div>
        )}
      </div>
    )
  }

  // ── UI ────────────────────────────────────────────────────
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
        textAlign: 'center',
      }}>
        GOLMEBOL
      </h1>

      {/* ── Botón Face ID (si hay usuario previo) ── */}
      {faceAvailable && lastUser && !showRegisterFace && (
        <div style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
          <button onClick={handleFaceLogin} disabled={loading} style={{
            width: '100%', padding: '.9rem',
            background: 'linear-gradient(135deg, #00ddd0, #9955ff)',
            border: 'none', borderRadius: '12px',
            color: '#000', fontFamily: 'var(--font-display)',
            fontSize: '1.1rem', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
          }}>
            <span style={{ fontSize: '1.5rem' }}>🪪</span>
            ENTRAR CON FACE ID
          </button>
          <div style={{ marginTop: '.5rem', fontSize: '.75rem', color: 'rgba(255,255,255,.4)', fontFamily: 'var(--font-display)', letterSpacing: '.1em' }}>
            {lastUser.email}
          </div>
          <button onClick={() => setLastUser(null)} style={{
            background: 'none', border: 'none', color: 'rgba(255,255,255,.3)',
            cursor: 'pointer', fontSize: '.7rem', marginTop: '.3rem',
            fontFamily: 'var(--font-display)', letterSpacing: '.1em',
          }}>
            USAR OTRA CUENTA
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '1rem 0' }}>
            <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,.1)' }}/>
            <span style={{ color: 'rgba(255,255,255,.3)', fontSize: '.7rem', fontFamily: 'var(--font-display)' }}>O</span>
            <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,.1)' }}/>
          </div>
        </div>
      )}

      {/* ── Modal registrar Face ID ── */}
      {showRegisterFace && (
        <div style={{
          background: 'rgba(0,221,208,.08)',
          border: '1px solid rgba(0,221,208,.3)',
          borderRadius: '12px', padding: '1.2rem',
          marginBottom: '1.2rem', textAlign: 'center',
        }}>
          <div style={{ fontSize: '2rem', marginBottom: '.5rem' }}>🪪</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '.9rem', letterSpacing: '.1em', color: '#00ddd0', marginBottom: '.4rem' }}>
            ACTIVAR FACE ID
          </div>
          <div style={{ fontSize: '.75rem', color: 'rgba(255,255,255,.5)', marginBottom: '1rem', lineHeight: 1.5 }}>
            La próxima vez podrás entrar solo con tu cara o huella sin escribir contraseña
          </div>
          <button onClick={handleRegisterFaceId} disabled={loading} style={{
            width: '100%', padding: '.7rem',
            background: 'linear-gradient(90deg, #00ddd0, #9955ff)',
            border: 'none', borderRadius: '8px',
            color: '#000', fontFamily: 'var(--font-display)',
            fontSize: '1rem', cursor: 'pointer', marginBottom: '.5rem',
          }}>
            {loading ? 'ACTIVANDO...' : 'ACTIVAR'}
          </button>
          <button onClick={() => setShowRegisterFace(false)} style={{
            background: 'none', border: 'none',
            color: 'rgba(255,255,255,.3)', cursor: 'pointer',
            fontSize: '.75rem', fontFamily: 'var(--font-display)', letterSpacing: '.1em',
          }}>
            AHORA NO
          </button>
        </div>
      )}

      {/* ── Formulario email/contraseña ── */}
      <input type="email" placeholder="tu@email.com" value={email}
        onChange={e => setEmail(e.target.value)}
        style={{ display: 'block', width: '100%', padding: '.7rem', marginBottom: '.8rem', background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.15)', borderRadius: '8px', color: 'white', fontSize: '1rem', boxSizing: 'border-box' }}
      />
      <input type="password" placeholder="Contraseña" value={password}
        onChange={e => setPassword(e.target.value)}
        style={{ display: 'block', width: '100%', padding: '.7rem', marginBottom: '.5rem', background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.15)', borderRadius: '8px', color: 'white', fontSize: '1rem', boxSizing: 'border-box' }}
      />

      <button type="button" onClick={() => { setShowRecuperar(s => !s); setLinkEnviado(false); setMensajeRecuperar('') }} style={{
        display: 'block', marginBottom: '1rem', background: 'none', border: 'none',
        color: 'rgba(255,255,255,.4)', fontSize: '.8rem', cursor: 'pointer', textDecoration: 'underline',
      }}>
        ¿Olvidaste tu contraseña?
      </button>

      {showRecuperar && (
        <div style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', borderRadius: '10px', padding: '1rem', marginBottom: '1rem' }}>
          {!linkEnviado ? (
            <>
              <div style={{ fontSize: '.78rem', color: 'rgba(255,255,255,.6)', marginBottom: '.6rem' }}>
                Escribe el correo con el que te registraste y te mandamos un link para crear una nueva contraseña
              </div>
              <input type="email" placeholder="tu@email.com" value={emailRecuperar}
                onChange={e => setEmailRecuperar(e.target.value)}
                style={{ display: 'block', width: '100%', padding: '.6rem', marginBottom: '.6rem', background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.15)', borderRadius: '8px', color: 'white', fontSize: '.9rem', boxSizing: 'border-box' }}
              />
              {mensajeRecuperar && <p style={{ marginBottom: '.6rem', color: '#ff6b6b', fontSize: '.8rem' }}>{mensajeRecuperar}</p>}
              <button onClick={handleEnviarRecuperacion} disabled={loadingRecuperar} style={{
                width: '100%', padding: '.6rem', background: 'var(--color-primary)', border: 'none',
                borderRadius: '8px', color: '#000', fontFamily: 'var(--font-display)', fontSize: '.95rem', cursor: 'pointer',
              }}>
                {loadingRecuperar ? 'ENVIANDO...' : 'ENVIAR LINK'}
              </button>
            </>
          ) : (
            <div style={{ fontSize: '.82rem', color: 'rgba(255,255,255,.75)', textAlign: 'center', lineHeight: 1.5 }}>
              📩 Listo — revisa <b>{emailRecuperar}</b> (y la carpeta de spam) y toca el link para crear tu nueva contraseña
            </div>
          )}
        </div>
      )}

      <button onClick={handleLogin} disabled={loading} style={{
        width: '100%', padding: '.75rem',
        background: 'var(--color-primary)', border: 'none',
        borderRadius: '8px', color: '#000',
        fontFamily: 'var(--font-display)', fontSize: '1.1rem',
        cursor: 'pointer', marginBottom: '.6rem',
      }}>
        {loading ? 'CARGANDO...' : 'ENTRAR'}
      </button>
      <button onClick={handleRegistro} disabled={loading} style={{
        width: '100%', padding: '.75rem',
        background: 'transparent', border: '1px solid var(--color-primary)',
        borderRadius: '8px', color: 'var(--color-primary)',
        fontFamily: 'var(--font-display)', fontSize: '1.1rem', cursor: 'pointer',
      }}>
        CREAR CUENTA
      </button>

      {mensaje && (
        <p style={{ marginTop: '1rem', color: 'var(--color-gold)', textAlign: 'center', fontSize: '.85rem' }}>
          {mensaje}
        </p>
      )}
    </div>
  )
}
