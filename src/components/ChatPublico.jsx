// Chat de ayuda para las páginas PÚBLICAS (visitantes sin cuenta).
// Lo que escriben llega a Golmebol por Telegram y las respuestas vuelven a este mismo chat.
// Para reglamento o quejas de un torneo se muestra el WhatsApp del organizador de ese torneo.
// El visitante se identifica con un código secreto guardado en su navegador (no hay cuentas).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Building2, ChevronLeft, MessageCircle, Mic, Moon, Paperclip, Send, Trash2, Trophy, X } from 'lucide-react'
import { Capacitor } from '@capacitor/core'
import { FaWhatsapp } from 'react-icons/fa'
import { supabase } from '../lib/supabase'
import { apiUrl } from '../lib/apiBase'
import { useIsMobile } from '../hooks/useIsMobile'
import { agenteDe, enTurno } from '../lib/agentesSoporte'
import { digitosWhatsapp } from '../lib/telefonoCo'
import AvatarAgente, { AvatarAsistente } from './AvatarAgente'
import TextoConEnlaces from './TextoConEnlaces'
import { comprimirImagen } from '../lib/imageCompress'

// Fotos y notas de voz en el chat público (suben directo a Storage con un permiso temporal del servidor)
const BUCKET = 'soporte-adjuntos'
const TIPOS_OK = ['image/jpeg', 'image/png', 'image/webp', 'audio/mp4', 'audio/x-m4a', 'audio/mpeg', 'audio/aac', 'audio/webm', 'audio/ogg']
const EXT_AUDIO = { 'audio/mp4': 'm4a', 'audio/x-m4a': 'm4a', 'audio/mpeg': 'mp3', 'audio/aac': 'aac', 'audio/webm': 'weba', 'audio/ogg': 'ogg' }
const MAX_FOTO = 10 * 1024 * 1024
const MAX_AUDIO = 15 * 1024 * 1024
const tipoDe = f => (f.type.startsWith('audio/') ? 'audio' : 'imagen')
const puedeGrabar = () => { try { return !Capacitor.isNativePlatform() && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined' } catch { return false } }
const mmss = n => `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`

// Foto o audio dentro de una burbuja (los recién enviados se ven al instante con su vista previa local)
function Adjunto({ m, alAbrir }) {
  const [sinSonido, setSinSonido] = useState(false)
  const src = m.previa || m.adjunto_url
  const caja = { display: 'block', width: 'min(240px, 62vw)', height: 'auto', maxHeight: '320px', objectFit: 'cover', borderRadius: '10px', background: '#e8eaed' }
  if (!src) return <div style={{ ...caja, height: m.adjunto_tipo === 'audio' ? '44px' : '120px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '.72rem', color: '#80868b' }}>{m.tiene_adjunto ? 'Archivo no disponible' : 'Cargando…'}</div>
  if (m.adjunto_tipo === 'audio') {
    return (
      <div>
        <audio src={src} controls preload="metadata" onError={() => setSinSonido(true)} style={{ display: 'block', width: 'min(240px, 62vw)', height: '40px' }} />
        {sinSonido && <a href={src} target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginTop: '4px', fontSize: '.72rem', fontWeight: '700', color: 'inherit', textDecoration: 'underline' }}>No se pudo reproducir aquí: abrir o descargar el audio</a>}
      </div>
    )
  }
  return <img src={src} alt="Foto enviada" onClick={() => alAbrir(src)} style={{ ...caja, cursor: 'zoom-in' }} />
}

const K_TOKEN = 'gm_chat_pub_token'
const K_NOMBRE = 'gm_chat_pub_nombre'
const K_VISTO = 'gm_chat_pub_visto'
const K_GLOBO = 'gm_chat_pub_globo'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// El almacenamiento del navegador puede no estar disponible (modo privado): todo funciona sin él
const leer = (k, s = localStorage) => { try { return s.getItem(k) || '' } catch { return '' } }
const guardar = (k, v, s = localStorage) => { try { s.setItem(k, v) } catch { /* nada */ } }
const nuevoToken = () => {
  try { if (crypto.randomUUID) return crypto.randomUUID() } catch { /* nada */ }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3) | 8).toString(16) })
}

// Páginas públicas donde aparece el chat. Los dominios propios de cada organizador no lo muestran.
const RUTAS = /^\/($|torneos\/?$|records\/?$|t\/|e\/|j\/|organizador\/|escenarios\/?$|reservar\/|pedir\/|equipos\/|login\/?$|jugador(\/|$)|mi-tarjeta\/?$|registro\/)/
const hostPropio = () => {
  try { const h = window.location.hostname; return h === 'localhost' || h === '127.0.0.1' || h.endsWith('golmebol.com') || h.endsWith('.vercel.app') } catch { return false }
}

