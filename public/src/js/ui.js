import { getConfig, saveConfig, updateConfig, saveMeasurement, saveComment, getAllMeasurements, getAllComments, getLastMeasurementByType, getLastValues } from './repo.js';
import { checkThreshold, showAlert, hideAlert, checkAlertResolution } from './alerts.js';
import { renderChart, destroyChart } from './charts.js';
import { syncAll, initFirebase } from './firebase-sync.js';
import { generateUUID, formatDateTime, formatDateISO, calculateTrend, getTrendIcon, getTrendColor, getParamName, getParamUnit, exportToCSV } from './util.js';

let currentView = 'home';
let currentParam = 'ph';
let config = null;

// Inicializar UI
export async function initUI() {
  config = await getConfig();

  // Si no hay userCode, mostrar pantalla de primer uso
  if (!config.userCode) {
    showView('first-run');
    setupFirstRunForm();
    return;
  }

  // Si hay userCode, ir al home
  showView('home');
  await loadHomeView();
  setupNavigationHandlers();
  setupMeasurementForms();
  setupSettingsForm();
  setupSyncButton();
  applyTheme();

  // Intentar sincronizar automáticamente al iniciar
  if (navigator.onLine) {
    setTimeout(() => {
      syncAll(config);
    }, 2000);
  }
}

// Mostrar/ocultar vistas
function showView(viewName) {
  const views = document.querySelectorAll('.view');
  views.forEach(view => view.classList.add('hidden'));

  const targetView = document.getElementById(`${viewName}-view`);
  if (targetView) {
    targetView.classList.remove('hidden');
    currentView = viewName;
  }
}

// ====== PRIMER USO ======

function setupFirstRunForm() {
  const form = document.getElementById('first-run-form');
  
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const userCode = document.getElementById('user-code').value.trim();
    const systemName = document.getElementById('system-name').value.trim();

    if (!userCode) {
      alert('Por favor ingresa tu código de usuario');
      return;
    }

    // Generar deviceId único
    const deviceId = generateUUID();

    // Actualizar configuración
    await updateConfig({
      userCode,
      nombreSistema: systemName,
      deviceId
    });

    // Recargar config
    config = await getConfig();

    // Inicializar Firebase y sincronizar
    initFirebase();
    await syncAll(config);

    // Ir al home
    showView('home');
    await loadHomeView();
    setupNavigationHandlers();
    setupMeasurementForms();
    setupSettingsForm();
    setupSyncButton();
    applyTheme();
  });
}

// ====== HOME ======

async function loadHomeView() {
  // Mostrar nombre del sistema
  const systemNameDisplay = document.getElementById('system-name-display');
  if (config.nombreSistema) {
    systemNameDisplay.textContent = config.nombreSistema;
    systemNameDisplay.style.display = 'block';
  } else {
    systemNameDisplay.style.display = 'none';
  }

  // Cargar últimos valores
  await loadLastValues();
}

async function loadLastValues() {
  const lastValues = await getLastValues();
  const container = document.getElementById('last-values-container');
  const grid = document.getElementById('last-values-grid');

  if (Object.keys(lastValues).length === 0) {
    container.classList.add('hidden');
    return;
  }

  container.classList.remove('hidden');
  grid.innerHTML = '';

  for (const [tipo, data] of Object.entries(lastValues)) {
    const card = document.createElement('div');
    card.className = 'value-card';
    
    const unit = getParamUnit(tipo, config);
    const trendIcon = getTrendIcon(data.tendencia);
    const trendColor = getTrendColor(data.tendencia);

    card.innerHTML = `
      <div class="value-header">
        <span class="value-label">${getParamName(tipo)}</span>
        <span class="value-trend" style="color: ${trendColor}">${trendIcon}</span>
      </div>
      <div class="value-number">
        ${data.valor}
        ${unit ? `<span class="value-unit">${unit}</span>` : ''}
      </div>
    `;

    grid.appendChild(card);
  }
}

// ====== NAVEGACIÓN ======

