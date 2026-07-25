# Vía a dos

PWA para comparar destinos de viaje en pareja: precio, régimen (media
pensión / pensión completa) y trayecto en tren, con una puntuación
combinada que pondera lo que más os importe a cada uno.

## Qué hace y qué no

- Tú metes los destinos candidatos a mano (nombre, precio, régimen,
  enlace de reserva). No existe una API pública gratuita de
  Booking/hoteles, así que esta parte siempre es manual.
- El trayecto en transporte público **sí se calcula solo**, llamando a
  la Directions API de Google desde una Cloud Function (así la clave
  nunca viaja al navegador). Si falla o no está desplegada todavía,
  puedes reintentarlo o dejarlo pendiente sin que la app se rompa.
- Los datos se guardan en `localStorage`: solo en el móvil donde la
  abras. Si más adelante queréis usarla los dos a la vez desde
  vuestros teléfonos con los mismos datos, el siguiente paso natural
  es mover `destinos` y `pesos` a Firestore — pero para decidir este
  viaje no hace falta.

## Estructura

```
public/          → la PWA (esto es lo que se sirve como sitio web)
functions/        → la Cloud Function que oculta la clave de Google Maps
firebase.json     → conecta hosting + function bajo /api/ruta
.firebaserc       → aquí va el ID de tu proyecto de Firebase
```

## Puesta en marcha

### 1. Crear el proyecto de Firebase

En https://console.firebase.google.com, crea un proyecto nuevo (o usa
uno que ya tengas). Necesita el plan **Blaze** (pago por uso) porque
las Cloud Functions lo requieren — con el volumen de esta app os vais
a quedar muy por debajo de cualquier tramo de pago.

Sustituye `TU-PROYECTO-FIREBASE` en `.firebaserc` por el ID real de tu
proyecto.

### 2. Activar la Directions API

En Google Cloud Console (el mismo proyecto):
1. Habilita la **Directions API**.
2. Crea una clave de API y restríngela a esa API únicamente (por
   seguridad, aunque aquí solo la va a usar tu función, nunca el
   navegador).

### 3. Instalar herramientas y dependencias

```bash
npm install -g firebase-tools
firebase login
cd functions && npm install
```

### 4. Guardar la clave como secreto

```bash
firebase functions:secrets:set GOOGLE_MAPS_API_KEY
```

Te pedirá pegar el valor de la clave; no hace falta tocar ningún
archivo, Firebase la guarda cifrada.

### 5. Probarlo en local (opcional)

```bash
firebase emulators:start
```

Abre la URL que te indique el emulador de Hosting.

### 6. Desplegar

```bash
firebase deploy
```

Al terminar te da la URL pública (algo como
`https://tu-proyecto.web.app`). Instálatela como app desde el
navegador del móvil (Chrome → "Añadir a pantalla de inicio") para que
funcione como una app normal, con icono y todo.

## Coste esperado

Con un puñado de destinos y unas cuantas veces que reviséis la app,
os vais a mover en unas decenas de llamadas al mes: muy por debajo del
tramo gratuito mensual de la Directions API (10.000 eventos/mes) y del
de Cloud Functions. Es decir, coste cero para este uso.

## Ajustar el diseño

Los colores y tipografías están centralizados como variables CSS al
principio de `public/css/styles.css` — cambia ahí si quieres otra
paleta.
