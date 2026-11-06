// Chat de ayuda dentro del admin: el organizador escribe aquí, a Golmebol le llega por
// WhatsApp, y las respuestas vuelven a este mismo chat. Todo el historial queda a la vista.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Bell, ChevronLeft, MessageCircle, Send } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { apiUrl } from '../lib/apiBase'
import { useAuthStore } from '../store/authStore'
import { useIsMobile } from '../hooks/useIsMobile'
import { estadoAvisos, activarAvisos, desactivarAvisos } from '../lib/avisosChat'

const AGENTE = 'Javier Gonzales'

// Dibujo del agente (secretario con audífonos). Es un SVG propio: no depende de ninguna imagen externa.
function AvatarAgente({ size = 40 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" role="img" aria-label={AGENTE} style={{ flexShrink: 0, borderRadius: '50%', display: 'block' }}>
      <rect width="48" height="48" fill="#dfe8fb" />
      <path d="M5 48c0-9.5 8.5-14.5 19-14.5S43 38.5 43 48z" fill="#2f3a6b" />
      <path d="M19.2 33.8L24 41l4.8-7.2z" fill="#fff" />
      <path d="M24 36.5l-1.9 3 1.9 8.5 1.9-8.5z" fill="#6c35de" />
      <rect x="21" y="28" width="6" height="7" rx="2" fill="#e3b088" />
      <ellipse cx="24" cy="21" rx="8" ry="9" fill="#f2c9a0" />
      <path d="M15.8 20.5c-.4-6.5 3.5-10.3 8.2-10.3s8.6 3.8 8.2 10.3c-1.6-3.2-4.3-4.8-8.2-4.8s-6.6 1.6-8.2 4.8z" fill="#3b2b24" />
      <circle cx="20.7" cy="22" r="1.05" fill="#3b2b24" />
      <circle cx="27.3" cy="22" r="1.05" fill="#3b2b24" />
      <path d="M21 26q3 2.6 6 0" fill="none" stroke="#b5654a" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M14.6 21c0-6.8 4.1-11 9.4-11s9.4 4.2 9.4 11" fill="none" stroke="#1a73e8" strokeWidth="2" strokeLinecap="round" />
      <rect x="12.6" y="19.5" width="3.3" height="6.2" rx="1.65" fill="#1a73e8" />
      <rect x="32.1" y="19.5" width="3.3" height="6.2" rx="1.65" fill="#1a73e8" />
      <path d="M33.8 25.5c0 3.2-2.2 4.8-5.3 4.8" fill="none" stroke="#1a73e8" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="28.3" cy="30.3" r="1.4" fill="#1a73e8" />
    </svg>
  )
}

const BIENVENIDA = '¡Hola! 👋 Cuéntanos qué necesitas y te respondemos por aquí mismo. Si algo no funciona, dinos en qué pantalla estabas y qué esperabas que pasara.'

const hora = iso => new Date(iso).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' })
function diaTexto(iso) {
  const d = new Date(iso), hoy = new Date()
  const ayer = new Date(); ayer.setDate(hoy.getDate() - 1)
  if (d.toDateString() === hoy.toDateString()) return 'Hoy'
  if (d.toDateString() === ayer.toDateString()) return 'Ayer'
  return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'long' })
}

