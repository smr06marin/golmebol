import { create } from 'zustand'

export const useAuthStore = create((set) => ({
  user: null,
  player: null,
  loading: false,
  setUser: (user) => set({ user }),
  setPlayer: (player) => set({ player }),
  setLoading: (loading) => set({ loading }),
  logout: () => set({ user: null, player: null }),
}))