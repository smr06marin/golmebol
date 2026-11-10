import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { comprimirImagen } from '../lib/imageCompress'

// Cada jugador puede subir y CAMBIAR sus fotos cuando quiera (perfil y tarjeta).
// Si algún día hace falta que una foto quede fija una vez subida (por ejemplo en el portal de escuelas),
// se usa bloqueada={true}: entonces solo un admin/coordinador puede volver a habilitarla borrándola.
const TIPO_POR_CAMPO = { photo_face_url: 'cara', photo_url: 'tarjeta' }
const FLAG_POR_CAMPO = { photo_face_url: 'foto_cambiar_perfil', photo_url: 'foto_cambiar_tarjeta' }

// Oscuro, igual que el resto de los paneles de Golmebol
const COLORES_OSCURO = { card: '#161616', border: '#2a2a2a', text: '#ffffff', muted: '#a8a8a8', accent: '#6fcf3d', accentBg: 'rgba(111,207,61,.13)' }

export default function SubidaFotoJugador({
  playerId, campo, url, titulo, recomendacion, ejemplo, onSubido,
  flagged = false,
  bloqueada = false,
  colors = COLORES_OSCURO,
}) {
  const [subiendo, setSubiendo] = useState(false)
  const [error, setError] = useState('')
  const [listo, setListo] = useState(false)

  async function handleFile(e) {
    const file = e.target.files[0]
    e.target.value = '' // permite volver a elegir la misma foto
    if (!file) return
    setSubiendo(true); setError(''); setListo(false)
    try {
      const archivo = await comprimirImagen(file)
      const ext = (archivo.name.split('.').pop() || 'jpg').toLowerCase()
      const tipo = TIPO_POR_CAMPO[campo] || 'foto'
      const path = `fotos/${playerId}_${tipo}.${ext}`
      const { error: errUp } = await supabase.storage.from('players').upload(path, archivo, { upsert: true })
      if (errUp) throw errUp
      const { data: urlData } = supabase.storage.from('players').getPublicUrl(path)
      const nuevaUrl = `${urlData.publicUrl}?v=${Date.now()}`
      // Al subir, si el admin la había marcado para cambiar, el aviso se limpia solo.
      const campoFlag = FLAG_POR_CAMPO[campo]
      const updateObj = campoFlag ? { [campo]: nuevaUrl, [campoFlag]: false } : { [campo]: nuevaUrl }
      const { error: errDb } = await supabase.from('players').update(updateObj).eq('id', playerId)
      if (errDb) throw errDb
      onSubido?.(nuevaUrl)
      setListo(true)
      setTimeout(() => setListo(false), 3500)
    } catch (err) {
      setError('No se pudo subir la foto. Revisa tu internet e intenta de nuevo.')
    }
    setSubiendo(false)
  }

  const c = colors
  const caja = { background: c.card, border: `1px solid ${c.border}`, borderRadius: '16px', padding: '14px' }
  const miniatura = url
    ? <img src={url} alt="" style={{ width: '64px', height: '64px', borderRadius: '14px', objectFit: 'cover', objectPosition: 'top', flexShrink: 0, border: `1px solid ${c.border}` }}/>
    : ejemplo

  // Foto fija (solo cuando se pide bloqueada): se muestra y se explica cómo pedir el cambio
  if (url && !flagged && bloqueada) {
    return (
      <div style={{ ...caja, display: 'flex', gap: '12px', alignItems: 'center' }}>
        {miniatura}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '1rem', fontWeight: 800, color: c.text }}>✓ {titulo}</div>
          <div style={{ fontSize: '.85rem', color: c.muted, marginTop: '3px', lineHeight: 1.4 }}>
            Ya la subiste. Si quieres cambiarla, pide que te la borren para poder subir otra.
          </div>
        </div>
      </div>
    )
  }

  const textoBoton = subiendo ? 'Subiendo…' : (url && !flagged ? 'Cambiar foto' : 'Subir foto')

  return (
    <div style={{ ...caja, ...(flagged ? { background: 'rgba(229,67,61,.1)', border: '1px solid rgba(229,67,61,.45)' } : {}) }}>
      {flagged && (
        <div style={{ fontSize: '.9rem', color: '#ff8a80', fontWeight: 700, lineHeight: 1.4, marginBottom: '12px' }}>
          Sube de nuevo tu {titulo.toLowerCase()}: la anterior no sirvió.
        </div>
      )}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '12px' }}>
        {miniatura}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '1rem', fontWeight: 800, color: c.text }}>{titulo}</div>
          <div style={{ fontSize: '.85rem', color: c.muted, marginTop: '3px', lineHeight: 1.4 }}>{recomendacion}</div>
        </div>
      </div>
      <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', minHeight: '50px', background: subiendo ? c.border : c.accent, color: subiendo ? c.muted : '#07110a', borderRadius: '12px', cursor: subiendo ? 'default' : 'pointer', fontWeight: 800, fontSize: '1rem' }}>
        {textoBoton}
        <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} disabled={subiendo}/>
      </label>
      {listo && <div style={{ fontSize: '.9rem', color: c.accent, marginTop: '10px', textAlign: 'center', fontWeight: 700 }}>✓ Foto guardada</div>}
      {error && <div style={{ fontSize: '.88rem', color: '#ff8a80', marginTop: '10px', textAlign: 'center' }}>{error}</div>}
    </div>
  )
}

// Ilustración simple: guía de encuadre "del pecho para arriba" (foto de perfil).
export function EjemploFotoPerfil({ size = 64 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" style={{ flexShrink: 0, borderRadius: '14px', border: '1.5px solid #1e8e3e', background: '#f1f8f4' }}>
      <circle cx="32" cy="22" r="11" fill="#c7ddc9"/>
      <path d="M14 58 C14 42 20 36 32 36 C44 36 50 42 50 58 Z" fill="#c7ddc9"/>
      <text x="32" y="12" textAnchor="middle" fontSize="9" fill="#1e8e3e" fontWeight="700">✓</text>
    </svg>
  )
}

// Ilustración simple: guía de encuadre "de las rodillas para arriba, con uniforme" (foto de tarjeta).
export function EjemploFotoTarjeta({ size = 64 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" style={{ flexShrink: 0, borderRadius: '14px', border: '1.5px solid #1e8e3e', background: '#f1f8f4' }}>
      <circle cx="32" cy="12" r="7" fill="#a9c6e0"/>
      <path d="M20 24 L44 24 L47 58 L38 58 L36 40 L28 40 L26 58 L17 58 Z" fill="#1a73e8"/>
      <text x="32" y="34" textAnchor="middle" fontSize="7" fill="#fff" fontWeight="700">10</text>
      <text x="32" y="8" textAnchor="middle" fontSize="6" fill="#1e8e3e" fontWeight="700">✓</text>
    </svg>
  )
}
