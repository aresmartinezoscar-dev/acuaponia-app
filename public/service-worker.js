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
