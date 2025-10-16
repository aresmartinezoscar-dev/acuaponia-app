import { getConfig } from './repo.js';
import { vibrate, playAlertSound } from './util.js';

let wakeLock = null;

// Solicitar mantener pantalla activa
async function requestWakeLock() {
  try {
    if ('wakeLock' in navigator) {
      wakeLock = await navigator.wakeLock.request('screen');
      console.log('🔆 Wake Lock activado - pantalla permanecerá activa');
      
      wakeLock.addEventListener('release', () => {
        console.log('💤 Wake Lock liberado');
      });
      
      return true;
    }
  } catch (err) {
    console.warn('⚠️ No se pudo activar Wake Lock:', err);
  }
  return false;
}

// Liberar Wake Lock
function releaseWakeLock() {
  if (wakeLock !== null) {
    wakeLock.release().then(() => {
      wakeLock = null;
    });
  }
}

let alarmIntervals = [];

// Inicializar sistema de alarmas
export async function initAlarmSystem() {
  console.log('⏰ Iniciando sistema de alarmas...');
  
  // Limpiar alarmas anteriores
  alarmIntervals.forEach(interval => clearInterval(interval));
  alarmIntervals = [];

  const config = await getConfig();
  
  if (!config.alarmasComida) return;

  // Verificar si hay alarmas activas
  const hasActiveAlarms = config.alarmasComida.some(a => a.activa);
  
  if (hasActiveAlarms) {
    // Solicitar Wake Lock para mantener activo
    await requestWakeLock();
    
    // Re-activar Wake Lock si se pierde
    document.addEventListener('visibilitychange', async () => {
      if (wakeLock !== null && document.visibilityState === 'visible') {
        await requestWakeLock();
      }
    });
  }

  // Notificar al Service Worker
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: 'UPDATE_ALARMS'
    });
    console.log('📤 Alarmas enviadas al Service Worker');
  }

  // Verificar cada minuto (más agresivo para alarmas)
  const checkInterval = setInterval(() => {
    checkAlarms(config);
  }, 30000); // Cada 30 segundos para mayor precisión

  alarmIntervals.push(checkInterval);

  // Verificar inmediatamente
  checkAlarms(config);
  
  console.log('✅ Sistema de alarmas activo');
}

// Verificar si alguna alarma debe sonar
async function checkAlarms(config) {
  const ahora = new Date();
  const horaActual = `${ahora.getHours()}:${String(ahora.getMinutes()).padStart(2, '0')}`;

  config.alarmasComida.forEach((alarma, index) => {
    if (!alarma.activa) return;

    // Convertir hora de alarma a formato 24h
    const [hora, periodo] = alarma.hora.split(' ');
    const [h, m] = hora.split(':');
    let hora24 = parseInt(h);
    if (periodo === 'PM' && hora24 !== 12) hora24 += 12;
    if (periodo === 'AM' && hora24 === 12) hora24 = 0;
    
    const horaAlarma = `${hora24}:${m}`;

    if (horaActual === horaAlarma) {
      triggerAlarm(index + 1);
    }
  });
}

// Activar alarma
function triggerAlarm(numero) {
  console.log(`🔔 Alarma ${numero} activada!`);

  // Vibrar
  vibrate([200, 100, 200, 100, 200, 100, 200]);

  // Sonido personalizado
  playCustomAlarmSound();

  // Notificación
  if ('Notification' in window && Notification.permission === 'granted') {
    const notification = new Notification('🐟 Hora de alimentar', {
      body: `Alarma ${numero}: Es hora de alimentar a los peces`,
      icon: '/acuaponia-app/public/assets/icon-192.png',
      badge: '/acuaponia-app/public/assets/icon-192.png',
      vibrate: [200, 100, 200],
      tag: `alarma-${numero}`,
      requireInteraction: true, // No desaparece automáticamente
      actions: [
        { action: 'fed', title: '✅ Ya alimenté' },
        { action: 'snooze', title: '⏰ Recordar en 5 min' }
      ]
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  }

  // Alerta visual
  showAlarmBanner(numero);
}

// Escuchar mensajes del Service Worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'PLAY_ALARM_SOUND') {
      playAlertSound();
      vibrate([300, 100, 300, 100, 300]);
    }
  });
}

// Mostrar banner de alarma
function showAlarmBanner(numero) {
  let banner = document.getElementById('alarm-banner');
  
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'alarm-banner';
    banner.style.cssText = `
      position: fixed;
      top: 50px;
      left: 0;
      right: 0;
      background: linear-gradient(135deg, #f59e0b, #ef4444);
      color: white;
      padding: 20px;
      text-align: center;
      font-weight: 700;
      font-size: 18px;
      z-index: 2000;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      animation: pulse 1s infinite;
    `;
    document.body.appendChild(banner);

    // Añadir animación CSS
    if (!document.getElementById('alarm-animation')) {
      const style = document.createElement('style');
      style.id = 'alarm-animation';
      style.textContent = `
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.02); }
        }
      `;
      document.head.appendChild(style);
    }
  }

  banner.innerHTML = `
    🔔 ALARMA ${numero}: ¡Hora de alimentar a los peces! 🐟
    <button onclick="document.getElementById('alarm-banner').remove()" 
            style="margin-left: 20px; padding: 8px 16px; background: white; 
                   color: #ef4444; border: none; border-radius: 8px; 
                   font-weight: 600; cursor: pointer;">
      ✓ Entendido
    </button>
  `;
}

// Re-inicializar cuando cambie la config
export async function restartAlarmSystem() {
  await initAlarmSystem();
}

// Reproducir sonido personalizado de alarma
function playCustomAlarmSound() {
  try {
    const audio = new Audio('/acuaponia-app/public/src/assets/alarm.mp3');
    audio.volume = 1.0; // Volumen máximo
    audio.loop = false; // No repetir
    audio.play().catch(error => {
      console.warn('⚠️ No se pudo reproducir el sonido:', error);
      // Fallback al sonido por defecto
      playAlertSound();
    });
  } catch (error) {
    console.warn('⚠️ Error al cargar audio personalizado:', error);
    playAlertSound();
  }
}
