const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const cors = require('cors')({ origin: true });

// La clave se guarda como secreto de Firebase, nunca en el código
// ni en el navegador. Se define al desplegar (ver README).
const GOOGLE_MAPS_API_KEY = defineSecret('GOOGLE_MAPS_API_KEY');

exports.ruta = onRequest(
  { secrets: [GOOGLE_MAPS_API_KEY], region: 'europe-west1' },
  (req, res) => {
    cors(req, res, async () => {
      const origin = req.query.origin || (req.body && req.body.origin);
      const destination = req.query.destination || (req.body && req.body.destination);

      if (!origin || !destination) {
        res.status(400).json({ ok: false, error: 'Falta origin o destination' });
        return;
      }

      try {
        const key = GOOGLE_MAPS_API_KEY.value();
        const url = 'https://maps.googleapis.com/maps/api/directions/json' +
          '?origin=' + encodeURIComponent(origin) +
          '&destination=' + encodeURIComponent(destination) +
          '&mode=transit&language=es&key=' + key;

        const respuesta = await fetch(url);
        const datos = await respuesta.json();

        if (datos.status !== 'OK' || !datos.routes || !datos.routes.length) {
          res.status(200).json({ ok: false, motivo: datos.status || 'SIN_RUTA' });
          return;
        }

        const tramo = datos.routes[0].legs[0];
        const pasosTransporte = tramo.steps.filter((p) => p.travel_mode === 'TRANSIT');
        const transbordos = Math.max(0, pasosTransporte.length - 1);

        res.status(200).json({
          ok: true,
          duracionMin: Math.round(tramo.duration.value / 60),
          distanciaKm: Math.round(tramo.distance.value / 1000),
          transbordos,
          resumen: tramo.duration.text
        });
      } catch (err) {
        res.status(500).json({ ok: false, error: 'Error calculando la ruta' });
      }
    });
  }
);
