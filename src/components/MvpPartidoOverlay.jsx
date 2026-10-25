// MVP del partido para la transmisión en vivo: apenas el árbitro cierra la planilla sale solo (ver
// OverlayEnVivoPage) una tarjeta al estilo de las transmisiones de LaLiga: la FOTO grande del jugador, su
// NOMBRE debajo en una placa blanca y la palabra MVP. Sin foto sale el escudo de su equipo en grande.
// Medidas en `--u` (1% del ancho de la tarjeta), igual que el resto de las gráficas (ver ./enVivoUI).
import { EnVivoEstilos, Escudo, textoContraste } from './enVivoUI'

export const DURACION_MVP_MS = 12000

const CSS_MVP = `
@keyframes evMvp {
  0% { opacity: 0; transform: translateY(40px) scale(.96); }
  6% { opacity: 1; transform: translateY(-3px) scale(1.005); }
  9% { transform: translateY(0) scale(1); }
  93% { opacity: 1; transform: translateY(0) scale(1); }
  100% { opacity: 0; transform: translateY(18px) scale(.99); }
}
@keyframes evMvpBrillo { 0% { transform: translateX(-130%) skewX(-18deg); } 100% { transform: translateX(330%) skewX(-18deg); } }
.ev-mvp-w { width: clamp(min(64%, 230px), 27%, 380px); }
.ev-mvp { color: #fff; filter: drop-shadow(0 10px 26px rgba(0,0,0,.55)); }
.ev-mvp-foto { position: relative; width: 100%; aspect-ratio: 1 / 1.08; overflow: hidden; border-radius: calc(var(--u) * 3) calc(var(--u) * 3) 0 0; }
.ev-mvp-foto img.ev-mvp-img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: 50% 18%; }
.ev-mvp-sombra { position: absolute; left: 0; right: 0; bottom: 0; height: 34%; background: linear-gradient(180deg, rgba(0,0,0,0), rgba(0,0,0,.55)); }
.ev-mvp-grande { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; }
.ev-mvp-tag { position: absolute; left: 0; top: calc(var(--u) * 5); display: flex; align-items: baseline; gap: calc(var(--u) * 1.6); padding: calc(var(--u) * 1.4) calc(var(--u) * 6) calc(var(--u) * 1.4) calc(var(--u) * 4.4);
  background: linear-gradient(180deg, #ffd45e, #f5a623); color: #1a1300; font-weight: 900; line-height: 1; overflow: hidden;
  clip-path: polygon(0 0, 100% 0, calc(100% - var(--u) * 3) 100%, 0 100%); box-shadow: 0 4px 14px rgba(0,0,0,.4); }
.ev-mvp-tag b { font-size: calc(var(--u) * 13); letter-spacing: .02em; font-weight: 900; }
.ev-mvp-tag::after { content: ''; position: absolute; top: 0; bottom: 0; left: 0; width: 22%; background: rgba(255,255,255,.55); animation: evMvpBrillo 1.9s ease-in-out .7s 1 both; }
.ev-mvp-esc { position: absolute; right: calc(var(--u) * 4); top: calc(var(--u) * 5); filter: drop-shadow(0 3px 8px rgba(0,0,0,.5)); }
.ev-mvp-esc .ev-esc { border: calc(var(--u) * .9) solid #fff; box-sizing: border-box; }
.ev-mvp-placa { position: relative; background: #fff; color: #0b0f17; text-align: center; padding: calc(var(--u) * 4) calc(var(--u) * 4) calc(var(--u) * 3.4); border-bottom: calc(var(--u) * 1.6) solid var(--cmvp, #1a73e8); border-radius: 0 0 calc(var(--u) * 3) calc(var(--u) * 3); }
.ev-mvp-nom { font-weight: 900; text-transform: uppercase; letter-spacing: .01em; line-height: 1.1; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; word-break: break-word; }
.ev-mvp-eq { margin-top: calc(var(--u) * 1.8); display: flex; align-items: center; justify-content: center; gap: calc(var(--u) * 2); color: #4a5262; font-weight: 800; text-transform: uppercase; letter-spacing: .06em; font-size: calc(var(--u) * 4.2); min-width: 0; }
.ev-mvp-eq span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ev-mvp-gol { flex-shrink: 0; background: #0b0f17; color: #fff; border-radius: calc(var(--u) * 1.2); padding: .12em .6em; font-size: .92em; letter-spacing: .04em; }
`

// mvp: { nombre, foto, equipo, escudo, color, goles }
export default function MvpPartidoOverlay({ mvp }) {
  if (!mvp?.nombre) return null
  const color = mvp.color || '#1a73e8'
  const largo = mvp.nombre.length
  const fuente = largo > 26 ? 5.4 : largo > 20 ? 6 : largo > 15 ? 6.8 : 7.6
  return (
    <>
      <EnVivoEstilos/>
      <style>{CSS_MVP}</style>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: '6%', zIndex: 3, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
        <div className="ev-u ev-mvp-w" style={{ '--cmvp': color }}>
          <div className="ev-mvp" style={{ animation: `evMvp ${DURACION_MVP_MS}ms ease both` }}>
            <div className="ev-mvp-foto" style={{ background: `radial-gradient(ellipse at 50% 30%, ${color} 0%, #0d1220 85%)` }}>
              {mvp.foto
                ? <img className="ev-mvp-img" src={mvp.foto} alt=""/>
                : <div className="ev-mvp-grande"><Escudo url={mvp.escudo} name={mvp.equipo} size={46}/></div>}
              <div className="ev-mvp-sombra"/>
              <div className="ev-mvp-tag" style={{ color: textoContraste('#f5a623') }}><b>MVP</b></div>
              {mvp.foto && mvp.escudo && <div className="ev-mvp-esc"><Escudo url={mvp.escudo} name={mvp.equipo} size={13}/></div>}
            </div>
            <div className="ev-mvp-placa">
              <div className="ev-mvp-nom" style={{ fontSize: `calc(var(--u) * ${fuente})` }}>{mvp.nombre}</div>
              {(mvp.equipo || mvp.goles > 0) && (
                <div className="ev-mvp-eq">
                  {mvp.equipo && <span>{mvp.equipo}</span>}
                  {mvp.goles > 0 && <b className="ev-mvp-gol">{mvp.goles} {mvp.goles === 1 ? 'GOL' : 'GOLES'}</b>}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
