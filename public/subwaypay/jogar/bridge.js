'use strict';
(()=>{
const read=(key,other)=>{try{return JSON.parse(localStorage.getItem(key))??other}catch{return other}};

// Ensure tutorial is marked as completed
try {
  let userSettings = JSON.parse(localStorage.getItem('UserSettings') || '{}');
  userSettings.tutorial = true;
  localStorage.setItem('UserSettings', JSON.stringify(userSettings));
} catch (_) {}

// Sync session and enforce authentication
const urlParams = new URLSearchParams(window.location.search);
const queryEmail = urlParams.get('email');
const queryName = urlParams.get('name');
const queryBalance = parseFloat(urlParams.get('balance') || '');

let sessionEmail = read('subway-demo-session', null) || (queryEmail ? queryEmail.toLowerCase().trim() : null);
if (sessionEmail === 'jogador@subwaypay.site') {
  sessionEmail = null;
  localStorage.removeItem('subway-demo-session');
}

let users = read('subway-demo-users', []).filter(u => u.email !== 'jogador@subwaypay.site');
localStorage.setItem('subway-demo-users', JSON.stringify(users));

let user = sessionEmail ? users.find(u => u.email === sessionEmail) : null;

// If queryEmail came from platform but not yet in local users list, register session
if (!user && queryEmail) {
  user = {
    id: 'u_' + Date.now(),
    email: queryEmail.toLowerCase().trim(),
    name: queryName || 'Jogador',
    balance: !isNaN(queryBalance) && queryBalance >= 0 ? queryBalance : 100
  };
  users.push(user);
  localStorage.setItem('subway-demo-users', JSON.stringify(users));
  localStorage.setItem('subway-demo-session', JSON.stringify(user.email));
  sessionEmail = user.email;
}

// Fallback session if not present, preventing any unwanted redirect loops
if (!user) {
  user = {
    id: 'u_' + Date.now(),
    email: sessionEmail || 'jogador@hub.com',
    name: queryName || 'Jogador',
    balance: !isNaN(queryBalance) && queryBalance >= 0 ? queryBalance : 100
  };
  users.push(user);
  localStorage.setItem('subway-demo-users', JSON.stringify(users));
  localStorage.setItem('subway-demo-session', JSON.stringify(user.email));
  sessionEmail = user.email;
}

window.addEventListener('message', (event) => {
  if (!event.data) return;
  if (event.data.source === 'tribopay-parent' || event.data.event === 'session') {
    const parentBal = parseFloat(event.data.balance);
    const pEmail = event.data.user?.email || event.data.email;
    const pName = event.data.user?.name || event.data.name;
    if (pEmail) {
      sessionEmail = pEmail.toLowerCase().trim();
      let u = users.find(x => x.email === sessionEmail);
      if (!u) {
        u = { id: 'u_' + Date.now(), email: sessionEmail, name: pName || 'Jogador', balance: !isNaN(parentBal) && parentBal >= 0 ? parentBal : 100 };
        users.push(u);
      } else if (!isNaN(parentBal) && parentBal >= 0) {
        u.balance = parentBal;
      }
      localStorage.setItem('subway-demo-users', JSON.stringify(users));
      localStorage.setItem('subway-demo-session', JSON.stringify(sessionEmail));
      user = u;
    }
  }
});

let round = read('subway-demo-round', null);
if (!round || round.status !== 'active' || round.email !== sessionEmail) {
  round = {
    id: (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'rnd_' + Date.now()),
    email: sessionEmail,
    entry: 10,
    status: 'active'
  };
  localStorage.setItem('subway-demo-round', JSON.stringify(round));
}

let finished = false, engine = null, getCoins = () => 0, cashoutUnlocked = false;
const cash = document.querySelector('#cashout');
const dialog = document.querySelector('#result');
const note = document.querySelector('#cashout-note');
const hudTarget = document.querySelector('#hud-target');
const hudValue = document.querySelector('#hud-value');
const hudScore = document.querySelector('#hud-score');

const money = n => Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function getSubwayTargetMultiplier() {
  const cfg = window.SubwayConfig || (typeof SubwayRound !== 'undefined' && SubwayRound.config) || {};
  return Number(cfg.maxMultiplier) || 5;
}
function getSubwayCashoutMultiplier() {
  const cfg = window.SubwayConfig || (typeof SubwayRound !== 'undefined' && SubwayRound.config) || {};
  return Number(cfg.minCashoutMultiplier) || 1.5;
}
function syncSubwayHud() {
  const targetM = getSubwayTargetMultiplier();
  const cashoutM = getSubwayCashoutMultiplier();
  if (hudTarget) hudTarget.textContent = money(round.entry * targetM);
  if (note && !cashoutUnlocked) {
    note.textContent = 'Cashout libera ao atingir ' + cashoutM + 'x (' + money(round.entry * cashoutM) + '). Meta de 5x (' + money(round.entry * targetM) + ').';
  }
}
syncSubwayHud();

try {
  fetch('/api/game/subway-pay/config')
    .then(r => r.ok ? r.json() : null)
    .then(cfg => {
      if (cfg) {
        window.SubwayConfig = cfg;
        if (typeof SubwayRound !== 'undefined') SubwayRound.config = cfg;
        syncSubwayHud();
      }
    })
    .catch(() => {});
} catch (_) {}

if (hudValue) hudValue.textContent = money(0);

function finish(outcome) {
  const coinsNow = Math.max(0, Number(getCoins ? getCoins() : (engine?.stats?.coins || 0)) || 0);
  const isTargetCompleted = coinsNow >= 80 || (typeof SubwayRound !== 'undefined' && SubwayRound.payout(round.entry, coinsNow) >= round.entry * 5.0);
  if (finished || (outcome === 'cashout' && !cashoutUnlocked && !isTargetCompleted)) return;
  const stored = read('subway-demo-round', null);
  if (!stored || stored.id !== round.id || stored.status !== 'active') return;
  const currUsers = read('subway-demo-users', []);
  const gameInst = engine || window.SubwayGame;
  const coins = Math.max(0, Number(getCoins ? getCoins() : (gameInst?.stats?.coins || 0)) || 0);
  if (typeof SubwayRound !== 'undefined' && !SubwayRound.settle(stored, currUsers, outcome, coins)) return;
  finished = true;
  round = stored;
  gameInst?.pause?.();
  localStorage.setItem('subway-demo-users', JSON.stringify(currUsers));
  localStorage.setItem('subway-demo-round', JSON.stringify(round));

  // Notify server to settle run & record loss or cashout
  try {
    const token = localStorage.getItem('pg_auth_token') || localStorage.getItem('paygateway_token') || localStorage.getItem('token');
    fetch('/api/game/subway-pay/settle', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        'X-Session-Email': round.email
      },
      body: JSON.stringify({
        betId: round.betId || round.id,
        outcome: outcome,
        coins: coins,
        entry: round.entry,
        payout: round.payout,
        email: round.email,
        token: token
      })
    }).then(r => r.json()).then(data => {
      if (data && typeof data.balance === 'number') {
        const u = currUsers.find(x => x.email === round.email);
        if (u) {
          u.balance = data.balance;
          localStorage.setItem('subway-demo-users', JSON.stringify(currUsers));
        }
        if (window.parent && window.parent !== window) {
          window.parent.postMessage({
            source: 'subway-pay-shell',
            event: 'balance',
            balance: data.balance,
            outcome: outcome,
            round: round
          }, '*');
        }
      }
    }).catch(err => console.warn('Subway settle error:', err));
  } catch (_) {}

  // Notify parent window (iframe container)
  try {
    const activeU = currUsers.find(u => u.email === round.email);
    if (activeU && window.parent && window.parent !== window) {
      window.parent.postMessage({
        source: 'subway-pay-shell',
        event: 'balance',
        balance: activeU.balance,
        outcome: outcome,
        round: round
      }, '*');
    }
  } catch (_) {}

  if (cash) { cash.disabled = true; cash.hidden = true; }
  if (note) note.hidden = true;
  const resTitle = document.querySelector('#result-title');
  const resIcon = document.querySelector('#result-icon');
  const resVal = document.querySelector('#result-value');
  const resDet = document.querySelector('#result-detail');
  if (resTitle) resTitle.textContent = outcome === 'loss' ? 'Você perdeu' : outcome === 'win' ? 'Você ganhou!' : 'Cashout realizado!';
  if (resIcon) resIcon.setAttribute('data-lucide', outcome === 'loss' ? 'heart-crack' : 'trophy');
  if (resVal) resVal.textContent = outcome === 'loss' ? ('-' + money(round.entry)) : money(round.payout || round.entry);
  if (resDet) resDet.textContent = outcome === 'loss' ? 'A corrida terminou. Sua entrada foi consumida do saldo.' : 'Parabéns! Valor creditado instantaneamente no seu saldo.';

  const retryBtn = document.querySelector('#result-retry');
  if (retryBtn) {
    const activeU = currUsers.find(u => u.email === round.email);
    if (!activeU || activeU.balance < round.entry || activeU.balance <= 0) {
      retryBtn.innerHTML = '<i data-lucide="wallet"></i> Depositar agora';
      retryBtn.onclick = (e) => {
        e.preventDefault();
        try { sessionStorage.setItem('subway_needed_deposit', String(round.entry)); } catch (_) {}
        location.href = '../#depositar';
      };
    }
  }

  if (dialog && typeof dialog.showModal === 'function') {
    dialog.showModal();
  }
  if (window.lucide) lucide.createIcons();
  document.querySelector('#result-home')?.focus();
}

