import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Building2, MapPin, ArrowLeft, CalendarCheck } from 'lucide-react'

const S = {
  bg: '#0a0a0a', bg2: '#111111', card: '#161616', border: '#2a2a2a',
  green: '#6fcf3d', text: '#f2f2f2', text2: '#c9c9c9', muted: '#8a8a8a',
}

// Listado público de TODOS los escenarios deportivos activos — antes la
// landing solo llevaba directo al primer escenario que trajera la consulta
// (escenarios[0]), así que con más de un escenario creado los demás quedaban
// invisibles para el público. Esta página es el "VER ESCENARIOS" real.
export default function EscenariosPublicoPage() {
  const navigate = useNavigate()
  const [escenarios, setEscenarios] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchEscenarios() }, [])

  async function fetchEscenarios() {
    const { data } = await supabase.from('escenarios')
      .select('id, name, city, direccion, logo_url, imagen_fondo_url')
      .eq('activo', true)
      .order('name', { ascending: true })
    setEscenarios(data || [])
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', background: S.bg, color: S.text, fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ maxWidth: '780px', margin: '0 auto', padding: '20px 16px 60px' }}>
        <button onClick={() => navigate(-1)} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', color: S.muted, fontSize: '.82rem', fontWeight: 700, cursor: 'pointer', padding: '8px 0', marginBottom: '10px' }}>
          <ArrowLeft size={16}/> Volver
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
          <Building2 size={22} color={S.green}/>
          <h1 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 900 }}>Escenarios deportivos</h1>
        </div>
        <p style={{ color: S.text2, fontSize: '.85rem', margin: '0 0 24px', lineHeight: 1.5 }}>
          Elegí una cancha y reservá tu horario en segundos.
        </p>

        {loading ? (
          <div style={{ color: S.muted, fontSize: '.85rem', padding: '40px 0', textAlign: 'center' }}>Cargando...</div>
        ) : escenarios.length === 0 ? (
          <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: '14px', padding: '32px', textAlign: 'center', color: S.muted, fontSize: '.85rem' }}>
            Todavía no hay escenarios disponibles.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '14px' }}>
            {escenarios.map(e => (
              <div key={e.id} onClick={() => navigate('/reservar/' + e.id)} className="gm-hover"
                style={{ position: 'relative', cursor: 'pointer', borderRadius: '16px', overflow: 'hidden', border: `1px solid ${S.border}`, minHeight: '170px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: '18px',
                  backgroundImage: e.imagen_fondo_url ? `linear-gradient(180deg, rgba(10,10,10,.15), rgba(10,10,10,.92)), url(${e.imagen_fondo_url})` : `linear-gradient(160deg, ${S.card}, ${S.bg2})`,
                  backgroundSize: 'cover', backgroundPosition: 'center' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', overflow: 'hidden', background: '#fff', border: `1px solid ${S.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '10px', flexShrink: 0 }}>
                  {e.logo_url ? <img src={e.logo_url} style={{ width: '100%', height: '100%', objectFit: 'contain' }}/> : <Building2 size={17} color="#333"/>}
                </div>
                <div style={{ fontWeight: 900, fontSize: '1rem', marginBottom: '4px' }}>{e.name}</div>
                {(e.city || e.direccion) && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: S.text2, fontSize: '.76rem', marginBottom: '10px' }}>
                    <MapPin size={12}/> {[e.city, e.direccion].filter(Boolean).join(' · ')}
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: S.green, fontSize: '.78rem', fontWeight: 800 }}>
                  <CalendarCheck size={14}/> RESERVAR CANCHA
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
