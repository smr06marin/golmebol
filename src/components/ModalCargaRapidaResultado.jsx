import { useEffect, useRef, useState } from 'react'
import { X, Shield } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { resolverPrediccionesPartido } from '../lib/predix'

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
export default function ModalCargaRapidaResultado({ partido, onClose, onGuardado }) {
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const guardandoRef = useRef(false)
  const [rosterLocal, setRosterLocal] = useState([])
  const [rosterVis, setRosterVis] = useState([])
  const [filas, setFilas] = useState({}) // player_id -> { jugo, goles, amarilla, azul, roja }
  // Jugadores sin registro que se van agregando a mano en esta pantalla (por
  // ahora solo con nombre, sin id real — se crean en Golmebol recién al
  // guardar, igual que hace la planilla rápida de los árbitros).
  const [extrasLocal, setExtrasLocal] = useState([])
  const [extrasVis, setExtrasVis] = useState([])
  const extraIdRef = useRef(0)

  useEffect(() => {
    let cancelado = false
    async function cargar() {
      setCargando(true)
      const [{ data: tpLocal }, { data: tpVis }, { data: statsExistentes }] = await Promise.all([
        supabase.from('team_players').select('player_id, players(id,name)').eq('team_id', partido.home_team_id).eq('activo', true),
        supabase.from('team_players').select('player_id, players(id,name)').eq('team_id', partido.away_team_id).eq('activo', true),
        supabase.from('player_match_stats').select('*').eq('match_id', partido.id),
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

  const golesLocal = rosterLocal.reduce((a, j) => a + (filas[j.id]?.jugo ? Number(filas[j.id]?.goles || 0) : 0), 0)
    + extrasLocal.reduce((a, e) => a + (e.nombre.trim() ? Number(e.goles || 0) : 0), 0)
  const golesVis = rosterVis.reduce((a, j) => a + (filas[j.id]?.jugo ? Number(filas[j.id]?.goles || 0) : 0), 0)
    + extrasVis.reduce((a, e) => a + (e.nombre.trim() ? Number(e.goles || 0) : 0), 0)

  async function guardar() {
    if (guardandoRef.current) return
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

      // Los jugadores sin registro que se hayan escrito (con nombre puesto)
      // se crean acá en Golmebol y quedan inscritos en su equipo/torneo —
      // así ya salen identificados por su nombre real en todo lo demás
      // (historial, deuda de tarjetas, etc.), igual que si el árbitro los
      // hubiera registrado durante el partido.
      const filasCombinadas = { ...filas }
      async function crearExtras(lista, team_id) {
        const creados = []
        for (const e of lista) {
          const nombreLimpio = e.nombre.trim()
          if (!nombreLimpio) continue
          const { data: nuevo, error } = await supabase.from('players')
            .insert({ name: nombreLimpio, activo_membresia: true, fecha_registro: new Date().toISOString() })
            .select().single()
          if (error || !nuevo) { erroresGuardado.push(`No se pudo registrar a "${nombreLimpio}": ` + (error?.message || '')); continue }
          await supabase.from('team_players').insert({ team_id, player_id: nuevo.id, activo: true })
          await supabase.from('tournament_player_registrations').insert({ tournament_id: partido.tournament_id, team_id, player_id: nuevo.id, activo: true })
          filasCombinadas[nuevo.id] = { jugo: true, goles: e.goles, amarilla: e.amarilla, azul: e.azul, roja: e.roja }
          creados.push({ id: nuevo.id, name: nuevo.name })
        }
        return creados
      }
      const nuevosLocal = await crearExtras(extrasLocal, partido.home_team_id)
      const nuevosVis = await crearExtras(extrasVis, partido.away_team_id)
      // Se pasan al roster y se limpian los renglones "sin registro" ya
      // usados — así, si algo más adelante falla y hay que reintentar
      // guardar, no se vuelven a crear como jugadores duplicados.
      if (nuevosLocal.length > 0) { setRosterLocal(prev => [...prev, ...nuevosLocal].sort((a, b) => a.name.localeCompare(b.name))); setExtrasLocal([]) }
      if (nuevosVis.length > 0) { setRosterVis(prev => [...prev, ...nuevosVis].sort((a, b) => a.name.localeCompare(b.name))); setExtrasVis([]) }
      setFilas(filasCombinadas)

      const todos = [
        ...rosterLocal.map(j => ({ j, team_id: partido.home_team_id, esLocal: true })),
        ...nuevosLocal.map(j => ({ j, team_id: partido.home_team_id, esLocal: true })),
        ...rosterVis.map(j => ({ j, team_id: partido.away_team_id, esLocal: false })),
        ...nuevosVis.map(j => ({ j, team_id: partido.away_team_id, esLocal: false })),
      ].filter(({ j }) => filasCombinadas[j.id]?.jugo)

      // Eventos individuales (uno por gol y por tarjeta) — para que el
      // historial de movimientos y tarjetas del torneo vea este partido
      // igual que cualquier otro.
      const eventosDB = []
      todos.forEach(({ j, team_id }) => {
        const f = filasCombinadas[j.id]
        for (let i = 0; i < Number(f.goles || 0); i++) eventosDB.push({ match_id: partido.id, tournament_id: partido.tournament_id, team_id, player_id: j.id, event_type: 'goal', minute: null, periodo: 1 })
        if (f.amarilla) eventosDB.push({ match_id: partido.id, tournament_id: partido.tournament_id, team_id, player_id: j.id, event_type: 'yellow_card', minute: null, periodo: 1 })
        if (f.azul) eventosDB.push({ match_id: partido.id, tournament_id: partido.tournament_id, team_id, player_id: j.id, event_type: 'blue_card', minute: null, periodo: 1 })
        if (f.roja) eventosDB.push({ match_id: partido.id, tournament_id: partido.tournament_id, team_id, player_id: j.id, event_type: 'red_card', minute: null, periodo: 1 })
      })
      await supabase.from('match_events').delete().eq('match_id', partido.id)
      if (eventosDB.length > 0) {
        const { error } = await supabase.from('match_events').insert(eventosDB)
        if (error) erroresGuardado.push('Eventos: ' + error.message)
      }

      const { error: errPartido } = await supabase.from('matches').update({ home_score: golesLocal, away_score: golesVis, status: 'finished' }).eq('id', partido.id)
      if (errPartido) erroresGuardado.push('Resultado: ' + errPartido.message)

      const calcResultado = (gF, gC) => gF > gC ? 'win' : gF === gC ? 'draw' : 'loss'
      const statsRows = todos.map(({ j, team_id, esLocal }) => {
        const f = filasCombinadas[j.id]
        const gF = esLocal ? golesLocal : golesVis
        const gC = esLocal ? golesVis : golesLocal
        return {
          match_id: partido.id, tournament_id: partido.tournament_id, player_id: j.id, team_id,
          numero_camiseta: null,
          goals_scored: Number(f.goles || 0), goals_conceded: 0,
          fue_arquero: false, own_goals: 0,
          yellow_cards: f.amarilla ? 1 : 0, blue_cards: f.azul ? 1 : 0, red_cards: f.roja ? 1 : 0,
          fouls: 0, team_result: calcResultado(gF, gC),
        }
      })
      if (statsRows.length > 0) {
        const { error } = await supabase.from('player_match_stats').upsert(statsRows, { onConflict: 'match_id,player_id' })
        if (error) erroresGuardado.push('Estadísticas: ' + error.message)
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
      onGuardado && onGuardado(golesLocal, golesVis)
      onClose && onClose()
    } finally {
      guardandoRef.current = false
      setGuardando(false)
    }
  }

  const inputGoles = { width: '46px', padding: '6px 4px', textAlign: 'center', border: '1px solid #dadce0', borderRadius: '6px', fontSize: '.85rem', flexShrink: 0 }
  const chip = (activo, color) => ({
    width: '30px', height: '30px', borderRadius: '7px', border: `1.5px solid ${activo ? color : '#dadce0'}`,
    background: activo ? color : '#fff', color: activo ? '#fff' : '#9aa0a6', fontSize: '.7rem', fontWeight: '800',
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  })

  // Cada jugador en DOS líneas (nombre arriba, controles abajo) — en vez de
  // todo en una sola fila. Con los dos equipos uno al lado del otro y todo
  // en una fila, en un celular angosto el nombre quedaba aplastado a cero
  // ancho y desaparecía (se veía "desordenado"). Así el nombre siempre tiene
  // todo el ancho de la pantalla para él solo.
  const inputNombre = { flex: 1, minWidth: 0, padding: '6px 8px', border: '1px solid #dadce0', borderRadius: '6px', fontSize: '.85rem' }

  function Columna({ titulo, roster, extras, esLocal }) {
    return (
      <div style={{ marginBottom: '18px' }}>
        <div style={{ fontWeight: '800', fontSize: '.85rem', color: '#202124', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Shield size={14} color="#9aa0a6" /> {titulo}
        </div>
        {roster.length === 0 && extras.length === 0 && <div style={{ fontSize: '.78rem', color: '#9aa0a6', padding: '8px 0' }}>Sin jugadores registrados en este equipo.</div>}
        {roster.map(j => {
          const f = filas[j.id] || { jugo: true, goles: 0, amarilla: false, azul: false, roja: false }
          return (
            <div key={j.id} style={{ padding: '8px 4px', borderBottom: '1px solid #f1f3f4', opacity: f.jugo ? 1 : .45 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <input type="checkbox" checked={f.jugo} onChange={e => cambiar(j.id, 'jugo', e.target.checked)} title="¿Jugó este partido?" style={{ width: '17px', height: '17px', flexShrink: 0 }} />
                <span style={{ flex: 1, minWidth: 0, fontSize: '.85rem', fontWeight: '600', color: '#202124', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{j.name}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingLeft: '25px' }}>
                <span style={{ fontSize: '.65rem', color: '#9aa0a6', flexShrink: 0 }}>Goles</span>
                <input type="number" min="0" value={f.goles} disabled={!f.jugo} onChange={e => cambiar(j.id, 'goles', e.target.value.replace(/[^0-9]/g, ''))} style={inputGoles} title="Goles" />
                <button type="button" disabled={!f.jugo} onClick={() => cambiar(j.id, 'amarilla', !f.amarilla)} style={chip(f.amarilla, '#f9a825')} title="Tarjeta amarilla">🟨</button>
                <button type="button" disabled={!f.jugo} onClick={() => cambiar(j.id, 'azul', !f.azul)} style={chip(f.azul, '#1a73e8')} title="Tarjeta azul">🟦</button>
                <button type="button" disabled={!f.jugo} onClick={() => cambiar(j.id, 'roja', !f.roja)} style={chip(f.roja, '#d93025')} title="Tarjeta roja">🟥</button>
              </div>
            </div>
          )
        })}

        {/* Jugadores sin registro: solo escribir el nombre acá mismo — al
            guardar quedan registrados de una en Golmebol y su historia
            (goles, tarjetas) queda como la de cualquier otro jugador. */}
        {extras.map(e => (
          <div key={e.tempId} style={{ padding: '8px 4px', borderBottom: '1px solid #f1f3f4' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <input type="text" value={e.nombre} onChange={ev => cambiarExtra(esLocal, e.tempId, 'nombre', ev.target.value)} placeholder="Nombre del jugador sin registro" autoFocus style={inputNombre} />
              <button type="button" onClick={() => quitarExtra(esLocal, e.tempId)} title="Quitar" style={{ background: 'none', border: 'none', color: '#d93025', cursor: 'pointer', flexShrink: 0 }}><X size={16} /></button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingLeft: '2px' }}>
              <span style={{ fontSize: '.65rem', color: '#9aa0a6', flexShrink: 0 }}>Goles</span>
              <input type="number" min="0" value={e.goles} onChange={ev => cambiarExtra(esLocal, e.tempId, 'goles', ev.target.value.replace(/[^0-9]/g, ''))} style={inputGoles} title="Goles" />
              <button type="button" onClick={() => cambiarExtra(esLocal, e.tempId, 'amarilla', !e.amarilla)} style={chip(e.amarilla, '#f9a825')} title="Tarjeta amarilla">🟨</button>
              <button type="button" onClick={() => cambiarExtra(esLocal, e.tempId, 'azul', !e.azul)} style={chip(e.azul, '#1a73e8')} title="Tarjeta azul">🟦</button>
              <button type="button" onClick={() => cambiarExtra(esLocal, e.tempId, 'roja', !e.roja)} style={chip(e.roja, '#d93025')} title="Tarjeta roja">🟥</button>
            </div>
          </div>
        ))}
        <button type="button" onClick={() => agregarExtra(esLocal)} style={{ marginTop: '8px', background: 'none', border: '1px dashed #dadce0', borderRadius: '8px', padding: '7px 10px', cursor: 'pointer', color: '#1a73e8', fontSize: '.75rem', fontWeight: '700', width: '100%' }}>
          + Jugador sin registro
        </button>
      </div>
    )
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 950, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '14px' }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: '16px', padding: '20px', width: '100%', maxWidth: '620px', maxHeight: '92vh', overflowY: 'auto', fontFamily: 'system-ui, sans-serif' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
          <div>
            <div style={{ fontWeight: '800', fontSize: '1rem', color: '#202124' }}>⚡ Carga rápida de resultado</div>
            <div style={{ fontSize: '.72rem', color: '#9aa0a6', marginTop: '2px' }}>{partido.home?.name} vs {partido.away?.name}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9aa0a6' }}><X size={18} /></button>
        </div>
        <div style={{ fontSize: '.7rem', color: '#9aa0a6', margin: '6px 0 12px' }}>
          Marcá quién jugó, sus goles y tarjetas. El resultado se calcula solo sumando los goles de cada jugador.
        </div>

        {cargando ? (
          <div style={{ textAlign: 'center', padding: '30px', color: '#9aa0a6', fontSize: '.85rem' }}>Cargando jugadores...</div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '14px', background: '#f8f9fa', borderRadius: '10px', padding: '10px', marginBottom: '14px' }}>
              <div style={{ fontSize: '.8rem', fontWeight: '700', color: '#202124', textAlign: 'right', flex: 1 }}>{partido.home?.name}</div>
              <div style={{ fontWeight: '900', fontSize: '1.3rem', color: '#1a73e8' }}>{golesLocal} - {golesVis}</div>
              <div style={{ fontSize: '.8rem', fontWeight: '700', color: '#202124', flex: 1 }}>{partido.away?.name}</div>
            </div>

            <Columna titulo={partido.home?.name} roster={rosterLocal} extras={extrasLocal} esLocal={true} />
            <Columna titulo={partido.away?.name} roster={rosterVis} extras={extrasVis} esLocal={false} />

            <button onClick={guardar} disabled={guardando} style={{ width: '100%', marginTop: '18px', padding: '13px', background: guardando ? '#9aa0a6' : '#1e8e3e', border: 'none', borderRadius: '10px', color: '#fff', fontWeight: '800', fontSize: '.9rem', cursor: guardando ? 'default' : 'pointer' }}>
              {guardando ? 'Guardando...' : '✓ Guardar resultado'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
