import { useEffect, useRef, useState } from 'react'
import { PlayCircle, Table2, ListOrdered, Users, Megaphone, Film, Image as IconoImagen, X } from 'lucide-react'
import { TABLA_POR_PARTE } from './enVivoUI'
import { ID_TODOS_BANNERS, todosLosBanners } from '../lib/patrocinadorDisparo'

// "Mesa de mezclas": el panel para manejar la transmisión en vivo, igual en el
// celular (link de control) y en /admin/config-sitio. Todo en una sola pantalla,
// en bloques de botones grandes tipo consola de TV:
//   · EN PANTALLA   — chips de lo que está saliendo ahora, con una X para quitar cada uno
//   · REPETICIÓN    — un solo botón (avisa "Enviada" unos segundos)
//   · GRÁFICAS      — Tabla / Goles / Jugadores (+ qué parte de la tabla si hay más de 10 equipos)
//   · PATROCINADORES — Banners de todos, y por patrocinador: Presenta (logo) y Video
// Un botón ENCENDIDO se pone verde con su luz prendida (es lo que se está viendo); tocarlo otra vez lo apaga.
// No hay botón "Ninguna": si no hay nada en verde, no hay nada en pantalla.
//
// Props:
//   control            en_vivo_control[streamId] (overlay, tabla_pagina, ...)
//   tieneTorneo        hay torneo para la tabla · puedeGraficaPartido: hay (o habrá) partido para goles/jugadores
//   tablaTotal         cantidad de equipos de la tabla que se muestra (para las partes)
//   patrocinadores     lista de la transmisión · activoPatrocinador: { id, tipo } o null
//   repeticionEnTransmision  true si la repetición sale dentro del video (cambia el texto de ayuda)
//   onRepeticion(false) · onOverlay(overlay | null) · onPagina(pag|null)
//   onMostrarPatrocinador(id, tipo, tamano) · onApagarPatrocinador()

const CSS = `
.mc{--g:#6fcf3d;--r:#e5433d;--m:#8b8f96;--b:#2a2a2e;font-family:'Barlow Condensed',system-ui,sans-serif;color:#fff}
.mc *{box-sizing:border-box}
.mc-lbl{font-weight:700;font-size:.8rem;letter-spacing:.16em;color:var(--m);text-transform:uppercase}
.mc-bank{margin-top:12px;background:#151517;border:1px solid var(--b);border-radius:18px;padding:10px}
.mc-h{display:flex;justify-content:space-between;align-items:center;gap:8px;margin:0 2px 8px;flex-wrap:wrap}
.mc-grid{display:grid;gap:8px}
.mc-pad{width:100%;position:relative;border-radius:12px;min-height:66px;background:linear-gradient(180deg,#26262a,#1a1a1d);border:1px solid #36363c;box-shadow:0 3px 0 #0b0b0c;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;font:800 1rem 'Barlow Condensed',system-ui,sans-serif;letter-spacing:.07em;text-transform:uppercase;color:#d7d9de;padding:8px 4px;cursor:pointer;transition:transform .08s,box-shadow .08s;-webkit-tap-highlight-color:transparent;text-align:center;line-height:1.05}
.mc-pad:active:not(:disabled){transform:translateY(2px);box-shadow:0 1px 0 #0b0b0c}
.mc-pad:disabled{opacity:.38;cursor:not-allowed}
.mc-pad svg{width:22px;height:22px}
.mc-led{position:absolute;top:7px;right:8px;width:8px;height:8px;border-radius:50%;background:#3a3a40}
.mc-pad.on{background:linear-gradient(180deg,#7ad84a,#4fae24);color:#08150a;border-color:#8be25a;box-shadow:0 3px 0 #2f6b12,0 0 22px rgba(111,207,61,.3)}
.mc-pad.on .mc-led{background:#fff;box-shadow:0 0 8px #fff}
.mc-pad.rep{background:linear-gradient(180deg,#e85a54,#c4332d);color:#fff;border-color:#f07a75;box-shadow:0 3px 0 #7d1e1a;min-height:78px;font-size:1.2rem}
.mc-pad.sent{background:linear-gradient(180deg,#26262a,#1a1a1d);color:var(--g);border-color:var(--g);box-shadow:0 3px 0 #0b0b0c}
.mc-pad small{font-weight:600;font-size:.68rem;letter-spacing:.12em;opacity:.75}
.mc-pad img{height:28px;max-width:88%;object-fit:contain}
.mc-pad .mc-thumb{background:#fff;border-radius:4px;padding:2px 5px}
.mc-chip{display:inline-flex;align-items:center;gap:6px;background:rgba(111,207,61,.12);border:1px solid rgba(111,207,61,.4);color:var(--g);border-radius:999px;padding:3px 4px 3px 11px;font:800 .85rem 'Barlow Condensed',system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase}
.mc-chip button{width:24px;height:24px;border-radius:50%;border:none;background:rgba(111,207,61,.25);color:var(--g);display:flex;align-items:center;justify-content:center;cursor:pointer;padding:0}
.mc-chip button svg{width:12px;height:12px;stroke-width:3}
.mc-pill{padding:5px 11px;border-radius:999px;border:1px solid var(--b);background:transparent;color:var(--m);font:700 .78rem 'Barlow Condensed',system-ui,sans-serif;letter-spacing:.1em;text-transform:uppercase;cursor:pointer}
.mc-pill.on{border-color:var(--g);background:rgba(111,207,61,.15);color:var(--g)}
`

