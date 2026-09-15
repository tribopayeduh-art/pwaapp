// Service Worker para PayGateway - PWA & Notificações de Venda e Depósito em Segundo Plano
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Listener para evento 'push' enviado do servidor backend (Web Push APNs / FCM)
self.addEventListener('push', (event) => {
  let data = { title: 'Você vendeu! 💰', body: 'Sua comissão foi creditada no seu saldo!' };
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: 'PayGateway', body: event.data.text() };
    }
  }

  const title = data.title || 'Você vendeu! 💰';
  const body = data.body || 'Sua comissão foi creditada no seu saldo!';
  const url = data.url || '/';

  const options = {
    body: body,
    icon: '/allifavicon.png',
    badge: '/allifavicon.png',
    vibrate: [200, 100, 200, 100, 200],
    tag: 'push-notif-' + Date.now(),
    renotify: true,
    requireInteraction: true,
    data: { url: url },
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Listener para mensagens da aplicação para exibir notificações instantâneas ou agendadas
self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data) return;

  const validTypes = [
    'SHOW_SALE_NOTIFICATION',
    'SHOW_AFFILIATE_NOTIFICATION',
    'SHOW_PIX_PENDING',
    'SHOW_DEPOSIT_NOTIFICATION',
    'SHOW_NOTIFICATION'
  ];

  if (validTypes.includes(data.type)) {
    let title = data.title;
    if (!title) {
      if (data.type === 'SHOW_PIX_PENDING') {
        title = 'PIX Pendente ⏳';
      } else if (data.type === 'SHOW_DEPOSIT_NOTIFICATION') {
        title = 'Depósito Confirmado! ⚡';
      } else {
        title = 'Você vendeu! 💰';
      }
    }

    const commissionVal = data.amount !== undefined ? data.amount : '';
    const body = data.body || (commissionVal ? `Valor: R$ ${commissionVal}` : 'Notificação do sistema');
    const url = data.url || '/';

    const options = {
      body: body,
      icon: '/allifavicon.png',
      badge: '/allifavicon.png',
      vibrate: [200, 100, 200, 100, 200],
      tag: 'app-notif-' + Date.now(),
      renotify: true,
      requireInteraction: true,
      data: { url: url }
    };

    // A vida do Service Worker é curta. Vincular a Promise ao evento evita que
    // Safari/Chrome encerrem o worker antes de a notificação ser exibida.
    event.waitUntil(self.registration.showNotification(title, options));
  }
});

// Ao clicar na notificação, abre/foca o aplicativo
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = new URL((event.notification.data && event.notification.data.url) || '/', self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (let client of clientList) {
        if (client.url && 'focus' in client) {
          if ('navigate' in client) {
            client.navigate(targetUrl);
          }
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
