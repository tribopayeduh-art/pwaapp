// Zumbla Win - Influencer Profile Integration
(function() {
  let isInfluencerMode = false;
  let influencerStats = null;
  let isLoadingStats = false;

  function getAuthData() {
    const token = localStorage.getItem('pg_auth_token') || 
                  localStorage.getItem('paygateway_token') || 
                  localStorage.getItem('token') || '';
    const userStr = localStorage.getItem('user') || 
                    localStorage.getItem('zumbla_user') || 
                    localStorage.getItem('zumbla-user') || '{}';
    let user = {};
    try {
      user = typeof userStr === 'string' && userStr.startsWith('{') ? JSON.parse(userStr) : { name: userStr };
    } catch(e) {}
    return { token, user };
  }

  async function fetchZumblaInfluencerStats() {
    const { token, user } = getAuthData();
    if (!user || !user.isInfluencer) return null;
    const email = user.email || '';
    try {
      isLoadingStats = true;
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/gen-dino/influencer-stats?email=${encodeURIComponent(email)}&game=g_zumbla`, {
        headers
      });
      const data = await res.json();
      if (res.ok && data.stats) {
        influencerStats = data.stats;
        return data.stats;
      }
    } catch (e) {
      console.error('[Zumbla Influencer] Erro ao buscar stats:', e);
    } finally {
      isLoadingStats = false;
    }
    return null;
  }

  function formatMoney(amount) {
    const num = Number(amount) || 0;
    return 'R$ ' + num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  async function injectInfluencerUI(profileContainer) {
    const { token, user } = getAuthData();
    let isInf = Boolean(user && user.isInfluencer);

    // If token exists and isInfluencer is not explicit, verify in real-time
    if (token && user && user.isInfluencer === undefined) {
      try {
        const checkRes = await fetch('/api/auth/me', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (checkRes.ok) {
          const freshData = await checkRes.json();
          if (freshData && typeof freshData.isInfluencer === 'boolean') {
            isInf = freshData.isInfluencer;
            user.isInfluencer = freshData.isInfluencer;
            try {
              localStorage.setItem('user', JSON.stringify({ ...user, isInfluencer: freshData.isInfluencer }));
            } catch(e) {}
          }
        }
      } catch(e) {}
    }

    // STRICT CHECK: Se não estiver marcado como influenciador pelo afiliado, NUNCA injetar
    if (!isInf) {
      const existingTabs = document.getElementById('zw-influencer-tabs');
      if (existingTabs) existingTabs.remove();
      const existingPanel = document.getElementById('zw-influencer-panel');
      if (existingPanel) existingPanel.remove();
      profileContainer.querySelectorAll('.account-card, .menu-list').forEach(el => el.style.display = '');
      return;
    }

    if (document.getElementById('zw-influencer-tabs')) return;

    // Check if account-card exists to insert before it
    const accountCard = profileContainer.querySelector('.account-card');
    if (!accountCard) return;

    const tabsWrapper = document.createElement('div');
    tabsWrapper.id = 'zw-influencer-tabs';
    tabsWrapper.style.cssText = 'display: flex; gap: 8px; margin: 12px 0 16px; background: rgba(0,0,0,0.5); padding: 4px; border-radius: 12px; border: 1px solid rgba(46, 204, 113, 0.2); width: 100%; box-sizing: border-box;';

    tabsWrapper.innerHTML = `
      <button type="button" id="zw-tab-player" style="flex: 1; padding: 9px 12px; border-radius: 8px; font-weight: 800; font-size: 11px; border: none; cursor: pointer; background: #2ecc71; color: #06110b; transition: all 0.2s;">
        👤 Minha Conta
      </button>
      <button type="button" id="zw-tab-influencer" style="flex: 1; padding: 9px 12px; border-radius: 8px; font-weight: 800; font-size: 11px; border: none; cursor: pointer; background: transparent; color: #f59e0b; transition: all 0.2s;">
        ⭐ Modo Influenciador
      </button>
    `;

    accountCard.parentNode.insertBefore(tabsWrapper, accountCard);

    // Create container for influencer panel
    const infPanel = document.createElement('div');
    infPanel.id = 'zw-influencer-panel';
    infPanel.style.cssText = 'display: none; flex-direction: column; gap: 14px; width: 100%; margin-bottom: 24px;';
    accountCard.parentNode.insertBefore(infPanel, accountCard.nextSibling);

    const btnPlayer = document.getElementById('zw-tab-player');
    const btnInf = document.getElementById('zw-tab-influencer');

    function showPlayer() {
      isInfluencerMode = false;
      btnPlayer.style.background = '#2ecc71';
      btnPlayer.style.color = '#06110b';
      btnInf.style.background = 'transparent';
      btnInf.style.color = '#f59e0b';
      
      // Show default player elements
      profileContainer.querySelectorAll('.account-card, .menu-list').forEach(el => el.style.display = '');
      infPanel.style.display = 'none';
    }

    async function showInfluencer() {
      isInfluencerMode = true;
      btnPlayer.style.background = 'transparent';
      btnPlayer.style.color = '#9bb3a3';
      btnInf.style.background = '#f59e0b';
      btnInf.style.color = '#06110b';

      // Hide default player elements
      profileContainer.querySelectorAll('.account-card, .menu-list').forEach(el => el.style.display = 'none');
      infPanel.style.display = 'flex';

      infPanel.innerHTML = '<div style="text-align: center; color: #f59e0b; font-weight: 700; padding: 24px; font-size: 12px;">Carregando métricas do Zumbla Win...</div>';
      const stats = await fetchZumblaInfluencerStats();
      renderInfluencerContent(infPanel, stats);
    }

    btnPlayer.addEventListener('click', showPlayer);
    btnInf.addEventListener('click', showInfluencer);

    // If user is already identified as influencer, show badge or switch
    const { user } = getAuthData();
    if (user.isInfluencer) {
      btnInf.innerHTML = '⭐ Modo Influenciador <span style="background: rgba(0,0,0,0.35); padding: 1px 6px; border-radius: 10px; font-size: 9px;">VIP</span>';
    }
  }

  function renderInfluencerContent(container, stats) {
    if (!stats) {
      container.innerHTML = `
        <div style="background: #0f1c13; border: 1px solid rgba(255,255,255,0.1); border-radius: 14px; padding: 16px; text-align: center; color: #e2ece5;">
          <p style="font-size: 12px; margin-bottom: 8px;">Conecte-se para visualizar suas métricas de divulgação do Zumbla Win.</p>
          <button type="button" id="zw-retry-stats" style="background: #2ecc71; color: #06110b; font-weight: 800; border: none; padding: 8px 16px; border-radius: 8px; font-size: 11px; cursor: pointer;">Tentar Novamente</button>
        </div>
      `;
      const retryBtn = document.getElementById('zw-retry-stats');
      if (retryBtn) retryBtn.onclick = () => fetchZumblaInfluencerStats().then(s => renderInfluencerContent(container, s));
      return;
    }

    const { user } = getAuthData();
    const refCode = stats.referralCode || user.referralCode || 'VIP';
    const shareUrl = `${window.location.origin}/?ref=${refCode}&game=g_zumbla`;

    const byGameStats = (stats.byGame && stats.byGame['g_zumbla']) || {
      referralsCount: stats.gameReferralsCount ?? 0,
      totalDepositsBrought: stats.gameTotalDepositsBrought ?? 0,
      paidDepositsCount: stats.gamePaidDepositsCount ?? 0,
      paidDepositsAmount: stats.gamePaidDepositsAmount ?? 0,
    };

    container.innerHTML = `
      <!-- Responsible Affiliate Card -->
      <div style="background: linear-gradient(135deg, #0e2014 0%, #06120a 100%); border: 1px solid #2ecc7140; border-radius: 14px; padding: 12px 14px; display: flex; align-items: center; justify-content: space-between;">
        <div>
          <span style="font-size: 9px; text-transform: uppercase; color: #7fad8b; font-weight: 800; letter-spacing: 0.5px;">Afiliado Gestor Responsável</span>
          <strong style="display: block; font-size: 13px; color: #ffffff; margin-top: 2px;">${stats.responsibleAffiliate?.name || 'Administração / Afiliado Gestor'}</strong>
          <span style="display: inline-block; font-size: 10px; color: #f59e0b; font-family: monospace; margin-top: 2px;">CÓDIGO: ${stats.responsibleAffiliate?.code || 'GESTOR'}</span>
        </div>
        <div style="background: #f59e0b20; border: 1px solid #f59e0b50; color: #f59e0b; font-size: 10px; font-weight: 900; padding: 4px 10px; border-radius: 20px;">
          🐸 ZUMBLA WIN
        </div>
      </div>

      <!-- Referral Link Box -->
      <div style="background: #0b180f; border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; padding: 12px;">
        <span style="font-size: 10px; color: #7fad8b; font-weight: 800; text-transform: uppercase; display: block; margin-bottom: 6px;">
          Link de Divulgação • Zumbla Win
        </span>
        <div style="display: flex; gap: 8px;">
          <input type="text" readonly id="zw-share-url-input" value="${shareUrl}" style="flex: 1; background: #050d07; border: 1px solid rgba(255,255,255,0.12); border-radius: 8px; padding: 8px 10px; font-size: 11px; font-family: monospace; color: #e2ece5; outline: none;">
          <button type="button" id="zw-btn-copy-url" style="background: #2ecc71; color: #050d07; font-weight: 900; font-size: 11px; border: none; border-radius: 8px; padding: 0 14px; cursor: pointer; transition: all 0.2s;">
            Copiar
          </button>
        </div>
      </div>

      <!-- 4 Requested Metrics -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
        <div style="background: #0d1a11; border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 12px 10px;">
          <span style="font-size: 10px; color: #7fad8b; font-weight: 800; text-transform: uppercase; display: block;">👥 Indicados</span>
          <strong style="font-size: 18px; color: #ffffff; display: block; margin: 4px 0 2px;">${byGameStats.referralsCount}</strong>
          <small style="font-size: 9px; color: #62826d;">Cadastros no Zumbla</small>
        </div>

        <div style="background: #0d1a11; border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 12px 10px;">
          <span style="font-size: 10px; color: #7fad8b; font-weight: 800; text-transform: uppercase; display: block;">💰 Depósitos Trazidos</span>
          <strong style="font-size: 18px; color: #f59e0b; display: block; margin: 4px 0 2px;">${formatMoney(byGameStats.totalDepositsBrought)}</strong>
          <small style="font-size: 9px; color: #62826d;">Volume gerado no jogo</small>
        </div>

        <div style="background: #0d1a11; border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 12px 10px;">
          <span style="font-size: 10px; color: #7fad8b; font-weight: 800; text-transform: uppercase; display: block;">✅ Depósitos Pagos</span>
          <strong style="font-size: 18px; color: #2ecc71; display: block; margin: 4px 0 2px;">${byGameStats.paidDepositsCount}</strong>
          <small style="font-size: 9px; color: #62826d;">${formatMoney(byGameStats.paidDepositsAmount)} confirmados</small>
        </div>

        <div style="background: #142417; border: 1px solid #f59e0b60; border-radius: 12px; padding: 12px 10px;">
          <span style="font-size: 10px; color: #f59e0b; font-weight: 800; text-transform: uppercase; display: block;">💵 Saldo Comissões</span>
          <strong style="font-size: 18px; color: #f59e0b; display: block; margin: 4px 0 2px;">${formatMoney(stats.commissionBalance || 0)}</strong>
          <small style="font-size: 9px; color: #c49942;">Disponível para saque</small>
        </div>
      </div>

      <!-- Withdraw Commissions Banner & Form -->
      <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); border-radius: 14px; padding: 14px; color: #1c1103;">
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <div>
            <strong style="font-size: 13px; display: block;">Sacar Minhas Comissões</strong>
            <span style="font-size: 10px; opacity: 0.95; font-weight: 600;">Aprovado pelo afiliado gestor</span>
          </div>
          <button type="button" id="zw-btn-toggle-drawer" style="background: #050d07; color: #f59e0b; font-weight: 900; font-size: 11px; border: none; border-radius: 8px; padding: 8px 12px; cursor: pointer;">
            Solicitar Saque
          </button>
        </div>

        <div id="zw-withdraw-drawer" style="display: none; margin-top: 12px; padding-top: 12px; border-top: 1px solid rgba(0,0,0,0.15);">
          <div style="background: #050d07; border-radius: 10px; padding: 10px; color: #e2ece5; margin-bottom: 10px; font-size: 10px; line-height: 1.4;">
            ⚠️ <strong>Aviso Financeiro:</strong> A solicitação é enviada para o afiliado responsável (<strong style="color:#f59e0b;">${stats.responsibleAffiliate?.name || 'Afiliado Gestor'}</strong>). O valor liberado é descontado do saldo dele.
          </div>

          <form id="zw-withdraw-form" style="display: flex; flex-direction: column; gap: 8px;">
            <div style="display: flex; gap: 6px;">
              <input type="number" id="zw-withdraw-amount" step="0.01" min="1" max="${stats.commissionBalance || 0}" placeholder="Valor (R$)" required style="flex: 1; background: #ffffff; border: none; border-radius: 8px; padding: 8px 10px; font-size: 12px; color: #000; font-weight: 800;">
              <select id="zw-withdraw-key-type" style="background: #ffffff; border: none; border-radius: 8px; padding: 8px; font-size: 11px; color: #000; font-weight: 800;">
                <option value="cpf">CPF</option>
                <option value="phone">Telefone</option>
                <option value="email">E-mail</option>
                <option value="random">Aleatória</option>
                <option value="chave_pix">Chave PIX</option>
              </select>
            </div>
            <input type="text" id="zw-withdraw-pix-key" placeholder="Digite sua Chave PIX" required style="width: 100%; box-sizing: border-box; background: #ffffff; border: none; border-radius: 8px; padding: 8px 10px; font-size: 12px; color: #000;">
            <button type="submit" id="zw-btn-submit-withdraw" style="background: #050d07; color: #f59e0b; font-weight: 900; font-size: 12px; border: none; border-radius: 8px; padding: 10px; cursor: pointer; text-transform: uppercase;">
              Confirmar Solicitação de Saque
            </button>
          </form>
        </div>
      </div>

      <!-- Requests History -->
      <div>
        <span style="font-size: 11px; color: #7fad8b; font-weight: 800; text-transform: uppercase; display: block; margin-bottom: 8px;">
          Histórico de Solicitações de Saque
        </span>
        <div id="zw-requests-list" style="display: flex; flex-direction: column; gap: 6px;">
          ${(stats.requests && stats.requests.length > 0) ? stats.requests.map(req => {
            const statusBg = req.status === 'approved' ? '#2ecc71' : req.status === 'rejected' ? '#e74c3c' : '#f39c12';
            const statusText = req.status === 'approved' ? 'Aprovado' : req.status === 'rejected' ? 'Recusado' : 'Aguardando Afiliado';
            const valFormatted = formatMoney(req.amount);
            const dateStr = new Date(req.createdAt).toLocaleDateString('pt-BR');
            return `
              <div style="display: flex; justify-content: space-between; align-items: center; background: #07120a; border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 8px 12px; font-size: 11px;">
                <div>
                  <strong style="color: #ffffff; font-size: 12px;">${valFormatted}</strong>
                  ${req.amountReleased && req.amountReleased !== req.amount ? `<span style="color: #2ecc71; font-size: 10px; margin-left: 4px;">(Lib: ${formatMoney(req.amountReleased)})</span>` : ''}
                  <small style="display: block; color: #62826d; font-size: 9px;">PIX: ${req.pixKey} • ${dateStr}</small>
                  ${req.rejectionReason ? `<small style="display: block; color: #e74c3c; font-size: 9px;">Motivo: ${req.rejectionReason}</small>` : ''}
                </div>
                <span style="background: ${statusBg}20; border: 1px solid ${statusBg}50; color: ${statusBg}; font-weight: 800; font-size: 10px; padding: 3px 8px; border-radius: 12px;">
                  ${statusText}
                </span>
              </div>
            `;
          }).join('') : `
            <div style="text-align: center; color: #62826d; font-size: 11px; padding: 14px; background: #07120a; border-radius: 10px;">
              Nenhuma solicitação de saque de comissão enviada ainda.
            </div>
          `}
        </div>
      </div>
    `;

    // Bind sub-events
    const btnCopy = document.getElementById('zw-btn-copy-url');
    const inputUrl = document.getElementById('zw-share-url-input');
    if (btnCopy && inputUrl) {
      btnCopy.onclick = () => {
        navigator.clipboard.writeText(inputUrl.value).then(() => {
          btnCopy.textContent = 'Copiado!';
          setTimeout(() => { btnCopy.textContent = 'Copiar'; }, 2000);
        });
      };
    }

    const btnToggleDrawer = document.getElementById('zw-btn-toggle-drawer');
    const drawer = document.getElementById('zw-withdraw-drawer');
    if (btnToggleDrawer && drawer) {
      btnToggleDrawer.onclick = () => {
        drawer.style.display = drawer.style.display === 'none' ? 'block' : 'none';
      };
    }

    const withdrawForm = document.getElementById('zw-withdraw-form');
    if (withdrawForm) {
      withdrawForm.onsubmit = async (e) => {
        e.preventDefault();
        const amountInput = document.getElementById('zw-withdraw-amount');
        const keyTypeInput = document.getElementById('zw-withdraw-key-type');
        const pixKeyInput = document.getElementById('zw-withdraw-pix-key');
        const submitBtn = document.getElementById('zw-btn-submit-withdraw');

        const amount = parseFloat(amountInput.value);
        if (!amount || isNaN(amount) || amount <= 0) {
          alert('Informe um valor de saque válido.');
          return;
        }

        const pixKey = pixKeyInput.value.trim();
        if (!pixKey) {
          alert('Informe a sua chave PIX.');
          return;
        }

        try {
          submitBtn.disabled = true;
          submitBtn.textContent = 'Enviando...';

          const { token } = getAuthData();
          const headers = { 'Content-Type': 'application/json' };
          if (token) headers['Authorization'] = `Bearer ${token}`;

          const res = await fetch('/api/gen-dino/influencer-withdraw', {
            method: 'POST',
            headers,
            body: JSON.stringify({
              amount,
              pixKey,
              pixKeyType: keyTypeInput.value,
              gameOrigin: 'g_zumbla'
            })
          });

          const data = await res.json();
          if (!res.ok) {
            alert(data.error || 'Erro ao solicitar saque.');
            return;
          }

          alert(data.message || 'Solicitação de saque enviada com sucesso ao afiliado gestor!');
          amountInput.value = '';
          pixKeyInput.value = '';
          if (drawer) drawer.style.display = 'none';

          // Refresh stats
          const newStats = await fetchZumblaInfluencerStats();
          renderInfluencerContent(container, newStats);
        } catch (err) {
          alert('Erro de conexão ao solicitar saque.');
        } finally {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Confirmar Solicitação de Saque';
        }
      };
    }
  }

  // MutationObserver to watch for profile section mount in Zumbla React DOM
  const observer = new MutationObserver(() => {
    const innerPages = document.querySelectorAll('section.inner-page');
    innerPages.forEach(sec => {
      // Check if this inner-page is the profile page
      const hasContaHeader = sec.textContent && (sec.textContent.includes('CONTA') || sec.textContent.includes('ID #ZW'));
      if (hasContaHeader) {
        injectInfluencerUI(sec);
      }
    });
  });

  observer.observe(document.body, { childList: true, subtree: true });
})();
