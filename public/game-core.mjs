export const START_CREDITS=10000;
export const MAX_SHOTS=28;
export const MIN_CASHOUT_SCORE=36;
export const MIN_BET=500;
export const MAX_BET=10000;
export const money=cents=>(cents/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
export function multiplier(score){return Math.min(8,Math.round((1+Math.max(0,score)/70)*100)/100)}
export function payout(stake,score){return score<MIN_CASHOUT_SCORE?0:Math.round(stake*multiplier(score))}
export function walletKey(phone){return 'bb-demo-wallet-v1-'+String(phone||'guest').replace(/[^0-9a-z_-]/gi,'')}
export function historyKey(phone){return 'bb-demo-history-v1-'+String(phone||'guest').replace(/[^0-9a-z_-]/gi,'')}
export function roundKey(phone){return 'bb-demo-round-v2-'+String(phone||'guest').replace(/[^0-9a-z_-]/gi,'')}
export function getWallet(storage,phone){const raw=storage.getItem(walletKey(phone));const n=Number(raw);return raw!==null&&Number.isSafeInteger(n)&&n>=0?n:START_CREDITS}
export function putWallet(storage,phone,cents){if(!Number.isSafeInteger(cents)||cents<0)throw Error('Saldo inválido');storage.setItem(walletKey(phone),String(cents));return cents}
export function stakeFromURL(search){const n=Number(new URLSearchParams(search).get('betCents'));return Number.isSafeInteger(n)&&n>=MIN_BET&&n<=MAX_BET?n:1000}
export function claimRound(storage,phone,stake){if(!Number.isSafeInteger(stake)||stake<MIN_BET||stake>MAX_BET)throw Error('Entrada inválida');const available=getWallet(storage,phone);if(available<stake)throw Error('Créditos de demonstração insuficientes');putWallet(storage,phone,available-stake);return available-stake}
export function creditResult(storage,phone,stake,score,result){const amount=result==='cashout'||result==='clear'?payout(stake,score):0;putWallet(storage,phone,getWallet(storage,phone)+amount);const record={id:crypto.randomUUID(),at:new Date().toISOString(),stake,score,result,amount};const prior=JSON.parse(storage.getItem(historyKey(phone))||'[]');storage.setItem(historyKey(phone),JSON.stringify([record,...prior].slice(0,30)));return record}
