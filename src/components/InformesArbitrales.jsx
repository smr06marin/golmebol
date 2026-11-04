import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

// Informes arbitrales de un torneo: qué partidos tienen informe y lo que escribió el árbitro.
// Los informes los crea la planilla (roja, partido terminado antes de tiempo, "otro" o cierre automático)
// en la tabla match_informes. Acá solo se leen.

const fechaLarga = iso => iso ? new Date(iso).toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'America/Bogota' }) : ''
const fechaCorta = iso => iso ? new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/Bogota' }) : ''

const TIPOS = {
  roja:            { t: '🟥 Tarjeta roja',        c: '#c5221f', bg: '#fce8e6' },
  terminado_antes: { t: '⏱️ Terminado antes',     c: '#b45309', bg: '#fef3c7' },
  otro:            { t: '📝 Otro',                c: '#1a73e8', bg: '#e8f0fe' },
  auto:            { t: '⚙️ Cierre automático',   c: '#5f6368', bg: '#f1f3f4' },
}
const esAuto = inf => (inf.creado_por || '').toLowerCase().includes('cierre autom')
const claveTipo = inf => esAuto(inf) ? 'auto' : (TIPOS[inf.tipo] ? inf.tipo : 'otro')

export default function InformesArbitrales({ torneoId, partidos }) {
  const [informes, setInformes] = useState(null)
  const [error, setError] = useState('')
  const [arbitros, setArbitros] = useState({})
  const [filtro, setFiltro] = useState('todos') // todos | roja | terminado_antes | otro | auto | sin
  const [busca, setBusca] = useState('')
  const [abiertos, setAbiertos] = useState({})
  const [recarga, setRecarga] = useState(0)

  useEffect(() => {
    let vivo = true
    supabase.from('match_informes').select('*').eq('tournament_id', torneoId).limit(2000)
      .then(({ data, error: err }) => {
        if (!vivo) return
        if (err) { setError('No se pudieron cargar los informes. Revisa la señal e intenta de nuevo.'); setInformes([]); return }
        setError(''); setInformes(data || [])
      })
    return () => { vivo = false }
  }, [torneoId, recarga])

  // Nombres de los árbitros de los partidos del torneo
  useEffect(() => {
    const ids = [...new Set((partidos || []).flatMap(p => [p.arbitro1_id, p.arbitro2_id, p.arbitro3_id]).filter(Boolean))]
    if (ids.length === 0) return
    let vivo = true
    supabase.from('players').select('id,name').in('id', ids).then(({ data }) => {
      if (!vivo) return
      const m = {}; (data || []).forEach(a => { m[a.id] = a.name }); setArbitros(m)
    })
    return () => { vivo = false }
  }, [partidos])

  const porPartido = useMemo(() => {
    const mapa = {}
    ;(informes || []).forEach(inf => { (mapa[inf.match_id] = mapa[inf.match_id] || []).push(inf) })
    Object.values(mapa).forEach(l => l.sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0)))
    return mapa
  }, [informes])

  const partidoDe = id => (partidos || []).find(p => p.id === id)
  const nombreArbitros = p => [p?.arbitro1_id, p?.arbitro2_id, p?.arbitro3_id].filter(Boolean).map(i => arbitros[i]).filter(Boolean).join(', ')

  // Conteos por tipo
  const conteo = useMemo(() => {
    const c = { todos: (informes || []).length, roja: 0, terminado_antes: 0, otro: 0, auto: 0 }
    ;(informes || []).forEach(inf => { c[claveTipo(inf)]++ })
    return c
  }, [informes])

  // Partidos terminados (jugados, sin contar W) que no tienen ningún informe
  const sinInforme = useMemo(() => (partidos || [])
    .filter(p => p.status === 'finished' && p.tipo_resultado !== 'w' && !porPartido[p.id])
    .sort((a, b) => new Date(b.played_at || 0) - new Date(a.played_at || 0)), [partidos, porPartido])

  // Partidos con informe (más recientes primero), filtrados
  const q = busca.trim().toLowerCase()
  const lista = useMemo(() => {
    return Object.keys(porPartido).map(mid => {
      const p = partidoDe(mid)
      let infs = porPartido[mid]
      if (filtro !== 'todos' && filtro !== 'sin') infs = infs.filter(i => claveTipo(i) === filtro)
      return { mid, p, infs }
    }).filter(x => x.infs.length > 0 && x.p).filter(x => {
      if (!q) return true
      const texto = [x.p.home?.name, x.p.away?.name, nombreArbitros(x.p), ...x.infs.map(i => `${i.descripcion} ${i.creado_por || ''}`)].join(' ').toLowerCase()
      return texto.includes(q)
    }).sort((a, b) => new Date(b.p.played_at || 0) - new Date(a.p.played_at || 0))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [porPartido, filtro, q, partidos, arbitros])

  if (informes === null) return <div style={{ padding: '30px', textAlign: 'center', color: '#5f6368', fontSize: '.85rem' }}>Cargando informes…</div>

  const chip = (k, texto) => {
    const on = filtro === k
    return (
      <button key={k} onClick={() => setFiltro(k)} aria-pressed={on}
        style={{ minHeight: '40px', padding: '8px 14px', borderRadius: '999px', cursor: 'pointer', fontSize: '.78rem', fontWeight: '700', border: on ? '2px solid #1a73e8' : '1px solid #dadce0', background: on ? '#e8f0fe' : '#fff', color: on ? '#1a73e8' : '#3c4043' }}>
        {texto}
      </button>
    )
  }

  const marcador = p => (p.status === 'finished' && p.home_score != null) ? `${p.home_score} - ${p.away_score}` : 'vs'

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginBottom: '4px', flexWrap: 'wrap' }}>
        <div style={{ fontWeight: '800', color: '#202124', fontSize: '1rem' }}>📋 Informes arbitrales</div>
        <button onClick={() => setRecarga(n => n + 1)} style={{ minHeight: '38px', padding: '6px 14px', background: '#fff', border: '1px solid #dadce0', borderRadius: '8px', cursor: 'pointer', color: '#5f6368', fontSize: '.78rem', fontWeight: '700' }}>↻ Actualizar</button>
      </div>
      <div style={{ fontSize: '.78rem', color: '#5f6368', lineHeight: 1.45, marginBottom: '14px' }}>
        Lo que escribe el árbitro al cerrar el partido: tarjetas rojas, partidos terminados antes de tiempo y otras novedades. Toca un partido para leer el informe completo.
      </div>

      {error && <div style={{ background: '#fce8e6', border: '1px solid #fad2cf', color: '#c5221f', borderRadius: '10px', padding: '10px 14px', fontSize: '.8rem', marginBottom: '12px' }}>{error}</div>}

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
        {chip('todos', `Todos (${conteo.todos})`)}
        {chip('roja', `🟥 Rojas (${conteo.roja})`)}
        {chip('terminado_antes', `⏱️ Terminado antes (${conteo.terminado_antes})`)}
        {chip('otro', `📝 Otros (${conteo.otro})`)}
        {conteo.auto > 0 && chip('auto', `⚙️ Cierre automático (${conteo.auto})`)}
        {chip('sin', `Sin informe (${sinInforme.length})`)}
      </div>

      {filtro !== 'sin' && (
        <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por equipo, árbitro o palabra del informe…"
          style={{ width: '100%', boxSizing: 'border-box', minHeight: '44px', padding: '10px 14px', border: '1px solid #dadce0', borderRadius: '10px', fontSize: '.85rem', marginBottom: '14px', background: '#fff' }}/>
      )}

      {filtro === 'sin' ? (
        sinInforme.length === 0 ? (
          <div style={{ background: '#e6f4ea', border: '1px solid #ceead6', color: '#137333', borderRadius: '12px', padding: '16px', fontSize: '.85rem', fontWeight: '700' }}>✓ Todos los partidos jugados tienen informe.</div>
        ) : (
          <>
            <div style={{ fontSize: '.76rem', color: '#5f6368', marginBottom: '8px' }}>Partidos ya jugados donde el árbitro no dejó ningún informe (normal si no hubo roja ni novedades).</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {sinInforme.map(p => (
                <div key={p.id} style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', padding: '10px 14px' }}>
                  <div style={{ fontSize: '.84rem', fontWeight: '700', color: '#202124', wordBreak: 'break-word' }}>{p.home?.name || '?'} <span style={{ color: '#1a73e8' }}>{marcador(p)}</span> {p.away?.name || '?'}</div>
                  <div style={{ fontSize: '.72rem', color: '#5f6368', marginTop: '2px' }}>{fechaLarga(p.played_at)}{nombreArbitros(p) ? ` · Árbitro: ${nombreArbitros(p)}` : ''}</div>
                </div>
              ))}
            </div>
          </>
        )
      ) : lista.length === 0 ? (
        <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', padding: '26px 16px', textAlign: 'center', color: '#5f6368', fontSize: '.85rem' }}>
          {conteo.todos === 0 ? 'Todavía no hay informes en este torneo.' : 'No hay informes con ese filtro.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {lista.map(({ mid, p, infs }) => {
            const abierto = !!abiertos[mid]
            const tieneRoja = infs.some(i => claveTipo(i) === 'roja')
            return (
              <div key={mid} style={{ background: '#fff', border: `1px solid ${tieneRoja ? '#fad2cf' : '#e8eaed'}`, borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
                <button onClick={() => setAbiertos(o => ({ ...o, [mid]: !o[mid] }))} aria-expanded={abierto}
                  style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: '12px 14px', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '.88rem', fontWeight: '800', color: '#202124', wordBreak: 'break-word' }}>{p.home?.name || '?'} <span style={{ color: '#1a73e8' }}>{marcador(p)}</span> {p.away?.name || '?'}</div>
                    <div style={{ fontSize: '.72rem', color: '#5f6368', marginTop: '2px' }}>
                      {fechaLarga(p.played_at)}{p.matchday ? ` · Jornada ${p.matchday}` : ''}{nombreArbitros(p) ? ` · Árbitro: ${nombreArbitros(p)}` : ''}
                    </div>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
                      {infs.map(i => { const T = TIPOS[claveTipo(i)]; return <span key={i.id} style={{ fontSize: '.68rem', fontWeight: '700', color: T.c, background: T.bg, borderRadius: '10px', padding: '2px 9px' }}>{T.t}</span> })}
                    </div>
                  </div>
                  <span style={{ color: '#5f6368', fontSize: '.8rem', flexShrink: 0, paddingTop: '2px' }}>{abierto ? '▾' : '▸'}</span>
                </button>
                {abierto && (
                  <div style={{ borderTop: '1px solid #f1f3f4', padding: '10px 14px 14px', background: '#fafafa', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {infs.map(i => {
                      const T = TIPOS[claveTipo(i)]
                      return (
                        <div key={i.id} style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '10px', padding: '10px 12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
                            <span style={{ fontSize: '.7rem', fontWeight: '700', color: T.c, background: T.bg, borderRadius: '10px', padding: '2px 9px' }}>{T.t}</span>
                            <span style={{ fontSize: '.7rem', color: '#80868b' }}>{i.creado_por ? `Por ${i.creado_por}` : 'Autor no registrado'}{i.created_at ? ` · ${fechaCorta(i.created_at)}` : ''}</span>
                          </div>
                          <div style={{ fontSize: '.84rem', color: '#202124', lineHeight: 1.55, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{i.descripcion || '(sin texto)'}</div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
