import { initDB } from './db.js';
import { initUI } from './ui.js';
import { initFirebase } from './firebase-sync.js';

// Inicializar aplicación
async function init() {
    console.log('🚀 Iniciando aplicación de Acuaponía...');

    try {
        // 1. Inicializar IndexedDB
        await initDB();
        console.log('✅ Base de datos local inicializada');

        // 2. Inicializar Firebase
        initFirebase();

        // 3. Inicializar UI
        await initUI();
        console.log('✅ Interfaz de usuario cargada');

        // 4. Registrar Service Worker
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.register('/service-worker.js');
                console.log('✅ Service Worker registrado:', registration);
            } catch (error) {
                console.warn('⚠️ Error al registrar Service Worker:', error);
            }
        }

        // 5. Detectar estado de conexión
        setupConnectionListeners();

        // 6. Solicitar permisos de notificación
        if ('Notification' in window) {
            if (Notification.permission === 'default') {
                const permission = await Notification.requestPermission();
                if (permission === 'granted') {
                    console.log('✅ Permisos de notificación concedidos');
                    // Mostrar notificación de prueba
                    new Notification('🐟 Acuaponía', {
                        body: 'Las alarmas están configuradas correctamente',
                        icon: '/acuaponia-app/public/assets/icon-192.png',
                        tag: 'welcome'
                    });
                }
            } else if (Notification.permission === 'granted') {
                console.log('✅ Permisos de notificación ya concedidos');
            } else {
                console.warn('⚠️ Permisos de notificación denegados');
            }
        }

        // 7. Iniciar sistema de alarmas
        const { initAlarmSystem } = await import('./alarms.js');
        initAlarmSystem();


        console.log('✅ Aplicación lista');
    } catch (error) {
        console.error('❌ Error al inicializar la aplicación:', error);
        alert('Error al iniciar la aplicación. Por favor recarga la página.');
    }
}

// Configurar listeners de conexión
function setupConnectionListeners() {
    window.addEventListener('online', () => {
        console.log('🌐 Conexión restaurada');
        showConnectionStatus('Conexión restaurada', 'success');
    });

    window.addEventListener('offline', () => {
        console.log('📵 Sin conexión');
        showConnectionStatus('Sin conexión - Modo offline', 'warning');
    });
}


// Mostrar estado de conexión
function showConnectionStatus(message, type) {
    let statusBar = document.getElementById('connection-status');

    if (!statusBar) {
        statusBar = document.createElement('div');
        statusBar.id = 'connection-status';
        statusBar.className = 'connection-status';
        document.body.appendChild(statusBar);
    }

    statusBar.textContent = message;
    statusBar.className = `connection-status ${type}`;
    statusBar.classList.add('show');

    setTimeout(() => {
        statusBar.classList.remove('show');
    }, 3000);
}

// Iniciar cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();

}

// ====== SCROLL AUTOMÁTICO AL ENFOCAR INPUTS ======

function setupInputScrollBehavior() {
    // Seleccionar todos los inputs y textareas
    const inputs = document.querySelectorAll('input, textarea');
    
    inputs.forEach(input => {
        input.addEventListener('focus', (e) => {
            // Esperar un poco para que el teclado aparezca
            setTimeout(() => {
                // Calcular la posición del input
                const inputRect = e.target.getBoundingClientRect();
                const viewportHeight = window.innerHeight;
                
                // Si el input está en la mitad inferior de la pantalla
                if (inputRect.top > viewportHeight / 2) {
                    // Scroll suave hacia el input con offset adicional
                    e.target.scrollIntoView({ 
                        behavior: 'smooth', 
                        block: 'center',
                        inline: 'nearest'
                    });
                }
            }, 300); // 300ms para dar tiempo al teclado a aparecer
        });
    });
}

// Llamar la función al cargar
setupInputScrollBehavior();

// Re-aplicar cuando cambien de vista
const observer = new MutationObserver(() => {
    setupInputScrollBehavior();
});

observer.observe(document.body, {
    childList: true,
    subtree: true
});




