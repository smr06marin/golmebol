// Asistente de 4 pasos para montar una transmisión en vivo sin saber nada de técnica.
// Paso 1: desde dónde transmite (celular con Prism Live Studio o computador con OBS).
// Paso 2: escoge la plataforma (YouTube, Facebook, Instagram, TikTok — una o varias a la vez), prepara la app y pega el link.
// Paso 3: cómo entra el marcador (árbitro con su link = automático, o desde otro celular).
// Paso 4: listo — links para copiar y los pasos exactos de su programa (Prism u OBS).
// No guarda nada por su cuenta: al terminar el paso 3 le pide a la pantalla EN VIVO que cree la transmisión
// (onCrear) y recibe de vuelta la transmisión creada para mostrar sus links.
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, Copy, Share2, Smartphone, Monitor, Radio } from 'lucide-react'

const AZUL = '#1a73e8'
const NOMBRES_PASO = ['Dónde transmites', 'Plataforma y link', 'Marcador', '¡Listo!']

// Plataformas donde se puede transmitir. `clave: true` = no se conecta con un botón de inicio de sesión sino con la clave de transmisión (RTMP) que da la plataforma.
const PLATAFORMAS = [
  { id: 'youtube', nombre: 'YouTube', clave: false },
  { id: 'facebook', nombre: 'Facebook', clave: false },
  { id: 'instagram', nombre: 'Instagram', clave: true },
  { id: 'tiktok', nombre: 'TikTok', clave: true },
]
const PLACEHOLDER_LINK = { youtube: 'https://www.youtube.com/@tucanal', facebook: 'https://www.facebook.com/tupagina/videos/…', instagram: 'https://www.instagram.com/tuperfil/live', tiktok: 'https://www.tiktok.com/@tuperfil/live' }