const TEMAS = {
  organizador: {
    titulo: 'Quiero organizar mi torneo con Golmebol', sub: 'Te contamos cómo empezar', Icono: Trophy,
    saludo: '¡Qué bueno que quieras organizar con Golmebol! 🏆 Cuéntanos en qué ciudad estás, qué tipo de torneo quieres hacer y más o menos cuántos equipos.',
    contacto: true,
  },
  escenario: {
    titulo: 'Tengo una cancha o escenario y quiero un sistema de reservas', sub: 'Tus clientes reservan desde el celular', Icono: Building2,
    saludo: '¡Perfecto! 🏟️ Cuéntanos cómo se llama tu cancha o escenario, en qué ciudad está y cuántas canchas tienes, y te explicamos el sistema de reservas.',
    contacto: true,
  },
  torneo: {
    titulo: 'Reglamento o queja de este torneo', sub: 'Te atiende el organizador por WhatsApp', Icono: FaWhatsapp,
    saludo: 'Cuéntanos qué pasó con este torneo y te ayudamos. Para temas del reglamento o quejas, lo más rápido es escribirle al organizador.',
    contacto: false,
  },
  otro: {
    titulo: 'Otra consulta o ayuda', sub: 'Pregúntanos lo que necesites', Icono: MessageCircle,
    saludo: '¡Hola! 👋 Pregúntame lo que necesites: cuándo juega tu equipo, la tabla de posiciones, los goleadores, cómo reservar una cancha… Si no puedo ayudarte, una persona te responde por aquí mismo.',
    contacto: false,
  },
}

const hora = iso => new Date(iso).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' })
function diaTexto(iso) {
  const d = new Date(iso), hoy = new Date()
  const ayer = new Date(); ayer.setDate(hoy.getDate() - 1)
  if (d.toDateString() === hoy.toDateString()) return 'Hoy'
  if (d.toDateString() === ayer.toDateString()) return 'Ayer'
  return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'long' })
}

// Pide la conversación del visitante al servidor (null si no hay internet o falla)
async function pedirChat(token) {
  try {
    const r = await fetch(apiUrl('/api/publico-chat'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accion: 'leer', token }) })
    return r.ok ? await r.json() : null
  } catch { return null }
}

