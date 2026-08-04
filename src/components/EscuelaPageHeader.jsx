import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Shield } from 'lucide-react'

const S = { green: '#22c55e', muted: '#7a9ab5', card2: '#1a2234' }

// Encabezado compartido de todas las páginas del portal de escuela: flecha
// atrás, escudo, nombre de la escuela en verde chiquito arriba, título
// grande y un subtítulo opcional con puntito verde — mismo estilo en todas
// las páginas (Jugadores, Profesores, Asistencia, Mensualidades, Rankings,
// Torneos, etc.) en vez de repetir el markup en cada una.
export default function EscuelaPageHeader({
  backTo = '/escuela', escuela, kicker, titulo, subtitulo, accion, logoUrl, showEscudo = true,
  compact = false, children,
}) {
  const navigate = useNavigate()
  return (
    <div style={{ padding: compact ? '12px 14px 10px' : '16px 16px 4px' }}>
      <div style={{ maxWidth: '640px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
          <button onClick={() => navigate(backTo)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: S.muted, padding: '4px 0', flexShrink: 0, display: 'flex' }}>
            <ChevronLeft size={compact ? 20 : 24}/>
          </button>
          {showEscudo && (
            <div style={{ width: compact ? '38px' : '52px', height: compact ? '38px' : '52px', borderRadius: '10px', overflow: 'hidden', flexShrink: 0, background: S.card2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {(logoUrl || escuela?.logo_url)
                ? <img src={logoUrl || escuela.logo_url} style={{ width: '100%', height: '100%', objectFit: 'contain' }}/>
                : <Shield size={compact ? 18 : 24} color={S.muted}/>}
            </div>
          )}
          <div style={{ flex: 1, minWidth: '160px' }}>
            {kicker && <div style={{ fontSize: '.68rem', fontWeight: '800', color: S.green, letterSpacing: '.07em', textTransform: 'uppercase' }}>{kicker}</div>}
            <div style={{ fontSize: compact ? '1.05rem' : '1.4rem', fontWeight: '900', color: '#fff', lineHeight: 1.15, marginTop: kicker ? '2px' : 0, letterSpacing: '.01em' }}>{titulo}</div>
            {subtitulo && (
              <div style={{ fontSize: '.72rem', color: S.muted, marginTop: '5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: S.green, display: 'inline-block', flexShrink: 0 }}/>
                {subtitulo}
              </div>
            )}
          </div>
          {accion}
        </div>
        {children && <div style={{ marginTop: '10px' }}>{children}</div>}
      </div>
    </div>
  )
}
