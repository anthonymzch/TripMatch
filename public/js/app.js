// --- Estado y persistencia (compartida en Firestore entre los dos usuarios) ---

const CRITERIOS = [
  { key: 'precio', label: 'Precio' },
  { key: 'trayecto', label: 'Comodidad del trayecto' },
  { key: 'regimen', label: 'Régimen' },
  { key: 'ganas', label: 'Ganas / ambiente' }
];

const PESOS_POR_DEFECTO = { precio: 3, trayecto: 3, regimen: 3, ganas: 3 };

let pesos = { ...PESOS_POR_DEFECTO };
let destinos = [];

const docViaje = db.collection('viaje').doc('compartido');
let escribiendo = false;

function guardar() {
  escribiendo = true;
  docViaje.set({ pesos, destinos }).finally(() => { escribiendo = false; });
}

function suscribirViaje() {
  docViaje.onSnapshot((snap) => {
    if (!snap.exists) {
      docViaje.set({ pesos: PESOS_POR_DEFECTO, destinos: [] });
      return;
    }
    // Ignora el eco de nuestra propia escritura para no pisar el estado
    // local (por ejemplo destino.calculando) mientras se guarda.
    if (escribiendo) return;
    const datos = snap.data();
    pesos = datos.pesos || { ...PESOS_POR_DEFECTO };
    destinos = datos.destinos || [];
    render();
  });
}

// --- Cálculo de ruta real, vía la Cloud Function ---
// Si la función no responde (todavía no está desplegada, sin cobertura,
// sin conexión...) el destino queda con duracionMin = null y se puede
// editar a mano desde la tarjeta.

async function calcularRuta(destino) {
  const origen = document.getElementById('in-origen').value.trim();
  if (!origen || !destino.ciudad) return;

  destino.calculando = true;
  render();

  try {
    const url = '/api/ruta?origin=' + encodeURIComponent(origen) + '&destination=' + encodeURIComponent(destino.ciudad);
    const resp = await fetch(url);
    const data = await resp.json();
    if (data.ok) {
      destino.duracionMin = data.duracionMin;
      destino.transbordos = data.transbordos;
    } else {
      destino.duracionMin = null;
      destino.transbordos = null;
    }
  } catch (e) {
    destino.duracionMin = null;
    destino.transbordos = null;
  }

  destino.calculando = false;
  guardar();
  render();
}

// --- Pesos ---

function renderPesos() {
  const el = document.getElementById('pesos');
  el.innerHTML = CRITERIOS.map((c) => `
    <div class="peso-row">
      <label>${c.label}</label>
      <input type="range" min="0" max="5" step="1" value="${pesos[c.key]}"
        oninput="pesos['${c.key}'] = parseInt(this.value); document.getElementById('out-${c.key}').textContent = this.value; guardar(); render();">
      <span id="out-${c.key}">${pesos[c.key]}</span>
    </div>`).join('');
}

// --- Puntuación ---

function regimenLabel(v) {
  return v == 1 ? 'Solo desayuno' : v == 2 ? 'Media pensión' : 'Pensión completa';
}

function calcularPuntuaciones() {
  if (destinos.length === 0) return [];

  const precios = destinos.map((d) => d.precio);
  const minP = Math.min(...precios), maxP = Math.max(...precios);

  const conDuracion = destinos.filter((d) => typeof d.duracionMin === 'number');
  const minD = conDuracion.length ? Math.min(...conDuracion.map((d) => d.duracionMin)) : 0;
  const maxD = conDuracion.length ? Math.max(...conDuracion.map((d) => d.duracionMin)) : 0;
  const maxT = conDuracion.length ? Math.max(...conDuracion.map((d) => d.transbordos || 0)) : 0;

  const sumaPesos = pesos.precio + pesos.trayecto + pesos.regimen + pesos.ganas;

  return destinos.map((d) => {
    const precioNorm = maxP === minP ? 1 : (maxP - d.precio) / (maxP - minP);
    const regimenNorm = d.regimen / 3;
    const ganasNorm = d.ganas / 5;

    let trayectoNorm = 0.5; // sin datos todavía: no penaliza ni favorece
    if (typeof d.duracionMin === 'number') {
      const durNorm = maxD === minD ? 1 : (maxD - d.duracionMin) / (maxD - minD);
      const transNorm = maxT === 0 ? 1 : 1 - (d.transbordos || 0) / maxT;
      trayectoNorm = (durNorm + transNorm) / 2;
    }

    const total = sumaPesos === 0 ? 0 :
      (pesos.precio * precioNorm + pesos.trayecto * trayectoNorm + pesos.regimen * regimenNorm + pesos.ganas * ganasNorm) / sumaPesos;

    return { ...d, score: Math.round(total * 100) };
  }).sort((a, b) => b.score - a.score);
}

// --- Render de la lista ---

function mapsLink(d) {
  const origen = document.getElementById('in-origen').value.trim();
  return 'https://www.google.com/maps/dir/?api=1&origin=' + encodeURIComponent(origen) +
    '&destination=' + encodeURIComponent(d.ciudad) + '&travelmode=transit';
}

