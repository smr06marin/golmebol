import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const PALETAS = {
  dark:  { border: '#1e2d3d', muted: '#7a9ab5' },
  light: { border: '#dadce0', muted: '#5f6368' },
}

// Menú compartido de "cambiar de portal": aparece en la cabecera de las
// páginas de cada rol (jugador, árbitro, coordinador de árbitros, profesor/
// coordinador de escuela, encargado de escenario) para saltar entre los
// portales que tenga esa misma cuenta, resaltando en cuál está parado ahora
// mismo. Si la cuenta solo tiene un rol, no se muestra (no hay a dónde más ir).
// lista: en vez de botoncitos en fila, filas grandes en columna (para usarlo dentro de un menú)
export default function PortalesMenu({ usuario, actual, theme = 'dark', lista = false, conTitulo = false }) {
  const navigate = useNavigate()
  const { escenarioId } = useParams()
  const [escenarios, setEscenarios] = useState([])
  const c = PALETAS[theme] || PALETAS.dark

  useEffect(() => {
    if (!usuario?.es_encargado_escenario) { setEscenarios([]); return }
    let cancelado = false
    supabase.from('escenario_encargados').select('escenarios(id, name)').eq('player_id', usuario.id)
      .then(({ data }) => {
        if (cancelado) return
        setEscenarios((data || []).map(d => d.escenarios).filter(Boolean))
      })
    return () => { cancelado = true }
  }, [usuario?.id, usuario?.es_encargado_escenario])

  if (!usuario) return null

  const opciones = []
  if (usuario.rol !== 'arbitro' && usuario.rol !== 'profesor') {
    opciones.push({ key: 'jugador', label: '👤 Jugador', to: '/jugador', color: '#00ddd0', bg: 'rgba(0,221,208,.15)' })
  }
  if (usuario.es_arbitro || usuario.rol === 'arbitro') {
    opciones.push({ key: 'arbitro', label: '🟡 Árbitro', to: '/arbitro', color: '#f9a825', bg: 'rgba(249,168,37,.15)' })
  }
  if (usuario.es_arbitro_lider) {
    opciones.push({ key: 'arbitro_lider', label: '👑 Coord. Árbitros', to: '/arbitro/lider', color: '#f9a825', bg: 'rgba(249,168,37,.15)' })
  }
  if (usuario.es_profesor || usuario.es_profesor_coordinador || usuario.rol === 'profesor') {
    opciones.push({
      key: 'profesor',
      label: usuario.es_profesor_coordinador ? '👑 Coord. Escuela' : '🧑‍🏫 Profesor',
      to: '/escuela', color: '#00ddd0', bg: 'rgba(0,221,208,.15)',
    })
  }
  if (usuario.es_encargado_escenario) {
    // Un mismo encargado puede tener varios escenarios asignados — si tiene
    // más de uno, sale un botón por cada uno (con su nombre) en vez de un
    // único botón genérico "Escenario".
    if (escenarios.length > 1) {
      escenarios.forEach(e => {
        opciones.push({ key: `escenario-${e.id}`, label: `🏟️ ${e.name}`, to: `/escenario/${e.id}`, color: '#00ddd0', bg: 'rgba(0,221,208,.15)', isEscenario: true, escenarioId: e.id })
      })
    } else {
      opciones.push({ key: 'escenario', label: '🏟️ Escenario', to: '/escenario', color: '#00ddd0', bg: 'rgba(0,221,208,.15)', isEscenario: true })
    }
  }

  if (opciones.length <= 1) return null

  if (lista) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {conTitulo && <div style={{ fontSize: '.7rem', fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: '#8a8a8a', padding: '12px 16px 4px', borderTop: '1px solid #2a2a2a' }}>Ir a otro portal</div>}
        {opciones.map((o, i) => {
          const isActual = o.isEscenario
            ? (actual === 'escenario' && (!o.escenarioId || o.escenarioId === escenarioId))
            : o.key === actual
          return (
            <button key={o.key} onClick={() => !isActual && navigate(o.to)} disabled={isActual}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', width: '100%', minHeight: '52px', padding: '0 16px', background: 'none', border: 'none', borderTop: i > 0 ? '1px solid #2a2a2a' : 'none', cursor: isActual ? 'default' : 'pointer', color: isActual ? '#6fcf3d' : '#fff', fontSize: '.92rem', fontWeight: 700, textAlign: 'left', fontFamily: 'inherit' }}>
              <span>{o.label.replace(/^[^\p{L}\p{N}]+/u, '')}</span>
              {isActual ? <span style={{ fontSize: '.68rem', fontWeight: 800, color: '#6fcf3d' }}>Estás aquí</span> : <span style={{ color: '#6b6b6b' }}>›</span>}
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
      {opciones.map(o => {
        const isActual = o.isEscenario
          ? (actual === 'escenario' && (!o.escenarioId || o.escenarioId === escenarioId))
          : o.key === actual
        return (
          <button key={o.key} onClick={() => !isActual && navigate(o.to)} disabled={isActual}
            style={{
              background: isActual ? o.bg : 'none',
              border: `1px solid ${isActual ? o.color + '66' : c.border}`,
              borderRadius: '8px', padding: '6px 11px', cursor: isActual ? 'default' : 'pointer',
              color: isActual ? o.color : c.muted, fontSize: '.72rem', fontWeight: '700',
              opacity: isActual ? 1 : .85, whiteSpace: 'nowrap',
            }}>
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
