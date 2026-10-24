import { useState, useEffect } from 'react'
import { Bell, BellRing, X, Star, Check } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useFavoritos } from '../lib/favoritos'
import { useAvisos, avisosDisponibles } from '../lib/avisos'

// Botón "AVISOS" (solo dentro de la app) + hoja para activar las notificaciones,
// ver los equipos que sigue y elegir torneos. En la web normal no se muestra.
const C = { card: '#161616', card2: '#1c1c1c', border: '#2a2a2a', green: '#6fcf3d', text: '#fff', text2: '#c9c9c9', muted: '#8a8a8a', red: '#e5433d' }

function Interruptor({ activo, onClick, deshabilitado, nombre }) {
  return (
    <button type="button" role="switch" aria-checked={!!activo} aria-label={nombre} disabled={deshabilitado} onClick={onClick}
      style={{ width: 50, height: 30, borderRadius: 999, border: 'none', padding: 3, flexShrink: 0, cursor: deshabilitado ? 'default' : 'pointer',
        background: activo ? C.green : '#3a3a3a', opacity: deshabilitado ? .45 : 1, transition: 'background .15s', WebkitTapHighlightColor: 'transparent', display: 'flex', alignItems: 'center', justifyContent: activo ? 'flex-end' : 'flex-start' }}>
      <span style={{ width: 24, height: 24, borderRadius: '50%', background: '#fff', display: 'block' }}/>
    </button>
  )
}

function Hoja({ onCerrar }) {
  const { activo, torneos, activar, desactivar, alternarTorneo } = useAvisos()
  const { ids: equiposIds } = useFavoritos()
  const [equipos, setEquipos] = useState([])
  const [lista, setLista] = useState([])
  const [cargando, setCargando] = useState(true)
  const [ocupado, setOcupado] = useState(false)
  const [aviso, setAviso] = useState('')

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
      if (!r.ok) setAviso(r.motivo === 'permiso'
        ? 'Golmebol no tiene permiso para enviarte notificaciones. Actívalo en Ajustes del celular → Aplicaciones → Golmebol → Notificaciones.'
        : 'No se pudieron activar los avisos. Revisa tu internet e intenta de nuevo.')
    }
    setOcupado(false)
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
            <div style={{ color: C.muted, fontSize: '.78rem', marginTop: 2, lineHeight: 1.4 }}>Te llegan al celular aunque la app esté cerrada.</div>
          </div>
          <Interruptor activo={activo} onClick={alternarGeneral} deshabilitado={ocupado} nombre="Recibir notificaciones"/>
        </div>
        {aviso && <div style={{ background: 'rgba(229,67,61,.12)', border: `1px solid ${C.red}`, color: '#ffb4b0', borderRadius: 10, padding: '10px 12px', fontSize: '.8rem', lineHeight: 1.45, marginTop: 4 }}>{aviso}</div>}

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

export default function BotonAvisos() {
  const [abierto, setAbierto] = useState(false)
  const { activo } = useAvisos()
  if (!avisosDisponibles()) return null
  const Icono = activo ? BellRing : Bell
  return (
    <>
      <button type="button" onClick={() => setAbierto(true)}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 14, padding: '11px 20px', borderRadius: 999, border: `1px solid ${activo ? C.green : C.border}`, background: 'transparent', color: activo ? C.green : C.text2, fontSize: '.8rem', fontWeight: 800, letterSpacing: '.04em', cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}>
        <Icono size={16}/> {activo ? 'AVISOS ACTIVADOS' : 'ACTIVAR AVISOS'}
      </button>
      {abierto && <Hoja onCerrar={() => setAbierto(false)}/>}
    </>
  )
}
