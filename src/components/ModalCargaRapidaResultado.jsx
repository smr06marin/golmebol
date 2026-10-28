import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { conPlayers } from '../lib/planillaJugadores'
import { resolverPrediccionesPartido } from '../lib/predix'
import { limpiarStatsObsoletas } from '../lib/statsPartido'
import { necesitaPreguntarPenales, eliminacionDirecta } from '../lib/penales'

// Carga rápida de resultado — pensada para el ORGANIZADOR, para cuando el
// árbitro no llenó ninguna planilla y hay que meter los datos a mano desde
// cero: solo la lista de jugadores de cada equipo, goles y tarjetas por
// jugador. Nada de colores, números de camiseta, cronómetro ni eventos en
// vivo (eso ya lo tiene PlanillaRapida, pensada para llenarse DURANTE el
// partido) — acá se escribe todo de una sola vez, después del partido.
//
// Guarda en los mismos destinos que las otras planillas (match_events,
// player_match_stats, matches, sanciones, predicciones) para que el resto
// de la plataforma (historial, récords, deuda de tarjetas, apuestas Predix)
// vea el partido exactamente igual que si lo hubiera llenado un árbitro.
// No pide número de camiseta ni arquero — eso solo lo necesita la planilla
// completa (valla/récords de portero); acá es nomás goles y tarjetas.
//
// Un jugador "sin registro" (todavía sin cédula) NO se crea como jugador
// real de Golmebol — eso rompería el registro formal, que exige cédula.
// Solo queda anotado su nombre en el detalle del partido (para que el gol o
// la tarjeta sí cuenten en el resultado y en el historial), y al guardar
// se avisa que falta registrarlo para que sus estadísticas individuales
// (goleador, deuda de tarjetas, etc.) empiecen a contar.

const COLOR_TARJETA = { amarilla: '#f9a825', azul: '#1a73e8', roja: '#d93025' }
const NOMBRE_TARJETA = { amarilla: 'Amarilla', azul: 'Azul', roja: 'Roja' }

// Una tarjeta dibujada (no emoji: se ve igual en iPhone y en cualquier Android)
function Tarjetita({ tipo, activa, disabled, onClick }) {
  const color = COLOR_TARJETA[tipo]
  return (
    <button type="button" disabled={disabled} onClick={onClick} aria-pressed={activa} title={`Tarjeta ${NOMBRE_TARJETA[tipo].toLowerCase()}`}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '3px',
        minWidth: '52px', height: '48px', padding: '0 6px', borderRadius: '10px', cursor: disabled ? 'default' : 'pointer',
        border: `1.5px solid ${activa ? color : '#e3e6ea'}`, background: activa ? `${color}1f` : '#fff',
        opacity: disabled ? .45 : 1, touchAction: 'manipulation', flexShrink: 0,
      }}>
      <span style={{ width: '14px', height: '19px', borderRadius: '3px', background: color, opacity: activa ? 1 : .35, boxShadow: activa ? `0 1px 3px ${color}88` : 'none' }}/>
      <span style={{ fontSize: '.58rem', fontWeight: '800', color: activa ? '#202124' : '#9aa0a6', letterSpacing: '.02em' }}>{NOMBRE_TARJETA[tipo]}</span>
    </button>
  )
}

// Goles: se escribe con el teclado numérico del celular. Se pueden borrar los
// dígitos mientras se escribe, y si se deja en blanco vale 0. Letra de 16px o
// más: con menos, el iPhone hace zoom al tocar el campo.
function CampoGoles({ value, onChange, disabled }) {
  const n = Number(value || 0)
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
      <span style={{ fontSize: '.7rem', fontWeight: '800', color: '#5f6368', letterSpacing: '.03em' }}>GOLES</span>
      <input type="text" inputMode="numeric" pattern="[0-9]*" autoComplete="off" maxLength={2}
        disabled={disabled} value={String(value ?? '')}
        onFocus={e => e.target.select()}
        onChange={e => onChange(e.target.value.replace(/\D/g, '').slice(0, 2))}
        onBlur={e => { if (e.target.value === '') onChange('0') }}
        style={{
          width: '56px', height: '48px', textAlign: 'center', fontSize: '1.25rem', fontWeight: '900', boxSizing: 'border-box',
          color: disabled ? '#c9cdd1' : n > 0 ? '#1a73e8' : '#202124', background: disabled ? '#f6f7f8' : '#fff',
          border: `1.5px solid ${n > 0 && !disabled ? '#1a73e8' : '#dadce0'}`, borderRadius: '10px', outline: 'none',
        }}/>
    </label>
  )
}

function Check({ marcado, onClick, titulo }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={marcado} title={titulo}
      style={{
        width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0, cursor: 'pointer', padding: 0,
        border: `2px solid ${marcado ? '#1a73e8' : '#c9cdd1'}`, background: marcado ? '#1a73e8' : '#fff',
        color: '#fff', fontSize: '.85rem', fontWeight: '900', display: 'flex', alignItems: 'center', justifyContent: 'center', touchAction: 'manipulation',
      }}>{marcado ? '✓' : ''}</button>
  )
}

const tarjetaJugador = (destacado, apagado) => ({
  padding: '12px', borderRadius: '14px', marginBottom: '8px',
  border: `1px solid ${destacado ? '#c6dafc' : '#eceff1'}`, background: destacado ? '#f6f9ff' : '#fff',
  opacity: apagado ? .5 : 1,
})

