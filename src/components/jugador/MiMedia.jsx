import { J, FD, HEXAGONO } from './juegoEstilo'
import { Contador } from './juegoUI'

// ── Mi media (el número tipo FIFA) explicada: por qué la tengo y cómo subirla ───────────────────
// media: lo que devuelve calcularMedia() de lib/mediaJugador.js

const colorMedia = m => (m >= 85 ? J.gold : m >= 75 ? J.green : m >= 60 ? J.azul : J.text2)

function Barra({ p, color }) {
  return (
    <div style={{ height: 8, borderRadius: 999, background: 'rgba(255,255,255,.08)', overflow: 'hidden' }} aria-hidden="true">
      <div className="gj-anim" style={{ width: `${p === 0 ? 0 : Math.max(3, Math.round(p * 100))}%`, height: '100%', borderRadius: 999, background: color, transformOrigin: 'left', animation: 'gjLlena .9s cubic-bezier(.2,.8,.2,1) .2s both' }}/>
    </div>
  )
}

export default function MiMedia({ media }) {
  if (!media) {
    return <div style={{ height: 120, borderRadius: 14, background: 'rgba(255,255,255,.05)', animation: 'gjPulso 1.4s ease-in-out infinite', marginBottom: 14 }}/>
  }
  const quienes = media.tipo === 'arquero' ? 'arqueros' : 'jugadores de campo'
  if (media.sinMedia) {
    return (
      <div style={{ padding: 14, borderRadius: 14, background: 'rgba(255,255,255,.04)', border: `1px solid ${J.linea}`, marginBottom: 14, fontSize: '1.02rem', lineHeight: 1.45, color: J.text2 }}>
        <b style={{ color: J.text }}>Todavía no tienes media.</b> Juega {media.faltan === 1 ? '1 partido más' : `${media.faltan} partidos más`} y aparece tu media, como la de los jugadores profesionales.
      </div>
    )
  }
  const c = colorMedia(media.media)
  return (
    <div style={{ marginBottom: 16 }}>
      {/* El número grande */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 14, borderRadius: 16, background: `radial-gradient(80% 120% at 0% 50%, ${c}2e, transparent 70%), rgba(255,255,255,.04)`, border: `1px solid ${c}66` }}>
        <div style={{ width: 92, height: 92, flexShrink: 0, clipPath: HEXAGONO, WebkitClipPath: HEXAGONO, background: `linear-gradient(160deg, #fff8, ${c})`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontFamily: FD, fontSize: '3rem', lineHeight: .9, color: '#141414', paddingTop: 4 }}><Contador valor={media.media}/></span>
          <span style={{ fontSize: '.7rem', fontWeight: 900, letterSpacing: '.12em', color: '#141414' }}>MEDIA</span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '1.12rem', fontWeight: 900, lineHeight: 1.25 }}>Tu media es {media.media}</div>
          <div style={{ fontSize: '.95rem', color: J.text2, marginTop: 4, lineHeight: 1.4 }}>
            Eres mejor que el <b style={{ color: c }}>{media.superaA}%</b> de los {quienes} de Golmebol.
          </div>
        </div>
      </div>

      {/* Por qué */}
      <div style={{ fontSize: '.9rem', fontWeight: 900, letterSpacing: '.05em', textTransform: 'uppercase', color: J.muted, margin: '16px 2px 8px' }}>¿Por qué tienes esta media?</div>
      <div style={{ display: 'grid', gap: 10 }}>
        {media.partes.map(p => {
          const esFuerte = p.k === media.fuerte?.k, esDebil = p.k === media.debil?.k && media.debil.p < .5
          const color = esFuerte ? J.green : esDebil ? J.red : J.text2
          return (
            <div key={p.k}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: '.98rem', fontWeight: 800 }}>
                  {p.nombre}: <span style={{ color: J.text2, fontWeight: 600 }}>{p.texto}</span>
                  {esFuerte && <span style={{ marginLeft: 6, fontSize: '.75rem', fontWeight: 900, color: J.greenDk, background: J.green, borderRadius: 999, padding: '1px 7px' }}>TU FUERTE</span>}
                  {esDebil && <span style={{ marginLeft: 6, fontSize: '.75rem', fontWeight: 900, color: '#fff', background: J.red, borderRadius: 999, padding: '1px 7px' }}>LO QUE TE BAJA</span>}
                </span>
              </div>
              <Barra p={p.p} color={color === J.text2 ? J.azul : color}/>
              <div style={{ fontSize: '.82rem', color: J.muted, marginTop: 3 }}>
                {p.k === 'titulos' && p.p === 0 ? 'Todavía no suma: sal campeón, subcampeón o tercero de un torneo' : `Mejor que el ${Math.round(p.p * 100)}% de los ${quienes}`}
              </div>
            </div>
          )
        })}
      </div>

      {/* Retos */}
      <div style={{ fontSize: '.9rem', fontWeight: 900, letterSpacing: '.05em', textTransform: 'uppercase', color: J.muted, margin: '18px 2px 8px' }}>🎯 Retos para subir tu media</div>
      {media.retos.length > 0 ? (
        <div style={{ display: 'grid', gap: 8 }}>
          {media.retos.map(r => (
            <div key={r.texto} className="gj-abre" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 12, background: 'rgba(245,182,35,.08)', border: `1px solid ${J.gold}44` }}>
              <span style={{ fontSize: '1.5rem', lineHeight: 1 }}>{r.icono}</span>
              <span style={{ flex: 1, minWidth: 0, fontSize: '1rem', fontWeight: 700, lineHeight: 1.3 }}>{r.texto}</span>
              <span style={{ textAlign: 'center', flexShrink: 0 }}>
                <span style={{ display: 'block', fontFamily: FD, fontSize: '1.6rem', lineHeight: .9, color: J.green }}>+{r.sube}</span>
                <span style={{ display: 'block', fontSize: '.72rem', fontWeight: 800, color: J.muted }}>LLEGAS A {r.media}</span>
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ fontSize: '.98rem', color: J.text2, lineHeight: 1.45 }}>Estás muy arriba: para subir más tienes que mantener el nivel partido a partido. ¡Sigue así!</div>
      )}
      <div style={{ fontSize: '.82rem', color: J.muted, marginTop: 10, lineHeight: 1.4 }}>
        La media se compara con todos los {quienes} de Golmebol que tienen al menos 3 partidos y se actualiza con cada partido.
        {media.conTiempo && ' Cuenta más lo reciente: un partido o un título de hace 6 meses vale la mitad, y uno de hace un año la cuarta parte. Si dejas de jugar, tu media va bajando.'}
      </div>
    </div>
  )
}
