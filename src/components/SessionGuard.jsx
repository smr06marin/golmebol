import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { idSesionLocal, guardarIdSesionLocal, limpiarSesionLocal } from '../lib/deviceSession'

// Bloquea que la misma cuenta (jugador, profesor, árbitro, escuela,
// acudiente...) esté abierta en dos dispositivos a la vez. Si entran con la
// misma cédula en otro dispositivo/navegador, este se entera en vivo (por
// Realtime) y se cierra solo. Se monta una sola vez en App.jsx para toda la
// app — los admins (login con correo real, sin fila en "players") no se ven
// afectados porque la consulta no encuentra ninguna fila para ellos.
export default function SessionGuard() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  useEffect(() => {
    if (!user?.id) return
    let cancelado = false

    async function expulsar() {
      if (cancelado) return
      cancelado = true
      await supabase.auth.signOut()
      limpiarSesionLocal()
      logout()
      alert('Tu cuenta se abrió en otro dispositivo. Por seguridad, cerramos esta sesión — si no fuiste tú, cambia tu contraseña.')
      navigate('/jugador/login')
    }

    async function chequearAlEntrar() {
      const { data: p } = await supabase.from('players').select('session_id').eq('user_id', user.id).maybeSingle()
      if (!p || cancelado) return
      const local = idSesionLocal()
      if (!local) {
        // Primera vez que este dispositivo revisa (login de antes de que
        // existiera esta función, o se restauró la sesión guardada) —
        // adopta el valor actual sin sacar a nadie todavía.
        if (p.session_id) guardarIdSesionLocal(p.session_id)
        return
      }
      if (p.session_id && p.session_id !== local) await expulsar()
    }
    chequearAlEntrar()

    const channel = supabase
      .channel(`session-guard-${user.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'players', filter: `user_id=eq.${user.id}` }, (payload) => {
        const local = idSesionLocal()
        const nuevo = payload.new?.session_id
        if (local && nuevo && nuevo !== local) expulsar()
      })
      .subscribe()

    return () => { cancelado = true; supabase.removeChannel(channel) }
  }, [user?.id])

  return null
}
