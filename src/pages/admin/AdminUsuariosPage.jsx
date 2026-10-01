import { useState, useEffect } from 'react'
import { supabase, supabaseSilent } from '../../lib/supabase'
import { useIsMobile } from '../../hooks/useIsMobile'
import { UserCog, Plus, Trash2 } from 'lucide-react'

const input = {
  width: '100%', background: '#fff', border: '1px solid #dadce0',
  borderRadius: '8px', padding: '8px 12px', color: '#202124',
  fontSize: '.875rem', outline: 'none', boxSizing: 'border-box',
}
const label = { fontSize: '.75rem', fontWeight: '500', color: '#5f6368', display: 'block', marginBottom: '4px' }

const ROL_INFO = {
  admin:       { label: '👑 Admin principal', color: '#6c35de', bg: '#f3e8fd', desc: 'Acceso a todo' },
  organizador: { label: '🏆 Organizador',     color: '#1a73e8', bg: '#e8f0fe', desc: 'Sus torneos: partidos, fases, tablas. Premium (por torneo): noticias, cuentas y ediciones' },
  arbitro:     { label: '🧑‍⚖️ Árbitro',        color: '#1e8e3e', bg: '#e6f4ea', desc: 'Portal de árbitros: elige torneo, cancha y sus partidos con planillas' },
}

