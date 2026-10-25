import { FaWhatsapp } from 'react-icons/fa'
import { digitosWhatsapp, telefonoBonito } from '../lib/telefonoCo'

// Franja "Con el apoyo de" de la página de inicio: solo logos, ordenados y discretos, y debajo de
// cada uno su número de contacto (toca el número y abre WhatsApp). Al tocar el logo se abre el
// detalle completo del patrocinador (dirección, redes, botón de WhatsApp).
//
// props:
//  patrocinadores  [{ id, nombre, logo_url, whatsapp }]
//  onSelect(p)     abre el detalle del patrocinador
//  S               paleta de la página (bg, card, border, green, text, text2, muted)

export default function PatrocinadoresFranja({ patrocinadores, onSelect, S }) {
  if (!patrocinadores?.length) return null
  return (
    <div style={{ maxWidth: '860px', margin: '40px auto 0', padding: '0 16px' }}>
      <style>{`
        .gm-fr-item { transition: transform .2s ease; }
        .gm-fr-item:hover { transform: translateY(-2px); }
        .gm-fr-item:hover .gm-fr-logo img { filter: none; opacity: 1; }
        .gm-fr-tel:hover { color: #fff !important; }
      `}</style>
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '18px' }}>
        <span style={{ flex: 1, height: '1px', background: S.border }}/>
        <span style={{ fontSize: '.64rem', fontWeight: 700, letterSpacing: '.22em', color: S.muted, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Con el apoyo de</span>
        <span style={{ flex: 1, height: '1px', background: S.border }}/>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '18px 14px' }}>
        {patrocinadores.map(p => {
          const wa = digitosWhatsapp(p.whatsapp)
          return (
            <div key={p.id} className="gm-fr-item" style={{ width: 'clamp(96px, 28vw, 132px)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', textAlign: 'center' }}>
              <button type="button" onClick={() => onSelect?.(p)} aria-label={`Ver detalle de ${p.nombre}`} className="gm-fr-logo"
                style={{ width: '100%', aspectRatio: '3 / 2', borderRadius: '12px', background: '#fff', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', boxShadow: '0 1px 0 rgba(255,255,255,.06) inset, 0 6px 18px rgba(0,0,0,.35)' }}>
                {p.logo_url
                  ? <img src={p.logo_url} alt={p.nombre} loading="lazy" style={{ maxWidth: '82%', maxHeight: '78%', objectFit: 'contain', filter: 'grayscale(1)', opacity: .9, transition: 'filter .25s ease, opacity .25s ease' }}/>
                  : <span style={{ fontSize: '.72rem', fontWeight: 800, color: '#333', padding: '0 8px' }}>{p.nombre}</span>}
              </button>
              <div style={{ fontSize: '.7rem', fontWeight: 700, color: S.text2, lineHeight: 1.2, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.nombre}</div>
              {wa ? (
                <a className="gm-fr-tel" href={`https://wa.me/${wa}?text=${encodeURIComponent(`Hola! Vi a ${p.nombre} como patrocinador de Golmebol y quería escribirles 🙂`)}`} target="_blank" rel="noopener noreferrer"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '.7rem', color: S.muted, textDecoration: 'none', letterSpacing: '.02em', marginTop: '-3px' }}>
                  <FaWhatsapp size={12} color="#25d366"/> {telefonoBonito(p.whatsapp)}
                </a>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}
