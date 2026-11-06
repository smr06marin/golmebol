import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, X, Plus, Check, ChevronRight, ChevronDown } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useFavoritosTorneos } from '../lib/favoritosTorneos'
import { prefetchTorneoPublico, propsPrefetchTorneo } from '../lib/torneoPublicoDatos'

// ── "Mis torneos" ───────────────────────────────────────────────────────────
// Se abre en "Mis torneos" (Partidos de la página de inicio). La persona elige los torneos que quiere seguir
// (toca «Seguir») y en esa pestaña solo ve los partidos de esos torneos. Arriba aparecen los que ya sigue y
// debajo los demás torneos activos, con un buscador por si hay muchos. Se guardan en el celular
// (lib/favoritosTorneos.js): no hace falta cuenta.

const S = { card: '#161616', border: '#2a2a2a', green: '#6fcf3d', text: '#fff', muted: '#8a8a8a' }
const LIMITE = 20

const norm = x => (x || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

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

export default function SeguirTorneos() {
  const navigate = useNavigate()
  const { ids, esFavorito, alternar } = useFavoritosTorneos()
  // "Otros torneos" va cerrado (solo se abre al tocarlo). Si todavía no sigue ninguno, la lista va abierta para poder elegir.
  const [otrosAbierto, setOtrosAbierto] = useState(() => ids.length === 0)
  const [lista, setLista] = useState(null) // null = cargando
  const [q, setQ] = useState('')

  useEffect(() => {
    let cancelado = false
    supabase.from('tournaments').select('id, name, logo_url, archivado').eq('status', 'active').then(({ data }) => {
      if (!cancelado) setLista((data || []).filter(t => !t.archivado).sort((a, b) => (a.name || '').localeCompare(b.name || '')))
    }, () => { if (!cancelado) setLista([]) })
    return () => { cancelado = true }
  }, [])

  const consulta = norm(q.trim())
  const { seguidos, otros, hayMas } = useMemo(() => {
    const todos = lista || []
    const seg = todos.filter(t => ids.includes(t.id))
    let resto = todos.filter(t => !ids.includes(t.id))
    if (consulta) resto = resto.filter(t => norm(t.name).includes(consulta))
    const recorta = !consulta && resto.length > LIMITE
    return { seguidos: consulta ? [] : seg, otros: recorta ? resto.slice(0, LIMITE) : resto, hayMas: recorta }
  }, [lista, ids, consulta])

  const etiqueta = { fontSize: '.68rem', fontWeight: 800, letterSpacing: '.08em', color: S.muted, margin: '16px 0 4px' }

  const fila = t => {
    const sigue = esFavorito(t.id)
    return (
      <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 0', borderTop: `1px solid ${S.border}` }}>
        <button type="button" onClick={() => { prefetchTorneoPublico(t.id); navigate('/t/' + t.id) }} aria-label={`Ver el torneo ${t.name}`} {...propsPrefetchTorneo(t.id)}
          style={{ flex: 1, minWidth: 0, minHeight: 40, display: 'flex', alignItems: 'center', gap: 12, background: 'none', border: 'none', padding: 0, color: 'inherit', fontFamily: 'inherit', textAlign: 'left', cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}>
          <Escudo logo_url={t.logo_url} name={t.name}/>
          <span style={{ flex: 1, minWidth: 0, fontWeight: 700, fontSize: '.88rem', lineHeight: 1.25, overflow: 'hidden', display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2, wordBreak: 'break-word' }}>{t.name}</span>
          <ChevronRight size={16} color={S.muted} style={{ flexShrink: 0 }}/>
        </button>
        <button type="button" onClick={() => alternar(t.id)} aria-pressed={sigue} aria-label={sigue ? `Dejar de seguir ${t.name}` : `Seguir ${t.name}`}
          style={{ flexShrink: 0, minHeight: 40, minWidth: 96, borderRadius: 10, padding: '0 12px', border: sigue ? `1px solid ${S.border}` : 'none', background: sigue ? 'transparent' : S.green, color: sigue ? S.muted : '#0a1a05', fontWeight: 800, fontSize: '.8rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5, fontFamily: 'inherit' }}>
          {sigue ? <><Check size={15}/> Siguiendo</> : <><Plus size={15}/> Seguir</>}
        </button>
      </div>
    )
  }

  return (
    <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 16, padding: '16px 14px 12px', marginBottom: 14 }}>
      <div style={{ fontWeight: 800, fontSize: '1rem', lineHeight: 1.2 }}>{ids.length === 0 ? 'Elige tus torneos' : 'Tus torneos'}</div>
      <div style={{ color: S.muted, fontSize: '.78rem', lineHeight: 1.4, margin: '3px 0 12px' }}>Toca «Seguir» en los torneos que te interesan. Aquí verás solo sus partidos y resultados.</div>

      {lista && lista.length > 8 && (
        <div style={{ position: 'relative' }}>
          <Search size={18} color={S.muted} style={{ position: 'absolute', left: 14, top: 14, pointerEvents: 'none' }}/>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar torneo" aria-label="Buscar torneo para seguir"
            autoComplete="off" autoCorrect="off" enterKeyHint="search"
            style={{ width: '100%', boxSizing: 'border-box', minHeight: 46, borderRadius: 12, border: `1px solid ${S.border}`, background: '#0f0f0f', color: S.text, fontSize: '1rem', padding: '0 42px 0 42px', outline: 'none', fontFamily: 'inherit' }}/>
          {q && (
            <button type="button" onClick={() => setQ('')} aria-label="Borrar búsqueda"
              style={{ position: 'absolute', right: 3, top: 3, width: 40, height: 40, border: 'none', background: 'transparent', color: S.muted, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><X size={18}/></button>
          )}
        </div>
      )}

      {lista === null && <div style={{ color: S.muted, fontSize: '.82rem', padding: '14px 2px' }}>Cargando torneos…</div>}
      {lista && lista.length === 0 && <div style={{ color: S.muted, fontSize: '.82rem', padding: '14px 2px' }}>No hay torneos activos en este momento.</div>}

      {seguidos.length > 0 && (
        <>
          <div style={etiqueta}>TORNEOS QUE SIGUES</div>
          {seguidos.map(fila)}
        </>
      )}
      {otros.length > 0 && (
        <>
          {!consulta && (
            <button type="button" onClick={() => setOtrosAbierto(v => !v)} aria-expanded={otrosAbierto}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', minHeight: 44, margin: '8px 0 0', padding: '0 2px', background: 'none', border: 'none', borderTop: seguidos.length > 0 ? `1px solid ${S.border}` : 'none', color: S.muted, fontFamily: 'inherit', cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}>
              <span style={{ fontSize: '.68rem', fontWeight: 800, letterSpacing: '.08em' }}>{seguidos.length > 0 ? 'OTROS TORNEOS' : 'TORNEOS ACTIVOS'}{!otrosAbierto && ` (${otros.length}${hayMas ? '+' : ''})`}</span>
              <ChevronDown size={18} style={{ transition: 'transform .2s', transform: otrosAbierto ? 'rotate(180deg)' : 'rotate(0deg)' }}/>
            </button>
          )}
          {(consulta || otrosAbierto) && <div style={consulta ? { marginTop: 6 } : undefined}>{otros.map(fila)}</div>}
        </>
      )}
      {consulta && lista && otros.length === 0 && <div style={{ color: S.muted, fontSize: '.82rem', padding: '12px 2px' }}>No encontramos un torneo con ese nombre.</div>}
      {hayMas && otrosAbierto && <div style={{ color: S.muted, fontSize: '.74rem', padding: '10px 2px 2px' }}>Escribe en el buscador para ver los demás torneos.</div>}
    </div>
  )
}
