/* Bubble Blast - Real Auth, Dotfy & Database Integration Bridge */
(() => {
  'use strict';
  const originalFetch = window.fetch.bind(window);

  // Obter token ativo de sessão armazenado
  const getStoredToken = () => {
    try {
      return (
        localStorage.getItem('bb_token') ||
        localStorage.getItem('pg_auth_token') ||
        localStorage.getItem('paygateway_token') ||
        localStorage.getItem('token') ||
        ''
      );
    } catch {
      return '';
    }
  };

  // Sincronizar carteira e sessão local do motor do jogo
  const syncLocalEngine = (user, balanceCents) => {
    try {
      if (!user) return;
      const phone = user.phone ? String(user.phone).replace(/\D/g, '') : (user.id || 'guest');
      localStorage.setItem('bb-demo-session-v1', phone);
      if (typeof balanceCents === 'number' && !isNaN(balanceCents) && balanceCents >= 0) {
        localStorage.setItem('bb-demo-wallet-v1-' + phone, String(Math.round(balanceCents)));
      }
      const rawAccounts = localStorage.getItem('bb-demo-accounts-v1') || '{}';
      const accounts = JSON.parse(rawAccounts);
      accounts[phone] = {
        id: user.id,
        phone: user.phone || phone,
        name: user.name || 'Jogador',
        role: 'USER'
      };
      localStorage.setItem('bb-demo-accounts-v1', JSON.stringify(accounts));
    } catch (_) {}
  };

  // Sincronização inicial de cookie e sessão se já houver token no navegador
  try {
    const startupToken = getStoredToken();
    if (startupToken && !document.cookie.includes('bb_session=')) {
      document.cookie = 'bb_session=' + encodeURIComponent(startupToken) + '; path=/; max-age=2592000; SameSite=Lax';
    }
    const rawUser = localStorage.getItem('user');
    if (rawUser) {
      const u = JSON.parse(rawUser);
      syncLocalEngine(u, typeof u.balance === 'number' ? u.balance * 100 : undefined);
    }
  } catch (_) {}

  // Interceptador para enriquecer requisições com credenciais e sincronizar respostas de auth e Dotfy
  window.fetch = async (input, options = {}) => {
    const rawUrl = typeof input === 'string' ? input : input.url;
    const url = new URL(rawUrl, location.href);

    // Repassar requisições normais que não sejam para a API local
    if (url.origin !== location.origin || !url.pathname.startsWith('/api/')) {
      return originalFetch(input, options);
    }

    const path = url.pathname;
    const method = (options.method || (typeof input !== 'string' ? input.method : 'GET') || 'GET').toUpperCase();
    const token = getStoredToken();

    // Injetar headers de autenticação
    const headers = new Headers(options.headers || (typeof input !== 'string' ? input.headers : {}) || {});
    if (token && !headers.has('Authorization')) {
      headers.set('Authorization', 'Bearer ' + token);
    }
    if (!headers.has('X-Game-Origin')) {
      headers.set('X-Game-Origin', 'g_bubble_blast');
    }

    const fetchOptions = {
      ...options,
      headers,
      credentials: options.credentials || 'same-origin'
    };

    try {
      const response = await originalFetch(input, fetchOptions);

      // Inspecionar respostas de sucesso para sincronizar sessão e banco de dados local
      if (response.ok) {
        try {
          const clone = response.clone();
          clone.json().then(data => {
            if (!data) return;

            // 1. Resposta de Cadastro ou Login
            if ((path === '/api/auth/register' || path === '/api/auth/login') && method === 'POST') {
              if (data.token) {
                localStorage.setItem('bb_token', data.token);
                localStorage.setItem('token', data.token);
                localStorage.setItem('pg_auth_token', data.token);
                document.cookie = 'bb_session=' + encodeURIComponent(data.token) + '; path=/; max-age=2592000; SameSite=Lax';
              }
              if (data.user) {
                localStorage.setItem('user', JSON.stringify(data.user));
                syncLocalEngine(data.user, data.balanceCents);
                if (window.parent && window.parent !== window) {
                  window.parent.postMessage({
                    source: 'bubble-blast-shell',
                    event: 'auth',
                    token: data.token,
                    user: data.user,
                    balance: (data.balanceCents || 0) / 100
                  }, '*');
                }
              }
            }

            // 2. Resposta de /api/auth/me
            if (path === '/api/auth/me' && method === 'GET') {
              const u = data.user || data;
              if (u && u.id) {
                localStorage.setItem('user', JSON.stringify(u));
                syncLocalEngine(u, data.balanceCents ?? (typeof u.balance === 'number' ? u.balance * 100 : undefined));
              }
            }

            // 3. Resposta de verificação de status do PIX Dotfy (/api/wallet/deposit/status)
            if (path.startsWith('/api/wallet/deposit/status') && data.status === 'COMPLETED') {
              const rawU = localStorage.getItem('user');
              if (rawU) {
                const u = JSON.parse(rawU);
                syncLocalEngine(u, data.balanceCents);
              }
              if (window.parent && window.parent !== window) {
                window.parent.postMessage({
                  source: 'bubble-blast-shell',
                  event: 'round_finish',
                  win: true,
                  amount: (data.amountCents || 0) / 100,
                  balance: (data.balanceCents || 0) / 100
                }, '*');
              }
            }

            // 4. Logout
            if (path === '/api/auth/logout') {
              localStorage.removeItem('bb_token');
              localStorage.removeItem('token');
              localStorage.removeItem('pg_auth_token');
              localStorage.removeItem('user');
              document.cookie = 'bb_session=; path=/; max-age=0; SameSite=Lax';
            }
          }).catch(() => {});
        } catch (_) {}
      }

      return response;
    } catch (netErr) {
      console.error('[Bubble Net Error]:', netErr);
      return originalFetch(input, options);
    }
  };
})();

