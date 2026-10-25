import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { generarPortada, canvasABlob } from '../lib/portadaYoutube'
import { idsPartidosDeStream } from '../lib/liveMatch'
import { Image as IconoImagen, Download, ChevronDown, ChevronUp } from 'lucide-react'

// Portada de YouTube de UNA transmisión (1280x720): escudos grandes de los partidos que se
// abren desde esa transmisión, nombre del torneo arriba, los equipos escritos debajo y GOLMEBOL al final. Los partidos son los que
// se eligieron en la transmisión; si la transmisión sigue un torneo solo (torneo_auto), son los
// partidos de la cancha de ese torneo del día más próximo. Se pueden quitar los que no van.
//
// props: stream  (la transmisión: { match_ids | match_id | torneo_auto, cancha_auto, titulo })
const S = { card: '#161616', border: '#2a2a2a', green: '#6fcf3d', text: '#fff', muted: '#9aa0a6' }
const COLS = 'id, played_at, tournament_id, cancha_id, status, home:home_team_id(name,logo_url), away:away_team_id(name,logo_url), tournaments(name, logo_url)'
const fechaLocal = iso => (iso ? new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }) : '')
const horaLocal = iso => (iso ? new Date(iso).toLocaleTimeString('es-CO', { timeZone: 'America/Bogota', hour: '2-digit', minute: '2-digit' }) : '')

async function traerPartidos(stream) {
  const ids = idsPartidosDeStream(stream)
  if (ids.length) {
    const { data, error } = await supabase.from('matches').select(COLS).in('id', ids)
    if (error) throw error
    return (data || []).sort((a, b) => String(a.played_at || '').localeCompare(String(b.played_at || '')))
  }
  if (stream.torneo_auto) {
    const inicioHoy = new Date(`${fechaLocal(new Date().toISOString())}T00:00:00-05:00`).toISOString()
    let q = supabase.from('matches').select(COLS).eq('tournament_id', stream.torneo_auto).gte('played_at', inicioHoy).order('played_at', { ascending: true }).limit(40)
    if (stream.cancha_auto) q = q.eq('cancha_id', stream.cancha_auto)
    const { data, error } = await q
    if (error) throw error
    const dia = fechaLocal(data?.[0]?.played_at)
    return (data || []).filter(m => fechaLocal(m.played_at) === dia)
  }
  return []
}

