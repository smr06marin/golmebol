export default function CardEffects({ efectos = [], color = '#00ddd0' }) {
    return (
      <>
        {efectos.includes('brillo_diagonal') && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none',
            background: `linear-gradient(142deg, rgba(255,255,255,.13) 0%, rgba(255,255,255,.06) 18%, transparent 40%)`,
          }} />
        )}
        {efectos.includes('brillo_suave') && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none',
            background: `radial-gradient(ellipse 80% 50% at 50% 0%, ${color}22 0%, transparent 65%)`,
          }} />
        )}
        {efectos.includes('rayas_diagonales') && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none',
            background: `repeating-linear-gradient(54deg, transparent 0, transparent 24px, rgba(255,255,255,.018) 24px, rgba(255,255,255,.018) 25px),
              repeating-linear-gradient(-54deg, transparent 0, transparent 24px, ${color}11 24px, ${color}11 25px)`,
          }} />
        )}
        {efectos.includes('rayas_metalicas') && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none',
            background: `repeating-linear-gradient(90deg, transparent 0, transparent 18px, rgba(255,255,255,.025) 18px, rgba(255,255,255,.025) 19px)`,
          }} />
        )}
        {efectos.includes('ondas_suaves') && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none',
            background: `repeating-radial-gradient(ellipse 100% 60% at 50% 50%, transparent 0%, transparent 18%, ${color}0a 18%, ${color}0a 19%)`,
          }} />
        )}
        {efectos.includes('lineas_cesped') && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none',
            background: `repeating-linear-gradient(0deg, transparent 0, transparent 8px, rgba(0,232,122,.04) 8px, rgba(0,232,122,.04) 9px)`,
          }} />
        )}
        {efectos.includes('brillo_metalico') && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none',
            background: `linear-gradient(125deg, rgba(255,255,255,.18) 0%, rgba(255,255,255,.06) 20%, transparent 45%, rgba(255,255,255,.04) 70%, transparent 100%)`,
          }} />
        )}
        {efectos.includes('grid_tech') && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none',
            background: `repeating-linear-gradient(0deg, transparent 0, transparent 20px, ${color}08 20px, ${color}08 21px),
              repeating-linear-gradient(90deg, transparent 0, transparent 20px, ${color}08 20px, ${color}08 21px)`,
          }} />
        )}
        {efectos.includes('lineas_matrix') && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none',
            background: `repeating-linear-gradient(0deg, transparent 0, transparent 6px, rgba(0,255,150,.04) 6px, rgba(0,255,150,.04) 7px)`,
          }} />
        )}
        {efectos.includes('textura_tierra') && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none',
            background: `repeating-linear-gradient(45deg, transparent 0, transparent 8px, rgba(180,80,20,.04) 8px, rgba(180,80,20,.04) 9px),
              repeating-linear-gradient(-45deg, transparent 0, transparent 8px, rgba(180,80,20,.03) 8px, rgba(180,80,20,.03) 9px)`,
          }} />
        )}
        {efectos.includes('textura_oxido') && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none',
            background: `repeating-linear-gradient(30deg, transparent 0, transparent 10px, rgba(160,60,10,.05) 10px, rgba(160,60,10,.05) 11px)`,
          }} />
        )}
        {efectos.includes('cristales') && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none',
            background: `linear-gradient(148deg, rgba(180,220,255,.18) 0%, rgba(180,220,255,.06) 28%, transparent 55%)`,
            clipPath: 'polygon(0 0, 100% 0, 55% 100%, 0 80%)',
          }} />
        )}
        {efectos.includes('particulas') && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none',
            background: `radial-gradient(circle at 20% 20%, ${color}18 0%, transparent 25%),
              radial-gradient(circle at 80% 40%, ${color}12 0%, transparent 20%),
              radial-gradient(circle at 40% 80%, ${color}10 0%, transparent 22%)`,
          }} />
        )}
      </>
    )
  }