const inp = { width: '100%', background: '#fff', border: '1px solid #dadce0', borderRadius: '10px', padding: '12px 14px', color: '#202124', fontSize: '1rem', outline: 'none', boxSizing: 'border-box', minHeight: '46px' }
const lbl = { fontSize: '.8rem', fontWeight: '700', color: '#3c4043', display: 'block', marginBottom: '6px' }
const btnPrim = (off) => ({ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', minHeight: '48px', padding: '0 22px', borderRadius: '10px', border: 'none', background: off ? '#bdc1c6' : AZUL, color: '#fff', fontSize: '.95rem', fontWeight: '700', cursor: off ? 'not-allowed' : 'pointer' })
const btnSec = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', minHeight: '48px', padding: '0 18px', borderRadius: '10px', border: '1px solid #dadce0', background: '#fff', color: '#3c4043', fontSize: '.95rem', fontWeight: '600', cursor: 'pointer' }

function Pasos({ items, desde = 1 }) {
  return (
    <ol style={{ listStyle: 'none', margin: '0 0 6px', padding: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {items.map((t, i) => (
        <li key={i} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
          <span style={{ flexShrink: 0, width: '26px', height: '26px', borderRadius: '50%', background: '#e8f0fe', color: AZUL, fontWeight: '800', fontSize: '.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '1px' }}>{i + desde}</span>
          <span style={{ fontSize: '.92rem', color: '#202124', lineHeight: 1.5 }}>{t}</span>
        </li>
      ))}
    </ol>
  )
}

function Aviso({ children, color = '#e8f0fe', texto = '#174ea6' }) {
  return <div style={{ background: color, color: texto, borderRadius: '10px', padding: '11px 13px', fontSize: '.84rem', lineHeight: 1.5, margin: '12px 0' }}>{children}</div>
}

function OpcionGrande({ activa, onClick, icono, titulo, texto, etiqueta }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={activa}
      style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', width: '100%', textAlign: 'left', padding: '16px', borderRadius: '12px', cursor: 'pointer', background: activa ? '#e8f0fe' : '#fff', border: activa ? `2px solid ${AZUL}` : '1px solid #dadce0', minHeight: '72px' }}>
      <span style={{ flexShrink: 0, width: '44px', height: '44px', borderRadius: '12px', background: activa ? AZUL : '#f1f3f4', color: activa ? '#fff' : '#5f6368', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icono}</span>
      <span style={{ flex: 1 }}>
        <span style={{ display: 'block', fontSize: '1rem', fontWeight: '800', color: '#202124' }}>{titulo}{etiqueta && <span style={{ marginLeft: '8px', fontSize: '.68rem', fontWeight: '800', color: '#137333', background: '#e6f4ea', padding: '2px 8px', borderRadius: '999px', verticalAlign: 'middle' }}>{etiqueta}</span>}</span>
        <span style={{ display: 'block', fontSize: '.84rem', color: '#5f6368', marginTop: '3px', lineHeight: 1.45 }}>{texto}</span>
      </span>
      {activa && <Check size={20} color={AZUL} style={{ flexShrink: 0, marginTop: '2px' }}/>}
    </button>
  )
}

function CampoLink({ valor, copiado, onCopiar, claveCopia }) {
  return (
    <div style={{ display: 'flex', gap: '8px', margin: '6px 0 4px' }}>
      <input readOnly value={valor} onFocus={e => e.target.select()} aria-label="Link"
        style={{ flex: 1, minWidth: 0, background: '#f8f9fa', border: '1px solid #dadce0', borderRadius: '10px', padding: '0 12px', color: '#3c4043', fontSize: '.78rem', minHeight: '46px', boxSizing: 'border-box' }}/>
      <button type="button" onClick={() => onCopiar(valor, claveCopia)}
        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', minHeight: '46px', padding: '0 14px', borderRadius: '10px', border: 'none', background: copiado === claveCopia ? '#1e8e3e' : '#202124', color: '#fff', fontSize: '.85rem', fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap' }}>
        {copiado === claveCopia ? <><Check size={15}/> Copiado</> : <><Copy size={15}/> Copiar</>}
      </button>
    </div>
  )
}

export default function AsistenteEnVivo({ torneos = [], canchasPorTorneo = {}, cargarCanchas, onCrear, onCerrar }) {
  const navigate = useNavigate()
  const [paso, setPaso] = useState(1)
  const [metodo, setMetodo] = useState(null) // 'prism' | 'obs'
  const [url, setUrl] = useState('')
  const [plataformas, setPlataformas] = useState(['youtube']) // una o varias a la vez
  const [titulo, setTitulo] = useState('')
  const [modo, setModo] = useState('arbitro') // 'arbitro' | 'control'
  const [torneoId, setTorneoId] = useState(torneos[0]?.id || '')
  const [canchaId, setCanchaId] = useState('')
  const [creando, setCreando] = useState(false)
  const [error, setError] = useState('')
  const [stream, setStream] = useState(null)
  const [copiado, setCopiado] = useState(null)

  const urlLimpia = url.trim()
  const urlValida = !urlLimpia || /^https?:\/\/\S+$/i.test(urlLimpia)
  const plataforma = /youtu/i.test(urlLimpia) ? 'YouTube' : /facebook|fb\.watch/i.test(urlLimpia) ? 'Facebook' : /instagram/i.test(urlLimpia) ? 'Instagram' : /tiktok/i.test(urlLimpia) ? 'TikTok' : ''
  const elegidas = PLATAFORMAS.filter(p => plataformas.includes(p.id))
  const varias = elegidas.length > 1
  const destinos = elegidas.map(p => p.nombre).join(' y ')
  const primera = elegidas[0] || PLATAFORMAS[0]
  const usaClave = elegidas.some(p => p.clave)
  const sinYoutube = !plataformas.includes('youtube')
  const alternarPlataforma = id => setPlataformas(prev => (prev.includes(id) ? (prev.length > 1 ? prev.filter(x => x !== id) : prev) : [...prev, id]))
  const canchas = canchasPorTorneo[torneoId] || []
  const nombreTorneo = torneos.find(t => t.id === torneoId)?.name || ''
  const origen = typeof window !== 'undefined' ? window.location.origin : 'https://golmebol.com'
  const linkGraficos = stream ? `${origen}/overlay/${stream.id}` : ''
  const linkControl = stream?.control_token ? `${origen}/en-vivo-control/${stream.control_token}` : ''

  function copiar(texto, clave) {
    const ok = () => { setCopiado(clave); setTimeout(() => setCopiado(c => (c === clave ? null : c)), 2000) }
    try {
      if (navigator.clipboard?.writeText) { navigator.clipboard.writeText(texto).then(ok, ok); return }
    } catch { /* sin portapapeles: el campo queda seleccionable para copiar a mano */ }
    ok()
  }

  function elegirTorneo(id) {
    setTorneoId(id)
    setCanchaId('')
    if (id && !canchasPorTorneo[id] && cargarCanchas) cargarCanchas(id)
  }

  async function crear() {
    setError('')
    setCreando(true)
    try {
      const res = await onCrear({
        url: urlLimpia,
        titulo: titulo.trim(),
        torneo_auto: torneoId || null,
        cancha_auto: torneoId && canchaId ? canchaId : null,
      })
      if (!res?.ok) { setError(res?.error || 'No pudimos crear la transmisión. Revisa tu internet e inténtalo de nuevo.'); return }
      setStream(res.stream)
      setPaso(4)
    } catch (e) {
      setError(e?.message || 'No pudimos crear la transmisión. Inténtalo de nuevo.')
    } finally {
      setCreando(false)
    }
  }

  const atras = () => { setError(''); if (paso === 1) onCerrar?.(); else setPaso(paso - 1) }
  const puedeSeguir = (paso === 1 && !!metodo) || (paso === 2 && urlValida) || paso === 3

  const programa = metodo === 'prism' ? 'Prism Live Studio' : 'OBS Studio'

  return (
    <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '14px', padding: '18px 16px 20px', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
      {/* Encabezado: botón atrás siempre visible + progreso */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginBottom: '14px' }}>
        {paso < 4 ? (
          <button type="button" onClick={atras} style={{ ...btnSec, minHeight: '42px', padding: '0 14px' }}>
            <ArrowLeft size={16}/> {paso === 1 ? 'Cancelar' : 'Atrás'}
          </button>
        ) : (
          <button type="button" onClick={onCerrar} style={{ ...btnSec, minHeight: '42px', padding: '0 14px' }}>
            <ArrowLeft size={16}/> Volver al panel
          </button>
        )}
        <span style={{ fontSize: '.78rem', fontWeight: '800', color: '#5f6368', letterSpacing: '.03em' }}>PASO {paso} DE 4</span>
      </div>
      <div style={{ display: 'flex', gap: '6px', marginBottom: '6px' }} aria-hidden="true">
        {NOMBRES_PASO.map((_, i) => <span key={i} style={{ flex: 1, height: '5px', borderRadius: '999px', background: i < paso ? AZUL : '#e8eaed' }}/>)}
      </div>
      <div style={{ fontSize: '.74rem', color: '#80868b', marginBottom: '16px' }}>{NOMBRES_PASO[paso - 1]}</div>

      {/* PASO 1 */}
      {paso === 1 && (
        <div>
          <h2 style={{ margin: '0 0 4px', fontSize: '1.2rem', color: '#202124' }}>¿Desde dónde vas a transmitir?</h2>
          <p style={{ margin: '0 0 16px', fontSize: '.88rem', color: '#5f6368' }}>Escoge una opción y te explico cada paso. Las dos son gratis.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <OpcionGrande activa={metodo === 'prism'} onClick={() => setMetodo('prism')} icono={<Smartphone size={22}/>}
              titulo="Desde mi celular" texto="Con la app Prism Live Studio. Lo más fácil: no necesitas computador."/>
            <OpcionGrande activa={metodo === 'obs'} onClick={() => setMetodo('obs')} icono={<Monitor size={22}/>}
              titulo="Desde mi computador" texto="Con el programa OBS Studio. Para cámaras o mejor calidad."/>
          </div>
        </div>
      )}

      {/* PASO 2 */}
      {paso === 2 && (
        <div>
          <h2 style={{ margin: '0 0 4px', fontSize: '1.2rem', color: '#202124' }}>Prepara tu transmisión</h2>
          <p style={{ margin: '0 0 14px', fontSize: '.88rem', color: '#5f6368' }}>Esto se hace una sola vez. Vas por {programa}.</p>

          <div style={{ fontSize: '.8rem', fontWeight: '800', color: '#3c4043', margin: '0 0 8px' }}>¿DÓNDE VAS A TRANSMITIR?</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
            {PLATAFORMAS.map(p => {
              const on = plataformas.includes(p.id)
              return (
                <button key={p.id} type="button" onClick={() => alternarPlataforma(p.id)} aria-pressed={on}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', minHeight: '52px', padding: '0 14px', borderRadius: '12px', cursor: 'pointer', fontSize: '.95rem', fontWeight: '800', color: '#202124', background: on ? '#e8f0fe' : '#fff', border: on ? `2px solid ${AZUL}` : '1px solid #dadce0' }}>
                  {p.nombre}{on && <Check size={18} color={AZUL}/>}
                </button>
              )
            })}
          </div>
          <div style={{ fontSize: '.78rem', color: '#5f6368', marginTop: '6px', lineHeight: 1.45 }}>Toca una o varias. Si escoges dos o más, transmites a todas al mismo tiempo.</div>

          <div style={{ fontSize: '.8rem', fontWeight: '800', color: '#3c4043', margin: '18px 0 8px' }}>PRIMERO, TU APP</div>
          {metodo === 'prism' ? (
            <Pasos items={[
              <>Instala <b>Prism Live Studio</b> desde la Play Store o la App Store.</>,
              ...elegidas.map(p => (p.clave
                ? <>Para <b>{p.nombre}</b>: elige <b>«Custom RTMP»</b> y pega la <b>dirección y la clave de transmisión</b> que te da {p.nombre}.</>
                : <>Para <b>{p.nombre}</b>: elige <b>{p.nombre}</b> e inicia sesión con tu cuenta.</>)),
            ]}/>
          ) : (
            <Pasos items={[
              <>Instala <b>OBS Studio</b> desde <b>obsproject.com</b> (gratis).</>,
              ...elegidas.map(p => (p.clave
                ? <>Para <b>{p.nombre}</b>: entra a <b>Ajustes → Emisión</b>, en «Servicio» elige <b>«Personalizado…»</b> y pega el <b>Servidor</b> y la <b>Clave de retransmisión</b> que te da {p.nombre}.</>
                : <>Para <b>{p.nombre}</b>: entra a <b>Ajustes → Emisión</b>, en «Servicio» elige <b>{p.id === 'facebook' ? 'Facebook Live' : p.nombre}</b> y toca <b>«Conectar cuenta»</b>.</>)),
            ]}/>
          )}
          {plataformas.includes('youtube') && (
            <Aviso color="#fef7e0" texto="#8a5a00">
              ⏳ <b>YouTube:</b> la primera vez, YouTube puede tardar hasta 24 horas en activar las transmisiones en vivo de tu canal. Hazlo hoy, no el día del partido.
            </Aviso>
          )}
          {plataformas.includes('instagram') && (
            <Aviso color="#fef7e0" texto="#8a5a00">
              ⚠️ <b>Instagram:</b> la clave de transmisión se saca desde un <b>computador</b>, en instagram.com/live. Según las reglas actuales de Instagram pide una cuenta <b>profesional</b> (Creador o Empresa) y 1.000 seguidores. Confírmalo en tu cuenta antes del día del partido.
            </Aviso>
          )}
          {plataformas.includes('tiktok') && (
            <Aviso color="#fef7e0" texto="#8a5a00">
              ⚠️ <b>TikTok:</b> para transmitir con clave, TikTok pide según sus reglas actuales mínimo 1.000 seguidores y activar el acceso desde TikTok LIVE Studio en el computador. Confírmalo en tu cuenta antes del día del partido.
            </Aviso>
          )}
          {usaClave && (
            <Aviso>
              📱 Instagram y TikTok están pensados para video <b>vertical</b>; el marcador de Golmebol está hecho para video <b>horizontal</b>. Haz una prueba antes del partido para ver cómo se ve.
            </Aviso>
          )}
          {varias && (
            <Aviso color="#e6f4ea" texto="#137333">
              🔀 <b>Varias plataformas a la vez:</b>{' '}
              {metodo === 'prism'
                ? <>en Prism se llama «multi-transmisión» y necesita la suscripción <b>PRISM Plus</b> (hasta 6 canales). Conecta cada cuenta, activa el interruptor de cada una y toca <b>Go Live</b>.</>
                : <>OBS solo envía a un destino por defecto. Para varios a la vez instala el plugin gratuito <b>«Multiple RTMP outputs»</b> o usa un servicio como <b>Restream</b> (revisa sus planes).</>}
            </Aviso>
          )}

          <div style={{ fontSize: '.8rem', fontWeight: '800', color: '#3c4043', margin: '18px 0 8px' }}>AHORA, EL LINK PARA GOLMEBOL.COM</div>
          <Pasos items={[
            <>Abre tu cuenta de <b>{primera.nombre}</b> y toca <b>Compartir</b>.</>,
            <>Toca <b>Copiar link</b> y pégalo aquí abajo.</>,
          ]}/>
          {varias && <div style={{ fontSize: '.8rem', color: '#5f6368', marginTop: '8px', lineHeight: 1.45 }}>Pega el link de <b>una sola</b> plataforma: la que quieras que se vea dentro de golmebol.com.</div>}
          <label htmlFor="av-url" style={{ ...lbl, marginTop: '12px' }}>Link de {plataforma || primera.nombre}</label>
          <input id="av-url" value={url} onChange={e => setUrl(e.target.value)} style={inp} inputMode="url" autoCapitalize="none" autoCorrect="off"
            placeholder={PLACEHOLDER_LINK[primera.id]}/>
          {urlLimpia && !urlValida && <div style={{ color: '#d93025', fontSize: '.8rem', marginTop: '6px' }}>El link debe empezar con https://. Cópialo de nuevo desde la plataforma.</div>}
          {urlLimpia && urlValida && plataforma && <div style={{ color: '#1e8e3e', fontSize: '.8rem', fontWeight: '700', marginTop: '6px' }}>✓ Detectado: {plataforma}</div>}
          <div style={{ fontSize: '.78rem', color: '#5f6368', marginTop: '6px', lineHeight: 1.45 }}>
            {(plataforma === 'TikTok' || (!plataforma && primera.id === 'tiktok'))
              ? <>En golmebol.com saldrá un botón <b>«Ver en vivo»</b> que abre TikTok (TikTok no deja mostrar el video dentro de otra página).</>
              : (plataforma === 'Facebook' || plataforma === 'Instagram' || (!plataforma && (primera.id === 'facebook' || primera.id === 'instagram')))
                ? <>En Facebook e Instagram pega el link del video <b>en vivo ya iniciado</b>; cambia en cada transmisión (se actualiza desde tu panel).</>
                : <>Con el link del canal de YouTube no tienes que cambiarlo en cada partido: la transmisión aparece sola en golmebol.com cuando empiezas el en vivo.</>}
            {' '}¿Aún no lo tienes? Puedes dejarlo vacío y pegarlo después.
          </div>

          <label htmlFor="av-titulo" style={{ ...lbl, marginTop: '16px' }}>Nombre de la transmisión (opcional)</label>
          <input id="av-titulo" value={titulo} onChange={e => setTitulo(e.target.value)} style={inp} maxLength={80} placeholder="Ej: Cancha 1 · Final del torneo"/>
        </div>
      )}

      {/* PASO 3 */}
      {paso === 3 && (
        <div>
          <h2 style={{ margin: '0 0 4px', fontSize: '1.2rem', color: '#202124' }}>¿Cómo entra el marcador?</h2>
          <p style={{ margin: '0 0 14px', fontSize: '.88rem', color: '#5f6368' }}>El marcador sale encima del video, con los goles y el tiempo del partido.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <OpcionGrande activa={modo === 'arbitro'} onClick={() => setModo('arbitro')} icono={<Radio size={22}/>} etiqueta="RECOMENDADO"
              titulo="Con el link del árbitro" texto="El árbitro abre su planilla y el marcador sale solo. Si quieres, desde otro celular puedes ajustar los goles en el video."/>
            <OpcionGrande activa={modo === 'control'} onClick={() => setModo('control')} icono={<Smartphone size={22}/>}
              titulo="Lo manejo yo desde otro celular" texto="Para cuando no hay árbitro con link: desde un segundo celular escoges el partido programado, sumas los goles y manejas repeticiones, tabla y publicidad."/>
          </div>

          <div style={{ marginTop: '18px' }}>
            {torneos.length > 0 ? (
              <>
                <label htmlFor="av-torneo" style={lbl}>¿De qué torneo es?</label>
                <select id="av-torneo" value={torneoId} onChange={e => elegirTorneo(e.target.value)} style={inp}>
                  {torneos.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                {canchas.length > 0 && (
                  <>
                    <label htmlFor="av-cancha" style={{ ...lbl, marginTop: '12px' }}>¿Qué cancha enfoca tu cámara? (opcional)</label>
                    <select id="av-cancha" value={canchaId} onChange={e => setCanchaId(e.target.value)} style={inp}>
                      <option value="">Todas las canchas</option>
                      {canchas.map(c => <option key={c.id} value={c.id}>{c.escenario ? `${c.escenario} — ` : ''}{c.nombre}</option>)}
                    </select>
                    <div style={{ fontSize: '.76rem', color: '#5f6368', marginTop: '5px' }}>Elígela solo si se juegan dos partidos a la vez, para que no se confundan.</div>
                  </>
                )}
              </>
            ) : (
              <Aviso color="#fef7e0" texto="#8a5a00">Todavía no tienes torneos. Puedes crear la transmisión solo con el video y, cuando tengas un torneo, volver a esta pantalla para conectar el marcador.</Aviso>
            )}
          </div>

          <div style={{ fontSize: '.8rem', fontWeight: '800', color: '#3c4043', margin: '20px 0 8px' }}>{modo === 'arbitro' ? 'CÓMO LE DAS EL LINK AL ÁRBITRO' : 'CÓMO LO HARÁS'}</div>
          {modo === 'arbitro' ? (
            <>
              <Pasos items={[
                <>Entra a tu torneo y abre <b>Calendario</b>.</>,
                <>Toca el partido y elige <b>«Link árbitro»</b>.</>,
                <>Mándaselo por WhatsApp. El link dura 24 horas.</>,
              ]}/>
              <Aviso>Apenas el árbitro empiece la planilla, el marcador aparece solo en tu transmisión.</Aviso>
            </>
          ) : (
            <>
              <Pasos items={[
                <>Al terminar este asistente te doy un <b>link de control</b>.</>,
                <>Ábrelo en el otro celular (cópialo o envíalo por WhatsApp).</>,
                <>En <b>«Marcador de la transmisión»</b> escoge el partido programado que vas a transmitir y suma los goles con <b>+ GOL</b>. Los goles solo se ven en el video, no cambian nada del torneo.</>,
                <>Si el árbitro empieza la planilla de ese partido, el marcador real sale solo.</>,
              ]}/>
            </>
          )}
          {error && <div role="alert" style={{ background: '#fce8e6', color: '#d93025', borderRadius: '10px', padding: '11px 13px', fontSize: '.85rem', marginTop: '12px' }}>{error}</div>}
        </div>
      )}

      {/* PASO 4 */}
      {paso === 4 && stream && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
            <span style={{ width: '44px', height: '44px', borderRadius: '50%', background: '#e6f4ea', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Check size={24} color="#1e8e3e"/></span>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.2rem', color: '#202124' }}>¡Tu transmisión está creada!</h2>
              <div style={{ fontSize: '.82rem', color: '#5f6368' }}>{nombreTorneo ? `${nombreTorneo} · ` : ''}{modo === 'arbitro' ? 'Marcador con el árbitro' : 'Marcador desde otro celular'}</div>
            </div>
          </div>

          <div style={{ fontSize: '.8rem', fontWeight: '800', color: '#3c4043', margin: '20px 0 6px' }}>ÚLTIMO PASO EN {programa.toUpperCase()}</div>
          <Pasos items={[<>Copia este <b>link de gráficos</b>:</>]}/>
          <CampoLink valor={linkGraficos} copiado={copiado} onCopiar={copiar} claveCopia="graficos"/>
          {metodo === 'prism' ? (
            <div style={{ marginTop: '8px' }}>
              <Pasos desde={2} items={[
                <>En Prism, desliza hacia la derecha y toca <b>«Widget»</b> → <b>«Web»</b>.</>,
                <>Pega el link en <b>«URL»</b>, activa <b>«Lock layer»</b> y guarda.</>,
                <>Toca el botón para <b>empezar a transmitir</b> en {destinos}.</>,
              ]}/>
            </div>
          ) : (
            <div style={{ marginTop: '8px' }}>
              <Pasos desde={2} items={[
                <>En OBS: <b>Fuentes → «+» → «Navegador»</b>. Pega el link, pon ancho <b>1920</b> y alto <b>1080</b>.</>,
                <>Agrega tu cámara: <b>Fuentes → «+» → «Dispositivo de captura de vídeo»</b> y déjala <b>debajo</b> del navegador.</>,
                <>Toca <b>«Iniciar transmisión»</b>.</>,
              ]}/>
            </div>
          )}
          <Aviso color="#fef7e0" texto="#8a5a00">Los nombres de los botones pueden cambiar un poco según la versión del programa.</Aviso>
          {sinYoutube && <Aviso>El marcador, la tabla y la publicidad salen dentro del video en cualquier plataforma. Solo la <b>Repetición dentro del video</b> funciona únicamente con YouTube.</Aviso>}

          {modo === 'arbitro' ? (
            <div style={{ border: '1px solid #e8eaed', borderRadius: '12px', padding: '14px', marginTop: '14px' }}>
              <div style={{ fontWeight: '800', fontSize: '.95rem', color: '#202124', marginBottom: '4px' }}>Link del árbitro</div>
              <div style={{ fontSize: '.84rem', color: '#5f6368', marginBottom: '10px', lineHeight: 1.45 }}>Se saca del Calendario de tu torneo, partido por partido. Mándaselo al árbitro antes de empezar.</div>
              {torneoId && (
                <button type="button" onClick={() => navigate(`/admin/torneos/${torneoId}?tab=calendario`)} style={btnPrim(false)}>
                  Ir al Calendario <ArrowRight size={16}/>
                </button>
              )}
            </div>
          ) : (
            <div style={{ border: '1px solid #e8eaed', borderRadius: '12px', padding: '14px', marginTop: '14px' }}>
              <div style={{ fontWeight: '800', fontSize: '.95rem', color: '#202124', marginBottom: '4px' }}>Link de control para el otro celular</div>
              <div style={{ fontSize: '.84rem', color: '#5f6368', lineHeight: 1.45 }}>Ábrelo en el segundo celular: desde ahí escoges el partido, sumas los goles (solo se ven en el video) y lanzas repeticiones, la tabla y la publicidad. Quien tenga el link puede manejar esta transmisión.</div>
              <CampoLink valor={linkControl} copiado={copiado} onCopiar={copiar} claveCopia="control"/>
              <a href={`https://wa.me/?text=${encodeURIComponent(`Control de la transmisión en vivo: ${linkControl}`)}`} target="_blank" rel="noreferrer"
                style={{ ...btnSec, textDecoration: 'none', marginTop: '8px', width: '100%', boxSizing: 'border-box' }}>
                <Share2 size={16}/> Enviar por WhatsApp
              </a>
            </div>
          )}

          {modo === 'arbitro' && linkControl && (
            <details style={{ marginTop: '12px' }}>
              <summary style={{ cursor: 'pointer', fontSize: '.86rem', fontWeight: '700', color: AZUL, padding: '8px 0' }}>Link de control desde otro celular (opcional)</summary>
              <div style={{ fontSize: '.82rem', color: '#5f6368', lineHeight: 1.45 }}>Sirve para ajustar los goles solo en el video (no cambian el torneo) y lanzar repeticiones, tabla y publicidad desde un segundo celular.</div>
              <CampoLink valor={linkControl} copiado={copiado} onCopiar={copiar} claveCopia="control"/>
            </details>
          )}

          <Aviso color="#e6f4ea" texto="#137333">
            ✅ <b>Cuando empieces tu en vivo</b>, la transmisión aparece sola en golmebol.com y aquí abajo, en tu panel de control.
          </Aviso>
          <div style={{ marginTop: '14px' }}>
            <button type="button" onClick={onCerrar} style={{ ...btnPrim(false), width: '100%' }}>Terminar</button>
          </div>
        </div>
      )}

      {/* Botón principal de los pasos 1 a 3 */}
      {paso < 4 && (
        <div style={{ marginTop: '22px' }}>
          {paso < 3 ? (
            <button type="button" disabled={!puedeSeguir} onClick={() => { setError(''); setPaso(paso + 1) }} style={{ ...btnPrim(!puedeSeguir), width: '100%' }}>
              Siguiente <ArrowRight size={17}/>
            </button>
          ) : (
            <button type="button" disabled={creando} onClick={crear} style={{ ...btnPrim(creando), width: '100%' }}>
              {creando ? 'Creando…' : <>Crear mi transmisión <ArrowRight size={17}/></>}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
