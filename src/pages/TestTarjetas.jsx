// Página TEMPORAL de pruebas visuales de tarjetas (se elimina al terminar)
import { useState } from 'react'
import PlayerCard from '../components/card/PlayerCard'
import { CARD_DESIGNS } from '../components/card/designs/cardDesigns'

export default function TestTarjetas() {
  const [montarPrimera, setMontarPrimera] = useState(true)
  const ids = CARD_DESIGNS.map(d => d.id)
  return (
    <div style={{ background: '#07070e', minHeight: '100vh', padding: '20px' }}>
      <button onClick={() => setMontarPrimera(m => !m)}
        style={{ padding: '10px 20px', marginBottom: '16px', fontWeight: 700 }}>
        {montarPrimera ? 'DESMONTAR primera tarjeta (reproducir bug)' : 'Montar primera tarjeta'}
      </button>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px' }}>
        {ids.map((id, i) => (
          (i > 0 || montarPrimera) && (
            <div key={id} id={`slot-${i}`} style={{ width: '250px' }}>
              <div style={{ color: '#fff', fontSize: '11px', marginBottom: '4px' }}>{i}: {id}</div>
              <PlayerCard cardType={id} hideShields={true} playerName="PRUEBA"/>
            </div>
          )
        ))}
      </div>
    </div>
  )
}
