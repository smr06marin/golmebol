/* eslint-disable react-refresh/only-export-components */
// Estilo compartido de las gráficas en vivo (tabla, goles, jugadores, aviso de
// gol) — lenguaje de transmisión profesional tipo UEFA/ESPN: panel oscuro con
// degradado, cabecera con "tag" rojo angulado, filas con cifras tabulares,
// escudos y color de uniforme como acento.
//
// TAMAÑO: todo se mide en `--u`. Cada gráfica es su propio "contenedor"
// (container-type: inline-size) y `--u` vale 1cqw = 1% del ANCHO DE LA
// GRÁFICA; el ancho de la gráfica se adapta al video (96% en celular, hasta
// 780px en pantalla grande / OBS). Así una misma gráfica se ve proporcionada
// en un celular vertical, en horizontal y en 1080p. Si el navegador es viejo
// y no soporta unidades de contenedor, `--u` queda fijo en 3.3px (el tamaño de
// un celular chico) y se sigue viendo bien.

export const CSS_EV = `
.ev-u { --u: 3.3px; --rojo: #e5433d; --oro: #f5a623; --tenue: #9aa6b8; --linea: rgba(255,255,255,.09); }
@supports (width: 1cqw) { .ev-u { container-type: inline-size; --u: 1cqw; } }

.ev-p {
  position: absolute; left: 0; right: 0; bottom: 0; margin: 0 auto; z-index: 2; pointer-events: none; box-sizing: border-box;
  width: clamp(min(96%, 330px), 40%, 780px); max-height: 94%; overflow: hidden; color: #fff;
  background: linear-gradient(180deg, rgba(17,22,34,.97), rgba(6,8,13,.98));
  border-radius: calc(var(--u) * 1.8) calc(var(--u) * 1.8) 0 0;
  box-shadow: 0 -4px 24px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,255,255,.07);
  animation: evSube .45s cubic-bezier(.2,.8,.2,1) both;
  font-variant-numeric: tabular-nums;
}

/* Cabecera: tag rojo angulado a la izquierda + dato secundario a la derecha */
.ev-h { display: flex; align-items: stretch; height: calc(var(--u) * 5.8); border-bottom: 1px solid var(--linea); }
.ev-tag {
  display: flex; align-items: center; background: var(--rojo); color: #fff; font-weight: 900; text-transform: uppercase; white-space: nowrap;
  font-size: calc(var(--u) * 3); letter-spacing: .12em; padding: 0 calc(var(--u) * 4) 0 calc(var(--u) * 2.6);
  clip-path: polygon(0 0, 100% 0, calc(100% - var(--u) * 1.8) 100%, 0 100%);
}
.ev-sub {
  flex: 1; min-width: 0; display: flex; align-items: center; justify-content: flex-end; gap: calc(var(--u) * 1.2);
  padding: 0 calc(var(--u) * 2.6); color: var(--tenue); font-weight: 800; text-transform: uppercase; white-space: nowrap;
  font-size: calc(var(--u) * 2.7); letter-spacing: .08em; overflow: hidden;
}
.ev-dot { width: calc(var(--u) * 1.5); height: calc(var(--u) * 1.5); border-radius: 50%; background: var(--rojo); flex-shrink: 0; animation: evPulso 1.4s ease-in-out infinite; }
.ev-esc { border-radius: 50%; background: #fff; overflow: hidden; flex-shrink: 0; display: flex; align-items: center; justify-content: center; }
.ev-esc img { width: 100%; height: 100%; object-fit: contain; padding: 8%; box-sizing: border-box; }
.ev-esc span { font-weight: 900; color: #1a3a8a; }
.ev-num { flex-shrink: 0; min-width: 2em; text-align: center; border-radius: calc(var(--u) * .8); padding: .08em .4em; font-weight: 900; line-height: 1.2; }
.ev-txt { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* ── Tabla ── */
.ev-cols, .ev-r { display: flex; align-items: center; gap: calc(var(--u) * 1.4); padding: 0 calc(var(--u) * 2.4) 0 calc(var(--u) * 1.8); border-left: calc(var(--u) * .7) solid transparent; }
.ev-cols { height: calc(var(--u) * 4); color: var(--tenue); font-weight: 800; font-size: calc(var(--u) * 2.4); letter-spacing: .1em; text-transform: uppercase; border-bottom: 1px solid var(--linea); }
.ev-r { height: calc(var(--u) * 5.2); font-size: calc(var(--u) * 3.8); }
.ev-r:nth-child(even) { background: rgba(255,255,255,.025); }
.ev-r.vivo { background: linear-gradient(90deg, rgba(229,67,61,.34), rgba(229,67,61,.08)); border-left-color: var(--rojo); }
.ev-c-pos { width: calc(var(--u) * 4.8); text-align: center; flex-shrink: 0; font-weight: 900; color: var(--tenue); }
.ev-r.top1 .ev-c-pos { color: var(--oro); }
.ev-c-eq { flex: 1; min-width: 0; display: flex; align-items: center; gap: calc(var(--u) * 1.6); font-weight: 800; }
.ev-c-n { width: calc(var(--u) * 8); text-align: right; flex-shrink: 0; color: var(--tenue); font-weight: 700; }
.ev-c-pts { width: calc(var(--u) * 7.4); text-align: right; flex-shrink: 0; font-weight: 900; color: #fff; font-size: 1.08em; }
.ev-chip { flex-shrink: 0; background: var(--rojo); color: #fff; border-radius: calc(var(--u) * .8); padding: .05em .5em; font-size: .86em; font-weight: 900; }
.ev-mas { text-align: center; color: var(--tenue); line-height: 1; font-size: calc(var(--u) * 2.6); letter-spacing: .3em; padding: calc(var(--u) * .4) 0; }
.ev-pie { padding: calc(var(--u) * 1.1) calc(var(--u) * 2.6); color: var(--tenue); font-size: calc(var(--u) * 2.3); font-weight: 700; letter-spacing: .04em; border-top: 1px solid var(--linea); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ev-pie b { color: #fff; font-weight: 900; letter-spacing: .08em; }

/* ── Goles ── */
.ev-g { display: flex; align-items: center; gap: calc(var(--u) * 2); height: calc(var(--u) * 6.2); padding: 0 calc(var(--u) * 2.6) 0 calc(var(--u) * 1.6); border-left: calc(var(--u) * .9) solid var(--cg, #5f6368); font-size: calc(var(--u) * 3.5); }
.ev-g:nth-child(even) { background: rgba(255,255,255,.035); }
.ev-g-min { width: calc(var(--u) * 7.2); flex-shrink: 0; font-weight: 900; color: var(--oro); text-align: right; }
.ev-g-nom { flex: 1; min-width: 0; font-weight: 800; }
.ev-g-eq { display: flex; align-items: center; gap: calc(var(--u) * 1); max-width: 30%; flex-shrink: 0; color: #c3cad6; font-weight: 700; font-size: .72em; }

/* ── Tablero estilo transmisión (TableroBT): equipos a los lados, marcador en caja blanca, goleadores sobre cada equipo ── */
.ev-bt { position: absolute; left: 0; right: 0; bottom: 3%; margin: 0 auto; z-index: 2; pointer-events: none; box-sizing: border-box;
  width: clamp(min(96%, 330px), 54%, 760px); color: #fff; animation: evSube .45s cubic-bezier(.2,.8,.2,1) both; font-variant-numeric: tabular-nums; }
.ev-bt-tagw { display: flex; justify-content: center; position: relative; z-index: 2; margin-bottom: calc(var(--u) * -.1); }
.ev-bt-tag { background: var(--rojo); color: #fff; font-weight: 900; text-transform: uppercase; white-space: nowrap; font-size: calc(var(--u) * 2.9); letter-spacing: .14em;
  padding: calc(var(--u) * 1) calc(var(--u) * 6); clip-path: polygon(calc(var(--u) * 1.6) 0, calc(100% - var(--u) * 1.6) 0, 100% 100%, 0 100%); box-shadow: 0 -2px 10px rgba(0,0,0,.3); }
.ev-bt-panel { position: relative; background: linear-gradient(180deg, rgba(14,18,28,.97), rgba(5,7,12,.98)); box-shadow: 0 8px 28px rgba(0,0,0,.6), inset 0 1px 0 rgba(255,255,255,.07); }
.ev-bt-fila { display: grid; grid-template-columns: 1fr calc(var(--u) * 15) 1fr; align-items: stretch; }
.ev-bt-fgol { padding-top: calc(var(--u) * 1.6); border-bottom: 1px solid var(--linea); padding-bottom: calc(var(--u) * 1.2); }
.ev-bt-gs { display: flex; flex-direction: column; align-items: center; justify-content: flex-start; gap: calc(var(--u) * .5); padding: 0 calc(var(--u) * 3); min-width: 0; }
.ev-bt-g { display: block; white-space: nowrap; text-align: center; max-width: 100%; min-width: 0; font-weight: 800; text-transform: uppercase; font-size: calc(var(--u) * 2.45); letter-spacing: .01em; line-height: 1.2; }
.ev-bt-gj { }
.ev-bt-gn { color: var(--tenue); font-weight: 900; }
.ev-bt-balon { display: inline-block; width: 1em; height: 1em; vertical-align: -.14em; margin-right: .22em; }
.ev-bt-gm { color: var(--oro); font-weight: 900; white-space: nowrap; }
.ev-bt-mas { color: var(--tenue); font-size: calc(var(--u) * 2.3); }
.ev-bt-fmain { position: relative; height: calc(var(--u) * 10); }
.ev-bt-n { display: flex; align-items: center; min-width: 0; font-weight: 900; text-transform: uppercase; font-size: calc(var(--u) * 3.7); line-height: 1.1; letter-spacing: .01em; padding: 0 calc(var(--u) * 3); }
.ev-bt-n span { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; word-break: break-word; }
.ev-bt-nl { justify-content: center; text-align: center; padding-left: calc(var(--u) * 11); }
.ev-bt-nr { justify-content: center; text-align: center; padding-right: calc(var(--u) * 11); }
.ev-bt-sc { align-self: center; display: flex; align-items: center; justify-content: center; gap: calc(var(--u) * 1.5); height: calc(var(--u) * 8.6); background: #fff; color: #0b0f17; font-weight: 900; font-size: calc(var(--u) * 6.2); line-height: 1;
  clip-path: polygon(calc(var(--u) * 1.2) 0, 100% 0, calc(100% - var(--u) * 1.2) 100%, 0 100%); box-shadow: 0 2px 10px rgba(0,0,0,.4); }
.ev-bt-sc i { font-style: normal; color: #8b94a3; font-size: .6em; }
.ev-bt-sc em { font-style: normal; font-size: .55em; letter-spacing: .08em; color: #5b6472; }
.ev-bt-cl { position: absolute; bottom: 0; height: calc(var(--u) * .8); }
.ev-bt-cl-l { left: 0; right: calc(50% + var(--u) * 7.5); }
.ev-bt-cl-r { right: 0; left: calc(50% + var(--u) * 7.5); }
.ev-bt-esc { position: absolute; bottom: calc(var(--u) * -1.8); z-index: 3; filter: drop-shadow(0 3px 6px rgba(0,0,0,.55)); }
.ev-bt-esc .ev-esc { border: calc(var(--u) * .5) solid rgba(255,255,255,.95); box-sizing: border-box; }
.ev-bt-esc-l { left: calc(var(--u) * -2.6); }
.ev-bt-esc-r { right: calc(var(--u) * -2.6); }
.ev-bt-piew { display: flex; justify-content: center; margin-top: calc(var(--u) * -.1); position: relative; z-index: 1; }
.ev-bt-pie { width: 74%; box-sizing: border-box; text-align: center; padding: calc(var(--u) * .6) calc(var(--u) * 2.5) calc(var(--u) * .4);
  background: linear-gradient(180deg, rgba(8,10,16,.98), rgba(4,5,9,.98)); border-bottom: calc(var(--u) * .5) solid var(--rojo); box-shadow: 0 6px 18px rgba(0,0,0,.5); }
.ev-bt-pie .ev-pie { white-space: normal; border-top: none; padding: calc(var(--u) * .5) 0; text-align: center; font-size: calc(var(--u) * 2.35); line-height: 1.35; }
.ev-bt-sub { color: var(--oro); font-weight: 900; text-transform: uppercase; letter-spacing: .12em; font-size: calc(var(--u) * 2.3); padding-top: calc(var(--u) * .6); }
.ev-bt-cols { display: grid; grid-template-columns: 1fr 1fr; padding-top: calc(var(--u) * 2); }
.ev-bt-cols .ev-col { padding: calc(var(--u) * .4) 0 calc(var(--u) * 1.2); }
.ev-bt-cols .ev-col:first-child { padding-left: calc(var(--u) * 5); }
.ev-bt-cols .ev-col:last-child { padding-right: calc(var(--u) * 5); }
.ev-bt-cols .ev-j { height: calc(var(--u) * 3.9); font-size: calc(var(--u) * 2.8); }
.ev-bt-mas-j { text-align: center; color: var(--tenue); font-weight: 800; font-size: calc(var(--u) * 2.4); padding-top: calc(var(--u) * .6); }

/* ── Jugadores ── */
.ev-cols2 { display: flex; }
.ev-col { flex: 1; min-width: 0; }
.ev-col + .ev-col { border-left: 1px solid var(--linea); }
.ev-col-h { display: flex; align-items: center; gap: calc(var(--u) * 1.6); height: calc(var(--u) * 6); padding: 0 calc(var(--u) * 2.2); font-weight: 900; font-size: calc(var(--u) * 3.1); text-transform: uppercase; letter-spacing: .04em; border-bottom: calc(var(--u) * .7) solid var(--cg, #5f6368); }
.ev-j { display: flex; align-items: center; gap: calc(var(--u) * 1.8); height: calc(var(--u) * 4.3); padding: 0 calc(var(--u) * 2.2); font-size: calc(var(--u) * 3.1); font-weight: 700; }
.ev-j:nth-child(even) { background: rgba(255,255,255,.035); }
.ev-j .ev-num { font-size: .92em; }

/* ── Aviso de gol (compacto, sin minuto; la foto del goleador sale aparte, semitransparente) ──
   .ev-av-w es el contenedor (de él sale --u); .ev-av es la tarjeta. */
.ev-av-w { width: clamp(min(94%, 300px), 38%, 640px); }
.ev-av { position: relative; display: flex; align-items: stretch; overflow: hidden; color: #fff;
  border-radius: calc(var(--u) * 1.8); background: linear-gradient(180deg, rgba(17,22,34,.97), rgba(6,8,13,.98)); box-shadow: 0 8px 28px rgba(0,0,0,.6), inset 0 1px 0 rgba(255,255,255,.08);
  border-bottom: calc(var(--u) * .9) solid var(--rojo); animation: evAviso 8s cubic-bezier(.2,.8,.2,1) both; font-variant-numeric: tabular-nums; }
.ev-av-num { display: flex; align-items: center; justify-content: center; min-width: calc(var(--u) * 13); padding: 0 calc(var(--u) * 3.6) 0 calc(var(--u) * 2); font-weight: 900; font-size: calc(var(--u) * 8); line-height: 1;
  clip-path: polygon(0 0, 100% 0, calc(100% - var(--u) * 2) 100%, 0 100%); }
.ev-av-body { flex: 1; min-width: 0; padding: calc(var(--u) * 2) calc(var(--u) * 2.8) calc(var(--u) * 2) calc(var(--u) * 1.4); display: flex; flex-direction: column; justify-content: center; gap: calc(var(--u) * .8); }
.ev-av-top { display: flex; align-items: center; gap: calc(var(--u) * 2); }
.ev-av-firma { margin-left: auto; color: var(--tenue); font-weight: 700; font-size: calc(var(--u) * 2.2); letter-spacing: .06em; text-transform: uppercase; white-space: nowrap; }
.ev-av-firma b { color: #fff; font-weight: 900; }
.ev-av-gol { background: var(--rojo); font-weight: 900; font-size: calc(var(--u) * 2.9); letter-spacing: .14em; padding: .12em .8em .12em .6em; clip-path: polygon(0 0, 100% 0, calc(100% - var(--u) * 1.1) 100%, 0 100%); }
.ev-av-cant { background: var(--oro); color: #1a1200; font-weight: 900; font-size: calc(var(--u) * 2.6); letter-spacing: .06em; padding: .14em .8em; border-radius: calc(var(--u) * 1); white-space: nowrap; }
.ev-av-nom { font-weight: 900; font-size: calc(var(--u) * 5.6); line-height: 1.08; text-transform: uppercase; letter-spacing: .01em; }
.ev-av-eq { display: flex; align-items: center; gap: calc(var(--u) * 1.4); min-width: 0; font-weight: 700; font-size: calc(var(--u) * 3.1); color: #c3cad6; }
.ev-av-sc { margin-left: auto; flex-shrink: 0; font-weight: 900; font-size: calc(var(--u) * 4.6); color: #fff; }

@keyframes evSube { from { opacity: 0; transform: translateY(26px); } to { opacity: 1; transform: translateY(0); } }
@keyframes evPulso { 0%, 100% { opacity: 1; } 50% { opacity: .3; } }
@keyframes gmGolFoto { 0% { opacity: 0; transform: translateY(24px) scale(.96); } 8% { opacity: .78; transform: translateY(0) scale(1); } 86% { opacity: .78; } 100% { opacity: 0; } }
@keyframes evAviso {
  0% { opacity: 0; transform: translateY(34px) scale(.97); }
  5% { opacity: 1; transform: translateY(-3px) scale(1.005); }
  8% { transform: translateY(0) scale(1); }
  93% { opacity: 1; transform: translateY(0) scale(1); }
  100% { opacity: 0; transform: translateY(14px) scale(.99); }
}
`

