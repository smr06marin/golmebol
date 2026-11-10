import { Lock, X, Check, Star } from 'lucide-react'
import PlayerCard from './PlayerCard'
import { CARD_DESIGNS } from './designs/cardDesigns'
import { NOMBRE_NIVEL, MATERIAL_NIVEL, arteDe } from './designs/cardArte'
import { G } from '../PanelUI'

// Colección de tarjetas del jugador: los 4 niveles, de la primera a la última, con lo que ya tiene,
// la que está usando y lo que le falta para cada una. Las bloqueadas se dejan ver (apagadas) para antojar.

const QUE_TRAE = {
  1: 'Tu primera tarjeta: acabado mate con las líneas de la cancha.',
  2: 'Metal cepillado, marco biselado y remaches.',
  3: 'Facetas de cristal, una gema en la punta y un brillo que la recorre.',
  4: 'Vetas de oro, corona y destellos. Las dos últimas son de oro macizo y de mármol.',
}
const COLOR_NIVEL = { 1: '#35e06f', 2: '#4f92ff', 3: '#a779ff', 4: '#e9c75e' }

export default function ColeccionTarjetas({
  onCerrar, cardType, guardando, estaDesbloqueada, getProgreso, onUsar, onVerBloqueada,
  nombre, cardStats, esPortero, esDefensa, photoUrl, torneosData, equiposData,
  tarjetasCustom = [], getSponsor,
}) {
  const niveles = [1, 2, 3, 4].map(n => ({ n, cartas: CARD_DESIGNS.filter(d => arteDe(d).n === n) }))
  const total = CARD_DESIGNS.length + tarjetasCustom.length
  const tengo = CARD_DESIGNS.filter(d => estaDesbloqueada(d.id)).length + tarjetasCustom.filter(c => estaDesbloqueada(c.id)).length
  const pct = total ? Math.round((tengo / total) * 100) : 0

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,.7)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={onCerrar}>
      <div onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 560, height: '94vh', display: 'flex', flexDirection: 'column', background: G.bg, border: `1px solid ${G.border}`, borderBottom: 'none', borderRadius: '22px 22px 0 0', overflow: 'hidden', color: G.text, fontFamily: 'system-ui,-apple-system,"Segoe UI",Roboto,sans-serif', animation: 'gmFadeUp .25s ease-out' }}>

        {/* Encabezado fijo */}
        <div style={{ flexShrink: 0, padding: '16px 16px 14px', borderBottom: `1px solid ${G.border}`, background: G.card }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '1.3rem', fontWeight: 900 }}>Mis tarjetas</div>
              <div style={{ fontSize: '.95rem', color: G.text2, marginTop: 2 }}>Tienes <b style={{ color: G.text }}>{tengo}</b> de {total}{guardando ? ' · guardando…' : ''}</div>
            </div>
            <button type="button" onClick={onCerrar} aria-label="Cerrar"
              style={{ width: 44, height: 44, borderRadius: '50%', background: G.card2, border: `1px solid ${G.border}`, color: G.text, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><X size={20}/></button>
          </div>
          <div style={{ height: 8, borderRadius: 999, background: G.soft, overflow: 'hidden', marginTop: 12 }} aria-hidden="true">
            <div style={{ width: `${pct}%`, height: '100%', borderRadius: 999, background: `linear-gradient(90deg, ${G.green}, ${G.gold})` }}/>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '6px 0 calc(24px + env(safe-area-inset-bottom))' }}>
          <div style={{ padding: '12px 16px 0', fontSize: '.95rem', color: G.muted, lineHeight: 1.45 }}>
            Cada nivel trae un material mejor. Toca una tarjeta tuya para usarla, o una bloqueada para ver cómo se desbloquea.
          </div>

          {niveles.map(({ n, cartas }) => {
            const mias = cartas.filter(d => estaDesbloqueada(d.id)).length
            return (
              <section key={n} style={{ marginTop: 22 }}>
                <div style={{ padding: '0 16px', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
                  <div style={{ fontSize: '1.08rem', fontWeight: 900, letterSpacing: '.04em' }}>
                    <span style={{ color: COLOR_NIVEL[n] }}>{NOMBRE_NIVEL[n]}</span>
                    <span style={{ color: G.muted, fontWeight: 700 }}> · {MATERIAL_NIVEL[n]}</span>
                  </div>
                  <div style={{ fontSize: '.9rem', fontWeight: 800, color: mias === cartas.length ? G.green : G.text2, flexShrink: 0 }}>{mias}/{cartas.length}</div>
                </div>
                <div style={{ padding: '3px 16px 0', fontSize: '.9rem', color: G.muted, lineHeight: 1.4 }}>{QUE_TRAE[n]}</div>

                <div className="gm-fichas-fila" style={{ display: 'flex', gap: 12, overflowX: 'auto', padding: '14px 16px 6px', scrollSnapType: 'x proximity', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
                  {cartas.map(d => {
                    const mia = estaDesbloqueada(d.id)
                    const activa = d.id === cardType
                    const prog = mia ? null : getProgreso(d.id)
                    return (
                      <button key={d.id} type="button" onClick={() => mia ? onUsar(d.id) : onVerBloqueada(d)}
                        aria-label={`${d.nombre}${activa ? ', la estás usando' : mia ? ', toca para usarla' : ', bloqueada: toca para ver cómo desbloquearla'}`}
                        style={{ flex: '0 0 auto', width: 136, padding: 0, background: 'transparent', border: 'none', cursor: 'pointer', color: G.text, fontFamily: 'inherit', textAlign: 'center', scrollSnapAlign: 'start' }}>
                        <span style={{ position: 'relative', display: 'block', borderRadius: 14, padding: 4, outline: activa ? `2px solid ${G.green}` : 'none', outlineOffset: 2 }}>
                          <span style={{ display: 'block', filter: mia ? undefined : 'saturate(.8) brightness(.68)' }}>
                            <PlayerCard mini playerName={nombre} stats={cardStats} cardType={d.id} esPortero={esPortero} esDefensa={esDefensa}
                              photoUrlExterno={photoUrl} torneosData={torneosData} equiposData={equiposData}/>
                          </span>
                          {!mia && (
                            <span style={{ position: 'absolute', left: '50%', top: '36%', transform: 'translate(-50%,-50%)', width: 40, height: 40, borderRadius: '50%', background: 'rgba(0,0,0,.78)', border: '1.5px solid rgba(255,255,255,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Lock size={20} color="#fff"/>
                            </span>
                          )}
                        </span>
                        <span style={{ display: 'block', fontSize: '.92rem', fontWeight: 800, marginTop: 8, lineHeight: 1.2, color: mia ? G.text : G.text2 }}>{d.nombre}</span>
                        {activa ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 6, fontSize: '.82rem', fontWeight: 800, color: G.greenDk, background: G.green, borderRadius: 999, padding: '4px 10px' }}><Check size={14}/> En uso</span>
                        ) : mia ? (
                          <span style={{ display: 'inline-block', marginTop: 6, fontSize: '.82rem', fontWeight: 800, color: G.green, border: `1.5px solid ${G.green}`, borderRadius: 999, padding: '3px 12px' }}>Usar</span>
                        ) : (
                          <span style={{ display: 'block', marginTop: 6 }}>
                            <span style={{ display: 'block', height: 5, borderRadius: 999, background: G.soft, overflow: 'hidden' }} aria-hidden="true">
                              <span style={{ display: 'block', width: `${prog?.pct || 0}%`, height: '100%', background: G.gold, borderRadius: 999 }}/>
                            </span>
                            <span style={{ display: 'block', fontSize: '.8rem', color: G.muted, marginTop: 4 }}>{prog ? `${prog.actual} de ${prog.meta} logros` : 'Bloqueada'}</span>
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </section>
            )
          })}

          {/* Tarjetas especiales creadas por el torneo */}
          {tarjetasCustom.length > 0 && (
            <section style={{ marginTop: 22, padding: '0 16px' }}>
              <div style={{ fontSize: '1.08rem', fontWeight: 900, letterSpacing: '.04em', color: G.gold, display: 'flex', alignItems: 'center', gap: 8 }}><Star size={18}/> ESPECIALES</div>
              <div style={{ fontSize: '.9rem', color: G.muted, margin: '3px 0 12px' }}>Tarjetas de edición especial del torneo.</div>
              <div style={{ display: 'grid', gap: 10 }}>
                {tarjetasCustom.map(card => {
                  const obj = { id: card.id, nombre: card.nombre, color: card.color || '#e8710a', isCustom: true, descripcion: card.descripcion }
                  const mia = estaDesbloqueada(card.id)
                  const activa = card.id === cardType
                  const prog = getProgreso(card.id)
                  const sponsor = getSponsor?.(`custom_${card.id}`)
                  return (
                    <button key={card.id} type="button" onClick={() => mia ? onUsar(card.id) : onVerBloqueada(obj)}
                      style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', minHeight: 66, padding: '10px 14px', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', color: G.text, background: G.card, border: `1.5px solid ${activa ? G.green : G.border}`, borderRadius: 16 }}>
                      <span style={{ width: 40, height: 40, borderRadius: 11, background: obj.color, opacity: mia ? 1 : .45, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{mia ? <Star size={20} color="#000"/> : <Lock size={18} color="#000"/>}</span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: 'block', fontSize: '1rem', fontWeight: 800 }}>{card.nombre}</span>
                        {card.descripcion && <span style={{ display: 'block', fontSize: '.86rem', color: G.muted, marginTop: 2 }}>{card.descripcion}</span>}
                        {sponsor && <span style={{ display: 'block', fontSize: '.84rem', color: G.muted, marginTop: 2 }}>Patrocina {sponsor.nombre}</span>}
                        {prog && !mia && <span style={{ display: 'block', fontSize: '.84rem', color: G.gold, marginTop: 3, fontWeight: 700 }}>{prog.actual} de {prog.meta} logros</span>}
                      </span>
                      <span style={{ flexShrink: 0, fontSize: '.86rem', fontWeight: 800, color: activa ? G.green : mia ? G.green : G.text2 }}>{activa ? 'En uso' : mia ? 'Usar' : 'Ver'}</span>
                    </button>
                  )
                })}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
