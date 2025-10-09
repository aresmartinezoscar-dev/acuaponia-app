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