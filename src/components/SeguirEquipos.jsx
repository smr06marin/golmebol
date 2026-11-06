import { useState, useEffect, useRef } from 'react'
import { Search, X, Plus, Check, Bell, BellRing } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useFavoritos } from '../lib/favoritos'
import { useAvisos, plataformaAvisos } from '../lib/avisos'
import { mensajeMotivo } from '../lib/avisosTextos'

// ── "Sigue a tu equipo" ─────────────────────────────────────────────────────
// Se abre en "★ Mis equipos" (Partidos de la página de inicio). La persona escribe el nombre de su equipo, toca
// «Seguir» y ya lo sigue: no tiene que buscar la estrellita en las tablas. Debajo ve la lista limpia de los equipos
// que sigue y, si aún no tiene los avisos, un botón discreto para activarlos.
// Los equipos seguidos se guardan en el celular (lib/favoritos.js): no hace falta cuenta.

const S = { card: '#161616', border: '#2a2a2a', green: '#6fcf3d', text: '#fff', muted: '#8a8a8a', red: '#e5433d' }

function Escudo({ logo_url, name, size = 36 }) {
  const iniciales = (name || '?').split(/\s+/).map(w => w[0]).join('').substring(0, 2).toUpperCase()
  return (
    <div style={{ width: size, height: size, borderRadius: 9, background: '#fff', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {logo_url
        ? <img src={logo_url} alt="" loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 3 }}/>
        : <span style={{ fontSize: size * .34, fontWeight: 800, color: '#1a3a8a' }}>{iniciales}</span>}
    </div>
  )
}

export default function SeguirEquipos() {
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

  async function pedirAvisos() {
    if (activando) return
    setActivando(true); setErrorAvisos('')
    const r = await activar()
    setActivando(false)
    if (!r.ok) setErrorAvisos(mensajeMotivo(r.motivo, plataformaAvisos()))
  }

  const visibles = buscable ? resultados : []
  const etiqueta = { fontSize: '.68rem', fontWeight: 800, letterSpacing: '.08em', color: S.muted, margin: '16px 0 4px' }

  return (
    <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 16, padding: '16px 14px 14px', marginBottom: 14 }}>
      <div style={{ fontWeight: 800, fontSize: '1rem', lineHeight: 1.2 }}>{ids.length === 0 ? 'Sigue a tu equipo' : 'Buscar otro equipo'}</div>
      <div style={{ color: S.muted, fontSize: '.78rem', lineHeight: 1.4, margin: '3px 0 12px' }}>Escribe su nombre y toca «Seguir». Aquí verás solo sus partidos y resultados.</div>

      <div style={{ position: 'relative' }}>
        <Search size={18} color={S.muted} style={{ position: 'absolute', left: 14, top: 14, pointerEvents: 'none' }}/>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Nombre del equipo" aria-label="Buscar equipo para seguir"
          autoComplete="off" autoCorrect="off" enterKeyHint="search"
          style={{ width: '100%', boxSizing: 'border-box', minHeight: 46, borderRadius: 12, border: `1px solid ${S.border}`, background: '#0f0f0f', color: S.text, fontSize: '1rem', padding: '0 42px 0 42px', outline: 'none', fontFamily: 'inherit' }}/>
        {q && (
          <button type="button" onClick={() => setQ('')} aria-label="Borrar búsqueda"
            style={{ position: 'absolute', right: 3, top: 3, width: 40, height: 40, border: 'none', background: 'transparent', color: S.muted, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><X size={18}/></button>
        )}
      </div>

      {buscable && (
        <div style={{ marginTop: 6 }}>
          {buscando && visibles.length === 0 && <div style={{ color: S.muted, fontSize: '.82rem', padding: '12px 2px' }}>Buscando…</div>}
          {!buscando && visibles.length === 0 && <div style={{ color: S.muted, fontSize: '.82rem', padding: '12px 2px', lineHeight: 1.45 }}>No encontramos un equipo con ese nombre. Prueba con otra parte del nombre.</div>}
          {visibles.map(e => {
            const sigue = esFavorito(e.id)
            return (
              <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 0', borderTop: `1px solid ${S.border}` }}>
                <Escudo logo_url={e.logo_url} name={e.name}/>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: '.88rem', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.name}</div>
                  <div style={{ color: S.muted, fontSize: '.7rem', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {e.torneo}{e.mas > 0 ? ` +${e.mas}` : ''}{e.city ? ` · ${e.city}` : ''}
                  </div>
                </div>
                <button type="button" onClick={() => alternar(e.id)} aria-pressed={sigue} aria-label={sigue ? `Dejar de seguir a ${e.name}` : `Seguir a ${e.name}`}
                  style={{ flexShrink: 0, minHeight: 40, minWidth: 96, borderRadius: 10, padding: '0 12px', border: sigue ? `1px solid ${S.border}` : 'none', background: sigue ? 'transparent' : S.green, color: sigue ? S.muted : '#0a1a05', fontWeight: 800, fontSize: '.8rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5, fontFamily: 'inherit' }}>
                  {sigue ? <><Check size={15}/> Siguiendo</> : <><Plus size={15}/> Seguir</>}
                </button>
              </div>
            )
          })}
        </div>
      )}

      {!buscable && seguidosVisibles.length > 0 && (
        <>
          <div style={etiqueta}>EQUIPOS QUE SIGUES</div>
          <div>
            {seguidosVisibles.map(e => (
              <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderTop: `1px solid ${S.border}` }}>
                <Escudo logo_url={e.logo_url} name={e.name} size={32}/>
                <span style={{ flex: 1, minWidth: 0, fontWeight: 700, fontSize: '.86rem', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.name}</span>
                <button type="button" onClick={() => alternar(e.id)} aria-label={`Dejar de seguir a ${e.name}`}
                  style={{ flexShrink: 0, minHeight: 40, padding: '0 10px', border: 'none', background: 'transparent', color: S.muted, fontSize: '.76rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontFamily: 'inherit' }}><X size={15}/> Quitar</button>
              </div>
            ))}
          </div>
        </>
      )}

      {!buscable && ids.length > 0 && (
        avisosOn ? (
          <div style={{ marginTop: 10, borderTop: `1px solid ${S.border}`, paddingTop: 12, display: 'flex', alignItems: 'center', gap: 8, color: S.muted, fontSize: '.76rem', fontWeight: 600 }}><BellRing size={15} color={S.green}/> Avisos activados para tus equipos</div>
        ) : (
          <div style={{ marginTop: 10, borderTop: `1px solid ${S.border}`, paddingTop: 12 }}>
            <button type="button" onClick={pedirAvisos} disabled={activando}
              style={{ width: '100%', minHeight: 46, borderRadius: 12, border: `1px solid ${S.green}`, background: 'transparent', color: S.green, fontWeight: 800, fontSize: '.86rem', cursor: activando ? 'default' : 'pointer', opacity: activando ? .7 : 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: 'inherit' }}>
              <Bell size={16}/> {activando ? 'Activando…' : 'Avisarme cuando jueguen'}
            </button>
            {errorAvisos && <div style={{ background: 'rgba(229,67,61,.12)', border: `1px solid ${S.red}`, color: '#ffb4b0', borderRadius: 10, padding: '10px 12px', fontSize: '.78rem', lineHeight: 1.45, marginTop: 10 }}>{errorAvisos}</div>}
          </div>
        )
      )}
    </div>
  )
}
