import { useEffect, useMemo, useRef, useState } from 'react'
import { Ban, Search, X, Clock, Globe, Send } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { errorAmigable, avisoMigracion } from '../../lib/mensajesError'
import { confirmar } from '../../lib/confirmar'
import { notify } from '../../lib/notify'

// ─────────────────────────────────────────────────────────────────────────────
// SUSPENSIONES
//  · Lista de jugadores suspendidos (los que puso el organizador a mano y los
//    que quedan solos por tarjeta roja). Desde ahí se puede quitar la sanción
//    (por si fue un error) o darle más tiempo.
//  · Suspender a un jugador SOLO en un torneo (el organizador tiene poder solo
//    sobre los jugadores de SUS torneos).
//  · VETO DE GOLMEBOL: el jugador no puede jugar NINGÚN torneo de la plataforma.
//    El organizador no lo decide: manda una solicitud a Golmebol con el motivo y
//    Golmebol (el administrador de la plataforma) la aprueba o la rechaza
//    (tabla solicitudes_suspension, ver migracion_solicitudes_suspension.sql).
// Todo se guarda en la tabla `sanciones`, la misma que ya leen las planillas.
// ─────────────────────────────────────────────────────────────────────────────

const AZUL = '#1a73e8'
const ROJO = '#d93025'
const sinTildes = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const fmtFecha = new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
const MES_MS = 30 * 24 * 60 * 60 * 1000
const MESES = [[1, '1 mes'], [2, '2 meses'], [3, '3 meses'], [6, '6 meses'], [12, '12 meses']]

const esRojaAuto = s => /tarjeta roja autom/i.test(s?.motivo || '')
const porPartidos = s => s?.partidos_pendientes != null && Number(s.partidos_pendientes) > 0
const vigente = s => s.activa && (!s.fecha_fin || new Date(s.fecha_fin) > new Date())

function duracionTexto(s) {
  if (porPartidos(s)) {
    const n = Number(s.partidos_pendientes)
    return `Se pierde ${n} partido${n !== 1 ? 's' : ''}`
  }
  return s.fecha_fin ? `Hasta el ${fmtFecha.format(new Date(s.fecha_fin))}` : 'Sin fecha de fin (indefinida)'
}

const inputBase = { width: '100%', boxSizing: 'border-box', minHeight: '48px', padding: '0 14px', border: '1.5px solid #dadce0', borderRadius: '12px', fontSize: '1rem', color: '#202124', background: '#fff', outline: 'none', fontFamily: 'inherit' }
const etiqueta = { display: 'block', fontSize: '.74rem', fontWeight: '800', color: '#5f6368', letterSpacing: '.03em', margin: '0 0 6px' }
const botonPrim = (color = AZUL, off = false) => ({ minHeight: '48px', padding: '0 18px', border: 'none', borderRadius: '12px', background: off ? '#bdc1c6' : color, color: '#fff', fontWeight: '800', fontSize: '.92rem', cursor: off ? 'default' : 'pointer', touchAction: 'manipulation' })
const botonSec = { minHeight: '48px', padding: '0 16px', border: '1.5px solid #dadce0', borderRadius: '12px', background: '#fff', color: '#3c4043', fontWeight: '800', fontSize: '.9rem', cursor: 'pointer', touchAction: 'manipulation' }

function Etiqueta({ children, bg, color }) {
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '.68rem', fontWeight: '800', padding: '3px 8px', borderRadius: '999px', background: bg, color }}>{children}</span>
}

function Segmentos({ opciones, valor, onChange }) {
  return (
    <div style={{ display: 'flex', gap: '4px', background: '#f1f3f4', borderRadius: '14px', padding: '4px' }}>
      {opciones.map(o => (
        <button key={o.id} type="button" onClick={() => onChange(o.id)} aria-pressed={valor === o.id}
          style={{ flex: 1, minHeight: '44px', padding: '4px 8px', border: 'none', borderRadius: '11px', cursor: 'pointer', fontSize: '.82rem', fontWeight: '800', lineHeight: 1.2, touchAction: 'manipulation',
            background: valor === o.id ? '#fff' : 'transparent', color: valor === o.id ? AZUL : '#5f6368', boxShadow: valor === o.id ? '0 1px 4px rgba(0,0,0,.12)' : 'none' }}>
          {o.texto}
        </button>
      ))}
    </div>
  )
}

