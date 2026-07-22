import { useState } from 'react'
import { supabase } from '../lib/supabase'

// Cada jugador puede subir su propia foto de perfil y su propia foto de
// tarjeta, pero solo UNA VEZ: en cuanto queda guardada en players.photo_url /
// players.photo_face_url, este componente pasa a modo "bloqueado" y ya no
// deja subir otra. La única forma de volver a habilitar la subida es que un
// admin/coordinador borre esa foto desde su panel (eso pone el campo en null
// de nuevo) — normalmente porque la foto no cumplía la recomendación.
const TIPO_POR_CAMPO = { photo_face_url: 'cara', photo_url: 'tarjeta' }
const FLAG_POR_CAMPO = { photo_face_url: 'foto_cambiar_perfil', photo_url: 'foto_cambiar_tarjeta' }

export default function SubidaFotoJugador({
  playerId, campo, url, titulo, recomendacion, ejemplo, onSubido,
  flagged = false,
  colors = { card: '#fff', border: '#e8eaed', text: '#202124', muted: '#5f6368', accent: '#1a73e8', accentBg: '#e8f0fe' },
}) {
  const [subiendo, setSubiendo] = useState(false)
  const [error, setError] = useState('')

  async function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    setSubiendo(true); setError('')
    try {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
      const tipo = TIPO_POR_CAMPO[campo] || 'foto'
      const path = `fotos/${playerId}_${tipo}.${ext}`
      const { error: errUp } = await supabase.storage.from('players').upload(path, file, { upsert: true })
      if (errUp) throw errUp
      const { data: urlData } = supabase.storage.from('players').getPublicUrl(path)
      const nuevaUrl = `${urlData.publicUrl}?v=${Date.now()}`
      // Al subir, si el admin la había marcado para cambiar, el aviso se limpia solo.
      const campoFlag = FLAG_POR_CAMPO[campo]
      const updateObj = campoFlag ? { [campo]: nuevaUrl, [campoFlag]: false } : { [campo]: nuevaUrl }
      const { error: errDb } = await supabase.from('players').update(updateObj).eq('id', playerId)
      if (errDb) throw errDb
      onSubido?.(nuevaUrl)
    } catch (err) {
      setError('No se pudo subir la foto. Intenta de nuevo.')
    }
    setSubiendo(false)
  }

  const c = colors

  if (url && !flagged) {
    return (
      <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: '12px', padding: '14px', display: 'flex', gap: '12px', alignItems: 'center' }}>
        <img src={url} style={{ width: '54px', height: '54px', borderRadius: '10px', objectFit: 'cover', objectPosition: 'top', flexShrink: 0, border: `1px solid ${c.border}` }}/>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '.82rem', fontWeight: '700', color: c.text }}>✓ {titulo}</div>
          <div style={{ fontSize: '.7rem', color: c.muted, marginTop: '2px' }}>
            Ya la subiste — no se puede cambiar sola. Si crees que está mal, pide que te la borren para poder subir otra.
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ background: flagged ? '#fce8e6' : c.card, border: `1px solid ${flagged ? '#fad2cf' : c.border}`, borderRadius: '12px', padding: '14px' }}>
      {flagged && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
          {url && <img src={url} style={{ width: '38px', height: '38px', borderRadius: '8px', objectFit: 'cover', objectPosition: 'top', flexShrink: 0, opacity: .6 }}/>}
          <div style={{ fontSize: '.76rem', color: '#d93025', fontWeight: '700', lineHeight: 1.35 }}>
            ⚠️ Debes subir de nuevo tu {titulo.toLowerCase()} — la que subiste no sirvió.
          </div>
        </div>
      )}
      <div style={{ fontSize: '.82rem', fontWeight: '700', color: c.text, marginBottom: '4px' }}>{titulo}</div>
      <div style={{ fontSize: '.72rem', color: c.muted, marginBottom: '10px', lineHeight: 1.4 }}>{recomendacion}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
        {ejemplo}
        <div style={{ fontSize: '.66rem', color: c.muted, lineHeight: 1.5 }}>
          {flagged
            ? '⚠️ Si la nueva foto tampoco cumple, el administrador puede volver a marcarla.'
            : '⚠️ Solo puedes subirla una vez. Si no cumple con lo recomendado, el administrador puede pedirte que la cambies.'}
        </div>
      </div>
      <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '9px', background: subiendo ? '#f1f3f4' : c.accentBg, border: `1px solid ${c.accent}`, borderRadius: '8px', cursor: subiendo ? 'default' : 'pointer', color: c.accent, fontSize: '.78rem', fontWeight: '700' }}>
        {subiendo ? 'Subiendo...' : '+ Subir foto'}
        <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} disabled={subiendo}/>
      </label>
      {error && <div style={{ fontSize: '.7rem', color: '#d93025', marginTop: '6px', textAlign: 'center' }}>{error}</div>}
    </div>
  )
}

// Ilustración simple: guía de encuadre "del pecho para arriba" (foto de perfil).
export function EjemploFotoPerfil({ size = 64 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" style={{ flexShrink: 0, borderRadius: '10px', border: '1.5px solid #1e8e3e', background: '#f1f8f4' }}>
      <circle cx="32" cy="22" r="11" fill="#c7ddc9"/>
      <path d="M14 58 C14 42 20 36 32 36 C44 36 50 42 50 58 Z" fill="#c7ddc9"/>
      <text x="32" y="12" textAnchor="middle" fontSize="9" fill="#1e8e3e" fontWeight="700">✓</text>
    </svg>
  )
}

// Ilustración simple: guía de encuadre "de las rodillas para arriba, con uniforme" (foto de tarjeta).
export function EjemploFotoTarjeta({ size = 64 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" style={{ flexShrink: 0, borderRadius: '10px', border: '1.5px solid #1e8e3e', background: '#f1f8f4' }}>
      <circle cx="32" cy="12" r="7" fill="#a9c6e0"/>
      <path d="M20 24 L44 24 L47 58 L38 58 L36 40 L28 40 L26 58 L17 58 Z" fill="#1a73e8"/>
      <text x="32" y="34" textAnchor="middle" fontSize="7" fill="#fff" fontWeight="700">10</text>
      <text x="32" y="8" textAnchor="middle" fontSize="6" fill="#1e8e3e" fontWeight="700">✓</text>
    </svg>
  )
}
