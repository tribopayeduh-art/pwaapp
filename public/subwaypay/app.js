'use strict';
const app=document.querySelector('#app'),nav=document.querySelector('#nav');
const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}};
let users=read('subway-demo-users',[]),session=read('subway-demo-session',null),entry=10;
// Clean up any legacy demo accounts so all players must have an authenticated account
users = users.filter(u => u && u.email !== 'jogador@subwaypay.site' && u.id !== 'u_demo');
localStorage.setItem('subway-demo-users', JSON.stringify(users));
if (session === 'jogador@subwaypay.site' || session === 'u_demo') {
  session = null;
  localStorage.removeItem('subway-demo-session');
}

// Track referral parameters from URL or hash
try {
  const searchParams = new URLSearchParams(window.location.search);
  const hashStr = window.location.hash || '';
  const hashParams = hashStr.includes('?') ? new URLSearchParams(hashStr.split('?')[1]) : new URLSearchParams();
  const rawRef = searchParams.get('ref') || searchParams.get('r') || searchParams.get('refCode') ||
                 searchParams.get('p') || searchParams.get('partner') || searchParams.get('partnerCode') ||
                 hashParams.get('ref') || hashParams.get('r') || hashParams.get('refCode') ||
                 hashParams.get('p') || hashParams.get('partner') || hashParams.get('partnerCode') || '';
  if (rawRef) {
    localStorage.setItem('subway_ref_code', rawRef.trim());
    sessionStorage.setItem('subway-demo-referrer', rawRef.trim());
  }

  const qEmail = searchParams.get('email');
  const qName = searchParams.get('name') || 'Jogador';
  const qBal = parseFloat(searchParams.get('balance') || '');
  if (qEmail) {
    const cleanEmail = qEmail.toLowerCase().trim();
    let existing = users.find(u => u.email === cleanEmail);
    if (!existing) {
      existing = {
        id: 'u_' + Date.now(),
        email: cleanEmail,
        name: qName,
        balance: !isNaN(qBal) && qBal >= 0 ? qBal : 0,
        registeredGame: 'g_subway_pay'
      };
      users.push(existing);
      localStorage.setItem('subway-demo-users', JSON.stringify(users));
    } else if (!isNaN(qBal) && qBal >= 0) {
      existing.balance = qBal;
      localStorage.setItem('subway-demo-users', JSON.stringify(users));
    }
    session = cleanEmail;
    localStorage.setItem('subway-demo-session', JSON.stringify(session));
  } else if (session && !users.some(u => u.email === session)) {
    session = null;
    localStorage.removeItem('subway-demo-session');
  }
} catch (_) {}

// Sync session with server if token exists
async function syncServerSession() {
  try {
    const token = localStorage.getItem('pg_auth_token') || localStorage.getItem('token');
    if (!token) return;
    const res = await fetch('/api/auth/me', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) return;
    const data = await res.json();
    if (data && data.user && data.user.email) {
      const serverUser = data.user;
      session = serverUser.email.toLowerCase().trim();
      let localUser = users.find(u => u.email === session);
      if (!localUser) {
        localUser = {
          id: serverUser.id,
          email: session,
          name: serverUser.name || 'Jogador',
          balance: typeof serverUser.balance === 'number' ? serverUser.balance : 0,
          referralCode: serverUser.referralCode || '',
          registeredGame: serverUser.registeredGame || 'g_subway_pay'
        };
        users.push(localUser);
      } else {
        localUser.id = serverUser.id;
        localUser.name = serverUser.name || localUser.name;
        localUser.balance = typeof serverUser.balance === 'number' ? serverUser.balance : localUser.balance;
        localUser.referralCode = serverUser.referralCode || localUser.referralCode;
        localUser.registeredGame = serverUser.registeredGame || localUser.registeredGame || 'g_subway_pay';
        localUser.withdrawBlocked = Boolean(serverUser.withdrawBlocked);
        localUser.hasAffiliateDemoBalance = Boolean(serverUser.hasAffiliateDemoBalance);
        localUser.isInfluencer = Boolean(serverUser.isInfluencer);
      }
      if (!localUser.withdrawBlocked && serverUser.withdrawBlocked) localUser.withdrawBlocked = true;
      if (!localUser.hasAffiliateDemoBalance && serverUser.hasAffiliateDemoBalance) localUser.hasAffiliateDemoBalance = true;
      localStorage.setItem('subway-demo-users', JSON.stringify(users));
      localStorage.setItem('subway-demo-session', JSON.stringify(session));
      renderView();
    }
  } catch (_) {}
}
syncServerSession();