function setupNavigationHandlers() {
  // Botones de navegación
  document.querySelectorAll('[data-view]').forEach(button => {
    button.addEventListener('click', async (e) => {
      const view = e.currentTarget.getAttribute('data-view');
      
      if (view === 'home') {
        showView('home');
        await loadHomeView();
      } else if (view === 'add') {
        showView('add');
      } else if (view === 'history') {
        showView('history');
        await loadHistoryView();
      } else if (view === 'settings') {
        showView('settings');
        loadSettingsView();
      }
    });
  });
}

// ====== AÑADIR MEDICIONES ======

function setupMeasurementForms() {
  const forms = document.querySelectorAll('.measurement-form[data-type]');
  
  forms.forEach(form => {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const tipo = form.getAttribute('data-type');
      const input = form.querySelector('input[type="number"], textarea');
      const valor = parseFloat(input.value);

      if (isNaN(valor) && tipo !== 'comida') {
        alert('Por favor ingresa un valor válido');
        return;
      }

      // Obtener último valor para calcular tendencia
      const lastMeasurement = await getLastMeasurementByType(tipo);
      const tendencia = lastMeasurement ? calculateTrend(valor, lastMeasurement.valor) : 'same';

      // Crear medición
      const measurement = {
        tipo,
        valor,
        unidad: getParamUnit(tipo, config),
        ts: Date.now(),
        tendencia
      };

      // Guardar
      await saveMeasurement(measurement);

      // Verificar alerta
      const alert = checkThreshold(tipo, valor, config);
      if (alert) {
        showAlert(alert);
      } else {
        checkAlertResolution(tipo, valor, config);
      }

      // Limpiar formulario
      input.value = '';

      // Recargar últimos valores
      await loadLastValues();

      // Mostrar confirmación
      showToast('✅ Medición guardada');
    });
  });

  // Formulario de comentarios
  const commentForm = document.getElementById('comment-form');
  commentForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const textarea = commentForm.querySelector('textarea');
    const texto = textarea.value.trim();

    if (!texto) {
      alert('Por favor escribe un comentario');
      return;
    }

    const comment = {
      texto,
      fechaISO: formatDateISO(Date.now()),
      ts: Date.now()
    };

    await saveComment(comment);
    textarea.value = '';
    showToast('✅ Comentario guardado');
  });
}

// ====== HISTÓRICO ======

async function loadHistoryView() {
  // Cargar datos
  const measurements = await getAllMeasurements();
  const comments = await getAllComments();

  // Renderizar gráfica
  renderChart('chart-canvas', measurements, currentParam, config);

  // Renderizar lista de mediciones
  renderMeasurementsList(measurements.filter(m => m.tipo === currentParam));

  // Renderizar comentarios
  renderCommentsList(comments);

  // Setup tabs
  setupHistoryTabs(measurements);
}

function setupHistoryTabs(measurements) {
  const tabs = document.querySelectorAll('.tab');
  
  tabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
      // Cambiar tab activo
      tabs.forEach(t => t.classList.remove('active'));
      e.target.classList.add('active');

      // Cambiar parámetro
      currentParam = e.target.getAttribute('data-param');

      // Re-renderizar gráfica
      renderChart('chart-canvas', measurements, currentParam, config);

      // Re-renderizar lista
      renderMeasurementsList(measurements.filter(m => m.tipo === currentParam));
    });
  });
}

function renderMeasurementsList(measurements) {
  const list = document.getElementById('measurements-list');
  
  if (measurements.length === 0) {
    list.innerHTML = '<p class="text-gray-500 text-center py-4">No hay registros</p>';
    return;
  }

  const sorted = measurements.sort((a, b) => b.ts - a.ts).slice(0, 20);

  list.innerHTML = sorted.map(m => `
    <div class="measurement-item">
      <div class="measurement-info">
        <span class="measurement-value">${m.valor} ${m.unidad || ''}</span>
        <span class="measurement-date">${formatDateTime(m.ts)}</span>
      </div>
      <span class="measurement-trend" style="color: ${getTrendColor(m.tendencia)}">
        ${getTrendIcon(m.tendencia)}
      </span>
    </div>
  `).join('');
}

