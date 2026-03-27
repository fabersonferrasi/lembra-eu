self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  
  const taskId = event.notification.data?.taskId;
  
  if (event.action === 'confirm' && taskId) {
    const urlToOpen = new URL(`/?confirmTask=${taskId}`, self.location.origin).href;
    
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
        // If app is already open, focus it and navigate
        for (let i = 0; i < windowClients.length; i++) {
          let client = windowClients[i];
          if (client.url.indexOf(self.location.origin) !== -1 && 'focus' in client) {
            client.navigate(urlToOpen);
            return client.focus();
          }
        }
        // If app is not open, open a new window
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
    );
  } else {
    // Just open the app normally
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
        for (let i = 0; i < windowClients.length; i++) {
          let client = windowClients[i];
          if (client.url.indexOf(self.location.origin) !== -1 && 'focus' in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow('/');
        }
      })
    );
  }
});

self.addEventListener('periodicsync', (event) => {
  console.log('[ServiceWorker] O Android acionou o Periodic Background Sync!', event.tag);
  if (event.tag === 'check-tasks') {
    event.waitUntil(checkAndNotifyTasks());
  }
});

async function checkAndNotifyTasks() {
  console.log('[ServiceWorker / Background] Iniciando varredura das tarefas (Dexie/IndexedDB) sem depender de tela...');
  return new Promise((resolve, reject) => {
    // Open Dexie DB (LembraEuDB)
    const request = indexedDB.open('LembraEuDB');
    
    request.onerror = (e) => {
      console.error('[ServiceWorker] Falha brutal ao ler DB LembraEuDB:', request.error);
      reject(request.error);
    };
    
    request.onsuccess = (e) => {
      const db = e.target.result;
      console.log('[ServiceWorker] Conexão com DB aberta com sucesso!');
      
      try {
        const trans = db.transaction(['tasks', 'taskLogs'], 'readonly');
        const tasksStore = trans.objectStore('tasks');
        const logsStore = trans.objectStore('taskLogs');
        
        const tasksReq = tasksStore.getAll();
        tasksReq.onsuccess = () => {
          const tasks = tasksReq.result;
          if (!tasks || tasks.length === 0) return resolve();
          
          const now = new Date();
          const today = now.getDay();
          
          logsStore.getAll().onsuccess = async (logsReq) => {
            const logs = logsReq.target.result || [];
            
            for (const task of tasks) {
              let isTimeReached = false;
              
              if (task.scheduleType === "custom" && task.customSchedules) {
                const match = task.customSchedules.find(cs => cs.days.includes(today));
                if (match && match.time) {
                  const [hours, mins] = match.time.split(':').map(Number);
                  const taskTime = new Date();
                  taskTime.setHours(hours, mins, 0, 0);
                  if (now.getTime() >= taskTime.getTime()) {
                    isTimeReached = true;
                  }
                }
              } else if (task.scheduleTime) {
                const [hours, mins] = task.scheduleTime.split(':').map(Number);
                const taskTime = new Date();
                taskTime.setHours(hours, mins, 0, 0);
                if (now.getTime() >= taskTime.getTime()) {
                  isTimeReached = true;
                }
              }
              
              if (isTimeReached) {
                const todayStart = new Date().setHours(0, 0, 0, 0);
                const hasLogToday = logs.some(log => {
                  return log.taskId === task.id && (new Date(log.completedAt).setHours(0, 0, 0, 0) === todayStart);
                });
                
                // We use title to check if we already have it in active notifications 
                const activeNotes = await self.registration.getNotifications();
                const alreadyShowing = activeNotes.some(n => n.data?.taskId === task.id);
                
                if (!hasLogToday && !alreadyShowing) {
                  console.log(`[ServiceWorker] Disparando Notificação PUSH LOCAL para: ${task.title}`);
                  self.registration.showNotification(`Lembrete: ${task.title}`, {
                    body: task.description || "É hora de executar essa tarefa!",
                    icon: "/icon-192x192.png",
                    vibrate: [200, 100, 200, 100, 200],
                    data: { taskId: task.id },
                    actions: [
                      { action: 'confirm', title: '✓ Já fiz!' },
                      { action: 'close', title: 'X Depois' }
                    ]
                  }).then(() => console.log('Sucesso!'))
                    .catch((err) => console.error("Falhou ao disparar showNotification:", err));
                } else {
                  console.log(`[ServiceWorker] Tarefa ${task.title} ignorada (já notificada ou já completa hoje).`);
                }
              }
            }
            console.log('[ServiceWorker] Ciclo de Tasks conlcuído.');
            resolve();
          };
        };
      } catch (err) {
        console.warn("[ServiceWorker] Could not read from IndexedDB in SW:", err);
        resolve();
      }
    };
  });
}
