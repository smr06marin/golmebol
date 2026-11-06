// Guías paso a paso para ORGANIZADORES, usadas por el asistente automático del chat de ayuda.
// Reconoce la pregunta por palabras clave (sin inteligencia artificial) y responde con pasos cortos
// y, si ya está cargado, el link del video corto (YouTube, no listado). Si no reconoce la pregunta,
// devuelve null y el mensaje le llega a una persona por Telegram como siempre.
//
// Para poner o cambiar un video: pega el link en VIDEOS (una línea por guía). Vacío = la guía sale solo con pasos.

export const VIDEOS = {
  'crear-torneo': 'https://youtube.com/shorts/Qnmd9ZVan8w',
  'crear-torneo-con-finanzas': 'https://youtube.com/shorts/kKh6yg9Z4wQ',
  'crear-equipo': 'https://youtube.com/shorts/YOIHe45uBOE',
  'agregar-canchas': 'https://youtube.com/shorts/lFeAtCk_0kU',
  'crear-un-partido': 'https://youtube.com/shorts/_ID-QO-Q6HU',
  'crear-jornada-aleatoria': 'https://youtube.com/shorts/La_d-xRG13I',
}

const GUIAS = [
  {
    slug: 'crear-jornada-aleatoria',
    titulo: 'Armar una jornada con sorteo',
    rx: /jornada|fecha completa|sorteo de partidos|partidos aleatorios|calendario (automatico|aleatorio)|armar (todo )?el calendario|generar (el )?calendario|(programar|programo|armar|armo|crear|creo|hacer|hago) (todos|varios|muchos) (los )?partidos|partidos de una vez/,
    pasos: [
      'Entra a tu torneo y abre la pestaña «Calendario».',
      'Toca «Programar partidos» y elige «Jornada completa».',
      'Escribe el número de jornada y la fecha de inicio.',
      'Marca los días y escribe los horarios de cada cancha.',
      'Toca «Generar jornada aleatoria» y revisa los cruces.',
      'Si te gustan, toca «Guardar jornada». Si no, «Regenerar».',
    ],
    nota: 'Antes necesitas tener los equipos y las canchas del torneo.',
  },
  {
    slug: 'crear-torneo-con-finanzas',
    titulo: 'Crear un torneo llevando las cuentas',
    rx: /finanzas|con (las )?cuentas|llevar (las )?cuentas|cuentas del torneo|ganancias|ingresos|gastos|cobrar (la )?inscripcion|plata del torneo|dinero del torneo|cobrar tarjetas/,
    pasos: [
      'Toca «Nuevo torneo» y llena los datos del torneo.',
      'En «Reglas y dinero», marca «Quiero llevar las cuentas de dinero del torneo».',
      'Elige si cobras la inscripción por equipo o por jugador y escribe los valores.',
      'Toca «Crear torneo».',
      'Tus cuentas quedan en la pestaña «Finanzas» del torneo.',
    ],
    nota: 'Todos los valores se pueden cambiar después con «Modificar precios».',
  },
  {
    slug: 'crear-torneo',
    titulo: 'Crear un torneo sencillo',
    rx: /(cre\w*|hac\w*|mont\w*|arm\w*|abr\w*|empez\w*|inici\w*|configur\w*).{0,25}torneo|(nuevo|otro) torneo|torneo nuevo|como (creo|hago|armo|monto) (un |mi |el )?torneo/,
    pasos: [
      'En «Torneos», toca el botón azul «Nuevo torneo».',
      'Escribe el nombre, la temporada (el año) y dónde se juega.',
      'Elige modalidad, género, categoría, formato y fecha de inicio. Lo que tiene * es obligatorio.',
      'Toca «Siguiente: reglas y dinero». Las reglas ya vienen listas.',
      'Deja sin marcar las cuentas si no las necesitas y toca «Crear torneo».',
    ],
    nota: 'Puedes crear todos los torneos que necesites.',
  },
  {
    slug: 'crear-equipo',
    titulo: 'Crear un equipo e inscribirlo',
    rx: /(cre\w*|agreg\w*|inscrib\w*|registr\w*|anad\w*|ingres\w*|nuevo).{0,20}equipos?|equipo nuevo|cupo( de)? equipos?|alcanzaste el cupo|no (me )?deja \w+.{0,15}equipo/,
    pasos: [
      'Entra a tu torneo, abre «Equipos» y toca «Agregar equipo».',
      'Escribe el nombre para buscar si el equipo ya existe.',
      'Si no existe, toca «+ Crear equipo nuevo».',
      'Llena el nombre, la cédula del dueño, y su nombre y teléfono.',
      'Toca «Crear e inscribir en el torneo».',
    ],
    nota: 'Si sale «Cupo 0/0» o el aviso de cupo, toca «Pedir cupo por WhatsApp» y Golmebol te lo habilita.',
  },
  {
    slug: 'agregar-canchas',
    titulo: 'Agregar las canchas del torneo',
    rx: /(cre\w*|agreg\w*|anad\w*|registr\w*|configur\w*|pon\w*|nuevas?).{0,20}canchas?|donde se juega|escenarios? del torneo/,
    pasos: [
      'Entra a tu torneo y abre «Calendario».',
      'En el paso «Canchas», escribe el nombre de la cancha y toca «Agregar».',
      'Repite con cada cancha. Cuando haya una, ya puedes programar partidos.',
    ],
    nota: 'Primero las canchas, después los partidos.',
  },
  {
    slug: 'crear-un-partido',
    titulo: 'Crear un solo partido',
    rx: /(cre\w*|program\w*|agreg\w*|arm\w*|anad\w*|pon\w*|asign\w*|mont\w*).{0,20}(un |el )?partidos?|partido nuevo|como programo/,
    pasos: [
      'Entra a tu torneo, abre «Calendario» y toca «Un solo partido».',
      'Elige el equipo local y el visitante.',
      'Escoge el día, la hora y la cancha.',
      'Toca «Guardar»: el partido queda creado.',
    ],
    nota: 'Para programar muchos partidos de una vez, pregúntame por la «jornada aleatoria».',
  },
]

const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()

// texto ya normalizado o crudo → { texto } con la guía que corresponda, o null
export function responderGuia(textoOriginal) {
  const t = norm(textoOriginal)
  if (!t) return null
  const g = GUIAS.find(x => x.rx.test(t))
  if (!g) return null
  const video = VIDEOS[g.slug]
  const pasos = g.pasos.map((p, i) => `${i + 1}. ${p}`).join('\n')
  return {
    texto: `📘 ${g.titulo}\n\n${pasos}${g.nota ? `\n\n💡 ${g.nota}` : ''}${video ? `\n\n🎥 Míralo en video corto: ${video}` : ''}\n\n¿Te quedó alguna duda? Escríbela, o toca «Hablar con una persona».`,
  }
}
