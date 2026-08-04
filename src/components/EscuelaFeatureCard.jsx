const S = {
  green: '#22c55e', warn: '#f9a825', text: '#e8f4fd', text2: '#b8d4e8',
}

// Tarjeta cuadrada de acceso — mismo estilo en todo el portal de escuela:
// ícono, título y descripción sobre una foto de fondo bien tenue (con una
// capa oscura encima para que el texto se lea bien) y una rayita de color
// abajo. Se usa tanto en el panel principal (Jugadores, Profesores, etc.)
// como dentro de cada jugador (Medidas físicas, Pruebas físicas, Datos
// básicos, etc.) para que todo el portal se vea igual.
export default function EscuelaFeatureCard({ icon, title, desc, bg, badge, warn, onClick }) {
  return (
    <button onClick={onClick} style={{
      position: 'relative', textAlign: 'center', padding: '20px 10px 16px', borderRadius: '16px',
      border: `1px solid ${warn ? S.warn + '77' : S.green + '44'}`, cursor: 'pointer', overflow: 'hidden',
      backgroundImage: `linear-gradient(180deg, rgba(7,7,14,.65) 0%, rgba(7,7,14,.94) 78%), url(${bg})`,
      backgroundSize: 'cover', backgroundPosition: 'center', color: S.text,
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', minHeight: '128px',
    }}>
      {badge > 0 && (
        <span style={{ position: 'absolute', top: '8px', right: '8px', fontSize: '.62rem', fontWeight: '800', color: '#000', background: S.warn, borderRadius: '10px', padding: '1px 7px' }}>{badge}</span>
      )}
      {icon}
      <div style={{ fontWeight: '900', fontSize: '.76rem', letterSpacing: '.03em', textTransform: 'uppercase', color: '#fff' }}>{title}</div>
      {desc && <div style={{ fontSize: '.64rem', color: S.text2, lineHeight: 1.3 }}>{desc}</div>}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '3px', background: warn ? S.warn : S.green }}/>
    </button>
  )
}
