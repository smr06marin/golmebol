import { useState, useEffect } from 'react'
import { Bell, BellRing, X, Star, Check, Send } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useFavoritos } from '../lib/favoritos'
import { useAvisos, plataformaAvisos, activarAvisosDeTorneo, probarAvisos } from '../lib/avisos'
import { mensajeMotivo } from '../lib/avisosTextos'

// Botón "AVISOS" + hoja para activar las notificaciones, ver los equipos que sigue y elegir torneos.
// Funciona en la app (Android / iPhone), en el navegador y en la app instalada. En iPhone, Apple solo deja
// recibir avisos si Golmebol está instalada en la pantalla de inicio: ahí la hoja explica cómo.
// BotonAvisosTorneo: botón "Activar avisos de este torneo" para la página pública de cada torneo.
const C = { card: '#161616', card2: '#1c1c1c', border: '#2a2a2a', green: '#6fcf3d', text: '#fff', text2: '#c9c9c9', muted: '#8a8a8a', red: '#e5433d' }

const abrirGuiaInstalar = () => { try { window.dispatchEvent(new Event('gm-abrir-instalar')) } catch { /* nada */ } }

function Interruptor({ activo, onClick, deshabilitado, nombre }) {
  return (
    <button type="button" role="switch" aria-checked={!!activo} aria-label={nombre} disabled={deshabilitado} onClick={onClick}
      style={{ width: 50, height: 30, borderRadius: 999, border: 'none', padding: 3, flexShrink: 0, cursor: deshabilitado ? 'default' : 'pointer',
        background: activo ? C.green : '#3a3a3a', opacity: deshabilitado ? .45 : 1, transition: 'background .15s', WebkitTapHighlightColor: 'transparent', display: 'flex', alignItems: 'center', justifyContent: activo ? 'flex-end' : 'flex-start' }}>
      <span style={{ width: 24, height: 24, borderRadius: '50%', background: '#fff', display: 'block' }}/>
    </button>
  )
}

// Qué le decimos a la persona después de la prueba (y qué hacer si algo falla).
function textoPrueba(r, donde) {
  const cfg = r?.config || {}
  const detalle = r?.registroError ? ` (${r.registroError})` : ''
  if (r?.error === 'red') return { tono: 'mal', lineas: ['No se pudo hablar con Golmebol. Revisa tu internet e intenta otra vez.'] }
  if (r?.error === 'espera') return { tono: 'aviso', lineas: ['Espera unos segundos y vuelve a tocar el botón.'] }
  if (r?.error === 'sin_token') return { tono: 'mal', lineas: ['Este celular no tiene el permiso de avisos listo. Apaga y vuelve a prender «Recibir notificaciones».' + detalle] }
  if (r?.error === 'servidor' || r?.error === 'base') return { tono: 'mal', lineas: ['El servidor de Golmebol no respondió bien.' + (r.detalle ? ` (${r.detalle})` : ''), ...(cfg.faltan?.length ? ['Le falta configurar: ' + cfg.faltan.join(', ') + '.'] : [])] }
  if (r?.registrado === false) return { tono: 'mal', lineas: ['Tu celular NO está registrado en Golmebol, por eso no te llegan avisos.' + detalle, 'Apaga y vuelve a prender «Recibir notificaciones». Si sigue igual, el administrador debe revisar el servidor.'] }
  const lineas = []
  let tono = 'ok'
  const subir = (t) => { if (tono === 'ok') tono = t }
  if (r.envio === 'ok') lineas.push('Te mandamos una prueba: debe aparecer ahora como notificación en la pantalla.' + (donde === 'nativo' ? ' (Si tienes la app abierta, sale adentro de la app.)' : ''))
  else if (r.envio === 'invalido') { subir('mal'); lineas.push('El servicio de avisos de tu celular ya no es válido. Apaga y vuelve a prender «Recibir notificaciones».') }
  else { subir('mal'); lineas.push('El servidor no pudo enviar la notificación.' + (cfg.faltan?.length ? ' Le falta configurar: ' + cfg.faltan.join(', ') + '.' : ' Intenta de nuevo en un momento.')) }
  lineas.push(`Registrado en Golmebol: sigues ${r.equipos} ${r.equipos === 1 ? 'equipo' : 'equipos'} y ${r.torneos} ${r.torneos === 1 ? 'torneo' : 'torneos'}.`)
  if (!r.activo) { subir('mal'); lineas.push('Ojo: en el servidor tu celular figura apagado. Apaga y vuelve a prender «Recibir notificaciones».') }
  if (r.equipos === 0 && r.torneos === 0) { subir('aviso'); lineas.push('No tienes ningún equipo ni torneo activado, así que no te llegará ningún aviso de partidos. Toca la estrella de un equipo o activa un torneo.') }
  if (cfg.cron_secreto === false) { subir('aviso'); lineas.push('Al servidor le falta PUSH_CRON_SECRET: sin eso los avisos automáticos de partidos no salen (esta prueba sí).') }
  if (cfg.en_horario_de_envio === false) lineas.push('Ahora no es horario de envío (10 am – 10 pm de Colombia): los avisos de partidos esperan hasta las 10 am.')
  if (r.envio === 'ok') lineas.push(donde === 'nativo' ? 'Si no la ves: Ajustes del celular → Aplicaciones → Golmebol → Notificaciones.' : 'Si no la ves: revisa que las notificaciones de Golmebol estén permitidas en los Ajustes del celular (en iPhone, Golmebol debe estar instalada en la pantalla de inicio).')
  return { tono, lineas }
}