function ChatInterno() {
  const { user } = useAuthStore()
  const isMobile = useIsMobile()
  const location = useLocation()
  // Se abre solo si llegó tocando la notificación (…/admin?ayuda=1)
  const [abierto, setAbierto] = useState(() => { try { return new URLSearchParams(window.location.search).get('ayuda') === '1' } catch { return false } })
  const [avisos, setAvisos] = useState('cargando') // estado de las notificaciones del navegador
  const [chat, setChat] = useState(null)
  const [mensajes, setMensajes] = useState([])
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [aviso, setAviso] = useState('')
  const [vv, setVv] = useState(null) // área visible real (con teclado abierto en el celular)
  const fin = useRef(null)
  const secuencia = useRef(0)

  const cargar = useCallback(async chatId => {
    const { data } = await supabase.from('soporte_mensajes').select('id, de, texto, created_at, wa_estado').eq('chat_id', chatId).order('created_at', { ascending: true }).limit(300)
    if (!data) return
    setMensajes(prev => {
      const pendientes = prev.filter(m => m.local && !data.some(d => d.id === m.id))
      return [...data, ...pendientes]
    })
  }, [])

  // Chat del usuario (se crea la primera vez) + sus mensajes
  useEffect(() => {
    if (!user?.id) return
    let vivo = true
    ;(async () => {
      const { data, error } = await supabase.rpc('soporte_mi_chat')
      if (!vivo || error || !data) return
      const c = Array.isArray(data) ? data[0] : data
      setChat(c)
      cargar(c.id)
    })()
    return () => { vivo = false }
  }, [user?.id, cargar])

  // Notificaciones: estado de este navegador, limpiar ?ayuda=1 de la dirección y atender al service worker
  useEffect(() => {
    let vivo = true
    estadoAvisos().then(e => { if (vivo) setAvisos(e) })
    try {
      const u = new URL(window.location.href)
      if (u.searchParams.get('ayuda') === '1') { u.searchParams.delete('ayuda'); window.history.replaceState(window.history.state, '', u.pathname + u.search + u.hash) }
    } catch { /* nada */ }
    return () => { vivo = false }
  }, [])

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    const alMensaje = e => {
      if (e.data?.tipo === 'abrir-ayuda') setAbierto(true)
      else if (e.data?.tipo === 'chat-nuevo' && chat?.id) cargar(chat.id)
    }
    navigator.serviceWorker.addEventListener('message', alMensaje)
    return () => navigator.serviceWorker.removeEventListener('message', alMensaje)
  }, [chat?.id, cargar])

  async function alternarAvisos() {
    if (avisos === 'activo') { setAvisos(await desactivarAvisos()); return }
    const r = await activarAvisos()
    setAvisos(r === 'error' ? 'pendiente' : r)
    if (r === 'error') setAviso('No pudimos activar los avisos en este navegador. Intenta de nuevo más tarde.')
  }

  // Respuestas en vivo + respaldo por si el tiempo real falla
  useEffect(() => {
    if (!chat?.id) return
    const canal = supabase.channel(`soporte-${chat.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'soporte_mensajes', filter: `chat_id=eq.${chat.id}` },
        p => setMensajes(prev => prev.some(m => m.id === p.new.id) ? prev : [...prev.filter(m => !(m.local && m.texto === p.new.texto && p.new.de === 'usuario')), p.new]))
      .subscribe()
    const t = setInterval(() => { if (document.visibilityState === 'visible') cargar(chat.id) }, abierto ? 8000 : 30000)
    // Al volver a la ventana (app instalada, otra pestaña, internet que regresa) se actualiza de inmediato
    const alVolver = () => { if (document.visibilityState === 'visible') cargar(chat.id) }
    document.addEventListener('visibilitychange', alVolver)
    window.addEventListener('focus', alVolver)
    window.addEventListener('online', alVolver)
    return () => {
      clearInterval(t)
      document.removeEventListener('visibilitychange', alVolver)
      window.removeEventListener('focus', alVolver)
      window.removeEventListener('online', alVolver)
      supabase.removeChannel(canal)
    }
  }, [chat?.id, abierto, cargar])

  const sinLeer = useMemo(() => chat ? mensajes.filter(m => m.de === 'soporte' && new Date(m.created_at) > new Date(chat.leido_usuario_at)).length : 0, [mensajes, chat])

  // Al abrir (o llegar algo con el chat abierto) se marcan como vistas
  useEffect(() => {
    if (!abierto || !chat?.id) return
    const ultimo = mensajes.filter(m => m.de === 'soporte').at(-1)
    if (!ultimo || new Date(ultimo.created_at) <= new Date(chat.leido_usuario_at)) return
    supabase.rpc('soporte_marcar_leido').then(() => setChat(c => (c ? { ...c, leido_usuario_at: new Date().toISOString() } : c)), () => {})
  }, [abierto, mensajes, chat?.id, chat?.leido_usuario_at])

  useEffect(() => { if (abierto) fin.current?.scrollIntoView({ block: 'end' }) }, [mensajes, abierto, vv?.h])

  // En el celular, el chat usa el área que deja libre el teclado
  useEffect(() => {
    if (!abierto || !isMobile || !window.visualViewport) return
    const vp = window.visualViewport
    const medir = () => {
      const tecladoAbierto = window.innerHeight - vp.height > 120
      setVv(tecladoAbierto ? { h: vp.height, top: vp.offsetTop } : null)
    }
    // Al cerrar el teclado el iPhone a veces no avisa el cambio: se vuelve a medir un instante después
    const medirTarde = () => { medir(); setTimeout(medir, 120); setTimeout(medir, 400) }
    medir()
    vp.addEventListener('resize', medir); vp.addEventListener('scroll', medir)
    window.addEventListener('orientationchange', medirTarde)
    document.addEventListener('focusout', medirTarde)
    return () => {
      vp.removeEventListener('resize', medir); vp.removeEventListener('scroll', medir)
      window.removeEventListener('orientationchange', medirTarde)
      document.removeEventListener('focusout', medirTarde)
      setVv(null)
    }
  }, [abierto, isMobile])

  // El sello "Creada por GOLMEBOL" (abajo a la derecha en celular) taparía el botón de enviar: sube mientras el chat está abierto
  useEffect(() => {
    if (!abierto || !isMobile) return
    document.body.classList.add('gm-chat-abierto')
    return () => document.body.classList.remove('gm-chat-abierto')
  }, [abierto, isMobile])

  useEffect(() => {
    if (!abierto || !isMobile) return
    const antes = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = antes }
  }, [abierto, isMobile])

  async function enviar(textoReintento) {
    const t = (textoReintento ?? texto).trim()
    if (!t || enviando || !chat) return
    setEnviando(true); setAviso('')
    const tmp = { id: `tmp-${++secuencia.current}`, de: 'usuario', texto: t, created_at: new Date().toISOString(), local: true }
    setMensajes(prev => [...prev.filter(m => !(m.fallo && m.texto === t)), tmp])
    if (textoReintento === undefined) setTexto('')
    try {
      const { data: s } = await supabase.auth.getSession()
      const r = await fetch(apiUrl('/api/soporte-enviar'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s?.session?.access_token || ''}` },
        body: JSON.stringify({ texto: t, contexto: location.pathname }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j.error || 'No se pudo enviar')
      setMensajes(prev => prev.some(m => m.id === j.id) ? prev.filter(m => m.id !== tmp.id) : prev.map(m => m.id === tmp.id ? { ...m, id: j.id, local: false } : m))
      if (j.wa_estado === 'error') setAviso('Tu mensaje quedó guardado, pero no pudimos avisar a soporte en este momento. Lo veremos en cuanto entremos.')
      if (j.wa_estado === 'sin_configurar') setAviso('Tu mensaje quedó guardado, pero el chat todavía no está conectado, así que nadie lo recibe en el momento.')
    } catch (e) {
      setMensajes(prev => prev.map(m => m.id === tmp.id ? { ...m, fallo: true } : m))
      setAviso(e.message === 'Failed to fetch' ? 'Sin conexión. Revisa tu internet e intenta otra vez.' : e.message)
    }
    setEnviando(false)
  }

  if (!user?.id) return null

  const bottomFab = isMobile ? 'calc(84px + env(safe-area-inset-bottom) + 10px)' : '24px'
  const panelStyle = isMobile
    ? { position: 'fixed', left: 0, right: 0, top: vv ? vv.top : 0, ...(vv ? { height: vv.h } : { bottom: 0 }), zIndex: 300, background: '#fff', display: 'flex', flexDirection: 'column' }
    : { position: 'fixed', right: '24px', bottom: '24px', width: '380px', height: 'min(560px, calc(100vh - 48px))', zIndex: 300, background: '#fff', display: 'flex', flexDirection: 'column', borderRadius: '16px', boxShadow: '0 12px 40px rgba(0,0,0,.22)', overflow: 'hidden', border: '1px solid #e8eaed' }

  return (
    <>
      {!abierto && (
        <button onClick={() => setAbierto(true)} aria-label="Abrir el chat de ayuda"
          style={{ position: 'fixed', right: '14px', bottom: bottomFab, zIndex: 120, minWidth: '56px', height: '56px', padding: '0 18px 0 16px', borderRadius: '28px', border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#1a73e8,#6c35de)', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 6px 20px rgba(26,115,232,.4)', fontSize: '.86rem', fontWeight: '700' }}>
          <MessageCircle size={22} />
          <span>Ayuda</span>
          {sinLeer > 0 && <span style={{ position: 'absolute', top: '-4px', right: '-2px', minWidth: '20px', height: '20px', borderRadius: '10px', background: '#d93025', color: '#fff', fontSize: '.7rem', fontWeight: '800', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px', border: '2px solid #fff' }}>{sinLeer}</span>}
        </button>
      )}

      {abierto && (
        <div style={panelStyle} role="dialog" aria-label="Chat de ayuda">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderBottom: '1px solid #e8eaed', background: '#fff', flexShrink: 0 }}>
            <button onClick={() => setAbierto(false)} aria-label="Volver"
              style={{ display: 'flex', alignItems: 'center', gap: '2px', minHeight: '44px', padding: '0 10px 0 4px', background: 'none', border: 'none', cursor: 'pointer', color: '#1a73e8', fontSize: '.86rem', fontWeight: '700' }}>
              <ChevronLeft size={22} /> Volver
            </button>
            <AvatarAgente size={40} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '.92rem', fontWeight: '800', color: '#202124', lineHeight: 1.2 }}>{AGENTE}</div>
              <div style={{ fontSize: '.7rem', color: '#80868b', lineHeight: 1.2 }}>Asistente de Golmebol</div>
            </div>
          </div>

          {avisos === 'activo' && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px', padding: '2px 12px', background: '#fff', borderBottom: '1px solid #f1f3f4', fontSize: '.66rem', color: '#9aa0a6', flexShrink: 0 }}>
              <Bell size={11} />
              <span>Avisos activados</span>
              <button onClick={alternarAvisos} style={{ minHeight: '28px', padding: '0 4px', background: 'none', border: 'none', color: '#9aa0a6', fontSize: '.66rem', textDecoration: 'underline', cursor: 'pointer' }}>Desactivar</button>
            </div>
          )}

          <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', overscrollBehaviorY: 'contain', padding: '14px 12px', background: '#f6f7f9', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ alignSelf: 'flex-start', maxWidth: '92%', display: 'flex', alignItems: 'flex-end', gap: '6px' }}>
              <AvatarAgente size={28} />
              <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '14px 14px 14px 4px', padding: '9px 12px', fontSize: '.86rem', color: '#202124', lineHeight: 1.45 }}>
                <div style={{ fontSize: '.66rem', fontWeight: '800', color: '#6c35de', marginBottom: '2px' }}>{AGENTE}</div>
                {BIENVENIDA}
              </div>
            </div>
            {mensajes.map((m, i) => {
              const mio = m.de === 'usuario'
              const nuevoDia = i === 0 || new Date(m.created_at).toDateString() !== new Date(mensajes[i - 1].created_at).toDateString()
              return (
                <div key={m.id} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {nuevoDia && <div style={{ alignSelf: 'center', fontSize: '.68rem', color: '#80868b', background: '#e8eaed', borderRadius: '999px', padding: '2px 10px' }}>{diaTexto(m.created_at)}</div>}
                  <div style={{ alignSelf: mio ? 'flex-end' : 'flex-start', maxWidth: mio ? '86%' : '92%', display: 'flex', alignItems: 'flex-end', gap: '6px' }}>
                    {!mio && <AvatarAgente size={28} />}
                  <div style={{ background: mio ? '#1a73e8' : '#fff', color: mio ? '#fff' : '#202124', border: mio ? 'none' : '1px solid #e8eaed', borderRadius: mio ? '14px 14px 4px 14px' : '14px 14px 14px 4px', padding: '9px 12px', fontSize: '.86rem', lineHeight: 1.45, opacity: m.local ? .7 : 1, wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
                    {!mio && <div style={{ fontSize: '.66rem', fontWeight: '800', color: '#6c35de', marginBottom: '2px' }}>{AGENTE}</div>}
                    {m.texto}
                    <div style={{ fontSize: '.62rem', marginTop: '3px', textAlign: 'right', color: mio ? 'rgba(255,255,255,.75)' : '#9aa0a6' }}>
                      {m.fallo ? 'No se envió' : m.local ? 'Enviando…' : hora(m.created_at)}
                    </div>
                  </div>
                  </div>
                  {m.fallo && <button onClick={() => enviar(m.texto)} style={{ alignSelf: 'flex-end', minHeight: '36px', background: 'none', border: 'none', color: '#d93025', fontSize: '.76rem', fontWeight: '700', cursor: 'pointer' }}>Reintentar</button>}
                </div>
              )
            })}
            <div ref={fin} />
          </div>

          {aviso && <div style={{ padding: '8px 12px', background: '#fef3c7', color: '#7a5b00', fontSize: '.74rem', lineHeight: 1.4, flexShrink: 0 }}>{aviso}</div>}

          {avisos === 'pendiente' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: 'linear-gradient(135deg,#1a73e8,#6c35de)', color: '#fff', flexShrink: 0 }}>
              <Bell size={22} style={{ flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: '.8rem', fontWeight: '700', lineHeight: 1.3 }}>Activa los avisos y te notificamos apenas te respondamos</span>
              <button onClick={alternarAvisos} style={{ minHeight: '44px', padding: '0 16px', borderRadius: '22px', border: 'none', background: '#fff', color: '#1a4fa3', fontSize: '.82rem', fontWeight: '800', cursor: 'pointer', flexShrink: 0, boxShadow: '0 2px 8px rgba(0,0,0,.25)' }}>Activar</button>
            </div>
          )}
          {(avisos === 'bloqueado' || avisos === 'falta-instalar') && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: '#fff7e0', borderBottom: '1px solid #f3e2a8', fontSize: '.74rem', color: '#7a5b00', lineHeight: 1.35, flexShrink: 0 }}>
              <Bell size={16} style={{ flexShrink: 0 }} />
              {avisos === 'bloqueado' && <span style={{ flex: 1 }}>Los avisos están bloqueados en este navegador. Para activarlos, toca el candado junto a la dirección de la página y permite las notificaciones.</span>}
              {avisos === 'falta-instalar' && <span style={{ flex: 1 }}>Para recibir avisos en el iPhone, primero agrega Golmebol a tu pantalla de inicio (botón Compartir → Agregar a pantalla de inicio) y ábrelo desde ahí.</span>}
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', padding: '10px 12px calc(10px + env(safe-area-inset-bottom))', borderTop: '1px solid #e8eaed', background: '#fff', flexShrink: 0 }}>
            <textarea value={texto} onChange={e => setTexto(e.target.value)} rows={1} maxLength={1000} placeholder="Escribe tu mensaje…"
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !isMobile) { e.preventDefault(); enviar() } }}
              style={{ flex: 1, resize: 'none', maxHeight: '110px', minHeight: '44px', border: '1px solid #dadce0', borderRadius: '22px', padding: '11px 14px', fontSize: '16px', fontFamily: 'inherit', outline: 'none', lineHeight: 1.3, boxSizing: 'border-box' }}
              onInput={e => { e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 110) + 'px' }} />
            <button onClick={() => enviar()} disabled={!texto.trim() || enviando || !chat} aria-label="Enviar mensaje"
              style={{ width: '44px', height: '44px', borderRadius: '50%', border: 'none', background: texto.trim() ? '#1a73e8' : '#dadce0', color: '#fff', cursor: texto.trim() ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Send size={19} />
            </button>
          </div>
        </div>
      )}
    </>
  )
}

// Interruptor de lanzamiento (variable VITE_CHAT_AYUDA en Vercel; hay que volver a desplegar al cambiarla):
//   (vacía) o "apagado" → el botón no existe para nadie, y no se crea ningún chat
//   "admin"             → solo lo ven los administradores (para probar con WhatsApp real)
//   "todos"             → lo ven todos los usuarios del admin
export default function ChatSoporte() {
  const { rol } = useAuthStore()
  const modo = String(import.meta.env.VITE_CHAT_AYUDA || 'apagado').toLowerCase()
  if (modo === 'todos' || (modo === 'admin' && rol?.rol === 'admin')) return <ChatInterno />
  return null
}
