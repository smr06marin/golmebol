import { create } from 'zustand'

export const useAuthStore = create((set) => ({
  user: null,
  player: null,
  loading: false,
  rol: null,        // { rol: 'admin' | 'organizador' | 'arbitro' | null, plan }
  rolCargado: false,
  setUser: (user) => set({ user }),
  setPlayer: (player) => set({ player }),
  setLoading: (loading) => set({ loading }),
  setRol: (rol) => set({ rol, rolCargado: true }),
  empezarCargaRol: () => set({ rolCargado: false }),
  logout: () => set({ user: null, player: null, rol: null, rolCargado: false }),
}))
