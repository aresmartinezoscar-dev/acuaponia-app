import { initDB } from './db.js';
import { initUI } from './ui.js';
import { initFirebase } from './firebase-sync.js';

// Inicializar aplicación
// Inicializar aplicación
async function init() {
    console.log('🚀 Iniciando aplicación de Acuaponía...');

    // ===== PRIMERO: PEDIR PERMISOS ANTES DE NADA =====
    const permissionsGranted = await requestAllPermissionsFirst();
    
    if (!permissionsGranted) {
        console.warn('⚠️ Algunos permisos no fueron concedidos');
    }

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

        // 6. Iniciar sistema de alarmas
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
// Solicitar todos los permisos ANTES de inicializar la app
async function requestAllPermissionsFirst() {
    console.log('🔐 Solicitando permisos necesarios...');
    
    let allGranted = true;

    // ========== 1. NOTIFICACIONES (CRÍTICO) ==========
    if ('Notification' in window) {
        console.log('📱 Estado actual de notificaciones:', Notification.permission);
        
        if (Notification.permission === 'default') {
            // Mostrar diálogo explicativo ANTES de pedir permiso
            const userWantsPermissions = confirm(
                '🐟 Acuaponía necesita permisos de notificación\n\n' +
                '✅ Para enviarte alarmas de alimentación\n' +
                '✅ Para alertas de parámetros fuera de rango\n' +
                '✅ Para recordatorios importantes\n\n' +
                '¿Permitir notificaciones?'
            );
            
            if (!userWantsPermissions) {
                alert('⚠️ Sin notificaciones, las alarmas NO funcionarán.\n\nPuedes activarlas después en Ajustes del navegador.');
                allGranted = false;
            } else {
                // Pedir permiso
                const permission = await Notification.requestPermission();
                
                if (permission === 'granted') {
                    console.log('✅ Permiso de notificaciones CONCEDIDO');
                    
                    // Mostrar notificación de bienvenida
                    try {
                        new Notification('🐟 ¡Bienvenido a Acuaponía!', {
                            body: 'Las notificaciones están activas. Las alarmas funcionarán correctamente.',
                            icon: '/acuaponia-app/public/assets/icon-192.png',
                            badge: '/acuaponia-app/public/assets/icon-192.png',
                            tag: 'welcome',
                            requireInteraction: false
                        });
                    } catch (e) {
                        console.warn('No se pudo mostrar notificación de prueba:', e);
                    }
                } else if (permission === 'denied') {
                    console.error('❌ Permiso de notificaciones DENEGADO');
                    allGranted = false;
                    
                    alert(
                        '❌ Has bloqueado las notificaciones\n\n' +
                        'Para activar las alarmas:\n' +
                        '1. Abre el menú del navegador (⋮)\n' +
                        '2. Ve a "Configuración del sitio" o "Información"\n' +
                        '3. Busca "Notificaciones"\n' +
                        '4. Cambia a "Permitir"\n' +
                        '5. Recarga la página'
                    );
                } else {
                    console.warn('⚠️ Permiso de notificaciones no concedido');
                    allGranted = false;
                }
            }
        } else if (Notification.permission === 'granted') {
            console.log('✅ Notificaciones ya permitidas');
        } else if (Notification.permission === 'denied') {
            console.error('❌ Notificaciones bloqueadas previamente');
            allGranted = false;
            
            // Mostrar banner persistente
            showPermissionsBanner();
        }
    } else {
        console.error('❌ Este navegador no soporta notificaciones');
        alert('⚠️ Tu navegador no soporta notificaciones.\n\nUsa Chrome, Firefox, Edge o Safari actualizado.');
        allGranted = false;
    }

    // ========== 2. ALMACENAMIENTO PERSISTENTE ==========
    if (navigator.storage && navigator.storage.persist) {
        const isPersisted = await navigator.storage.persisted();
        
        if (!isPersisted) {
            const granted = await navigator.storage.persist();
            if (granted) {
                console.log('✅ Almacenamiento persistente concedido');
            } else {
                console.warn('⚠️ Almacenamiento NO persistente');
            }
        } else {
            console.log('✅ Almacenamiento ya es persistente');
        }
    }

    // ========== 3. VERIFICAR SI ES PWA INSTALADA ==========
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches 
                      || window.navigator.standalone 
                      || document.referrer.includes('android-app://');
    
    if (!isStandalone) {
        console.warn('⚠️ La app NO está instalada como PWA');
        // Mostrar después de 3 segundos
        setTimeout(showInstallBanner, 3000);
    } else {
        console.log('✅ App instalada como PWA');
    }

    return allGranted;
}

// Mostrar banner para dar permisos manualmente
function showPermissionsBanner() {
    const banner = document.createElement('div');
    banner.id = 'permissions-banner';
    banner.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        background: linear-gradient(135deg, #ef4444, #dc2626);
        color: white;
        padding: 16px;
        text-align: center;
        z-index: 9999;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        font-size: 14px;
        line-height: 1.6;
        animation: slideDown 0.3s ease;
    `;
    
    banner.innerHTML = `
        <strong>⚠️ NOTIFICACIONES BLOQUEADAS</strong><br>
        Las alarmas NO funcionarán sin notificaciones.<br>
        <button onclick="showPermissionsInstructions()" style="
            margin-top: 8px;
            padding: 8px 20px;
            background: white;
            color: #ef4444;
            border: none;
            border-radius: 8px;
            font-weight: 600;
            cursor: pointer;
            font-size: 14px;
        ">¿Cómo activar?</button>
        <button onclick="this.parentElement.remove()" style="
            margin-top: 8px;
            margin-left: 8px;
            padding: 8px 20px;
            background: rgba(255,255,255,0.2);
            color: white;
            border: 1px solid white;
            border-radius: 8px;
            font-weight: 600;
            cursor: pointer;
            font-size: 14px;
        ">Cerrar</button>
    `;
    
    document.body.appendChild(banner);
}

// Mostrar instrucciones para activar permisos
window.showPermissionsInstructions = function() {
    const isAndroid = /Android/i.test(navigator.userAgent);
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    
    let instructions = '📱 CÓMO ACTIVAR NOTIFICACIONES:\n\n';
    
    if (isAndroid) {
        instructions += 
            '🤖 ANDROID (Chrome/Edge):\n' +
            '1. Toca el candado 🔒 en la barra de dirección\n' +
            '2. Toca "Permisos"\n' +
            '3. Busca "Notificaciones"\n' +
            '4. Cambia a "Permitir"\n' +
            '5. Recarga la página';
    } else if (isIOS) {
        instructions += 
            '🍎 iOS (Safari):\n' +
            '1. Ve a Ajustes del iPhone\n' +
            '2. Busca "Safari"\n' +
            '3. Toca "Ajustes de sitios web"\n' +
            '4. Toca "Notificaciones"\n' +
            '5. Permite este sitio\n' +
            '6. Vuelve a la app y recarga';
    } else {
        instructions += 
            '🖥️ ESCRITORIO:\n' +
            '1. Haz clic en el candado 🔒 (barra de dirección)\n' +
            '2. Busca "Notificaciones"\n' +
            '3. Cambia a "Permitir"\n' +
            '4. Recarga la página';
    }
    
    alert(instructions);
};

// Mostrar banner de instalación PWA
function showInstallBanner() {
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
        z-index: 9998;
        box-shadow: 0 -4px 12px rgba(0,0,0,0.2);
        font-size: 14px;
        line-height: 1.6;
        animation: slideUp 0.3s ease;
    `;
    
    banner.innerHTML = `
        <strong>📱 INSTALA LA APP</strong><br>
        Para mejores alarmas, instala en tu pantalla de inicio<br>
        <button onclick="showInstallInstructions()" style="
            margin-top: 8px;
            padding: 8px 20px;
            background: white;
            color: #06b6d4;
            border: none;
            border-radius: 8px;
            font-weight: 600;
            cursor: pointer;
            font-size: 14px;
        ">¿Cómo instalar?</button>
        <button onclick="this.parentElement.remove()" style="
            margin-top: 8px;
            margin-left: 8px;
            padding: 8px 20px;
            background: rgba(255,255,255,0.2);
            color: white;
            border: 1px solid white;
            border-radius: 8px;
            font-weight: 600;
            cursor: pointer;
            font-size: 14px;
        ">Más tarde</button>
    `;
    
    document.body.appendChild(banner);
    
    // Auto-ocultar después de 15 segundos
    setTimeout(() => {
        if (banner.parentElement) {
            banner.remove();
        }
    }, 15000);
}

// Mostrar instrucciones de instalación
window.showInstallInstructions = function() {
    const isAndroid = /Android/i.test(navigator.userAgent);
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    
    let instructions = '📱 CÓMO INSTALAR LA APP:\n\n';
    
    if (isAndroid) {
        instructions += 
            '🤖 ANDROID:\n' +
            '1. Abre el menú del navegador (⋮)\n' +
            '2. Toca "Instalar aplicación" o "Añadir a inicio"\n' +
            '3. Confirma la instalación\n' +
            '4. La app aparecerá en tu pantalla de inicio';
    } else if (isIOS) {
        instructions += 
            '🍎 iOS (Safari):\n' +
            '1. Toca el botón Compartir (□↑)\n' +
            '2. Desplázate y toca "Añadir a la pantalla de inicio"\n' +
            '3. Toca "Añadir"\n' +
            '4. La app aparecerá en tu pantalla de inicio';
    } else {
        instructions += 
            '🖥️ ESCRITORIO:\n' +
            '1. Busca el icono ➕ en la barra de dirección\n' +
            '2. O abre el menú (⋮) → "Instalar"\n' +
            '3. Confirma la instalación';
    }
    
    alert(instructions);
};

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







