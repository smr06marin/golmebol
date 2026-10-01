// Logos de patrocinador del TORNEO, puestos a mano encima del video (ver
// AdminConfigSitioPage: se suben, se ubican arrastrando y se publican uno
// por uno) — a diferencia del botón de "Publicidad" rápido que ya existía
// (PatrocinadorEnVivoOverlay, aparece centrado unos segundos y se apaga
// solo), estos son logos que el organizador deja fijos en una posición y
// tamaño elegidos a mano, y pueden estar VARIOS al mismo tiempo (uno en
// cada esquina, por ejemplo) — se quedan ahí hasta que alguien los quite a
// propósito.
//
// `logos`: la lista completa guardada para el torneo de este partido
// (cada uno con su posición/tamaño ya elegidos: { id, url, x, y, ancho },
// x/y/ancho en % del tamaño del video). `activos`: los ids de ESOS logos
// que están prendidos AHORA MISMO en esta transmisión puntual (se guarda
// aparte, por transmisión, en en_vivo_control — la posición es del torneo,
// pero encenderlo o no es de cada transmisión).
export default function PatrocinadoresTorneoOverlay({ logos, activos }) {
  const idsActivos = new Set(activos || [])
  const visibles = (logos || []).filter(l => idsActivos.has(l.id))
  if (!visibles.length) return null
  return (
    <>
      {visibles.map(l => (
        <img key={l.id} src={l.url} alt="Patrocinador" draggable={false}
          style={{ position:'absolute', left:`${l.x}%`, top:`${l.y}%`, width:`${l.ancho}%`, height:'auto', zIndex:4, pointerEvents:'none', filter:'drop-shadow(0 2px 8px rgba(0,0,0,.6))' }}/>
      ))}
    </>
  )
}
