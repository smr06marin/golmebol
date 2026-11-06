// Chat de ayuda dentro del admin: el organizador escribe aquí, a Golmebol le llega por
// WhatsApp, y las respuestas vuelven a este mismo chat. Todo el historial queda a la vista.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Bell, ChevronLeft, MessageCircle, Mic, Moon, Paperclip, Send, Trash2, X } from 'lucide-react'
import { Capacitor } from '@capacitor/core'
import { supabase } from '../lib/supabase'
import { apiUrl } from '../lib/apiBase'
import { useAuthStore } from '../store/authStore'
import { useIsMobile } from '../hooks/useIsMobile'
import { estadoAvisos, activarAvisos, desactivarAvisos } from '../lib/avisosChat'
import { comprimirImagen } from '../lib/imageCompress'

// Turnos de soporte (hora de Colombia). Fuera de 7:00 am – 11:00 pm se muestra a Javier con el aviso de que responde desde las 7:00 am.
const AGENTES = [
  { id: 'javier', nombre: 'Javier Gonzales', desde: 7 * 60, hasta: 16 * 60, fondo: '#dfe8fb', piel: '#f2c9a0', cuello: '#e3b088', pelo: '#3b2b24', corbata: '#6c35de', gafas: false },
  { id: 'fernando', nombre: 'Fernando Restrepo', desde: 16 * 60, hasta: 23 * 60, fondo: '#fde9d9', piel: '#d9a47a', cuello: '#c98f64', pelo: '#1f1a17', corbata: '#0f9d8a', gafas: true },
]
const minutosColombia = f => { const d = new Date(f); return (d.getUTCHours() * 60 + d.getUTCMinutes() - 300 + 1440) % 1440 }
const enTurno = f => { const m = minutosColombia(f); return AGENTES.some(a => m >= a.desde && m < a.hasta) }
const agenteDe = f => { const m = minutosColombia(f); return AGENTES.find(a => m >= a.desde && m < a.hasta) || AGENTES[0] }

// Dibujo del agente (secretario con audífonos). Es un SVG propio: no depende de ninguna imagen externa.
function AvatarAgente({ agente, size = 40 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" role="img" aria-label={agente.nombre} style={{ flexShrink: 0, borderRadius: '50%', display: 'block' }}>
      <rect width="48" height="48" fill={agente.fondo} />
      <path d="M5 48c0-9.5 8.5-14.5 19-14.5S43 38.5 43 48z" fill="#2f3a6b" />
      <path d="M19.2 33.8L24 41l4.8-7.2z" fill="#fff" />
      <path d="M24 36.5l-1.9 3 1.9 8.5 1.9-8.5z" fill={agente.corbata} />
      <rect x="21" y="28" width="6" height="7" rx="2" fill={agente.cuello} />
      <ellipse cx="24" cy="21" rx="8" ry="9" fill={agente.piel} />
      <path d="M15.8 20.5c-.4-6.5 3.5-10.3 8.2-10.3s8.6 3.8 8.2 10.3c-1.6-3.2-4.3-4.8-8.2-4.8s-6.6 1.6-8.2 4.8z" fill={agente.pelo} />
      <circle cx="20.7" cy="22" r="1.05" fill="#3b2b24" />
      <circle cx="27.3" cy="22" r="1.05" fill="#3b2b24" />
      {agente.gafas && <g fill="none" stroke="#2b2b2b" strokeWidth="0.9"><circle cx="20.7" cy="22" r="2.6" /><circle cx="27.3" cy="22" r="2.6" /><path d="M23.3 22h1.4" /></g>}
      <path d="M21 26q3 2.6 6 0" fill="none" stroke="#b5654a" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M14.6 21c0-6.8 4.1-11 9.4-11s9.4 4.2 9.4 11" fill="none" stroke="#1a73e8" strokeWidth="2" strokeLinecap="round" />
      <rect x="12.6" y="19.5" width="3.3" height="6.2" rx="1.65" fill="#1a73e8" />
      <rect x="32.1" y="19.5" width="3.3" height="6.2" rx="1.65" fill="#1a73e8" />
      <path d="M33.8 25.5c0 3.2-2.2 4.8-5.3 4.8" fill="none" stroke="#1a73e8" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="28.3" cy="30.3" r="1.4" fill="#1a73e8" />
    </svg>
  )
}

