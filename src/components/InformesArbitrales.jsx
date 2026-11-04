import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

// Informes arbitrales de un torneo: qué partidos tienen informe y lo que escribió el árbitro.
// Los informes los crea la planilla (roja, partido terminado antes de tiempo, "otro" o cierre automático)
// en la tabla match_informes. Acá solo se leen.

const fechaLarga = iso => iso ? new Date(iso).toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'America/Bogota' }).replace(/\./g, '') : ''
const fechaCorta = iso => iso ? new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/Bogota' }).replace(/\./g, '') : ''

// Un solo color por tipo, aplicado con sobriedad (punto + barra lateral)
const TIPOS = {
  roja:            { t: 'Tarjeta roja',       c: '#d93025' },
  terminado_antes: { t: 'Terminado antes',    c: '#e37400' },
  otro:            { t: 'Otro',               c: '#1a73e8' },
  auto:            { t: 'Cierre automático',  c: '#9aa0a6' },
}
const esAuto = inf => (inf.creado_por || '').toLowerCase().includes('cierre autom')
const claveTipo = inf => esAuto(inf) ? 'auto' : (TIPOS[inf.tipo] ? inf.tipo : 'otro')

const INK = '#202124'
const MUTED = '#6b7280'
const LINE = '#eceff1'

function Punto({ color }) {
  return <span aria-hidden="true" style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }}/>
}

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
  const listaArbitros = p => [p?.arbitro1_id, p?.arbitro2_id, p?.arbitro3_id].filter(Boolean).map(i => arbitros[i]).filter(Boolean)

  const conteo = useMemo(() => {
    const c = { todos: (informes || []).length, roja: 0, terminado_antes: 0, otro: 0, auto: 0 }
    ;(informes || []).forEach(inf => { c[claveTipo(inf)]++ })
    return c
  }, [informes])

  // Partidos jugados (sin contar W) que no tienen ningún informe
  const sinInforme = useMemo(() => (partidos || [])
    .filter(p => p.status === 'finished' && p.tipo_resultado !== 'w' && !porPartido[p.id])
    .sort((a, b) => new Date(b.played_at || 0) - new Date(a.played_at || 0)), [partidos, porPartido])

  const q = busca.trim().toLowerCase()
  const lista = useMemo(() => {
    return Object.keys(porPartido).map(mid => {
      const p = partidoDe(mid)
      let infs = porPartido[mid]
      if (filtro !== 'todos' && filtro !== 'sin') infs = infs.filter(i => claveTipo(i) === filtro)
      return { mid, p, infs }
    }).filter(x => x.infs.length > 0 && x.p).filter(x => {
      if (!q) return true
      const texto = [x.p.home?.name, x.p.away?.name, listaArbitros(x.p).join(' '), ...x.infs.map(i => `${i.descripcion} ${i.creado_por || ''}`)].join(' ').toLowerCase()
      return texto.includes(q)
    }).sort((a, b) => new Date(b.p.played_at || 0) - new Date(a.p.played_at || 0))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [porPartido, filtro, q, partidos, arbitros])

  if (informes === null) return <div style={{ padding: '40px 0', textAlign: 'center', color: MUTED, fontSize: '.85rem' }}>Cargando informes…</div>

  const pestañas = [
    ['todos', 'Todos', conteo.todos],
    ['roja', 'Rojas', conteo.roja],
    ['terminado_antes', 'Terminado antes', conteo.terminado_antes],
    ['otro', 'Otros', conteo.otro],
    ...(conteo.auto > 0 ? [['auto', 'Cierre automático', conteo.auto]] : []),
    ['sin', 'Sin informe', sinInforme.length],
  ]

  const Marcador = ({ p, grande }) => {
    const jugado = p.status === 'finished' && p.home_score != null
    const fila = (nombre, goles, gana) => (
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
        <span style={{ fontSize: grande ? '.95rem' : '.9rem', fontWeight: gana ? 700 : 500, color: INK, minWidth: 0, wordBreak: 'break-word', lineHeight: 1.35 }}>{nombre || '—'}</span>
        {jugado && <span style={{ fontSize: grande ? '.95rem' : '.9rem', fontWeight: gana ? 700 : 500, color: INK, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{goles}</span>}
      </div>
    )
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {fila(p.home?.name, p.home_score, jugado && p.home_score > p.away_score)}
        {fila(p.away?.name, p.away_score, jugado && p.away_score > p.home_score)}
      </div>
    )
  }

  const meta = p => [fechaLarga(p.played_at), p.matchday ? `Jornada ${p.matchday}` : ''].filter(Boolean).join('  ·  ')

  return (
    <div style={{ maxWidth: 760 }}>
      {/* Encabezado */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 20 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '1.15rem', fontWeight: 700, color: INK, letterSpacing: '-.01em' }}>Informes arbitrales</div>
          <div style={{ fontSize: '.8rem', color: MUTED, lineHeight: 1.5, marginTop: 4 }}>
            Lo que el árbitro deja escrito al cerrar un partido.
          </div>
        </div>
        <button onClick={() => setRecarga(n => n + 1)} aria-label="Actualizar informes" title="Actualizar"
          style={{ width: 40, height: 40, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', border: `1px solid ${LINE}`, borderRadius: 10, cursor: 'pointer', color: MUTED, fontSize: '1.05rem' }}>
          ↻
        </button>
      </div>

      {error && <div style={{ background: '#fdf2f1', border: '1px solid #f5d0cd', color: '#b3261e', borderRadius: 10, padding: '10px 14px', fontSize: '.8rem', marginBottom: 16 }}>{error}</div>}

      {/* Pestañas en una sola fila */}
      <div role="tablist" style={{ display: 'flex', gap: 22, overflowX: 'auto', borderBottom: `1px solid ${LINE}`, marginBottom: 18, scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
        {pestañas.map(([k, texto, n]) => {
          const on = filtro === k
          return (
            <button key={k} role="tab" aria-selected={on} onClick={() => setFiltro(k)}
              style={{ flexShrink: 0, minHeight: 44, padding: '0 2px', background: 'none', border: 'none', borderBottom: on ? `2px solid ${INK}` : '2px solid transparent', marginBottom: -1, cursor: 'pointer', fontSize: '.84rem', fontWeight: on ? 700 : 500, color: on ? INK : MUTED, whiteSpace: 'nowrap' }}>
              {texto} <span style={{ fontWeight: 500, color: on ? MUTED : '#9aa0a6', marginLeft: 3 }}>{n}</span>
            </button>
          )
        })}
      </div>

      {filtro !== 'sin' && (
        <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar equipo, árbitro o palabra"
          aria-label="Buscar en los informes"
          style={{ width: '100%', boxSizing: 'border-box', height: 44, padding: '0 14px', border: `1px solid ${LINE}`, borderRadius: 10, fontSize: '.88rem', marginBottom: 18, background: '#fff', color: INK, outline: 'none' }}/>
      )}

      {filtro === 'sin' ? (
        sinInforme.length === 0 ? (
          <div style={{ padding: '48px 16px', textAlign: 'center', color: MUTED, fontSize: '.88rem' }}>Todos los partidos jugados tienen informe.</div>
        ) : (
          <>
            <div style={{ fontSize: '.78rem', color: MUTED, lineHeight: 1.5, marginBottom: 12 }}>
              Partidos jugados donde el árbitro no dejó informe. Es lo normal cuando no hubo roja ni novedades.
            </div>
            <div style={{ background: '#fff', border: `1px solid ${LINE}`, borderRadius: 14, overflow: 'hidden' }}>
              {sinInforme.map((p, i) => (
                <div key={p.id} style={{ padding: '16px 18px', borderTop: i > 0 ? `1px solid ${LINE}` : 'none' }}>
                  <Marcador p={p}/>
                  <div style={{ fontSize: '.76rem', color: MUTED, marginTop: 8 }}>{meta(p)}</div>
                </div>
              ))}
            </div>
          </>
        )
      ) : lista.length === 0 ? (
        <div style={{ padding: '48px 16px', textAlign: 'center', color: MUTED, fontSize: '.88rem', lineHeight: 1.5 }}>
          {conteo.todos === 0 ? 'Todavía no hay informes en este torneo.' : 'No hay informes con ese filtro.'}
        </div>
      ) : (
        <div style={{ background: '#fff', border: `1px solid ${LINE}`, borderRadius: 14, overflow: 'hidden' }}>
          {lista.map(({ mid, p, infs }, idx) => {
            const abierto = !!abiertos[mid]
            const arbs = listaArbitros(p)
            const principal = TIPOS[claveTipo(infs.find(i => claveTipo(i) === 'roja') || infs[0])]
            return (
              <div key={mid} style={{ borderTop: idx > 0 ? `1px solid ${LINE}` : 'none', position: 'relative' }}>
                <span aria-hidden="true" style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: principal.c }}/>
                <button onClick={() => setAbiertos(o => ({ ...o, [mid]: !o[mid] }))} aria-expanded={abierto}
                  style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: '18px 18px 18px 22px', display: 'block' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}><Marcador p={p} grande/></div>
                    <span aria-hidden="true" style={{ color: '#9aa0a6', fontSize: '1.1rem', lineHeight: 1, transform: abierto ? 'rotate(90deg)' : 'none', transition: 'transform .15s', flexShrink: 0, paddingTop: 2 }}>›</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px 14px', marginTop: 10 }}>
                    <span style={{ fontSize: '.76rem', color: MUTED }}>{meta(p)}</span>
                    {infs.map(i => { const T = TIPOS[claveTipo(i)]; return (
                      <span key={i.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '.76rem', fontWeight: 600, color: INK }}>
                        <Punto color={T.c}/>{T.t}
                      </span>
                    ) })}
                  </div>
                  {!abierto && (
                    <div style={{ marginTop: 10, fontSize: '.84rem', color: '#3c4043', lineHeight: 1.55, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', wordBreak: 'break-word' }}>
                      {infs[0].descripcion || '(sin texto)'}
                    </div>
                  )}
                </button>
                {abierto && (
                  <div style={{ padding: '0 18px 20px 22px' }}>
                    {infs.map((i, k) => {
                      const T = TIPOS[claveTipo(i)]
                      return (
                        <div key={i.id} style={{ borderTop: `1px solid ${LINE}`, paddingTop: 14, marginTop: k === 0 ? 0 : 14 }}>
                          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px 10px', marginBottom: 8 }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '.74rem', fontWeight: 700, color: INK, letterSpacing: '.02em' }}><Punto color={T.c}/>{T.t}</span>
                            <span style={{ fontSize: '.74rem', color: MUTED }}>{i.creado_por ? i.creado_por : 'Autor no registrado'}{i.created_at ? `  ·  ${fechaCorta(i.created_at)}` : ''}</span>
                          </div>
                          <div style={{ fontSize: '.92rem', color: INK, lineHeight: 1.65, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{i.descripcion || '(sin texto)'}</div>
                        </div>
                      )
                    })}
                    {arbs.length > 0 && (
                      <div style={{ borderTop: `1px solid ${LINE}`, marginTop: 16, paddingTop: 12, fontSize: '.76rem', color: MUTED, lineHeight: 1.5 }}>
                        Árbitros: {arbs.join(', ')}
                      </div>
                    )}
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
