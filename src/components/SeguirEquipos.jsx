import { useState, useEffect, useMemo, useRef } from 'react'
import { Search, X, Star, Plus, Check, BellRing } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useFavoritos } from '../lib/favoritos'
import { useAvisos, plataformaAvisos } from '../lib/avisos'
import { mensajeMotivo } from '../lib/avisosTextos'

// ── "Sigue a tu equipo" ─────────────────────────────────────────────────────
// Se abre en "★ Mis equipos" (Partidos de la página de inicio). La persona escribe el nombre de su equipo, lo toca
// y ya lo sigue: no tiene que buscar la estrellita en las tablas. También ve los equipos que juegan hoy para
// seguirlos con un toque, y la invitación a activar los avisos apenas sigue el primero.
// Los equipos seguidos se guardan en el celular (lib/favoritos.js): no hace falta cuenta.
//
// sugeridos: equipos que juegan en el día que se está viendo [{ id, name, logo_url }]

const S = { card: '#161616', card2: '#1c1c1c', border: '#2a2a2a', green: '#6fcf3d', gold: '#f5a623', text: '#fff', muted: '#8a8a8a', red: '#e5433d' }

function Escudo({ logo_url, name, size = 40 }) {
  const iniciales = (name || '?').split(/\s+/).map(w => w[0]).join('').substring(0, 2).toUpperCase()
  return (
    <div style={{ width: size, height: size, borderRadius: 11, background: '#fff', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {logo_url
        ? <img src={logo_url} alt="" loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 3 }}/>
        : <span style={{ fontSize: size * .34, fontWeight: 800, color: '#1a3a8a' }}>{iniciales}</span>}
    </div>
  )
}

