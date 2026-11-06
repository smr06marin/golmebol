// Qué decirle a la persona cuando no se pudieron activar los avisos
export function mensajeMotivo(motivo, donde) {
  if (motivo === 'permiso') {
    return donde === 'nativo'
      ? 'Golmebol no tiene permiso para enviarte notificaciones. Actívalo en Ajustes del celular → Aplicaciones → Golmebol → Notificaciones.'
      : 'Las notificaciones de golmebol.com están bloqueadas en este navegador. Toca el candado junto a la dirección → Notificaciones → Permitir, y vuelve a intentar.'
  }
  if (motivo === 'falta_instalar') return 'En iPhone, Apple solo permite los avisos si Golmebol está instalada en tu pantalla de inicio. Instálala, ábrela desde su ícono y activa los avisos desde ahí.'
  if (motivo === 'no_disponible') return 'Este navegador no permite notificaciones. Prueba con Chrome, o instala la app de Golmebol.'
  return 'No se pudieron activar los avisos. Revisa tu internet e intenta de nuevo.'
}

