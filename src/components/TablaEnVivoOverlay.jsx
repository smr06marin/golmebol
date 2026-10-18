// Gráfica de "tabla de posiciones" para la transmisión en vivo — igual que
// GolesEnVivoOverlay, se activa a propósito desde el panel de control de
// /admin/config-sitio. No calcula nada por su cuenta: recibe las filas ya
// calculadas con computeTablaGeneral (misma función que usa la tabla de
// posiciones real del torneo, en AdminTorneoDetallePage/TorneoPublicoPage),
// para no duplicar esa lógica acá.
const ROJO_VIVO = '#e5433d'

export default function TablaEnVivoOverlay({ filas }) {
  if (!filas || !filas.length) return null
  // Top 10 — es una gráfica de transmisión, no la tabla completa. Si un equipo
  // que está jugando AHORA queda fuera del top 10, igual se muestra abajo con su
  // posición real, para que se vea cómo va la tabla con ese partido.
  const N = 10
  const top = filas.slice(0, N).map((f, i) => ({ f, pos: i + 1 }))
  const extra = filas.slice(N).map((f, i) => ({ f, pos: i + N + 1 })).filter(x => x.f.enVivo)
  const hayVivo = filas.some(f => f.enVivo)

  const fila = ({ f, pos }) => (
    <div key={f.equipo?.id || pos} style={{
      display: 'flex', alignItems: 'center', gap: '7px', borderRadius: '5px', padding: '0 4px', margin: '0 -4px',
      background: f.enVivo ? 'rgba(229,67,61,.2)' : 'transparent',
    }}>
      <span style={{ fontSize: 'clamp(.54rem, 2.2vw, .68rem)', fontWeight: 900, color: f.enVivo ? '#fff' : '#9aa0a6', minWidth: '16px', flexShrink: 0 }}>
        {pos}
      </span>
      <span style={{ fontSize: 'clamp(.56rem, 2.3vw, .7rem)', fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
        {f.equipo?.name || '—'}
        {f.enVivo && <span style={{ color: '#ff8a84', fontWeight: 900, fontSize: '.85em', marginLeft: '6px' }}>● {f.enVivo.gf}-{f.enVivo.gc}{f.enVivo.rival ? ` vs ${f.enVivo.rival}` : ''}</span>}
      </span>
      <span style={{ fontSize: 'clamp(.5rem, 2vw, .6rem)', fontWeight: 600, color: '#9aa0a6', flexShrink: 0 }}>
        PJ {f.pj}
      </span>
      <span style={{ fontSize: 'clamp(.5rem, 2vw, .6rem)', fontWeight: 600, color: '#9aa0a6', flexShrink: 0, minWidth: '30px', textAlign: 'right' }}>
        DG {f.gf - f.gc}
      </span>
      <span style={{ fontSize: 'clamp(.6rem, 2.5vw, .76rem)', fontWeight: 900, color: '#fff', flexShrink: 0, minWidth: '24px', textAlign: 'right' }}>
        {f.pts}
      </span>
    </div>
  )

  return (
    <div style={{
      position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)', zIndex: 2,
      width: 'min(96%, 460px)', boxSizing: 'border-box', pointerEvents: 'none',
      background: 'rgba(6,6,8,.94)', borderRadius: '10px 10px 0 0', boxShadow: '0 -3px 14px rgba(0,0,0,.5)',
      padding: 'clamp(6px, 2vw, 10px) clamp(8px, 2.4vw, 14px)', borderTop: `2px solid ${ROJO_VIVO}`,
    }}>
      <div style={{ fontSize: 'clamp(.52rem, 2.2vw, .62rem)', fontWeight: 900, color: '#f5a623', letterSpacing: '.08em', marginBottom: '4px' }}>
        🏆 {hayVivo ? 'ASÍ VA LA TABLA' : 'TABLA DE POSICIONES'}
        {hayVivo && <span style={{ color: ROJO_VIVO, marginLeft: '8px' }}>● EN VIVO · PROVISIONAL</span>}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
        {top.map(fila)}
        {extra.length > 0 && <div style={{ textAlign: 'center', color: '#9aa0a6', fontSize: 'clamp(.5rem, 2vw, .6rem)', lineHeight: 1 }}>···</div>}
        {extra.map(fila)}
      </div>
    </div>
  )
}