export default function SeguirEquipos({ sugeridos = [] }) {
  const { ids, esFavorito, alternar } = useFavoritos()
  const { activo: avisosOn, activar } = useAvisos()
  const [q, setQ] = useState('')
  const [resultados, setResultados] = useState([])
  const [buscando, setBuscando] = useState(false)
  const [seguidos, setSeguidos] = useState([])
  const [errorAvisos, setErrorAvisos] = useState('')
  const [activando, setActivando] = useState(false)
  const turno = useRef(0)

  const consulta = q.trim()
  const buscable = consulta.length >= 2

  // Búsqueda por nombre (con una pausita para no consultar en cada letra)
  useEffect(() => {
    if (!buscable) return
    const mio = ++turno.current
    const t = setTimeout(async () => {
      setBuscando(true)
      try {
        const patron = consulta.replace(/[%_,()]/g, ' ').trim()
        const { data: eq } = await supabase.from('teams').select('id, name, logo_url, city').ilike('name', `%${patron}%`).limit(15)
        const idsEq = (eq || []).map(t => t.id)
        const { data: tt } = idsEq.length
          ? await supabase.from('tournament_teams').select('team_id, tournaments(name, status, archivado)').in('team_id', idsEq)
          : { data: [] }
        if (mio !== turno.current) return
        const porEquipo = new Map()
        ;(tt || []).forEach(r => {
          const lista = porEquipo.get(r.team_id) || []
          if (r.tournaments?.name) lista.push({ nombre: r.tournaments.name, vigente: r.tournaments.status === 'active' && !r.tournaments.archivado })
          porEquipo.set(r.team_id, lista)
        })
        // Solo equipos que están en algún torneo (así no salen escuelas ni equipos sueltos)
        const lista = (eq || []).filter(e => porEquipo.has(e.id)).map(e => {
          const torneos = porEquipo.get(e.id).sort((a, b) => Number(b.vigente) - Number(a.vigente))
          return { ...e, torneo: torneos[0]?.nombre || '', mas: Math.max(0, torneos.length - 1), vigente: !!torneos[0]?.vigente }
        }).sort((a, b) => Number(b.vigente) - Number(a.vigente) || (a.name || '').localeCompare(b.name || ''))
        setResultados(lista)
      } catch { if (mio === turno.current) setResultados([]) }
      if (mio === turno.current) setBuscando(false)
    }, 300)
    return () => clearTimeout(t)
  }, [consulta, buscable])

  // Nombre y escudo de los equipos que ya sigue
  const idsKey = ids.join(',')
  useEffect(() => {
    if (!idsKey) return
    let cancelado = false
    const t = setTimeout(() => {
      supabase.from('teams').select('id, name, logo_url').in('id', idsKey.split(',')).then(({ data }) => {
        if (!cancelado) setSeguidos((data || []).sort((a, b) => (a.name || '').localeCompare(b.name || '')))
      }, () => {})
    }, 0)
    return () => { cancelado = true; clearTimeout(t) }
  }, [idsKey])
  const seguidosVisibles = idsKey ? seguidos.filter(e => ids.includes(e.id)) : []

  const sugeridosLibres = useMemo(() => sugeridos.filter(e => e?.id && !ids.includes(e.id)).slice(0, 8), [sugeridos, ids])

  async function pedirAvisos() {
    if (activando) return
    setActivando(true); setErrorAvisos('')
    const r = await activar()
    setActivando(false)
    if (!r.ok) setErrorAvisos(mensajeMotivo(r.motivo, plataformaAvisos()))
  }

  const visibles = buscable ? resultados : []

  return (
    <div style={{ background: 'linear-gradient(160deg, #1a2410 0%, #161616 55%)', border: `1px solid ${S.green}55`, borderRadius: 18, padding: '18px 16px 16px', marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <span style={{ width: 46, height: 46, borderRadius: 14, background: 'rgba(245,166,35,.16)', border: `1px solid ${S.gold}66`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Star size={24} color={S.gold} fill={S.gold}/>
        </span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 900, fontSize: '1.1rem', lineHeight: 1.15 }}>Sigue a tu equipo</div>
          <div style={{ color: S.muted, fontSize: '.8rem', lineHeight: 1.35, marginTop: 2 }}>Aquí verás solo sus partidos y resultados.</div>
        </div>
      </div>

      <div style={{ position: 'relative' }}>
        <Search size={18} color={S.muted} style={{ position: 'absolute', left: 14, top: 15, pointerEvents: 'none' }}/>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Escribe el nombre de tu equipo…" aria-label="Buscar equipo para seguir"
          autoComplete="off" autoCorrect="off" enterKeyHint="search"
          style={{ width: '100%', boxSizing: 'border-box', minHeight: 50, borderRadius: 14, border: `1px solid ${S.border}`, background: '#0f0f0f', color: S.text, fontSize: '1rem', padding: '0 44px 0 42px', outline: 'none', fontFamily: 'inherit' }}/>
        {q && (
          <button type="button" onClick={() => setQ('')} aria-label="Borrar búsqueda"
            style={{ position: 'absolute', right: 4, top: 5, width: 40, height: 40, border: 'none', background: 'transparent', color: S.muted, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><X size={18}/></button>
        )}
      </div>

      {buscable && (
        <div style={{ marginTop: 10 }}>
          {buscando && visibles.length === 0 && <div style={{ color: S.muted, fontSize: '.82rem', padding: '10px 2px' }}>Buscando…</div>}
          {!buscando && visibles.length === 0 && <div style={{ color: S.muted, fontSize: '.82rem', padding: '10px 2px', lineHeight: 1.45 }}>No encontramos un equipo con ese nombre. Prueba con otra parte del nombre.</div>}
          {visibles.map(e => {
            const sigue = esFavorito(e.id)
            return (
              <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 2px', borderTop: `1px solid ${S.border}` }}>
                <Escudo logo_url={e.logo_url} name={e.name}/>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: '.92rem', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.name}</div>
                  <div style={{ color: S.muted, fontSize: '.72rem', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {e.torneo}{e.mas > 0 ? ` +${e.mas}` : ''}{e.city ? ` · ${e.city}` : ''}
                  </div>
                </div>
                <button type="button" onClick={() => alternar(e.id)} aria-pressed={sigue} aria-label={sigue ? `Dejar de seguir a ${e.name}` : `Seguir a ${e.name}`}
                  style={{ flexShrink: 0, minHeight: 44, minWidth: 98, borderRadius: 999, padding: '0 14px', border: sigue ? `1px solid ${S.green}` : 'none', background: sigue ? 'rgba(111,207,61,.14)' : S.green, color: sigue ? S.green : '#0a1a05', fontWeight: 900, fontSize: '.8rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5, fontFamily: 'inherit' }}>
                  {sigue ? <><Check size={15}/> Siguiendo</> : <><Plus size={15}/> Seguir</>}
                </button>
              </div>
            )
          })}
        </div>
      )}

      {!buscable && sugeridosLibres.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: '.7rem', fontWeight: 800, letterSpacing: '.08em', color: S.muted, marginBottom: 8 }}>JUEGAN ESTE DÍA · TOCA PARA SEGUIR</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {sugeridosLibres.map(e => (
              <button key={e.id} type="button" onClick={() => alternar(e.id)} aria-label={`Seguir a ${e.name}`}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minHeight: 44, maxWidth: '100%', padding: '0 12px 0 6px', borderRadius: 999, border: `1px solid ${S.border}`, background: S.card2, color: S.text, fontWeight: 700, fontSize: '.8rem', cursor: 'pointer', fontFamily: 'inherit' }}>
                <Escudo logo_url={e.logo_url} name={e.name} size={30}/>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{e.name}</span>
                <Plus size={15} color={S.green} style={{ flexShrink: 0 }}/>
              </button>
            ))}
          </div>
        </div>
      )}

      {seguidosVisibles.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: '.7rem', fontWeight: 800, letterSpacing: '.08em', color: S.muted, marginBottom: 8 }}>EQUIPOS QUE SIGUES</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {seguidosVisibles.map(e => (
              <span key={e.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minHeight: 44, maxWidth: '100%', padding: '0 4px 0 6px', borderRadius: 999, border: `1px solid ${S.gold}77`, background: 'rgba(245,166,35,.1)', fontWeight: 800, fontSize: '.8rem' }}>
                <Escudo logo_url={e.logo_url} name={e.name} size={30}/>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{e.name}</span>
                <button type="button" onClick={() => alternar(e.id)} aria-label={`Dejar de seguir a ${e.name}`}
                  style={{ width: 36, height: 36, border: 'none', background: 'transparent', color: S.muted, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}><X size={16}/></button>
              </span>
            ))}
          </div>
        </div>
      )}

      {ids.length > 0 && !avisosOn && (
        <div style={{ marginTop: 16, background: 'rgba(111,207,61,.09)', border: `1px solid ${S.green}55`, borderRadius: 14, padding: '12px 14px' }}>
          <div style={{ fontWeight: 800, fontSize: '.88rem', lineHeight: 1.3 }}>¿Quieres que te avisemos cuando juegue?</div>
          <div style={{ color: S.muted, fontSize: '.76rem', lineHeight: 1.4, marginTop: 3 }}>Te llega una notificación con la hora, los cambios y el resultado de tus equipos.</div>
          <button type="button" onClick={pedirAvisos} disabled={activando}
            style={{ marginTop: 10, width: '100%', minHeight: 48, borderRadius: 12, border: 'none', background: S.green, color: '#0a1a05', fontWeight: 900, fontSize: '.9rem', cursor: activando ? 'default' : 'pointer', opacity: activando ? .7 : 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: 'inherit' }}>
            <BellRing size={17}/> {activando ? 'Activando…' : 'Activar avisos de mis equipos'}
          </button>
          {errorAvisos && <div style={{ background: 'rgba(229,67,61,.12)', border: `1px solid ${S.red}`, color: '#ffb4b0', borderRadius: 10, padding: '10px 12px', fontSize: '.78rem', lineHeight: 1.45, marginTop: 10 }}>{errorAvisos}</div>}
        </div>
      )}
      {ids.length > 0 && avisosOn && (
        <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 8, color: S.green, fontSize: '.78rem', fontWeight: 700 }}><BellRing size={15}/> Avisos activados: te avisamos de tus equipos.</div>
      )}
    </div>
  )
}
