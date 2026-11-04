# Chat de ayuda con WhatsApp — guía de puesta en marcha (opcional, para más adelante)

> Por ahora el chat funciona con **Telegram** (ver `Guia_Chat_Ayuda_Telegram.md`). Esta guía es para cuando tengas un número aparte para la línea de WhatsApp. Si las variables `TELEGRAM_*` están puestas, se usa Telegram; para pasar a WhatsApp, quítalas.

**Cómo funciona:** el organizador escribe en el botón "Ayuda" del admin → el mensaje te llega a tu WhatsApp
desde la línea de soporte → tú respondes en WhatsApp → la respuesta aparece en su chat. Todo el historial
queda en su chat (y guardado en Supabase).

## 1. Supabase (2 minutos)
Pega completo `migracion_chat_soporte.sql` en Supabase → SQL Editor → RUN.

## 2. Meta (WhatsApp API oficial)
1. Entra a **developers.facebook.com** → *Mis apps* → *Crear app* → tipo **Business** → agrega el producto **WhatsApp**.
2. En **WhatsApp → Configuración de la API** agrega el número de la **línea de soporte**.
   Tiene que ser un número que NO esté usando WhatsApp normal ni WhatsApp Business en un celular
   (si lo está, hay que salir de esa cuenta primero). Verifícalo por SMS o llamada.
   Copia el **Identificador del número de teléfono** (Phone number ID).
3. **Token permanente:** business.facebook.com → *Configuración del negocio* → *Usuarios del sistema* →
   crea uno (rol administrador) → *Asignar activos* (tu app y tu cuenta de WhatsApp) →
   *Generar token* con los permisos `whatsapp_business_messaging` y `whatsapp_business_management`.
   Ese token no vence. Guárdalo.
4. **Clave secreta de la app:** en developers.facebook.com → tu app → *Configuración → Básica* → *Clave secreta de la app*.

## 3. Vercel → Settings → Environment Variables (todas de servidor, SIN prefijo VITE_)
| Variable | Valor |
|---|---|
| `WHATSAPP_TOKEN` | el token permanente del paso 3 |
| `WHATSAPP_PHONE_ID` | el Phone number ID del paso 2 |
| `SOPORTE_WA_DESTINO` | TU WhatsApp personal con código de país, sin + ni espacios (ej: 573001234567) |
| `WHATSAPP_VERIFY_TOKEN` | un texto largo que te inventes |
| `WHATSAPP_APP_SECRET` | la clave secreta del paso 4 |
| `SOPORTE_PLANTILLA` | `soporte_nuevo_mensaje` (después del paso 5) |

`SUPABASE_SERVICE_ROLE_KEY` ya la tienes (la usan las notificaciones). Después de agregar variables, **vuelve a desplegar** en Vercel.

## 4. Webhook (para que tus respuestas lleguen al chat)
En Meta → **WhatsApp → Configuración** → *Webhook*:
- **URL de devolución de llamada:** `https://golmebol.com/api/whatsapp-webhook`
- **Token de verificación:** el mismo `WHATSAPP_VERIFY_TOKEN`
- Verifica y guarda, y en *Campos del webhook* activa **messages**.

## 5. Plantilla de aviso (para cuando pasen más de 24 horas)
WhatsApp solo deja escribirte texto libre durante 24 horas después de tu último mensaje a la línea.
Pasado ese tiempo hay que usar una plantilla aprobada. En **WhatsApp Manager → Plantillas de mensajes → Crear**:
- Nombre: `soporte_nuevo_mensaje`  ·  Categoría: **Utilidad**  ·  Idioma: **Español**
- Cuerpo: `Soporte Golmebol: mensaje nuevo de {{1}} ({{2}}): {{3}} — Responde a este mensaje para contestarle.`
- En los ejemplos pon cualquier texto. Meta la aprueba en minutos u horas.

## 6. Primera prueba
1. Desde TU WhatsApp escribe "hola" al número de la línea de soporte (abre la ventana de 24 horas).
2. En el admin, abre el botón **Ayuda** y escribe algo.
3. Te llega a WhatsApp con el número del chat (#12), el correo y la pantalla donde estaba.
4. **Responde a ese mensaje** (mantén presionado → *Responder*). Aparece en el chat del organizador.

## 7. Encender el botón "Ayuda" (interruptor de lanzamiento)
El botón está **apagado por defecto**: no aparece para nadie hasta que tú lo enciendas.
En Vercel → Environment Variables crea `VITE_CHAT_AYUDA` y **vuelve a desplegar**:
- `admin` → solo lo ven los administradores (úsalo para probar con WhatsApp real).
- `todos` → lo ven todos los usuarios del admin (cuando ya funcione al 100%).
- vacío o borrada → apagado.
(Es la única variable de este chat que SÍ lleva `VITE_`, porque solo decide si se muestra el botón; no guarda ninguna clave.)

## Cómo responder
- Lo normal: mantén presionado el mensaje del organizador → **Responder**.
- O empieza tu mensaje con su número: `#12 hola, ya te ayudo`.
- Si no haces ninguna de las dos, va al último organizador que escribió y no tiene respuesta.
- Solo se aceptan respuestas desde TU número (`SOPORTE_WA_DESTINO`).

## Límites de esta primera versión
- Solo texto (sin fotos ni archivos). Si le mandas una foto por WhatsApp, el sistema te avisa.
- Un chat por usuario del admin. No hay chat para visitantes sin cuenta.
- 8 mensajes por minuto y 60 por hora por usuario (freno contra spam).
- Si WhatsApp falla, el mensaje igual queda guardado en el chat.
- Meta puede cobrar por las plantillas fuera de la ventana de 24 horas; revisa las tarifas vigentes en WhatsApp Manager.
