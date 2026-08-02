import { createClient } from '@supabase/supabase-js'
import { notify } from './notify'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

// Cliente "silencioso": para sincronizaciones internas que corren solas en
// segundo plano (no las dispara la persona con una acción tipo "Guardar"),
// así no le sale un aviso de "cambios guardados" por algo que no hizo a
// propósito. Se usa puntualmente (ver App.jsx, vinculación de user_id al
// cargar el rol en cada sesión).
export const supabaseSilent = createClient(url, key)

// Cliente normal — con aviso automático de "cambios guardados". En vez de
// agregar un toast a mano en cada una de las ~90 páginas del proyecto,
// enganchamos acá el único punto por el que pasa CUALQUIER guardado/edición/
// borrado de la app (insert/update/upsert/delete de supabase-js) y
// disparamos la notificación global sola. Los .select()/.eq()/.single() que
// se encadenen después siguen funcionando exactamente igual — el aviso se
// dispara al final, solo cuando la operación ya resolvió sin error.
const cliente = createClient(url, key)

const MENSAJES = {
  insert: 'Cambios guardados ✓',
  update: 'Cambios guardados ✓',
  upsert: 'Cambios guardados ✓',
  delete: 'Eliminado ✓',
}

function conAviso(builder, accion) {
  if (!builder || typeof builder.then !== 'function') return builder
  const thenOriginal = builder.then.bind(builder)
  builder.then = (onFulfilled, onRejected) => thenOriginal((resultado) => {
    if (resultado && !resultado.error) notify(MENSAJES[accion])
    return onFulfilled ? onFulfilled(resultado) : resultado
  }, onRejected)
  return builder
}

const fromOriginal = cliente.from.bind(cliente)
cliente.from = (tabla) => {
  const qb = fromOriginal(tabla)
  for (const accion of ['insert', 'update', 'upsert', 'delete']) {
    const metodoOriginal = qb[accion]?.bind(qb)
    if (!metodoOriginal) continue
    qb[accion] = (...args) => conAviso(metodoOriginal(...args), accion)
  }
  return qb
}

export const supabase = cliente
