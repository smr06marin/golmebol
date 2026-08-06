import { useEffect, useState } from 'react'
import { X } from 'lucide-react'

// Demo animada tipo "video" (hecha con CSS/JS, sin archivo de video real)
// que muestra cómo armar el pedido: tocar la foto suma una unidad, tocar el
// número la resta. Se repite sola en bucle hasta que la persona la cierra o
// toca "Ya sé cómo comprar".
const PASOS = [
  { badge: 0, tap: 'foto',  texto: 'Toca la foto del producto para agregar 1' },
  { badge: 1, tap: 'foto',  texto: '¿Necesitas 2? Vuelve a tocar la foto' },
  { badge: 2, tap: 'foto',  texto: 'Cada toque suma una unidad más' },
  { badge: 2, tap: 'numero',texto: '¿Te pasaste? Toca el número para quitar 1' },
  { badge: 1, tap: 'numero',texto: 'Cada toque en el número quita una unidad' },
]

const S = {
  navy: '#07070e', card: '#111827', card2: '#1a2234', border: '#1e2d3d',
  cyan: '#00ddd0', gold: '#f9a825', text: '#e8f4fd', muted: '#7a9ab5',
}

export default function TutorialPedido({ onCerrar }) {
  const [paso, setPaso] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setPaso(p => (p + 1) % PASOS.length), 1500)
    return () => clearInterval(t)
  }, [])

  const actual = PASOS[paso]

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.72)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:'20px' }}>
      <div style={{ background:S.navy, border:`1px solid ${S.border}`, borderRadius:'18px', padding:'22px 20px', maxWidth:'340px', width:'100%', textAlign:'center', position:'relative' }}>
        <button onClick={onCerrar} aria-label="Cerrar" style={{ position:'absolute', top:'10px', right:'10px', background:'none', border:'none', cursor:'pointer', color:S.muted, padding:'4px' }}>
          <X size={18}/>
        </button>

        <div style={{ fontWeight:800, fontSize:'1rem', marginBottom:'4px', color:S.text }}>Así se arma el pedido</div>
        <div style={{ fontSize:'.75rem', color:S.muted, marginBottom:'18px' }}>Mira el ejemplo, se repite solo</div>

        {/* Tarjeta de ejemplo animada */}
        <div style={{ width:'150px', margin:'0 auto 18px', position:'relative' }}>
          <div style={{ position:'relative', display:'flex', flexDirection:'column', background:S.card, border:`1px solid ${S.border}`, borderRadius:'14px', overflow:'hidden' }}>
            {actual.badge > 0 && (
              <span style={{ position:'absolute', top:'6px', right:'6px', zIndex:2, background:S.cyan, color:'#000', borderRadius:'50%', width:'24px', height:'24px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'.78rem', fontWeight:800, transition:'transform .2s', transform: actual.tap==='numero' ? 'scale(1.18)' : 'scale(1)' }}>
                {actual.badge}
                {actual.tap === 'numero' && (
                  <span style={{ position:'absolute', inset:'-8px', borderRadius:'50%', border:`2px solid ${S.cyan}`, animation:'tutorialPedidoPulso 1.5s ease-out infinite' }}/>
                )}
              </span>
            )}
            <div style={{ width:'100%', paddingBottom:'100%', position:'relative', background:S.card2 }}>
              <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'2.6rem', transform: actual.tap==='foto' ? 'scale(0.94)' : 'scale(1)', transition:'transform .18s' }}>
                💧
                {actual.tap === 'foto' && (
                  <span style={{ position:'absolute', inset:'12px', borderRadius:'12px', border:`2px solid ${S.cyan}`, animation:'tutorialPedidoPulso 1.5s ease-out infinite' }}/>
                )}
              </div>
            </div>
            <div style={{ padding:'8px 9px' }}>
              <div style={{ fontSize:'.75rem', fontWeight:700, color:S.text }}>Agua</div>
              <div style={{ fontSize:'.76rem', color:S.gold, fontWeight:800, marginTop:'2px' }}>$2.500</div>
            </div>
          </div>
        </div>

        <div style={{ minHeight:'36px', fontSize:'.82rem', color:S.text, fontWeight:600, lineHeight:1.4, marginBottom:'18px' }}>
          {actual.texto}
        </div>

        <div style={{ display:'flex', gap:'5px', justifyContent:'center', marginBottom:'18px' }}>
          {PASOS.map((_, i) => (
            <span key={i} style={{ width:'6px', height:'6px', borderRadius:'50%', background: i===paso ? S.cyan : S.border }}/>
          ))}
        </div>

        <button onClick={onCerrar} style={{ width:'100%', padding:'13px', background:S.cyan, border:'none', borderRadius:'12px', cursor:'pointer', color:'#000', fontWeight:800, fontSize:'.88rem' }}>
          Ya sé cómo comprar, ir a la compra
        </button>
      </div>

      <style>{`
        @keyframes tutorialPedidoPulso {
          0%   { opacity:.9; transform:scale(.85); }
          70%  { opacity:0;  transform:scale(1.25); }
          100% { opacity:0;  transform:scale(1.25); }
        }
      `}</style>
    </div>
  )
}