// ── Fotos y videos ────────────────────────────────────────────
const BUCKET = 'soporte-adjuntos'
const TIPOS_OK = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime', 'video/webm', 'audio/mp4', 'audio/x-m4a', 'audio/mpeg', 'audio/aac', 'audio/webm', 'audio/ogg']
const MAX_AUDIO = 25 * 1024 * 1024
const EXT_AUDIO = { 'audio/mp4': 'm4a', 'audio/x-m4a': 'm4a', 'audio/mpeg': 'mp3', 'audio/aac': 'aac', 'audio/webm': 'weba', 'audio/ogg': 'ogg' }
const tipoDe = f => f.type.startsWith('video/') ? 'video' : f.type.startsWith('audio/') ? 'audio' : 'imagen'
const puedeGrabar = () => { try { return !Capacitor.isNativePlatform() && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined' } catch { return false } }
const mmss = n => `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`
const MAX_VIDEO = 50 * 1024 * 1024
const MAX_FOTO = 10 * 1024 * 1024
const urlsFirmadas = new Map() // path → { url, vence }: evita pedir de nuevo el permiso cada vez que se dibuja

function obtenerUrl(path) {
  const c = urlsFirmadas.get(path)
  if (c && c.vence > Date.now()) return Promise.resolve(c.url)
  return supabase.storage.from(BUCKET).createSignedUrl(path, 3600).then(({ data }) => {
    if (!data?.signedUrl) return null
    urlsFirmadas.set(path, { url: data.signedUrl, vence: Date.now() + 50 * 60000 })
    return data.signedUrl
  }, () => null)
}

// Foto o video dentro de una burbuja (los recién enviados se ven al instante con su vista previa local)
function Adjunto({ m, alAbrir }) {
  const [url, setUrl] = useState(null)
  const [sinSonido, setSinSonido] = useState(false) // el navegador no puede reproducir ese audio
  useEffect(() => {
    if (m.previa || !m.adjunto_path) return
    let vivo = true
    obtenerUrl(m.adjunto_path).then(u => { if (vivo) setUrl(u) })
    return () => { vivo = false }
  }, [m.previa, m.adjunto_path])
  const src = m.previa || url
  const caja = { display: 'block', width: 'min(240px, 62vw)', height: 'auto', maxHeight: '320px', objectFit: 'cover', borderRadius: '10px', background: '#e8eaed' }
  if (!src) return <div style={{ ...caja, height: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '.72rem', color: '#80868b' }}>Cargando…</div>
  if (m.adjunto_tipo === 'audio') {
    return (
      <div>
        <audio src={src} controls preload="metadata" onError={() => setSinSonido(true)} style={{ display: 'block', width: 'min(240px, 62vw)', height: '40px' }} />
        {sinSonido && <a href={src} target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginTop: '4px', fontSize: '.72rem', fontWeight: '700', color: 'inherit', textDecoration: 'underline' }}>No se pudo reproducir aquí: abrir o descargar el audio</a>}
      </div>
    )
  }
  if (m.adjunto_tipo === 'video') return <video src={`${src}#t=0.1`} controls playsInline preload="metadata" style={{ ...caja, background: '#000' }} />
  return <img src={src} alt="Foto enviada" onClick={() => alAbrir(src)} style={{ ...caja, cursor: 'zoom-in' }} />
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
  const [ahora, setAhora] = useState(() => Date.now()) // para cambiar de agente cuando cambia el turno
  const [avisos, setAvisos] = useState('cargando') // estado de las notificaciones del navegador
  const [chat, setChat] = useState(null)
  const [mensajes, setMensajes] = useState([])
  const [texto, setTexto] = useState('')
  const [archivo, setArchivo] = useState(null)   // foto o video elegido, listo para enviar
  const [previa, setPrevia] = useState(null)     // dirección local para mostrarlo
  const [visor, setVisor] = useState(null)       // foto abierta a pantalla completa
  const inputArchivo = useRef(null)
  const [nombreEdit, setNombreEdit] = useState('')
  const [guardandoNombre, setGuardandoNombre] = useState(false)
  const [grabando, setGrabando] = useState(false)
  const [segundos, setSegundos] = useState(0)
  const grabadora = useRef(null)
  const trozos = useRef([])
  const descartar = useRef(false)
  const limite = useRef(null)
  const [enviando, setEnviando] = useState(false)
  const [aviso, setAviso] = useState('')
  const [vv, setVv] = useState(null) // área visible real (con teclado abierto en el celular)
  const fin = useRef(null)
  const secuencia = useRef(0)

  const cargar = useCallback(async chatId => {
    const { data } = await supabase.from('soporte_mensajes').select('id, de, texto, created_at, wa_estado, adjunto_path, adjunto_tipo').eq('chat_id', chatId).order('created_at', { ascending: true }).limit(300)
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

  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), 60000)
    return () => clearInterval(t)
  }, [])

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

  useEffect(() => {
    if (!grabando) return
    const t = setInterval(() => setSegundos(n => n + 1), 1000)
    return () => clearInterval(t)
  }, [grabando])

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

  const agenteActual = agenteDe(ahora)
  const necesitaNombre = !!chat && chat.nombre === null // null = todavía no lo ha dicho (undefined = la columna aún no existe: no se pide)
  const primerNombre = chat?.nombre ? chat.nombre.split(' ')[0] : ''
  const saludo = BIENVENIDA.replace('¡Hola!', primerNombre ? `¡Hola, ${primerNombre}!` : '¡Hola!')

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

  async function guardarNombre() {
    const n = nombreEdit.trim().replace(/\s+/g, ' ')
    if (n.length < 2 || guardandoNombre) return
    setGuardandoNombre(true); setAviso('')
    const { error } = await supabase.rpc('soporte_guardar_nombre', { p_nombre: n })
    setGuardandoNombre(false)
    if (error) { setAviso('No pudimos guardar tu nombre. Intenta de nuevo.'); return }
    setChat(c => (c ? { ...c, nombre: n } : c))
  }

  async function elegirArchivo(e) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    setAviso('')
    try {
      let listo = f
      if (f.type.startsWith('image/')) listo = await comprimirImagen(f, { maxSize: 1600, calidad: 0.82 })
      else if (!f.type.startsWith('video/') && !f.type.startsWith('audio/')) throw new Error('Solo puedes enviar fotos, videos y audios.')
      if (!TIPOS_OK.includes(listo.type)) throw new Error('Ese formato no se puede enviar. Prueba con JPG, PNG, MP4, MOV, MP3 o M4A.')
      if (listo.type.startsWith('video/') && listo.size > MAX_VIDEO) throw new Error('El video pesa más de 50 MB. Grábalo más corto o en menor calidad.')
      if (listo.type.startsWith('audio/') && listo.size > MAX_AUDIO) throw new Error('El audio pesa demasiado. Envía uno más corto.')
      if (listo.type.startsWith('image/') && listo.size > MAX_FOTO) throw new Error('La foto pesa demasiado. Prueba con otra.')
      if (previa) URL.revokeObjectURL(previa)
      setArchivo(listo)
      setPrevia(URL.createObjectURL(listo))
    } catch (er) {
      setAviso(er.message || 'No se pudo preparar el archivo.')
    }
  }

  async function empezarGrabacion() {
    if (enviando || !chat || grabando) return
    setAviso('')
    try {
      const flujo = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mime = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'].find(t => MediaRecorder.isTypeSupported(t)) || ''
      const rec = new MediaRecorder(flujo, mime ? { mimeType: mime } : undefined)
      const inicio = Date.now()
      trozos.current = []; descartar.current = false
      rec.ondataavailable = e => { if (e.data?.size) trozos.current.push(e.data) }
      rec.onstop = () => {
        flujo.getTracks().forEach(t => t.stop())
        clearTimeout(limite.current)
        setGrabando(false)
        if (descartar.current || !trozos.current.length || Date.now() - inicio < 800) return
        const tipo = (rec.mimeType || mime || 'audio/mp4').split(';')[0]
        const f = new File(trozos.current, `audio.${EXT_AUDIO[tipo] || 'm4a'}`, { type: tipo })
        enviar({ texto: '', archivo: f, previa: URL.createObjectURL(f) })
      }
      rec.start()
      grabadora.current = rec
      setSegundos(0); setGrabando(true)
      limite.current = setTimeout(() => { if (rec.state !== 'inactive') rec.stop() }, 5 * 60000) // máximo 5 minutos
    } catch {
      setAviso('No pudimos usar el micrófono. Permite el acceso al micrófono en tu navegador e intenta otra vez.')
    }
  }

  function pararGrabacion(mandar) {
    descartar.current = !mandar
    const r = grabadora.current
    if (r && r.state !== 'inactive') r.stop()
  }

  function quitarArchivo() {
    if (previa) URL.revokeObjectURL(previa)
    setArchivo(null); setPrevia(null)
  }

  // "reintento" es un mensaje que falló (trae su texto y su archivo para volver a mandarlo)
  async function enviar(reintento) {
    const t = (reintento ? reintento.texto : texto).trim()
    const f = reintento ? reintento.archivo : archivo
    if ((!t && !f) || enviando || !chat) return
    setEnviando(true); setAviso('')
    const tmp = {
      id: `tmp-${++secuencia.current}`, de: 'usuario', texto: t, created_at: new Date().toISOString(), local: true,
      archivo: f || null, previa: f ? (reintento ? reintento.previa : previa) : null, adjunto_tipo: f ? tipoDe(f) : null,
    }
    setMensajes(prev => [...prev.filter(m => !(reintento && m.id === reintento.id)), tmp])
    if (!reintento) { setTexto(''); setArchivo(null); setPrevia(null) } // la vista previa pasa a la burbuja
    try {
      const { data: s } = await supabase.auth.getSession()
      const cabeceras = { 'Content-Type': 'application/json', Authorization: `Bearer ${s?.session?.access_token || ''}` }
      let adjunto
      if (f) {
        const rp = await fetch(apiUrl('/api/soporte-adjunto'), { method: 'POST', headers: cabeceras, body: JSON.stringify({ contentType: f.type, size: f.size }) })
        const jp = await rp.json().catch(() => ({}))
        if (!rp.ok) throw new Error(jp.error || 'No se pudo preparar el archivo')
        const { error: eu } = await supabase.storage.from(BUCKET).uploadToSignedUrl(jp.path, jp.token, f, { contentType: f.type })
        if (eu) throw new Error('No se pudo subir el archivo. Revisa tu internet e intenta otra vez.')
        adjunto = { path: jp.path }
      }
      const r = await fetch(apiUrl('/api/soporte-enviar'), {
        method: 'POST',
        headers: cabeceras,
        body: JSON.stringify({ texto: t, contexto: location.pathname, adjunto }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j.error || 'No se pudo enviar')
      setMensajes(prev => prev.some(m => m.id === j.id) ? prev.filter(m => m.id !== tmp.id) : prev.map(m => m.id === tmp.id ? { ...m, id: j.id, local: false, adjunto_path: adjunto?.path || null } : m))
      if (tmp.previa) setTimeout(() => URL.revokeObjectURL(tmp.previa), 90000)
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
            <AvatarAgente agente={agenteActual} size={40} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '.92rem', fontWeight: '800', color: '#202124', lineHeight: 1.2 }}>{agenteActual.nombre}</div>
              <div style={{ fontSize: '.7rem', color: '#80868b', lineHeight: 1.2 }}>{enTurno(ahora) ? 'Asistente de Golmebol' : 'Atención desde las 7:00 a. m.'}</div>
            </div>
          </div>

          {avisos === 'activo' && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px', padding: '2px 12px', background: '#fff', borderBottom: '1px solid #f1f3f4', fontSize: '.66rem', color: '#9aa0a6', flexShrink: 0 }}>
              <Bell size={11} />
              <span>Avisos activados</span>
              <button onClick={alternarAvisos} style={{ minHeight: '28px', padding: '0 4px', background: 'none', border: 'none', color: '#9aa0a6', fontSize: '.66rem', textDecoration: 'underline', cursor: 'pointer' }}>Desactivar</button>
            </div>
          )}

          {necesitaNombre ? (
            <div style={{ flex: 1, overflowY: 'auto', padding: '28px 18px', background: '#f6f7f9', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
              <AvatarAgente agente={agenteActual} size={76} />
              <div style={{ fontSize: '1.02rem', fontWeight: '800', color: '#202124', textAlign: 'center' }}>¡Hola! Soy {agenteActual.nombre}</div>
              <div style={{ fontSize: '.86rem', color: '#5f6368', textAlign: 'center', lineHeight: 1.5, maxWidth: '300px' }}>Antes de empezar, ¿cómo te llamas? Así sabemos con quién hablamos. Solo te lo preguntamos esta vez.</div>
              <input value={nombreEdit} onChange={e => setNombreEdit(e.target.value)} maxLength={60} placeholder="Tu nombre" autoComplete="name"
                onKeyDown={e => { if (e.key === 'Enter') guardarNombre() }}
                style={{ width: '100%', maxWidth: '300px', minHeight: '48px', border: '1px solid #dadce0', borderRadius: '24px', padding: '0 18px', fontSize: '16px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', background: '#fff' }} />
              <button onClick={guardarNombre} disabled={nombreEdit.trim().length < 2 || guardandoNombre}
                style={{ width: '100%', maxWidth: '300px', minHeight: '48px', borderRadius: '24px', border: 'none', background: nombreEdit.trim().length >= 2 ? 'linear-gradient(135deg,#1a73e8,#6c35de)' : '#dadce0', color: '#fff', fontSize: '.92rem', fontWeight: '800', cursor: nombreEdit.trim().length >= 2 ? 'pointer' : 'default' }}>
                {guardandoNombre ? 'Guardando…' : 'Continuar'}
              </button>
              {aviso && <div style={{ fontSize: '.76rem', color: '#7a5b00', background: '#fef3c7', borderRadius: '10px', padding: '8px 12px', maxWidth: '300px', textAlign: 'center' }}>{aviso}</div>}
            </div>
          ) : (
            <>
          <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', overscrollBehaviorY: 'contain', padding: '14px 12px', background: '#f6f7f9', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ alignSelf: 'flex-start', maxWidth: '92%', display: 'flex', alignItems: 'flex-end', gap: '6px' }}>
              <AvatarAgente agente={agenteActual} size={28} />
              <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '14px 14px 14px 4px', padding: '9px 12px', fontSize: '.86rem', color: '#202124', lineHeight: 1.45 }}>
                <div style={{ fontSize: '.66rem', fontWeight: '800', color: '#6c35de', marginBottom: '2px' }}>{agenteActual.nombre}</div>
                {saludo}
              </div>
            </div>
            <div style={{ alignSelf: 'center', fontSize: '.66rem', color: '#9aa0a6', textAlign: 'center' }}>Los mensajes y archivos de este chat se borran solos a los 8 días.</div>
            {!enTurno(ahora) && (
              <div style={{ alignSelf: 'center', maxWidth: '92%', display: 'flex', gap: '8px', alignItems: 'flex-start', background: '#fff7e0', border: '1px solid #f3e2a8', borderRadius: '12px', padding: '9px 12px', fontSize: '.78rem', color: '#7a5b00', lineHeight: 1.45 }}>
                <Moon size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                <span>Ahora estamos fuera de horario y quizá no podamos responderte enseguida. Si hay alguien disponible, te atendemos; si no, déjanos tu duda y te respondemos apenas podamos.</span>
              </div>
            )}
            {mensajes.map((m, i) => {
              const mio = m.de === 'usuario'
              const nuevoDia = i === 0 || new Date(m.created_at).toDateString() !== new Date(mensajes[i - 1].created_at).toDateString()
              return (
                <div key={m.id} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {nuevoDia && <div style={{ alignSelf: 'center', fontSize: '.68rem', color: '#80868b', background: '#e8eaed', borderRadius: '999px', padding: '2px 10px' }}>{diaTexto(m.created_at)}</div>}
                  <div style={{ alignSelf: mio ? 'flex-end' : 'flex-start', maxWidth: mio ? '86%' : '92%', display: 'flex', alignItems: 'flex-end', gap: '6px' }}>
                    {!mio && <AvatarAgente agente={agenteDe(m.created_at)} size={28} />}
                  <div style={{ background: mio ? '#1a73e8' : '#fff', color: mio ? '#fff' : '#202124', border: mio ? 'none' : '1px solid #e8eaed', borderRadius: mio ? '14px 14px 4px 14px' : '14px 14px 14px 4px', padding: '9px 12px', fontSize: '.86rem', lineHeight: 1.45, opacity: m.local ? .7 : 1, wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
                    {!mio && <div style={{ fontSize: '.66rem', fontWeight: '800', color: '#6c35de', marginBottom: '2px' }}>{agenteDe(m.created_at).nombre}</div>}
                    {(m.adjunto_path || m.previa) && <div style={{ margin: '2px 0 6px' }}><Adjunto m={m} alAbrir={setVisor} /></div>}
                    {m.texto}
                    <div style={{ fontSize: '.62rem', marginTop: '3px', textAlign: 'right', color: mio ? 'rgba(255,255,255,.75)' : '#9aa0a6' }}>
                      {m.fallo ? 'No se envió' : m.local ? 'Enviando…' : hora(m.created_at)}
                    </div>
                  </div>
                  </div>
                  {m.fallo && <button onClick={() => enviar(m)} style={{ alignSelf: 'flex-end', minHeight: '36px', background: 'none', border: 'none', color: '#d93025', fontSize: '.76rem', fontWeight: '700', cursor: 'pointer' }}>Reintentar</button>}
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

          {archivo && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', background: '#f6f7f9', borderTop: '1px solid #e8eaed', flexShrink: 0 }}>
              {archivo.type.startsWith('audio/')
                ? <div style={{ width: '52px', height: '52px', borderRadius: '8px', background: '#e8f0fe', color: '#1a73e8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Mic size={24} /></div>
                : archivo.type.startsWith('video/')
                ? <video src={`${previa}#t=0.1`} muted playsInline preload="metadata" style={{ width: '52px', height: '52px', objectFit: 'cover', borderRadius: '8px', background: '#000', flexShrink: 0 }} />
                : <img src={previa} alt="" style={{ width: '52px', height: '52px', objectFit: 'cover', borderRadius: '8px', flexShrink: 0 }} />}
              <div style={{ flex: 1, minWidth: 0, fontSize: '.76rem', color: '#202124', fontWeight: '700', lineHeight: 1.3 }}>
                {archivo.type.startsWith('audio/') ? 'Audio listo para enviar' : archivo.type.startsWith('video/') ? 'Video listo para enviar' : 'Foto lista para enviar'}
                <div style={{ fontWeight: '400', color: '#80868b', fontSize: '.7rem' }}>{(archivo.size / 1048576).toFixed(1)} MB · puedes añadir un mensaje</div>
              </div>
              <button onClick={quitarArchivo} aria-label="Quitar el archivo" style={{ width: '44px', height: '44px', borderRadius: '50%', border: 'none', background: 'none', cursor: 'pointer', color: '#5f6368', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><X size={20} /></button>
            </div>
          )}

          {grabando ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px calc(10px + env(safe-area-inset-bottom))', borderTop: '1px solid #e8eaed', background: '#fff', flexShrink: 0 }}>
              <button onClick={() => pararGrabacion(false)} aria-label="Cancelar el audio"
                style={{ width: '44px', height: '44px', borderRadius: '50%', border: '1px solid #dadce0', background: '#fff', color: '#d93025', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Trash2 size={20} />
              </button>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '.9rem', fontWeight: '700', color: '#202124' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#d93025', flexShrink: 0 }} />
                Grabando… {mmss(segundos)}
              </div>
              <button onClick={() => pararGrabacion(true)} aria-label="Enviar el audio"
                style={{ width: '44px', height: '44px', borderRadius: '50%', border: 'none', background: '#1a73e8', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Send size={19} />
              </button>
            </div>
          ) : (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', padding: '10px 12px calc(10px + env(safe-area-inset-bottom))', borderTop: '1px solid #e8eaed', background: '#fff', flexShrink: 0 }}>
            <input ref={inputArchivo} type="file" accept="image/*,video/*,audio/*" onChange={elegirArchivo} style={{ display: 'none' }} />
            <button onClick={() => inputArchivo.current?.click()} disabled={enviando || !chat} aria-label="Adjuntar foto, video o audio"
              style={{ width: '44px', height: '44px', borderRadius: '50%', border: '1px solid #dadce0', background: '#fff', color: '#5f6368', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Paperclip size={20} />
            </button>
            <textarea value={texto} onChange={e => setTexto(e.target.value)} rows={1} maxLength={1000} placeholder={archivo ? 'Añade un mensaje (opcional)…' : 'Escribe tu mensaje…'}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !isMobile) { e.preventDefault(); enviar() } }}
              style={{ flex: 1, resize: 'none', maxHeight: '110px', minHeight: '44px', border: '1px solid #dadce0', borderRadius: '22px', padding: '11px 14px', fontSize: '16px', fontFamily: 'inherit', outline: 'none', lineHeight: 1.3, boxSizing: 'border-box' }}
              onInput={e => { e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 110) + 'px' }} />
            {(texto.trim() || archivo || !puedeGrabar())
              ? <button onClick={() => enviar()} disabled={(!texto.trim() && !archivo) || enviando || !chat} aria-label="Enviar mensaje"
                  style={{ width: '44px', height: '44px', borderRadius: '50%', border: 'none', background: (texto.trim() || archivo) ? '#1a73e8' : '#dadce0', color: '#fff', cursor: (texto.trim() || archivo) ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Send size={19} />
                </button>
              : <button onClick={empezarGrabacion} disabled={enviando || !chat} aria-label="Grabar un audio"
                  style={{ width: '44px', height: '44px', borderRadius: '50%', border: 'none', background: '#1a73e8', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Mic size={20} />
                </button>}
          </div>
          )}
            </>
          )}
        </div>
      )}

      {visor && (
        <div onClick={() => setVisor(null)} role="dialog" aria-label="Foto"
          style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(0,0,0,.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <img src={visor} alt="Foto enviada" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: '8px' }} />
          <button onClick={() => setVisor(null)} aria-label="Cerrar la foto"
            style={{ position: 'absolute', top: 'calc(10px + env(safe-area-inset-top))', right: '12px', width: '48px', height: '48px', borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,.18)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={24} />
          </button>
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
