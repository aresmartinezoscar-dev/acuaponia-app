const CACHE_NAME = 'acuaponia-v1.0.2';
const BASE_PATH = '/acuaponia-app/public/';
const urlsToCache = [
  BASE_PATH,
  BASE_PATH + 'index.html',
  BASE_PATH + 'src/css/styles.css',
  BASE_PATH + 'src/js/main.js',
  BASE_PATH + 'src/js/config.js',
  BASE_PATH + 'src/js/db.js',
  BASE_PATH + 'src/js/repo.js',
  BASE_PATH + 'src/js/firebase-sync.js',
  BASE_PATH + 'src/js/charts.js',
  BASE_PATH + 'src/js/alerts.js',
  BASE_PATH + 'src/js/ui.js',
  BASE_PATH + 'src/js/util.js',
  BASE_PATH + 'assets/icon-192.png',
  BASE_PATH + 'assets/icon-512.png',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js',
  'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js',
  'https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js'
];

// ====== CONFIGURACIÓN DE ALARMAS PERSISTENTES ======
const ALARM_CHECK_INTERVAL = 60000; // Verificar cada minuto
let alarmCheckTimer = null;

// Iniciar verificación de alarmas cuando se activa el SW
self.addEventListener('activate', (event) => {
  console.log('🔔 Service Worker activado - Iniciando sistema de alarmas');
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      startAlarmSystem()
    ])
  );
});

// Sistema de alarmas persistente
async function startAlarmSystem() {
  console.log('⏰ Iniciando sistema de alarmas persistente...');
  
  // Cancelar timer anterior si existe
  if (alarmCheckTimer) {
    clearInterval(alarmCheckTimer);
  }
  
  // Verificar alarmas inmediatamente
  await checkAllAlarms();
  
  // Verificar cada minuto
  alarmCheckTimer = setInterval(async () => {
    await checkAllAlarms();
  }, ALARM_CHECK_INTERVAL);
  
  console.log('✅ Sistema de alarmas activo en Service Worker');
}

// Verificar todas las alarmas configuradas
async function checkAllAlarms() {
  try {
    const config = await getConfigFromDB();
    
    if (!config || !config.alarmasComida) {
      return;
    }

    const ahora = new Date();
    const horaActual = ahora.getHours();
    const minutoActual = ahora.getMinutes();
    
    config.alarmasComida.forEach((alarma, index) => {
      if (!alarma.activa) return;

      const [hora, periodo] = alarma.hora.split(' ');
      const [h, m] = hora.split(':');
      let hora24 = parseInt(h);
      
      if (periodo === 'PM' && hora24 !== 12) hora24 += 12;
      if (periodo === 'AM' && hora24 === 12) hora24 = 0;
      
      // Verificar si es la hora exacta
      if (horaActual === hora24 && minutoActual === parseInt(m)) {
        console.log(`🔔 ALARMA ${index + 1} ACTIVADA!`);
        triggerAlarmNotification(index + 1, alarma.hora);
      }
    });
  } catch (error) {
    console.error('❌ Error verificando alarmas:', error);
  }
}

// Disparar notificación de alarma (más agresiva)
async function triggerAlarmNotification(numero, hora) {
  console.log(`🚨 Disparando alarma ${numero} a las ${hora}`);
  
  const notificationOptions = {
    body: `🐟 ¡Es hora de alimentar a los peces! (${hora})`,
    icon: '/acuaponia-app/public/assets/icon-192.png',
    badge: '/acuaponia-app/public/assets/icon-192.png',
    vibrate: [500, 250, 500, 250, 500, 250, 500, 250, 500],
    tag: `alarma-${numero}-${Date.now()}`,
    requireInteraction: true,
    silent: false,
    renotify: true,
    sticky: true,
    actions: [
      { action: 'fed', title: '✅ Ya alimenté' },
      { action: 'snooze', title: '⏰ 5 min más' }
    ],
    data: {
      numero: numero,
      hora: hora,
      timestamp: Date.now()
    }
  };

  try {
    // Mostrar notificación principal
    await self.registration.showNotification(
      '🔔 ALARMA DE ALIMENTACIÓN',
      notificationOptions
    );
    
    // Intentar reproducir sonido en clientes abiertos
    const clients = await self.clients.matchAll({ includeUncontrolled: true });
    clients.forEach(client => {
      client.postMessage({
        type: 'ALARM_TRIGGERED',
        numero: numero,
        hora: hora
      });
    });
    
    // Re-notificar cada 30 segundos durante 3 minutos
    for (let i = 1; i <= 6; i++) {
      setTimeout(async () => {
        await self.registration.showNotification(
          `🔔 ALARMA ${numero} - RECORDATORIO ${i}`,
          {
            ...notificationOptions,
            body: `🐟 RECORDATORIO: Alimentar a los peces (${hora})`,
            tag: `alarma-${numero}-reminder-${i}-${Date.now()}`
          }
        );
      }, i * 30000);
    }
    
  } catch (error) {
    console.error('❌ Error mostrando notificación:', error);
  }
}

