// Datos propios de la planilla de papel (la hoja impresa): árbitro central y
// asistentes, DT, #carnés, capitán, las 4 preguntas Sí/No de cada equipo y el
// informe arbitral. Se guardan en matches.planilla_papel (jsonb) y viajan
// dentro del borrador en vivo para que todos los celulares vean lo mismo.

export const PREGUNTAS_PAPEL = [
  { clave: 'balon', texto: 'Presentación del Balón durante todo el partido' },
  { clave: 'basura', texto: 'Basura Cero (Entregar escenario y graderías limpio)' },
  { clave: 'comportamiento', texto: 'Buen comportamiento de los Acompañantes' },
  { clave: 'tarde', texto: 'Ingresaron tarde al terreno de juego' },
]

function equipoVacio() {
  return { dtDoc: '', dtNombre: '', carnes: '', capitan: '', resp: { balon: null, basura: null, comportamiento: null, tarde: null } }
}

// Penales (igual que el recuadro "Hubo penales" de la planilla profesional)
function penalesVacios() {
  return { hubo: false, local: '', visitante: '', ganador: '' }
}

export function papelVacio() {
  return { arbitros: { central: '', asist1: '', asist2: '' }, local: equipoVacio(), visitante: equipoVacio(), informe: '', penales: penalesVacios() }
}

const texto = v => (typeof v === 'string' ? v : (v == null ? '' : String(v)))

function mezclarEquipo(base, x) {
  if (!x || typeof x !== 'object') return base
  const resp = { ...base.resp }
  Object.keys(resp).forEach(k => { const r = x.resp?.[k]; resp[k] = (r === 'si' || r === 'no') ? r : null })
  return { dtDoc: texto(x.dtDoc), dtNombre: texto(x.dtNombre), carnes: texto(x.carnes), capitan: texto(x.capitan), resp }
}

// Acepta cualquier cosa (null, un borrador viejo, un jsonb de la base) y
// devuelve siempre un objeto completo y válido.
export function normalizarPapel(x) {
  const v = papelVacio()
  if (!x || typeof x !== 'object') return v
  return {
    arbitros: { central: texto(x.arbitros?.central), asist1: texto(x.arbitros?.asist1), asist2: texto(x.arbitros?.asist2) },
    local: mezclarEquipo(v.local, x.local),
    visitante: mezclarEquipo(v.visitante, x.visitante),
    informe: texto(x.informe),
    penales: {
      hubo: x.penales?.hubo === true,
      local: texto(x.penales?.local),
      visitante: texto(x.penales?.visitante),
      ganador: (x.penales?.ganador === 'local' || x.penales?.ganador === 'visitante') ? x.penales.ganador : '',
    },
  }
}

// Lo que se guarda en matches.planilla_papel al cerrar el partido.
export function papelParaGuardar(papel) {
  return { v: 1, ...normalizarPapel(papel) }
}