function filaTrayecto(d) {
  if (d.calculando) {
    return `<div class="trayecto-fila pendiente">Calculando trayecto…</div>`;
  }
  if (typeof d.duracionMin === 'number') {
    const transb = d.transbordos > 0 ? `${d.transbordos} transbordo${d.transbordos > 1 ? 's' : ''}` : 'directo';
    return `<div class="trayecto-fila">${d.duracionMin} min en tren · ${transb}</div>`;
  }
  return `<div class="trayecto-fila pendiente">
    Sin calcular ·
    <a href="#" onclick="event.preventDefault(); calcularRuta(destinos.find(x=>x.id===${d.id}))" style="color:var(--accent)">reintentar</a>
  </div>`;
}

function render() {
  renderPesos();
  const ranked = calcularPuntuaciones();
  const el = document.getElementById('lista');

  if (ranked.length === 0) {
    el.innerHTML = `<p class="vacio">Añade vuestros primeros destinos candidatos arriba.</p>`;
    return;
  }

  el.innerHTML = ranked.map((d, i) => `
    <div class="tarjeta ${i === 0 ? 'top' : ''}">
      ${i === 0 ? '<span class="badge">Mejor opción</span><br>' : ''}
      <div class="tarjeta-cabecera">
        <div>
          <p class="tarjeta-nombre">${d.nombre}</p>
          <p class="tarjeta-ciudad">${d.ciudad}</p>
        </div>
        <div class="puntuacion">${d.score}<small>/100</small></div>
      </div>
      <p class="tarjeta-meta">${d.precio} € total · ${d.noches} noches · ${regimenLabel(d.regimen)}</p>
      ${filaTrayecto(d)}
      <div class="tarjeta-acciones">
        <a href="${mapsLink(d)}" target="_blank">Ver ruta en Maps</a>
        ${d.enlace ? `<a href="${d.enlace}" target="_blank">Reserva</a>` : ''}
        <button class="btn-borrar" onclick="eliminar(${d.id})">Quitar</button>
      </div>
    </div>`).join('');
}

function eliminar(id) {
  destinos = destinos.filter((d) => d.id !== id);
  guardar();
  render();
}

// --- Formulario ---

document.getElementById('in-ganas').oninput = function () {
  document.getElementById('in-ganas-out').textContent = this.value;
};

document.getElementById('in-origen').value = localStorage.getItem('via-a-dos-origen') || '';
document.getElementById('in-origen').addEventListener('change', function () {
  localStorage.setItem('via-a-dos-origen', this.value.trim());
});

document.getElementById('btn-add').onclick = function () {
  const nombre = document.getElementById('in-nombre').value.trim();
  const ciudad = document.getElementById('in-ciudad').value.trim();
  const precio = parseFloat(document.getElementById('in-precio').value);
  if (!nombre || !ciudad || isNaN(precio)) return;

  const destino = {
    id: Date.now(),
    nombre,
    ciudad,
    precio,
    noches: parseInt(document.getElementById('in-noches').value) || 1,
    regimen: parseInt(document.getElementById('in-regimen').value),
    ganas: parseInt(document.getElementById('in-ganas').value),
    enlace: document.getElementById('in-enlace').value.trim(),
    duracionMin: null,
    transbordos: null
  };
  destinos.push(destino);
  guardar();

  document.getElementById('in-nombre').value = '';
  document.getElementById('in-ciudad').value = '';
  document.getElementById('in-precio').value = '';
  document.getElementById('in-enlace').value = '';

  render();
  calcularRuta(destino);
};

// --- Autenticación ---

const loginGate = document.getElementById('login-gate');
const board = document.getElementById('board');
const loginSubtitle = document.getElementById('login-subtitle');

document.getElementById('btn-login').onclick = function () {
  loginSubtitle.textContent = 'Redirigiendo a Google...';
  auth.signInWithRedirect(googleProvider).catch((err) => {
    console.error('signInWithRedirect', err);
    loginSubtitle.textContent = 'Error al redirigir: ' + (err.code || err.message);
  });
};

document.getElementById('btn-logout').onclick = function () {
  auth.signOut();
};

auth.getRedirectResult().catch((err) => {
  console.error('getRedirectResult', err);
  loginSubtitle.textContent = 'No se pudo iniciar sesión (' + (err.code || err.message) + ').';
});

let suscrito = false;

auth.onAuthStateChanged((user) => {
  if (!user) {
    suscrito = false;
    board.hidden = true;
    loginGate.hidden = false;
    return;
  }

  if (!ALLOWED_EMAILS.includes(user.email)) {
    loginSubtitle.textContent = 'Esta cuenta no tiene acceso a esta app.';
    auth.signOut();
    return;
  }

  loginGate.hidden = true;
  board.hidden = false;

  if (!suscrito) {
    suscrito = true;
    suscribirViaje();
  }
});