// Instalación
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('✅ Cache abierto');
        return cache.addAll(urlsToCache).catch(err => {
          console.warn('⚠️ Error al cachear algunos recursos:', err);
        });
      })
  );
  self.skipWaiting();
});

// Activación
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('🗑️ Eliminando cache antiguo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch (con filtro para evitar chrome-extension)
self.addEventListener('fetch', event => {
  // Ignorar peticiones que no sean http/https
  if (!event.request.url.startsWith('http')) {
    return;
  }

  // Ignorar extensiones de Chrome
  if (event.request.url.startsWith('chrome-extension://')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Si la respuesta es válida, cachearla
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache).catch(err => {
              console.warn('⚠️ No se pudo cachear:', event.request.url);
            });
          });
        }
        return response;
      })
      .catch(() => {
        // Si falla, usar cache
        return caches.match(event.request).then(cachedResponse => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // Si no hay en cache, retornar error básico
          return new Response('Offline - Contenido no disponible', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: new Headers({
              'Content-Type': 'text/plain'
            })
          });
        });
      })
  );

});

// ====== SISTEMA DE ALARMAS EN SEGUNDO PLANO ======

// Programar alarmas cuando se activa el service worker
self.addEventListener('activate', (event) => {
  console.log('🔔 Service Worker activado - Programando alarmas');
  event.waitUntil(scheduleAllAlarms());
});

// Escuchar mensajes desde la app principal
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'UPDATE_ALARMS') {
    console.log('📲 Actualizando alarmas desde la app');
    scheduleAllAlarms();
  }
});

// Programar todas las alarmas
async function scheduleAllAlarms() {
  try {
    // Cancelar alarmas anteriores
    const registrations = await self.registration.getNotifications();
    registrations.forEach(notification => notification.close());

    // Leer configuración desde IndexedDB
    const config = await getConfigFromDB();
    
    if (!config || !config.alarmasComida) {
      console.log('⚠️ No hay alarmas configuradas');
      return;
    }

    // Programar cada alarma activa
    config.alarmasComida.forEach((alarma, index) => {
      if (alarma.activa) {
        scheduleAlarm(alarma, index + 1);
      }
    });

    console.log('✅ Alarmas programadas correctamente');
  } catch (error) {
    console.error('❌ Error al programar alarmas:', error);
  }
}

// Programar una alarma específica
function scheduleAlarm(alarma, numero) {
  // Convertir hora de alarma a milisegundos
  const [hora, periodo] = alarma.hora.split(' ');
  const [h, m] = hora.split(':');
  let hora24 = parseInt(h);
  
  if (periodo === 'PM' && hora24 !== 12) hora24 += 12;
  if (periodo === 'AM' && hora24 === 12) hora24 = 0;

  const ahora = new Date();
  let alarmaTime = new Date();
  alarmaTime.setHours(hora24, parseInt(m), 0, 0);

  // Si la hora ya pasó hoy, programar para mañana
  if (alarmaTime <= ahora) {
    alarmaTime.setDate(alarmaTime.getDate() + 1);
  }

  const delay = alarmaTime.getTime() - ahora.getTime();

  // Programar con setTimeout (para alarmas del mismo día)
  if (delay < 24 * 60 * 60 * 1000) {
    setTimeout(() => {
      showAlarmNotification(numero, alarma.hora);
      // Re-programar para el día siguiente
      scheduleAlarm(alarma, numero);
    }, delay);
  }

  console.log(`⏰ Alarma ${numero} programada para ${alarma.hora} (en ${Math.round(delay / 60000)} minutos)`);
}

// Mostrar notificación de alarma
async function showAlarmNotification(numero, hora) {
  const options = {
    body: `🐟 Es hora de alimentar a los peces (${hora})`,
    icon: '/acuaponia-app/public/assets/icon-192.png',
    badge: '/acuaponia-app/public/assets/icon-192.png',
    vibrate: [500, 200, 500, 200, 500, 200, 500, 200, 500], // Vibración más larga
    tag: `alarma-comida-${numero}-${Date.now()}`, // Tag único para evitar que se reemplace
    requireInteraction: true,
    silent: false,
    renotify: true, // Re-notificar si ya existe
    sticky: true, // Intenta mantenerla visible
    actions: [
      {
        action: 'fed',
        title: '✅ Ya alimenté',
        icon: '/acuaponia-app/public/assets/icon-192.png'
      },
      {
        action: 'snooze',
        title: '⏰ Recordar en 5 min',
        icon: '/acuaponia-app/public/assets/icon-192.png'
      }
    ],
    data: {
      numero: numero,
      hora: hora,
      timestamp: Date.now(),
      url: '/acuaponia-app/public/index.html'
    }
  };

  try {
    await self.registration.showNotification('🔔 ALARMA DE ALIMENTACIÓN', options);
    console.log(`🔔 Notificación de alarma ${numero} mostrada`);
    
    // Reproducir sonido
    playNotificationSound();
    
    // Re-notificar cada 30 segundos durante 2 minutos si no se responde
    let renotifyCount = 0;
    const renotifyInterval = setInterval(async () => {
      renotifyCount++;
      if (renotifyCount > 4) { // Máximo 4 veces (2 minutos)
        clearInterval(renotifyInterval);
        return;
      }
      
      // Volver a mostrar notificación
      await self.registration.showNotification('🔔 ALARMA DE ALIMENTACIÓN', {
        ...options,
        tag: `alarma-comida-${numero}-${Date.now()}`,
        body: `🐟 RECORDATORIO ${renotifyCount}: Es hora de alimentar (${hora})`
      });
      
      console.log(`🔔 Re-notificación ${renotifyCount} de alarma ${numero}`);
    }, 30000);
    
  } catch (error) {
    console.error('❌ Error al mostrar notificación:', error);
  }
}

