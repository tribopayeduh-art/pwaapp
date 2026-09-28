/* Local demonstration only: no real authentication, funds, or payments. */
(()=>{
'use strict';
const originalFetch=window.fetch.bind(window);
const KEY='bb-demo-accounts-v1',SESSION='bb-demo-session-v1',CREDIT=10000;
const read=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch{return {}}};
const response=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
const error=(message,status=400)=>response({error:{message,code:'DEMO_ONLY'}},status);
const current=()=>{const phone=localStorage.getItem(SESSION),accounts=read();return phone&&accounts[phone]||null};
const user=record=>({id:record.id,name:record.name,phone:record.phone,role:'USER'});
const balance=()=>{const phone=localStorage.getItem(SESSION);if(!phone)return CREDIT;const raw=localStorage.getItem('bb-demo-wallet-v1-'+phone);const n=Number(raw);return raw!==null&&Number.isSafeInteger(n)&&n>=0?n:CREDIT;};
window.fetch=async(input,options={})=>{
 const url=new URL(typeof input==='string'?input:input.url,location.href);
 if(url.origin!==location.origin||!url.pathname.startsWith('/api/'))return originalFetch(input,options);
 const path=url.pathname,method=(options.method||'GET').toUpperCase();
 let data={};try{data=JSON.parse(options.body||'{}')}catch{}
 if(path==='/api/auth/register'&&method==='POST'){
  const phone=String(data.phone||'').replace(/\D/g,'');
  if(!phone)return error('Informe um telefone para testar.');
  const accounts=read();
  const record=accounts[phone]||{id:'demo-'+phone,phone,name:String(data.name||'Jogador de teste').trim().slice(0,80)||'Jogador de teste'};
  accounts[phone]=record;localStorage.setItem(KEY,JSON.stringify(accounts));localStorage.setItem(SESSION,phone);
  return response({user:user(record),balanceCents:balance()});
 }
 if(path==='/api/auth/login'&&method==='POST'){
  const phone=String(data.phone||'').replace(/\D/g,'');
  if(!phone)return error('Informe um telefone para testar.');
  const accounts=read();const record=accounts[phone]||{id:'demo-'+phone,phone,name:'Jogador de teste'};
  accounts[phone]=record;localStorage.setItem(KEY,JSON.stringify(accounts));localStorage.setItem(SESSION,phone);
  return response({user:user(record),balanceCents:balance()});
 }
 if(path==='/api/auth/logout'){localStorage.removeItem(SESSION);return response({ok:true})}
 if(path==='/api/auth/me'){const record=current();return record?response({user:user(record),balanceCents:balance()}):error('Entre para continuar.',401)}
 if(path==='/api/auth/refresh')return current()?response({ok:true}):error('Sessão não iniciada.',401);
 if(!current())return error('Entre para continuar.',401);
 if(path==='/api/wallet/'&&method==='GET')return response({balanceCents:balance(),transactions:[]});
 if(path==='/api/wallet/deposit-info')return response({elegivel:true,bonus_minimo:30,bonus_maximo:10000,bonus_percentual:10,redeposito:{elegivel:false}});
 if(path==='/api/wallet/deposit'&&method==='POST'){
  const amount=data.amountCents;
  if(!Number.isSafeInteger(amount)||amount<2500||amount>1000000)return error('Escolha um valor de R$ 25 a R$ 10.000.');
  const bonus=data.acceptBonus&&amount>=3000?Math.round(amount*.1):0;
  const phone=localStorage.getItem(SESSION),total=balance()+amount+bonus;
  localStorage.setItem('bb-demo-wallet-v1-'+phone,String(total));
  return response({balanceCents:total,transaction:{status:'COMPLETED'},bonusCents:bonus,demo:true});
 }
 if(path==='/api/wallet/withdraw-info')return response({minCents:5000,maxCents:0,availableCents:0});
 if(path==='/api/game/history')return response({games:[]});
 if(path==='/api/users/stats')return response({totalGames:0,totalWins:0});
 if(path==='/api/game/config')return response({minBetCents:500,maxBetCents:10000,targetMultiplier:5});
 if(path==='/api/game/active')return response({game:null});
 if(path==='/api/users/referrals')return response({refCode:'',link:'',history:[]});
 if(path==='/api/indicacao/info')return response({});
 if(path==='/api/users/level')return response({level:1,progress:0});
 return error('Recurso indisponível na demonstração. Nenhuma operação financeira foi realizada.',403);
};
})();
