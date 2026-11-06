// Asistentes del chat de ayuda por turno (hora de Colombia). Los usan el chat del admin y el chat público.
// Turnos de soporte (hora de Colombia). Fuera de 7:00 am – 11:00 pm se muestra a Javier con el aviso de que responde desde las 7:00 am.
export const AGENTES = [
  { id: 'javier', nombre: 'Javier Gonzales', desde: 7 * 60, hasta: 16 * 60, fondo: '#dfe8fb', piel: '#f2c9a0', cuello: '#e3b088', pelo: '#3b2b24', corbata: '#6c35de', gafas: false },
  { id: 'fernando', nombre: 'Fernando Restrepo', desde: 16 * 60, hasta: 23 * 60, fondo: '#fde9d9', piel: '#d9a47a', cuello: '#c98f64', pelo: '#1f1a17', corbata: '#0f9d8a', gafas: true },
]
export const minutosColombia = f => { const d = new Date(f); return (d.getUTCHours() * 60 + d.getUTCMinutes() - 300 + 1440) % 1440 }
export const enTurno = f => { const m = minutosColombia(f); return AGENTES.some(a => m >= a.desde && m < a.hasta) }
export const agenteDe = f => { const m = minutosColombia(f); return AGENTES.find(a => m >= a.desde && m < a.hasta) || AGENTES[0] }
