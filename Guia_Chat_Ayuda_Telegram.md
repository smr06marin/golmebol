# Chat de ayuda con Telegram — guía de puesta en marcha

**Cómo funciona:** el organizador escribe en el botón "Ayuda" del admin → el mensaje te llega a **Telegram** desde
el bot "Soporte Golmebol" → tú lo respondes en Telegram → la respuesta aparece en su chat. Todo el historial queda
en su chat (y guardado en Supabase). Es gratis, no necesita un número extra ni aprobación de nadie.

## 1. Supabase
Ya está hecho si corriste `migracion_chat_soporte.sql` (el chat ya guardó tu mensaje de prueba). Si no, pégalo completo en Supabase → SQL Editor → RUN.
Y recuerda que `SUPABASE_SERVICE_ROLE_KEY` ya quedó puesta en Vercel.

## 2. Crear el bot (2 minutos, desde tu celular)
1. En Telegram busca **@BotFather** (el que tiene la palomita azul de verificado) y escríbele `/newbot`.
2. Te pide un **nombre**: pon `Soporte Golmebol`.
3. Te pide un **usuario** que termine en `bot`, por ejemplo `golmebol_soporte_bot` (si está ocupado, prueba otro).
4. BotFather te da un **token** parecido a `123456789:ABCdef...`. Es como la contraseña del bot: **no lo compartas ni lo pegues en el código**. Solo va en Vercel.

## 3. Vercel → Settings → Environment Variables (SIN prefijo VITE_)
| Variable | Valor |
|---|---|
| `TELEGRAM_BOT_TOKEN` | el token del paso 2 |
| `TELEGRAM_WEBHOOK_SECRET` | un texto largo que te inventes, solo letras, números, `_` y `-` (ej: `golmebol_ayuda_9fK3xQ7mP2`) |

Guarda y haz **Redeploy**.

## 4. Conectar el bot con la web (una sola vez)
Abre en el navegador de tu computador esta dirección, cambiando `TU_TOKEN` y `TU_SECRETO` por los tuyos:

`https://api.telegram.org/botTU_TOKEN/setWebhook?url=https://golmebol.com/api/telegram-webhook&secret_token=TU_SECRETO`

(después de `bot` va el token pegado, sin espacios). Si todo va bien responde algo como `{"ok":true,"result":true,"description":"Webhook was set"}`.

## 5. Decirle al bot quién eres
1. Abre tu bot en Telegram (el link que te dio BotFather) y escríbele cualquier cosa, por ejemplo `hola`.
2. El bot te responde con **tu número de chat** (algo como `123456789`).
3. Ponlo en Vercel como `TELEGRAM_CHAT_ID` y haz **Redeploy** otra vez.
A partir de ahí el bot solo hace caso a TU chat: si otra persona le escribe, lo ignora.

## 6. Primera prueba
1. En Vercel pon `VITE_CHAT_AYUDA` = `admin` y redespliega (así el botón "Ayuda" solo lo ves tú).
2. Abre el admin, toca **Ayuda** y escribe algo.
3. Te llega a Telegram con el número del chat (#12), el correo y la pantalla donde estaba.
4. **Respóndele con "Responder"** (en iPhone desliza el mensaje hacia la izquierda; en Android mantén presionado → Responder). Aparece en su chat al instante.
5. Cuando todo funcione, cambia `VITE_CHAT_AYUDA` a `todos` y redespliega: lo ven todos los usuarios del admin.

## Cómo responder
- Con **temas** activados (recomendado, ver abajo): escribe dentro del tema de esa persona. Le llega SOLO a ella.
- Sin temas: **Responder** sobre su mensaje, o empieza tu mensaje con su número: `#12 hola, ya te ayudo`.
- Si no haces nada de eso, el bot **no envía** tu mensaje y te avisa: ya no se adivina "al último que escribió" (eso mandaba respuestas a quien no era cuando escribían varias personas a la vez).

## Un tema por conversación (para que no se mezclen)
Cada persona que escribe queda en su propio "tema" (como un chat aparte) dentro de un grupo de Telegram, con su número y su nombre, por ejemplo `#14 Laura · 🌐 Público`.
1. En Supabase corre `migracion_telegram_temas.sql` (SQL Editor → pegar → RUN).
2. En Telegram crea un **grupo nuevo** (puede ser solo contigo y el bot). Agrega el bot al grupo.
3. En el grupo: Editar → activa **Temas** (Topics).
4. Haz al bot **administrador** del grupo con el permiso **Administrar temas** (Manage topics).
5. Escribe `/start` en el grupo. Para saber el número del grupo: quita un momento `TELEGRAM_CHAT_ID` en Vercel, redespliega y escribe `hola` en el grupo; el bot responde con el número (empieza por `-100…`).
6. En Vercel: `TELEGRAM_CHAT_ID` = ese número del grupo y `TELEGRAM_TEMAS` = `1`. Haz **Redeploy**.
7. Listo: cada conversación nueva crea su tema. Las conversaciones viejas crean su tema la próxima vez que esa persona escriba.
- Azul = visitantes de las páginas públicas · Amarillo = usuarios del panel (organizadores).
- Si borras un tema, se crea uno nuevo cuando esa persona vuelva a escribir.
- El resumen de pendientes de la mañana y `/pendientes` salen en el tema General. `/chat` dentro de un tema muestra esa conversación.
- Todos los que estén en el grupo pueden contestar: sirve para que otra persona de tu equipo te ayude a atender.

## Límites de esta primera versión
- Solo texto (sin fotos ni audios). Si le mandas una foto al bot, te avisa.
- Un chat por usuario del admin. No hay chat para visitantes sin cuenta.
- 8 mensajes por minuto y 60 por hora por usuario (freno contra spam).
- Si Telegram falla, el mensaje igual queda guardado en el chat.
- Cualquiera puede encontrar el bot por su usuario, pero solo tu chat puede contestar por él.

## Si más adelante consigues un número para WhatsApp
Está listo el código para usar WhatsApp en su lugar: ver `Guia_Chat_Ayuda_WhatsApp.md`. Si las variables de Telegram están puestas, se usa Telegram; si las quitas, usa WhatsApp.
