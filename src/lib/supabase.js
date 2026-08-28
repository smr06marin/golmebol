import { createClient } from '@supabase/supabase-js'
import { notify } from './notify'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

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

// Cliente "silencioso": para sincronizaciones internas que corren solas en
// segundo plano (no las dispara la persona con una acción tipo "Guardar"),
// así no le sale un aviso de "cambios guardados" por algo que no hizo a
// propósito. Se usa puntualmente (ver App.jsx, vinculación de user_id al
// cargar el rol en cada sesión).
//
// OJO: antes esto era un createClient(url, key) aparte — un segundo cliente
// de Supabase completo, con su propio manejo de sesión (auth) apuntando al
// mismo proyecto. Dos clientes así compiten por el mismo candado interno de
// Supabase (el que usa para refrescar el token de sesión sin pisarse entre
// pestañas) y de vez en cuando uno se queda esperando al otro — eso es lo
// que se sentía como el login "pegado en Ingresando..." sin avanzar ni dar
// error, sobre todo con internet lento. Ahora supabaseSilent solo reusa el
// mismo cliente de siempre (mismo login, mismo token) pero sin pasar por el
// aviso de "Cambios guardados", así no hay dos sesiones compitiendo.
export const supabaseSilent = { from: fromOriginal }