function Hoja({ titulo, subtitulo, children, onClose }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 960, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: '18px', width: '100%', maxWidth: '440px', maxHeight: '92vh', overflowY: 'auto', padding: '20px', boxShadow: '0 20px 60px rgba(0,0,0,.3)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '14px' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: '900', fontSize: '1.02rem', color: '#202124' }}>{titulo}</div>
            {subtitulo && <div style={{ fontSize: '.8rem', color: '#80868b', marginTop: '3px', lineHeight: 1.4 }}>{subtitulo}</div>}
          </div>
          <button onClick={onClose} aria-label="Cerrar" style={{ background: '#f1f3f4', border: 'none', borderRadius: '12px', width: '40px', height: '40px', cursor: 'pointer', color: '#5f6368', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><X size={18}/></button>
        </div>
        {children}
      </div>
    </div>
  )
}

// Número que se escribe con el teclado (sin flechas)
function CampoNumero({ value, onChange, ancho = '90px', etiquetaAria }) {
  return (
    <input type="text" inputMode="numeric" pattern="[0-9]*" autoComplete="off" maxLength={2} aria-label={etiquetaAria}
      value={value} onFocus={e => e.target.select()} onChange={e => onChange(e.target.value.replace(/\D/g, '').slice(0, 2))}
      style={{ ...inputBase, width: ancho, textAlign: 'center', fontSize: '1.3rem', fontWeight: '900' }}/>
  )
}

// ── Ventana: dar más tiempo / cambiar la sanción ──
function ModalEditar({ sancion, nombre, guardando, onGuardar, onClose }) {
  const [partidos, setPartidos] = useState(String(sancion.partidos_pendientes || 1))
  const [extra, setExtra] = useState('0') // '0' = dejar como está | meses | 'indef'
  const [motivo, setMotivo] = useState(sancion.motivo || '')
  const porP = porPartidos(sancion)
  const n = Number(partidos || 0)
  const puedeGuardar = !guardando && motivo.trim().length >= 3 && (!porP || n >= 1)

  function guardar() {
    const cambios = { motivo: motivo.trim() }
    if (porP) {
      cambios.partidos_pendientes = n
    } else if (extra === 'indef') {
      cambios.fecha_fin = null
    } else if (extra !== '0') {
      const base = sancion.fecha_fin && new Date(sancion.fecha_fin) > new Date() ? new Date(sancion.fecha_fin).getTime() : Date.now()
      cambios.fecha_fin = new Date(base + Number(extra) * MES_MS).toISOString()
    }
    onGuardar(cambios)
  }

  return (
    <Hoja titulo="Cambiar la sanción" subtitulo={`${nombre} · ${duracionTexto(sancion)}`} onClose={onClose}>
      {porP ? (
        <div style={{ marginBottom: '14px' }}>
          <label style={etiqueta}>PARTIDOS QUE LE FALTAN POR PERDERSE</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <CampoNumero value={partidos} onChange={setPartidos} etiquetaAria="Partidos de sanción"/>
            <span style={{ fontSize: '.8rem', color: '#80868b', lineHeight: 1.4 }}>Sube el número para darle más tiempo. Si fue un error, mejor usa “Quitar sanción”.</span>
          </div>
        </div>
      ) : (
        <div style={{ marginBottom: '14px' }}>
          <label style={etiqueta}>DARLE MÁS TIEMPO</label>
          <select value={extra} onChange={e => setExtra(e.target.value)} style={inputBase}>
            <option value="0">Dejarla como está</option>
            {MESES.map(([m, t]) => <option key={m} value={m}>Sumarle {t}</option>)}
            <option value="indef">Dejarla indefinida (sin fecha de fin)</option>
          </select>
        </div>
      )}
      <div style={{ marginBottom: '16px' }}>
        <label style={etiqueta}>MOTIVO</label>
        <textarea value={motivo} onChange={e => setMotivo(e.target.value)} rows={3} style={{ ...inputBase, padding: '12px 14px', resize: 'vertical' }}/>
      </div>
      <div style={{ display: 'flex', gap: '10px' }}>
        <button onClick={onClose} style={botonSec}>Cancelar</button>
        <button onClick={guardar} disabled={!puedeGuardar} style={{ ...botonPrim(AZUL, !puedeGuardar), flex: 1 }}>{guardando ? 'Guardando…' : 'Guardar cambios'}</button>
      </div>
    </Hoja>
  )
}

// ── Ventana del administrador: aprobar o rechazar una solicitud ──
function ModalResolver({ solicitud, nombre, modo, guardando, onConfirmar, onClose }) {
  const [meses, setMeses] = useState(solicitud.meses_sugeridos ? String(solicitud.meses_sugeridos) : 'indef')
  const [respuesta, setRespuesta] = useState('')
  const aprobar = modo === 'aprobar'
  return (
    <Hoja titulo={aprobar ? 'Vetar de toda la plataforma' : 'Rechazar la solicitud'} subtitulo={`${nombre} · pedido por ${solicitud.solicitante_nombre || 'un organizador'}`} onClose={onClose}>
      <div style={{ background: '#f8f9fa', border: '1px solid #eceff1', borderRadius: '12px', padding: '10px 12px', marginBottom: '14px', fontSize: '.84rem', color: '#3c4043', lineHeight: 1.45 }}>
        <b>Motivo que dieron:</b> {solicitud.motivo}
      </div>
      {aprobar && (
        <div style={{ marginBottom: '14px' }}>
          <label style={etiqueta}>DURACIÓN</label>
          <select value={meses} onChange={e => setMeses(e.target.value)} style={inputBase}>
            <option value="indef">Indefinido (veto definitivo)</option>
            {MESES.map(([m, t]) => <option key={m} value={m}>{t}</option>)}
          </select>
          <div style={{ fontSize: '.76rem', color: '#80868b', marginTop: '6px', lineHeight: 1.4 }}>Al aprobar, el jugador no podrá jugar ningún torneo de Golmebol.</div>
        </div>
      )}
      <div style={{ marginBottom: '16px' }}>
        <label style={etiqueta}>{aprobar ? 'MENSAJE PARA QUIEN LA PIDIÓ (OPCIONAL)' : 'POR QUÉ SE RECHAZA (OPCIONAL)'}</label>
        <textarea value={respuesta} onChange={e => setRespuesta(e.target.value)} rows={2} style={{ ...inputBase, padding: '12px 14px', resize: 'vertical' }}/>
      </div>
      <div style={{ display: 'flex', gap: '10px' }}>
        <button onClick={onClose} style={botonSec}>Cancelar</button>
        <button onClick={() => onConfirmar({ meses: meses === 'indef' ? null : Number(meses), respuesta: respuesta.trim() })} disabled={guardando}
          style={{ ...botonPrim(aprobar ? ROJO : '#5f6368', guardando), flex: 1 }}>
          {guardando ? 'Guardando…' : aprobar ? 'Aprobar y vetar' : 'Rechazar solicitud'}
        </button>
      </div>
    </Hoja>
  )
}

export default function AdminSuspensionesPage() {
  const { user, rol } = useAuthStore()
  const esAdmin = rol?.rol ? rol.rol === 'admin' : true
  const miNombre = rol?.nombre || user?.email || 'Organizador'

  const [vista, setVista] = useState('lista') // 'lista' | 'nueva' | 'solicitudes'
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [torneos, setTorneos] = useState([])
  const [sanciones, setSanciones] = useState([])
  const [nombres, setNombres] = useState({})      // player_id -> nombre
  const [equipos, setEquipos] = useState({})      // team_id -> nombre
  const [partidosRoja, setPartidosRoja] = useState({}) // match_id -> "A vs B · fecha"
  const [filtroTorneo, setFiltroTorneo] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('todas') // 'todas' | 'rojas' | 'manuales'
  const [busqueda, setBusqueda] = useState('')
  const [editando, setEditando] = useState(null)
  const [guardando, setGuardando] = useState(false)

  // Solicitudes
  const [solicitudes, setSolicitudes] = useState([])
  const [solicitudesOk, setSolicitudesOk] = useState(true)
  const [resolviendo, setResolviendo] = useState(null) // { solicitud, modo }

  // Formulario "Suspender jugador"
  const [formTorneo, setFormTorneo] = useState('')
  const [inscritos, setInscritos] = useState([])
  const [cargandoInscritos, setCargandoInscritos] = useState(false)
  const [buscaJugador, setBuscaJugador] = useState('')
  const [jugador, setJugador] = useState(null) // { player_id, name, team_id, teamName }
  const [alcance, setAlcance] = useState('torneo') // 'torneo' | 'todos'
  const [tipoDuracion, setTipoDuracion] = useState('partidos') // 'partidos' | 'tiempo'
  const [nPartidos, setNPartidos] = useState('1')
  const [mesesForm, setMesesForm] = useState('1') // meses | 'indef'
  const [motivo, setMotivo] = useState('')
  const reqId = useRef(0)

  const nombreTorneo = id => torneos.find(t => t.id === id)?.name || 'Torneo'

  async function traerNombres(playerIds, teamIds) {
    const pids = [...new Set(playerIds.filter(Boolean))]
    const tids = [...new Set(teamIds.filter(Boolean))]
    const jug = {}, eq = {}
    for (let i = 0; i < pids.length; i += 150) {
      const { data } = await supabase.from('players').select('id,name').in('id', pids.slice(i, i + 150))
      ;(data || []).forEach(p => { jug[p.id] = p.name })
    }
    for (let i = 0; i < tids.length; i += 150) {
      const { data } = await supabase.from('teams').select('id,name').in('id', tids.slice(i, i + 150))
      ;(data || []).forEach(t => { eq[t.id] = t.name })
    }
    setNombres(prev => ({ ...prev, ...jug }))
    setEquipos(prev => ({ ...prev, ...eq }))
  }

  async function cargarTodo() {
    const id = ++reqId.current
    setError('')
    try {
      // 1) Torneos sobre los que esta persona manda
      let qt = supabase.from('tournaments').select('id,name,status,organizador_id').order('created_at', { ascending: false })
      if (!esAdmin) qt = qt.eq('organizador_id', user?.id)
      const { data: ts, error: et } = await qt
      if (et) throw et
      if (id !== reqId.current) return
      setTorneos(ts || [])
      const ids = (ts || []).map(t => t.id)

      // 2) Sanciones activas
      let qs = supabase.from('sanciones').select('*').eq('activa', true).order('created_at', { ascending: false })
      if (!esAdmin) qs = ids.length ? qs.or(`tournament_id.in.(${ids.join(',')}),tournament_id.is.null`) : qs.is('tournament_id', null)
      const { data: ss, error: es } = await qs
      if (es) throw es
      let lista = (ss || []).filter(vigente)

      // Un organizador solo ve las sanciones globales de SUS jugadores
      let propios = null
      if (!esAdmin) {
        propios = new Set()
        if (ids.length) {
          const { data: regs } = await supabase.from('tournament_player_registrations').select('player_id').in('tournament_id', ids).eq('activo', true)
          ;(regs || []).forEach(r => propios.add(r.player_id))
        }
        lista = lista.filter(s => s.tournament_id || propios.has(s.player_id))
      }
      if (id !== reqId.current) return
      setSanciones(lista)

      // 3) Nombres de jugadores, equipos y partidos de las rojas
      await traerNombres(lista.map(s => s.player_id), lista.map(s => s.team_id))
      const mids = [...new Set(lista.map(s => s.match_id).filter(Boolean))]
      if (mids.length) {
        const mapa = {}
        for (let i = 0; i < mids.length; i += 100) {
          const { data: ms } = await supabase.from('matches').select('id,played_at,home:home_team_id(name),away:away_team_id(name)').in('id', mids.slice(i, i + 100))
          ;(ms || []).forEach(m => { mapa[m.id] = `${m.home?.name || '—'} vs ${m.away?.name || '—'}${m.played_at ? ' · ' + fmtFecha.format(new Date(m.played_at)) : ''}` })
        }
        if (id === reqId.current) setPartidosRoja(prev => ({ ...prev, ...mapa }))
      }
      await cargarSolicitudes()
    } catch (e) {
      if (id === reqId.current) setError(errorAmigable(e, 'No se pudieron cargar las suspensiones'))
    } finally {
      if (id === reqId.current) setCargando(false)
    }
  }

  async function cargarSolicitudes() {
    const { data, error: er } = await supabase.from('solicitudes_suspension').select('*').order('created_at', { ascending: false }).limit(200)
    if (er) {
      // Si todavía no se corrió la migración, el resto de la página sigue funcionando
      if (er.code === '42P01' || /does not exist|schema cache/i.test(er.message || '')) avisoMigracion('migracion_solicitudes_suspension.sql')
      setSolicitudesOk(false); setSolicitudes([])
      return
    }
    setSolicitudesOk(true)
    setSolicitudes(data || [])
    await traerNombres((data || []).map(s => s.player_id), [])
  }

  useEffect(() => { cargarTodo() }, [esAdmin, user?.id])

  // Al escoger torneo en el formulario, se traen sus jugadores inscritos
  useEffect(() => {
    setJugador(null); setBuscaJugador(''); setInscritos([])
    if (!formTorneo) return
    let vivo = true
    ;(async () => {
      setCargandoInscritos(true)
      const { data: regs } = await supabase.from('tournament_player_registrations').select('player_id,team_id').eq('tournament_id', formTorneo).eq('activo', true)
      const lista = regs || []
      const pids = [...new Set(lista.map(r => r.player_id))]
      const tids = [...new Set(lista.map(r => r.team_id).filter(Boolean))]
      const nom = {}, eq = {}
      for (let i = 0; i < pids.length; i += 150) {
        const { data } = await supabase.from('players').select('id,name').in('id', pids.slice(i, i + 150))
        ;(data || []).forEach(p => { nom[p.id] = p.name })
      }
      for (let i = 0; i < tids.length; i += 150) {
        const { data } = await supabase.from('teams').select('id,name').in('id', tids.slice(i, i + 150))
        ;(data || []).forEach(t => { eq[t.id] = t.name })
      }
      if (!vivo) return
      setInscritos(lista.filter(r => nom[r.player_id]).map(r => ({ player_id: r.player_id, name: nom[r.player_id], team_id: r.team_id, teamName: eq[r.team_id] || '' })).sort((a, b) => a.name.localeCompare(b.name)))
      setCargandoInscritos(false)
    })()
    return () => { vivo = false }
  }, [formTorneo])

  // Si solo hay un torneo, ya viene escogido
  useEffect(() => { if (!formTorneo && torneos.length === 1) setFormTorneo(torneos[0].id) }, [torneos])

  // ── Acciones sobre sanciones ──
  async function quitarSancion(s) {
    const nom = nombres[s.player_id] || 'el jugador'
    if (!(await confirmar(`¿Quitar la sanción de ${nom}? Podrá volver a jugar desde ya. Si fue un error, es lo correcto.`))) return
    const { error: er } = await supabase.from('sanciones').update({ activa: false }).eq('id', s.id)
    if (er) return notify(errorAmigable(er, 'No se pudo quitar la sanción'), 'error')
    notify('Sanción quitada ✓')
    setSanciones(prev => prev.filter(x => x.id !== s.id))
  }

  async function guardarCambios(cambios) {
    if (!editando) return
    setGuardando(true)
    const { error: er } = await supabase.from('sanciones').update(cambios).eq('id', editando.id)
    setGuardando(false)
    if (er) return notify(errorAmigable(er, 'No se pudo guardar'), 'error')
    notify('Sanción actualizada ✓')
    setSanciones(prev => prev.map(x => x.id === editando.id ? { ...x, ...cambios } : x))
    setEditando(null)
  }

  // ── Formulario: suspender / pedir suspensión ──
  const globalDirecto = esAdmin && alcance === 'todos'
  const esSolicitud = !esAdmin && alcance === 'todos'
  const porTiempo = alcance === 'todos' || tipoDuracion === 'tiempo'
  const yaSancionado = jugador && sanciones.some(s => s.player_id === jugador.player_id && (s.tournament_id === formTorneo || !s.tournament_id))
  const formValido = !!jugador && motivo.trim().length >= 3 && (porTiempo || Number(nPartidos || 0) >= 1)

  function cambiarAlcance(v) {
    setAlcance(v)
    setMesesForm(v === 'todos' ? 'indef' : '1') // un veto es definitivo salvo que se escoja otra cosa
  }

  function limpiarForm() {
    setJugador(null); setBuscaJugador(''); setMotivo(''); setNPartidos('1'); setMesesForm('1'); setTipoDuracion('partidos'); setAlcance('torneo')
  }

  async function enviarForm() {
    if (!formValido || guardando) return
    const nom = jugador.name
    if (yaSancionado && !(await confirmar(`¿Suspender de nuevo a ${nom}? Ya tiene una sanción activa. Se va a sumar otra aparte.`))) return
    setGuardando(true)
    try {
      if (esSolicitud) {
        const { error: er } = await supabase.from('solicitudes_suspension').insert({
          player_id: jugador.player_id, tournament_id: formTorneo || null, solicitante_id: user?.id,
          solicitante_nombre: miNombre, motivo: motivo.trim(), meses_sugeridos: mesesForm === 'indef' ? null : Number(mesesForm),
        })
        if (er) {
          const falta = er.code === '42P01' || /does not exist|schema cache/i.test(er.message || '')
          return notify(falta ? avisoMigracion('migracion_solicitudes_suspension.sql') : errorAmigable(er, 'No se pudo enviar la solicitud'), 'error')
        }
        notify('Solicitud enviada a Golmebol ✓')
        limpiarForm(); await cargarSolicitudes(); setVista('solicitudes')
        return
      }
      const fila = { player_id: jugador.player_id, tournament_id: globalDirecto ? null : formTorneo, motivo: motivo.trim(), activa: true }
      if (porTiempo) {
        fila.fecha_fin = mesesForm === 'indef' ? null : new Date(Date.now() + Number(mesesForm) * MES_MS).toISOString()
      } else {
        fila.partidos_pendientes = Number(nPartidos)
        fila.team_id = jugador.team_id || null
        fila.fecha_fin = null
      }
      const { error: er } = await supabase.from('sanciones').insert(fila)
      if (er) return notify(errorAmigable(er, 'No se pudo suspender'), 'error')
      notify(`${nom} suspendido ✓`)
      limpiarForm(); await cargarTodo(); setVista('lista')
    } finally {
      setGuardando(false)
    }
  }

  // ── Solicitudes: el administrador resuelve ──
  async function resolverSolicitud({ meses, respuesta }) {
    if (!resolviendo) return
    const { solicitud, modo } = resolviendo
    setGuardando(true)
    try {
      if (modo === 'aprobar') {
        const fecha_fin = meses ? new Date(Date.now() + meses * MES_MS).toISOString() : null
        const { error: er } = await supabase.from('sanciones').insert({
          player_id: solicitud.player_id, tournament_id: null, activa: true, fecha_fin,
          motivo: `Veto de Golmebol: ${solicitud.motivo} (pedido por ${solicitud.solicitante_nombre || 'un organizador'})`,
        })
        if (er) return notify(errorAmigable(er, 'No se pudo suspender al jugador'), 'error')
      }
      const { error: er2 } = await supabase.from('solicitudes_suspension').update({
        estado: modo === 'aprobar' ? 'aprobada' : 'rechazada', respuesta: respuesta || null, resuelta_por: user?.id || null, resuelta_at: new Date().toISOString(),
      }).eq('id', solicitud.id)
      if (er2) return notify(errorAmigable(er2, 'La suspensión quedó, pero no se pudo marcar la solicitud'), 'error')
      notify(modo === 'aprobar' ? 'Jugador vetado de Golmebol ✓' : 'Solicitud rechazada')
      setResolviendo(null)
      await cargarTodo()
    } finally {
      setGuardando(false)
    }
  }

  // ── Datos derivados ──
  const visibles = useMemo(() => {
    const t = sinTildes(busqueda.trim())
    return sanciones.filter(s => {
      if (filtroTorneo === 'global' ? !!s.tournament_id : filtroTorneo ? s.tournament_id !== filtroTorneo : false) return false
      if (filtroTipo === 'rojas' && !esRojaAuto(s)) return false
      if (filtroTipo === 'manuales' && esRojaAuto(s)) return false
      if (t && !sinTildes(nombres[s.player_id]).includes(t)) return false
      return true
    })
  }, [sanciones, filtroTorneo, filtroTipo, busqueda, nombres])
  const nRojas = sanciones.filter(esRojaAuto).length
  const pendientes = solicitudes.filter(s => s.estado === 'pendiente')

  const candidatos = useMemo(() => {
    const t = sinTildes(buscaJugador.trim())
    if (!t) return []
    return inscritos.filter(j => sinTildes(j.name).includes(t) || sinTildes(j.teamName).includes(t)).slice(0, 30)
  }, [inscritos, buscaJugador])

  // ── Piezas de pantalla (funciones, no componentes: así los campos no pierden el foco) ──
  function tarjetaSancion(s) {
    const nom = nombres[s.player_id] || 'Jugador'
    const roja = esRojaAuto(s)
    const global = !s.tournament_id
    const puedeEditar = esAdmin || !global
    return (
      <div key={s.id} style={{ background: '#fff', border: `1px solid ${roja ? '#f8d0cc' : '#e8eaed'}`, borderRadius: '16px', padding: '14px', boxShadow: '0 1px 3px rgba(0,0,0,.05)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '8px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: roja ? '#fce8e6' : '#f1f3f4', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {roja ? <span style={{ width: '14px', height: '19px', borderRadius: '3px', background: ROJO }}/> : <Ban size={20} color="#5f6368"/>}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: '900', fontSize: '1rem', color: '#202124', lineHeight: 1.25 }}>{nom}</div>
            <div style={{ fontSize: '.78rem', color: '#80868b', marginTop: '2px' }}>
              {s.team_id && equipos[s.team_id] ? `${equipos[s.team_id]} · ` : ''}{global ? 'Toda la plataforma' : nombreTorneo(s.tournament_id)}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
          {roja ? <Etiqueta bg="#fce8e6" color={ROJO}>🟥 Roja automática</Etiqueta> : <Etiqueta bg="#f1f3f4" color="#3c4043">✍️ Manual</Etiqueta>}
          {global && <Etiqueta bg="#ede7fb" color="#6c35de"><Globe size={11}/> Vetado de Golmebol</Etiqueta>}
          <Etiqueta bg="#fff4e0" color="#b45309"><Clock size={11}/> {duracionTexto(s)}</Etiqueta>
        </div>
        {s.match_id && partidosRoja[s.match_id] && <div style={{ fontSize: '.78rem', color: '#5f6368', marginBottom: '4px' }}>Partido: <b>{partidosRoja[s.match_id]}</b></div>}
        <div style={{ fontSize: '.8rem', color: '#5f6368', lineHeight: 1.4, marginBottom: '12px' }}>{s.motivo}</div>
        {puedeEditar ? (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => quitarSancion(s)} style={{ ...botonSec, flex: 1, minHeight: '44px', color: '#1e8e3e', borderColor: '#ceead6' }}>✓ Quitar sanción</button>
            <button onClick={() => setEditando(s)} style={{ ...botonSec, flex: 1, minHeight: '44px' }}>+ Más tiempo</button>
          </div>
        ) : (
          <div style={{ fontSize: '.74rem', color: '#80868b', background: '#f8f9fa', borderRadius: '10px', padding: '8px 10px' }}>Este jugador está vetado de toda la plataforma: solo Golmebol puede cambiarlo.</div>
        )}
      </div>
    )
  }

  function pantallaLista() {
    return (
      <>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
          <div style={{ position: 'relative', flex: '1 1 220px', minWidth: 0 }}>
            <Search size={16} color="#9aa0a6" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}/>
            <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar jugador…" style={{ ...inputBase, paddingLeft: '38px' }}/>
          </div>
          {(torneos.length > 1 || esAdmin) && (
            <select value={filtroTorneo} onChange={e => setFiltroTorneo(e.target.value)} style={{ ...inputBase, flex: '1 1 200px', width: 'auto' }}>
              <option value="">Todos los torneos</option>
              {esAdmin && <option value="global">Solo los vetados de Golmebol</option>}
              {torneos.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          )}
        </div>
        <div style={{ marginBottom: '14px' }}>
          <Segmentos valor={filtroTipo} onChange={setFiltroTipo} opciones={[
            { id: 'todas', texto: `Todas (${sanciones.length})` },
            { id: 'rojas', texto: `🟥 Por roja (${nRojas})` },
            { id: 'manuales', texto: `Manuales (${sanciones.length - nRojas})` },
          ]}/>
        </div>
        {visibles.length === 0 ? (
          <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '16px', padding: '36px 20px', textAlign: 'center', color: '#9aa0a6' }}>
            <Ban size={34} style={{ opacity: .35, marginBottom: '8px' }}/>
            <div style={{ fontSize: '.9rem', fontWeight: '700', color: '#5f6368' }}>{sanciones.length === 0 ? 'No hay jugadores suspendidos' : 'Nadie coincide con ese filtro'}</div>
            {sanciones.length === 0 && <div style={{ fontSize: '.8rem', marginTop: '4px' }}>Los expulsados con tarjeta roja aparecen aquí solos.</div>}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>{visibles.map(tarjetaSancion)}</div>
        )}
      </>
    )
  }

  function pantallaNueva() {
    if (torneos.length === 0 && !esAdmin) {
      return <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '16px', padding: '30px 20px', textAlign: 'center', color: '#80868b', fontSize: '.88rem' }}>Todavía no tienes torneos. Cuando crees uno podrás suspender a sus jugadores desde aquí.</div>
    }
    return (
      <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '16px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <label style={etiqueta}>1 · TORNEO</label>
          <select value={formTorneo} onChange={e => setFormTorneo(e.target.value)} style={inputBase}>
            <option value="">Escoge el torneo…</option>
            {torneos.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>

        <div>
          <label style={etiqueta}>2 · JUGADOR</label>
          {jugador ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#f6f9ff', border: '1.5px solid #c6dafc', borderRadius: '12px', padding: '10px 12px' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: '800', color: '#202124' }}>{jugador.name}</div>
                {jugador.teamName && <div style={{ fontSize: '.76rem', color: '#80868b' }}>{jugador.teamName}</div>}
              </div>
              <button onClick={() => setJugador(null)} style={{ ...botonSec, minHeight: '36px', padding: '0 12px', fontSize: '.78rem' }}>Cambiar</button>
            </div>
          ) : (
            <>
              <div style={{ position: 'relative' }}>
                <Search size={16} color="#9aa0a6" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}/>
                <input value={buscaJugador} onChange={e => setBuscaJugador(e.target.value)} disabled={!formTorneo} placeholder={formTorneo ? (cargandoInscritos ? 'Cargando jugadores…' : 'Escribe el nombre del jugador o su equipo') : 'Primero escoge el torneo'} style={{ ...inputBase, paddingLeft: '38px', background: formTorneo ? '#fff' : '#f6f7f8' }}/>
              </div>
              {candidatos.length > 0 && (
                <div style={{ marginTop: '8px', border: '1px solid #eceff1', borderRadius: '12px', overflow: 'hidden' }}>
                  {candidatos.map(j => (
                    <button key={j.player_id} type="button" onClick={() => { setJugador(j); setBuscaJugador('') }}
                      style={{ display: 'block', width: '100%', textAlign: 'left', padding: '11px 14px', minHeight: '48px', background: '#fff', border: 'none', borderBottom: '1px solid #f1f3f4', cursor: 'pointer', touchAction: 'manipulation' }}>
                      <span style={{ fontWeight: '700', color: '#202124', fontSize: '.92rem' }}>{j.name}</span>
                      {j.teamName && <span style={{ color: '#80868b', fontSize: '.76rem' }}> · {j.teamName}</span>}
                    </button>
                  ))}
                </div>
              )}
              {formTorneo && !cargandoInscritos && buscaJugador.trim() && candidatos.length === 0 && <div style={{ fontSize: '.78rem', color: '#9aa0a6', marginTop: '8px' }}>Nadie con ese nombre está inscrito en este torneo.</div>}
            </>
          )}
          {yaSancionado && <div style={{ marginTop: '8px', fontSize: '.78rem', color: '#b45309', background: '#fff4e0', borderRadius: '10px', padding: '8px 10px' }}>⚠️ Este jugador ya tiene una sanción activa. Mejor búscalo en “Suspendidos” si solo quieres darle más tiempo.</div>}
        </div>

        <div>
          <label style={etiqueta}>3 · ¿DÓNDE SE SUSPENDE?</label>
          <Segmentos valor={alcance} onChange={cambiarAlcance} opciones={[
            { id: 'torneo', texto: 'Solo en este torneo' },
            { id: 'todos', texto: esAdmin ? '🚫 Vetar de Golmebol' : '🚫 Pedir veto a Golmebol' },
          ]}/>
          {esSolicitud && <div style={{ fontSize: '.76rem', color: '#6c35de', background: '#f5f0ff', borderRadius: '10px', padding: '8px 10px', marginTop: '8px', lineHeight: 1.4 }}>Le mandas la solicitud a Golmebol con el motivo. Si la aprueba, el jugador queda vetado: no podrá jugar ningún torneo de Golmebol, ni de tu torneo ni de los demás.</div>}
          {globalDirecto && <div style={{ fontSize: '.76rem', color: ROJO, background: '#fdecea', borderRadius: '10px', padding: '8px 10px', marginTop: '8px', lineHeight: 1.4 }}>El jugador quedará vetado de toda la plataforma: no podrá jugar ningún torneo de Golmebol.</div>}
        </div>

        <div>
          <label style={etiqueta}>{esSolicitud ? '4 · DURACIÓN QUE SUGIERES' : alcance === 'todos' ? '4 · DURACIÓN DEL VETO' : '4 · DURACIÓN'}</label>
          {alcance === 'torneo' && (
            <div style={{ marginBottom: '10px' }}>
              <Segmentos valor={tipoDuracion} onChange={setTipoDuracion} opciones={[{ id: 'partidos', texto: 'Por partidos' }, { id: 'tiempo', texto: 'Por tiempo' }]}/>
            </div>
          )}
          {porTiempo ? (
            <select value={mesesForm} onChange={e => setMesesForm(e.target.value)} style={inputBase}>
              {alcance === 'todos' && <option value="indef">Indefinido (veto definitivo)</option>}
              {MESES.map(([m, t]) => <option key={m} value={m}>{t}</option>)}
              {alcance !== 'todos' && <option value="indef">Indefinida</option>}
            </select>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <CampoNumero value={nPartidos} onChange={setNPartidos} etiquetaAria="Partidos de suspensión"/>
              <span style={{ fontSize: '.84rem', color: '#5f6368' }}>partido{Number(nPartidos) !== 1 ? 's' : ''} sin jugar con su equipo</span>
            </div>
          )}
        </div>

        <div>
          <label style={etiqueta}>5 · MOTIVO {esSolicitud ? '(Golmebol lo va a leer)' : ''}</label>
          <textarea value={motivo} onChange={e => setMotivo(e.target.value)} rows={3} placeholder="Ej: agresión a un árbitro en la jornada 5" style={{ ...inputBase, padding: '12px 14px', resize: 'vertical' }}/>
        </div>

        <button onClick={enviarForm} disabled={!formValido || guardando}
          style={{ ...botonPrim(esSolicitud ? '#6c35de' : ROJO, !formValido || guardando), width: '100%', minHeight: '52px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          {guardando ? 'Guardando…' : esSolicitud ? <><Send size={16}/> Enviar solicitud a Golmebol</> : <><Ban size={16}/> {globalDirecto ? 'Vetar de Golmebol' : 'Suspender jugador'}</>}
        </button>
      </div>
    )
  }

  function tarjetaSolicitud(s) {
    const nom = nombres[s.player_id] || 'Jugador'
    const est = { pendiente: ['#fff4e0', '#b45309', '⏳ Pendiente'], aprobada: ['#e6f4ea', '#1e8e3e', '✓ Aprobada'], rechazada: ['#f1f3f4', '#5f6368', 'Rechazada'] }[s.estado] || ['#f1f3f4', '#5f6368', s.estado]
    return (
      <div key={s.id} style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '16px', padding: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '6px' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: '900', color: '#202124' }}>{nom}</div>
            <div style={{ fontSize: '.76rem', color: '#80868b' }}>
              {s.tournament_id ? `Desde ${nombreTorneo(s.tournament_id)} · ` : ''}{esAdmin ? `Pide: ${s.solicitante_nombre || 'organizador'} · ` : ''}{fmtFecha.format(new Date(s.created_at))}
            </div>
          </div>
          <Etiqueta bg={est[0]} color={est[1]}>{est[2]}</Etiqueta>
        </div>
        <div style={{ fontSize: '.82rem', color: '#3c4043', lineHeight: 1.45 }}>{s.motivo}</div>
        {s.meses_sugeridos != null && <div style={{ fontSize: '.74rem', color: '#80868b', marginTop: '4px' }}>Duración sugerida: {s.meses_sugeridos} mes{s.meses_sugeridos !== 1 ? 'es' : ''}</div>}
        {s.respuesta && <div style={{ fontSize: '.78rem', color: '#5f6368', background: '#f8f9fa', borderRadius: '10px', padding: '8px 10px', marginTop: '8px' }}><b>Respuesta:</b> {s.respuesta}</div>}
        {esAdmin && s.estado === 'pendiente' && (
          <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
            <button onClick={() => setResolviendo({ solicitud: s, modo: 'aprobar' })} style={{ ...botonPrim(ROJO), flex: 1, minHeight: '44px' }}>Aprobar</button>
            <button onClick={() => setResolviendo({ solicitud: s, modo: 'rechazar' })} style={{ ...botonSec, flex: 1, minHeight: '44px' }}>Rechazar</button>
          </div>
        )}
      </div>
    )
  }

  function pantallaSolicitudes() {
    if (!solicitudesOk) {
      return <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '16px', padding: '30px 20px', textAlign: 'center', color: '#80868b', fontSize: '.88rem' }}>Las solicitudes todavía no están activadas en tu cuenta. Avísale al administrador de Golmebol.</div>
    }
    if (solicitudes.length === 0) {
      return (
        <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '16px', padding: '36px 20px', textAlign: 'center', color: '#9aa0a6' }}>
          <Globe size={34} style={{ opacity: .35, marginBottom: '8px' }}/>
          <div style={{ fontSize: '.9rem', fontWeight: '700', color: '#5f6368' }}>{esAdmin ? 'No hay solicitudes de veto' : 'No has pedido ningún veto a Golmebol'}</div>
          {!esAdmin && <div style={{ fontSize: '.8rem', marginTop: '4px' }}>Se piden desde “Suspender jugador”, escogiendo “Pedir veto a Golmebol”.</div>}
        </div>
      )
    }
    return <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>{solicitudes.map(tarjetaSolicitud)}</div>
  }

  return (
    <div style={{ maxWidth: '760px', margin: '0 auto' }}>
      <div style={{ marginBottom: '16px' }}>
        <h1 style={{ fontSize: '1.25rem', fontWeight: '800', color: '#202124', margin: 0 }}>Suspensiones</h1>
        <p style={{ color: '#5f6368', margin: '4px 0 0', fontSize: '.875rem', lineHeight: 1.4 }}>
          {esAdmin ? 'Suspendidos por torneo y vetados de la plataforma.' : 'Los jugadores suspendidos de tus torneos. Solo mandas sobre los de tus torneos; para vetar a alguien de toda la plataforma, se lo pides a Golmebol.'}
        </p>
      </div>

      <div style={{ marginBottom: '14px' }}>
        <Segmentos valor={vista} onChange={setVista} opciones={[
          { id: 'lista', texto: `Suspendidos${sanciones.length ? ` (${sanciones.length})` : ''}` },
          { id: 'nueva', texto: 'Suspender jugador' },
          { id: 'solicitudes', texto: esAdmin ? `Solicitudes${pendientes.length ? ` (${pendientes.length})` : ''}` : 'Mis solicitudes' },
        ]}/>
      </div>

      {error ? (
        <div style={{ background: '#fff', border: '1px solid #f4c7c3', borderRadius: '16px', padding: '28px 20px', textAlign: 'center' }}>
          <div style={{ color: ROJO, fontWeight: '800', fontSize: '.9rem', marginBottom: '4px' }}>{error}</div>
          <button onClick={() => { setCargando(true); cargarTodo() }} style={{ ...botonPrim(AZUL), marginTop: '10px' }}>Reintentar</button>
        </div>
      ) : cargando ? (
        <div style={{ textAlign: 'center', color: '#9aa0a6', padding: '40px', fontSize: '.9rem' }}>Cargando…</div>
      ) : (
        <>
          {vista === 'lista' && pantallaLista()}
          {vista === 'nueva' && pantallaNueva()}
          {vista === 'solicitudes' && pantallaSolicitudes()}
        </>
      )}

      {editando && <ModalEditar sancion={editando} nombre={nombres[editando.player_id] || 'Jugador'} guardando={guardando} onGuardar={guardarCambios} onClose={() => !guardando && setEditando(null)}/>}
      {resolviendo && <ModalResolver solicitud={resolviendo.solicitud} nombre={nombres[resolviendo.solicitud.player_id] || 'Jugador'} modo={resolviendo.modo} guardando={guardando} onConfirmar={resolverSolicitud} onClose={() => !guardando && setResolviendo(null)}/>}
    </div>
  )
}
