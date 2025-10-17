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
                const registration = await navigator.serviceWorker.register('/acuaponia-app/public/service-worker.js');
                console.log('✅ Service Worker registrado:', registration);
            } catch (error) {
                console.warn('⚠️ Error al registrar Service Worker:', error);
            }
        }

        // 5. Detectar estado de conexión
        setupConnectionListeners();

        // 6. Solicitar permisos de notificación
        // 6. Solicitar TODOS los permisos necesarios para alarmas
        await requestAllPermissions();
        
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

// Solicitar todos los permisos necesarios
async function requestAllPermissions() {
    console.log('🔐 Solicitando permisos...');
    
    let allGranted = true;

    // 1. PERMISOS DE NOTIFICACIÓN (CRÍTICO)
    if ('Notification' in window) {
        if (Notification.permission === 'default') {
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                console.log('✅ Permiso de notificaciones concedido');
                // Notificación de prueba
                new Notification('🐟 Acuaponía', {
                    body: 'Notificaciones activadas correctamente',
                    icon: '/acuaponia-app/public/assets/icon-192.png',
                    tag: 'welcome',
                    requireInteraction: false
                });
            } else {
                console.error('❌ Permiso de notificaciones DENEGADO');
                allGranted = false;
                alert('⚠️ IMPORTANTE: Debes permitir las notificaciones para que funcionen las alarmas.\n\nVe a Configuración del navegador → Permisos → Notificaciones');
            }
        } else if (Notification.permission === 'granted') {
            console.log('✅ Permisos de notificación ya concedidos');
        } else {
            console.error('❌ Notificaciones bloqueadas');
            allGranted = false;
            alert('⚠️ Las notificaciones están bloqueadas.\n\nPara activar alarmas:\n1. Configuración del navegador\n2. Permisos del sitio\n3. Activar Notificaciones');
        }
    }

    // 2. WAKE LOCK (mantener pantalla activa - opcional pero útil)
    if ('wakeLock' in navigator) {
        try {
            const wakeLock = await navigator.wakeLock.request('screen');
            console.log('✅ Wake Lock disponible');
            wakeLock.release(); // Solo verificamos que funciona
        } catch (err) {
            console.warn('⚠️ Wake Lock no disponible:', err.message);
        }
    }

    // 3. PERSISTENCIA DE DATOS (para que no se borren los datos)
    if (navigator.storage && navigator.storage.persist) {
        const isPersisted = await navigator.storage.persist();
        if (isPersisted) {
            console.log('✅ Almacenamiento persistente activado');
        } else {
            console.warn('⚠️ Almacenamiento NO persistente - los datos pueden borrarse');
        }
    }

    // 4. VERIFICAR SI ESTÁ INSTALADA COMO PWA
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches 
                      || window.navigator.standalone 
                      || document.referrer.includes('android-app://');
    
    if (!isStandalone) {
        console.warn('⚠️ La app NO está instalada como PWA');
        // Mostrar mensaje para instalar
        showInstallPrompt();
    } else {
        console.log('✅ App instalada como PWA');
    }

    return allGranted;
}

// Mostrar prompt de instalación
function showInstallPrompt() {
    const banner = document.createElement('div');
    banner.id = 'install-banner';
    banner.style.cssText = `
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        background: linear-gradient(135deg, #06b6d4, #3b82f6);
        color: white;
        padding: 16px;
        text-align: center;
        z-index: 2000;
        box-shadow: 0 -4px 12px rgba(0,0,0,0.2);
        font-size: 14px;
        line-height: 1.5;
    `;
    
    banner.innerHTML = `
        <strong>📱 Para que las alarmas funcionen correctamente:</strong><br>
        Instala esta app en tu pantalla de inicio<br>
        <button onclick="this.parentElement.remove()" style="
            margin-top: 8px;
            padding: 8px 20px;
            background: white;
            color: #06b6d4;
            border: none;
            border-radius: 8px;
            font-weight: 600;
            cursor: pointer;
        ">Entendido</button>
    `;
    
    document.body.appendChild(banner);
    
    // Auto-ocultar después de 10 segundos
    setTimeout(() => {
        if (banner.parentElement) {
            banner.remove();
        }
    }, 10000);
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






