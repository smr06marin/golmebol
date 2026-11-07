import { useEffect, useState } from 'react'
import { Bell, BellRing } from 'lucide-react'
import { useAvisos, plataformaAvisos, sincronizarAvisos } from '../lib/avisos'
import { mensajeMotivo } from '../lib/avisosTextos'

// Tarjeta del panel del organizador: activa en ESTE celular los avisos de
//   · tarjeta roja en cualquiera de sus partidos (en el momento en que la saca el árbitro)
//   · informe del árbitro (al instante, para leerlo de una vez)
// Usa el mismo botón de avisos de siempre (api/push-enviar.js); al estar con sesión iniciada, el celular queda atado
// al usuario y solo recibe lo de SUS torneos.
export default function AvisosOrganizador() {
  const { activo, activar, desactivar } = useAvisos()
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState('')
  const [motivo, setMotivo] = useState('')
  const donde = plataformaAvisos()

  // Si ya estaban activados (antes de iniciar sesión), se vuelve a registrar el celular con este usuario
  useEffect(() => { if (activo) sincronizarAvisos() }, [activo])

  async function activarAhora() {
    if (ocupado) return
    setOcupado(true); setError(''); setMotivo('')
    const r = await activar()
    setOcupado(false)
    if (!r.ok) { setMotivo(r.motivo); setError(mensajeMotivo(r.motivo, donde) + (r.detalle ? ` (${r.detalle})` : '')) }
  }

  const Icono = activo ? BellRing : Bell
  return (
    <div style={{ background: '#fff', border: `1px solid ${activo ? '#a8dab5' : '#e8eaed'}`, borderRadius: '14px', padding: '16px', marginBottom: '20px', boxShadow: '0 1px 2px rgba(60,64,67,.08)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
        <div style={{ width: 38, height: 38, borderRadius: '50%', background: activo ? '#e6f4ea' : '#e8f0fe', color: activo ? '#188038' : '#1a73e8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icono size={19}/>
        </div>
        <div style={{ fontWeight: 800, color: '#202124', fontSize: '1rem', lineHeight: 1.25 }}>
          {activo ? 'Avisos activados en este celular' : 'Recibe avisos en tu celular'}
        </div>
      </div>
      <div style={{ fontSize: '.86rem', color: '#5f6368', lineHeight: 1.5, marginBottom: '12px' }}>
        {activo
          ? 'Te llega una notificación al instante cuando un árbitro saque una tarjeta roja en uno de tus partidos, o cuando escriba un informe. Toca la notificación y se abre el partido o el informe.'
          : 'Te avisamos al instante cuando un árbitro saque una tarjeta roja en uno de tus partidos, o cuando escriba un informe. Toca la notificación y se abre el partido o el informe.'}
      </div>
      {!activo && (
        <button type="button" onClick={activarAhora} disabled={ocupado}
          style={{ width: '100%', minHeight: 48, borderRadius: '10px', border: 'none', background: '#188038', color: '#fff', fontWeight: 800, fontSize: '.95rem', cursor: ocupado ? 'default' : 'pointer', opacity: ocupado ? .7 : 1 }}>
          {ocupado ? 'Activando…' : 'Activar avisos en este celular'}
        </button>
      )}
      {activo && (
        <button type="button" onClick={() => desactivar()}
          style={{ background: 'none', border: 'none', padding: '8px 0', minHeight: 40, color: '#5f6368', fontWeight: 700, fontSize: '.8rem', cursor: 'pointer', textDecoration: 'underline' }}>
          Quitar los avisos de este celular
        </button>
      )}
      {error && (
        <div style={{ background: '#fce8e6', color: '#b3261e', borderRadius: '10px', padding: '10px 12px', fontSize: '.82rem', fontWeight: 600, lineHeight: 1.45, marginTop: '10px' }}>
          {error}
          {motivo === 'falta_instalar' && <div style={{ marginTop: 6, fontWeight: 500 }}>Pasos: 1) Instala Golmebol en tu pantalla de inicio. 2) Ábrela desde su ícono. 3) Vuelve aquí y toca «Activar avisos».</div>}
        </div>
      )}
    </div>
  )
}
