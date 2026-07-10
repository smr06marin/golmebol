import { create } from 'zustand'

export const useAuthStore = create((set) => ({
  user: null,
  player: null,
  loading: true, // arranca en true: evita que ProtectedRoute/PlayerRoute redirijan a login
                  // antes de que supabase.auth.getSession() confirme la sesión guardada (bug de reload)
  rol: null,        // { rol: 'admin' | 'organizador' | 'arbitro' | null, plan }
  rolCargado: false,
  setUser: (user) => set({ user }),
  setPlayer: (player) => set({ player }),
  setLoading: (loading) => set({ loading }),
  setRol: (rol) => set({ rol, rolCargado: true }),
  empezarCargaRol: () => set({ rolCargado: false }),
  logout: () => set({ user: null, player: null, rol: null, rolCargado: false }),
}))