function ChatInterno() {
  const isMobile = useIsMobile()
  const location = useLocation()
  const ruta = location.pathname
  const esInicio = ruta === '/'
  const idTorneo = useMemo(() => { const m = ruta.match(/^\/t\/([^/]+)/); return m && UUID.test(m[1]) ? m[1] : null }, [ruta])

  const [abierto, setAbierto] = useState(false)
  const [vista, setVista] = useState('temas') // temas → datos → chat
  const [tema, setTema] = useState('otro')
  const [token, setToken] = useState(() => leer(K_TOKEN))
  const [tieneChat, setTieneChat] = useState(false)
  const [mensajes, setMensajes] = useState([])
  const [nombre, setNombre] = useState(() => leer(K_NOMBRE))
  const [contacto, setContacto] = useState('')
  const [texto, setTexto] = useState('')
  const [trampa, setTrampa] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [aviso, setAviso] = useState('')
  const [visto, setVisto] = useState(() => leer(K_VISTO))
  const [globo, setGlobo] = useState(() => !leer(K_GLOBO, sessionStorage))
  const [ahora, setAhora] = useState(() => Date.now())
  const [torneo, setTorneo] = useState(null) // { id, name, wa, organizador }
  const panelRef = useRef(null)
  const fin = useRef(null)
  const secuencia = useRef(0)
  // Foto o audio por enviar
  const [archivo, setArchivo] = useState(null)
  const [previa, setPrevia] = useState(null)
  const [visor, setVisor] = useState(null) // foto abierta a pantalla completa
  const inputArchivo = useRef(null)
  const [grabando, setGrabando] = useState(false)
  const [segundos, setSegundos] = useState(0)
  const grabadora = useRef(null)
  const trozos = useRef([])
  const descartar = useRef(false)
  const limite = useRef(null)

  useEffect(() => {
    if (!grabando) return
    const t = setInterval(() => setSegundos(n => n + 1), 1000)
    return () => clearInterval(t)
  }, [grabando])

  const aplicar = useCallback(j => {
    if (!j) return
    setTieneChat(!!j.chat)
    if (j.nombre) setNombre(j.nombre)
    setMensajes(prev => {
      const pendientes = prev.filter(m => m.local && !(j.mensajes || []).some(d => d.id === m.id))
      return [...(j.mensajes || []), ...pendientes]
    })
  }, [])
  const cargar = useCallback(tk => (tk ? pedirChat(tk).then(aplicar) : Promise.resolve()), [aplicar])

  // Si ya había escrito antes, se recupera su conversación
  useEffect(() => {
    if (!token) return
    let vivo = true
    pedirChat(token).then(j => { if (vivo) aplicar(j) })
    return () => { vivo = false }
  }, [token, aplicar])

  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), 60000)
    return () => clearInterval(t)
  }, [])

  // Respuestas: se revisa seguido con el chat abierto y de vez en cuando cerrado (solo si ya hay una conversación)
  useEffect(() => {
    if (!token || !tieneChat) return
    const t = setInterval(() => { if (document.visibilityState === 'visible') cargar(token) }, abierto ? 6000 : 60000)
    const alVolver = () => { if (document.visibilityState === 'visible') cargar(token) }
    document.addEventListener('visibilitychange', alVolver)
    window.addEventListener('focus', alVolver)
    window.addEventListener('online', alVolver)
    return () => {
      clearInterval(t)
      document.removeEventListener('visibilitychange', alVolver)
      window.removeEventListener('focus', alVolver)
      window.removeEventListener('online', alVolver)
    }
  }, [token, tieneChat, abierto, cargar])

  // Otros botones de la página (la portada) abren el chat con un tema ya elegido
  useEffect(() => {
    const alPedir = e => {
      const t = e.detail?.tema
      const msg = String(e.detail?.mensaje || '')
      const nom = (String(e.detail?.nombre || '').trim() || leer(K_NOMBRE)).replace(/\s+/g, ' ')
      if (t && TEMAS[t]) setTema(t)
      if (msg) setTexto(prev => (prev.trim() ? prev : msg)) // deja el mensaje ya escrito para que solo toque Enviar
      if (msg && nom.length >= 2) { setNombre(nom); guardar(K_NOMBRE, nom); setVista('chat') }
      else setVista(t && TEMAS[t] ? 'datos' : 'temas')
      setAbierto(true)
    }
    window.addEventListener('gm-abrir-chat-publico', alPedir)
    return () => window.removeEventListener('gm-abrir-chat-publico', alPedir)
  }, [])

  // En un torneo: datos del torneo y WhatsApp de su organizador (para reglamento o quejas)
  useEffect(() => {
    if (!abierto || !idTorneo || torneo?.id === idTorneo) return
    let vivo = true
    ;(async () => {
      const { data: t } = await supabase.from('tournaments').select('id, name, organizador_id').eq('id', idTorneo).maybeSingle()
      if (!vivo || !t) return
      let wa = '', organizador = ''
      if (t.organizador_id) {
        const { data: p } = await supabase.from('organizador_perfiles').select('nombre_publico, whatsapp').eq('organizador_id', t.organizador_id).maybeSingle()
        wa = digitosWhatsapp(p?.whatsapp); organizador = p?.nombre_publico || ''
      }
      if (vivo) setTorneo({ id: t.id, name: t.name, wa: wa.length >= 10 ? wa : '', organizador })
    })().catch(() => {})
    return () => { vivo = false }
  }, [abierto, idTorneo, torneo?.id])

  const agenteActual = agenteDe(ahora)
  const cfg = TEMAS[tema] || TEMAS.otro
  const vistaActual = tieneChat ? 'chat' : vista
  const viendoChat = abierto && vistaActual === 'chat'
  const ultimoSoporte = useMemo(() => mensajes.filter(m => m.de === 'soporte').at(-1)?.created_at || '', [mensajes])
  const sinLeer = useMemo(() => viendoChat ? 0 : mensajes.filter(m => m.de === 'soporte' && (!visto || new Date(m.created_at) > new Date(visto))).length, [mensajes, visto, viendoChat])

  // Con el chat abierto, lo que llegue cuenta como visto (se recuerda aunque cierre la página)
  useEffect(() => { if (viendoChat && ultimoSoporte) guardar(K_VISTO, ultimoSoporte) }, [viendoChat, ultimoSoporte])

  useEffect(() => { if (abierto) fin.current?.scrollIntoView({ block: 'end' }) }, [mensajes, abierto, vistaActual])

  // Celular: el chat usa el área que deja libre el teclado (misma técnica del chat de ayuda del admin)
  useEffect(() => {
    if (!abierto || !isMobile || !window.visualViewport) return
    const vp = window.visualViewport
    let cuadro = 0
    let tecladoAntes = false
    const aplicar = () => {
      cuadro = 0
      const el = panelRef.current
      if (!el) return
      const teclado = window.innerHeight - vp.height > 120
      if (teclado) {
        el.style.bottom = 'auto'
        el.style.height = `${Math.round(vp.height)}px`
        el.style.transform = `translate3d(0, ${Math.round(vp.offsetTop)}px, 0)`
      } else {
        el.style.bottom = '0px'
        el.style.height = ''
        el.style.transform = ''
      }
      if (teclado !== tecladoAntes) { tecladoAntes = teclado; fin.current?.scrollIntoView({ block: 'end' }) }
    }
    const medir = () => { if (!cuadro) cuadro = requestAnimationFrame(aplicar) }
    const medirTarde = () => { medir(); setTimeout(medir, 150); setTimeout(medir, 450) }
    medir()
    vp.addEventListener('resize', medir); vp.addEventListener('scroll', medir)
    window.addEventListener('orientationchange', medirTarde)
    document.addEventListener('focusout', medirTarde)
    return () => {
      if (cuadro) cancelAnimationFrame(cuadro)
      vp.removeEventListener('resize', medir); vp.removeEventListener('scroll', medir)
      window.removeEventListener('orientationchange', medirTarde)
      document.removeEventListener('focusout', medirTarde)
    }
  }, [abierto, isMobile])

  // Bloquea la página de atrás mientras el chat ocupa toda la pantalla del celular
  useEffect(() => {
    if (!abierto || !isMobile) return
    document.body.classList.add('gm-chat-abierto')
    const y = window.scrollY
    const b = document.body.style
    const antes = { position: b.position, top: b.top, left: b.left, right: b.right, width: b.width, overflow: b.overflow }
    b.position = 'fixed'; b.top = `-${y}px`; b.left = '0'; b.right = '0'; b.width = '100%'; b.overflow = 'hidden'
    return () => { Object.assign(b, antes); window.scrollTo(0, y); document.body.classList.remove('gm-chat-abierto') }
  }, [abierto, isMobile])

  function cerrar() {
    if (viendoChat && ultimoSoporte) setVisto(ultimoSoporte)
    setAbierto(false)
  }
  function abrir() { setAbierto(true); setGlobo(false); guardar(K_GLOBO, '1', sessionStorage) }
  function cerrarGlobo() { setGlobo(false); guardar(K_GLOBO, '1', sessionStorage) }

  function elegirTema(t) {
    setTema(t); setAviso('')
    setVista('datos')
  }

  function seguirAlChat() {
    const n = nombre.trim().replace(/\s+/g, ' ')
    if (n.length < 2) return
    setNombre(n); guardar(K_NOMBRE, n)
    setVista('chat')
  }

  const enlaceWa = torneo?.wa
    ? `https://wa.me/${torneo.wa}?text=${encodeURIComponent(`Hola${torneo.organizador ? ` ${torneo.organizador}` : ''}, te escribo desde Golmebol por el torneo "${torneo.name}". Quiero consultar sobre el reglamento / hacer una queja: `)}`
    : ''

  async function elegirArchivo(e) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    setAviso('')
    try {
      let listo = f
      if (f.type.startsWith('image/')) listo = await comprimirImagen(f, { maxSize: 1600, calidad: 0.82 })
      else if (!f.type.startsWith('audio/')) throw new Error('Solo puedes enviar fotos y audios.')
      const tipo = (listo.type || '').split(';')[0]
      if (!TIPOS_OK.includes(tipo)) throw new Error('Ese formato no se puede enviar. Prueba con una foto JPG o PNG, o un audio MP3 o M4A.')
      if (tipo.startsWith('audio/') && listo.size > MAX_AUDIO) throw new Error('El audio pesa demasiado. Envía uno más corto.')
      if (tipo.startsWith('image/') && listo.size > MAX_FOTO) throw new Error('La foto pesa demasiado. Prueba con otra.')
      if (previa) URL.revokeObjectURL(previa)
      setArchivo(listo)
      setPrevia(URL.createObjectURL(listo))
    } catch (er) {
      setAviso(er.message || 'No se pudo preparar el archivo.')
    }
  }

  function quitarArchivo() {
    if (previa) URL.revokeObjectURL(previa)
    setArchivo(null); setPrevia(null)
  }

  async function empezarGrabacion() {
    if (enviando || grabando) return
    setAviso('')
    try {
      const flujo = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mime = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'].find(t => MediaRecorder.isTypeSupported(t)) || ''
      const rec = new MediaRecorder(flujo, mime ? { mimeType: mime } : undefined)
      const inicio = Date.now()
      trozos.current = []; descartar.current = false
      rec.ondataavailable = ev => { if (ev.data?.size) trozos.current.push(ev.data) }
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
      limite.current = setTimeout(() => { if (rec.state !== 'inactive') rec.stop() }, 3 * 60000) // máximo 3 minutos
    } catch {
      setAviso('No pudimos usar el micrófono. Permite el acceso al micrófono en tu navegador e intenta otra vez.')
    }
  }

  function pararGrabacion(mandar) {
    descartar.current = !mandar
    const r = grabadora.current
    if (r && r.state !== 'inactive') r.stop()
  }

  // "reintento" es un mensaje que falló (trae su texto y su archivo para volver a mandarlo)
  async function enviar(reintento) {
    const t = (reintento ? reintento.texto || '' : texto).trim()
    const f = reintento ? (reintento.archivo || null) : archivo
    if ((!t && !f) || enviando) return
    const tk = token || nuevoToken()
    if (!token) { guardar(K_TOKEN, tk); setToken(tk) }
    setEnviando(true); setAviso('')
    const tmp = {
      id: `tmp-${++secuencia.current}`, de: 'usuario', texto: t, created_at: new Date().toISOString(), local: true,
      archivo: f || null, previa: f ? (reintento ? reintento.previa : previa) : null, adjunto_tipo: f ? tipoDe(f) : null,
    }
    setMensajes(prev => [...prev.filter(m => !(reintento && m.id === reintento.id)), tmp])
    if (!reintento) { setTexto(''); setArchivo(null); setPrevia(null) } // la vista previa pasa a la burbuja
    const datosNuevo = tieneChat ? {} : { nombre, tema, torneoId: idTorneo || undefined, contacto: cfg.contacto ? contacto : undefined }
    try {
      let adjunto
      if (f) {
        const rp = await fetch(apiUrl('/api/publico-chat'), {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accion: 'adjunto', token: tk, contentType: f.type, size: f.size, web: trampa, ...datosNuevo }),
        })
        const jp = await rp.json().catch(() => ({}))
        if (!rp.ok) throw new Error(jp.error || 'No se pudo preparar el archivo')
        setTieneChat(true)
        const { error: eu } = await supabase.storage.from(BUCKET).uploadToSignedUrl(jp.path, jp.token, f, { contentType: f.type })
        if (eu) throw new Error('No se pudo subir el archivo. Revisa tu internet e intenta otra vez.')
        adjunto = { path: jp.path }
      }
      const r = await fetch(apiUrl('/api/publico-chat'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'enviar', token: tk, texto: t, adjunto, ruta, web: trampa, ...datosNuevo }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j.error || 'No se pudo enviar')
      setTieneChat(true)
      if (j.auto) cargar(tk) // el asistente automático ya respondió: se muestra de una
      setMensajes(prev => prev.some(m => m.id === j.id) ? prev.filter(m => m.id !== tmp.id) : prev.map(m => m.id === tmp.id ? { ...m, id: j.id, local: false } : m))
      if (j.wa_estado === 'error' && !j.auto) setAviso('Tu mensaje quedó guardado, pero no pudimos avisar a soporte en este momento. Lo veremos en cuanto entremos.')
    } catch (e) {
      setMensajes(prev => prev.map(m => m.id === tmp.id ? { ...m, fallo: true } : m))
      setAviso(e.message === 'Failed to fetch' ? 'Sin conexión. Revisa tu internet e intenta otra vez.' : e.message)
    }
    setEnviando(false)
  }

  const bottomFab = 'calc(16px + env(safe-area-inset-bottom))'
  const panelStyle = isMobile
    ? { position: 'fixed', left: 0, right: 0, top: 0, bottom: 0, zIndex: 300, background: '#fff', display: 'flex', flexDirection: 'column', overscrollBehavior: 'none', willChange: 'transform', color: '#202124' }
    : { position: 'fixed', right: '24px', bottom: '24px', width: '380px', height: 'min(560px, calc(100vh - 48px))', zIndex: 300, background: '#fff', display: 'flex', flexDirection: 'column', borderRadius: '16px', boxShadow: '0 12px 40px rgba(0,0,0,.35)', overflow: 'hidden', border: '1px solid #e8eaed', color: '#202124' }
  const fondoCuerpo = '#f6f7f9'
  const btnPrincipal = ok => ({ width: '100%', maxWidth: '320px', minHeight: '48px', borderRadius: '24px', border: 'none', background: ok ? 'linear-gradient(135deg,#1a73e8,#6c35de)' : '#dadce0', color: '#fff', fontSize: '.92rem', fontWeight: '800', cursor: ok ? 'pointer' : 'default' })
  const campo = { width: '100%', maxWidth: '320px', minHeight: '48px', border: '1px solid #dadce0', borderRadius: '24px', padding: '0 18px', fontSize: '16px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', background: '#fff', color: '#202124' }

  return (
    <>
      {!abierto && (
        <>
          {esInicio && globo && (
            <div style={{ position: 'fixed', right: '14px', bottom: `calc(${bottomFab} + 66px)`, zIndex: 120, maxWidth: 'min(270px, calc(100vw - 40px))', background: '#fff', color: '#202124', borderRadius: '14px 14px 4px 14px', padding: '11px 36px 11px 14px', fontSize: '.82rem', lineHeight: 1.4, fontWeight: '600', boxShadow: '0 8px 28px rgba(0,0,0,.4)' }}>
              ¿Quieres organizar tu torneo o tener reservas para tu cancha? <span style={{ color: '#6c35de', fontWeight: '800' }}>Escríbenos aquí.</span>
              <button onClick={cerrarGlobo} aria-label="Cerrar este mensaje" style={{ position: 'absolute', top: '2px', right: '2px', width: '34px', height: '34px', border: 'none', background: 'none', color: '#80868b', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={16} /></button>
            </div>
          )}
          <button onClick={abrir} aria-label="Abrir el chat con Golmebol"
            style={{ position: 'fixed', right: '14px', bottom: bottomFab, zIndex: 120, minWidth: '56px', height: '56px', padding: '0 18px 0 16px', borderRadius: '28px', border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#1a73e8,#6c35de)', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 6px 20px rgba(26,115,232,.45)', fontSize: '.86rem', fontWeight: '700' }}>
            <MessageCircle size={22} />
            <span>{esInicio ? 'Escríbenos' : 'Ayuda'}</span>
            {sinLeer > 0 && <span style={{ position: 'absolute', top: '-4px', right: '-2px', minWidth: '20px', height: '20px', borderRadius: '10px', background: '#d93025', color: '#fff', fontSize: '.7rem', fontWeight: '800', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px', border: '2px solid #fff' }}>{sinLeer}</span>}
          </button>
        </>
      )}

      {abierto && (
        <div ref={panelRef} style={panelStyle} role="dialog" aria-label="Chat con Golmebol">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderBottom: '1px solid #e8eaed', background: '#fff', flexShrink: 0 }}>
            <button onClick={() => (vistaActual === 'datos' ? setVista('temas') : cerrar())} aria-label={vistaActual === 'datos' ? 'Atrás' : 'Cerrar el chat'}
              style={{ display: 'flex', alignItems: 'center', gap: '2px', minHeight: '44px', padding: '0 10px 0 4px', background: 'none', border: 'none', cursor: 'pointer', color: '#1a73e8', fontSize: '.86rem', fontWeight: '700' }}>
              <ChevronLeft size={22} /> {vistaActual === 'datos' ? 'Atrás' : 'Cerrar'}
            </button>
            <AvatarAgente agente={agenteActual} size={40} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '.92rem', fontWeight: '800', color: '#202124', lineHeight: 1.2 }}>{agenteActual.nombre}</div>
              <div style={{ fontSize: '.7rem', color: '#80868b', lineHeight: 1.2 }}>{enTurno(ahora) ? 'Asistente de Golmebol' : 'Atención desde las 7:00 a. m.'}</div>
            </div>
          </div>

          {vistaActual === 'temas' && (
            <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '22px 16px', background: fondoCuerpo, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
              <AvatarAgente agente={agenteActual} size={68} />
              <div style={{ fontSize: '1.02rem', fontWeight: '800', textAlign: 'center' }}>¡Hola! Soy {agenteActual.nombre}</div>
              <div style={{ fontSize: '.86rem', color: '#5f6368', textAlign: 'center', lineHeight: 1.45, maxWidth: '320px' }}>¿En qué te podemos ayudar?</div>

              {idTorneo && (
                <div style={{ width: '100%', maxWidth: '340px', background: '#fff', border: '1px solid #cdeedb', borderRadius: '14px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ fontSize: '.84rem', fontWeight: '800' }}>Reglamento o queja de {torneo?.name ? `“${torneo.name}”` : 'este torneo'}</div>
                  <div style={{ fontSize: '.76rem', color: '#5f6368', lineHeight: 1.4 }}>Esos temas los resuelve el organizador del torneo. Escríbele directo por WhatsApp:</div>
                  {enlaceWa
                    ? <a href={enlaceWa} target="_blank" rel="noreferrer" style={{ minHeight: '48px', borderRadius: '24px', background: '#25d366', color: '#fff', fontWeight: '800', fontSize: '.9rem', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}><FaWhatsapp size={20} /> Escribir al organizador</a>
                    : <button onClick={() => elegirTema('torneo')} style={{ minHeight: '48px', borderRadius: '24px', border: 'none', background: '#1a73e8', color: '#fff', fontWeight: '800', fontSize: '.88rem', cursor: 'pointer' }}>Escribirle a Golmebol sobre este torneo</button>}
                </div>
              )}

              {['organizador', 'escenario', 'otro'].map(k => {
                const { titulo, sub, Icono } = TEMAS[k]
                return (
                  <button key={k} onClick={() => elegirTema(k)}
                    style={{ width: '100%', maxWidth: '340px', minHeight: '64px', background: '#fff', border: '1px solid #dadce0', borderRadius: '14px', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', textAlign: 'left', color: '#202124', fontFamily: 'inherit' }}>
                    <span style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#e8f0fe', color: '#1a73e8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icono size={20} /></span>
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: '.86rem', fontWeight: '800', lineHeight: 1.25 }}>{titulo}</span>
                      <span style={{ display: 'block', fontSize: '.72rem', color: '#80868b', marginTop: '2px' }}>{sub}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          )}

          {vistaActual === 'datos' && (
            <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '26px 18px', background: fondoCuerpo, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
              <AvatarAgente agente={agenteActual} size={68} />
              <div style={{ fontSize: '.9rem', color: '#5f6368', textAlign: 'center', lineHeight: 1.5, maxWidth: '310px' }}>Antes de empezar, ¿cómo te llamas? Así sabemos con quién hablamos.</div>
              <input value={nombre} onChange={e => setNombre(e.target.value)} maxLength={60} placeholder="Tu nombre" autoComplete="name" style={campo}
                onKeyDown={e => { if (e.key === 'Enter' && !cfg.contacto) seguirAlChat() }} />
              {cfg.contacto && (
                <>
                  <input value={contacto} onChange={e => setContacto(e.target.value)} maxLength={20} placeholder="Tu WhatsApp (opcional)" inputMode="tel" autoComplete="tel" style={campo}
                    onKeyDown={e => { if (e.key === 'Enter') seguirAlChat() }} />
                  <div style={{ fontSize: '.72rem', color: '#80868b', textAlign: 'center', maxWidth: '300px', lineHeight: 1.4 }}>Si lo dejas, también podemos escribirte por WhatsApp.</div>
                </>
              )}
              <button onClick={seguirAlChat} disabled={nombre.trim().length < 2} style={btnPrincipal(nombre.trim().length >= 2)}>Continuar</button>
            </div>
          )}

          {vistaActual === 'chat' && (
            <>
              <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', overscrollBehaviorY: 'contain', padding: '14px 12px', background: fondoCuerpo, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ alignSelf: 'flex-start', maxWidth: '92%', display: 'flex', alignItems: 'flex-end', gap: '6px' }}>
                  <AvatarAgente agente={agenteActual} size={28} />
                  <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '14px 14px 14px 4px', padding: '9px 12px', fontSize: '.86rem', lineHeight: 1.45 }}>
                    <div style={{ fontSize: '.66rem', fontWeight: '800', color: '#6c35de', marginBottom: '2px' }}>{agenteActual.nombre}</div>
                    {(nombre ? `¡Hola, ${nombre.split(' ')[0]}! ` : '') + cfg.saludo}
                  </div>
                </div>
                {tema === 'torneo' && enlaceWa && (
                  <a href={enlaceWa} target="_blank" rel="noreferrer" style={{ alignSelf: 'center', minHeight: '44px', padding: '0 18px', borderRadius: '22px', background: '#25d366', color: '#fff', fontWeight: '800', fontSize: '.84rem', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}><FaWhatsapp size={18} /> Escribir al organizador</a>
                )}
                <div style={{ alignSelf: 'center', fontSize: '.66rem', color: '#9aa0a6', textAlign: 'center' }}>Los mensajes de este chat se borran solos a los 8 días.</div>
                {!enTurno(ahora) && (
                  <div style={{ alignSelf: 'center', maxWidth: '92%', display: 'flex', gap: '8px', alignItems: 'flex-start', background: '#fff7e0', border: '1px solid #f3e2a8', borderRadius: '12px', padding: '9px 12px', fontSize: '.78rem', color: '#7a5b00', lineHeight: 1.45 }}>
                    <Moon size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                    <span>Ahora estamos fuera de horario y quizá no podamos responderte enseguida. Déjanos tu mensaje y te respondemos apenas podamos; vuelve a abrir este chat para ver la respuesta.</span>
                  </div>
                )}
                {mensajes.map((m, i) => {
                  const mio = m.de === 'usuario'
                  const nuevoDia = i === 0 || new Date(m.created_at).toDateString() !== new Date(mensajes[i - 1].created_at).toDateString()
                  return (
                    <div key={m.id} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {nuevoDia && <div style={{ alignSelf: 'center', fontSize: '.68rem', color: '#80868b', background: '#e8eaed', borderRadius: '999px', padding: '2px 10px' }}>{diaTexto(m.created_at)}</div>}
                      <div style={{ alignSelf: mio ? 'flex-end' : 'flex-start', maxWidth: mio ? '86%' : '92%', display: 'flex', alignItems: 'flex-end', gap: '6px' }}>
                        {!mio && (m.automatico ? <AvatarAsistente size={28} /> : <AvatarAgente agente={agenteDe(m.created_at)} size={28} />)}
                        <div style={{ background: mio ? '#1a73e8' : '#fff', color: mio ? '#fff' : '#202124', border: mio ? 'none' : '1px solid #e8eaed', borderRadius: mio ? '14px 14px 4px 14px' : '14px 14px 14px 4px', padding: '9px 12px', fontSize: '.86rem', lineHeight: 1.45, opacity: m.local ? .7 : 1, wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
                          {!mio && <div style={{ fontSize: '.66rem', fontWeight: '800', color: m.automatico ? '#0f9d8a' : '#6c35de', marginBottom: '2px' }}>{m.automatico ? 'Asistente automático de Golmebol' : agenteDe(m.created_at).nombre}</div>}
                          {(m.previa || m.adjunto_url || m.tiene_adjunto) && <div style={{ margin: '2px 0 6px' }}><Adjunto m={m} alAbrir={setVisor} /></div>}
                          {m.texto ? <TextoConEnlaces texto={m.texto} /> : null}
                          <div style={{ fontSize: '.62rem', marginTop: '3px', textAlign: 'right', color: mio ? 'rgba(255,255,255,.75)' : '#9aa0a6' }}>
                            {m.fallo ? 'No se envió' : m.local ? 'Enviando…' : hora(m.created_at)}
                          </div>
                        </div>
                      </div>
                      {m.fallo && <button onClick={() => enviar(m)} style={{ alignSelf: 'flex-end', minHeight: '36px', background: 'none', border: 'none', color: '#d93025', fontSize: '.76rem', fontWeight: '700', cursor: 'pointer' }}>Reintentar</button>}
                      {m.automatico && i === mensajes.length - 1 && (
                        <button onClick={() => enviar({ texto: 'Quiero hablar con una persona' })} disabled={enviando}
                          style={{ alignSelf: 'flex-start', marginLeft: '34px', minHeight: '40px', padding: '0 16px', borderRadius: '20px', border: '1px solid #1a73e8', background: '#fff', color: '#1a73e8', fontSize: '.8rem', fontWeight: '800', cursor: 'pointer' }}>
                          Hablar con una persona
                        </button>
                      )}
                    </div>
                  )
                })}
                <div ref={fin} />
              </div>

              {aviso && <div style={{ padding: '8px 12px', background: '#fef3c7', color: '#7a5b00', fontSize: '.74rem', lineHeight: 1.4, flexShrink: 0 }}>{aviso}</div>}

              {archivo && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', background: '#f6f7f9', borderTop: '1px solid #e8eaed', flexShrink: 0 }}>
                  {archivo.type.startsWith('audio/')
                    ? <div style={{ width: '52px', height: '52px', borderRadius: '8px', background: '#e8f0fe', color: '#1a73e8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Mic size={24} /></div>
                    : <img src={previa} alt="" style={{ width: '52px', height: '52px', objectFit: 'cover', borderRadius: '8px', flexShrink: 0 }} />}
                  <div style={{ flex: 1, minWidth: 0, fontSize: '.8rem', color: '#202124', fontWeight: '700', lineHeight: 1.3 }}>
                    {archivo.type.startsWith('audio/') ? 'Audio listo para enviar' : 'Foto lista para enviar'}
                    <div style={{ fontWeight: '400', color: '#80868b', fontSize: '.72rem' }}>Puedes escribir un mensaje y tocar enviar</div>
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
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '.92rem', fontWeight: '700', color: '#202124' }}>
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
                <input value={trampa} onChange={e => setTrampa(e.target.value)} name="web" tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px', opacity: 0 }} />
                <input ref={inputArchivo} type="file" accept="image/*,audio/*" onChange={elegirArchivo} style={{ display: 'none' }} />
                <button onClick={() => inputArchivo.current?.click()} disabled={enviando} aria-label="Enviar una foto o un audio"
                  style={{ width: '44px', height: '44px', borderRadius: '50%', border: '1px solid #dadce0', background: '#fff', color: '#5f6368', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Paperclip size={20} />
                </button>
                <textarea value={texto} onChange={e => setTexto(e.target.value)} rows={1} maxLength={600} placeholder={archivo ? 'Añade un mensaje (opcional)…' : 'Escribe tu mensaje…'}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !isMobile) { e.preventDefault(); enviar() } }}
                  style={{ flex: 1, resize: 'none', maxHeight: '110px', minHeight: '44px', border: '1px solid #dadce0', borderRadius: '22px', padding: '11px 14px', fontSize: '16px', fontFamily: 'inherit', outline: 'none', lineHeight: 1.3, boxSizing: 'border-box', color: '#202124', background: '#fff' }}
                  onInput={e => { e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 110) + 'px' }} />
                {(texto.trim() || archivo || !puedeGrabar())
                  ? <button onClick={() => enviar()} disabled={(!texto.trim() && !archivo) || enviando} aria-label="Enviar mensaje"
                      style={{ width: '44px', height: '44px', borderRadius: '50%', border: 'none', background: (texto.trim() || archivo) ? '#1a73e8' : '#dadce0', color: '#fff', cursor: (texto.trim() || archivo) ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Send size={19} />
                    </button>
                  : <button onClick={empezarGrabacion} disabled={enviando} aria-label="Grabar un audio"
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

export default function ChatPublico() {
  const { pathname } = useLocation()
  if (!hostPropio() || !RUTAS.test(pathname)) return null
  return <ChatInterno />
}