const money=n=>Number(n).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const current=()=>users.find(u=>u.email===session);
const persist=()=>{const ref=sessionStorage.getItem('subway-demo-referrer')||localStorage.getItem('subway_ref_code'),candidate=users.at(-1);if(ref&&candidate&&!candidate.referredBy&&candidate.id!==ref){candidate.referredBy=ref;}localStorage.setItem('subway-demo-users',JSON.stringify(users))};
async function hash(password,salt){const bytes=new TextEncoder().encode(salt+password);return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('')}
function toast(text){const el=document.querySelector('#toast');el.textContent=text;el.style.display='block';clearTimeout(window.toastTimer);window.toastTimer=setTimeout(()=>el.style.display='none',3200)}
function renderView(){const user=current();const view=location.hash.slice(1)||'login';if(view!=='depositar'){if(window.activePixPollTimer){clearInterval(window.activePixPollTimer);window.activePixPollTimer=null;}if(window.activePixCountdownTimer){clearInterval(window.activePixCountdownTimer);window.activePixCountdownTimer=null;}}document.querySelector('#account').hidden=!user;nav.hidden=!user;if(!user){renderAuth(view==='cadastro');return}document.querySelectorAll('[data-balance]').forEach(el=>el.textContent=money(user.balance));document.querySelector('.avatar').textContent=user.name.charAt(0).toUpperCase();nav.querySelectorAll('button').forEach(b=>b.classList.toggle('active',b.dataset.view===view));if(['login','cadastro'].includes(view)){location.hash='jogar';return}if(view==='depositar')deposit();else if(view==='sacar')withdraw();else if(view==='indicar')referral();else if(view==='perfil')profile();else home()}
function render(){renderView();if(window.lucide)lucide.createIcons({attrs:{"aria-hidden":"true","stroke-width":1.8}})}
function renderAuth(register){app.innerHTML=`<section class="auth auth-mobile"><div class="auth-art"><img class="auth-logo" src="jogar/assets/preload/splash.png" alt="Subway Surfers"><div class="auth-game-icon"><img src="jogar/assets/images/app-icon-144.png" alt=""></div></div><div class="auth-tabs" role="tablist"><a href="#login" class="${register?'':'active'}">Entrar</a><a href="#cadastro" class="${register?'active':''}">Criar conta</a></div><div class="auth-title"><span class="eyebrow">SUBWAY PAY</span><h1>${register?'Crie sua conta':'Bem-vindo de volta'}</h1><p>${register?'Cadastre-se com seus dados para começar a jogar.':'Entre com sua conta para continuar sua corrida.'}</p></div><form class="card auth-card" id="auth-form">${register?'<label for="name">Nome completo</label><div class="auth-field"><i data-lucide="user-round"></i><input id="name" name="name" autocomplete="name" required minlength="2" maxlength="60" placeholder="Digite seu nome"></div>':''}<label for="email">E-mail</label><div class="auth-field"><i data-lucide="mail"></i><input id="email" name="email" type="email" autocomplete="email" required maxlength="120" placeholder="voce@exemplo.com"></div><label for="password">Senha</label><div class="auth-field"><i data-lucide="lock-keyhole"></i><input id="password" name="password" type="password" autocomplete="${register?'new-password':'current-password'}" required minlength="6" placeholder="Pelo menos 6 caracteres"><button type="button" class="password-toggle" data-target="password" aria-label="Mostrar senha"><i data-lucide="eye"></i></button></div>${register?'<label for="confirm">Confirmar senha</label><div class="auth-field"><i data-lucide="shield-check"></i><input id="confirm" name="confirm" type="password" autocomplete="new-password" required minlength="6" placeholder="Repita sua senha"><button type="button" class="password-toggle" data-target="confirm" aria-label="Mostrar senha"><i data-lucide="eye"></i></button></div>':''}<p class="error" id="auth-error" role="alert"></p><button class="primary auth-submit" type="submit"><i data-lucide="${register?'user-plus':'log-in'}"></i>${register?'Criar minha conta':'Entrar na conta'}</button></form><p class="auth-privacy"><i data-lucide="shield-check"></i> Acesso seguro e oficial Subway Pay.</p></section>`;document.querySelectorAll('.password-toggle').forEach(button=>button.onclick=()=>{const input=document.querySelector('#'+button.dataset.target),show=input.type==='password';input.type=show?'text':'password';button.setAttribute('aria-label',show?'Ocultar senha':'Mostrar senha');button.innerHTML=`<i data-lucide="${show?'eye-off':'eye'}"></i>`;lucide.createIcons({attrs:{"aria-hidden":"true"}})});document.querySelector('#auth-form').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target),email=f.get('email').trim().toLowerCase(),password=f.get('password'),error=document.querySelector('#auth-error'),button=e.target.querySelector('.auth-submit');error.textContent='';button.disabled=true;const origBtnHtml=button.innerHTML;button.innerHTML=`<i data-lucide="loader-2" class="spinIcon"></i> ${register?'Criando conta...':'Entrando...'}`;if(window.lucide)lucide.createIcons();try{if(register){if(password!==f.get('confirm'))throw Error('As senhas precisam ser iguais.');const name=f.get('name').trim();if(name.length<2)throw Error('Informe seu nome completo.');const refCode=localStorage.getItem('subway_ref_code')||sessionStorage.getItem('subway-demo-referrer')||'';const res=await fetch('/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json','X-Game-Origin':'g_subway_pay','X-Game-Id':'g_subway_pay'},body:JSON.stringify({name,email,password,phone:'Não informado',refCode,registeredGame:'g_subway_pay',acquisitionGame:'g_subway_pay',game:'g_subway_pay',gameId:'g_subway_pay'})});const data=await res.json();if(!res.ok){throw Error(data.error||data.message||'Erro ao criar conta na plataforma.');}if(data.token){localStorage.setItem('pg_auth_token',data.token);localStorage.setItem('paygateway_token',data.token);localStorage.setItem('token',data.token);}const serverUser=data.user||{};let existing=users.find(u=>u.email===email);if(existing){existing.id=serverUser.id||existing.id;existing.name=serverUser.name||name;existing.balance=typeof serverUser.balance==='number'?serverUser.balance:0;existing.referralCode=serverUser.referralCode||'';existing.registeredGame='g_subway_pay';}else{users.push({id:serverUser.id||('u_'+Date.now()),email,name:serverUser.name||name,balance:typeof serverUser.balance==='number'?serverUser.balance:0,referralCode:serverUser.referralCode||'',registeredGame:'g_subway_pay'});}persist();}else{const res=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json','X-Game-Origin':'g_subway_pay','X-Game-Id':'g_subway_pay'},body:JSON.stringify({email,password,game:'g_subway_pay',acquisitionGame:'g_subway_pay'})});const data=await res.json();if(!res.ok){throw Error(data.error||data.message||'E-mail ou senha incorretos.');}if(data.token){localStorage.setItem('pg_auth_token',data.token);localStorage.setItem('paygateway_token',data.token);localStorage.setItem('token',data.token);}const serverUser=data.user||{};let existing=users.find(u=>u.email===email);if(existing){existing.id=serverUser.id||existing.id;existing.name=serverUser.name||existing.name;existing.balance=typeof serverUser.balance==='number'?serverUser.balance:existing.balance;existing.referralCode=serverUser.referralCode||existing.referralCode||'';existing.registeredGame='g_subway_pay';}else{users.push({id:serverUser.id||('u_'+Date.now()),email,name:serverUser.name||'Jogador',balance:typeof serverUser.balance==='number'?serverUser.balance:0,referralCode:serverUser.referralCode||'',registeredGame:'g_subway_pay'});}persist();}session=email;localStorage.setItem('subway-demo-session',JSON.stringify(session));location.hash='jogar';render();toast(register?'Conta criada com sucesso! Bem-vindo ao Subway Pay.':'Login realizado com sucesso!')}catch(err){error.textContent=err.message}finally{button.disabled=false;button.innerHTML=origBtnHtml;if(window.lucide)lucide.createIcons();}}}
function home(){const u=current();app.innerHTML=`<section class="layout"><div class="balance"><span class="eyebrow">Seu saldo disponível</span><h1>${money(u.balance)}</h1><div class="actions"><button class="pill gold" data-view="depositar"><i data-lucide="arrow-down-left"></i> Depositar</button><button class="pill" data-view="sacar"><i data-lucide="arrow-up-right"></i> Sacar</button><button class="pill" data-view="indicar"><i data-lucide="users"></i> Indicar</button></div></div><section class="card"><div class="game-cover"><div class="game-cover-copy"><span class="cover-label">CORRIDA OFICIAL</span><h2>Jogando Valente</h2><p>Colete moedas nos trilhos e resgate seu lucro a qualquer momento com Cashout.</p></div><img src="jogar/assets/preload/splash.png" alt="Subway Surfers"></div><div class="badges"><span class="badge"><i data-lucide="target"></i> Meta = 4x</span><span class="badge blue"><i data-lucide="zap"></i> Jogando Valente</span></div><label for="entry">VALOR DE ENTRADA</label><div class="quick"><button data-amount="10">R$10</button><button data-amount="30">R$30</button><button data-amount="60">R$60</button></div><div class="amount"><span>R$</span><input id="entry" aria-label="Valor de entrada" type="number" min="10" max="400" step="1" value="${entry}" inputmode="decimal"></div><div class="stats"><div><span>Meta de ganho</span><strong id="target">${money(entry*4)}</strong></div><div><span>Mín. entrada</span><strong>R$ 10,00</strong></div><div><span>Máx. entrada</span><strong>R$ 400,00</strong></div></div><div class="notice" id="entry-status"></div><button class="primary" id="start-game"></button></section><p class="demo">Multiplique suas moedas e faça o Cashout a qualquer momento nos trilhos.</p></section>`;const input=document.querySelector('#entry');input.oninput=()=>{entry=Number(input.value);document.querySelector('#target').textContent=money(entry*4);updateEntry()};document.querySelectorAll('[data-amount]').forEach(b=>b.onclick=()=>{entry=Number(b.dataset.amount);input.value=entry;input.oninput()});document.querySelector('#start-game').onclick=()=>{if(!Number.isFinite(entry)||entry<10||entry>400){toast('Informe um valor entre R$10 e R$400.');return}const qStr=window.location.search||`?email=${encodeURIComponent(u.email)}&name=${encodeURIComponent(u.name)}&balance=${encodeURIComponent(u.balance)}`;const active=read('subway-demo-round',null);if(active?.status==='active'&&active.email===u.email){toast('Retomando sua corrida.');location.href='jogar/'+qStr;return}if(u.balance<entry){if(window.parent&&window.parent!==window){window.parent.postMessage({event:'deposit',needed:entry},'*');}toast('Saldo insuficiente. Gere um PIX para jogar valente!');location.hash='depositar';return}u.balance=Math.round((u.balance-entry)*100)/100;persist();localStorage.setItem('subway-demo-round',JSON.stringify({id:(crypto.randomUUID?crypto.randomUUID():'rnd_'+Date.now()),email:u.email,entry,status:'active'}));localStorage.setItem('realBetPage','true');location.href='jogar/'+qStr};updateEntry()}
function updateEntry(){const u=current(),valid=Number.isFinite(entry)&&entry>=10&&entry<=400,status=document.querySelector('#entry-status'),button=document.querySelector('#start-game');status.textContent=!valid?'Informe uma entrada entre R$10 e R$400.':u.balance<entry?'Saldo insuficiente para jogar. Gere um PIX para adicionar saldo.':'Entrada confirmada. O valor será debitado ao iniciar a corrida.';button.innerHTML=!valid?'<i data-lucide="sliders-horizontal"></i> Ajustar valor':u.balance<entry?'<i data-lucide="wallet"></i> Gerar PIX':'<i data-lucide="play"></i> Jogando Valente';if(window.lucide)lucide.createIcons({attrs:{"aria-hidden":"true"}})}
function deposit(){
  const u = current();
  const multiplier = value => value === 200 ? 5 : value >= 100 ? 2 : 1;

  if (window.activePixPollTimer) { clearInterval(window.activePixPollTimer); window.activePixPollTimer = null; }
  if (window.activePixCountdownTimer) { clearInterval(window.activePixCountdownTimer); window.activePixCountdownTimer = null; }

  renderDepositForm();

  function renderDepositForm() {
    app.innerHTML = `
      <section class="layout screen deposit-screen">
        <div class="deposit-title">
          <div>
            <span class="eyebrow">CARTEIRA SUBWAY PAY</span>
            <h1>Adicionar saldo via PIX</h1>
          </div>
          <span class="deposit-safe"><i data-lucide="shield-check"></i> PIX Instantâneo Oficial</span>
        </div>

        <div class="deposit-promo">
          <div>
            <span class="promo-label">OFERTA ESPECIAL</span>
            <h2>R$ 200 vira R$ 1.000</h2>
            <p>Escolha R$ 200 e receba cinco vezes o valor em créditos para correr nos trilhos.</p>
          </div>
          <strong>5x</strong>
        </div>

        <div class="card deposit-card">
          <div class="deposit-balance">
            <span>Saldo atual</span>
            <strong>${money(u.balance)}</strong>
          </div>

          <form id="deposit-form">
            <label class="deposit-label">Escolha o valor de recarga</label>
            <div class="deposit-options">
              <button type="button" data-deposit="20"><span>R$ 20</span><small>Valor inicial</small></button>
              <button type="button" data-deposit="30"><span>R$ 30</span><small>Sem bônus</small></button>
              <button type="button" data-deposit="75"><span>R$ 75</span><small>Sem bônus</small></button>
              <button type="button" data-deposit="100" class="selected bonus"><span>R$ 100</span><small>Receba R$ 200</small><b>2x</b></button>
              <button type="button" data-deposit="150" class="bonus"><span>R$ 150</span><small>Receba R$ 300</small><b>2x</b></button>
              <button type="button" data-deposit="200" class="bonus featured"><span>R$ 200</span><small>Receba R$ 1.000</small><b>5x</b></button>
            </div>

            <label for="deposit-value">Outro valor entre R$ 10 e R$ 1.000</label>
            <div class="amount deposit-amount">
              <span>R$</span>
              <input id="deposit-value" name="value" type="number" inputmode="decimal" value="100" min="10" max="1000" step="1" required>
            </div>

            <div class="deposit-summary">
              <div><span>Valor escolhido</span><strong id="deposit-base">R$ 100,00</strong></div>
              <div><span>Bônus aplicado</span><strong id="deposit-bonus">+ R$ 100,00</strong></div>
              <div class="deposit-total"><span>Total a creditar</span><strong id="deposit-credit">R$ 200,00</strong></div>
            </div>

            <p class="deposit-rule" id="deposit-rule"><i data-lucide="sparkles"></i> Bônus 2x aplicado neste valor.</p>
            <p class="error" id="deposit-error" role="alert"></p>

            <button type="submit" class="primary deposit-submit" id="btn-generate-pix">
              <i data-lucide="qr-code"></i>
              <span>Gerar PIX (<strong id="deposit-button-value">R$ 100,00</strong>)</span>
            </button>
          </form>

          <p class="deposit-disclaimer">
            <i data-lucide="shield"></i> Pagamentos processados com segurança instantânea via PIX.
          </p>
        </div>
      </section>
    `;

    const input = document.querySelector('#deposit-value');
    const error = document.querySelector('#deposit-error');

    function update() {
      const value = Number(input.value);
      const valid = Number.isFinite(value) && value >= 10 && value <= 1000;
      const m = valid ? multiplier(value) : 1;
      const credit = valid ? value * m : 0;
      const bonus = valid ? credit - value : 0;

      document.querySelector('#deposit-base').textContent = valid ? money(value) : '—';
      document.querySelector('#deposit-bonus').textContent = valid ? '+ ' + money(bonus) : '—';
      document.querySelector('#deposit-credit').textContent = valid ? money(credit) : '—';
      document.querySelector('#deposit-button-value').textContent = valid ? money(value) : 'valor';

      const rule = document.querySelector('#deposit-rule');
      rule.innerHTML = m === 5 ? '<i data-lucide="sparkles"></i> Oferta especial 5x aplicada!' : m === 2 ? '<i data-lucide="sparkles"></i> Bônus 2x aplicado neste valor.' : '<i data-lucide="circle-check"></i> Valor creditado sem bônus.';
      error.textContent = valid ? '' : 'Informe um valor entre R$ 10 e R$ 1.000.';

      document.querySelectorAll('[data-deposit]').forEach(b => b.classList.toggle('selected', Number(b.dataset.deposit) === value));
      if (window.lucide) lucide.createIcons({ attrs: { "aria-hidden": "true" } });
    }

    document.querySelectorAll('[data-deposit]').forEach(b => b.onclick = () => {
      input.value = b.dataset.deposit;
      update();
    });

    input.oninput = update;

    document.querySelector('#deposit-form').onsubmit = async (e) => {
      e.preventDefault();
      const value = Number(input.value);
      if (!Number.isFinite(value) || value < 10 || value > 1000) {
        error.textContent = 'Informe um valor entre R$ 10 e R$ 1.000.';
        return;
      }

      const btn = document.querySelector('#btn-generate-pix');
      btn.disabled = true;
      btn.innerHTML = `<i data-lucide="loader-2" class="spinIcon"></i> Gerando PIX...`;
      if (window.lucide) lucide.createIcons();

      const customerName = u.name || 'Jogador Subway Pay';
      const customerCpf = '';
      const customerPhone = '';

      const token = localStorage.getItem('pg_auth_token') || localStorage.getItem('paygateway_token') || localStorage.getItem('token') || '';

      try {
        const payload = {
          amount: value,
          value: value,
          token: token,
          userId: u.id,
          customer: {
            name: customerName,
            email: u.email,
            cpf: customerCpf,
            taxID: customerCpf,
            phone: customerPhone
          }
        };

        const res = await fetch('/api/game/subway-pay/pix/create', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          },
          body: JSON.stringify(payload)
        });

        const json = await res.json();
        if (!res.ok || !json.data) {
          throw new Error(json.message || json.error || 'Erro ao gerar cobrança PIX');
        }

        const charge = json.data;
        renderPixCheckout(charge, value, multiplier(value));
      } catch (err) {
        console.error('Erro ao gerar PIX:', err);
        error.textContent = 'Falha ao gerar cobrança PIX: ' + (err.message || 'Tente novamente.');
        btn.disabled = false;
        btn.innerHTML = `<i data-lucide="qr-code"></i><span>Gerar PIX (<strong id="deposit-button-value">${money(value)}</strong>)</span>`;
        if (window.lucide) lucide.createIcons();
      }
    };

    update();
  }

  function renderPixCheckout(charge, depositValue, mult) {
    const correlationID = charge.correlationID || charge.correlationId;
    const qrCode = charge.qrCode || charge.brCode || '';
    const qrImg = charge.qrCodeImage || `https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=0&data=${encodeURIComponent(qrCode)}`;
    const totalCredit = depositValue * mult;

    let secondsLeft = 15 * 60; // 15 minutos

    app.innerHTML = `
      <section class="layout screen deposit-screen">
        <div class="deposit-title">
          <div>
            <span class="eyebrow">PAGAMENTO PIX</span>
            <h1>Aguardando pagamento</h1>
          </div>
          <span class="deposit-safe"><i data-lucide="shield-check"></i> Seguro e Instantâneo</span>
        </div>

        <div class="pix-checkout-box">
          <div class="pix-status-pill" id="pix-status-pill">
            <span class="pix-pulse-dot"></span>
            <span id="pix-status-text">Aguardando pagamento no banco...</span>
          </div>

          <div class="pix-qr-wrapper">
            <img src="${qrImg}" alt="QR Code PIX" class="pix-qr-img" id="pix-qr-element">
          </div>

          <div class="pix-meta-row">
            <div>
              <span>Valor a pagar</span>
              <strong>${money(depositValue)}</strong>
              ${mult > 1 ? `<small style="display:block;color:#ffd66b;font-size:11px;font-weight:700">Crédito total: ${money(totalCredit)} (${mult}x)</small>` : ''}
            </div>
            <div>
              <span>Expira em</span>
              <strong class="timer-val" id="pix-timer">15:00</strong>
            </div>
          </div>

          <div class="pix-copy-box">
            <div class="pix-copy-label">
              <span>PIX Copia e Cola</span>
              <small>Clique para copiar</small>
            </div>
            <div class="pix-copy-row">
              <input type="text" readonly value="${escape(qrCode)}" class="pix-copy-input" id="pix-copy-input">
              <button type="button" class="pix-btn-copy" id="btn-copy-pix">
                <i data-lucide="copy"></i>
                <span id="btn-copy-text">Copiar código</span>
              </button>
            </div>
          </div>

          <div class="pix-actions-grid">
            <button type="button" class="pix-btn-action" id="btn-check-pix">
              <i data-lucide="refresh-cw"></i>
              <span>Verificar pagamento</span>
            </button>
            <button type="button" class="pix-btn-action pix-btn-back" id="btn-cancel-pix">
              <i data-lucide="arrow-left"></i>
              <span>Escolher outro valor</span>
            </button>
          </div>
        </div>
      </section>
    `;

    if (window.lucide) lucide.createIcons();

    // Copy PIX button
    const copyBtn = document.querySelector('#btn-copy-pix');
    const copyInput = document.querySelector('#pix-copy-input');
    copyBtn.onclick = async () => {
      try {
        await navigator.clipboard.writeText(qrCode);
      } catch (_) {
        copyInput.select();
        document.execCommand('copy');
      }
      copyBtn.classList.add('copied');
      copyBtn.innerHTML = `<i data-lucide="check"></i><span>Copiado!</span>`;
      if (window.lucide) lucide.createIcons();
      toast('Código PIX copiado com sucesso!');
      setTimeout(() => {
        copyBtn.classList.remove('copied');
        copyBtn.innerHTML = `<i data-lucide="copy"></i><span>Copiar código</span>`;
        if (window.lucide) lucide.createIcons();
      }, 3000);
    };

    // Countdown timer
    window.activePixCountdownTimer = setInterval(() => {
      secondsLeft--;
      if (secondsLeft <= 0) {
        clearInterval(window.activePixCountdownTimer);
        const t = document.querySelector('#pix-timer');
        if (t) t.textContent = 'Expirado';
        return;
      }
      const mins = Math.floor(secondsLeft / 60);
      const secs = secondsLeft % 60;
      const el = document.querySelector('#pix-timer');
      if (el) el.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }, 1000);

    // Cancel / Return button
    document.querySelector('#btn-cancel-pix').onclick = () => {
      if (window.activePixPollTimer) clearInterval(window.activePixPollTimer);
      if (window.activePixCountdownTimer) clearInterval(window.activePixCountdownTimer);
      renderDepositForm();
    };

    // Check status function
    let isApproved = false;
    async function checkPixStatus(manual = false) {
      if (isApproved) return;
      const checkBtn = document.querySelector('#btn-check-pix');

      if (manual && checkBtn) {
        checkBtn.disabled = true;
        checkBtn.innerHTML = `<i data-lucide="loader-2" class="spinIcon"></i> Verificando...`;
        if (window.lucide) lucide.createIcons();
      }

      try {
        const res = await fetch(`/api/game/subway-pay/pix/status/${correlationID}`);
        if (res.ok) {
          const json = await res.json();
          const paid = json.paid === true || json.status === 'PAID' || json.status === 'COMPLETED';
          if (paid) {
            handleApprovedDeposit(totalCredit);
            return;
          }
        }
        if (manual) toast('Pagamento ainda não detectado. Aguarde alguns segundos após pagar no banco.');
      } catch (err) {
        console.warn('Erro ao consultar status:', err);
      } finally {
        if (manual && checkBtn) {
          checkBtn.disabled = false;
          checkBtn.innerHTML = `<i data-lucide="refresh-cw"></i><span>Verificar pagamento</span>`;
          if (window.lucide) lucide.createIcons();
        }
      }
    }

    // Manual check
    document.querySelector('#btn-check-pix').onclick = () => checkPixStatus(true);

    // Auto-polling every 3 seconds
    window.activePixPollTimer = setInterval(() => {
      checkPixStatus(false);
    }, 3000);

    function handleApprovedDeposit(creditAmount) {
      if (isApproved) return;
      isApproved = true;
      if (window.activePixPollTimer) clearInterval(window.activePixPollTimer);
      if (window.activePixCountdownTimer) clearInterval(window.activePixCountdownTimer);

      // Play chime
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(587.33, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.5);
      } catch (_) {}

      // Update balance
      u.balance = Math.round((u.balance + creditAmount) * 100) / 100;
      persist();

      // Notify parent frame (SubwayPayPlayerView / Host)
      try {
        window.parent.postMessage({
          source: 'subway-pay-shell',
          event: 'balance',
          balance: u.balance
        }, '*');
        window.parent.postMessage({
          source: 'subway-pay-shell',
          event: 'deposit_success',
          amount: creditAmount,
          balance: u.balance
        }, '*');
      } catch (_) {}

      renderSuccessScreen(creditAmount);
    }
  }

  function renderSuccessScreen(creditAmount) {
    app.innerHTML = `
      <section class="layout screen deposit-screen">
        <div class="pix-success-card">
          <div class="pix-success-icon">
            <i data-lucide="check" style="width:38px;height:38px"></i>
          </div>
          <h2>Depósito Confirmado!</h2>
          <p>
            Recebemos seu pagamento via PIX. <strong>${money(creditAmount)}</strong> foram creditados instantaneamente no seu saldo.
          </p>
          <div style="font-size:14px;color:#ffd66b;font-weight:800;background:rgba(255,214,107,0.1);padding:8px 16px;border-radius:12px;border:1px solid rgba(255,214,107,0.25)">
            Novo saldo disponível: ${money(u.balance)}
          </div>
          <button type="button" class="primary" id="btn-go-run" style="max-width:320px">
            <i data-lucide="play"></i>
            <span>Correr nos Trilhos</span>
          </button>
          <button type="button" class="secondary" id="btn-go-home" style="max-width:320px;margin-top:0">
            <span>Voltar ao painel</span>
          </button>
        </div>
      </section>
    `;

    if (window.lucide) lucide.createIcons();

    document.querySelector('#btn-go-run').onclick = () => {
      location.href = 'jogar/';
    };
    document.querySelector('#btn-go-home').onclick = () => {
      location.hash = 'jogar';
    };
  }
}
function withdraw(){const u=current(),isWithdrawLocked=Boolean(u.withdrawBlocked||u.hasAffiliateDemoBalance),history=read('subway-demo-withdrawals',[]).filter(item=>item.email===u.email).slice(-3).reverse();app.innerHTML=`<section class="layout screen withdraw-screen"><div class="withdraw-title"><span class="eyebrow">CARTEIRA SUBWAY PAY</span><h1>Sacar saldo</h1><p>Informe o valor e sua chave PIX para receber seus ganhos.</p></div>${isWithdrawLocked?`<div class="card" style="background:#fff1f2;border:1px solid #fecdd3;color:#9f1239;padding:12px;margin-bottom:12px;border-radius:12px;font-size:13px;line-height:1.4;"><strong style="display:block;margin-bottom:4px;">🔒 Saques Bloqueados</strong>Esta conta possui saldo de demonstração concedido por afiliado e não possui permissão para realizar saques.</div>`:''}<div class="withdraw-balance"><div><span>Saldo disponível</span><strong>${money(u.balance)}</strong><small>Valor mínimo para saque: R$ 20,00</small></div><i data-lucide="landmark"></i></div><div class="card withdraw-card"><form id="withdraw-form"><label>Escolha o valor</label><div class="withdraw-options"><button type="button" data-withdraw="20" ${isWithdrawLocked||u.balance<20?'disabled':''}>R$ 20</button><button type="button" data-withdraw="50" ${isWithdrawLocked||u.balance<50?'disabled':''}>R$ 50</button><button type="button" data-withdraw="100" ${isWithdrawLocked||u.balance<100?'disabled':''}>R$ 100</button><button type="button" data-withdraw="all" ${isWithdrawLocked||u.balance<20?'disabled':''}>Todo saldo</button></div><label for="withdraw-value">Valor do saque</label><div class="amount withdraw-amount"><span>R$</span><input id="withdraw-value" name="value" type="number" inputmode="decimal" min="20" max="${u.balance}" step="1" value="${!isWithdrawLocked&&u.balance>=20?Math.min(20,u.balance):''}" ${isWithdrawLocked?'disabled':''} required></div><div class="pix-fields"><div><label for="pix-type">Tipo de chave</label><select id="pix-type" name="pixType" ${isWithdrawLocked?'disabled':''}><option value="cpf">CPF</option><option value="email">E-mail</option><option value="phone">Celular</option><option value="random">Chave aleatória</option></select></div><div><label for="pix-key">Chave PIX</label><input id="pix-key" name="pixKey" autocomplete="off" placeholder="Digite sua chave PIX" ${isWithdrawLocked?'disabled':''} required maxlength="120"></div></div><div class="withdraw-summary"><span>Valor da solicitação</span><strong id="withdraw-total">${!isWithdrawLocked&&u.balance>=20?money(Math.min(20,u.balance)):'—'}</strong></div><p class="error" id="withdraw-error" role="alert">${isWithdrawLocked?'Esta conta possui saldo de demonstração de afiliado e está bloqueada para saques.':''}</p><button class="primary withdraw-submit" ${isWithdrawLocked||u.balance<20?'disabled':''}><i data-lucide="arrow-up-right"></i> Solicitar saque via PIX</button></form><p class="withdraw-disclaimer"><i data-lucide="shield-check"></i> Transferências PIX automáticas para a sua chave informada.</p></div>${history.length?`<section class="withdraw-history"><h2>Solicitações recentes</h2>${history.map(item=>`<div><span><i data-lucide="clock-3"></i>${new Date(item.createdAt).toLocaleDateString('pt-BR')}</span><strong>${money(item.value)}</strong><small>Processando · PIX Instantâneo</small></div>`).join('')}</section>`:''}</section>`;const input=document.querySelector('#withdraw-value'),error=document.querySelector('#withdraw-error'),total=document.querySelector('#withdraw-total');function update(){if(isWithdrawLocked){error.textContent='Esta conta possui saldo concedido por afiliado e não pode realizar saques.';return}const value=Number(input.value),valid=Number.isFinite(value)&&value>=20&&value<=u.balance;total.textContent=valid?money(value):'—';error.textContent=!Number.isFinite(value)||value<20?'O saque mínimo é R$ 20,00.':value>u.balance?'O valor ultrapassa seu saldo disponível.':'';document.querySelectorAll('[data-withdraw]').forEach(button=>button.classList.toggle('selected',button.dataset.withdraw==='all'?value===u.balance:Number(button.dataset.withdraw)===value))}document.querySelectorAll('[data-withdraw]').forEach(button=>button.onclick=()=>{if(isWithdrawLocked)return;input.value=button.dataset.withdraw==='all'?u.balance:button.dataset.withdraw;update()});input.oninput=update;document.querySelector('#withdraw-form').onsubmit=e=>{e.preventDefault();if(isWithdrawLocked){error.textContent='Operação não autorizada: contas com saldo de demonstração de afiliado não podem realizar saques.';toast('Saques bloqueados para esta conta.');return;}const value=Number(input.value),pixKey=e.target.elements.pixKey.value.trim();if(!Number.isFinite(value)||value<20){error.textContent='O saque mínimo é R$ 20,00.';return}if(value>u.balance){error.textContent='O valor ultrapassa seu saldo disponível.';return}if(pixKey.length<4){error.textContent='Informe uma chave PIX válida.';return}u.balance=Math.round((u.balance-value)*100)/100;const requests=read('subway-demo-withdrawals',[]);requests.push({id:crypto.randomUUID(),email:u.email,value,pixType:e.target.elements.pixType.value,pixKey,createdAt:new Date().toISOString(),status:'pending'});localStorage.setItem('subway-demo-withdrawals',JSON.stringify(requests));persist();withdraw();if(window.lucide)lucide.createIcons({attrs:{"aria-hidden":"true"}});toast('Solicitação de saque de '+money(value)+' enviada com sucesso!')}}
function referral(){const u=current(),refCodeVal=u.referralCode||u.id,link=location.origin+'/subwaypay/?ref='+encodeURIComponent(refCodeVal),code=String(refCodeVal).replaceAll('-','').slice(0,8).toUpperCase(),shareKey='subway-demo-referral-shares:'+u.id,shares=Number(read(shareKey,0))||0,invited=users.filter(user=>user.referredBy===u.id||user.referredBy===u.referralCode);app.innerHTML=`<section class="layout screen referral-screen"><div class="referral-hero"><div><span class="eyebrow">PROGRAMA DE CONVITES</span><h1>Convide seus amigos</h1><p>Compartilhe seu link pessoal e ganhe bônus em cada indicação.</p></div><i data-lucide="users-round"></i></div><div class="referral-stats"><div><span>Compartilhamentos</span><strong id="share-count">${shares}</strong></div><div><span>Cadastros ativos</span><strong>${invited.length}</strong></div><div><span>Seu código</span><strong>${code}</strong></div></div><div class="card referral-card"><label for="referral">Seu link de indicação</label><div class="referral-link"><input id="referral" readonly value="${escape(link)}"><button id="copy-link" aria-label="Copiar link"><i data-lucide="copy"></i></button></div><div class="referral-actions"><button class="primary" id="share-whatsapp"><i data-lucide="message-circle"></i> Compartilhar no WhatsApp</button><button class="secondary" id="share-native"><i data-lucide="share-2"></i> Outras opções</button></div><p class="referral-note">Convide seus amigos para correr no Subway Pay e multiplique seus ganhos na plataforma.</p></div><section class="referral-steps"><h2>Como funciona</h2><div><span>1</span><p><strong>Compartilhe</strong>Envie seu link para um amigo.</p></div><div><span>2</span><p><strong>Cadastro</strong>Ele abre o link e cria uma conta oficial.</p></div><div><span>3</span><p><strong>Acompanhe</strong>Veja seus convites ativos nesta tela.</p></div></section>${invited.length?`<section class="referral-list"><h2>Cadastros recentes</h2>${invited.slice(-3).reverse().map(user=>`<div><span>${escape(user.name.charAt(0).toUpperCase())}</span><p><strong>${escape(user.name)}</strong><small>Conta oficial ativa</small></p><i data-lucide="circle-check"></i></div>`).join('')}</section>`:`<div class="referral-empty"><i data-lucide="user-plus"></i><strong>Nenhum cadastro ainda</strong><span>Seus convites aparecerão aqui.</span></div>`}</section>`;function record(){const total=(Number(read(shareKey,0))||0)+1;localStorage.setItem(shareKey,JSON.stringify(total));document.querySelector('#share-count').textContent=total}document.querySelector('#copy-link').onclick=async()=>{try{await navigator.clipboard.writeText(link);record();toast('Link de indicação copiado.')}catch{document.querySelector('#referral').select();toast('Selecione e copie o link.')}};document.querySelector('#share-whatsapp').onclick=()=>{record();window.open('https://wa.me/?text='+encodeURIComponent('Venha correr no Subway Pay Oficial: '+link),'_blank','noopener')};document.querySelector('#share-native').onclick=async()=>{if(navigator.share){try{await navigator.share({title:'Subway Pay Oficial',text:'Venha correr no Subway Pay',url:link});record()}catch{}}else{try{await navigator.clipboard.writeText(link);record();toast('Link copiado para compartilhar.')}catch{toast('Use o botão de copiar link.')}}}}
function profile(){const u=current();app.innerHTML=`<section class="layout screen"><h1>Meu perfil</h1><div class="card"><h2>${escape(u.name)}</h2><div class="profile-row"><small>E-mail</small>${escape(u.email)}</div><div class="profile-row"><small>Saldo disponível</small>${money(u.balance)}</div><p class="muted">Conta oficial Subway Pay ativa e verificada.</p><button class="secondary" id="logout"><i data-lucide="log-out"></i> Sair da conta</button></div></section>`;document.querySelector('#logout').onclick=()=>{session=null;localStorage.removeItem('subway-demo-session');localStorage.removeItem('pg_auth_token');localStorage.removeItem('paygateway_token');localStorage.removeItem('token');location.hash='login';render();toast('Você saiu da sua conta.')}}
document.addEventListener('click',e=>{const b=e.target.closest('[data-view]');if(b)location.hash=b.dataset.view});
window.addEventListener('hashchange',render);
if(location.hash.startsWith('#cadastro?')){const ref=new URLSearchParams(location.hash.split('?')[1]).get('ref');if(ref)sessionStorage.setItem('subway-demo-referrer',ref);location.hash='cadastro'}
window.addEventListener('message',e=>{
  try{
    if(!e.data)return;
    if(e.data.source==='tribopay-parent'||e.data.event==='session'){
      const u=current();
      if(u&&typeof e.data.balance==='number'){
        u.balance=e.data.balance;
        persist();
        renderView();
      } else if (e.data.user && e.data.user.email) {
        let existing = users.find(x => x.email === e.data.user.email.toLowerCase().trim());
        if (!existing) {
          existing = {
            id: e.data.user.id || ('u_' + Date.now()),
            email: e.data.user.email.toLowerCase().trim(),
            name: e.data.user.name || 'Jogador',
            balance: typeof e.data.balance === 'number' ? e.data.balance : 100
          };
          users.push(existing);
        } else if (typeof e.data.balance === 'number') {
          existing.balance = e.data.balance;
        }
        session = existing.email;
        persist();
        renderView();
      }
    }
  }catch(_){}
});
render();
