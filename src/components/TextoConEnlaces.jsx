// Texto de una burbuja del chat: los enlaces (https://…) se pueden tocar.
const ENLACE = /(https?:\/\/[^\s]+)/g

export default function TextoConEnlaces({ texto }) {
  return (
    <>
      {String(texto || '').split(ENLACE).map((p, i) => (/^https?:\/\//.test(p)
        ? <a key={i} href={p} target="_blank" rel="noreferrer" style={{ color: '#1a73e8', fontWeight: 700, textDecoration: 'underline', wordBreak: 'break-all' }}>{p.replace(/^https?:\/\/(www\.)?/, '')}</a>
        : p))}
    </>
  )
}
