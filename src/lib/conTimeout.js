// Le pone un límite de tiempo a una promesa (típicamente una llamada a
// Supabase). Si internet está muy lento o la conexión se queda "colgada"
// sin fallar ni responder, sin esto la promesa nunca se resuelve — y
// cualquier botón que dependa de ella (Ingresar, Guardar, etc.) se queda
// cargando para siempre. Con esto, pasado el límite se rechaza con un
// error TIMEOUT que el código que llama puede atrapar y mostrar como
// "esto está tardando demasiado" en vez de dejar al usuario esperando sin
// explicación.
export function conTimeout(promise, ms = 15000) {
  let idTimeout
  const timeout = new Promise((_, reject) => {
    idTimeout = setTimeout(() => reject(new Error('TIMEOUT')), ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(idTimeout))
}
