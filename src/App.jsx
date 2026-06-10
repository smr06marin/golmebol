import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { useAuthStore } from './store/authStore'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import ElegirTarjetaPage from './pages/ElegirTarjetaPage'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuthStore()
  if (loading) return <div style={{ color: 'var(--color-primary)', padding: '2rem', fontFamily: 'var(--font-display)', fontSize: '1.5rem' }}>CARGANDO...</div>
  if (!user) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  const { setUser, setLoading, user } = useAuthStore()
  const [cardType, setCardType] = useState('normal')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })
    return () => subscription.unsubscribe()
  }, [])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
        <Route path="/" element={
          <ProtectedRoute>
            <HomePage cardType={cardType} />
          </ProtectedRoute>
        } />
        <Route path="/elegir-tarjeta" element={
          <ProtectedRoute>
            <ElegirTarjetaPage onSelect={setCardType} currentDesign={cardType} />
          </ProtectedRoute>
        } />
      </Routes>
    </BrowserRouter>
  )
}