function renderCommentsList(comments) {
  const list = document.getElementById('comments-list');
  
  if (comments.length === 0) {
    list.innerHTML = '<p class="text-gray-500 text-center py-4">No hay comentarios</p>';
    return;
  }

  const sorted = comments.sort((a, b) => b.ts - a.ts).slice(0, 10);

  list.innerHTML = sorted.map(c => `
    <div class="comment-item">
      <div class="comment-date">${c.fechaISO}</div>
      <div class="comment-text">${c.texto}</div>
    </div>
  `).join('');
}

// ====== AJUSTES ======

function loadSettingsView() {
  const form = document.getElementById('settings-form');
  
  // Cargar valores actuales
  form.elements.umbralPhMin.value = config.umbralPhMin;
  form.elements.umbralPhMax.value = config.umbralPhMax;
  form.elements.umbralPpmMin.value = config.umbralPpmMin;
  form.elements.umbralPpmMax.value = config.umbralPpmMax;
  form.elements.minNivel.value = config.minNivel;
  form.elements.maxNivel.value = config.maxNivel;
  form.elements.unidadComida.value = config.unidadComida;
  form.elements.modoOscuro.checked = config.modoOscuro;

  // Mostrar información del usuario
  const userInfo = document.getElementById('user-info');
  userInfo.innerHTML = `
    <strong>Código:</strong> ${config.userCode}<br>
    ${config.nombreSistema ? `<strong>Sistema:</strong> ${config.nombreSistema}` : ''}
  `;
}

function setupSettingsForm() {
  const form = document.getElementById('settings-form');
  
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = new FormData(form);

    await updateConfig({
      umbralPhMin: parseFloat(formData.get('umbralPhMin')),
      umbralPhMax: parseFloat(formData.get('umbralPhMax')),
      umbralPpmMin: parseFloat(formData.get('umbralPpmMin')),
      umbralPpmMax: parseFloat(formData.get('umbralPpmMax')),
      minNivel: parseFloat(formData.get('minNivel')),
      maxNivel: parseFloat(formData.get('maxNivel')),
      unidadComida: formData.get('unidadComida'),
      modoOscuro: form.elements.modoOscuro.checked
    });

    // Recargar config
    config = await getConfig();

    // Aplicar tema
    applyTheme();

    // Sincronizar
    if (navigator.onLine) {
      await syncAll(config);
    }

    showToast('✅ Ajustes guardados');
  });
}

// ====== SINCRONIZACIÓN ======

function setupSyncButton() {
  const syncButton = document.getElementById('sync-button');
  const syncIcon = document.getElementById('sync-icon');
  const syncText = document.getElementById('sync-text');

  syncButton.addEventListener('click', async () => {
    if (!navigator.onLine) {
      showToast('⚠️ Sin conexión a internet');
      return;
    }

    // Cambiar UI
    syncButton.disabled = true;
    syncIcon.classList.add('spinning');
    syncText.textContent = 'Sincronizando...';

    // Sincronizar
    const result = await syncAll(config);

    // Restaurar UI
    syncButton.disabled = false;
    syncIcon.classList.remove('spinning');

    if (result.success) {
      syncText.textContent = '✅ Sincronizado';
      setTimeout(() => {
        syncText.textContent = 'Sincronizar ahora';
      }, 2000);
      
      showToast(result.message);
    } else {
      syncText.textContent = 'Sincronizar ahora';
      showToast('❌ Error al sincronizar');
    }
  });
}

// ====== TEMA ======

function applyTheme() {
  if (config.modoOscuro) {
    document.body.classList.add('dark-mode');
  } else {
    document.body.classList.remove('dark-mode');
  }
}

// ====== TOAST ======

function showToast(message) {
  // Crear toast si no existe
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }

  toast.textContent = message;
  toast.classList.add('show');

  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}