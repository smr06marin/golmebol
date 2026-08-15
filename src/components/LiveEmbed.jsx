import { useEffect, useRef } from 'react'

// Saca el ID del video de cualquier formato de link de YouTube: watch?v=,
// youtu.be/, /embed/, /live/, /shorts/. Si no reconoce el formato (por
// ejemplo si le pasan el link del CANAL en vez del video/live puntual),
// devuelve null y se cae al botón "Ver en vivo" en vez de un embed roto.
export function parseYouTubeId(url) {
  try {
    const u = new URL(url)
    if (u.hostname.includes('youtu.be')) return u.pathname.slice(1) || null
    if (u.hostname.includes('youtube.com')) {
      if (u.pathname === '/watch') return u.searchParams.get('v')
      const m = u.pathname.match(/\/(embed|live|shorts)\/([^/?]+)/)
      if (m) return m[2]
    }
  } catch {}
  return null
}

export function detectarPlataforma(url) {
  if (!url) return null
  if (/youtube\.com|youtu\.be/i.test(url)) return 'youtube'
  if (/facebook\.com|fb\.watch/i.test(url)) return 'facebook'
  if (/instagram\.com/i.test(url)) return 'instagram'
  return 'otro'
}

function LinkFallback({ url, S }) {
  return (
    <a href={url} target="_blank" rel="noreferrer"
      style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'8px', padding:'40px 20px', borderRadius:'16px', background:S.card, border:`1px solid ${S.red}55`, color:S.red, fontWeight:800, textDecoration:'none', fontSize:'.9rem' }}>
      ▶ Ver en vivo
    </a>
  )
}

// Embebe un link de "en vivo" — YouTube se muestra directo en un iframe
// (lo más confiable, no necesita API key). Facebook usa su plugin público
// de video (tampoco necesita API key, pero solo funciona bien con videos de
// una Página pública). Instagram necesita su script oficial de embeds — se
// carga una sola vez y se le pide procesar el bloque cada vez que cambia el
// link. Si no se reconoce la plataforma, o el link de YouTube no trae un ID
// de video reconocible (por ejemplo si pegaron el link del canal en vez del
// video puntual), se muestra un botón que abre el link en una pestaña
// nueva en vez de dejar un cuadro roto.
export default function LiveEmbed({ url, titulo, S }) {
  const plataforma = detectarPlataforma(url)

  useEffect(() => {
    if (plataforma !== 'instagram') return
    function procesar() { window.instgrm?.Embeds?.process() }
    if (window.instgrm) { procesar(); return }
    const existente = document.getElementById('ig-embed-script')
    if (existente) { existente.addEventListener('load', procesar); return }
    const script = document.createElement('script')
    script.id = 'ig-embed-script'
    script.src = '//www.instagram.com/embed.js'
    script.async = true
    script.onload = procesar
    document.body.appendChild(script)
  }, [plataforma, url])

  if (!url) return null

  if (plataforma === 'youtube') {
    const id = parseYouTubeId(url)
    if (!id) return <LinkFallback url={url} S={S}/>
    return (
      <div style={{ position:'relative', paddingBottom:'56.25%', height:0, borderRadius:'16px', overflow:'hidden', background:'#000' }}>
        <iframe src={`https://www.youtube.com/embed/${id}`} title={titulo || 'En vivo'}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen
          style={{ position:'absolute', inset:0, width:'100%', height:'100%', border:'none' }}/>
      </div>
    )
  }

  if (plataforma === 'facebook') {
    return (
      <div style={{ position:'relative', paddingBottom:'56.25%', height:0, borderRadius:'16px', overflow:'hidden', background:'#000' }}>
        <iframe src={`https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=false`}
          title={titulo || 'En vivo'} allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share" allowFullScreen
          style={{ position:'absolute', inset:0, width:'100%', height:'100%', border:'none' }}/>
      </div>
    )
  }

  if (plataforma === 'instagram') {
    return (
      <blockquote className="instagram-media" data-instgrm-permalink={url} data-instgrm-version="14"
        style={{ margin:'0 auto', maxWidth:'540px', width:'100%', minHeight:'300px' }}/>
    )
  }

  return <LinkFallback url={url} S={S}/>
}
