import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

// Informes arbitrales de un torneo: qué partidos tienen informe y lo que escribió el árbitro.
// Los informes los crea la planilla (roja, partido terminado antes de tiempo, "otro" o cierre automático)
// en la tabla match_informes. Acá solo se leen.

const TZ = 'America/Bogota'
const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s
const diaClave = iso => iso ? new Date(iso).toLocaleDateString('en-CA', { timeZone: TZ }) : 'sin-fecha'
const diaTitulo = iso => iso ? cap(new Date(iso).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', timeZone: TZ })) : 'Sin fecha'
const hora = iso => iso ? new Date(iso).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit', timeZone: TZ }) : ''
const fechaCorta = iso => iso ? new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', timeZone: TZ }).replace(/\./g, '') : ''
const iniciales = n => (n || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase()

const INK = '#17191c'
const MUTED = '#667085'
const SOFT = '#98a2b3'
const LINE = '#e7eaee'
const FONDO = '#f6f7f9'

// Cada tipo: color de acento, tono suave de fondo e ícono
const TIPOS = {
  roja:            { t: 'Tarjeta roja',      c: '#d92d20', bg: '#fef3f2', icon: 'card' },
  terminado_antes: { t: 'Terminado antes',   c: '#c4620a', bg: '#fff6ea', icon: 'clock' },
  otro:            { t: 'Otro',              c: '#2563eb', bg: '#eff4ff', icon: 'note' },
  auto:            { t: 'Cierre automático', c: '#667085', bg: '#f2f4f7', icon: 'bolt' },
}
const esAuto = inf => (inf.creado_por || '').toLowerCase().includes('cierre autom')
const claveTipo = inf => esAuto(inf) ? 'auto' : (TIPOS[inf.tipo] ? inf.tipo : 'otro')

function Icono({ n, color = 'currentColor', size = 18 }) {
  const p = { fill: 'none', stroke: color, strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round' }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={{ flexShrink: 0 }}>
      {n === 'doc' && <g {...p}><path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5"/><path d="M10 13h6M10 17h6"/></g>}
      {n === 'card' && <rect x="7" y="3.5" width="10" height="17" rx="2.2" fill={color}/>}
      {n === 'clock' && <g {...p}><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></g>}
      {n === 'note' && <g {...p}><path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17z"/><path d="M13.5 7.5l3 3"/></g>}
      {n === 'bolt' && <g {...p}><path d="M13 3L5 13.5h6L10 21l8-10.5h-6z"/></g>}
      {n === 'off' && <g {...p}><circle cx="12" cy="12" r="8.5"/><path d="M8.5 12h7"/></g>}
      {n === 'search' && <g {...p}><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></g>}
      {n === 'refresh' && <g {...p}><path d="M20 12a8 8 0 1 1-2.4-5.7"/><path d="M20 4.5v5h-5"/></g>}
      {n === 'chev' && <g {...p}><path d="M9 6l6 6-6 6"/></g>}
    </svg>
  )
}

function Escudo({ equipo, size = 30 }) {
  const base = { width: size, height: size, borderRadius: 8, overflow: 'hidden', flexShrink: 0, background: '#fff', border: `1px solid ${LINE}` }
  if (equipo?.logo_url) return <div style={base}><img src={equipo.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }}/></div>
  return (
    <div style={{ ...base, border: 'none', background: 'linear-gradient(135deg,#2563eb,#6d3ee0)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ fontSize: size * 0.34, fontWeight: 800, color: '#fff' }}>{iniciales(equipo?.name)}</span>
    </div>
  )
}

function Etiqueta({ clave, chica }) {
  const T = TIPOS[clave]
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: chica ? '3px 9px 3px 7px' : '5px 11px 5px 9px', borderRadius: 999, background: T.bg, color: T.c, fontSize: chica ? '.7rem' : '.74rem', fontWeight: 700, whiteSpace: 'nowrap', border: `1px solid ${T.c}22` }}>
      <Icono n={T.icon} color={T.c} size={chica ? 12 : 14}/>{T.t}
    </span>
  )
}

function Marcador({ p }) {
  const jugado = p.status === 'finished' && p.home_score != null
  const fila = (eq, goles, gana, pierde) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <Escudo equipo={eq}/>
      <span style={{ flex: 1, minWidth: 0, fontSize: '.95rem', fontWeight: gana ? 800 : 600, color: pierde ? MUTED : INK, lineHeight: 1.3, wordBreak: 'break-word' }}>{eq?.name || '—'}</span>
      {jugado && <span style={{ fontSize: '1.3rem', fontWeight: 800, color: pierde ? SOFT : INK, fontVariantNumeric: 'tabular-nums', minWidth: 26, textAlign: 'right' }}>{goles}</span>}
    </div>
  )
  const l = p.home_score, v = p.away_score
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {fila(p.home, l, jugado && l > v, jugado && l < v)}
      {fila(p.away, v, jugado && v > l, jugado && v < l)}
    </div>
  )
}

