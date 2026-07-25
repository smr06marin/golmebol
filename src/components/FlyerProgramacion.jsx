import { useRef, useState, useMemo } from 'react'
import { Calendar, Clock, MapPin, Download, X, ChevronLeft, ChevronRight, Trophy } from 'lucide-react'

const POR_PAGINA = 10
const VERDE = '#9ACD32'
const VERDE_OSCURO = '#6b9c1f'

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

function formatFecha(fecha) {
  return fecha.toLocaleDateString('es-CO', { day: 'numeric', month: 'long' }).toUpperCase()
}
function formatHora(fecha) {
  let h = fecha.getHours()
  const m = fecha.getMinutes()
  const suf = h >= 12 ? 'P.M.' : 'A.M.'
  h = h % 12; if (h === 0) h = 12
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} ${suf}`
}

function EscudoCirculo({ logo_url, size = 30 }) {
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: '#f1f1f1', border: '1.5px solid #ddd', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
      {logo_url
        ? <img src={logo_url} crossOrigin="anonymous" style={{ width: '84%', height: '84%', objectFit: 'contain' }}/>
        : <Trophy size={size * 0.45} color="#999"/>}
    </div>
  )
}

function FilaPartido({ p }) {
  const esJugado = p.status === 'finished'
  const fechaObj = p.played_at ? new Date(p.played_at) : null

  return (
    <div style={{ position: 'relative', background: '#fff', border: '1px solid #ececec', borderRadius: '12px', padding: '14px 12px 10px', marginBottom: '14px', boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}>
      {/* Etiqueta FECHA — ribete superior izquierdo */}
      <div style={{ position: 'absolute', top: '-9px', left: '10px', display: 'flex', alignItems: 'center', gap: '3px', background: '#111', borderRadius: '7px', padding: '3px 8px' }}>
        <Calendar size={8} color={VERDE}/>
        <span style={{ fontSize: '8px', fontWeight: '900', color: '#fff', letterSpacing: '.4px' }}>
          {p.matchday ? `FECHA ${p.matchday}` : 'PARTIDO'}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end' }}>
          <span style={{ color: '#111', fontWeight: '800', fontSize: '10.5px', textAlign: 'right', textTransform: 'uppercase', lineHeight: 1.15 }}>{p.home?.name || 'Por definir'}</span>
          <EscudoCirculo logo_url={p.home?.logo_url}/>
        </div>
        {esJugado ? (
          <div style={{ flexShrink: 0, background: VERDE, borderRadius: '7px', padding: '4px 10px', fontWeight: '900', fontSize: '12px', color: '#0d1a03' }}>
            {p.home_score} - {p.away_score}
          </div>
        ) : (
          <div style={{ flexShrink: 0, background: VERDE, borderRadius: '7px', padding: '4px 11px', fontWeight: '900', fontSize: '10.5px', color: '#0d1a03', letterSpacing: '.5px' }}>VS</div>
        )}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
          <EscudoCirculo logo_url={p.away?.logo_url}/>
          <span style={{ color: '#111', fontWeight: '800', fontSize: '10.5px', textTransform: 'uppercase', lineHeight: 1.15 }}>{p.away?.name || 'Por definir'}</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center', marginTop: '8px' }}>
        {fechaObj && <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '8.5px', fontWeight: '700', color: '#666' }}><Calendar size={9} color="#999"/>{formatFecha(fechaObj)}</span>}
        {fechaObj && <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '8.5px', fontWeight: '700', color: '#666' }}><Clock size={9} color="#999"/>{formatHora(fechaObj)}</span>}
        {p.location && <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '8.5px', fontWeight: '700', color: '#666' }}><MapPin size={9} color="#999"/>{p.location}</span>}
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
    const canvas = await html2canvas(flyerRef.current, { scale: 2, useCORS: true, allowTaint: true, backgroundColor: '#ffffff' })
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
  const subtitulo = [torneo?.modalidad, torneo?.season || torneo?.categoria].filter(Boolean).join(' · ')

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
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

            {/* FLYER — proporción tipo historia de Instagram (ancho fijo 540 -> 1080 al exportar con scale 2) */}
            <div ref={flyerRef} style={{
              width: '540px', maxWidth: '100%', margin: '0 auto',
              background: '#fff', fontFamily: "'Arial Black', 'Impact', sans-serif",
              overflow: 'hidden', borderRadius: '4px',
            }}>
              {/* Header negro */}
              <div style={{ background: '#0a0a0a', padding: '26px 26px 22px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '18px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: '#fff', border: `2.5px solid ${VERDE}`, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                      {torneo?.logo_url
                        ? <img src={torneo.logo_url} crossOrigin="anonymous" style={{ width: '86%', height: '86%', objectFit: 'contain' }}/>
                        : <Trophy size={24} color="#1a3a8a"/>}
                    </div>
                    <span style={{ color: VERDE, fontSize: '13px', fontWeight: '900', letterSpacing: '1px' }}>GOLMEBOL</span>
                  </div>
                  <div style={{ background: '#111', border: `1.5px solid ${VERDE}`, borderRadius: '10px', padding: '6px 14px', textAlign: 'center', minWidth: '58px' }}>
                    <div style={{ color: VERDE, fontSize: '17px', fontWeight: '900', lineHeight: 1 }}>{equipos.length}</div>
                    <div style={{ color: '#fff', fontSize: '8px', fontWeight: '800', letterSpacing: '.5px', marginTop: '2px' }}>EQUIPO{equipos.length !== 1 ? 'S' : ''}</div>
                  </div>
                </div>

                <div style={{ textAlign: 'center' }}>
                  <div style={{ color: '#fff', fontSize: '26px', fontWeight: '900', letterSpacing: '.5px', textTransform: 'uppercase', lineHeight: 1.15, textShadow: `0 0 18px rgba(154,205,50,.35)` }}>
                    {torneo?.name || 'Torneo'}
                  </div>
                  {subtitulo && (
                    <div style={{ color: VERDE, fontSize: '11px', fontWeight: '800', letterSpacing: '2px', marginTop: '6px', textTransform: 'uppercase' }}>
                      {subtitulo}
                    </div>
                  )}
                  <div style={{ width: '100px', height: '3px', background: `linear-gradient(90deg, transparent, ${VERDE}, transparent)`, margin: '12px auto 0' }}/>
                </div>
              </div>

              {/* Título de sección */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '18px 24px 4px' }}>
                <div style={{ flex: 1, borderTop: `2px dashed ${VERDE_OSCURO}` }}/>
                <span style={{ color: '#111', fontSize: '14px', fontWeight: '900', letterSpacing: '1px', whiteSpace: 'nowrap' }}>{titulo}</span>
                <div style={{ flex: 1, borderTop: `2px dashed ${VERDE_OSCURO}` }}/>
              </div>

              {/* Lista de partidos */}
              <div style={{ padding: '14px 20px 4px', background: '#fafafa' }}>
                {items.map(p => <FilaPartido key={p.id} p={p}/>)}
              </div>

              {/* Footer negro */}
              <div style={{ background: '#0a0a0a', textAlign: 'center', padding: '18px 20px' }}>
                <div style={{ color: '#fff', fontSize: '13px', fontWeight: '900', letterSpacing: '.5px' }}>golmebol.com</div>
                <div style={{ color: 'rgba(255,255,255,.55)', fontSize: '9px', fontWeight: '700', letterSpacing: '1.5px', marginTop: '5px' }}>PASIÓN · RESPETO · COMPETENCIA</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginTop: '8px' }}>
                  {['IG', 'FB', 'TT'].map(s => (
                    <div key={s} style={{ width: '16px', height: '16px', borderRadius: '50%', border: `1px solid ${VERDE}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ color: VERDE, fontSize: '6px', fontWeight: '900' }}>{s}</span>
                    </div>
                  ))}
                  <span style={{ color: 'rgba(255,255,255,.6)', fontSize: '9.5px', fontWeight: '700', marginLeft: '4px' }}>@golmebol</span>
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
