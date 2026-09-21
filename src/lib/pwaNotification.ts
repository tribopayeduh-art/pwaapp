// Helper module for PWA Service Worker & Sales Notifications

export interface NotificationState {
  supported: boolean;
  permission: NotificationPermission;
  swRegistered: boolean;
  isIOS: boolean;
  isStandalone: boolean;
  isIframe?: boolean;
  enabled: boolean;
  newAffiliateEnabled: boolean;
}

export interface InAppNotificationItem {
  id: string;
  title: string;
  body: string;
  url?: string;
  createdAt?: string;
  type?: string;
}

export interface NotificationPermissionResult {
  granted: boolean;
  inAppOnly: boolean;
  isIframe: boolean;
}

export function isInsideIframe(): boolean {
  try {
    return window.self !== window.top;
  } catch (e) {
    return true;
  }
}

// Trigger in-app synchronized notification banner + sound + vibration
export function triggerInAppNotification(payload: {
  title: string;
  body: string;
  url?: string;
  id?: string;
  type?: string;
}) {
  const notifId = payload.id || `inapp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

  // 1. Play sound
  playSaleSound();

  // 2. Vibrate if supported
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate([200, 100, 200]);
    } catch (e) {}
  }

  // 3. Dispatch custom in-app event for the Floating Notification Banner
  if (typeof window !== 'undefined') {
    const event = new CustomEvent('alliance:in-app-notification', {
      detail: {
        id: notifId,
        title: payload.title,
        body: payload.body,
        url: payload.url || '/?tab=affiliates',
        createdAt: new Date().toISOString(),
        type: payload.type || 'AFFILIATE_NOTIFICATION'
      }
    });
    window.dispatchEvent(event);
  }

  // 4. Also forward to Service Worker if active and permission is granted for OS push
  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    navigator.serviceWorker.getRegistration().then((reg) => {
      if (reg && reg.active) {
        reg.active.postMessage({
          type: 'SHOW_NOTIFICATION',
          title: payload.title,
          body: payload.body,
          url: payload.url || '/?tab=affiliates'
        });
      }
    }).catch(() => {});
  }
}

// Sync notification preferences changes to the server
export async function syncNotificationPreferences(preferences: Record<string, boolean>) {
  try {
    const token = localStorage.getItem('pg_auth_token') || localStorage.getItem('paygateway_token') || localStorage.getItem('token');
    const endpoint = localStorage.getItem('pg_push_endpoint');
    await fetch('/api/push/preferences', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ endpoint, preferences })
    }).catch(() => {});
  } catch (e) {
    console.warn('Erro ao sincronizar preferências com o servidor:', e);
  }
}

let swRegistration: ServiceWorkerRegistration | null = null;

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Subscribe to Backend Web Push (Required for iOS / Android when app is CLOSED)
export async function subscribeToWebPush(swReg: ServiceWorkerRegistration) {
  try {
    if (!('pushManager' in swReg)) {
      console.warn('pushManager não disponível neste dispositivo');
      return null;
    }

    // Fetch VAPID Public Key from backend
    const res = await fetch('/api/push/vapid-public-key');
    if (!res.ok) return null;
    const { publicKey } = await res.json();
    if (!publicKey) return null;

    const applicationServerKey = urlBase64ToUint8Array(publicKey);

    let subscription = await swReg.pushManager.getSubscription();
    if (subscription) {
      // Verifica se a chave da inscrição existente corresponde à chave pública VAPID atual
      try {
        const rawKey = subscription.options.applicationServerKey;
        if (rawKey) {
          const currentKeyBytes = new Uint8Array(rawKey);
          let match = currentKeyBytes.length === applicationServerKey.length;
          if (match) {
            for (let i = 0; i < currentKeyBytes.length; i++) {
              if (currentKeyBytes[i] !== applicationServerKey[i]) {
                match = false;
                break;
              }
            }
          }
          if (!match) {
            console.log('[WebPush] Chave VAPID alterada ou incompatível. Recriando inscrição push...');
            await subscription.unsubscribe();
            subscription = null;
          }
        }
      } catch (checkErr) {
        console.warn('[WebPush] Erro ao validar chave da inscrição existente:', checkErr);
      }
    }

    if (!subscription) {
      subscription = await swReg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey
      });
    }

    if (subscription && subscription.endpoint) {
      localStorage.setItem('pg_push_endpoint', subscription.endpoint);
      try {
        localStorage.setItem('pg_push_subscription', JSON.stringify(subscription));
      } catch (_) {}

      // Send subscription to backend server
      const token = localStorage.getItem('pg_auth_token') || localStorage.getItem('paygateway_token') || localStorage.getItem('token');
      const subscribeResponse = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ subscription })
      });
      if (!subscribeResponse.ok) {
        const detail = await subscribeResponse.text().catch(() => '');
        console.warn(`[WebPush] Falha ao persistir inscrição Push (${subscribeResponse.status}): ${detail}`);
      } else {
        console.log('[WebPush] Inscrição Web Push enviada e sincronizada com o backend!');
      }
    }

    return subscription;
  } catch (err) {
    console.error('Erro ao se inscrever no Web Push:', err);
    return null;
  }
}

// Audio playback for sales notification using /venda.mp3 audio
export function playSaleSound() {
  try {
    const audio = new Audio('/venda.mp3');
    audio.currentTime = 0;
    audio.play().catch((err) => {
      console.warn('Playback of /venda.mp3 required user interaction or failed:', err);
    });
  } catch (e) {
    console.error('Failed to play /venda.mp3 sound:', e);
  }
}

// Register Service Worker
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) {
    console.warn('Service Workers não suportados neste navegador.');
    return null;
  }

  try {
    const reg = await navigator.serviceWorker.register('/sw.js?v=pwa-push-v10', { scope: '/', updateViaCache: 'none' });
    await reg.update();
    swRegistration = reg;
    console.log('Service Worker registrado com sucesso:', reg.scope);

    // Escuta evento do Service Worker quando um push em segundo plano for recebido
    if (!navigator.serviceWorker.onmessage) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'PUSH_RECEIVED') {
          playSaleSound();
        }
      });
    }

    // Auto subscribe to web push if notification permission granted
    if ('Notification' in window && Notification.permission === 'granted') {
      subscribeToWebPush(reg).catch(console.error);
    }

    return reg;
  } catch (error) {
    console.error('Erro ao registrar Service Worker:', error);
    return null;
  }
}

// Get current state
export function getNotificationState(): NotificationState {
  const supported = typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator;
  const permission = (typeof Notification !== 'undefined') ? Notification.permission : 'denied';
  
  const isIOS = typeof navigator !== 'undefined' && /iPhone|iPad|iPod/i.test(navigator.userAgent);
  const isStandalone = typeof window !== 'undefined' && (
    window.matchMedia('(display-mode: standalone)').matches || 
    (navigator as any).standalone === true
  );
  const inIframe = isInsideIframe();

  const enabled = typeof localStorage !== 'undefined' && localStorage.getItem('pg_gateway_notifications') === 'true';
  const newAffiliateEnabled = typeof localStorage !== 'undefined' && localStorage.getItem('pg_new_affiliate_notifications') !== 'false';

  return {
    supported,
    permission,
    swRegistered: !!swRegistration,
    isIOS,
    isStandalone,
    isIframe: inIframe,
    enabled,
    newAffiliateEnabled,
  };
}

// Request Permission & Subscribe to Web Push
export async function requestNotificationPermission(): Promise<NotificationPermissionResult> {
  const inIframe = isInsideIframe();

  if (typeof Notification === 'undefined') {
    localStorage.setItem('pg_gateway_notifications', 'true');
    return { granted: false, inAppOnly: true, isIframe: inIframe };
  }

  // Register SW first
  const reg = await registerServiceWorker();

  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      localStorage.setItem('pg_gateway_notifications', 'true');
      localStorage.setItem('pg_new_affiliate_notifications', 'true');

      if (reg) {
        await subscribeToWebPush(reg);
      }
      return { granted: true, inAppOnly: false, isIframe: inIframe };
    } else {
      localStorage.setItem('pg_gateway_notifications', 'false');
      return { granted: false, inAppOnly: true, isIframe: inIframe };
    }
  } catch (err) {
    console.warn('Notification.requestPermission bloqueado ou restrito neste contexto:', err);
    localStorage.setItem('pg_gateway_notifications', 'true');
    return { granted: false, inAppOnly: true, isIframe: inIframe };
  }
}

// Set enabled state manually
export function setNotificationsEnabled(enabled: boolean) {
  localStorage.setItem('pg_gateway_notifications', enabled ? 'true' : 'false');
}

export function setNewAffiliateNotificationsEnabled(enabled: boolean) {
  localStorage.setItem('pg_new_affiliate_notifications', enabled ? 'true' : 'false');
}

// Trigger background push test via backend (will ring on iPhone even if app is closed)
export async function triggerBackgroundPushTest(delayMs: number = 3000): Promise<boolean> {
  try {
    const token = localStorage.getItem('pg_auth_token') || localStorage.getItem('paygateway_token') || localStorage.getItem('token');
    const endpoint = localStorage.getItem('pg_push_endpoint');
    const res = await fetch('/api/push/send-test', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({
        delayMs,
        endpoint,
        title: 'Você vendeu! 💰',
        body: 'Sua comissão de R$ 37,50 foi creditada no seu saldo!'
      })
    });
    return res.ok;
  } catch (e) {
    console.error('Erro ao disparar teste de push em segundo plano:', e);
    return false;
  }
}

// Trigger Sale Notification
export async function triggerSaleNotification(options: {
  amount?: string | number;
  customTitle?: string;
  customSubtitle?: string;
  delayMs?: number;
}): Promise<boolean> {
  const state = getNotificationState();

  // Play cash register sound if active on screen
  if (!options.delayMs || options.delayMs === 0) {
    playSaleSound();
  } else {
    setTimeout(() => {
      playSaleSound();
    }, options.delayMs);
  }

  const rawAmount = options.amount !== undefined ? options.amount : '47,90';
  const formattedAmount = typeof rawAmount === 'number' 
    ? rawAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : rawAmount;

  const title = options.customTitle || 'Você vendeu!';
  const body = options.customSubtitle || `Sua comissão é R$ ${formattedAmount}`;

  // Send push test if delay is set or app might be closed
  if (options.delayMs && options.delayMs > 0) {
    triggerBackgroundPushTest(options.delayMs).catch(console.error);
  }

  // Try via Service Worker first (works best in PWA)
  if ('serviceWorker' in navigator) {
    let reg = swRegistration || (await navigator.serviceWorker.getRegistration());
    if (!reg) {
      reg = await registerServiceWorker();
    }

    if (reg && reg.active) {
      reg.active.postMessage({
        type: 'SHOW_SALE_NOTIFICATION',
        title,
        body,
        amount: formattedAmount,
        delay: options.delayMs || 0,
      });
      return true;
    }
  }

  // Fallback if Service Worker is not active but Notification permission is granted
  if ('Notification' in window && Notification.permission === 'granted') {
    const show = () => {
      new Notification(title, {
        body,
        icon: '/allifavicon.png',
        badge: '/allifavicon.png',
      });
    };

    if (options.delayMs && options.delayMs > 0) {
      setTimeout(show, options.delayMs);
    } else {
      show();
    }
    return true;
  }

  return false;
}

// Trigger New Affiliate Registration Notification
export async function triggerNewAffiliateNotification(options?: {
  name?: string;
  delayMs?: number;
}): Promise<boolean> {
  const title = 'Novo Cadastro na sua rede! 👤';
  const nameStr = options?.name ? ` (${options.name})` : '';
  const body = `Um novo usuário${nameStr} se cadastrou na sua rede com o seu link!`;

  if (!options?.delayMs || options.delayMs === 0) {
    playSaleSound();
  } else {
    setTimeout(() => {
      playSaleSound();
    }, options.delayMs);
  }

  if (options?.delayMs && options.delayMs > 0) {
    triggerBackgroundPushTest(options.delayMs).catch(console.error);
  }

  if ('serviceWorker' in navigator) {
    let reg = swRegistration || (await navigator.serviceWorker.getRegistration());
    if (!reg) {
      reg = await registerServiceWorker();
    }

    if (reg && reg.active) {
      reg.active.postMessage({
        type: 'SHOW_SALE_NOTIFICATION',
        title,
        body,
        delay: options?.delayMs || 0,
      });
      return true;
    }
  }

  if ('Notification' in window && Notification.permission === 'granted') {
    const show = () => {
      new Notification(title, {
        body,
        icon: '/allifavicon.png',
        badge: '/allifavicon.png',
      });
    };

    if (options?.delayMs && options.delayMs > 0) {
      setTimeout(show, options.delayMs);
    } else {
      show();
    }
    return true;
  }

  return false;
}

export type AffiliateNotificationEvent = 'registration' | 'ftd' | 'pixPending' | 'gameActivity';

export async function triggerAffiliateEventNotification(options: {
  event: AffiliateNotificationEvent;
  title: string;
  amount?: number;
  influencer?: string;
  player?: string;
  game?: string;
  url?: string;
}): Promise<boolean> {
  let prefs: Record<string, boolean> = {
    registration: true,
    ftd: true,
    pixPending: true,
    gameActivity: true
  };
  try {
    const raw = localStorage.getItem('affiliate_notification_prefs');
    if (raw) {
      prefs = { ...prefs, ...JSON.parse(raw) };
    }
  } catch (e) {}

  if (prefs[options.event] === false) return false;

  playSaleSound();

  const mode = localStorage.getItem('affiliate_notification_mode') === 'simple' ? 'simple' : 'detailed';
  const amount = options.amount === undefined ? '' : ` • R$ ${options.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  const details = [options.influencer && `Influenciador: ${options.influencer}`, options.player && `Jogador: ${options.player}`, options.game && `Jogo: ${options.game}`].filter(Boolean).join(' • ');
  const body = mode === 'detailed' && details ? `${options.title}${amount}\n${details}` : `${options.title}${amount}`;

  if ('serviceWorker' in navigator) {
    let reg = swRegistration || (await navigator.serviceWorker.getRegistration()) || (await registerServiceWorker());
    if (reg?.active) {
      reg.active.postMessage({
        type: 'SHOW_AFFILIATE_NOTIFICATION',
        title: options.title,
        body,
        url: options.url || '/?tab=affiliates'
      });
      return true;
    }
  }
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(options.title, {
      body,
      icon: '/allifavicon.png',
      badge: '/allifavicon.png',
      data: { url: options.url || '/?tab=affiliates' }
    });
    return true;
  }
  return false;
}
