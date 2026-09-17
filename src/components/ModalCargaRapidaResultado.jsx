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
// player_match_stats, partido_arqueros, matches, sanciones, predicciones)
// para que el resto de la plataforma (historial, récords, deuda de
// tarjetas, apuestas Predix) vea el partido exactamente igual que si lo
// hubiera llenado un árbitro.
export default function ModalCargaRapidaResultado({ partido, onClose, onGuardado }) {
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const guardandoRef = useRef(false)
  const [rosterLocal, setRosterLocal] = useState([])
  const [rosterVis, setRosterVis] = useState([])
  const [filas, setFilas] = useState({}) // player_id -> { jugo, goles, amarilla, azul, roja }
  const [arqueroLocalId, setArqueroLocalId] = useState(null)
  const [arqueroVisId, setArqueroVisId] = useState(null)

  useEffect(() => {
    let cancelado = false
    async function cargar() {
      setCargando(true)
      const [{ data: tpLocal }, { data: tpVis }, { data: statsExistentes }, { data: arquerosExistentes }] = await Promise.all([
        supabase.from('team_players').select('player_id, players(id,name)').eq('team_id', partido.home_team_id).eq('activo', true),
        supabase.from('team_players').select('player_id, players(id,name)').eq('team_id', partido.away_team_id).eq('activo', true),
        supabase.from('player_match_stats').select('*').eq('match_id', partido.id),
        supabase.from('partido_arqueros').select('*').eq('match_id', partido.id),
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
      const arqLocal = (arquerosExistentes || []).find(a => a.team_id === partido.home_team_id)
      const arqVis = (arquerosExistentes || []).find(a => a.team_id === partido.away_team_id)
      if (arqLocal?.player_id) setArqueroLocalId(arqLocal.player_id)
      if (arqVis?.player_id) setArqueroVisId(arqVis.player_id)
      setCargando(false)
    }
    cargar()
    return () => { cancelado = true }
  }, [partido.id, partido.home_team_id, partido.away_team_id])

  function cambiar(playerId, campo, valor) {
    setFilas(prev => ({ ...prev, [playerId]: { ...prev[playerId], [campo]: valor } }))
  }

  const golesLocal = rosterLocal.reduce((a, j) => a + (filas[j.id]?.jugo ? Number(filas[j.id]?.goles || 0) : 0), 0)
  const golesVis = rosterVis.reduce((a, j) => a + (filas[j.id]?.jugo ? Number(filas[j.id]?.goles || 0) : 0), 0)

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

      const todos = [...rosterLocal.map(j => ({ j, team_id: partido.home_team_id, esLocal: true })), ...rosterVis.map(j => ({ j, team_id: partido.away_team_id, esLocal: false }))]
        .filter(({ j }) => filas[j.id]?.jugo)

      // Eventos individuales (uno por gol y por tarjeta) — para que el
      // historial de movimientos y tarjetas del torneo vea este partido
      // igual que cualquier otro.
      const eventosDB = []
      todos.forEach(({ j, team_id }) => {
        const f = filas[j.id]
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

      await supabase.from('partido_arqueros').delete().eq('match_id', partido.id)
      const arqRows = []
      if (arqueroLocalId) arqRows.push({ match_id: partido.id, team_id: partido.home_team_id, player_id: arqueroLocalId, orden: 1 })
      if (arqueroVisId) arqRows.push({ match_id: partido.id, team_id: partido.away_team_id, player_id: arqueroVisId, orden: 1 })
      if (arqRows.length > 0) {
        const { error } = await supabase.from('partido_arqueros').insert(arqRows)
        if (error) erroresGuardado.push('Arqueros: ' + error.message)
      }

      const calcResultado = (gF, gC) => gF > gC ? 'win' : gF === gC ? 'draw' : 'loss'
      const statsRows = todos.map(({ j, team_id, esLocal }) => {
        const f = filas[j.id]
        const gF = esLocal ? golesLocal : golesVis
        const gC = esLocal ? golesVis : golesLocal
        const esArquero = (esLocal ? arqueroLocalId : arqueroVisId) === j.id
        return {
          match_id: partido.id, tournament_id: partido.tournament_id, player_id: j.id, team_id,
          numero_camiseta: null,
          goals_scored: Number(f.goles || 0), goals_conceded: esArquero ? gC : 0,
          fue_arquero: esArquero, own_goals: 0,
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

  const filaEstilo = { display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 4px', borderBottom: '1px solid #f1f3f4' }
  const inputGoles = { width: '42px', padding: '5px 4px', textAlign: 'center', border: '1px solid #dadce0', borderRadius: '6px', fontSize: '.85rem' }
  const chip = (activo, color) => ({
    width: '28px', height: '28px', borderRadius: '7px', border: `1.5px solid ${activo ? color : '#dadce0'}`,
    background: activo ? color : '#fff', color: activo ? '#fff' : '#9aa0a6', fontSize: '.7rem', fontWeight: '800',
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  })

  function Columna({ titulo, roster, arqueroId, setArqueroId }) {
    return (
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: '800', fontSize: '.85rem', color: '#202124', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Shield size={14} color="#9aa0a6" /> {titulo}
        </div>
        {roster.length === 0 && <div style={{ fontSize: '.78rem', color: '#9aa0a6', padding: '8px 0' }}>Sin jugadores registrados en este equipo.</div>}
        {roster.map(j => {
          const f = filas[j.id] || { jugo: true, goles: 0, amarilla: false, azul: false, roja: false }
          return (
            <div key={j.id} style={{ ...filaEstilo, opacity: f.jugo ? 1 : .45 }}>
              <input type="checkbox" checked={f.jugo} onChange={e => cambiar(j.id, 'jugo', e.target.checked)} title="¿Jugó este partido?" style={{ width: '16px', height: '16px', flexShrink: 0 }} />
              <span style={{ flex: 1, minWidth: 0, fontSize: '.8rem', color: '#202124', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{j.name}</span>
              <input type="number" min="0" value={f.goles} disabled={!f.jugo} onChange={e => cambiar(j.id, 'goles', e.target.value.replace(/[^0-9]/g, ''))} style={inputGoles} title="Goles" />
              <button type="button" disabled={!f.jugo} onClick={() => cambiar(j.id, 'amarilla', !f.amarilla)} style={chip(f.amarilla, '#f9a825')} title="Tarjeta amarilla">🟨</button>
              <button type="button" disabled={!f.jugo} onClick={() => cambiar(j.id, 'azul', !f.azul)} style={chip(f.azul, '#1a73e8')} title="Tarjeta azul">🟦</button>
              <button type="button" disabled={!f.jugo} onClick={() => cambiar(j.id, 'roja', !f.roja)} style={chip(f.roja, '#d93025')} title="Tarjeta roja">🟥</button>
              <label style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '.65rem', color: '#5f6368', flexShrink: 0 }}>
                <input type="radio" name={`arquero-${titulo}`} checked={arqueroId === j.id} disabled={!f.jugo} onChange={() => setArqueroId(j.id)} />
                🧤
              </label>
            </div>
          )
        })}
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
          Marcá quién jugó, sus goles y tarjetas — 🧤 es opcional, marca quién fue el arquero de cada equipo (solo para la estadística de valla). El resultado se calcula solo sumando los goles de cada jugador.
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

            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              <Columna titulo={partido.home?.name} roster={rosterLocal} arqueroId={arqueroLocalId} setArqueroId={setArqueroLocalId} />
              <Columna titulo={partido.away?.name} roster={rosterVis} arqueroId={arqueroVisId} setArqueroId={setArqueroVisId} />
            </div>

            <button onClick={guardar} disabled={guardando} style={{ width: '100%', marginTop: '18px', padding: '13px', background: guardando ? '#9aa0a6' : '#1e8e3e', border: 'none', borderRadius: '10px', color: '#fff', fontWeight: '800', fontSize: '.9rem', cursor: guardando ? 'default' : 'pointer' }}>
              {guardando ? 'Guardando...' : '✓ Guardar resultado'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
