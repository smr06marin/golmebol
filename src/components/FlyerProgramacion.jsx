import { useRef, useState, useMemo } from 'react'
import { Calendar, Clock, MapPin, Download, X, ChevronLeft, ChevronRight, Trophy, AtSign } from 'lucide-react'

const POR_PAGINA = 10
const VERDE = '#22c55e'

// Deja primero los partidos sin jugar, ordenados por fecha/hora ascendente
// (los sin fecha van al final); para los jugados, orden cronológico también.
function ordenarPartidos(lista, modo) {
  const filtrados = lista.filter(p => modo === 'jugados' ? p.status === 'finished' : p.status !== 'finished')
  return [...filtrados].sort((a, b) => {
    if (!a.played_at && !b.played_at) return 0
    if (!a.played_at) return 1
    if (!b.played_at) return -1
    return new Date(a.played_at) - new Date(b.played_at)
  })
}

function trocear(lista, tam) {
  const paginas = []
  for (let i = 0; i < lista.length; i += tam) paginas.push(lista.slice(i, i + tam))
  return paginas.length ? paginas : [[]]
}

async function esperarImagenes(container) {
  if (!container) return
  const imgs = Array.from(container.querySelectorAll('img'))
  await Promise.all(imgs.map(img => img.complete ? Promise.resolve() : new Promise(res => { img.onload = img.onerror = res })))
}

function EscudoCirculo({ logo_url, name, size = 40 }) {
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: '#fff', border: `2px solid ${VERDE}`, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
      {logo_url
        ? <img src={logo_url} crossOrigin="anonymous" style={{ width: '82%', height: '82%', objectFit: 'contain' }}/>
        : <Trophy size={size * 0.42} color="#1a3a8a"/>}
    </div>
  )
}

function FilaPartido({ p }) {
  const esJugado = p.status === 'finished'
  const fecha = p.played_at ? new Date(p.played_at).toLocaleDateString('es-CO', { weekday: 'short', day: '2-digit', month: 'short' }) : 'Por definir'
  const hora  = p.played_at ? new Date(p.played_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) : ''

  return (
    <div style={{ background: '#161616', border: '1px solid rgba(255,255,255,.08)', borderRadius: '14px', padding: '12px 14px', marginBottom: '10px' }}>
      {p.matchday && (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(34,197,94,.15)', border: `1px solid ${VERDE}`, borderRadius: '20px', padding: '2px 10px', marginBottom: '9px' }}>
          <Calendar size={10} color={VERDE}/>
          <span style={{ fontSize: '9px', fontWeight: '800', color: VERDE, letterSpacing: '.5px' }}>FECHA {p.matchday}</span>
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '7px', justifyContent: 'flex-end' }}>
          <span style={{ color: '#fff', fontWeight: '700', fontSize: '12px', textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.home?.name || 'Por definir'}</span>
          <EscudoCirculo logo_url={p.home?.logo_url} name={p.home?.name}/>
        </div>
        {esJugado ? (
          <div style={{ flexShrink: 0, background: VERDE, borderRadius: '8px', padding: '4px 12px', fontWeight: '900', fontSize: '13px', color: '#06120a' }}>
            {p.home_score} - {p.away_score}
          </div>
        ) : (
          <div style={{ flexShrink: 0, background: VERDE, borderRadius: '20px', padding: '4px 12px', fontWeight: '900', fontSize: '11px', color: '#06120a', letterSpacing: '.5px' }}>VS</div>
        )}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '7px' }}>
          <EscudoCirculo logo_url={p.away?.logo_url} name={p.away?.name}/>
          <span style={{ color: '#fff', fontWeight: '700', fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.away?.name || 'Por definir'}</span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center', marginTop: '9px', paddingTop: '9px', borderTop: '1px solid rgba(255,255,255,.06)' }}>
        {hora && <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '9.5px', color: 'rgba(255,255,255,.6)' }}><Clock size={10} color="rgba(255,255,255,.45)"/>{hora}</span>}
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '9.5px', color: 'rgba(255,255,255,.6)' }}><Calendar size={10} color="rgba(255,255,255,.45)"/>{fecha}</span>
        {p.location && <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '9.5px', color: 'rgba(255,255,255,.6)' }}><MapPin size={10} color="rgba(255,255,255,.45)"/>{p.location}</span>}
      </div>
    </div>
  )
}