// IMPORTANTE: estos componentes van declarados FUERA de ModalCargaRapidaResultado
// (a nivel de módulo), no adentro. Si se declaran adentro, cada tecla vuelve a
// crear la función y React desmonta/remonta toda la lista, botando el foco del
// campo apenas se escribe un carácter.
function Columna({ roster, extras, esLocal, filas, cambiar, cambiarExtra, quitarExtra, agregarExtra, sinGoles }) {
  const jugaron = roster.filter(j => (filas[j.id] || { jugo: true }).jugo).length
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '2px 2px 10px' }}>
        <span style={{ fontSize: '.74rem', fontWeight: '800', color: '#5f6368', letterSpacing: '.04em' }}>
          {roster.length > 0 ? `JUGARON ${jugaron} DE ${roster.length}` : 'SIN JUGADORES'}
        </span>
        {roster.length > 0 && <span style={{ fontSize: '.72rem', color: '#9aa0a6' }}>Toca el círculo si NO jugó</span>}
      </div>
      {roster.length === 0 && extras.length === 0 && (
        <div style={{ fontSize: '.82rem', color: '#9aa0a6', padding: '14px', textAlign: 'center', background: '#f8f9fa', borderRadius: '12px', marginBottom: '10px' }}>
          Este equipo no tiene jugadores inscritos en el torneo. Agrega abajo a quien jugó.
        </div>
      )}
      {roster.map(j => {
        const f = filas[j.id] || { jugo: true, goles: 0, amarilla: false, azul: false, roja: false }
        const destacado = f.jugo && ((!sinGoles && Number(f.goles || 0) > 0) || f.amarilla || f.azul || f.roja)
        return (
          <div key={j.id} style={tarjetaJugador(destacado, !f.jugo)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: f.jugo ? '10px' : 0 }}>
              <Check marcado={f.jugo} onClick={() => cambiar(j.id, 'jugo', !f.jugo)} titulo="¿Jugó este partido?"/>
              <span style={{ flex: 1, minWidth: 0, fontSize: '.95rem', fontWeight: '700', color: '#202124', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{j.name}</span>
              {!f.jugo && <span style={{ fontSize: '.7rem', color: '#9aa0a6', fontWeight: '700' }}>No jugó</span>}
            </div>
            {f.jugo && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', paddingLeft: '38px' }}>
                {!sinGoles && <CampoGoles value={f.goles} onChange={v => cambiar(j.id, 'goles', v)}/>}
                <div style={{ display: 'flex', gap: '6px' }}>
                  <Tarjetita tipo="amarilla" activa={f.amarilla} onClick={() => cambiar(j.id, 'amarilla', !f.amarilla)}/>
                  <Tarjetita tipo="azul" activa={f.azul} onClick={() => cambiar(j.id, 'azul', !f.azul)}/>
                  <Tarjetita tipo="roja" activa={f.roja} onClick={() => cambiar(j.id, 'roja', !f.roja)}/>
                </div>
              </div>
            )}
          </div>
        )
      })}

      {/* Jugadores sin registro (todavía sin cédula): solo se anota el nombre
          acá — NO se crea como jugador de Golmebol. Solo sirve para que el gol
          o la tarjeta cuenten en este partido; hay que registrarlo formalmente
          después para que aparezca en goleadores y deuda de tarjetas. */}
      {extras.map(e => (
        <div key={e.tempId} style={{ ...tarjetaJugador(true, false), background: '#fffaf2', border: '1px solid #fde1b8' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <input type="text" value={e.nombre} onChange={ev => cambiarExtra(esLocal, e.tempId, 'nombre', ev.target.value)} placeholder="Nombre del jugador sin registro"
              style={{ flex: 1, minWidth: 0, height: '44px', padding: '0 12px', border: '1.5px solid #dadce0', borderRadius: '10px', fontSize: '1rem', boxSizing: 'border-box', outline: 'none' }}/>
            <button type="button" onClick={() => quitarExtra(esLocal, e.tempId)} title="Quitar" aria-label="Quitar jugador"
              style={{ background: '#fff', border: '1px solid #fad2cf', borderRadius: '10px', color: '#d93025', cursor: 'pointer', flexShrink: 0, width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={18}/></button>
          </div>
          <div style={{ fontSize: '.68rem', color: '#b45309', marginBottom: '10px', lineHeight: 1.4 }}>Sin registro (falta cédula): solo cuenta para este partido. Regístralo después para que sus estadísticas cuenten.</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {!sinGoles && <CampoGoles value={e.goles} onChange={v => cambiarExtra(esLocal, e.tempId, 'goles', v)}/>}
            <div style={{ display: 'flex', gap: '6px' }}>
              <Tarjetita tipo="amarilla" activa={e.amarilla} onClick={() => cambiarExtra(esLocal, e.tempId, 'amarilla', !e.amarilla)}/>
              <Tarjetita tipo="azul" activa={e.azul} onClick={() => cambiarExtra(esLocal, e.tempId, 'azul', !e.azul)}/>
              <Tarjetita tipo="roja" activa={e.roja} onClick={() => cambiarExtra(esLocal, e.tempId, 'roja', !e.roja)}/>
            </div>
          </div>
        </div>
      ))}

      <button type="button" onClick={() => agregarExtra(esLocal)}
        style={{ marginTop: '4px', background: '#fff', border: '1.5px dashed #b6c8e8', borderRadius: '12px', padding: '12px', cursor: 'pointer', color: '#1a73e8', fontSize: '.85rem', fontWeight: '800', width: '100%', minHeight: '46px' }}>
        + Agregar jugador sin registro
      </button>
    </div>
  )
}

export default function ModalCargaRapidaResultado({ partido, onClose, onGuardado }) {
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const guardandoRef = useRef(false)
  const [rosterLocal, setRosterLocal] = useState([])
  const [rosterVis, setRosterVis] = useState([])
  const [filas, setFilas] = useState({}) // player_id -> { jugo, goles, amarilla, azul, roja }
  // Jugadores sin registro que se van agregando a mano en esta pantalla (por
  // ahora solo con nombre, sin id real — nunca se crean como jugador real).
  const [extrasLocal, setExtrasLocal] = useState([])
  const [extrasVis, setExtrasVis] = useState([])
  const extraIdRef = useRef(0)
  const [equipoActivo, setEquipoActivo] = useState('local') // pestaña visible: 'local' | 'vis'
  // Marcador: 'auto' = se suma de los goles de cada jugador; 'manual' = se escribe
  // directo (ej. 3-0 cuando no se quiere anotar a ningún goleador).
  const [modoMarcador, setModoMarcador] = useState('auto')
  const [manualLocal, setManualLocal] = useState('0')
  const [manualVis, setManualVis] = useState('0')
  // Penales (solo se pide cuando el marcador queda empatado)
  const [penHubo, setPenHubo] = useState(false)
  const [penLocal, setPenLocal] = useState('')
  const [penVis, setPenVis] = useState('')
  // Nota del partido (se guarda como informe tipo "otro")
  const [nota, setNota] = useState('')
  const notaInicialRef = useRef('')

  useEffect(() => {
    let cancelado = false
    async function cargar() {
      setCargando(true)
      // OJO: la lista tiene que salir de tournament_player_registrations
      // (filtrada por tournament_id Y team_id), NO de team_players — esa
      // trae TODOS los jugadores que alguna vez se metieron a ese equipo,
      // en cualquier torneo/categoría (ej: un equipo que juega el 2018-2019
      // Y el 2016-2017 comparte fila en "teams", pero cada categoría tiene
      // su propia inscripción de jugadores). Con team_players salían
      // mezclados los de todas las categorías del equipo en vez de solo
      // los inscritos en ESTE torneo — el mismo patrón que ya usan bien
      // PlanillaPartido.jsx y PlanillaRapida.jsx.
      const [{ data: tpLocal }, { data: tpVis }, { data: statsExistentes }, { data: eventosSinRegistro }] = await Promise.all([
        conPlayers(supabase.from('tournament_player_registrations').select('player_id').eq('tournament_id', partido.tournament_id).eq('team_id', partido.home_team_id).eq('activo', true), 'id,name'),
        conPlayers(supabase.from('tournament_player_registrations').select('player_id').eq('tournament_id', partido.tournament_id).eq('team_id', partido.away_team_id).eq('activo', true), 'id,name'),
        supabase.from('player_match_stats').select('*').eq('match_id', partido.id),
        supabase.from('match_events').select('team_id, player_nombre, event_type').eq('match_id', partido.id).is('player_id', null).not('player_nombre', 'is', null),
      ])
      if (cancelado) return
      const local = (tpLocal || []).map(t => t.players).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name))
      const vis = (tpVis || []).map(t => t.players).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name))
      setRosterLocal(local)
      setRosterVis(vis)

      // Si ya había estadísticas guardadas (se está corrigiendo un partido ya
      // cargado), se precargan los valores en vez de arrancar en blanco.
      const statsPorJugador = new Map((statsExistentes || []).map(s => [s.player_id, s]))
      const f = {}
      ;[...local, ...vis].forEach(j => {
        const s = statsPorJugador.get(j.id)
        f[j.id] = s
          ? { jugo: true, goles: s.goals_scored || 0, amarilla: (s.yellow_cards || 0) > 0, azul: (s.blue_cards || 0) > 0, roja: (s.red_cards || 0) > 0 }
          : { jugo: (statsExistentes || []).length === 0, goles: 0, amarilla: false, azul: false, roja: false }
      })
      setFilas(f)

      // Los jugadores "sin registro" que ya se habían anotado en una carga
      // anterior de este mismo partido (quedaron como eventos sueltos, sin
      // player_id) se recuperan acá para que no desaparezcan al reabrir.
      const porNombre = new Map()
      ;(eventosSinRegistro || []).forEach(ev => {
        const key = `${ev.team_id}|${ev.player_nombre}`
        if (!porNombre.has(key)) porNombre.set(key, { team_id: ev.team_id, nombre: ev.player_nombre, goles: 0, amarilla: false, azul: false, roja: false })
        const g = porNombre.get(key)
        if (ev.event_type === 'goal') g.goles += 1
        else if (ev.event_type === 'yellow_card') g.amarilla = true
        else if (ev.event_type === 'blue_card') g.azul = true
        else if (ev.event_type === 'red_card') g.roja = true
      })
      const preLocal = [], preVis = []
      porNombre.forEach(g => {
        extraIdRef.current += 1
        const fila = { tempId: extraIdRef.current, nombre: g.nombre, goles: g.goles, amarilla: g.amarilla, azul: g.azul, roja: g.roja }
        ;(g.team_id === partido.home_team_id ? preLocal : preVis).push(fila)
      })
      setExtrasLocal(preLocal)
      setExtrasVis(preVis)

      // Partido ya cerrado con marcador pero sin goleadores anotados: se abre en
      // modo "escribir marcador" con ese resultado, para no mostrarlo como 0-0.
      const sumaGoles = (statsExistentes || []).reduce((a, st) => a + (st.goals_scored || 0), 0)
        + [...preLocal, ...preVis].reduce((a, e) => a + (e.goles || 0), 0)
      if (partido.status === 'finished' && sumaGoles === 0 && (Number(partido.home_score || 0) + Number(partido.away_score || 0)) > 0) {
        setModoMarcador('manual')
        setManualLocal(String(partido.home_score || 0))
        setManualVis(String(partido.away_score || 0))
      }
      if (partido.penales_ganador) {
        setPenHubo(true)
        setPenLocal(String(partido.penales_local ?? ''))
        setPenVis(String(partido.penales_visitante ?? ''))
      }
      try {
        const { data: inf } = await supabase.from('match_informes').select('descripcion').eq('match_id', partido.id).eq('tipo', 'otro').limit(1)
        if (!cancelado && inf?.[0]?.descripcion) { setNota(inf[0].descripcion); notaInicialRef.current = inf[0].descripcion }
      } catch { /* sin nota previa */ }
      if (cancelado) return
      setCargando(false)
    }
    cargar()
    return () => { cancelado = true }
  }, [partido.id, partido.home_team_id, partido.away_team_id])

  function cambiar(playerId, campo, valor) {
    setFilas(prev => ({ ...prev, [playerId]: { ...prev[playerId], [campo]: valor } }))
  }

  function agregarExtra(esLocal) {
    extraIdRef.current += 1
    const nueva = { tempId: extraIdRef.current, nombre: '', goles: 0, amarilla: false, azul: false, roja: false }
    ;(esLocal ? setExtrasLocal : setExtrasVis)(prev => [...prev, nueva])
  }
  function cambiarExtra(esLocal, tempId, campo, valor) {
    ;(esLocal ? setExtrasLocal : setExtrasVis)(prev => prev.map(e => e.tempId === tempId ? { ...e, [campo]: valor } : e))
  }
  function quitarExtra(esLocal, tempId) {
    ;(esLocal ? setExtrasLocal : setExtrasVis)(prev => prev.filter(e => e.tempId !== tempId))
  }

  const esManual = modoMarcador === 'manual'
  const sumaLocal = rosterLocal.reduce((a, j) => a + (filas[j.id]?.jugo ? Number(filas[j.id]?.goles || 0) : 0), 0)
    + extrasLocal.reduce((a, e) => a + (e.nombre.trim() ? Number(e.goles || 0) : 0), 0)
  const sumaVis = rosterVis.reduce((a, j) => a + (filas[j.id]?.jugo ? Number(filas[j.id]?.goles || 0) : 0), 0)
    + extrasVis.reduce((a, e) => a + (e.nombre.trim() ? Number(e.goles || 0) : 0), 0)
  const golesLocal = esManual ? Number(manualLocal || 0) : sumaLocal
  const golesVis = esManual ? Number(manualVis || 0) : sumaVis
  const empatado = golesLocal === golesVis
  const penGanador = penLocal !== '' && penVis !== '' && Number(penLocal) !== Number(penVis)
    ? (Number(penLocal) > Number(penVis) ? 'home' : 'away') : null

  async function guardar() {
    if (guardandoRef.current) return
    const manual = esManual
    // Penales: solo cuentan si el partido quedó empatado y se marcó que hubo tanda
    const hayPenales = empatado && penHubo
    if (hayPenales && !penGanador) {
      alert('Escribe los penales de cada equipo. No pueden quedar iguales ni vacíos: alguien tiene que ganar la tanda.')
      return
    }
    if (empatado && !penHubo && necesitaPreguntarPenales({ fase: partido.fase, golesLocal, golesVis, globalLlave: null, eliminacion: eliminacionDirecta(partido) })) {
      if (!window.confirm('Este partido es de eliminatoria y quedó empatado, pero no marcaste penales.\n\nSin penales no se sabe qué equipo avanza.\n\n¿Guardar de todas formas sin penales?')) return
    }
    guardandoRef.current = true
    setGuardando(true)
    const erroresGuardado = []
    try {
      // Si el partido ya estaba cerrado, esto es una corrección — se deja
      // registrado quién la hizo, igual que en las otras planillas.
      if (partido.status === 'finished') {
        try {
          const { data: { user } } = await supabase.auth.getUser()
          let editorName = user?.email || 'Desconocido'
          if (user?.id) { const { data: pRow } = await supabase.from('players').select('name').eq('user_id', user.id).maybeSingle(); if (pRow?.name) editorName = pRow.name }
          await supabase.from('match_edit_log').insert({ match_id: partido.id, editor_user_id: user?.id || null, editor_name: editorName, editor_email: user?.email || null })
        } catch (e) { /* no bloquea el guardado */ }
      }

      const todos = [
        ...rosterLocal.map(j => ({ j, team_id: partido.home_team_id, esLocal: true })),
        ...rosterVis.map(j => ({ j, team_id: partido.away_team_id, esLocal: false })),
      ].filter(({ j }) => filas[j.id]?.jugo)

      // Eventos individuales (uno por gol y por tarjeta) — para que el
      // historial de movimientos y tarjetas del torneo vea este partido
      // igual que cualquier otro.
      const eventosDB = []
      todos.forEach(({ j, team_id }) => {
        const f = filas[j.id]
        for (let i = 0; i < (manual ? 0 : Number(f.goles || 0)); i++) eventosDB.push({ match_id: partido.id, tournament_id: partido.tournament_id, team_id, player_id: j.id, event_type: 'goal', minute: null, periodo: 1 })
        if (f.amarilla) eventosDB.push({ match_id: partido.id, tournament_id: partido.tournament_id, team_id, player_id: j.id, event_type: 'yellow_card', minute: null, periodo: 1 })
        if (f.azul) eventosDB.push({ match_id: partido.id, tournament_id: partido.tournament_id, team_id, player_id: j.id, event_type: 'blue_card', minute: null, periodo: 1 })
        if (f.roja) eventosDB.push({ match_id: partido.id, tournament_id: partido.tournament_id, team_id, player_id: j.id, event_type: 'red_card', minute: null, periodo: 1 })
      })

      // Jugadores SIN registro: no se crean en Golmebol (no tienen cédula
      // todavía) — quedan solo como eventos sueltos con el nombre escrito a
      // mano (sin player_id), para que sus goles/tarjetas SÍ cuenten en el
      // marcador y en el historial de movimientos del partido, pero sin
      // aparecer como jugador real hasta que alguien los registre bien.
      const nombresSinRegistro = []
      const agregarExtrasAEventos = (lista, team_id) => {
        lista.forEach(e => {
          const nombreLimpio = e.nombre.trim()
          if (!nombreLimpio) return
          nombresSinRegistro.push(nombreLimpio)
          for (let i = 0; i < (manual ? 0 : Number(e.goles || 0)); i++) eventosDB.push({ match_id: partido.id, tournament_id: partido.tournament_id, team_id, player_id: null, player_nombre: nombreLimpio, event_type: 'goal', minute: null, periodo: 1 })
          if (e.amarilla) eventosDB.push({ match_id: partido.id, tournament_id: partido.tournament_id, team_id, player_id: null, player_nombre: nombreLimpio, event_type: 'yellow_card', minute: null, periodo: 1 })
          if (e.azul) eventosDB.push({ match_id: partido.id, tournament_id: partido.tournament_id, team_id, player_id: null, player_nombre: nombreLimpio, event_type: 'blue_card', minute: null, periodo: 1 })
          if (e.roja) eventosDB.push({ match_id: partido.id, tournament_id: partido.tournament_id, team_id, player_id: null, player_nombre: nombreLimpio, event_type: 'red_card', minute: null, periodo: 1 })
        })
      }
      agregarExtrasAEventos(extrasLocal, partido.home_team_id)
      agregarExtrasAEventos(extrasVis, partido.away_team_id)

      await supabase.from('match_events').delete().eq('match_id', partido.id)
      if (eventosDB.length > 0) {
        let { error } = await supabase.from('match_events').insert(eventosDB)
        if (error && (error.message || '').includes('player_nombre')) {
          ;({ error } = await supabase.from('match_events').insert(eventosDB.map(({ player_nombre, ...e }) => e)))
        }
        if (error) erroresGuardado.push('Eventos: ' + error.message)
      }

      const updatePartido = {
        home_score: golesLocal, away_score: golesVis, status: 'finished',
        penales_local: hayPenales ? Number(penLocal) : null,
        penales_visitante: hayPenales ? Number(penVis) : null,
        penales_ganador: hayPenales ? penGanador : null,
      }
      let { error: errPartido } = await supabase.from('matches').update(updatePartido).eq('id', partido.id)
      // Si todavía no se corrió la migración de penales, se guarda el resultado igual
      if (errPartido && (errPartido.message || '').includes('penales')) {
        const { penales_local, penales_visitante, penales_ganador, ...sinPenales } = updatePartido
        ;({ error: errPartido } = await supabase.from('matches').update(sinPenales).eq('id', partido.id))
        if (!errPartido && hayPenales) alert('El resultado se guardó, pero los penales NO (falta correr la migración de penales en Supabase).')
      }
      if (errPartido) erroresGuardado.push('Resultado: ' + errPartido.message)

      // Nota del partido: se guarda como informe. Si no cambió desde que se abrió, no se repite.
      const notaLimpia = nota.trim()
      if (notaLimpia.length >= 3 && notaLimpia !== notaInicialRef.current.trim()) {
        try {
          const { data: { user } } = await supabase.auth.getUser()
          let creadoPor = user?.email || null
          if (user?.id) { const { data: pRow } = await supabase.from('players').select('name').eq('user_id', user.id).maybeSingle(); if (pRow?.name) creadoPor = pRow.name }
          const { error: errNota } = await supabase.from('match_informes').insert({ match_id: partido.id, tournament_id: partido.tournament_id, tipo: 'otro', descripcion: notaLimpia, creado_por: creadoPor })
          if (errNota) erroresGuardado.push('Nota: ' + errNota.message)
        } catch (e) { erroresGuardado.push('Nota: no se pudo guardar') }
      }

      const calcResultado = (gF, gC) => gF > gC ? 'win' : gF === gC ? 'draw' : 'loss'
      const statsRows = todos.map(({ j, team_id, esLocal }) => {
        const f = filas[j.id]
        const gF = esLocal ? golesLocal : golesVis
        const gC = esLocal ? golesVis : golesLocal
        return {
          match_id: partido.id, tournament_id: partido.tournament_id, player_id: j.id, team_id,
          numero_camiseta: null,
          goals_scored: manual ? 0 : Number(f.goles || 0), goals_conceded: 0,
          fue_arquero: false, own_goals: 0,
          yellow_cards: f.amarilla ? 1 : 0, blue_cards: f.azul ? 1 : 0, red_cards: f.roja ? 1 : 0,
          fouls: 0, team_result: calcResultado(gF, gC),
        }
      })
      if (statsRows.length > 0) {
        const { error } = await supabase.from('player_match_stats').upsert(statsRows, { onConflict: 'match_id,player_id' })
        if (error) erroresGuardado.push('Estadísticas: ' + error.message)
        else await limpiarStatsObsoletas(partido.id, statsRows.map(r => r.player_id))
      }

      // Sanción automática por tarjeta roja — mismo criterio que las otras
      // planillas (mínimo 1 fecha, el organizador la puede extender después).
      try {
        const equiposPartido = [partido.home_team_id, partido.away_team_id].filter(Boolean)
        if (partido.status !== 'finished' && equiposPartido.length > 0) {
          const { data: pendientes } = await supabase.from('sanciones').select('id, partidos_pendientes')
            .eq('activa', true).not('partidos_pendientes', 'is', null).gt('partidos_pendientes', 0).in('team_id', equiposPartido)
          for (const s of (pendientes || [])) {
            const restante = (s.partidos_pendientes || 1) - 1
            await supabase.from('sanciones').update({ partidos_pendientes: restante, activa: restante > 0 }).eq('id', s.id)
          }
        }
        const conRoja = statsRows.filter(r => r.red_cards > 0)
        if (conRoja.length > 0) {
          const { data: yaExisten } = await supabase.from('sanciones').select('player_id').eq('match_id', partido.id).in('player_id', conRoja.map(r => r.player_id))
          const idsConSancion = new Set((yaExisten || []).map(s => s.player_id))
          const nuevasSanciones = conRoja.filter(r => !idsConSancion.has(r.player_id)).map(r => ({
            player_id: r.player_id, team_id: r.team_id, tournament_id: partido.tournament_id, match_id: partido.id,
            motivo: 'Tarjeta roja automática (mínimo 1 fecha) — el organizador puede extenderla desde el torneo',
            activa: true, partidos_pendientes: 1, fecha_fin: null,
          }))
          if (nuevasSanciones.length > 0) await supabase.from('sanciones').insert(nuevasSanciones)
        }
      } catch (e) { console.error('sanción automática roja:', e) }

      await resolverPrediccionesPartido(partido.id, golesLocal, golesVis)

      if (erroresGuardado.length > 0) {
        alert('⚠️ Hubo un problema guardando:\n\n' + erroresGuardado.join('\n'))
        return
      }
      if (nombresSinRegistro.length > 0) {
        alert('✓ Resultado guardado.\n\n📋 Recuerda registrar en el equipo (con cédula) a:\n' + nombresSinRegistro.map(n => '• ' + n).join('\n') + '\n\nSus goles/tarjetas de este partido ya quedaron contados en el marcador, pero no van a salir en las estadísticas individuales ni en la deuda de tarjetas hasta que estén registrados.')
      }
      onGuardado && onGuardado(golesLocal, golesVis)
      onClose && onClose()
    } finally {
      guardandoRef.current = false
      setGuardando(false)
    }
  }

  const equipoLocal = partido.home?.name || 'Local'
  const equipoVis = partido.away?.name || 'Visitante'
  const pestana = (clave, nombre, goles) => {
    const activa = equipoActivo === clave
    return (
      <button key={clave} type="button" onClick={() => setEquipoActivo(clave)} aria-pressed={activa}
        style={{
          flex: 1, minWidth: 0, minHeight: '56px', padding: '8px 10px', borderRadius: '12px', cursor: 'pointer', textAlign: 'left',
          border: `2px solid ${activa ? '#1a73e8' : 'transparent'}`, background: activa ? '#fff' : 'transparent',
          boxShadow: activa ? '0 2px 8px rgba(26,115,232,.18)' : 'none', display: 'flex', alignItems: 'center', gap: '8px', touchAction: 'manipulation',
        }}>
        <span style={{ flex: 1, minWidth: 0, fontSize: '.82rem', fontWeight: '800', color: activa ? '#202124' : '#5f6368', lineHeight: 1.2, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{nombre}</span>
        <span style={{ minWidth: '30px', height: '30px', borderRadius: '9px', background: activa ? '#1a73e8' : '#dfe3e8', color: activa ? '#fff' : '#5f6368', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '900', fontSize: '1rem', flexShrink: 0 }}>{goles}</span>
      </button>
    )
  }
  const esLocalActivo = equipoActivo === 'local'

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 950, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px' }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: '20px', width: '100%', maxWidth: '620px', maxHeight: '94vh', display: 'flex', flexDirection: 'column', fontFamily: 'system-ui, sans-serif', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,.3)' }} onClick={e => e.stopPropagation()}>
        {/* Encabezado */}
        <div style={{ padding: '16px 16px 12px', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: '900', fontSize: '1.05rem', color: '#202124' }}>⚡ Carga rápida de resultado</div>
            <div style={{ fontSize: '.78rem', color: '#80868b', marginTop: '3px', lineHeight: 1.4 }}>Marca quién jugó y escribe sus goles. El marcador se calcula solo.</div>
          </div>
          <button onClick={onClose} aria-label="Cerrar" style={{ background: '#f1f3f4', border: 'none', borderRadius: '12px', cursor: 'pointer', color: '#5f6368', width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><X size={20}/></button>
        </div>

        {cargando ? (
          <div style={{ flex: 1, textAlign: 'center', padding: '40px 20px', color: '#9aa0a6', fontSize: '.9rem' }}>Cargando jugadores...</div>
        ) : (
          <>
            {/* Marcador + pestañas de equipo (siempre a la vista) */}
            <div style={{ padding: '0 16px 12px', borderBottom: '1px solid #eceff1' }}>
              {/* Marcador: se suma solo o se escribe a mano */}
              <div style={{ display: 'flex', gap: '4px', background: '#f1f3f4', borderRadius: '12px', padding: '3px', margin: '4px 0 8px' }}>
                {[['auto', 'Sumar goles de jugadores'], ['manual', 'Escribir marcador']].map(([clave, texto]) => (
                  <button key={clave} type="button" onClick={() => setModoMarcador(clave)} aria-pressed={modoMarcador === clave}
                    style={{ flex: 1, minHeight: '38px', padding: '4px 6px', borderRadius: '10px', border: 'none', cursor: 'pointer', fontSize: '.74rem', fontWeight: '800', lineHeight: 1.2, touchAction: 'manipulation',
                      background: modoMarcador === clave ? '#fff' : 'transparent', color: modoMarcador === clave ? '#1a73e8' : '#5f6368', boxShadow: modoMarcador === clave ? '0 1px 4px rgba(0,0,0,.12)' : 'none' }}>{texto}</button>
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', padding: '6px 0 12px' }}>
                <span style={{ flex: 1, textAlign: 'right', fontSize: '.8rem', fontWeight: '700', color: '#5f6368', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{equipoLocal}</span>
                {esManual ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input type="text" inputMode="numeric" pattern="[0-9]*" autoComplete="off" maxLength={2} aria-label={`Goles de ${equipoLocal}`} value={manualLocal}
                      onFocus={e => e.target.select()} onChange={e => setManualLocal(e.target.value.replace(/\D/g, '').slice(0, 2))} onBlur={() => { if (manualLocal === '') setManualLocal('0') }}
                      style={{ width: '62px', height: '56px', textAlign: 'center', fontSize: '1.8rem', fontWeight: '900', border: '2px solid #1a73e8', borderRadius: '12px', boxSizing: 'border-box', outline: 'none', color: '#202124' }}/>
                    <span style={{ color: '#c9cdd1', fontSize: '1.6rem', fontWeight: '900' }}>-</span>
                    <input type="text" inputMode="numeric" pattern="[0-9]*" autoComplete="off" maxLength={2} aria-label={`Goles de ${equipoVis}`} value={manualVis}
                      onFocus={e => e.target.select()} onChange={e => setManualVis(e.target.value.replace(/\D/g, '').slice(0, 2))} onBlur={() => { if (manualVis === '') setManualVis('0') }}
                      style={{ width: '62px', height: '56px', textAlign: 'center', fontSize: '1.8rem', fontWeight: '900', border: '2px solid #1a73e8', borderRadius: '12px', boxSizing: 'border-box', outline: 'none', color: '#202124' }}/>
                  </span>
                ) : (
                  <span style={{ fontWeight: '900', fontSize: '2rem', color: '#202124', letterSpacing: '.04em', lineHeight: 1 }}>{golesLocal}<span style={{ color: '#c9cdd1', margin: '0 8px' }}>-</span>{golesVis}</span>
                )}
                <span style={{ flex: 1, textAlign: 'left', fontSize: '.8rem', fontWeight: '700', color: '#5f6368', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{equipoVis}</span>
              </div>
              {esManual && <div style={{ fontSize: '.7rem', color: '#80868b', textAlign: 'center', margin: '-6px 0 10px' }}>Los goles no se anotan por jugador; solo quién jugó y las tarjetas.</div>}

              {/* Empate: se puede marcar la tanda de penales para saber quién ganó */}
              {empatado && (
                <div style={{ background: '#fff8e8', border: '1px solid #fde1b8', borderRadius: '14px', padding: '10px 12px', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                    <span style={{ fontSize: '.82rem', fontWeight: '800', color: '#92400e' }}>Quedó empatado · ¿Hubo penales?</span>
                    <div style={{ display: 'flex', gap: '4px', background: '#fdebc8', borderRadius: '10px', padding: '3px', flexShrink: 0 }}>
                      {[[false, 'No'], [true, 'Sí']].map(([v, t]) => (
                        <button key={t} type="button" onClick={() => setPenHubo(v)} aria-pressed={penHubo === v}
                          style={{ minWidth: '46px', minHeight: '34px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: '800', fontSize: '.8rem', background: penHubo === v ? '#fff' : 'transparent', color: penHubo === v ? '#92400e' : '#b45309', touchAction: 'manipulation' }}>{t}</button>
                      ))}
                    </div>
                  </div>
                  {penHubo && (
                    <div style={{ marginTop: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                        <span style={{ flex: 1, textAlign: 'right', fontSize: '.74rem', fontWeight: '700', color: '#92400e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{equipoLocal}</span>
                        <input type="text" inputMode="numeric" pattern="[0-9]*" autoComplete="off" maxLength={2} aria-label={`Penales de ${equipoLocal}`} placeholder="0" value={penLocal}
                          onFocus={e => e.target.select()} onChange={e => setPenLocal(e.target.value.replace(/\D/g, '').slice(0, 2))}
                          style={{ width: '56px', height: '48px', textAlign: 'center', fontSize: '1.3rem', fontWeight: '900', border: `2px solid ${penGanador === 'home' ? '#1e8e3e' : '#e5c78a'}`, borderRadius: '10px', boxSizing: 'border-box', outline: 'none', background: '#fff' }}/>
                        <span style={{ color: '#c9a45c', fontWeight: '900' }}>-</span>
                        <input type="text" inputMode="numeric" pattern="[0-9]*" autoComplete="off" maxLength={2} aria-label={`Penales de ${equipoVis}`} placeholder="0" value={penVis}
                          onFocus={e => e.target.select()} onChange={e => setPenVis(e.target.value.replace(/\D/g, '').slice(0, 2))}
                          style={{ width: '56px', height: '48px', textAlign: 'center', fontSize: '1.3rem', fontWeight: '900', border: `2px solid ${penGanador === 'away' ? '#1e8e3e' : '#e5c78a'}`, borderRadius: '10px', boxSizing: 'border-box', outline: 'none', background: '#fff' }}/>
                        <span style={{ flex: 1, textAlign: 'left', fontSize: '.74rem', fontWeight: '700', color: '#92400e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{equipoVis}</span>
                      </div>
                      <div style={{ textAlign: 'center', marginTop: '8px', fontSize: '.8rem', fontWeight: '800', color: penGanador ? '#1e8e3e' : '#b45309' }}>
                        {penGanador ? `🏆 Gana ${penGanador === 'home' ? equipoLocal : equipoVis} por penales` : 'Escribe los penales de cada equipo para saber quién ganó'}
                      </div>
                    </div>
                  )}
                </div>
              )}
              <div style={{ display: 'flex', gap: '4px', background: '#f1f3f4', borderRadius: '14px', padding: '4px' }}>
                {pestana('local', equipoLocal, golesLocal)}
                {pestana('vis', equipoVis, golesVis)}
              </div>
            </div>

            {/* Lista del equipo escogido, con scroll propio: el marcador y el botón de guardar quedan siempre visibles */}
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '14px 16px 6px' }}>
              {esLocalActivo
                ? <Columna roster={rosterLocal} extras={extrasLocal} esLocal={true} filas={filas} cambiar={cambiar} cambiarExtra={cambiarExtra} quitarExtra={quitarExtra} agregarExtra={agregarExtra} sinGoles={esManual}/>
                : <Columna roster={rosterVis} extras={extrasVis} esLocal={false} filas={filas} cambiar={cambiar} cambiarExtra={cambiarExtra} quitarExtra={quitarExtra} agregarExtra={agregarExtra} sinGoles={esManual}/>}
              <button type="button" onClick={() => setEquipoActivo(esLocalActivo ? 'vis' : 'local')}
                style={{ margin: '12px 0 8px', width: '100%', minHeight: '46px', background: '#f1f3f4', border: 'none', borderRadius: '12px', cursor: 'pointer', color: '#202124', fontSize: '.88rem', fontWeight: '800' }}>
                {esLocalActivo ? `Siguiente: ${equipoVis} →` : `← Volver a ${equipoLocal}`}
              </button>
              {/* Nota del partido */}
              <div style={{ margin: '4px 0 12px', background: '#f8f9fa', border: '1px solid #eceff1', borderRadius: '14px', padding: '12px' }}>
                <div style={{ fontSize: '.8rem', fontWeight: '800', color: '#202124', marginBottom: '2px' }}>📝 Nota del partido <span style={{ color: '#9aa0a6', fontWeight: '700' }}>(opcional)</span></div>
                <div style={{ fontSize: '.72rem', color: '#80868b', marginBottom: '8px', lineHeight: 1.4 }}>Por si pasó algo: una pelea, una suspensión, un cambio de cancha, jugadores que no se presentaron…</div>
                <textarea value={nota} onChange={e => setNota(e.target.value)} rows={3} maxLength={1000} placeholder="Escribe aquí lo que pasó en el partido"
                  style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', border: '1.5px solid #dadce0', borderRadius: '10px', fontSize: '1rem', fontFamily: 'inherit', resize: 'vertical', outline: 'none', background: '#fff' }}/>
              </div>
            </div>
          </>
        )}

        <div style={{ padding: '12px 16px calc(14px + env(safe-area-inset-bottom))', borderTop: '1px solid #eceff1', display: 'flex', gap: '10px', background: '#fff' }}>
          <button onClick={onClose} disabled={guardando} style={{ flex: '0 0 auto', padding: '0 18px', minHeight: '52px', background: '#fff', border: '1.5px solid #dadce0', borderRadius: '14px', color: '#3c4043', fontWeight: '800', fontSize: '.9rem', cursor: 'pointer' }}>
            Cancelar
          </button>
          <button onClick={guardar} disabled={guardando || cargando} style={{ flex: 1, minHeight: '52px', background: (guardando || cargando) ? '#9aa0a6' : '#1e8e3e', border: 'none', borderRadius: '14px', color: '#fff', fontWeight: '900', fontSize: '1rem', cursor: (guardando || cargando) ? 'default' : 'pointer' }}>
            {guardando ? 'Guardando...' : '✓ Guardar resultado'}
          </button>
        </div>
      </div>
    </div>
  )
}