let rtpProtectionsUsed = 0;
window.SubwayBridge = {
  value(coins) {
    if (typeof SubwayRound !== 'undefined') {
      return SubwayRound.payout(round.entry, Math.max(0, Number(coins) || 0));
    }
    return round.entry;
  },
  attach(game, coins) {
    if (finished) { game.pause?.(); return; }
    engine = game;
    getCoins = coins;
    if (cash) { cash.disabled = true; cash.hidden = true; }

    const cfg = window.SubwayConfig || (typeof SubwayRound !== 'undefined' && SubwayRound.config) || {};
    const rtp = typeof cfg.rtpPercent === 'number' ? cfg.rtpPercent : 96.0;
    const isHard = rtp < 75.0 || cfg.difficulty === 'hard' || cfg.difficulty === 'heavy' || cfg.difficulty === 'extreme';

    // Apply speed and difficulty directly to game engine
    try {
      if (typeof window !== 'undefined') {
        window.globalDifficulty = isHard ? 'B1C4' : (rtp >= 90 ? 'B1C2' : 'B1C3');
      }
      if (engine && engine.stats && engine.stats.data && engine.stats.data.baseSpeed) {
        engine.stats.data.baseSpeed.min = isHard ? 250 : (rtp >= 90 ? 120 : 180);
        engine.stats.data.baseSpeed.max = isHard ? 380 : 320;
      }
    } catch (_) {}

    // Live refresh config from backend
    try {
      fetch('/api/game/subway-pay/config')
        .then(r => r.ok ? r.json() : null)
        .then(freshCfg => {
          if (freshCfg) {
            window.SubwayConfig = freshCfg;
            if (typeof SubwayRound !== 'undefined') SubwayRound.config = freshCfg;
            const freshRtp = typeof freshCfg.rtpPercent === 'number' ? freshCfg.rtpPercent : rtp;
            const freshIsHard = freshRtp < 75.0 || freshCfg.difficulty === 'hard' || freshCfg.difficulty === 'heavy' || freshCfg.difficulty === 'extreme';
            if (engine?.stats?.data?.baseSpeed) {
              engine.stats.data.baseSpeed.min = freshIsHard ? 250 : (freshRtp >= 90 ? 120 : 180);
              engine.stats.data.baseSpeed.max = freshIsHard ? 380 : 320;
            }
            syncSubwayHud();
          }
        })
        .catch(() => {});
    } catch (_) {}

    if (note) {
      const minM = getSubwayCashoutMultiplier();
      const targetM = getSubwayTargetMultiplier();
      note.textContent = 'Cashout libera em ' + minM + 'x (' + money(round.entry * minM) + '). Meta 5x (' + money(round.entry * targetM) + ').';
    }
  },
  lose() {
    const cfg = window.SubwayConfig || (typeof SubwayRound !== 'undefined' && SubwayRound.config) || {};
    const rtp = typeof cfg.rtpPercent === 'number' ? cfg.rtpPercent : 96.0;
    const isHard = rtp < 75.0 || cfg.difficulty === 'hard' || cfg.difficulty === 'heavy' || cfg.difficulty === 'extreme';
    const coinsNow = Math.max(0, Number(getCoins ? getCoins() : (engine?.stats?.coins || 0)) || 0);
    const canCashout = (typeof SubwayRound !== 'undefined') ? SubwayRound.canCashout(round.entry, coinsNow) : (coinsNow >= 10);

    // Dynamic RTP Stumble Protection:
    // Only granted in EASY / MEDIUM modes (RTP >= 85% and NOT in hard/extreme mode).
    // If the admin sets DIFFICULT, NO second chances or shields are granted.
    const maxShields = (!isHard && rtp >= 95) ? 2 : ((!isHard && rtp >= 85) ? 1 : 0);
    if (!finished && !canCashout && rtpProtectionsUsed < maxShields && (Math.random() * 100 < rtp)) {
      rtpProtectionsUsed++;
      try {
        if (engine && typeof engine.resume === 'function') engine.resume();
      } catch (_) {}
      if (note) {
        note.hidden = false;
        note.style.color = '#10b981';
        note.style.fontWeight = 'bold';
        note.textContent = '🛡️ ESCUDO RTP ATIVADO! Corrida protegida pelo sistema.';
        setTimeout(() => {
          if (!finished && note) {
            note.style.color = '';
            note.style.fontWeight = '';
            const minM = getSubwayCashoutMultiplier();
            const targetM = getSubwayTargetMultiplier();
            note.textContent = 'Cashout libera em ' + minM + 'x (' + money(round.entry * minM) + '). Meta 5x (' + money(round.entry * targetM) + ').';
          }
        }, 2200);
      }
      return;
    }
    finish('loss');
  }
};