export default function InformesArbitrales({ torneoId, partidos, abrirPartido = null }) {
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

  // Viene de tocar el aviso «el árbitro escribió un informe»: deja ese informe abierto y lo trae a la pantalla
  useEffect(() => {
    if (!abrirPartido || !informes || !(porPartido[abrirPartido]?.length)) return
    setFiltro('todos'); setBusca('')
    setAbiertos(o => (o[abrirPartido] ? o : { ...o, [abrirPartido]: true }))
    const t = setTimeout(() => { try { document.getElementById('informe-' + abrirPartido)?.scrollIntoView({ block: 'start', behavior: 'smooth' }) } catch { /* ignorar */ } }, 350)
    return () => clearTimeout(t)
  }, [abrirPartido, informes, porPartido])

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

  // Agrupa por día (en orden, el más reciente primero)
  const grupos = useMemo(() => {
    const out = []
    const fuente = filtro === 'sin' ? sinInforme.map(p => ({ mid: p.id, p, infs: [] })) : lista
    fuente.forEach(x => {
      const k = diaClave(x.p.played_at)
      const ult = out[out.length - 1]
      if (ult && ult.k === k) ult.items.push(x)
      else out.push({ k, titulo: diaTitulo(x.p.played_at), items: [x] })
    })
    return out
  }, [lista, sinInforme, filtro])

  if (informes === null) return <div style={{ padding: '48px 0', textAlign: 'center', color: MUTED, fontSize: '.88rem' }}>Cargando informes…</div>

  const tarjetas = [
    { k: 'todos', t: 'Informes', n: conteo.todos, c: '#17191c', bg: '#f2f4f7', icon: 'doc' },
    { k: 'roja', t: 'Tarjeta roja', n: conteo.roja, ...TIPOS.roja },
    { k: 'terminado_antes', t: 'Terminado antes', n: conteo.terminado_antes, ...TIPOS.terminado_antes },
    { k: 'otro', t: 'Otros', n: conteo.otro, ...TIPOS.otro },
    ...(conteo.auto > 0 ? [{ k: 'auto', t: 'Cierre automático', n: conteo.auto, ...TIPOS.auto }] : []),
    { k: 'sin', t: 'Sin informe', n: sinInforme.length, c: '#667085', bg: '#f2f4f7', icon: 'off' },
  ]

  return (
    <div style={{ maxWidth: 820, margin: '0 auto' }}>
      {/* Encabezado */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 22 }}>
        <div style={{ width: 46, height: 46, borderRadius: 14, background: 'linear-gradient(135deg,#17191c,#344054)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 4px 10px rgba(16,24,40,.18)' }}>
          <Icono n="doc" color="#fff" size={22}/>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: INK, letterSpacing: '-.02em', lineHeight: 1.2 }}>Informes arbitrales</div>
          <div style={{ fontSize: '.8rem', color: MUTED, lineHeight: 1.4, marginTop: 2 }}>Lo que el árbitro dejó escrito al cerrar cada partido</div>
        </div>
        <button onClick={() => setRecarga(n => n + 1)} aria-label="Actualizar informes" title="Actualizar"
          style={{ width: 44, height: 44, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', border: `1px solid ${LINE}`, borderRadius: 12, cursor: 'pointer', color: INK }}>
          <Icono n="refresh" size={19}/>
        </button>
      </div>

      {error && <div style={{ background: '#fef3f2', border: '1px solid #fecdca', color: '#b42318', borderRadius: 12, padding: '12px 16px', fontSize: '.82rem', marginBottom: 16 }}>{error}</div>}

      {/* Resumen que también filtra */}
      <div role="tablist" style={{ display: 'flex', gap: 10, overflowX: 'auto', margin: '0 -2px 18px', padding: '2px 2px 6px', scrollSnapType: 'x proximity', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
        {tarjetas.map(t => {
          const on = filtro === t.k
          return (
            <button key={t.k} role="tab" aria-selected={on} onClick={() => setFiltro(t.k)}
              style={{ scrollSnapAlign: 'start', flex: '0 0 auto', minWidth: 132, textAlign: 'left', padding: '14px 16px', borderRadius: 16, cursor: 'pointer', background: on ? t.bg : '#fff', border: on ? `1.5px solid ${t.c}` : `1px solid ${LINE}`, boxShadow: on ? `0 4px 12px ${t.c}26` : '0 1px 2px rgba(16,24,40,.04)', transition: 'all .15s' }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: on ? '#fff' : t.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                <Icono n={t.icon} color={t.c} size={17}/>
              </div>
              <div style={{ fontSize: '1.65rem', fontWeight: 800, color: INK, lineHeight: 1, letterSpacing: '-.02em', fontVariantNumeric: 'tabular-nums' }}>{t.n}</div>
              <div style={{ fontSize: '.76rem', fontWeight: 600, color: on ? t.c : MUTED, marginTop: 6, whiteSpace: 'nowrap' }}>{t.t}</div>
            </button>
          )
        })}
      </div>

      {filtro !== 'sin' && (
        <div style={{ position: 'relative', marginBottom: 20 }}>
          <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: SOFT, display: 'flex' }}><Icono n="search" size={18}/></span>
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar equipo, árbitro o palabra del informe" aria-label="Buscar en los informes"
            style={{ width: '100%', boxSizing: 'border-box', height: 48, padding: '0 14px 0 42px', border: `1px solid ${LINE}`, borderRadius: 12, fontSize: '.9rem', background: '#fff', color: INK, outline: 'none' }}/>
        </div>
      )}

      {filtro === 'sin' && sinInforme.length > 0 && (
        <div style={{ fontSize: '.8rem', color: MUTED, lineHeight: 1.5, marginBottom: 16 }}>
          Partidos ya jugados donde el árbitro no dejó informe. Es lo normal cuando no hubo roja ni novedades.
        </div>
      )}

      {grupos.length === 0 ? (
        <div style={{ background: '#fff', border: `1px dashed ${LINE}`, borderRadius: 16, padding: '56px 20px', textAlign: 'center' }}>
          <div style={{ width: 52, height: 52, borderRadius: 16, background: FONDO, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}><Icono n="doc" color={SOFT} size={24}/></div>
          <div style={{ fontSize: '.95rem', fontWeight: 700, color: INK }}>
            {filtro === 'sin' ? 'Todos los partidos tienen informe' : conteo.todos === 0 ? 'Aún no hay informes' : 'Sin resultados'}
          </div>
          <div style={{ fontSize: '.82rem', color: MUTED, marginTop: 4, lineHeight: 1.5 }}>
            {filtro === 'sin' ? 'No hay partidos jugados sin informe.' : conteo.todos === 0 ? 'Cuando un árbitro cierre un partido con novedades, su informe aparece acá.' : 'Prueba con otro filtro o con otra palabra.'}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {grupos.map(g => (
            <section key={g.k}>
              <div style={{ fontSize: '.72rem', fontWeight: 700, color: MUTED, letterSpacing: '.08em', textTransform: 'uppercase', margin: '0 4px 10px' }}>{g.titulo}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {g.items.map(({ mid, p, infs }) => {
                  if (filtro === 'sin') {
                    return (
                      <div key={mid} style={{ background: '#fff', border: `1px solid ${LINE}`, borderRadius: 16, padding: 16, boxShadow: '0 1px 2px rgba(16,24,40,.04)' }}>
                        <Marcador p={p}/>
                        <div style={{ fontSize: '.76rem', color: MUTED, marginTop: 12 }}>{[hora(p.played_at), p.matchday ? `Jornada ${p.matchday}` : ''].filter(Boolean).join('  ·  ')}</div>
                      </div>
                    )
                  }
                  const abierto = !!abiertos[mid]
                  const arbs = listaArbitros(p)
                  const claves = [...new Set(infs.map(claveTipo))]
                  const principal = TIPOS[claves.includes('roja') ? 'roja' : claves[0]]
                  const mostrar = abierto ? infs : infs.slice(0, 1)
                  return (
                    <article key={mid} id={'informe-' + mid} style={{ scrollMarginTop: 80, background: '#fff', border: `1px solid ${abierto ? principal.c + '55' : LINE}`, borderRadius: 18, overflow: 'hidden', boxShadow: abierto ? '0 8px 24px rgba(16,24,40,.08)' : '0 1px 2px rgba(16,24,40,.04)', transition: 'box-shadow .15s' }}>
                      <button onClick={() => setAbiertos(o => ({ ...o, [mid]: !o[mid] }))} aria-expanded={abierto}
                        style={{ display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
                        {/* Franja superior: tipo de informe + jornada */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', padding: '12px 16px', background: principal.bg, borderBottom: `1px solid ${principal.c}1f` }}>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{claves.map(k => <Etiqueta key={k} clave={k}/>)}</div>
                          <span style={{ fontSize: '.76rem', fontWeight: 600, color: MUTED }}>{[hora(p.played_at), p.matchday ? `Jornada ${p.matchday}` : ''].filter(Boolean).join('  ·  ')}</span>
                        </div>
                        <div style={{ padding: '18px 16px 16px' }}><Marcador p={p}/></div>
                      </button>

                      <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {mostrar.map(i => {
                          const k = claveTipo(i); const T = TIPOS[k]
                          return (
                            <div key={i.id} style={{ background: FONDO, borderRadius: 14, padding: '14px 16px', borderLeft: `3px solid ${T.c}` }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                                <div style={{ width: 28, height: 28, borderRadius: '50%', background: T.bg, color: T.c, border: `1px solid ${T.c}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '.68rem', fontWeight: 800, flexShrink: 0 }}>
                                  {k === 'auto' ? <Icono n="bolt" color={T.c} size={14}/> : iniciales(i.creado_por)}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: '.8rem', fontWeight: 700, color: INK, lineHeight: 1.25, wordBreak: 'break-word' }}>{i.creado_por || 'Autor no registrado'}</div>
                                  {(i.created_at || infs.length > 1) && (
                                    <div style={{ fontSize: '.7rem', color: MUTED, marginTop: 1 }}>{[infs.length > 1 ? T.t : '', fechaCorta(i.created_at)].filter(Boolean).join('  ·  ')}</div>
                                  )}
                                </div>
                              </div>
                              <div style={{ fontSize: '.9rem', color: '#344054', lineHeight: 1.65, whiteSpace: 'pre-wrap', wordBreak: 'break-word', ...(abierto ? {} : { display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }) }}>
                                {i.descripcion || '(sin texto)'}
                              </div>
                            </div>
                          )
                        })}

                        {abierto && arbs.length > 0 && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', paddingTop: 4 }}>
                            <span style={{ fontSize: '.72rem', fontWeight: 700, color: MUTED, letterSpacing: '.06em', textTransform: 'uppercase' }}>Árbitros</span>
                            {arbs.map(n => (
                              <span key={n} style={{ fontSize: '.78rem', fontWeight: 600, color: INK, background: '#fff', border: `1px solid ${LINE}`, borderRadius: 999, padding: '4px 11px' }}>{n}</span>
                            ))}
                          </div>
                        )}

                        <button onClick={() => setAbiertos(o => ({ ...o, [mid]: !o[mid] }))}
                          style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 4, minHeight: 40, padding: '0 2px', background: 'none', border: 'none', cursor: 'pointer', color: '#2563eb', fontSize: '.84rem', fontWeight: 700 }}>
                          {abierto ? 'Ocultar informe' : infs.length > 1 ? `Leer los ${infs.length} informes` : 'Leer informe completo'}
                          <span style={{ display: 'inline-flex', transform: abierto ? 'rotate(-90deg)' : 'rotate(90deg)', transition: 'transform .15s' }}><Icono n="chev" color="#2563eb" size={16}/></span>
                        </button>
                      </div>
                    </article>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
