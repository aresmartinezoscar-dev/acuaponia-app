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

    case 'ppm':
      if (valor <= config.umbralPpmMin) {
        alert = {
          tipo,
          mensaje: `⚠️ PPM muy bajo (${valor})`,
          valor,
          severity: 'danger'
        };
      } else if (valor >= config.umbralPpmMax) {
        alert = {
          tipo,
          mensaje: `⚠️ PPM alto (${valor})`,
          valor,
          severity: 'warning'
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

// Mostrar alerta en la UI
export function showAlert(alert) {
  activeAlert = alert;
  
  const banner = document.getElementById('alert-banner');
  if (!banner) return;

  banner.textContent = alert.mensaje;
  banner.className = `alert-banner ${alert.severity}`;
  banner.classList.remove('hidden');

  // Vibrar
  vibrate();

  // Reproducir sonido
  playAlertSound();

  console.log('🚨 Alerta activada:', alert.mensaje);
}

// Ocultar alerta
export function hideAlert() {
  activeAlert = null;
  
  const banner = document.getElementById('alert-banner');
  if (!banner) return;

  banner.classList.add('hidden');
  console.log('✅ Alerta desactivada');
}

// Verificar si la alerta actual debe ocultarse
export function checkAlertResolution(tipo, valor, config) {
  if (!activeAlert || activeAlert.tipo !== tipo) return;

  let shouldHide = false;

  switch (tipo) {
    case 'ph':
      shouldHide = valor > config.umbralPhMin && valor < config.umbralPhMax;
      break;
    case 'ppm':
      shouldHide = valor > config.umbralPpmMin && valor < config.umbralPpmMax;
      break;
    case 'nivel':
      shouldHide = valor > config.minNivel && valor < config.maxNivel;
      break;
    case 'temp':
      shouldHide = valor > 15 && valor < 35;
      break;
  }

  if (shouldHide) {
    hideAlert();
  }
}

// Obtener alerta activa
export function getActiveAlert() {
  return activeAlert;
}