if (cash) {
  cash.onclick = () => { if (!finished && cashoutUnlocked) finish('cashout'); };
}

document.querySelector('#leave')?.addEventListener('click', () => {
  if (finished) {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ event: 'exit' }, '*');
    }
    location.href = '../#jogar';
    return;
  }
  document.querySelector('#leave-dialog')?.showModal?.();
});

document.querySelector('#stay')?.addEventListener('click', () => {
  document.querySelector('#leave-dialog')?.close?.();
});

document.querySelector('#confirm-leave')?.addEventListener('click', () => {
  document.querySelector('#leave-dialog')?.close?.();
  finish('loss');
});

dialog?.addEventListener('cancel', e => e.preventDefault());

document.querySelector('#result-home')?.addEventListener('click', () => {
  if (window.parent && window.parent !== window) {
    window.parent.postMessage({ event: 'exit' }, '*');
  }
  location.href = '../#jogar';
});

document.querySelector('#result-retry')?.addEventListener('click', async () => {
  const currUsers = read('subway-demo-users', []);
  const activeU = currUsers.find(u => u.email === sessionEmail);
  const entryVal = (round && round.entry) || 10;
  if (!activeU || activeU.balance < entryVal || activeU.balance <= 0) {
    location.href = '../#depositar';
    return;
  }

  // Deduct from server before restarting run
  try {
    const token = localStorage.getItem('pg_auth_token') || localStorage.getItem('paygateway_token') || localStorage.getItem('token');
    const startRes = await fetch('/api/game/subway-pay/start', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        'X-Session-Email': activeU.email
      },
      body: JSON.stringify({
        betAmount: entryVal,
        entry: entryVal,
        email: activeU.email,
        token: token
      })
    });
    const startData = await startRes.json();
    if (startRes.ok && typeof startData.balance === 'number') {
      activeU.balance = startData.balance;
      const newRound = {
        id: startData.betId || ('rnd_' + Date.now()),
        betId: startData.betId,
        email: sessionEmail,
        entry: entryVal,
        status: 'active'
      };
      localStorage.setItem('subway-demo-users', JSON.stringify(currUsers));
      localStorage.setItem('subway-demo-round', JSON.stringify(newRound));

      const qParams = new URLSearchParams(window.location.search);
      qParams.set('balance', String(activeU.balance));
      window.location.search = qParams.toString();
      return;
    }
  } catch (_) {}

  // Fallback offline deduction
  activeU.balance = Math.round((activeU.balance - entryVal) * 100) / 100;
  localStorage.setItem('subway-demo-users', JSON.stringify(currUsers));
  const newRound = {
    id: (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'rnd_' + Date.now()),
    email: sessionEmail,
    entry: entryVal,
    status: 'active'
  };
  localStorage.setItem('subway-demo-round', JSON.stringify(newRound));
  const qParams = new URLSearchParams(window.location.search);
  qParams.set('balance', String(activeU.balance));
  window.location.search = qParams.toString();
});

