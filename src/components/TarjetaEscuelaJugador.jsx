const S = {
  card: '#111827', card2: '#1a2234', border: '#1e2d3d',
  cyan: '#00ddd0', cyanDim: 'rgba(0,221,208,.12)', gold: '#f9a825',
  text: '#e8f4fd', text2: '#b8d4e8', muted: '#7a9ab5',
}

const STAT_LABELS = {
  goles_escuela: { l:'Goles', icon:'⚽' },
  asistencias_escuela: { l:'Asistencias', icon:'🎯' },
  amarillas_escuela: { l:'Amarillas', icon:'🟨' },
  rojas_escuela: { l:'Rojas', icon:'🟥' },
  partidos_escuela: { l:'Partidos', icon:'👕' },
  mvp_escuela: { l:'MVP', icon:'👑' },
}

function calcularEdad(fecha) {
  if (!fecha) return null
  const hoy = new Date(), nac = new Date(fecha)
  let edad = hoy.getFullYear() - nac.getFullYear()
  const m = hoy.getMonth() - nac.getMonth()
  if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) edad--
  return edad
}

// Tarjeta de un jugador de escuela: foto, datos básicos, stats acumuladas en
// partidos de escuela y premios (bloqueados/desbloqueados según umbral).
// Reutilizable en modo lectura (acudiente) o edición (coordinador, vía props).
export default function TarjetaEscuelaJugador({ jugador, premios = [], premiosTorneo = [] }) {
  if (!jugador) return null
  const edad = calcularEdad(jugador.fecha_nacimiento)
  const foto = jugador.photo_face_url || jugador.photo_url

  const stats = ['goles_escuela','asistencias_escuela','partidos_escuela','mvp_escuela']

  return (
    <div style={{ background:'linear-gradient(160deg,#1a2234,#0a0e18)', border:`1px solid ${S.border}`, borderRadius:18, padding:18, maxWidth:340, margin:'0 auto' }}>
      <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:16 }}>
        <div style={{ width:64, height:64, borderRadius:'50%', background:S.card2, overflow:'hidden', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', border:`2px solid ${S.cyan}` }}>
          {foto ? <img src={foto} style={{ width:'100%', height:'100%', objectFit:'cover' }}/> : <span style={{ fontSize:26 }}>👤</span>}
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontWeight:900, fontSize:'1.05rem', color:S.text }}>{jugador.name}</div>
          <div style={{ fontSize:'.72rem', color:S.muted, marginTop:2 }}>
            {edad !== null && <span>{edad} años</span>}
            {jugador.posicion && <span> · ⚽ {jugador.posicion}</span>}
            {jugador.tipo_sangre && <span> · 🩸 {jugador.tipo_sangre}</span>}
          </div>
          {(jugador.pie_dominante || jugador.anios_jugando) && (
            <div style={{ fontSize:'.68rem', color:S.muted, marginTop:1 }}>
              {jugador.pie_dominante && <span>🦶 {jugador.pie_dominante}</span>}
              {jugador.pie_dominante && jugador.anios_jugando ? ' · ' : ''}
              {jugador.anios_jugando ? <span>{jugador.anios_jugando} años jugando</span> : ''}
            </div>
          )}
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:16 }}>
        {stats.map(k => (
          <div key={k} style={{ background:'rgba(255,255,255,.04)', border:`1px solid ${S.border}`, borderRadius:10, padding:'10px 8px', textAlign:'center' }}>
            <div style={{ fontSize:'1.3rem', fontWeight:900, color:S.cyan }}>{jugador[k] || 0}</div>
            <div style={{ fontSize:'.62rem', color:S.muted, marginTop:2 }}>{STAT_LABELS[k].icon} {STAT_LABELS[k].l}</div>
          </div>
        ))}
      </div>

      {premiosTorneo.length > 0 && (
        <div style={{ marginBottom:16 }}>
          <div style={{ fontSize:'.68rem', color:S.muted, textTransform:'uppercase', letterSpacing:'.05em', marginBottom:8 }}>Premios de torneos</div>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {premiosTorneo.map(p => (
              <div key={p.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 10px', borderRadius:10, background:'rgba(249,168,37,.1)', border:`1px solid ${S.gold}55` }}>
                <span style={{ fontSize:'1.1rem' }}>{p.emoji || '🏆'}</span>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:'.78rem', fontWeight:700, color:S.text }}>{p.nombre}</div>
                  <div style={{ fontSize:'.64rem', color:S.muted, marginTop:1 }}>
                    {p.torneo?.nombre}{p.descripcion ? ` · ${p.descripcion}` : ''}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {premios.length > 0 && (
        <div>
          <div style={{ fontSize:'.68rem', color:S.muted, textTransform:'uppercase', letterSpacing:'.05em', marginBottom:8 }}>Premios</div>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {premios.map(p => {
              const actual = jugador[p.tipo_stat] || 0
              const desbloqueado = actual >= p.umbral
              return (
                <div key={p.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 10px', borderRadius:10, background: desbloqueado ? S.cyanDim : 'rgba(255,255,255,.02)', border:`1px solid ${desbloqueado ? S.cyan+'55' : S.border}`, opacity: desbloqueado?1:.55 }}>
                  <span style={{ fontSize:'1.1rem' }}>{desbloqueado ? (p.emoji || '🏆') : '🔒'}</span>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:'.78rem', fontWeight:700, color:desbloqueado?S.text:S.muted }}>{p.nombre}</div>
                    <div style={{ fontSize:'.64rem', color:S.muted, marginTop:1 }}>
                      {STAT_LABELS[p.tipo_stat]?.l || p.tipo_stat}: {actual}/{p.umbral}{p.descripcion ? ` · ${p.descripcion}` : ''}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