export function EnVivoEstilos() {
  return <style>{CSS_EV}</style>
}

// Pie de cada gráfica con la firma de la plataforma. `texto` lleva la palabra
// GOLMEBOL, que se resalta en blanco (ej. "Tabla actualizada · tecnología GOLMEBOL").
export function PieGolmebol({ texto }) {
  const partes = String(texto || '').split('GOLMEBOL')
  return (
    <div className="ev-pie">
      {partes.map((p, i) => (i < partes.length - 1 ? <span key={i}>{p}<b>GOLMEBOL</b></span> : <span key={i}>{p}</span>))}
    </div>
  )
}

// Color de texto legible sobre el color de uniforme que haya elegido el árbitro
export function textoContraste(hex) {
  if (!hex || hex[0] !== '#' || hex.length !== 7) return '#fff'
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6 ? '#0c1116' : '#fff'
}

// Escudo redondo; `size` en múltiplos de --u (ej. 4 → 4% del ancho de la gráfica)
export function Escudo({ url, name, size = 4 }) {
  const iniciales = (name || '?').split(/\s+/).map(w => w[0]).join('').substring(0, 2).toUpperCase()
  const dim = `calc(var(--u) * ${size})`
  return (
    <span className="ev-esc" style={{ width: dim, height: dim }}>
      {url ? <img src={url} alt=""/> : <span style={{ fontSize: `calc(var(--u) * ${size * 0.42})` }}>{iniciales}</span>}
    </span>
  )
}