export default function PortadaYouTubeEnVivo({ stream }) {
  const [abierto, setAbierto] = useState(false)
  const [partidos, setPartidos] = useState(null) // null = sin cargar
  const [elegidos, setElegidos] = useState({})
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState(null)
  const [vista, setVista] = useState(null) // { url, canvas }
  const [armando, setArmando] = useState(false)

  async function cargar() {
    setCargando(true); setError(null)
    try {
      const lista = await traerPartidos(stream)
      setPartidos(lista)
      setElegidos(Object.fromEntries(lista.slice(0, 6).map(m => [m.id, true])))
    } catch (e) {
      setError('No se pudieron traer los partidos' + (e?.message ? ` — ${e.message}` : ''))
    } finally { setCargando(false) }
  }

  function alternar() {
    const nuevo = !abierto
    setAbierto(nuevo)
    if (nuevo && partidos === null) cargar()
  }

  const marcados = (partidos || []).filter(m => elegidos[m.id])
  const claveMarcados = marcados.map(m => m.id).join(',')

  useEffect(() => {
    if (!abierto || !marcados.length) return undefined
    let vigente = true
    Promise.resolve().then(() => { if (vigente) setArmando(true) })
    generarPortada({ torneo: marcados[0].tournaments, partidos: marcados })
      .then(canvas => { if (vigente) setVista({ url: canvas.toDataURL('image/png'), canvas }) })
      .catch(() => { if (vigente) setError('No se pudo armar la portada') })
      .finally(() => { if (vigente) setArmando(false) })
    return () => { vigente = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- depende de qué partidos están marcados (claveMarcados)
  }, [abierto, claveMarcados])

  async function descargar() {
    if (!vista?.canvas) return
    const { blob, ext } = await canvasABlob(vista.canvas)
    if (!blob) { setError('No se pudo guardar la imagen. Si los escudos vienen de otra página, vuelve a intentar.'); return }
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `portada-${(stream.titulo || 'transmision').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}.${ext}`
    document.body.appendChild(a); a.click(); a.remove()
    setTimeout(() => URL.revokeObjectURL(a.href), 4000)
  }

  return (
    <div style={{ background: '#0a0a0a', border: `1px solid ${S.border}`, borderRadius: '10px', padding: '12px 14px', marginTop: '14px' }}>
      <button type="button" onClick={alternar}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', background: 'none', border: 'none', cursor: 'pointer', color: S.text, padding: 0, textAlign: 'left' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '.8rem' }}>
          <IconoImagen size={15} color={S.green}/> PORTADA DE YOUTUBE — con los partidos de esta transmisión
        </span>
        {abierto ? <ChevronUp size={18} color={S.muted}/> : <ChevronDown size={18} color={S.muted}/>}
      </button>

      {abierto && (
        <div style={{ marginTop: '12px' }}>
          {cargando && <div style={{ fontSize: '.8rem', color: S.muted }}>Buscando los partidos…</div>}
          {error && <div style={{ padding: '8px 10px', borderRadius: '8px', background: 'rgba(229,67,61,.18)', color: '#ff8a84', fontSize: '.78rem', fontWeight: 700, marginBottom: '10px' }}>{error}</div>}
          {partidos && !partidos.length && !cargando && (
            <div style={{ fontSize: '.8rem', color: S.muted, lineHeight: 1.5 }}>
              No hay partidos para esta transmisión. Elige los partidos en la transmisión{stream.torneo_auto ? ' (o espera a que el torneo tenga partidos programados)' : ''} y vuelve a abrir esto.
              <div style={{ marginTop: '8px' }}>
                <button type="button" onClick={cargar} style={{ padding: '6px 12px', background: '#2a2a2a', border: `1px solid ${S.border}`, borderRadius: '8px', color: S.text, fontSize: '.76rem', fontWeight: 700, cursor: 'pointer' }}>Buscar de nuevo</button>
              </div>
            </div>
          )}
          {partidos && partidos.length > 0 && (
            <>
              <div style={{ fontSize: '.72rem', color: S.muted, marginBottom: '8px' }}>
                Marca los partidos que van en la portada (hasta 6): sus escudos salen grandes a la izquierda y los equipos escritos debajo del nombre del torneo.
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '12px' }}>
                {partidos.map(m => {
                  const marcado = !!elegidos[m.id]
                  const llenos = marcados.length >= 6 && !marcado
                  return (
                    <label key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '.78rem', color: llenos ? S.muted : S.text, cursor: llenos ? 'not-allowed' : 'pointer' }}>
                      <input type="checkbox" checked={marcado} disabled={llenos} onChange={e => setElegidos(el => ({ ...el, [m.id]: e.target.checked }))}/>
                      <span style={{ color: S.muted, minWidth: '54px' }}>{horaLocal(m.played_at)}</span>
                      <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.home?.name} vs. {m.away?.name}</span>
                    </label>
                  )
                })}
              </div>
              {armando && !vista && <div style={{ fontSize: '.8rem', color: S.muted }}>Armando la portada…</div>}
              {!marcados.length && <div style={{ fontSize: '.8rem', color: S.muted }}>Marca al menos un partido.</div>}
              {vista && marcados.length > 0 && (
                <>
                  <img src={vista.url} alt="Portada de YouTube" style={{ display: 'block', width: '100%', maxWidth: '560px', borderRadius: '8px', border: `1px solid ${S.border}` }}/>
                  <button type="button" onClick={descargar}
                    style={{ marginTop: '10px', display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '9px 14px', background: S.green, border: 'none', borderRadius: '8px', color: '#0a0a0a', fontSize: '.8rem', fontWeight: 800, cursor: 'pointer' }}>
                    <Download size={14}/> Descargar portada (1280×720)
                  </button>
                  <div style={{ marginTop: '6px', fontSize: '.7rem', color: S.muted }}>Súbela como miniatura cuando programes la transmisión en YouTube Studio.</div>
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
