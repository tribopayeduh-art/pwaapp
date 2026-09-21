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
  return Number(cfg.maxMultiplier) || 4;
}
function getSubwayCashoutMultiplier() {
  const cfg = window.SubwayConfig || (typeof SubwayRound !== 'undefined' && SubwayRound.config) || {};
  return Number(cfg.minCashoutMultiplier) || 2;
}
function syncSubwayHud() {
  const targetM = getSubwayTargetMultiplier();
  const cashoutM = getSubwayCashoutMultiplier();
  if (hudTarget) hudTarget.textContent = money(round.entry * targetM);
  if (note && !cashoutUnlocked) {
    note.textContent = 'Cashout libera ao atingir ' + cashoutM + 'x (' + money(round.entry * cashoutM) + ').';
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

if (hudValue) hudValue.textContent = money(round.entry);

function finish(outcome) {
  if (finished || (outcome === 'cashout' && !cashoutUnlocked)) return;
  const stored = read('subway-demo-round', null);
  if (!stored || stored.id !== round.id || stored.status !== 'active') return;
  const currUsers = read('subway-demo-users', []);
  const coins = getCoins();
  if (typeof SubwayRound !== 'undefined' && !SubwayRound.settle(stored, currUsers, outcome, coins)) return;
  finished = true;
  round = stored;
  engine?.pause?.();
  localStorage.setItem('subway-demo-users', JSON.stringify(currUsers));
  localStorage.setItem('subway-demo-round', JSON.stringify(round));

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
  if (resVal) resVal.textContent = outcome === 'loss' ? money(round.entry) : money(round.payout || round.entry);
  if (resDet) resDet.textContent = outcome === 'loss' ? 'A corrida terminou. Sua entrada foi consumida.' : 'Parabéns! Valor creditado instantaneamente no seu saldo.';

  if (dialog && typeof dialog.showModal === 'function') {
    dialog.showModal();
  }
  if (window.lucide) lucide.createIcons();
  document.querySelector('#result-home')?.focus();
}

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
    if (note) {
      const minM = getSubwayCashoutMultiplier();
      note.textContent = 'Cashout libera ao atingir ' + minM + 'x (' + money(round.entry * minM) + ').';
    }
  },
  lose() { finish('loss'); }
};

if (cash) {
  cash.onclick = () => { if (engine && !finished && cashoutUnlocked) finish('cashout'); };
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

document.querySelector('#result-retry')?.addEventListener('click', () => {
  const currUsers = read('subway-demo-users', []);
  const activeU = currUsers.find(u => u.email === sessionEmail);
  const entryVal = (round && round.entry) || 10;
  if (!activeU || activeU.balance < entryVal) {
    location.href = '../#depositar';
    return;
  }
  activeU.balance = Math.round((activeU.balance - entryVal) * 100) / 100;
  localStorage.setItem('subway-demo-users', JSON.stringify(currUsers));
  const newRound = {
    id: (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'rnd_' + Date.now()),
    email: sessionEmail,
    entry: entryVal,
    status: 'active'
  };
  localStorage.setItem('subway-demo-round', JSON.stringify(newRound));
  location.reload();
});

setInterval(() => {
  if (finished || !engine) return;
  const coins = Math.max(0, Number(getCoins()) || 0);
  const value = typeof SubwayRound !== 'undefined' ? SubwayRound.payout(round.entry, coins) : round.entry;
  if (hudValue) hudValue.textContent = money(value);
  if (hudScore) hudScore.textContent = Math.max(0, Math.floor(Number(engine?.stats?.score) || 0)).toString().padStart(6, '0');
  cashoutUnlocked = typeof SubwayRound !== 'undefined' ? SubwayRound.canCashout(round.entry, coins) : false;
  if (cash) {
    cash.hidden = !cashoutUnlocked;
    cash.disabled = !cashoutUnlocked;
    if (cashoutUnlocked) cash.querySelector('span').textContent = 'Cashout · ' + money(value);
  }
  if (note) {
    note.hidden = cashoutUnlocked;
    if (!cashoutUnlocked) {
      const minM = getSubwayCashoutMultiplier();
      note.textContent = 'Cashout libera ao atingir ' + minM + 'x (' + money(round.entry * minM) + ').';
    }
  }
  if (coins >= 300) finish('cashout');
}, 150);

if (window.lucide) lucide.createIcons();
})();