setInterval(() => {
  if (finished) return;
  const gameInst = engine || window.SubwayGame;
  if (!engine && gameInst) {
    engine = gameInst;
    if (gameInst.stats) {
      getCoins = () => gameInst.stats?.coins || 0;
    }
  }
  const coins = Math.max(0, Number(getCoins ? getCoins() : (gameInst?.stats?.coins || 0)) || 0);
  const value = coins === 0 ? 0 : (typeof SubwayRound !== 'undefined' ? SubwayRound.payout(round.entry, coins) : 0);
  if (hudValue) hudValue.textContent = money(value);
  if (hudScore) hudScore.textContent = Math.max(0, Math.floor(Number(gameInst?.stats?.score) || 0)).toString().padStart(6, '0');
  cashoutUnlocked = typeof SubwayRound !== 'undefined' ? SubwayRound.canCashout(round.entry, coins) : (coins >= 10);
  if (cash) {
    cash.hidden = !cashoutUnlocked;
    cash.disabled = !cashoutUnlocked;
    if (cashoutUnlocked) {
      const span = cash.querySelector('span');
      if (span) span.textContent = 'Cashout · ' + money(value);
    }
  }
  if (note) {
    note.hidden = cashoutUnlocked;
    if (!cashoutUnlocked) {
      const minM = getSubwayCashoutMultiplier();
      const targetM = getSubwayTargetMultiplier();
      note.textContent = 'Cashout libera em ' + minM + 'x (' + money(round.entry * minM) + '). Meta de 5x (' + money(round.entry * targetM) + ').';
    }
  }
  // Auto-cashout triggers ONLY when completing 5x the bet amount (80 coins or value >= entry * 5.0)
  const targetMultiplier = getSubwayTargetMultiplier();
  const maxTargetVal = Math.round(round.entry * targetMultiplier * 100) / 100;
  if (value >= maxTargetVal || coins >= 80) {
    finish('cashout');
  }
}, 120);

if (window.lucide) lucide.createIcons();
})();
