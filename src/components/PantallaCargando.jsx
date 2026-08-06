export function PantallaCargando({ compact = false }) {
  const logoSize = compact ? 40 : 72
  return (
    <div
      role="status"
      aria-label="Cargando"
      style={compact ? {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        padding: '60px 0',
      } : {
        minHeight: '100vh',
        height: '100vh',
        background: 'var(--color-bg)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '16px',
      }}
    >
      <img
        src="/favicon.svg"
        alt=""
        width={logoSize}
        height={logoSize}
        style={{ width: logoSize, height: 'auto', display: 'block' }}
      />
      <div
        className="gm-spinner"
        style={compact ? { width: 22, height: 22, borderWidth: 2 } : undefined}
      />
    </div>
  )
}
