import { saveToStore, getFromStore, getAllFromStore, getByIndex, deleteFromStore, cleanOldRecords } from './db.js';
import { defaultUserConfig } from './config.js';

// ====== CONFIGURACIÓN ======

export async function getConfig() {
  let config = await getFromStore('config', 'singleton');
  if (!config) {
    config = { id: 'singleton', ...defaultUserConfig };
    await saveConfig(config);
  }
  return config;
}

export async function saveConfig(config) {
  config.id = 'singleton';
  await saveToStore('config', config);
  return config;
}

export async function updateConfig(updates) {
  const config = await getConfig();
  const newConfig = { ...config, ...updates };
  await saveConfig(newConfig);
  return newConfig;
}

// ====== MEDICIONES ======

export async function saveMeasurement(measurement) {
  // Agregar a mediciones
  const id = await saveToStore('mediciones', measurement);

  // Agregar a cola de sincronización
  await saveToStore('sync_queue', {
    type: 'measurement',
    data: { ...measurement, id },
    synced: false,
    ts: Date.now()
  });

  // Limpiar registros antiguos
  await cleanOldRecords('mediciones');

  return id;
}

export async function getAllMeasurements() {
  return await getAllFromStore('mediciones');
}

export async function getMeasurementsByType(tipo) {
  return await getByIndex('mediciones', 'tipo', tipo);
}

export async function getLastMeasurementByType(tipo) {
  const measurements = await getMeasurementsByType(tipo);
  if (measurements.length === 0) return null;
  return measurements.sort((a, b) => b.ts - a.ts)[0];
}

export async function deleteMeasurement(id) {
  await deleteFromStore('mediciones', id);
}

// ====== COMENTARIOS ======

export async function saveComment(comment) {
  const id = await saveToStore('comentarios', comment);

  // Agregar a cola de sincronización
  await saveToStore('sync_queue', {
    type: 'comment',
    data: { ...comment, id },
    synced: false,
    ts: Date.now()
  });

  return id;
}

export async function getAllComments() {
  const comments = await getAllFromStore('comentarios');
  return comments.sort((a, b) => b.ts - a.ts);
}

export async function getCommentsByDate(fechaISO) {
  return await getByIndex('comentarios', 'fechaISO', fechaISO);
}

export async function deleteComment(id) {
  await deleteFromStore('comentarios', id);
}

// ====== COLA DE SINCRONIZACIÓN ======

export async function getPendingSync() {
  const queue = await getAllFromStore('sync_queue');
  return queue.filter(item => !item.synced);
}

export async function markAsSynced(id) {
  const item = await getFromStore('sync_queue', id);
  if (item) {
    item.synced = true;
    await saveToStore('sync_queue', item);
  }
}

export async function clearSyncedItems() {
  const queue = await getAllFromStore('sync_queue');
  const synced = queue.filter(item => item.synced);

  for (const item of synced) {
    await deleteFromStore('sync_queue', item.id);
  }

  console.log(`🗑️ Eliminados ${synced.length} items sincronizados`);
}

// ====== ÚLTIMOS VALORES ======

export async function getLastValues() {
  const types = ['ph', 'temp', 'nivel', 'conductividad', 'amonio', 'nitrito', 'nitrato', 'comida'];
  const lastValues = {};

  for (const tipo of types) {
    const last = await getLastMeasurementByType(tipo);
    if (last) {
      lastValues[tipo] = last;
    }
  }

  return lastValues;
}

// ====== ESTADÍSTICAS ======

export async function getMeasurementStats(tipo, days = 7) {
  const measurements = await getMeasurementsByType(tipo);
  const cutoffTime = Date.now() - (days * 24 * 60 * 60 * 1000);
  const recent = measurements.filter(m => m.ts >= cutoffTime);

  if (recent.length === 0) return null;

  const values = recent.map(m => m.valor);
  const sum = values.reduce((a, b) => a + b, 0);

  return {
    count: recent.length,
    min: Math.min(...values),
    max: Math.max(...values),
    avg: sum / values.length,
    latest: recent[recent.length - 1]
  };

}

// ====== IMPORTAR DATOS DESDE FIREBASE ======

export async function importMeasurementsFromFirebase(firebaseMediciones) {
  let imported = 0;
  
  for (const key in firebaseMediciones) {
    const medicion = firebaseMediciones[key];
    
    // Guardar en IndexedDB sin añadir a sync_queue
    const db = getDB();
    await new Promise((resolve, reject) => {
      const transaction = db.transaction(['mediciones'], 'readwrite');
      const store = transaction.objectStore('mediciones');
      const request = store.add({
        tipo: medicion.tipo,
        valor: medicion.valor,
        unidad: medicion.unidad,
        ts: medicion.ts,
        tendencia: medicion.tendencia || 'same'
      });
      
      request.onsuccess = () => {
        imported++;
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }
  
  console.log(`📥 ${imported} mediciones importadas desde Firebase`);
  return imported;
}

export async function importCommentsFromFirebase(firebaseComentarios) {
  let imported = 0;
  
  for (const key in firebaseComentarios) {
    const comentario = firebaseComentarios[key];
    
    const db = getDB();
    await new Promise((resolve, reject) => {
      const transaction = db.transaction(['comentarios'], 'readwrite');
      const store = transaction.objectStore('comentarios');
      const request = store.add({
        texto: comentario.texto,
        fechaISO: comentario.fechaISO,
        ts: comentario.ts
      });
      
      request.onsuccess = () => {
        imported++;
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }
  
  console.log(`📥 ${imported} comentarios importados desde Firebase`);
  return imported;
}
