import { vibrate, playAlertSound } from './util.js';

let activeAlert = null;

// Verificar si un valor está fuera de rango
export function checkThreshold(tipo, valor, config) {
  let alert = null;

  switch (tipo) {
    case 'ph':
      if (valor <= config.umbralPhMin) {
        alert = {
          tipo,
          mensaje: `⚠️ pH muy bajo (${valor})`,
          valor,
          severity: 'danger'
        };
      } else if (valor >= config.umbralPhMax) {
        alert = {
          tipo,
          mensaje: `⚠️ pH alto (${valor})`,
          valor,
          severity: 'warning'
        };
      }
      break;

    case 'conductividad':
      if (valor <= config.umbralCondMin) {
        alert = {
          tipo,
          mensaje: `⚠️ Conductividad muy baja (${valor} S/m)`,
          valor,
          severity: 'danger'
        };
      } else if (valor >= config.umbralCondMax) {
        alert = {
          tipo,
          mensaje: `⚠️ Conductividad alta (${valor} S/m)`,
          valor,
          severity: 'warning'
        };
      }
      break;

    case 'amonio':
      if (valor >= config.umbralAmonioMax) {
        alert = {
          tipo,
          mensaje: `⚠️ Amonio alto (${valor} mg/L)`,
          valor,
          severity: 'danger'
        };
      } else if (valor >= config.umbralAmonioMax * 0.8) {
        alert = {
          tipo,
          mensaje: `⚠️ Amonio elevado (${valor} mg/L)`,
          valor,
          severity: 'warning'
        };
      }
      break;

    case 'nitrito':
      if (valor >= config.umbralNitritoMax) {
        alert = {
          tipo,
          mensaje: `⚠️ Nitrito alto (${valor} mg/L)`,
          valor,
          severity: 'danger'
        };
      } else if (valor >= config.umbralNitritoMax * 0.8) {
        alert = {
          tipo,
          mensaje: `⚠️ Nitrito elevado (${valor} mg/L)`,
          valor,
          severity: 'warning'
        };
      }
      break;

    case 'nitrato':
      if (valor <= config.umbralNitratoMin) {
        alert = {
          tipo,
          mensaje: `⚠️ Nitrato muy bajo (${valor} mg/L)`,
          valor,
          severity: 'warning'
        };
      } else if (valor >= config.umbralNitratoMax) {
        alert = {
          tipo,
          mensaje: `⚠️ Nitrato alto (${valor} mg/L)`,
          valor,
          severity: 'danger'
        };
      }
      break;

    case 'nivel':
      if (valor <= config.minNivel) {
        alert = {
          tipo,
          mensaje: `⚠️ Nivel de agua bajo (${valor} cm)`,
          valor,
          severity: 'danger'
        };
      } else if (valor >= config.maxNivel) {
        alert = {
          tipo,
          mensaje: `⚠️ Nivel de agua alto (${valor} cm)`,
          valor,
          severity: 'warning'
        };
      }
      break;

    case 'temp':
      // Opcional: agregar alertas de temperatura
      if (valor <= 15) {
        alert = {
          tipo,
          mensaje: `⚠️ Temperatura baja (${valor}°C)`,
          valor,
          severity: 'warning'
        };
      } else if (valor >= 35) {
        alert = {
          tipo,
          mensaje: `⚠️ Temperatura alta (${valor}°C)`,
          valor,
          severity: 'warning'
        };
      }
      break;
  }

  return alert;
}

// Mostrar alerta en el banner
export function showAlert(alert) {
  const banner = document.getElementById('alert-banner');
  
  if (!banner) return;

  banner.textContent = alert.mensaje;
  banner.className = `alert-banner ${alert.severity}`;
  banner.classList.remove('hidden');

  // Guardar alerta activa
  activeAlert = alert;

  // Vibrar y reproducir sonido si es peligroso
  if (alert.severity === 'danger') {
    vibrate([100, 50, 100, 50, 100]);
    playAlertSound();
  }

  // Scroll al banner
  banner.scrollIntoView({ behavior: 'smooth', block: 'start' });

  console.log('⚠️ Alerta mostrada:', alert.mensaje);
}

// Ocultar alerta
export function hideAlert() {
  const banner = document.getElementById('alert-banner');
  
  if (!banner) return;

  banner.classList.add('hidden');
  activeAlert = null;

  console.log('✅ Alerta ocultada');
}

// Verificar si una alerta se ha resuelto
export function checkAlertResolution(tipo, valor, config) {
  if (!activeAlert || activeAlert.tipo !== tipo) {
    return;
  }

  // Verificar si el nuevo valor está dentro del rango
  let isResolved = false;

  switch (tipo) {
    case 'ph':
      isResolved = valor > config.umbralPhMin && valor < config.umbralPhMax;
      break;

    case 'conductividad':
      isResolved = valor > config.umbralCondMin && valor < config.umbralCondMax;
      break;

    case 'amonio':
      isResolved = valor < config.umbralAmonioMax * 0.8;
      break;

    case 'nitrito':
      isResolved = valor < config.umbralNitritoMax * 0.8;
      break;

    case 'nitrato':
      isResolved = valor > config.umbralNitratoMin && valor < config.umbralNitratoMax;
      break;

    case 'nivel':
      isResolved = valor > config.minNivel && valor < config.maxNivel;
      break;

    case 'temp':
      isResolved = valor > 15 && valor < 35;
      break;
  }

  if (isResolved) {
    hideAlert();
    console.log('✅ Alerta resuelta para', tipo);
  }
}

// Obtener alerta activa
export function getActiveAlert() {
  return activeAlert;
}