export default function AdminUsuariosPage() {
  const isMobile = useIsMobile()
  const [usuarios, setUsuarios] = useState([])
  const [form,     setForm]     = useState({ email: '', rol: 'organizador', notas: '' })
  const [loading,  setLoading]  = useState(false)
  const [msg,      setMsg]      = useState(null)
  const [errorTabla, setErrorTabla] = useState(false)

  // ── Resetear contraseña (organizador/árbitro/admin) sin depender de que
  // la persona revise su correo — igual que ya se puede con los jugadores.
  const [modalResetPass, setModalResetPass]   = useState(null) // usuario (fila de roles_plataforma)
  const [nuevaPassOrg,   setNuevaPassOrg]     = useState('')
  const [loadingResetOrg, setLoadingResetOrg] = useState(false)

  useEffect(() => { fetchUsuarios() }, [])

  function showMsg(text, type = 'ok') {
    setMsg({ text, type })
    setTimeout(() => setMsg(null), 3500)
  }

  async function fetchUsuarios() {
    const { data, error } = await supabase.from('roles_plataforma').select('*').order('created_at', { ascending: false })
    if (error) { setErrorTabla(true); return }
    setErrorTabla(false)
    setUsuarios(data || [])
  }

  async function handleAgregar() {
    const email = form.email.trim().toLowerCase()
    if (!email || !email.includes('@')) return showMsg('Escribe un correo válido', 'error')
    setLoading(true)
    const { error } = await supabase.from('roles_plataforma').insert({
      email, rol: form.rol, plan: form.rol === 'organizador' ? 'gratis' : null, notas: form.notas || null, activo: true,
    })
    setLoading(false)
    if (error) return showMsg(error.message?.includes('duplicate') ? 'Ese correo ya tiene un rol asignado' : 'Error al guardar', 'error')
    showMsg('Rol asignado ✓')
    setForm({ email: '', rol: 'organizador', notas: '' })
    fetchUsuarios()
  }

  async function handleToggleActivo(u) {
    await supabase.from('roles_plataforma').update({ activo: !u.activo }).eq('id', u.id)
    fetchUsuarios()
  }

  async function handleEliminar(u) {
    if (!confirm(`¿Quitar el rol de ${u.email}? Volverá a ser una cuenta normal de jugador.`)) return
    await supabase.from('roles_plataforma').delete().eq('id', u.id)
    fetchUsuarios()
    showMsg('Rol eliminado')
  }

  function generarPasswordAleatoria() {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
    let out = ''
    for (let i = 0; i < 8; i++) out += chars[Math.floor(Math.random() * chars.length)]
    return out
  }

  function abrirResetPassword(u) {
    setModalResetPass(u)
    setNuevaPassOrg(generarPasswordAleatoria())
  }

  // Cambia la contraseña de OTRA cuenta (sin depender de que le llegue un
  // correo y lo abra) — llama a una función en Supabase que corre con
  // permisos de administrador, igual que el reseteo de jugadores.
  async function handleResetPasswordUsuario() {
    if (!modalResetPass?.user_id) return
    if (!nuevaPassOrg || nuevaPassOrg.length < 6) return showMsg('Mínimo 6 caracteres', 'error')
    setLoadingResetOrg(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('https://obvlyexpbbdhxwijjqyd.supabase.co/functions/v1/reset-password-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ user_id: modalResetPass.user_id, nueva_password: nuevaPassOrg }),
      })
      const data = await res.json()
      if (data.error) showMsg('Error: ' + data.error, 'error')
      else {
        // Que la próxima vez que esa persona entre con esta contraseña, el
        // panel le muestre bien grande "cambiar contraseña" hasta que la
        // cambie por una suya — sin esto, nunca se entera de que puede
        // ponerse una propia. (supabaseSilent: esto lo hace el sistema, no
        // la persona — no debe salir el aviso de "Cambios guardados ✓".)
        supabaseSilent.from('roles_plataforma').update({ debe_cambiar_password: true }).eq('id', modalResetPass.id).then(() => {}, () => {})
        showMsg(`✅ Contraseña de ${modalResetPass.email} actualizada`)
        setModalResetPass(null)
        setNuevaPassOrg('')
      }
    } catch (e) {
      showMsg('Error: ' + e.message, 'error')
    }
    setLoadingResetOrg(false)
  }

  return (
    <div>
      {msg && (
        <div style={{ position: 'fixed', top: '1rem', left: '50%', transform: 'translateX(-50%)', background: msg.type === 'error' ? '#d93025' : '#1e8e3e', color: '#fff', borderRadius: '8px', padding: '10px 24px', zIndex: 200, fontSize: '.875rem', boxShadow: '0 4px 12px rgba(0,0,0,.2)' }}>
          {msg.text}
        </div>
      )}

      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#202124', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}><UserCog size={22}/> Usuarios y permisos</h1>
        <p style={{ color: '#5f6368', margin: '4px 0 0', fontSize: '.875rem' }}>Asigna roles por correo: la persona crea su cuenta con ese correo y al entrar ya tiene sus permisos</p>
      </div>

      {errorTabla && (
        <div style={{ background: '#fce8e6', border: '1px solid #fad2cf', borderRadius: '12px', padding: '16px 20px', marginBottom: '20px', fontSize: '.85rem', color: '#d93025', fontWeight: '600' }}>
          ⚠️ Falta ejecutar migracion_roles.sql en Supabase (SQL Editor) para activar los roles.
        </div>
      )}

      {/* Nuevo usuario */}
      <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', padding: '20px', marginBottom: '20px', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
        <div style={{ fontWeight: '600', color: '#202124', fontSize: '.9rem', marginBottom: '14px' }}>Asignar rol a un correo</div>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr 2fr auto', gap: '12px', alignItems: 'end' }}>
          <div>
            <label style={label}>Correo *</label>
            <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} style={input} placeholder="correo@ejemplo.com"/>
          </div>
          <div>
            <label style={label}>Rol</label>
            <select value={form.rol} onChange={e => setForm(f => ({ ...f, rol: e.target.value }))} style={input}>
              <option value="organizador">🏆 Organizador</option>
              <option value="arbitro">🧑‍⚖️ Árbitro</option>
              <option value="admin">👑 Admin</option>
            </select>
          </div>
          <div>
            <label style={label}>Notas (opcional)</label>
            <input value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} style={input} placeholder="Ej: organiza la liga de Calarcá"/>
          </div>
          <button onClick={handleAgregar} disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 18px', background: loading ? '#dadce0' : '#1a73e8', border: 'none', borderRadius: '8px', cursor: loading ? 'not-allowed' : 'pointer', color: '#fff', fontSize: '.875rem', fontWeight: '600' }}>
            <Plus size={15}/> Asignar
          </button>
        </div>
        <div style={{ fontSize: '.7rem', color: '#9aa0a6', marginTop: '10px' }}>
          {ROL_INFO[form.rol]?.desc}. Los organizadores gratis pueden crear 1 torneo; para más torneos o funciones premium, marca el torneo como Premium ⭐ en la lista de Torneos después del pago.
        </div>
      </div>

      {/* Lista */}
      <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
        {usuarios.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#9aa0a6', fontSize: '.875rem' }}>Sin usuarios con roles asignados aún</div>
        ) : usuarios.map((u, i) => {
          const info = ROL_INFO[u.rol] || { label: u.rol, color: '#5f6368', bg: '#f1f3f4' }
          return (
            <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '13px 16px', borderBottom: i < usuarios.length - 1 ? '1px solid #f1f3f4' : 'none', opacity: u.activo ? 1 : .5, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: '600', color: '#202124', fontSize: '.875rem' }}>{u.email}</div>
                {u.notas && <div style={{ fontSize: '.72rem', color: '#9aa0a6', marginTop: '2px' }}>{u.notas}</div>}
              </div>
              <span style={{ fontSize: '.72rem', fontWeight: '600', color: info.color, background: info.bg, borderRadius: '12px', padding: '3px 12px', flexShrink: 0 }}>{info.label}</span>
              {!u.activo && <span style={{ fontSize: '.7rem', color: '#d93025', fontWeight: '600', flexShrink: 0 }}>Desactivado</span>}
              {u.user_id ? (
                <button onClick={() => abrirResetPassword(u)}
                  style={{ background: 'none', border: '1px solid #dadce0', borderRadius: '6px', padding: '5px 10px', cursor: 'pointer', color: '#1a73e8', fontSize: '.72rem', flexShrink: 0 }}>
                  🔐 Resetear contraseña
                </button>
              ) : (
                <span title="Todavía no ha creado su cuenta (debe entrar al menos una vez con 'Crear cuenta')" style={{ fontSize: '.68rem', color: '#9aa0a6', flexShrink: 0 }}>
                  Sin cuenta aún
                </span>
              )}
              <button onClick={() => handleToggleActivo(u)}
                style={{ background: 'none', border: '1px solid #dadce0', borderRadius: '6px', padding: '5px 10px', cursor: 'pointer', color: '#5f6368', fontSize: '.72rem', flexShrink: 0 }}>
                {u.activo ? 'Desactivar' : 'Activar'}
              </button>
              <button onClick={() => handleEliminar(u)}
                style={{ background: 'none', border: '1px solid #fad2cf', borderRadius: '6px', padding: '5px 8px', cursor: 'pointer', color: '#d93025', display: 'flex', flexShrink: 0 }}>
                <Trash2 size={13}/>
              </button>
            </div>
          )
        })}
      </div>

      {modalResetPass && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: '#fff', borderRadius: '14px', padding: '24px', width: '100%', maxWidth: '380px', boxShadow: '0 20px 60px rgba(0,0,0,.3)' }}>
            <div style={{ fontWeight: '700', color: '#202124', fontSize: '1rem', marginBottom: '6px' }}>🔐 Resetear contraseña</div>
            <div style={{ fontSize: '.8rem', color: '#5f6368', marginBottom: '16px', lineHeight: 1.5 }}>
              Nueva contraseña para <b>{modalResetPass.email}</b> — después de guardar, copiala y envíasela (por WhatsApp, por ejemplo). Ya queda activa de una, sin que la persona tenga que abrir ningún correo.
            </div>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <input value={nuevaPassOrg} onChange={e => setNuevaPassOrg(e.target.value)} style={{ ...input, flex: 1 }}/>
              <button type="button" onClick={() => setNuevaPassOrg(generarPasswordAleatoria())} title="Generar otra"
                style={{ padding: '8px 12px', background: '#f1f3f4', border: '1px solid #dadce0', borderRadius: '8px', cursor: 'pointer', fontSize: '.9rem' }}>
                🎲
              </button>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setModalResetPass(null)}
                style={{ flex: 1, padding: '10px', background: '#fff', border: '1px solid #dadce0', borderRadius: '8px', cursor: 'pointer', color: '#5f6368', fontSize: '.85rem', fontWeight: '600' }}>
                Cancelar
              </button>
              <button onClick={handleResetPasswordUsuario} disabled={loadingResetOrg}
                style={{ flex: 1, padding: '10px', background: loadingResetOrg ? '#dadce0' : '#1a73e8', border: 'none', borderRadius: '8px', cursor: loadingResetOrg ? 'not-allowed' : 'pointer', color: '#fff', fontWeight: '700', fontSize: '.85rem' }}>
                {loadingResetOrg ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