function Pad({ on = false, disabled = false, clase = '', onClick, title, children }) {
  return (
    <button type="button" className={`mc-pad${on ? ' on' : ''}${clase ? ` ${clase}` : ''}`} disabled={disabled} onClick={onClick} title={title}>
      <i className="mc-led"/>
      {children}
    </button>
  )
}

export default function MesaControlEnVivo({
  control = {}, tieneTorneo = false, puedeGraficaPartido = false, tablaTotal = 0,
  patrocinadores = [], activoPatrocinador = null, repeticionEnTransmision = false,
  onRepeticion, onOverlay, onPagina, onMostrarPatrocinador, onApagarPatrocinador,
}) {
  const [tamano, setTamano] = useState('auto')
  const [enviada, setEnviada] = useState(false) // el botón queda en "Enviada" unos segundos
  const timerEnvio = useRef(null)
  useEffect(() => () => clearTimeout(timerEnvio.current), [])

  function lanzar() {
    if (enviada) return
    onRepeticion?.(false)
    setEnviada(true)
    timerEnvio.current = setTimeout(() => setEnviada(false), 4000)
  }

  const overlay = control.overlay || null
  const partes = tablaTotal > TABLA_POR_PARTE ? Math.ceil(tablaTotal / TABLA_POR_PARTE) : 0
  const pagina = Number.isFinite(Number(control.tabla_pagina)) && Number(control.tabla_pagina) >= 1 && Number(control.tabla_pagina) <= partes ? Math.floor(Number(control.tabla_pagina)) : null

  const nBanners = todosLosBanners(patrocinadores).length
  const hayVideo = patrocinadores.some(p => p.video_url)
  const esActivo = (id, tipo) => !!activoPatrocinador && activoPatrocinador.id === id && activoPatrocinador.tipo === tipo
  const pulsar = (id, tipo) => (esActivo(id, tipo) ? onApagarPatrocinador?.() : onMostrarPatrocinador?.(id, tipo, tamano))

  // Chips "EN PANTALLA"
  const NOMBRES_GRAFICA = { tabla: 'Tabla', goles: 'Goles', jugadores: 'Jugadores' }
  const chips = []
  if (overlay && NOMBRES_GRAFICA[overlay]) {
    const extra = overlay === 'tabla' && partes ? ` · ${pagina ? `parte ${pagina}/${partes}` : 'automática'}` : ''
    chips.push({ clave: 'overlay', texto: `${NOMBRES_GRAFICA[overlay]}${extra}`, quitar: () => onOverlay?.(null) })
  }
  if (activoPatrocinador) {
    const sp = patrocinadores.find(p => p.id === activoPatrocinador.id)
    const texto = activoPatrocinador.id === ID_TODOS_BANNERS ? 'Banners'
      : `${sp?.nombre || 'Patrocinador'} · ${activoPatrocinador.tipo === 'video' ? 'Video' : 'Presenta'}`
    chips.push({ clave: 'sp', texto, quitar: () => onApagarPatrocinador?.() })
  }

  return (
    <div className="mc">
      <style>{CSS}</style>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', minHeight: '32px' }}>
        <span className="mc-lbl">En pantalla</span>
        {chips.length === 0 && <span style={{ fontSize: '.95rem', color: '#6b6f76', fontWeight: 600 }}>nada por ahora</span>}
        {chips.map(c => (
          <span key={c.clave} className="mc-chip">{c.texto}<button type="button" onClick={c.quitar} aria-label={`Quitar ${c.texto}`}><X/></button></span>
        ))}
      </div>

      <div className="mc-bank">
        <div className="mc-h">
          <span className="mc-lbl">Repetición</span>
          <span className="mc-lbl" style={{ letterSpacing: '.08em', textTransform: 'none', fontWeight: 600, fontSize: '.78rem' }}>
            {repeticionEnTransmision ? 'sale dentro de la transmisión, unos segundos después' : 'devuélvete con la barra del video y aprieta'}
          </span>
        </div>
        <Pad clase={enviada ? 'sent' : 'rep'} onClick={lanzar}>
          <PlayCircle/>{enviada ? 'Enviada ✓' : 'Repetición'}
          <small>{enviada ? 'ya viene…' : repeticionEnTransmision ? 'ÚLTIMOS 12 S' : 'DESDE DONDE PAUSASTE'}</small>
        </Pad>
      </div>

      <div className="mc-bank">
        <div className="mc-h"><span className="mc-lbl">Gráficas</span><span className="mc-lbl" style={{ letterSpacing: '.08em', textTransform: 'none', fontWeight: 600, fontSize: '.78rem' }}>verde = en pantalla · toca otra vez para quitar</span></div>
        <div className="mc-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
          <Pad on={overlay === 'tabla'} disabled={!tieneTorneo} onClick={() => onOverlay?.(overlay === 'tabla' ? null : 'tabla')} title={tieneTorneo ? '' : 'Elige un partido o torneo para esta transmisión'}><Table2/>Tabla</Pad>
          <Pad on={overlay === 'goles'} disabled={!puedeGraficaPartido} onClick={() => onOverlay?.(overlay === 'goles' ? null : 'goles')} title={puedeGraficaPartido ? '' : 'Elige un partido para esta transmisión'}><ListOrdered/>Goles</Pad>
          <Pad on={overlay === 'jugadores'} disabled={!puedeGraficaPartido} onClick={() => onOverlay?.(overlay === 'jugadores' ? null : 'jugadores')} title={puedeGraficaPartido ? '' : 'Elige un partido para esta transmisión'}><Users/>Jugadores</Pad>
        </div>
        {overlay === 'tabla' && partes > 0 && (
          <>
            <div className="mc-h" style={{ marginTop: '10px' }}><span className="mc-lbl">Tabla de {tablaTotal} equipos · qué parte</span></div>
            <div className="mc-grid" style={{ gridTemplateColumns: `repeat(${Math.min(4, partes + 1)},1fr)` }}>
              <Pad on={!pagina} onClick={() => onPagina?.(null)} clase="" ><span style={{ fontSize: '.95rem' }}>Auto</span></Pad>
              {Array.from({ length: partes }, (_, i) => (
                <Pad key={i} on={pagina === i + 1} onClick={() => onPagina?.(i + 1)}>
                  <span style={{ fontSize: '.95rem' }}>Parte {i + 1}</span>
                  <small>{i * TABLA_POR_PARTE + 1}-{Math.min(tablaTotal, (i + 1) * TABLA_POR_PARTE)}</small>
                </Pad>
              ))}
            </div>
          </>
        )}
        {!tieneTorneo && !puedeGraficaPartido && (
          <div style={{ fontSize: '.85rem', color: '#6b6f76', marginTop: '8px', fontWeight: 500 }}>Las gráficas se prenden cuando la transmisión tenga un partido o torneo elegido.</div>
        )}
      </div>

      {patrocinadores.length > 0 && (
        <div className="mc-bank">
          <div className="mc-h">
            <span className="mc-lbl">Patrocinadores</span>
            {hayVideo && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
                <span className="mc-lbl" style={{ fontSize: '.7rem' }}>Video:</span>
                {[['auto', 'Auto'], ['grande', 'Grande'], ['pequeno', 'Pequeño']].map(([v, t]) => (
                  <button key={v} type="button" className={`mc-pill${tamano === v ? ' on' : ''}`} onClick={() => setTamano(v)}>{t}</button>
                ))}
              </span>
            )}
          </div>
          <div className="mc-grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(112px,1fr))' }}>
            {nBanners > 0 && (
              <div style={{ gridColumn: '1 / -1' }}>
                <Pad on={esActivo(ID_TODOS_BANNERS, 'banner')} onClick={() => pulsar(ID_TODOS_BANNERS, 'banner')} clase="">
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.05rem' }}>
                    <IconoImagen/>{esActivo(ID_TODOS_BANNERS, 'banner') ? 'Apagar banners' : `Banners · todos (${nBanners})`}
                  </span>
                </Pad>
              </div>
            )}
            {patrocinadores.map(p => (
              <div key={p.id} style={{ display: 'contents' }}>
                <Pad on={esActivo(p.id, 'logo')} onClick={() => pulsar(p.id, 'logo')}>
                  {p.logo_url ? <img className={esActivo(p.id, 'logo') ? '' : 'mc-thumb'} src={p.logo_url} alt={p.nombre}/> : <Megaphone/>}
                  <small>{esActivo(p.id, 'logo') ? 'QUITAR' : 'PRESENTA'}</small>
                  {!p.logo_url && <small>{p.nombre}</small>}
                </Pad>
                {p.video_url && (
                  <Pad on={esActivo(p.id, 'video')} onClick={() => pulsar(p.id, 'video')}>
                    <Film/>{esActivo(p.id, 'video') ? 'Quitar' : 'Video'}
                    <small>{p.nombre}</small>
                  </Pad>
                )}
              </div>
            ))}
          </div>
          {hayVideo && <div style={{ fontSize: '.8rem', color: '#6b6f76', marginTop: '8px', fontWeight: 500 }}>Video «Auto»: grande en el descanso, pequeño en una esquina mientras se juega.</div>}
        </div>
      )}
    </div>
  )
}
