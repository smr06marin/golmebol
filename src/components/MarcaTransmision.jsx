// Marca de la transmisión en el overlay de OBS: logo de Golmebol + logo del torneo que se está
// jugando, juntos arriba a la izquierda, con "EN VIVO". Se dibuja en el escenario fijo de 860px de
// ancho del overlay (ver OverlayEnVivoPage), por eso va en px.
//
// Cuando aparece el marcador, los dos logos viajan juntos al centro (ahí el marcador los recibe, se
// abre y cada logo se queda a un lado: torneo a la izquierda, Golmebol a la derecha — ver
// MarcadorEnVivoOverlay). Cuando el marcador se va, los logos regresan a la esquina. "EN VIVO"
// siempre se queda arriba a la izquierda.
const SOMBRA = 'drop-shadow(0 1px 4px rgba(0,0,0,.85))'
const EASE = 'cubic-bezier(.65,0,.35,1)'
const ALTO_LOGOS = 34

export default function MarcaTransmision({ logoTorneo, conMarcador = false, anchoEscenario = 860 }) {
  // translateX en % usa el ancho del propio grupo: lo deja centrado en el escenario sin medir nada
  const haciaCentro = `translateX(calc(${anchoEscenario / 2 - 10}px - 50%))`
  return (
    <>
      <div style={{
        position: 'absolute', top: '10px', left: '10px', zIndex: 4, display: 'flex', alignItems: 'center', gap: '8px', pointerEvents: 'none',
        transform: conMarcador ? haciaCentro : 'none', opacity: conMarcador ? 0 : 1,
        // al irse viaja y se desvanece al llegar; al volver espera a que el marcador se cierre
        transition: conMarcador
          ? `transform .65s ${EASE}, opacity .25s ease .4s`
          : `transform .65s ${EASE} .45s, opacity .25s ease .45s`,
      }}>
        <img src="/marca/watermark-logo.png" alt="" style={{ height: `${ALTO_LOGOS}px`, width: 'auto', filter: SOMBRA }}/>
        {logoTorneo && (
          <>
            <span style={{ width: '1px', height: '28px', background: 'rgba(255,255,255,.6)', boxShadow: '0 1px 3px rgba(0,0,0,.6)' }}/>
            <img src={logoTorneo} alt="" style={{ height: `${ALTO_LOGOS}px`, width: 'auto', maxWidth: '64px', objectFit: 'contain', filter: SOMBRA }}/>
          </>
        )}
      </div>
      {/* EN VIVO: debajo de los logos. Cuando los logos se van al marcador, esta palabra se desvanece:
          el marcador muestra la suya debajo del logo de Golmebol (así no tapa el logo del torneo) */}
      <div style={{
        position: 'absolute', left: '10px', zIndex: 4, display: 'flex', alignItems: 'center', gap: '4px', pointerEvents: 'none',
        top: `${10 + ALTO_LOGOS + 3}px`, opacity: conMarcador ? 0 : 1,
        transition: conMarcador ? 'opacity .25s ease' : 'opacity .25s ease .45s',
      }}>
        <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#e5433d', flexShrink: 0, animation: 'gmMicPulso 1s ease-in-out infinite', boxShadow: '0 0 3px rgba(0,0,0,.9)' }}/>
        <span style={{ fontSize: '.62rem', fontWeight: 900, color: '#fff', letterSpacing: '.04em', textShadow: '0 1px 3px rgba(0,0,0,.9)' }}>EN VIVO</span>
      </div>
    </>
  )
}
