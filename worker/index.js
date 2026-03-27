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