// Manejar clics en las notificaciones
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'fed') {
    console.log('✅ Usuario confirmó alimentación');
    // Aquí podrías registrar automáticamente la alimentación
    event.waitUntil(
      clients.openWindow('/acuaponia-app/public/index.html')
    );
  } else if (event.action === 'snooze') {
    console.log('⏰ Postponer alarma 5 minutos');
    setTimeout(() => {
      showAlarmNotification(event.notification.data.numero, event.notification.data.hora);
    }, 5 * 60 * 1000); // 5 minutos
  } else {
    // Clic en la notificación (no en botones)
    event.waitUntil(
      clients.openWindow('/acuaponia-app/public/index.html')
    );
  }
});

// Leer configuración desde IndexedDB
function getConfigFromDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('acuaponia_db', 1);

    request.onerror = () => reject(request.error);

    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['config'], 'readonly');
      const store = transaction.objectStore('config');
      const getRequest = store.get('singleton');

      getRequest.onsuccess = () => resolve(getRequest.result);
      getRequest.onerror = () => reject(getRequest.error);
    };
  });
}

// Reproducir sonido de notificación (experimental)
function playNotificationSound() {
  // El Service Worker tiene limitaciones de audio
  // Esta función es más efectiva cuando la app está abierta
  try {
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      clients.forEach(client => {
        client.postMessage({ type: 'PLAY_ALARM_SOUND' });
      });
    });
  } catch (error) {
    console.warn('⚠️ No se pudo reproducir sonido:', error);
  }
}

// Verificación periódica de alarmas (backup)
setInterval(() => {
  checkAlarmsNow();
}, 60000); // Cada minuto

async function checkAlarmsNow() {
  const config = await getConfigFromDB();
  if (!config || !config.alarmasComida) return;

  const ahora = new Date();
  const horaActual = `${ahora.getHours()}:${String(ahora.getMinutes()).padStart(2, '0')}`;

  config.alarmasComida.forEach((alarma, index) => {
    if (!alarma.activa) return;

    const [hora, periodo] = alarma.hora.split(' ');
    const [h, m] = hora.split(':');
    let hora24 = parseInt(h);
    
    if (periodo === 'PM' && hora24 !== 12) hora24 += 12;
    if (periodo === 'AM' && hora24 === 12) hora24 = 0;
    
    const horaAlarma = `${hora24}:${m}`;

    if (horaActual === horaAlarma) {
      showAlarmNotification(index + 1, alarma.hora);
    }
  });
}

// ====== BACKGROUND SYNC PARA ALARMAS ======

// Registrar sincronización en segundo plano
self.addEventListener('sync', (event) => {
  if (event.tag === 'check-alarms') {
    console.log('🔄 Background sync: Verificando alarmas perdidas');
    event.waitUntil(checkMissedAlarms());
  }
});

// Verificar alarmas que pudieron haberse perdido
async function checkMissedAlarms() {
  const config = await getConfigFromDB();
  if (!config || !config.alarmasComida) return;

  const ahora = new Date();
  const hace5Min = new Date(ahora.getTime() - 5 * 60000);

  config.alarmasComida.forEach((alarma, index) => {
    if (!alarma.activa) return;

    const [hora, periodo] = alarma.hora.split(' ');
    const [h, m] = hora.split(':');
    let hora24 = parseInt(h);
    
    if (periodo === 'PM' && hora24 !== 12) hora24 += 12;
    if (periodo === 'AM' && hora24 === 12) hora24 = 0;

    // Verificar si la alarma debió sonar en los últimos 5 minutos
    const alarmaTime = new Date();
    alarmaTime.setHours(hora24, parseInt(m), 0, 0);

    if (alarmaTime >= hace5Min && alarmaTime <= ahora) {
      console.log(`🔔 Alarma ${index + 1} perdida - mostrando ahora`);
      showAlarmNotification(index + 1, alarma.hora);
    }
  });
}





