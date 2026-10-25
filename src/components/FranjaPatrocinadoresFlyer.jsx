// Franja blanca con los logos de los patrocinadores de Golmebol, para el pie de los flyers.
// Todo se dimensiona a partir de `ancho` y `alto`, así sirve igual para los flyers de 1080 px
// que para los de 400 o 540 px de ancho. Solo usa elementos que html2canvas dibuja bien.

const FUENTE = "'Barlow Condensed', 'Arial Narrow', Arial, sans-serif"

function urlCors(u) {
  if (!u || u.startsWith('data:')) return u
  // Parámetro extra: evita que el navegador reutilice una copia guardada sin permisos CORS (rompería la descarga).
  return u + (u.includes('?') ? '&' : '?') + 'gmcors=1'
}

export default function FranjaPatrocinadoresFlyer({ patrocinadores, ancho, alto }) {
  if (!patrocinadores?.length) return null
  const n = patrocinadores.length
  const lado = Math.round(ancho * 0.04)
  const celda = (ancho - lado * 2) / n
  const maxW = Math.round(celda - ancho * 0.05)
  const maxH = Math.round(alto * 0.68)
  return (
    <div style={{ width: ancho, height: alto, background: '#fff', boxSizing: 'border-box', padding: `0 ${lado}px`, display: 'flex', alignItems: 'center', flexShrink: 0 }}>
      {patrocinadores.map((p, i) => (
        <div key={p.id || i} style={{ flex: 1, minWidth: 0, height: '100%', display: 'flex', alignItems: 'center' }}>
          {i > 0 && <div style={{ width: Math.max(1, Math.round(alto * 0.012)), height: Math.round(alto * 0.46), background: '#d3d6dc', flexShrink: 0 }}/>}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {p.logo_url
              ? <img src={urlCors(p.logo_url)} alt="" crossOrigin="anonymous" style={{ maxWidth: maxW, maxHeight: maxH, objectFit: 'contain', display: 'block' }}/>
              : <span style={{ fontFamily: FUENTE, fontWeight: 800, fontSize: Math.round(alto * 0.2), color: '#222', textAlign: 'center' }}>{p.nombre}</span>}
          </div>
        </div>
      ))}
    </div>
  )
}
