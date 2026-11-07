import { useState, useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { cargarUniverso, listaRanking, INFO_RANKING, MIN_PJ_TASA } from '../lib/rankings'
import { C, Escudo, FotoJugador } from './PerfilPublicoUI'

// Ventana que se abre al tocar un puesto ("3°", "1° ranking de 177"): explica qué mide ese
// ranking y muestra la lista ordenada, con el equipo / jugador del perfil resaltado.
// p = { n, de, k, ambito, tipo, id } (lo arma lib/rankings.js)

const PRIMERAS = 20
const MAS = 30

function formatear(valor, fmt) {
  if (valor == null || Number.isNaN(valor)) return '–'
  if (fmt === 'dec') return Number(valor).toFixed(2)
  if (fmt === 'signo') return `${valor > 0 ? '+' : ''}${valor}`
  if (fmt === 'pct') return `${valor}%`
  return String(valor)
}

export default function RankingModal({ p, onClose }) {
  const navigate = useNavigate()
  const info = INFO_RANKING[p.tipo]?.[p.k] || { titulo: 'Ranking', explica: '', fmt: 'int' }
  const esEquipo = p.tipo === 'equipo'
  const [lista, setLista] = useState(null)       // { filas, total }
  const [error, setError] = useState(false)
  const [nombres, setNombres] = useState({})     // id → { name, img }
  const [torneoNombre, setTorneoNombre] = useState('')
  const [visibles, setVisibles] = useState(PRIMERAS)

  // Cerrar con Esc y no dejar que la página de atrás se mueva
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    const previo = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = previo }
  }, [onClose])

  // Al abrir, el foco pasa a la ventana (así Esc y el teclado funcionan, y quien usa lector de pantalla la encuentra)
  const botonVolver = useRef(null)
  useEffect(() => { botonVolver.current?.focus() }, [])

  // La lista sale de los mismos datos que calculan los puestos (ya están en memoria casi siempre)
  useEffect(() => {
    let vivo = true
    cargarUniverso()
      .then(u => { if (vivo) setLista(listaRanking(u, p.tipo, p.k, p.ambito)) })
      .catch(() => { if (vivo) setError(true) })
    return () => { vivo = false }
  }, [p.tipo, p.k, p.ambito])

  useEffect(() => {
    if (p.ambito === 'plataforma') return
    supabase.from('tournaments').select('name').eq('id', p.ambito).maybeSingle()
      .then(({ data }) => { if (data?.name) setTorneoNombre(data.name) })
  }, [p.ambito])

  const miIndice = useMemo(() => (lista ? lista.filas.findIndex(f => f.id === p.id) : -1), [lista, p.id])
  const mostradas = useMemo(() => {
    if (!lista) return []
    return lista.filas.slice(0, visibles)
  }, [lista, visibles])
  const yoFuera = lista && miIndice >= visibles ? lista.filas[miIndice] : null

  // Nombres y fotos solo de las filas que se ven
  useEffect(() => {
    if (!lista) return
    const ids = [...mostradas.map(f => f.id), ...(yoFuera ? [yoFuera.id] : [])].filter(id => !nombres[id])
    if (ids.length === 0) return
    let vivo = true
    ;(async () => {
      const mapa = {}
      for (let i = 0; i < ids.length; i += 100) {
        const trozo = ids.slice(i, i + 100)
        const { data } = esEquipo
          ? await supabase.from('teams').select('id, name, logo_url').in('id', trozo)
          : await supabase.from('players_publico').select('id, name, photo_url, photo_face_url').in('id', trozo)
        ;(data || []).forEach(r => { mapa[r.id] = { name: r.name, img: esEquipo ? r.logo_url : (r.photo_face_url || r.photo_url) } })
      }
      if (vivo) setNombres(prev => ({ ...prev, ...mapa }))
    })().catch(() => {})
    return () => { vivo = false }
  }, [lista, mostradas, yoFuera, esEquipo]) // eslint-disable-line react-hooks/exhaustive-deps

  const ambitoTexto = p.ambito === 'plataforma'
    ? (esEquipo ? 'Entre todos los equipos de Golmebol' : 'Entre todos los jugadores de Golmebol')
    : `Solo dentro del torneo${torneoNombre ? ` ${torneoNombre}` : ''}`

  function ir(f) {
    onClose()
    navigate(`/${esEquipo ? 'e' : 'j'}/${f.id}`)
  }

  function fila(f, resaltar) {
    const n = nombres[f.id]
    const medalla = f.puesto === 1 ? C.gold : f.puesto <= 3 ? C.win : C.muted
    return (
      <button key={f.id} type="button" onClick={() => ir(f)}
        style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '9px 14px', border: 'none', borderBottom: `1px solid ${C.soft}`, background: resaltar ? 'rgba(111,207,61,.13)' : 'transparent', color: C.text, fontFamily: 'inherit', textAlign: 'left', cursor: 'pointer', minHeight: 52 }}>
        <span style={{ width: 34, flexShrink: 0, textAlign: 'center', fontWeight: 900, fontSize: '.86rem', color: medalla }}>{f.puesto}°</span>
        {esEquipo ? <Escudo url={n?.img} nombre={n?.name} size={32} radio={8}/> : <FotoJugador url={n?.img} nombre={n?.name} size={32}/>}
        <span style={{ flex: 1, minWidth: 0, fontSize: '.86rem', fontWeight: resaltar ? 800 : 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {n?.name || '…'}{resaltar && <span style={{ display: 'block', fontSize: '.6rem', fontWeight: 800, color: C.green, letterSpacing: '.04em' }}>{esEquipo ? 'ESTE EQUIPO' : 'ESTE JUGADOR'}</span>}
        </span>
        <span style={{ flexShrink: 0, fontWeight: 900, fontSize: '.95rem', color: resaltar ? C.green : '#fff' }}>{formatear(f.valor, info.fmt)}</span>
      </button>
    )
  }

  const ancho = typeof window !== 'undefined' && window.innerWidth >= 700

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={`Ranking: ${info.titulo}`}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,.72)', display: 'flex', alignItems: ancho ? 'center' : 'flex-end', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 520, maxHeight: ancho ? '82vh' : '88vh', background: C.card, border: `1px solid ${C.border}`, borderRadius: ancho ? 18 : '18px 18px 0 0', display: 'flex', flexDirection: 'column', overflow: 'hidden', color: C.text }}>
        {/* Cabecera fija: qué ranking es y botón para volver */}
        <div style={{ padding: '12px 14px 12px 8px', borderBottom: `1px solid ${C.border}`, background: C.card2, display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <button ref={botonVolver} type="button" onClick={onClose} aria-label="Cerrar ranking"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 2, minHeight: 44, padding: '0 10px 0 4px', border: 'none', background: 'transparent', color: C.green, fontWeight: 800, fontSize: '.82rem', fontFamily: 'inherit', cursor: 'pointer' }}>
            <ChevronLeft size={20}/> Volver
          </button>
          <div style={{ flex: 1, minWidth: 0, textAlign: 'right', fontSize: '.64rem', fontWeight: 800, letterSpacing: '.08em', color: C.muted, textTransform: 'uppercase' }}>Ranking</div>
        </div>

        <div style={{ overflowY: 'auto', WebkitOverflowScrolling: 'touch', flex: 1 }}>
          <div style={{ padding: '16px 16px 12px' }}>
            <div style={{ fontSize: '1.15rem', fontWeight: 900, lineHeight: 1.2 }}>{info.titulo}</div>
            <div style={{ marginTop: 4, fontSize: '.74rem', fontWeight: 700, color: C.green }}>{ambitoTexto}</div>
            <p style={{ margin: '10px 0 0', fontSize: '.8rem', lineHeight: 1.5, color: C.text2 }}>{info.explica}</p>
            <p style={{ margin: '6px 0 0', fontSize: '.72rem', lineHeight: 1.5, color: C.muted }}>
              Si dos tienen el mismo valor, comparten el puesto.
              {info.min ? ` Solo cuentan los que han jugado al menos ${MIN_PJ_TASA} partidos, para que un solo partido no deje a nadie de 1°.` : ''}
            </p>
            <div style={{ marginTop: 12, display: 'inline-flex', alignItems: 'baseline', gap: 6, background: 'rgba(111,207,61,.13)', border: '1px solid rgba(111,207,61,.35)', borderRadius: 12, padding: '8px 12px' }}>
              <span style={{ fontSize: '1.3rem', fontWeight: 900, color: C.green }}>{p.n}°</span>
              <span style={{ fontSize: '.76rem', color: C.text2 }}>de {p.de} {esEquipo ? 'equipos' : 'jugadores'}</span>
            </div>
          </div>

          <div style={{ borderTop: `1px solid ${C.border}` }}>
            {error && <div style={{ padding: '28px 16px', textAlign: 'center', color: C.muted, fontSize: '.84rem' }}>No se pudo cargar el ranking. Revisa tu conexión e intenta de nuevo.</div>}
            {!error && !lista && <div style={{ padding: '28px 16px', textAlign: 'center', color: C.muted, fontSize: '.84rem' }}>Cargando ranking…</div>}
            {lista && lista.filas.length === 0 && <div style={{ padding: '28px 16px', textAlign: 'center', color: C.muted, fontSize: '.84rem' }}>Todavía no hay datos para este ranking.</div>}
            {mostradas.map(f => fila(f, f.id === p.id))}
            {yoFuera && (
              <>
                <div style={{ padding: '4px 0', textAlign: 'center', color: C.faint, fontSize: '.8rem', letterSpacing: '.3em' }}>···</div>
                {fila(yoFuera, true)}
              </>
            )}
            {lista && lista.filas.length > visibles && (
              <button type="button" onClick={() => setVisibles(v => v + MAS)}
                style={{ display: 'block', width: '100%', minHeight: 48, border: 'none', background: 'transparent', color: C.green, fontWeight: 800, fontSize: '.84rem', fontFamily: 'inherit', cursor: 'pointer' }}>
                Ver más ({lista.filas.length - visibles} restantes)
              </button>
            )}
          </div>
        </div>

        <div style={{ padding: '10px 14px', borderTop: `1px solid ${C.border}`, background: C.card2, flexShrink: 0 }}>
          <button type="button" onClick={onClose}
            style={{ width: '100%', minHeight: 46, borderRadius: 12, border: `1px solid ${C.border}`, background: 'rgba(255,255,255,.06)', color: '#fff', fontWeight: 800, fontSize: '.86rem', fontFamily: 'inherit', cursor: 'pointer' }}>
            Cerrar
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
