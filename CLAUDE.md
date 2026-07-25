# Vía a dos

PWA estática (sin build step) para comparar destinos de viaje en pareja.
Ver `README.md` para la puesta en marcha completa.

## Estructura

- `public/js/app.js` — toda la lógica de la app (estado, cálculo de
  puntuación, render, Firestore).
- `public/js/firebase-init.js` — config de Firebase y `ALLOWED_EMAILS`
  (allowlist del lado cliente, solo para UX; el control de acceso real
  está en `firestore.rules`).
- `public/css/styles.css` — variables de diseño centralizadas al principio.
- `functions/index.js` — Cloud Function `ruta` (Directions API) tras
  `/api/ruta`.
- `firestore.rules` — control de acceso real a `viaje/compartido` por
  email. Si se añade o cambia una cuenta permitida, hay que actualizar
  **tanto** `ALLOWED_EMAILS` en `firebase-init.js` **como** la lista de
  `firestore.rules` — están duplicadas a propósito (una es UX, la otra
  es seguridad) y deben mantenerse en sync.
- `public/sw.js` — service worker de la PWA. Usa red-primero (con caché
  como respaldo sin conexión) precisamente para que un deploy se note
  al momento en los móviles ya instalados. Si alguna vez se vuelve a
  una estrategia cache-first, hay que subir `CACHE_NAME` en cada
  deploy que toque `index.html`/`app.js`/`firebase-init.js`, o los
  usuarios seguirán viendo código viejo (p.ej. un allowlist de email
  desactualizado) aunque el deploy haya ido bien.

## Flujo de trabajo: commit, push y deploy tras cada orden

Al terminar cada tarea que modifique código de este proyecto:

1. `git add` + `git commit` con mensaje descriptivo.
2. `git push` a la rama en la que se esté trabajando.
3. Desplegar a Firebase (`firebase deploy`, o sección específica con
   `--only hosting` / `--only firestore:rules` / `--only functions`
   cuando el cambio sea acotado).

No lo dejes pendiente ni preguntes si hacerlo — es el comportamiento
esperado por defecto en este repo. Excepción: si el cambio es solo
documentación/planificación sin efecto en la app, el deploy no aporta
nada, así que basta con commit + push.

### Deploy sin credenciales de Firebase en la sesión

Las sesiones en la nube (Claude Code on the web) no tienen `firebase
login` guardado ni una service account por defecto. Antes de intentar
el deploy, comprueba si hay credenciales disponibles:

```bash
npx firebase-tools projects:list
```

- Si falla con "Failed to authenticate": no hay credenciales en esta
  sesión. No se puede desplegar desde aquí sin que el usuario aporte
  un token o una service account key. Dilo explícitamente en vez de
  darlo por hecho como hecho — no simules ni afirmes un deploy que no
  ocurrió.
- Si el usuario pega un `FIREBASE_TOKEN` (token de `firebase
  login:ci`) o una service account key en el chat: es una credencial
  sensible. Úsala solo en memoria (variable de entorno del comando),
  nunca la escribas en un archivo del repo ni la commitees. Avisa al
  usuario de que rote/revoque esa credencial después de usarla, porque
  quedó expuesta en el historial de la conversación.
- Antes de desplegar `functions`, instala sus dependencias si falta
  `node_modules`: `cd functions && npm install` (está en
  `.gitignore`, no se commitea).

### Alternativa sostenible: GitHub Actions

Si se repiten sesiones sin credenciales de Firebase, la solución
correcta a largo plazo es un workflow de GitHub Actions que despliegue
automáticamente en cada push a la rama principal, usando una service
account de Firebase guardada como secreto del repo. Es un cambio de
infraestructura que requiere que el usuario genere esa clave — no
crear el workflow sin confirmar con el usuario primero.