function Hoja({ onCerrar }) {
  const { activo, torneos, activar, desactivar, alternarTorneo } = useAvisos()
  const { ids: equiposIds } = useFavoritos()
  const [equipos, setEquipos] = useState([])
  const [lista, setLista] = useState([])
  const [cargando, setCargando] = useState(true)
  const [ocupado, setOcupado] = useState(false)
  const [aviso, setAviso] = useState('')
  const donde = plataformaAvisos()
  const sinSoporte = donde === 'falta_instalar' || donde === 'no_disponible'
  const [motivoAviso, setMotivoAviso] = useState('')
  const [prueba, setPrueba] = useState({ fase: 'idle', r: null })

  useEffect(() => {
    let cancelado = false
    ;(async () => {
      const { data } = await supabase.from('tournaments').select('id, name, archivado').eq('status', 'active')
      if (!cancelado) { setLista((data || []).filter(t => !t.archivado).sort((a, b) => (a.name || '').localeCompare(b.name || ''))); setCargando(false) }
    })()
    return () => { cancelado = true }
  }, [])

  useEffect(() => {
    let cancelado = false
    if (!equiposIds.length) return
    supabase.from('teams').select('id, name').in('id', equiposIds).then(({ data }) => {
      if (!cancelado) setEquipos((data || []).sort((a, b) => (a.name || '').localeCompare(b.name || '')))
    })
    return () => { cancelado = true }
  }, [equiposIds])

  async function alternarGeneral() {
    if (ocupado) return
    setOcupado(true); setAviso('')
    if (activo) await desactivar()
    else {
      const r = await activar()
      if (!r.ok) { setMotivoAviso(r.motivo); setAviso(mensajeMotivo(r.motivo, donde) + (r.detalle ? ` (${r.detalle})` : '')) }
    }
    setOcupado(false)
  }

  async function probar() {
    if (prueba.fase === 'enviando') return
    setPrueba({ fase: 'enviando', r: null })
    const r = await probarAvisos()
    setPrueba({ fase: 'listo', r })
  }

  const fila = { display: 'flex', alignItems: 'center', gap: 12, padding: '13px 0', borderTop: `1px solid ${C.border}` }
  const titulo = { fontSize: '.7rem', fontWeight: 800, letterSpacing: '.08em', color: C.muted, margin: '22px 0 4px' }

  return (
    <div onClick={onCerrar} style={{ position: 'fixed', inset: 0, zIndex: 700, background: 'rgba(0,0,0,.72)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} role="dialog" aria-label="Avisos de Golmebol"
        style={{ width: '100%', maxWidth: 480, maxHeight: '88vh', overflowY: 'auto', boxSizing: 'border-box', background: C.card, color: C.text, borderRadius: '20px 20px 0 0', padding: '20px 18px calc(24px + env(safe-area-inset-bottom, 0px))', border: `1px solid ${C.border}`, borderBottom: 'none', textAlign: 'left' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <div style={{ fontSize: '1.15rem', fontWeight: 900 }}>Avisos de Golmebol</div>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" style={{ width: 40, height: 40, borderRadius: 12, border: 'none', background: C.card2, color: C.text, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><X size={18}/></button>
        </div>

        <div style={{ ...fila, borderTop: 'none' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: '.95rem' }}>Recibir notificaciones</div>
            <div style={{ color: C.muted, fontSize: '.78rem', marginTop: 2, lineHeight: 1.4 }}>{donde === 'nativo' ? 'Te llegan al celular aunque la app esté cerrada.' : 'Te llegan al celular aunque cierres la página.'}</div>
          </div>
          <Interruptor activo={activo} onClick={alternarGeneral} deshabilitado={ocupado || sinSoporte} nombre="Recibir notificaciones"/>
        </div>
        {sinSoporte && !aviso && <div style={{ background: 'rgba(245,166,35,.12)', border: '1px solid #f5a623', color: '#ffd9a0', borderRadius: 10, padding: '10px 12px', fontSize: '.8rem', lineHeight: 1.45, marginTop: 4 }}>{mensajeMotivo(donde, donde)}</div>}
        {aviso && <div style={{ background: 'rgba(229,67,61,.12)', border: `1px solid ${C.red}`, color: '#ffb4b0', borderRadius: 10, padding: '10px 12px', fontSize: '.8rem', lineHeight: 1.45, marginTop: 4 }}>{aviso}</div>}
        {(donde === 'falta_instalar' || motivoAviso === 'falta_instalar') && (
          <button type="button" onClick={() => { onCerrar(); abrirGuiaInstalar() }}
            style={{ width: '100%', marginTop: 10, minHeight: 48, borderRadius: 12, border: 'none', background: C.green, color: '#0a1a05', fontWeight: 900, fontSize: '.95rem', cursor: 'pointer' }}>
            Ver cómo instalar Golmebol
          </button>
        )}

        {activo && (() => {
          const res = prueba.fase === 'listo' ? textoPrueba(prueba.r, donde) : null
          const color = res?.tono === 'ok' ? C.green : res?.tono === 'aviso' ? '#f5a623' : C.red
          return (
            <div style={{ marginTop: 12 }}>
              <button type="button" onClick={probar} disabled={prueba.fase === 'enviando'}
                style={{ width: '100%', minHeight: 48, borderRadius: 12, border: `1px solid ${C.green}`, background: 'rgba(111,207,61,.1)', color: C.green, fontWeight: 900, fontSize: '.92rem', cursor: prueba.fase === 'enviando' ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: prueba.fase === 'enviando' ? .7 : 1 }}>
                <Send size={17}/> {prueba.fase === 'enviando' ? 'Enviando prueba…' : 'Enviarme una notificación de prueba'}
              </button>
              {res && (
                <div style={{ marginTop: 8, borderRadius: 10, padding: '10px 12px', fontSize: '.8rem', lineHeight: 1.5, color: C.text2, background: C.card2, border: `1px solid ${color}` }}>
                  {res.lineas.map((t, i) => <div key={i} style={{ marginBottom: i === res.lineas.length - 1 ? 0 : 6, color: i === 0 ? C.text : C.text2, fontWeight: i === 0 ? 700 : 500 }}>{t}</div>)}
                </div>
              )}
            </div>
          )
        })()}

        <div style={{ background: C.card2, borderRadius: 12, padding: '12px 14px', marginTop: 12, fontSize: '.8rem', color: C.text2, lineHeight: 1.5 }}>
          {[
            'Resultado final de los partidos',
            'Partidos nuevos y cambios de fecha, hora o cancha',
            'Recordatorio 1 hora antes de tu partido',
          ].map(t => <div key={t} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 3 }}><Check size={15} color={C.green} style={{ marginTop: 2, flexShrink: 0 }}/>{t}</div>)}
          <div style={{ color: C.muted, marginTop: 6, fontSize: '.74rem' }}>Solo entre las 10:00 am y las 10:00 pm. Lo que pase de noche te llega a partir de las 10:00 am.</div>
        </div>

        <div style={titulo}>EQUIPOS QUE SIGUES</div>
        {equiposIds.length === 0 || equipos.length === 0 ? (
          <div style={{ color: C.muted, fontSize: '.82rem', lineHeight: 1.5, padding: '8px 0' }}>
            Aún no sigues ningún equipo. Toca la estrella <Star size={13} color="#f5a623" fill="#f5a623" style={{ verticalAlign: '-2px' }}/> junto al nombre de un equipo (en la tabla o en su perfil) y recibirás sus partidos y resultados.
          </div>
        ) : equipos.filter(e => equiposIds.includes(e.id)).map(e => (
          <div key={e.id} style={fila}>
            <Star size={16} color="#f5a623" fill="#f5a623" style={{ flexShrink: 0 }}/>
            <div style={{ fontWeight: 700, fontSize: '.9rem', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.name}</div>
          </div>
        ))}

        <div style={titulo}>TORNEOS</div>
        <div style={{ color: C.muted, fontSize: '.78rem', lineHeight: 1.45, paddingBottom: 6 }}>Activa un torneo para recibir los resultados, partidos nuevos y cambios de todo el torneo.</div>
        {cargando ? <div style={{ color: C.muted, fontSize: '.82rem', padding: '8px 0' }}>Cargando torneos…</div>
          : lista.length === 0 ? <div style={{ color: C.muted, fontSize: '.82rem', padding: '8px 0' }}>No hay torneos activos por ahora.</div>
          : lista.map(t => (
            <div key={t.id} style={fila}>
              <div style={{ flex: 1, minWidth: 0, fontWeight: 700, fontSize: '.9rem', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.name}</div>
              <Interruptor activo={torneos.includes(t.id)} onClick={() => alternarTorneo(t.id)} deshabilitado={!activo} nombre={`Avisos de ${t.name}`}/>
            </div>
          ))}
        {!activo && lista.length > 0 && <div style={{ color: C.muted, fontSize: '.74rem', marginTop: 6 }}>Activa “Recibir notificaciones” para poder elegir torneos.</div>}
      </div>
    </div>
  )
}

// Botón "Activar avisos de este torneo" para la página pública de cada torneo
export function BotonAvisosTorneo({ torneoId, nombre, sobreColor = false }) {
  const { activo, torneos, alternarTorneo } = useAvisos()
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState('')
  const [motivo, setMotivo] = useState('')
  const donde = plataformaAvisos()
  const siguiendo = activo && torneos.includes(torneoId)
  if (!torneoId) return null

  async function tocar() {
    if (ocupado) return
    setError(''); setMotivo('')
    if (activo) { alternarTorneo(torneoId); return }
    setOcupado(true)
    const r = await activarAvisosDeTorneo(torneoId)
    setOcupado(false)
    if (!r.ok) { setMotivo(r.motivo); setError(mensajeMotivo(r.motivo, donde) + (r.detalle ? ` (${r.detalle})` : '')) }
  }
  const Icono = siguiendo ? BellRing : Bell
  return (
    <div style={{ marginTop: 12 }}>
      <button type="button" onClick={tocar} disabled={ocupado} aria-pressed={siguiendo}
        aria-label={siguiendo ? `Quitar avisos de ${nombre || 'este torneo'}` : `Activar avisos de ${nombre || 'este torneo'}`}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minHeight: 46, padding: '0 18px', borderRadius: 999,
          border: siguiendo ? `1px solid ${sobreColor ? '#fff' : C.green}` : 'none',
          background: siguiendo ? (sobreColor ? 'rgba(255,255,255,.2)' : 'rgba(111,207,61,.12)') : (sobreColor ? '#fff' : C.green),
          color: siguiendo ? (sobreColor ? '#fff' : C.green) : (sobreColor ? '#111' : '#0a1a05'), fontSize: '.85rem', fontWeight: 900, letterSpacing: '.03em', cursor: ocupado ? 'default' : 'pointer', opacity: ocupado ? .7 : 1, WebkitTapHighlightColor: 'transparent' }}>
        <Icono size={17}/> {ocupado ? 'ACTIVANDO…' : siguiendo ? 'AVISOS ACTIVADOS · TOCA PARA QUITAR' : 'ACTIVAR AVISOS DE ESTE TORNEO'}
      </button>
      {!siguiendo && !error && <div style={{ color: sobreColor ? 'rgba(255,255,255,.85)' : C.muted, fontSize: '.74rem', marginTop: 6, lineHeight: 1.4 }}>Te avisamos de partidos nuevos, cambios de horario y resultados.</div>}
      {error && (
        <div style={{ background: 'rgba(229,67,61,.12)', border: `1px solid ${C.red}`, color: '#ffb4b0', borderRadius: 10, padding: '10px 12px', fontSize: '.8rem', lineHeight: 1.45, marginTop: 8, maxWidth: 420 }}>
          {error}
          {motivo === 'falta_instalar' && (
            <button type="button" onClick={abrirGuiaInstalar} style={{ display: 'block', width: '100%', marginTop: 8, minHeight: 44, borderRadius: 10, border: 'none', background: C.green, color: '#0a1a05', fontWeight: 900, cursor: 'pointer' }}>Ver cómo instalar Golmebol</button>
          )}
        </div>
      )}
    </div>
  )
}

export default function BotonAvisos({ cristal = false }) {
  const [abierto, setAbierto] = useState(false)
  const { activo } = useAvisos()
  const Icono = activo ? BellRing : Bell
  return (
    <>
      <button type="button" onClick={() => setAbierto(true)} className={cristal ? 'gm-cristal' : undefined}
        style={cristal
          ? { display: 'inline-flex', alignItems: 'center', gap: 8, minHeight: 42, padding: '0 16px', borderRadius: 999, color: activo ? C.green : C.text2, fontSize: '.78rem', fontWeight: 800, letterSpacing: '.04em', ...(activo ? { borderColor: 'rgba(111,207,61,.55)' } : {}) }
          : { display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 14, padding: '11px 20px', borderRadius: 999, border: `1px solid ${activo ? C.green : C.border}`, background: 'transparent', color: activo ? C.green : C.text2, fontSize: '.8rem', fontWeight: 800, letterSpacing: '.04em', cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}>
        <Icono size={16}/> {activo ? 'AVISOS ACTIVADOS' : 'ACTIVAR AVISOS'}
      </button>
      {abierto && <Hoja onCerrar={() => setAbierto(false)}/>}
    </>
  )
}
