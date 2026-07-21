import PortalesMenu from './PortalesMenu'

const TEMA = {
  dark:  { bg1: '#0d1117', bg2: '#07070e', border: '#1e2d3d', text: '#e8f4fd', muted: '#7a9ab5', avatarBg: '#1a2234', accent: '#00ddd0' },
  light: { bg1: '#ffffff', bg2: '#f8f9fa', border: '#e8eaed', text: '#202124', muted: '#5f6368', avatarBg: '#e8f0fe', accent: '#1a73e8' },
}

// Banner compartido de cabecera para TODOS los portales (jugador, árbitro,
// coordinador de árbitros, profesor/coordinador de escuela) — misma
// estructura y estilo en los cuatro, solo cambian los datos: foto/escudo,
// nombre, rol y a qué portales puede saltar esa cuenta (PortalesMenu).
export default function PortalBanner({
  theme = 'dark', sticky = false,
  avatarUrl, avatarEmoji = '👤', avatarShape = 'circle', onAvatarUpload, uploadingAvatar,
  kicker, title, subtitle, subtitleColor,
  usuario, actual, onLogout, extraButtons,
}) {
  const c = TEMA[theme] || TEMA.dark
  return (
    <div style={{
      background: `linear-gradient(160deg, ${c.bg1}, ${c.bg2})`, borderBottom: `1px solid ${c.border}`,
      ...(sticky ? { position: 'sticky', top: 0, zIndex: 50 } : {}),
    }}>
      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '12px 16px 16px' }}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
          <PortalesMenu usuario={usuario} actual={actual} theme={theme}/>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
            {extraButtons}
            <button onClick={onLogout}
              style={{ background: 'none', border: `1px solid ${c.border}`, borderRadius: '8px', padding: '6px 13px', cursor: 'pointer', color: c.muted, fontSize: '.75rem', fontWeight: '600' }}>
              Salir
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ position: 'relative', width: '56px', height: '56px', flexShrink: 0 }}>
            <div style={{
              width: '56px', height: '56px', borderRadius: avatarShape === 'rounded' ? '14px' : '50%',
              background: c.avatarBg, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: `2px solid ${c.accent}55`, boxShadow: '0 4px 14px rgba(0,0,0,.25)',
            }}>
              {avatarUrl ? <img src={avatarUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/> : <span style={{ fontSize: '1.35rem' }}>{avatarEmoji}</span>}
            </div>
            {onAvatarUpload && (
              <label style={{ position: 'absolute', bottom: '-3px', right: '-3px', width: '22px', height: '22px', borderRadius: '50%', background: c.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: uploadingAvatar ? 'default' : 'pointer', border: `2px solid ${c.bg2}`, opacity: uploadingAvatar ? .6 : 1 }}
                title="Cambiar foto">
                <span style={{ fontSize: '.6rem' }}>📷</span>
                <input type="file" accept="image/*" style={{ display: 'none' }} disabled={uploadingAvatar} onChange={e => onAvatarUpload(e.target.files[0] || null)}/>
              </label>
            )}
          </div>
          <div style={{ minWidth: 0 }}>
            {kicker && <div style={{ fontSize: '.64rem', color: c.muted, textTransform: 'uppercase', letterSpacing: '.1em' }}>{kicker}</div>}
            <div style={{ fontWeight: '900', fontSize: '1.15rem', color: c.text, lineHeight: 1.15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</div>
            {subtitle && <div style={{ fontSize: '.72rem', color: subtitleColor || c.muted, fontWeight: '700', marginTop: '3px' }}>{subtitle}</div>}
          </div>
        </div>

      </div>
    </div>
  )
}