export default function FlyerProgramacion({ torneo, equipos, partidos, onClose }) {
  const flyerRef = useRef(null)
  const [descargando, setDescargando] = useState(false)
  const [modo, setModo] = useState(() => {
    const hayProximos = partidos.some(p => p.status !== 'finished')
    return hayProximos ? 'proximos' : 'jugados'
  })
  const [pagina, setPagina] = useState(0)

  const ordenados = useMemo(() => ordenarPartidos(partidos, modo), [partidos, modo])
  const paginas = useMemo(() => trocear(ordenados, POR_PAGINA), [ordenados])
  const totalPaginas = paginas.length
  const paginaActual = Math.min(pagina, totalPaginas - 1)
  const items = paginas[paginaActual] || []

  function cambiarModo(m) { setModo(m); setPagina(0) }

  async function descargarPagina(idx) {
    await esperarImagenes(flyerRef.current)
    const { default: html2canvas } = await import('html2canvas')
    const canvas = await html2canvas(flyerRef.current, { scale: 3, useCORS: true, allowTaint: true, backgroundColor: null })
    const link = document.createElement('a')
    const base = (torneo?.name || 'golmebol').replace(/\s+/g, '_')
    const tipo = modo === 'jugados' ? 'resultados' : 'programacion'
    link.download = totalPaginas > 1 ? `${base}_${tipo}_pag${idx + 1}de${totalPaginas}.png` : `${base}_${tipo}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  async function handleDescargarActual() {
    setDescargando(true)
    try { await descargarPagina(paginaActual) } finally { setDescargando(false) }
  }

  async function handleDescargarTodas() {
    setDescargando(true)
    try {
      for (let i = 0; i < totalPaginas; i++) {
        setPagina(i)
        // esperar a que React pinte la página i antes de capturarla
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
        await new Promise(r => setTimeout(r, 200))
        await descargarPagina(i)
        await new Promise(r => setTimeout(r, 250))
      }
    } finally { setDescargando(false) }
  }

  const titulo = modo === 'jugados' ? 'PARTIDOS JUGADOS' : 'PRÓXIMOS PARTIDOS'

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: '#fff', borderRadius: '16px', padding: '24px', maxWidth: '600px', width: '100%', maxHeight: '92vh', overflow: 'auto' }}>

        {/* Controles */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
          <span style={{ fontWeight: '600', color: '#202124', fontSize: '.9rem' }}>Flyer de programación</span>
          <button onClick={onClose} style={{ background: 'none', border: '1px solid #dadce0', borderRadius: '8px', padding: '8px', cursor: 'pointer', color: '#5f6368', display: 'flex', alignItems: 'center' }}>
            <X size={16}/>
          </button>
        </div>

        {/* Toggle próximos / jugados */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
          {['proximos', 'jugados'].map(m => (
            <button key={m} onClick={() => cambiarModo(m)}
              style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '.82rem', fontWeight: '600', background: modo === m ? '#1a73e8' : '#fff', color: modo === m ? '#fff' : '#5f6368', border: modo === m ? 'none' : '1px solid #dadce0' }}>
              {m === 'proximos' ? 'Próximos partidos' : 'Partidos jugados'}
            </button>
          ))}
        </div>

        {items.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', color: '#9aa0a6', background: '#f8f9fa', borderRadius: '12px' }}>
            No hay {modo === 'jugados' ? 'partidos jugados' : 'próximos partidos'} para mostrar.
          </div>
        ) : (
          <>
            {/* Paginador */}
            {totalPaginas > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '12px' }}>
                <button onClick={() => setPagina(p => Math.max(0, p - 1))} disabled={paginaActual === 0}
                  style={{ background: 'none', border: '1px solid #dadce0', borderRadius: '8px', padding: '6px', cursor: paginaActual === 0 ? 'default' : 'pointer', color: '#5f6368', opacity: paginaActual === 0 ? .4 : 1, display: 'flex' }}>
                  <ChevronLeft size={16}/>
                </button>
                <span style={{ fontSize: '.8rem', color: '#5f6368', fontWeight: '600' }}>Página {paginaActual + 1} de {totalPaginas}</span>
                <button onClick={() => setPagina(p => Math.min(totalPaginas - 1, p + 1))} disabled={paginaActual === totalPaginas - 1}
                  style={{ background: 'none', border: '1px solid #dadce0', borderRadius: '8px', padding: '6px', cursor: paginaActual === totalPaginas - 1 ? 'default' : 'pointer', color: '#5f6368', opacity: paginaActual === totalPaginas - 1 ? .4 : 1, display: 'flex' }}>
                  <ChevronRight size={16}/>
                </button>
              </div>
            )}

            {/* FLYER */}
            <div ref={flyerRef} style={{
              width: '480px', maxWidth: '100%', margin: '0 auto',
              background: '#0a0a0a', fontFamily: "'Arial Black', 'Impact', sans-serif",
              padding: '22px 20px', boxSizing: 'border-box',
            }}>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '14px' }}>
                <div style={{ width: '58px', height: '58px', borderRadius: '50%', background: '#fff', border: `3px solid ${VERDE}`, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                  {torneo?.logo_url
                    ? <img src={torneo.logo_url} crossOrigin="anonymous" style={{ width: '86%', height: '86%', objectFit: 'contain' }}/>
                    : <Trophy size={26} color="#1a3a8a"/>}
                </div>
                <div style={{ background: 'rgba(34,197,94,.15)', border: `1.5px solid ${VERDE}`, borderRadius: '20px', padding: '5px 14px', textAlign: 'center' }}>
                  <span style={{ color: VERDE, fontSize: '11px', fontWeight: '900', letterSpacing: '.5px' }}>{equipos.length} EQUIPO{equipos.length !== 1 ? 'S' : ''}</span>
                </div>
              </div>

              <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                <div style={{ color: '#fff', fontSize: '21px', fontWeight: '900', letterSpacing: '.5px', textTransform: 'uppercase', lineHeight: 1.2 }}>
                  {torneo?.name || 'Torneo'}
                </div>
                {(torneo?.categoria || torneo?.modalidad) && (
                  <div style={{ color: 'rgba(255,255,255,.5)', fontSize: '11px', fontWeight: '700', letterSpacing: '1px', marginTop: '4px', textTransform: 'uppercase' }}>
                    {[torneo?.modalidad, torneo?.categoria].filter(Boolean).join(' · ')}
                  </div>
                )}
                <div style={{ width: '90px', height: '3px', background: VERDE, margin: '10px auto 0', borderRadius: '2px' }}/>
              </div>

              <div style={{ textAlign: 'center', marginBottom: '14px' }}>
                <span style={{ display: 'inline-block', background: VERDE, color: '#06120a', fontSize: '12px', fontWeight: '900', letterSpacing: '1px', padding: '5px 16px', borderRadius: '6px' }}>{titulo}</span>
              </div>

              {/* Lista de partidos */}
              <div>
                {items.map(p => <FilaPartido key={p.id} p={p}/>)}
              </div>

              {/* Footer */}
              <div style={{ textAlign: 'center', marginTop: '16px', paddingTop: '14px', borderTop: '1px solid rgba(255,255,255,.1)' }}>
                <div style={{ color: '#fff', fontSize: '12px', fontWeight: '800', letterSpacing: '.5px' }}>golmebol.com</div>
                <div style={{ color: 'rgba(255,255,255,.45)', fontSize: '9px', fontWeight: '700', letterSpacing: '1.5px', marginTop: '4px' }}>PASIÓN · RESPETO · COMPETENCIA</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', marginTop: '6px' }}>
                  <AtSign size={11} color="rgba(255,255,255,.5)"/>
                  <span style={{ color: 'rgba(255,255,255,.5)', fontSize: '9.5px', fontWeight: '600' }}>@golmebol</span>
                </div>
              </div>
            </div>

            {/* Descargar */}
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '18px', flexWrap: 'wrap' }}>
              <button onClick={handleDescargarActual} disabled={descargando}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#1a73e8', border: 'none', borderRadius: '8px', padding: '9px 16px', cursor: 'pointer', color: '#fff', fontSize: '.85rem', fontWeight: '600', opacity: descargando ? .7 : 1 }}>
                <Download size={16}/> {descargando ? 'Generando...' : totalPaginas > 1 ? `Descargar página ${paginaActual + 1}` : 'Descargar'}
              </button>
              {totalPaginas > 1 && (
                <button onClick={handleDescargarTodas} disabled={descargando}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#fff', border: '1px solid #1a73e8', borderRadius: '8px', padding: '9px 16px', cursor: 'pointer', color: '#1a73e8', fontSize: '.85rem', fontWeight: '600', opacity: descargando ? .7 : 1 }}>
                  <Download size={16}/> Descargar las {totalPaginas} páginas
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
