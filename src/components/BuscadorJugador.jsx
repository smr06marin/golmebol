import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { responderPregunta } from '../lib/motorPreguntas'

// ── Buscador de datos históricos POR JUGADOR ────────────────────────────────
// Igual que el buscador del equipo: escribe lo que quieres saber ("mi mejor
// partido", "a quién le hago más goles", "mis tarjetas") y salen tarjetas con
// las respuestas calculadas de todo lo guardado del jugador.

const normalizar = s => (s || '').toLowerCase().normalize('NFD').replace(new RegExp('[\\u0300-\\u036f]', 'g'), '')

export default function BuscadorJugador({ playerId }) {
  const [datos,    setDatos]    = useState(null)
  const [busqueda, setBusqueda] = useState('')

  useEffect(() => {
    if (!playerId) return
    Promise.all([
      supabase.from('player_match_stats')
        .select('*, matches(played_at, home_score, away_score, home:home_team_id(id,name), away:away_team_id(id,name), tournaments(name)), teams(id,name)')
        .eq('player_id', playerId),
      supabase.from('tournament_logros').select('tipo, tournaments(name)').eq('player_id', playerId),
    ]).then(([s, l]) => setDatos({ stats: s.data || [], logros: l.data || [] }))
  }, [playerId])

  function construirRespuestas() {
    if (!datos) return []
    const R = []
    const partidos = datos.stats.map(s => {
      const m = s.matches || {}
      const esLocal = m.home?.id === s.team_id
      return {
        goles: s.goals_scored || 0, gc: s.goals_conceded || 0, fueArquero: !!s.fue_arquero,
        amarillas: s.yellow_cards || 0, azules: s.blue_cards || 0, rojas: s.red_cards || 0,
        faltas: s.fouls || 0, resultado: s.team_result,
        rival: esLocal ? m.away?.name : m.home?.name,
        equipo: s.teams?.name || '', torneo: m.tournaments?.name || '',
        fecha: m.played_at ? new Date(m.played_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : '',
      }
    })
    if (partidos.length === 0) return R

    // Resumen histórico
    const goles = partidos.reduce((s, p) => s + p.goles, 0)
    const v = partidos.filter(p => p.resultado === 'win').length
    const e = partidos.filter(p => p.resultado === 'draw').length
    const d = partidos.filter(p => p.resultado === 'loss').length
    R.push({ icono: '📊', titulo: 'Historial completo',
      respuesta: `${partidos.length} partidos · ${goles} goles · ${v}V ${e}E ${d}D`,
      detalle: partidos.length > 0 ? `Promedio: ${(goles / partidos.length).toFixed(2)} goles por partido` : null,
      kw: 'resumen historial record estadisticas totales partidos goles promedio' })

    // Mejor partido (más goles)
    const mejor = [...partidos].sort((a, b) => b.goles - a.goles)[0]
    if (mejor.goles > 0) R.push({ icono: '🔥', titulo: 'Su mejor partido (más goles)',
      respuesta: `${mejor.goles} gol${mejor.goles > 1 ? 'es' : ''} vs ${mejor.rival || '—'}`,
      detalle: `${mejor.torneo} · ${mejor.fecha} · con ${mejor.equipo}`,
      kw: 'mejor partido mas goles anotados doblete triplete hat trick' })

    // Rival al que más goles le ha hecho
    const porRival = {}
    partidos.forEach(p => { if (p.rival && p.goles > 0) porRival[p.rival] = (porRival[p.rival] || 0) + p.goles })
    const topRival = Object.entries(porRival).sort((a, b) => b[1] - a[1])
    if (topRival.length > 0) R.push({ icono: '🎯', titulo: 'Rival al que más goles le ha hecho',
      respuesta: `${topRival[0][0]} — ${topRival[0][1]} goles`,
      detalle: topRival.slice(1, 4).map(([n, g]) => `${n} (${g})`).join(' · ') || null,
      kw: 'rival equipo al que mas goles le ha hecho victima favorito' })

    // Goles por torneo
    const porTorneo = {}
    partidos.forEach(p => { if (p.torneo) { if (!porTorneo[p.torneo]) porTorneo[p.torneo] = { goles: 0, pj: 0 }; porTorneo[p.torneo].goles += p.goles; porTorneo[p.torneo].pj++ } })
    const topTorneo = Object.entries(porTorneo).sort((a, b) => b[1].goles - a[1].goles)
    if (topTorneo.length > 0) R.push({ icono: '🏟️', titulo: 'Torneo donde más goles ha hecho',
      respuesta: `${topTorneo[0][0]} — ${topTorneo[0][1].goles} goles en ${topTorneo[0][1].pj} PJ`,
      detalle: topTorneo.slice(1, 3).map(([n, x]) => `${n} (${x.goles})`).join(' · ') || null,
      kw: 'torneo donde mas goles campeonato ' + topTorneo.map(([n]) => normalizar(n)).join(' ') })

    // Tarjetas y faltas
    const am = partidos.reduce((s, p) => s + p.amarillas, 0)
    const az = partidos.reduce((s, p) => s + p.azules, 0)
    const ro = partidos.reduce((s, p) => s + p.rojas, 0)
    const fa = partidos.reduce((s, p) => s + p.faltas, 0)
    R.push({ icono: '🟨', titulo: 'Disciplina',
      respuesta: `🟨 ${am} amarillas · 🟦 ${az} azules · 🟥 ${ro} rojas`,
      detalle: `${fa} faltas cometidas en total`,
      kw: 'tarjetas amarillas azules rojas faltas disciplina expulsiones' })

    // Como arquero
    const comoArquero = partidos.filter(p => p.fueArquero)
    if (comoArquero.length > 0) {
      const gcTotal = comoArquero.reduce((s, p) => s + p.gc, 0)
      const arcosCero = comoArquero.filter(p => p.gc === 0).length
      R.push({ icono: '🧤', titulo: 'Como arquero',
        respuesta: `${comoArquero.length} partidos · ${gcTotal} goles recibidos · promedio ${(gcTotal / comoArquero.length).toFixed(2)}`,
        detalle: `${arcosCero} arco${arcosCero !== 1 ? 's' : ''} en cero`,
        kw: 'arquero portero valla goles recibidos arco cero promedio tapadas' })
    }

    // Equipos donde ha jugado
    const porEquipo = {}
    partidos.forEach(p => { if (p.equipo) { if (!porEquipo[p.equipo]) porEquipo[p.equipo] = 0; porEquipo[p.equipo]++ } })
    const equiposLista = Object.entries(porEquipo).sort((a, b) => b[1] - a[1])
    if (equiposLista.length > 0) R.push({ icono: '🎽', titulo: 'Equipos donde ha jugado',
      respuesta: equiposLista.map(([n, pj]) => `${n} (${pj} PJ)`).join(' · '),
      detalle: null,
      kw: 'equipos donde ha jugado camisetas historia clubes ' + equiposLista.map(([n]) => normalizar(n)).join(' ') })

    // Palmarés individual
    const mvps    = datos.logros.filter(l => l.tipo === 'mvp').length
    const titulos = datos.logros.filter(l => l.tipo === 'campeon')
    const goleador = datos.logros.filter(l => l.tipo === 'goleador').length
    if (mvps > 0 || titulos.length > 0 || goleador > 0) R.push({ icono: '🏆', titulo: 'Palmarés individual',
      respuesta: [mvps > 0 && `⭐ ${mvps} MVP${mvps > 1 ? 's' : ''}`, titulos.length > 0 && `🏆 ${titulos.length} título${titulos.length > 1 ? 's' : ''}`, goleador > 0 && `⚽ ${goleador} vez${goleador > 1 ? 'es' : ''} goleador`].filter(Boolean).join(' · '),
      detalle: titulos.map(l => l.tournaments?.name).filter(Boolean).join(' · ') || null,
      kw: 'palmares mvp titulos campeon goleador premios logros mejor jugador' })

    return R
  }

  // Memorizado: solo se recalcula cuando llegan los datos, no en cada tecla.
  // El try/catch evita que un dato inesperado rompa la pantalla.
  const respuestas = useMemo(() => {
    try { return construirRespuestas() } catch (e) { console.error('Buscador jugador:', e); return [] }
  }, [datos])

  // Filas crudas para el motor de preguntas (métrica + más/menos + torneo/rival)
  const filasMotor = useMemo(() => {
    if (!datos) return []
    return datos.stats.map(s => {
      const m = s.matches || {}
      const esLocal = m.home?.id === s.team_id
      return {
        jugador: 'yo', rival: esLocal ? m.away?.name : m.home?.name, torneo: m.tournaments?.name || '',
        goles: s.goals_scored || 0, gc: s.goals_conceded || 0, fueArquero: !!s.fue_arquero,
        amarillas: s.yellow_cards || 0, azules: s.blue_cards || 0, rojas: s.red_cards || 0,
        faltas: s.fouls || 0, resultado: s.team_result,
      }
    })
  }, [datos])

  const resultados = useMemo(() => {
    const q = normalizar(busqueda).split(/\s+/).filter(t => t.length > 2)
    if (q.length === 0) return respuestas.slice(0, 4)
    // 1) El motor responde la pregunta exacta con los datos crudos
    const delMotor = responderPregunta(busqueda, {
      modo: 'jugador', filas: filasMotor,
      nombresTorneos: [...new Set(filasMotor.map(f => f.torneo).filter(Boolean))],
    })
    // 2) Más las respuestas del catálogo que coincidan
    const delCatalogo = respuestas
      .map(r => {
        const texto = normalizar(`${r.kw} ${r.titulo} ${r.respuesta}`)
        // Coincide también en singular/plural ("goles" encuentra "gol" y viceversa)
        return { ...r, score: q.filter(t => texto.includes(t) || (t.endsWith('s') && texto.includes(t.slice(0, -1)))).length }
      })
      .filter(r => r.score > 0)
      .sort((a, b) => b.score - a.score)
    const titulosMotor = new Set(delMotor.map(r => r.titulo))
    return [...delMotor, ...delCatalogo.filter(r => !titulosMotor.has(r.titulo))].slice(0, 8)
  }, [respuestas, busqueda, filasMotor])

  return (
    <div style={{ background: 'linear-gradient(165deg,#151a28,#0c0f18)', border: '1px solid #232b3d', borderRadius: '16px', padding: '18px' }}>
      <div style={{ fontWeight: 800, color: '#fff', fontSize: '.92rem', marginBottom: '4px' }}>🔎 Buscar en su historia</div>
      <div style={{ fontSize: '.72rem', color: '#8b93a5', marginBottom: '12px' }}>
        Goles, rivales, tarjetas, arco, equipos, títulos... todo lo guardado del jugador.
      </div>
      <div style={{ position: 'relative' }}>
        <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
          placeholder="Ej: mejor partido · a quién le hace más goles · tarjetas..."
          style={{ width: '100%', background: 'rgba(255,255,255,.06)', border: '1px solid #2a3446', borderRadius: '12px', padding: '12px 40px 12px 14px', color: '#fff', fontSize: '.95rem', outline: 'none', boxSizing: 'border-box' }}/>
        {busqueda && (
          <button onClick={() => setBusqueda('')}
            style={{ position: 'absolute', right: '9px', top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,.12)', border: 'none', borderRadius: '50%', width: '24px', height: '24px', cursor: 'pointer', color: '#aeb6c6', fontSize: '.75rem', fontWeight: 700 }}>✕</button>
        )}
      </div>
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', margin: '10px 0 14px' }}>
        {['Mejor partido', '¿A quién le hace más goles?', 'Tarjetas', 'Como arquero', 'Equipos', 'Palmarés'].map(s => (
          <button key={s} onClick={() => setBusqueda(s)}
            style={{ padding: '6px 12px', borderRadius: '20px', border: `1px solid ${normalizar(busqueda) === normalizar(s) ? '#1a73e8' : '#2a3446'}`, background: normalizar(busqueda) === normalizar(s) ? 'rgba(26,115,232,.2)' : 'transparent', color: normalizar(busqueda) === normalizar(s) ? '#7fb3ff' : '#8b93a5', fontSize: '.7rem', fontWeight: 700, cursor: 'pointer' }}>
            {s}
          </button>
        ))}
      </div>

      {!datos ? (
        <div style={{ textAlign: 'center', color: '#8b93a5', fontSize: '.78rem', padding: '16px' }}>⏳ Cargando datos del jugador...</div>
      ) : respuestas.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#8b93a5', fontSize: '.78rem', padding: '16px' }}>Este jugador aún no tiene partidos guardados</div>
      ) : resultados.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#8b93a5', fontSize: '.78rem', padding: '16px' }}>Sin resultados — prueba con: goles, rival, tarjetas, arquero, equipos o títulos</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ fontSize: '.66rem', color: '#8b93a5', fontWeight: 600, padding: '0 2px' }}>
            {busqueda.trim()
              ? `${resultados.length} resultado${resultados.length !== 1 ? 's' : ''} para "${busqueda.trim()}"`
              : 'Datos generales — escribe o toca una pregunta para buscar algo puntual'}
          </div>
          {resultados.map(r => (
            <div key={r.titulo} className="gm-logro" style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', borderRadius: '12px', padding: '13px 15px', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <div style={{ fontSize: '1.4rem', flexShrink: 0 }}>{r.icono}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '.66rem', color: '#8b93a5', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em' }}>{r.titulo}</div>
                <div style={{ fontSize: '.9rem', color: '#fff', fontWeight: 800, marginTop: '3px', lineHeight: 1.35, overflowWrap: 'break-word' }}>{r.respuesta}</div>
                {r.detalle && <div style={{ fontSize: '.72rem', color: '#aeb6c6', marginTop: '3px', lineHeight: 1.4, overflowWrap: 'break-word' }}>{r.detalle}</div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
