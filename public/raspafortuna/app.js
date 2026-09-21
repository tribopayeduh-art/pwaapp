const games=[
 {id:'carros',type:'produtos',tag:'CARROS',title:'Garagem Premiada',desc:'Dois carros e prêmios em dinheiro esperando por você.',price:20,img:'assets/prizes-cars-v2.png',prizes:['SUV 0 km','Sedã esportivo 0 km','R$ 10.000 no PIX','R$ 500 no PIX']},
 {id:'fan160',type:'produtos',tag:'MOTOS',title:'Fan 160 dos Sonhos',desc:'Raspe e concorra à moto mais desejada do Brasil.',price:10,img:'assets/fan160-premio-v1.png',prizes:['Fan 160 0 km','R$ 5.000 no PIX','Capacete premium','R$ 200 no PIX']},
 {id:'twister',type:'produtos',tag:'MOTOS',title:'Twister + iPhone 17',desc:'Moto 300cc e iPhone 17 Pro Max laranja com caixa.',price:15,img:'assets/twister-iphone17-box-v1.png',prizes:['Moto 300cc 0 km','iPhone 17 Pro Max laranja com caixa','R$ 3.000 no PIX','R$ 100 no PIX']},
 {id:'tech',type:'produtos',tag:'ELETRÔNICOS',title:'Casa Tech',desc:'TV, videogame, notebook e iPhone 17 Pro Max.',price:10,img:'assets/tech-iphone17-box-v1.png',prizes:['Smart TV 65”','Videogame de nova geração','Notebook premium','iPhone 17 Pro Max laranja com caixa']},
 {id:'iphone',type:'produtos',tag:'CELULAR',title:'iPhone 17 Pro Max',desc:'O modelo laranja, novo e completo na caixa.',price:5,img:'assets/iphone17-box-v1.png',prizes:['iPhone 17 Pro Max laranja com caixa','R$ 2.000 no PIX','Fone sem fio','R$ 100 no PIX']},
 {id:'dinheiro',type:'dinheiro',tag:'DINHEIRO',title:'Dinheiro na Mão',desc:'Prêmios em dinheiro de até R$ 5.000.',price:5,img:'assets/prizes-pix-v2.png',prizes:['R$ 5.000 no PIX','R$ 1.000 no PIX','R$ 100 no PIX','R$ 20 no PIX']},
 {id:'pix',type:'dinheiro',tag:'PIX',title:'PIX Turbinado',desc:'Revele seu prêmio e receba direto no saldo.',price:5,img:'assets/prizes-pix-v2.png',prizes:['R$ 10.000 no PIX','R$ 500 no PIX','R$ 50 no PIX','R$ 10 no PIX']},
 {id:'byd-song',type:'produtos',tag:'BYD',title:'BYD Song Plus',desc:'SUV híbrido, tecnologia e PIX em um jogo exclusivo.',price:20,img:'assets/prizes-cars-v2.png',prizes:['BYD Song Plus 0 km','R$ 20.000 no PIX','Carregador residencial','iPhone 17 Pro Max com caixa']},
 {id:'byd-dolphin',type:'produtos',tag:'BYD ELÉTRICO',title:'BYD Dolphin Premiado',desc:'O elétrico mais desejado acompanhado de grandes prêmios.',price:15,img:'assets/prizes-cars-v2.png',prizes:['BYD Dolphin 0 km','R$ 10.000 no PIX','Wallbox residencial','Smartphone premium']},
 {id:'bmw-audi',type:'produtos',tag:'CARROS PREMIUM',title:'BMW ou Audi na Garagem',desc:'Uma raspadinha sofisticada com dois supercarros e PIX.',price:25,img:'assets/prizes-cars-v2.png',prizes:['BMW X1 0 km','Audi A3 0 km','R$ 50.000 no PIX','R$ 1.000 no PIX']},
 {id:'bmw-motos',type:'produtos',tag:'MOTOS PREMIUM',title:'BMW Motorrad + Tech',desc:'Motos de alta performance e um pacote completo de tecnologia.',price:20,img:'assets/prizes-motos-v2.png',prizes:['BMW S 1000 RR','BMW G 310 GS','Smart TV 75”','Videogame premium','Smartphone premium']},
 {id:'combo',type:'produtos',tag:'SUPER PRÊMIOS',title:'Tudo ou Nada',desc:'Carro, moto, eletrônicos e dinheiro em um só jogo.',price:25,img:'assets/cars-prizes.png',prizes:['Carro 0 km','Fan 160 0 km','Smart TV 65”','iPhone 17 Pro Max com caixa','R$ 20.000 no PIX']}
];
const winners=[
 ['a***r','R$ 10 no PIX','agora','assets/pix.png'],['m***s','iPhone 17 Pro Max','há 2 min','assets/iphone17-box-v1.png'],['c***a','Fan 160 0 km','há 4 min','assets/fan160-premio-v1.png'],
 ['j***o','R$ 100 no PIX','há 6 min','assets/pix.png'],['l***a','Smart TV 65”','há 8 min','assets/prizes-tech-v2.png'],['r***s','R$ 20 no PIX','há 11 min','assets/pix.png'],
 ['b***a','Videogame','há 13 min','assets/prizes-tech-v2.png'],['p***o','R$ 500 no PIX','há 16 min','assets/pix.png'],['t***a','Notebook premium','há 19 min','assets/prizes-tech-v2.png'],
 ['g***l','BYD Dolphin 0 km','há 22 min','assets/prizes-cars-v2.png'],['d***e','R$ 50 no PIX','há 25 min','assets/pix.png'],['v***r','Moto BMW','há 28 min','assets/prizes-motos-v2.png']
];
const prizeOdds=[
 {name:'Fan 160 0 km',img:'assets/fan160-premio-v1.png',chance:.08,winners:6,tier:'Moto'},
 {name:'BYD Song Plus',img:'assets/prizes-cars-v2.png',chance:.02,winners:2,tier:'Carro'},
 {name:'BYD Dolphin',img:'assets/prizes-cars-v2.png',chance:.04,winners:4,tier:'Carro'},
 {name:'BMW X1 0 km',img:'assets/banner-loira-carro-v3.png',chance:.015,winners:1,tier:'Carro'},
 {name:'Audi A3 0 km',img:'assets/banner-bmw-audi.png',chance:.015,winners:1,tier:'Carro'},
 {name:'Moto BMW',img:'assets/prizes-motos-v2.png',chance:.03,winners:3,tier:'Moto'},
 {name:'iPhone 17 Pro Max laranja',img:'assets/iphone17-box-v1.png',chance:.15,winners:18,tier:'Celular'},
 {name:'Smart TV 65”',img:'assets/prizes-tech-v2.png',chance:.25,winners:31,tier:'Eletrônico'},
 {name:'Notebook premium',img:'assets/prizes-tech-v2.png',chance:.35,winners:42,tier:'Eletrônico'},
 {name:'Videogame',img:'assets/prizes-tech-v2.png',chance:.5,winners:67,tier:'Eletrônico'},
 {name:'R$ 50.000 no PIX',img:'assets/prizes-pix-v2.png',chance:.01,winners:1,tier:'PIX'},
 {name:'R$ 10.000 no PIX',img:'assets/prizes-pix-v2.png',chance:.05,winners:7,tier:'PIX'},
 {name:'R$ 500 no PIX',img:'assets/prizes-pix-v2.png',chance:1.5,winners:284,tier:'PIX'},
 {name:'R$ 100 no PIX',img:'assets/prizes-pix-v2.png',chance:7,winners:1248,tier:'PIX'},
 {name:'R$ 20 no PIX',img:'assets/prizes-pix-v2.png',chance:25,winners:8937,tier:'PIX'}
];
function getInitialStoredBalance() {
  try {
    const rawUser = localStorage.getItem('rf_user') || localStorage.getItem('user');
    if (rawUser) {
      const parsed = JSON.parse(rawUser);
      if (typeof parsed.balance === 'number' && !isNaN(parsed.balance)) {
        return Number(parsed.balance);
      }
    }
  } catch(e) {}
  const rawBal = localStorage.getItem('rf_balance');
  if (rawBal !== null && !isNaN(Number(rawBal))) {
    return Number(rawBal);
  }
  return 0;
}
let balance=getInitialStoredBalance(),activeGame=games[3],infoGame=games[0],scratching=false,revealed=false,last={x:0,y:0};
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
function money(v){return v.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}
let heroIndex=0,heroTimer,heroTouchX=0;
function showHero(index){const slides=$$('.heroSlide'),dots=$$('.heroDots button');heroIndex=(index+slides.length)%slides.length;slides.forEach((slide,i)=>slide.classList.toggle('active',i===heroIndex));dots.forEach((dot,i)=>dot.classList.toggle('active',i===heroIndex))}
function startHero(){clearInterval(heroTimer);heroTimer=setInterval(()=>showHero(heroIndex+1),5200)}
$('#heroPrev').onclick=()=>{showHero(heroIndex-1);startHero()};$('#heroNext').onclick=()=>{showHero(heroIndex+1);startHero()};$$('.heroDots button').forEach(dot=>dot.onclick=()=>{showHero(Number(dot.dataset.go));startHero()});
const hero=$('.heroCarousel');hero.addEventListener('mouseenter',()=>clearInterval(heroTimer));hero.addEventListener('mouseleave',startHero);hero.addEventListener('touchstart',e=>heroTouchX=e.changedTouches[0].clientX,{passive:true});hero.addEventListener('touchend',e=>{const delta=e.changedTouches[0].clientX-heroTouchX;if(Math.abs(delta)>45){showHero(heroIndex+(delta<0?1:-1));startHero()}},{passive:true});startHero();
function renderGames(filter='all'){$('#gameGrid').innerHTML=games.filter(g=>filter==='all'||g.type===filter).map(g=>`<article class="card" data-type="${g.type}"><div class="cardImage"><img src="${g.img}" alt="${g.title}"><span class="tag">${g.tag}</span><button class="gameInfo" data-info="${g.id}" aria-label="Ver prêmios de ${g.title}"><i data-lucide="circle-alert"></i></button></div><div class="cardBody"><h3>${g.title}</h3><p>${g.desc}</p><div class="cardFoot"><span class="price">A partir de<br><b>${money(g.price)}</b></span><button class="primary play" data-id="${g.id}"><i data-lucide="play"></i> Jogar</button></div></div></article>`).join('');$$('.play').forEach(b=>b.onclick=()=>openGame(b.dataset.id));$$('.gameInfo').forEach(b=>b.onclick=()=>openPrizeInfo(b.dataset.info));window.lucide?.createIcons()}
function openPrizeInfo(id){infoGame=games.find(g=>g.id===id);$('#prizeInfoTitle').textContent=infoGame.title;$('#prizeList').innerHTML=infoGame.prizes.map((p,i)=>`<div><span><i data-lucide="${i===0?'trophy':'gift'}"></i></span><b>${p}</b></div>`).join('');modal($('#prizeInfoModal'),true);window.lucide?.createIcons()}
function winnerCards(){return winners.map(w=>`<div class="winner"><span class="winnerIcon winnerPhoto"><img src="${w[3]}" alt="${w[1]}"></span><div><b>${w[0]}</b><small>${w[2]}</small></div><strong class="winnerPrize">${w[1]}</strong></div>`).join('')}
function renderWinners(){$('#winnerRail').innerHTML=`<div class="winnerTrack"><div class="winnerGroup">${winnerCards()}</div><div class="winnerGroup" aria-hidden="true">${winnerCards()}</div></div>`;window.lucide?.createIcons()}
function formatChance(value){return value<.1?value.toFixed(3).replace('.',',')+'%':value.toFixed(value<1?2:1).replace('.',',')+'%'}
function renderPrizeOdds(){$('#prizeOddsGrid').innerHTML=[...prizeOdds].sort((a,b)=>b.chance-a.chance).map(p=>`<article class="oddsCard"><img class="oddsPhoto" src="${p.img}" alt="${p.name}"><div class="oddsMain"><div><span>${p.tier}</span><h3>${p.name}</h3></div><div class="oddsMeta"><b>${formatChance(p.chance)}</b><small>${p.winners.toLocaleString('pt-BR')} ganhador${p.winners===1?'':'es'}</small></div><div class="oddsBar"><i style="width:${Math.max(2,Math.min(100,p.chance*4))}%"></i></div></div></article>`).join('')}
function modal(el,on){el.classList.toggle('open',on);el.setAttribute('aria-hidden',String(!on));document.body.style.overflow=on?'hidden':''}
function toast(t){const e=$('#toast');e.textContent=t;e.classList.add('show');setTimeout(()=>e.classList.remove('show'),2300)}
const reduceMotion = typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false;
let motionObserver;
function motionScan(root=document){if(reduceMotion)return;const items=root.querySelectorAll?.('.sectionHead,.card,.moneyPromo,.oddsCard,.depositPromo,.depositForm,.profileHero,.profileBalance,.profileStats,.profileSection,.withdrawIntro,.withdrawPanel,footer .footerGrid')||[];items.forEach((el,i)=>{if(el.dataset.motionReady)return;el.dataset.motionReady='1';el.classList.add('motionReveal');el.style.setProperty('--motion-delay',`${Math.min(i%5,4)*65}ms`);motionObserver?.observe(el)})}
if(!reduceMotion){document.body.classList.add('motionReady');motionObserver=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('motionVisible');motionObserver.unobserve(entry.target)}}),{threshold:.08,rootMargin:'0px 0px -24px'});document.addEventListener('pointerdown',e=>{const button=e.target.closest('button,.primary,.ghost');if(!button)return;button.classList.remove('motionPress');void button.offsetWidth;button.classList.add('motionPress');setTimeout(()=>button.classList.remove('motionPress'),420)});document.addEventListener('pointermove',e=>{const card=e.target.closest('.card');if(!card)return;const r=card.getBoundingClientRect();card.style.setProperty('--mx',`${e.clientX-r.left}px`);card.style.setProperty('--my',`${e.clientY-r.top}px`)},{passive:true});new MutationObserver(records=>records.forEach(r=>r.addedNodes.forEach(n=>{if(n.nodeType===1)motionScan(n.parentElement||document)}))).observe(document.body,{childList:true,subtree:true})}
$('#deposito').insertAdjacentHTML('afterbegin',`<header class="depositScreenHeader"><button id="closeDeposit"><i data-lucide="arrow-left"></i><span>Voltar</span></button><a class="brand" href="#"><i>☘</i><span>RASPA<br><b>FORTUNA</b></span></a><div class="depositScreenBalance"><small>Saldo</small><strong id="depositScreenBalanceValue">${money(balance)}</strong></div></header>`);
$('#premios').insertAdjacentHTML('afterbegin',`<header class="prizeScreenHeader"><button id="closePrizes"><i data-lucide="arrow-left"></i><span>Voltar</span></button><div><small>CATÁLOGO COMPLETO</small><strong>Prêmios e chances</strong></div><span class="prizeCount">${prizeOdds.length} prêmios</span></header>`);
$('#profileModal').insertAdjacentHTML('afterbegin',`<header class="accountScreenHeader"><button id="closeProfilePage"><i data-lucide="arrow-left"></i><span>Voltar</span></button><a class="brand" href="#"><i>☘</i><span>RASPA<br><b>FORTUNA</b></span></a><div class="accountHeaderBalance"><small>Saldo disponível</small><strong id="accountHeaderBalanceValue">${money(balance)}</strong></div></header>`);
$('#deposito .depositPageGrid').insertAdjacentHTML('afterbegin',`<section class="depositPromo" aria-label="Depósito via PIX"><img src="assets/banner-deposito-loira-v1.png" alt="Apresentadora mostrando pagamento PIX pelo celular"><div class="depositPromoCopy"><span>OFERTA DE BOAS-VINDAS</span><h1>A partir de R$ 75,<br><em>seu saldo dobra.</em></h1><p>Deposite via PIX e aproveite o bônus de 200%.</p><div><i data-lucide="sparkles"></i> Bônus liberado após a confirmação</div></div><strong class="depositPromoBadge"><small>BÔNUS</small>200%</strong></section>`);
$('.withdrawSection')?.remove();
$('.profileBalance').insertAdjacentHTML('beforeend',`<button class="withdrawProfileButton" id="profileWithdraw"><i data-lucide="arrow-up-right"></i> Sacar</button>`);
document.body.insertAdjacentHTML('beforeend',`<section class="withdrawPage" id="saque" aria-label="Saque via PIX"><header class="withdrawScreenHeader"><button id="closeWithdraw"><i data-lucide="arrow-left"></i><span>Voltar</span></button><a class="brand" href="#"><i>☘</i><span>RASPA<br><b>FORTUNA</b></span></a><div class="withdrawHeaderBalance"><small>Saldo disponível</small><strong id="withdrawHeaderBalanceValue">${money(balance)}</strong></div></header><main class="withdrawPageMain"><section class="withdrawIntro"><span class="withdrawEyebrow"><i data-lucide="zap"></i> SAQUE VIA PIX</span><h1>Seu prêmio,<br><em>direto na sua conta.</em></h1><p>Informe sua chave PIX e acompanhe cada etapa da solicitação.</p><div class="withdrawVisual"><div class="withdrawOrb"><i data-lucide="badge-dollar-sign"></i></div><div><small>DISPONÍVEL PARA SAQUE</small><strong id="withdrawAvailable">${money(balance)}</strong><span><i data-lucide="shield-check"></i> Conta verificada</span></div></div><div class="withdrawSteps"><div class="active"><b>1</b><span>Dados do PIX</span></div><i></i><div><b>2</b><span>Confirmação</span></div><i></i><div><b>3</b><span>Concluído</span></div></div></section><section class="withdrawPanel"><div class="withdrawPanelTop"><div><span>Solicitar saque</span><h2>Quanto deseja sacar?</h2></div><span class="pixSeal"><i data-lucide="zap"></i> PIX</span></div><form id="withdrawForm"><label class="withdrawAmountLabel"><span>Valor do saque</span><div class="withdrawMoney"><b>R$</b><input id="withdrawAmount" type="number" min="10" step="0.01" inputmode="decimal" placeholder="0,00" required></div><small>Valor mínimo de R$ 10,00</small></label><div class="withdrawQuick"><button type="button" data-withdraw="10">R$ 10</button><button type="button" data-withdraw="20">R$ 20</button><button type="button" data-withdraw="50">R$ 50</button><button type="button" data-withdraw="all">Todo saldo</button></div><div class="withdrawGrid"><label><span>Tipo de chave</span><select id="pixKeyType" required><option value="cpf">CPF</option><option value="phone">Celular</option><option value="email">E-mail</option><option value="random">Chave aleatória</option></select></label><label class="pixKeyField"><span>Chave PIX</span><div><i data-lucide="key-round"></i><input id="withdrawPixKey" type="text" autocomplete="off" placeholder="Digite sua chave PIX" required></div></label></div><div class="withdrawSummary"><div><span>Valor solicitado</span><strong id="withdrawSummaryValue">R$ 0,00</strong></div><div><span>Taxa de saque</span><strong>Grátis</strong></div><div class="withdrawTotal"><span>Total a receber</span><strong id="withdrawTotalValue">R$ 0,00</strong></div></div><button class="withdrawButton" type="submit"><i data-lucide="arrow-up-right"></i><span>Confirmar saque via PIX</span><small>Processamento demonstrativo</small></button><div class="withdrawReceipt" id="withdrawReceipt" aria-live="polite"></div><p class="withdrawNotice"><i data-lucide="shield-check"></i> Confira a chave antes de confirmar. Esta versão não movimenta dinheiro real.</p></form></section></main></section>`);
function openDeposit(){const page=$('#deposito');page.classList.add('open');page.scrollTop=0;document.body.classList.add('depositOpen');window.lucide?.createIcons()}
function closeDeposit(){const page=$('#deposito');page.classList.remove('open');document.body.classList.remove('depositOpen')}
function openPrizes(){const page=$('#premios');page.classList.add('open');page.scrollTop=0;document.body.classList.add('prizeOpen');window.lucide?.createIcons()}
function closePrizes(){$('#premios').classList.remove('open');document.body.classList.remove('prizeOpen')}
function openWithdraw(){closeProfile();const page=$('#saque');page.classList.add('open');page.scrollTop=0;document.body.classList.add('withdrawOpen');$('#withdrawHeaderBalanceValue').textContent=money(balance);$('#withdrawAvailable').textContent=money(balance);window.lucide?.createIcons()}
function closeWithdraw(){$('#saque').classList.remove('open');document.body.classList.remove('withdrawOpen')}
let accountMode='login';
function setAccountMode(mode){
  accountMode=mode;
  const register=mode==='register',dialog=$('#accountModal .dialog');
  dialog.classList.toggle('register',register);
  const tabLogin = $('#tabModeLogin');
  const tabRegister = $('#tabModeRegister');
  if (tabLogin) tabLogin.classList.toggle('active', !register);
  if (tabRegister) tabRegister.classList.toggle('active', register);
  $('#accountTitle').textContent=register?'Crie sua conta':'Entre na sua conta';
  $('#accountText').textContent=register?'Cadastre-se com seu e-mail e senha para começar.':'Use seu e-mail e senha cadastrados.';
  $('#accountSubmit').textContent=register?'Criar minha conta':'Entrar na minha conta';
  $('#switchMode').textContent=register?'Já tenho uma conta? Faça login':'Ainda não tem conta? Cadastre-se';
  if ($('#accountName')) $('#accountName').required=register;
  if ($('#accountEmail')) $('#accountEmail').required=true;
  if ($('#accountPassword')) {
    $('#accountPassword').required=true;
    $('#accountPassword').autocomplete=register?'new-password':'current-password';
  }
  if ($('#accountAge')) $('#accountAge').required=register;
  $('#authError').textContent='';
  $('#authGraphicImg').src=register?'assets/auth-register.png':'assets/auth-login.png';
  $('#authGraphicTag').textContent=register?'COMECE COM BOAS-VINDAS':'BEM-VINDO DE VOLTA';
  $('#authGraphicTitle').innerHTML=register?'Crie. Raspe.<br>Descubra.':'Sua sorte<br>continua aqui.';
  $('#authGraphicText').textContent=register?'Sua nova experiência começa em poucos segundos.':'Entre e acesse suas raspadinhas.';
}
$$('[data-modal]').forEach(b=>b.onclick=()=>{setAccountMode(b.dataset.modal);modal($('#accountModal'),true)});
$$('[data-close]').forEach(b=>b.onclick=()=>modal(b.closest('.modal'),false));
$('#switchMode').onclick=()=>setAccountMode(accountMode==='login'?'register':'login');
if ($('#tabModeLogin')) $('#tabModeLogin').onclick = () => setAccountMode('login');
if ($('#tabModeRegister')) $('#tabModeRegister').onclick = () => setAccountMode('register');

// Capture ref parameter from URL
(function() {
  try {
    const p = new URLSearchParams(window.location.search);
    const r = p.get('ref') || p.get('r') || p.get('refCode') || p.get('af') || '';
    if (r) {
      localStorage.setItem('alliance_ref_code', r);
      localStorage.setItem('rf_ref_code', r);
    }
  } catch(e) {}
})();

function renderAccount(){
  const user=JSON.parse(localStorage.getItem('rf_user')||localStorage.getItem('user')||'null');
  if(!user)return;
  const displayName = user.name || user.username || (user.email ? user.email.split('@')[0] : 'Jogador');
  const initial = displayName.charAt(0).toUpperCase();
  const firstName = displayName.split(' ')[0];
  $('.actions').innerHTML=`<button class="userMenu" id="headerAccount"><span class="userAvatar">${initial}</span><span>Olá, ${firstName}</span><i data-lucide="chevron-down"></i></button>`;
  $('#headerAccount').onclick=openProfile;
  window.lucide?.createIcons();
}
function openProfile(){
  const user=JSON.parse(localStorage.getItem('rf_user')||localStorage.getItem('user')||'null');
  if(!user){setAccountMode('login');return modal($('#accountModal'),true)}
  const displayName = user.name || user.username || (user.email ? user.email.split('@')[0] : 'Jogador');
  $('#profileAvatar').textContent=displayName.charAt(0).toUpperCase();
  $('#profileName').textContent=displayName;
  if($('#profileEmail')) $('#profileEmail').textContent=user.email||'';
  $('#profilePhone').textContent=user.phone && user.phone !== 'Não informado' ? user.phone : (user.email || '');
  $('#profileBalanceValue').textContent=money(balance);
  $('#accountHeaderBalanceValue').textContent=money(balance);
  $('#profileLastDeposit').textContent=localStorage.getItem('rf_last_deposit')||'Nenhum depósito realizado';
  $('#profilePlays').textContent=localStorage.getItem('rf_plays')||'0';
  const page=$('#profileModal');
  page.classList.add('open');
  page.setAttribute('aria-hidden','false');
  page.scrollTop=0;
  document.body.classList.add('accountOpen');
  window.lucide?.createIcons();
  if(typeof checkRfInfluencerStatus==='function')checkRfInfluencerStatus();
}
function closeProfile(){const page=$('#profileModal');page.classList.remove('open');page.setAttribute('aria-hidden','true');document.body.classList.remove('accountOpen')}
function phoneDigits(value){return (value||'').replace(/\D/g,'')}
function authFail(message){$('#authError').textContent=message;toast(message)}
if ($('#accountPhone')) {
  $('#accountPhone').oninput=e=>{let v=phoneDigits(e.target.value).slice(0,11);e.target.value=v.length>10?`(${v.slice(0,2)}) ${v.slice(2,7)}-${v.slice(7)}`:v.length>6?`(${v.slice(0,2)}) ${v.slice(2,6)}-${v.slice(6)}`:v.length>2?`(${v.slice(0,2)}) ${v.slice(2)}`:v;$('#authError').textContent=''};
}
$('#accountForm').onsubmit=async e=>{
  e.preventDefault();
  $('#authError').textContent='';
  const email=($('#accountEmail')?.value||'').trim().toLowerCase();
  const password=($('#accountPassword')?.value||'').trim();
  if(!email||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return authFail('Digite um e-mail válido');
  if(!password||password.length<4)return authFail('A senha deve ter no mínimo 4 caracteres');

  const submitBtn = $('#accountSubmit');
  const origBtnText = submitBtn.textContent;
  submitBtn.disabled = true;

  if(accountMode==='register'){
    const name=($('#accountName')?.value||'').trim();
    if(name.length<2) {
      submitBtn.disabled = false;
      return authFail('Digite seu nome completo');
    }
    if(!$('#accountAge')?.checked) {
      submitBtn.disabled = false;
      return authFail('Confirme que você tem 18 anos ou mais');
    }
    const phone = phoneDigits($('#accountPhone')?.value||'') || 'Não informado';
    const refCode = new URLSearchParams(window.location.search).get('ref') ||
      new URLSearchParams(window.location.search).get('r') ||
      new URLSearchParams(window.location.search).get('refCode') ||
      localStorage.getItem('alliance_ref_code') ||
      localStorage.getItem('rf_ref_code') ||
      localStorage.getItem('dino_ref_code') || '';

    submitBtn.textContent = 'Criando conta...';
    try {
      const resp = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Game-Origin': 'g_raspa_fortuna',
          'X-Game-Id': 'g_raspa_fortuna'
        },
        body: JSON.stringify({
          name,
          email,
          password,
          phone,
          refCode,
          registeredGame: 'g_raspa_fortuna',
          acquisitionGame: 'g_raspa_fortuna',
          game: 'g_raspa_fortuna',
          gameId: 'g_raspa_fortuna',
          trackingSource: 'raspa_fortuna_screen'
        })
      });
      const data = await resp.json();
      if (!resp.ok || !data.user || !data.token) {
        throw new Error(data.error || 'Erro ao criar conta.');
      }
      currentAuthToken = data.token;
      localStorage.setItem('pg_auth_token', data.token);
      localStorage.setItem('paygateway_token', data.token);
      localStorage.setItem('token', data.token);
      localStorage.setItem('rf_token', data.token);
      localStorage.setItem('rf_user', JSON.stringify(data.user));
      localStorage.setItem('user', JSON.stringify(data.user));
      if (typeof data.user.balance === 'number' && !isNaN(data.user.balance)) {
        balance = data.user.balance;
      } else {
        balance = 0;
      }
      saveBalance();
      modal($('#accountModal'), false);
      renderAccount();
      $('#accountForm').reset();
      toast('Conta criada com sucesso! Aproveite as raspadinhas.');
      try {
        if (window.parent && window.parent !== window) {
          window.parent.postMessage({ source: 'raspa-fortuna-shell', event: 'auth', user: data.user, token: data.token, balance: balance }, '*');
        }
      } catch(e) {}
      if (typeof checkRfInfluencerStatus === 'function') checkRfInfluencerStatus();
    } catch(err) {
      authFail(err.message || 'Erro ao registrar.');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = origBtnText;
    }
  } else {
    submitBtn.textContent = 'Entrando...';
    try {
      const resp = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Game-Origin': 'g_raspa_fortuna',
          'X-Game-Id': 'g_raspa_fortuna'
        },
        body: JSON.stringify({
          email,
          password,
          game: 'g_raspa_fortuna',
          acquisitionGame: 'g_raspa_fortuna'
        })
      });
      const data = await resp.json();
      if (!resp.ok || !data.user || !data.token) {
        throw new Error(data.error || 'E-mail ou senha incorretos.');
      }
      currentAuthToken = data.token;
      localStorage.setItem('pg_auth_token', data.token);
      localStorage.setItem('paygateway_token', data.token);
      localStorage.setItem('token', data.token);
      localStorage.setItem('rf_token', data.token);
      localStorage.setItem('rf_user', JSON.stringify(data.user));
      localStorage.setItem('user', JSON.stringify(data.user));
      if (typeof data.user.balance === 'number' && !isNaN(data.user.balance)) {
        balance = data.user.balance;
        saveBalance();
      }
      modal($('#accountModal'), false);
      renderAccount();
      $('#accountForm').reset();
      const first = (data.user.name || 'Jogador').split(' ')[0];
      toast(`Bem-vindo de volta, ${first}!`);
      try {
        if (window.parent && window.parent !== window) {
          window.parent.postMessage({ source: 'raspa-fortuna-shell', event: 'auth', user: data.user, token: data.token, balance: balance }, '*');
        }
      } catch(e) {}
      if (typeof checkRfInfluencerStatus === 'function') checkRfInfluencerStatus();
    } catch(err) {
      authFail(err.message || 'Erro ao realizar login.');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = origBtnText;
    }
  }
};
$$('.filters button').forEach(b=>b.onclick=()=>{$$('.filters button').forEach(x=>x.classList.remove('active'));b.classList.add('active');renderGames(b.dataset.filter)});
$('.appClose').onclick=()=>$('.appbar').remove();$('#installBtn').onclick=()=>toast('Aplicativo pronto para adicionar à tela inicial');
function getActiveAuthToken() {
  return currentAuthToken ||
    new URLSearchParams(window.location.search).get('token') ||
    localStorage.getItem('pg_auth_token') ||
    localStorage.getItem('paygateway_token') ||
    localStorage.getItem('token') ||
    localStorage.getItem('rf_token') || '';
}
function getCustomerData() {
  try {
    const raw = localStorage.getItem('rf_user') || localStorage.getItem('user');
    if (raw) return JSON.parse(raw);
  } catch(e) {}
  return null;
}

let currentCardBetId = null;
let isPlacingBet = false;
let lastBetTimestamp = 0;
let lastWithdrawTimestamp = 0;

async function debitScratchBet(game) {
  if (!game) return false;
  const price = Number(game.price) || 2;
  if (balance < price) {
    toast('Saldo insuficiente para esta raspadinha');
    return false;
  }

  isPlacingBet = true;
  lastBetTimestamp = Date.now();
  balance = Math.max(0, parseFloat((balance - price).toFixed(2)));
  saveBalance(true);
  localStorage.setItem('rf_plays', String(Number(localStorage.getItem('rf_plays') || 0) + 1));

  try {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({
        source: "raspa-fortuna-shell",
        event: "bet",
        balance: balance,
        betAmount: price
      }, "*");
    }
  } catch(e) {}

  try {
    const token = getActiveAuthToken();
    const customer = getCustomerData();
    const res = await fetch('/api/game/raspa-fortuna/bet', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify({
        gameId: game.id,
        cardTitle: game.title,
        price: price,
        betAmount: price,
        currentBalance: balance,
        token: token || undefined,
        userId: customer?.id || undefined,
        email: customer?.email || undefined
      })
    });

    if (res.ok) {
      const data = await res.json();
      if (data && typeof data.balance === 'number' && !isNaN(data.balance)) {
        balance = Number(data.balance);
        saveBalance(false);
      }
      if (data && data.betId) {
        currentCardBetId = data.betId;
      }
      return true;
    } else {
      const err = await res.json().catch(() => ({}));
      if (res.status === 400 && err.error && err.error.includes('Saldo insuficiente')) {
        toast(err.error);
        syncUserSession();
        return false;
      }
    }
  } catch (e) {
    console.error('Erro ao debitar aposta da raspadinha:', e);
  } finally {
    isPlacingBet = false;
  }
  return true;
}

async function openGame(id) {
  activeGame = games.find(g => g.id === id);
  if (!activeGame) return;
  const price = Number(activeGame.price) || 2;
  if (balance < price) return toast('Saldo insuficiente para esta raspadinha');
  $('#scratchTitle').textContent = activeGame.title;
  modal($('#gameModal'), true);
  newScratch();
  await debitScratchBet(activeGame);
}
function saveBalance(notifyParent = true){
  $('#balance').textContent=money(balance);
  $('#headerBalanceValue').textContent=money(balance);
  if($('#profileBalanceValue'))$('#profileBalanceValue').textContent=money(balance);
  if($('#accountHeaderBalanceValue'))$('#accountHeaderBalanceValue').textContent=money(balance);
  if($('#depositScreenBalanceValue'))$('#depositScreenBalanceValue').textContent=money(balance);
  if($('#withdrawHeaderBalanceValue'))$('#withdrawHeaderBalanceValue').textContent=money(balance);
  if($('#withdrawAvailable'))$('#withdrawAvailable').textContent=money(balance);
  localStorage.setItem('rf_balance', String(balance));
  try {
    const rawUser = localStorage.getItem('rf_user') || localStorage.getItem('user');
    if (rawUser) {
      const u = JSON.parse(rawUser);
      u.balance = balance;
      localStorage.setItem('rf_user', JSON.stringify(u));
      localStorage.setItem('user', JSON.stringify(u));
    }
  } catch(e) {}
  if (notifyParent) {
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ source: 'raspa-fortuna-shell', event: 'balance', balance: balance }, '*');
      }
    } catch(e) {}
  }
}
let gameConfig = {
  rtpPercent: 88,
  bonusFrequencyPercent: 25,
  smartRtp: true,
  smartRtpEasyThreshold: 30,
  smartRtpHardThreshold: 85,
  smartRtpMaxTarget: 100
};

async function syncGameConfig() {
  try {
    const res = await fetch('/api/games/g_raspa_fortuna/config');
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data.rtpPercent === 'number') {
        gameConfig = { ...gameConfig, ...data };
      }
    }
  } catch (e) {}
}
syncGameConfig();

function choosePrize(){
  const rtp = gameConfig.rtpPercent || 88;
  const isSmart = gameConfig.smartRtp !== false;
  let winChance = (gameConfig.bonusFrequencyPercent ? gameConfig.bonusFrequencyPercent / 100 : (rtp / 100) * 0.32);

  if (isSmart) {
    if (balance < (gameConfig.smartRtpEasyThreshold || 30)) {
      winChance = Math.min(0.60, winChance * 1.4);
    } else if (balance >= (gameConfig.smartRtpMaxTarget || 100)) {
      winChance = 0.02;
    } else if (balance >= (gameConfig.smartRtpHardThreshold || 85)) {
      winChance = Math.min(0.12, winChance * 0.4);
    }
  }

  const roll = Math.random();
  if (roll > winChance) return 0;

  const price = activeGame ? activeGame.price : 2;
  const pr = Math.random();
  if (rtp >= 90) {
    if (pr < 0.06) return price * 25;
    if (pr < 0.22) return price * 10;
    if (pr < 0.50) return price * 4;
    return price * 2;
  } else if (rtp >= 70) {
    if (pr < 0.04) return price * 15;
    if (pr < 0.18) return price * 6;
    if (pr < 0.45) return price * 2.5;
    return price * 1.5;
  } else if (rtp >= 40) {
    if (pr < 0.02) return price * 10;
    if (pr < 0.12) return price * 4;
    return price;
  } else {
    if (pr < 0.02) return price * 3;
    return price * 0.5;
  }
}

function newScratch(){const prize=choosePrize();revealed=false;$('#prizeValue').textContent=money(prize);$('#prizeMessage').textContent=prize?'Parabéns! O prêmio será adicionado ao saldo.':'Não foi dessa vez. Tente novamente!';$('#scratchProgress').style.width='0';const c=$('#scratchCanvas'),ctx=c.getContext('2d');ctx.globalCompositeOperation='source-over';const grad=ctx.createLinearGradient(0,0,c.width,c.height);grad.addColorStop(0,'#dfe4df');grad.addColorStop(.5,'#89928c');grad.addColorStop(1,'#e8ece9');ctx.fillStyle=grad;ctx.fillRect(0,0,c.width,c.height);ctx.fillStyle='#4a524d';ctx.font='900 32px Inter';ctx.textAlign='center';ctx.fillText('RASPE AQUI',c.width/2,c.height/2);ctx.font='16px Inter';ctx.fillText('✦ ✦ ✦  DESCUBRA SUA SORTE  ✦ ✦ ✦',c.width/2,c.height/2+38);c.dataset.prize=prize}
function pos(e){const c=$('#scratchCanvas'),r=c.getBoundingClientRect();return{x:(e.clientX-r.left)*c.width/r.width,y:(e.clientY-r.top)*c.height/r.height}}
function scratch(e){if(!scratching)return;e.preventDefault();const c=$('#scratchCanvas'),ctx=c.getContext('2d'),p=pos(e);ctx.globalCompositeOperation='destination-out';ctx.lineCap='round';ctx.lineJoin='round';ctx.lineWidth=54;ctx.beginPath();ctx.moveTo(last.x,last.y);ctx.lineTo(p.x,p.y);ctx.stroke();last=p;checkScratch()}
async function checkScratch(){
  const c=$('#scratchCanvas'),d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
  let clear=0;
  for(let i=3;i<d.length;i+=64)if(d[i]===0)clear++;
  const pct=Math.min(100,Math.round(clear/(d.length/64)*100));
  $('#scratchProgress').style.width=pct+'%';

  if(pct>52&&!revealed){
    revealed=true;
    c.getContext('2d').clearRect(0,0,c.width,c.height);
    const prize=Number(c.dataset.prize)||0;

    if(prize>0){
      balance=parseFloat((balance+prize).toFixed(2));
      saveBalance(true);
      $('#paidTotal').textContent=money(33468+prize);
      toast(`Você ganhou ${money(prize)}!`);

      try {
        if (window.parent && window.parent !== window) {
          window.parent.postMessage({
            source: "raspa-fortuna-shell",
            event: "win",
            balance: balance,
            prize: prize
          }, "*");
        }
      } catch(e) {}

      try {
        const token=getActiveAuthToken();
        const customer=getCustomerData();
        const res=await fetch('/api/game/raspa-fortuna/win',{
          method:'POST',
          headers:{
            'Content-Type':'application/json',
            ...(token?{'Authorization':`Bearer ${token}`}:{})
          },
          body:JSON.stringify({
            prize:prize,
            prizeAmount:prize,
            betId:currentCardBetId,
            cardTitle:activeGame?.title||'Raspadinha',
            currentBalance: balance,
            token: token || undefined,
            userId:customer?.id||undefined,
            email:customer?.email||undefined
          })
        });
        if(res.ok){
          const data=await res.json();
          if(data&&typeof data.balance==='number'&&!isNaN(data.balance)){
            balance=Number(data.balance);
            saveBalance(false);
          }
        }
      }catch(e){
        console.error('Erro ao creditar vitória no servidor:',e);
      }
    }else{
      toast('Não foi dessa vez. Continue tentando!');
      // O valor da aposta já foi debitado permanentemente no backend. Se perdeu, perdeu!
    }
  }
}
const canvas=$('#scratchCanvas');canvas.addEventListener('pointerdown',e=>{e.preventDefault();scratching=true;last=pos(e);canvas.setPointerCapture?.(e.pointerId)},{passive:false});canvas.addEventListener('pointermove',scratch,{passive:false});['pointerup','pointercancel','pointerleave'].forEach(ev=>canvas.addEventListener(ev,e=>{scratching=false;if(canvas.hasPointerCapture?.(e.pointerId))canvas.releasePointerCapture(e.pointerId)}));$('#gameModal').addEventListener('dblclick',e=>e.preventDefault(),{passive:false});document.addEventListener('gesturestart',e=>{if(e.target.closest?.('#gameModal'))e.preventDefault()},{passive:false});
$('#newCardBtn').onclick=async ()=>{
  if(!activeGame)return;
  const price=Number(activeGame.price)||2;
  if(balance<price)return toast('Saldo insuficiente');
  newScratch();
  await debitScratchBet(activeGame);
};document.addEventListener('keydown',e=>{if(e.key==='Escape'){$$('.modal.open').filter(m=>m.id!=='profileModal').forEach(m=>modal(m,false));closeProfile();closeDeposit();closePrizes();closeWithdraw()}});
$('#headerBalance').onclick=openDeposit;
$('#accountNav').onclick=openProfile;
$('#profileDeposit').onclick=()=>{closeProfile();openDeposit()};
$('#profileWithdraw').onclick=openWithdraw;
$('#closeProfilePage').onclick=closeProfile;
$('#closeWithdraw').onclick=closeWithdraw;
function updateWithdrawSummary(){const value=Number($('#withdrawAmount').value)||0;$('#withdrawSummaryValue').textContent=money(value);$('#withdrawTotalValue').textContent=money(value);$$('.withdrawQuick button').forEach(b=>b.classList.toggle('selected',b.dataset.withdraw==='all'?value===balance:Number(b.dataset.withdraw)===value))}
$('#withdrawAmount').oninput=()=>{$('#withdrawReceipt').classList.remove('show');updateWithdrawSummary()};
$$('.withdrawQuick button').forEach(b=>b.onclick=()=>{$('#withdrawAmount').value=b.dataset.withdraw==='all'?balance:b.dataset.withdraw;$('#withdrawReceipt').classList.remove('show');updateWithdrawSummary()});
$('#withdrawForm').onsubmit = async (e) => {
  e.preventDefault();
  const amountInput = $('#withdrawAmount');
  const value = Number(amountInput.value);
  const keyInput = $('#withdrawPixKey');
  const key = keyInput.value.trim();
  const typeSelect = $('#pixKeyType');
  const type = typeSelect ? typeSelect.selectedOptions[0].text : 'PIX';
  const submitBtn = $('#withdrawForm button[type="submit"]');

  if (!value || isNaN(value) || value < 10) return toast('O saque mínimo é de R$ 10,00');
  if (value > balance) return toast(`Saldo insuficiente para este saque. Seu saldo atual é ${money(balance)}`);
  if (key.length < 4) return toast('Digite uma chave PIX válida');

  const origBtnContent = submitBtn ? submitBtn.innerHTML : '';
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i data-lucide="loader-2" class="spinIcon"></i><span>Processando saque...</span><small>Aprovando no sistema...</small>';
    window.lucide?.createIcons();
  }

  try {
    const token = getActiveAuthToken();
    const customer = getCustomerData();
    const res = await fetch('/api/game/raspa-fortuna/withdraw', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify({
        amount: value,
        value: value,
        pixKey: key,
        pixKeyType: type,
        currentBalance: balance,
        token: token || undefined,
        userId: customer?.id || undefined,
        email: customer?.email || undefined
      })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      toast(data.error || 'Erro ao processar saque.');
      return;
    }

    lastWithdrawTimestamp = Date.now();

    // Descontar saldo no frontend e sincronizar com o saldo aprovado do backend
    if (typeof data.balance === 'number' && !isNaN(data.balance)) {
      balance = Number(data.balance);
    } else {
      balance = Math.max(0, parseFloat((balance - value).toFixed(2)));
    }
    saveBalance(true);

    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({
          source: "raspa-fortuna-shell",
          event: "withdraw",
          balance: balance,
          withdrawnAmount: value
        }, "*");
      }
    } catch(e) {}

    const protocol = data.protocol || `RF${Date.now().toString().slice(-8)}`;
    localStorage.setItem('rf_last_withdraw', JSON.stringify({
      value,
      key,
      type,
      protocol,
      status: 'pending',
      balanceAfter: balance,
      date: new Date().toISOString()
    }));

    const receipt = $('#withdrawReceipt');
    if (receipt) {
      receipt.innerHTML = `
        <span style="background:#2ecc71; color:#06230f;"><i data-lucide="check-circle-2"></i></span>
        <div style="flex:1;">
          <b style="color:#2ecc71; font-size:14px; display:block;">Solicitação de Saque Enviada!</b>
          <div style="color:#f4f7f5; font-size:13px; margin:2px 0 3px;">Valor solicitado: <strong style="color:#2ecc71;">${money(value)}</strong> para ${type} (${key})</div>
          <div style="color:#a8d5b5; font-size:12px; font-weight:700;">Saldo restante: <strong style="color:#ffffff;">${money(balance)}</strong></div>
          <small style="display:block; color:#789882; font-size:10px; margin-top:3px;">Protocolo ${protocol} • Solicitação via PIX registrada com sucesso</small>
        </div>
      `;
      receipt.classList.add('show');
    }

    $('#withdrawForm').reset();
    updateWithdrawSummary();
    toast(`Solicitação de saque de ${money(value)} enviada com sucesso!`);
    window.lucide?.createIcons();
  } catch (err) {
    console.error('Erro na requisição de saque:', err);
    toast('Erro ao conectar com o servidor para processar saque.');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = origBtnContent;
      window.lucide?.createIcons();
    }
  }
};
$('#closeDeposit').onclick=closeDeposit;
$('#closePrizes').onclick=closePrizes;
$('#headerPrizes').onclick=e=>{e.preventDefault();openPrizes()};
$('#profileEdit').onclick=()=>toast('Edição de dados disponível no perfil completo');
$('#logoutProfile').onclick=()=>{
  localStorage.removeItem('rf_user');
  localStorage.removeItem('rf_account');
  localStorage.removeItem('user');
  localStorage.removeItem('pg_auth_token');
  localStorage.removeItem('paygateway_token');
  localStorage.removeItem('token');
  localStorage.removeItem('rf_token');
  currentAuthToken = '';
  closeProfile();
  location.reload();
};
$$('.profileRow').forEach(row=>row.onclick=()=>toast(`${row.querySelector('b').textContent}: opção disponível no protótipo`));
function updateDepositBonus(){const value=Number($('#depositAmount').value)||0,eligible=value>=75,credited=eligible?value*2:value;const note=$('.bonusNote');note.classList.toggle('bonusActive',eligible);note.innerHTML=eligible?`<i data-lucide="party-popper"></i><div><b>Bônus de 200% ativado</b><span>Você paga ${money(value)} e recebe ${money(credited)} de saldo.</span></div><strong>+${money(value)}</strong>`:`<i data-lucide="gift"></i><div><b>Deposite a partir de R$ 75</b><span>Seu depósito entra em dobro no saldo.</span></div>`;window.lucide?.createIcons()}
$$('.depositValues button').forEach(b=>b.onclick=()=>{$$('.depositValues button').forEach(x=>x.classList.remove('selected'));b.classList.add('selected');$('#depositAmount').value=b.dataset.value;$('#pixResult').classList.remove('show');stopPixPolling();updateDepositBonus()});
$('#depositAmount').oninput=()=>{$$('.depositValues button').forEach(x=>x.classList.toggle('selected',x.dataset.value===$('#depositAmount').value));$('#pixResult').classList.remove('show');stopPixPolling();updateDepositBonus()};

// Dotfy PIX State
let currentCorrelationId = null;
let pixPollInterval = null;
let pixCountdownTimer = null;
let currentAuthToken = new URLSearchParams(window.location.search).get('token') ||
  localStorage.getItem('pg_auth_token') ||
  localStorage.getItem('paygateway_token') ||
  localStorage.getItem('token') ||
  localStorage.getItem('rf_token') || '';

function getCustomerData() {
  try {
    const raw = localStorage.getItem('rf_user') || localStorage.getItem('user');
    if (raw) return JSON.parse(raw);
  } catch(e) {}
  return null;
}

function stopPixPolling() {
  if (pixPollInterval) {
    clearInterval(pixPollInterval);
    pixPollInterval = null;
  }
  if (pixCountdownTimer) {
    clearInterval(pixCountdownTimer);
    pixCountdownTimer = null;
  }
}

function startCountdown(durationSec) {
  if (pixCountdownTimer) clearInterval(pixCountdownTimer);
  let left = durationSec;
  const timerEl = $('#pixTimerText');
  const popupTimerEl = $('#pixPopupTimer');
  const updateTimer = () => {
    const m = Math.floor(left / 60);
    const s = left % 60;
    const str = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    if (timerEl) timerEl.textContent = str;
    if (popupTimerEl) popupTimerEl.textContent = str;
    if (left <= 0) {
      clearInterval(pixCountdownTimer);
      pixCountdownTimer = null;
      setPixStatus('expired', 'Tempo expirado. Gere outro PIX');
    }
    left--;
  };
  updateTimer();
  pixCountdownTimer = setInterval(updateTimer, 1000);
}

function setPixStatus(state, text) {
  const badge = $('#pixStatusBadge');
  const txt = $('#pixStatusText');
  const icon = $('#pixStatusIcon');
  const popupStatusTxt = $('#pixPulseStatusText');
  if (popupStatusTxt) popupStatusTxt.textContent = text;
  if (badge && txt) {
    badge.className = 'pixStatus';
    txt.textContent = text;
    if (state === 'checking') {
      badge.classList.add('checking');
      if (icon) icon.setAttribute('data-lucide', 'refresh-cw');
    } else if (state === 'paid') {
      badge.classList.add('paid');
      if (icon) icon.setAttribute('data-lucide', 'check-circle-2');
    } else if (state === 'expired') {
      if (icon) icon.setAttribute('data-lucide', 'alert-circle');
    } else {
      if (icon) icon.setAttribute('data-lucide', 'clock-3');
    }
  }
  window.lucide?.createIcons();
}

function handlePaymentSuccess(val, credited, newBalance) {
  stopPixPolling();
  setPixStatus('paid', 'Pagamento Confirmado!');
  if (typeof newBalance === 'number') {
    balance = newBalance;
  } else {
    balance += credited;
  }
  saveBalance();

  const stamp = `${money(val)} • ${val >= 75 ? money(credited) + ' com bônus' : 'confirmado agora'}`;
  localStorage.setItem('rf_last_deposit', stamp);
  if ($('#lastDeposit')) $('#lastDeposit').textContent = stamp;
  if ($('#profileLastDeposit')) $('#profileLastDeposit').textContent = stamp;

  // Inline notifications
  if ($('#pixSuccessNotice')) $('#pixSuccessNotice').style.display = 'flex';
  $('#step1')?.classList.remove('active');
  $('#step2')?.classList.remove('active');
  $('#step3')?.classList.add('active');

  // Popup modal success state
  const popupSuccess = $('#pixSuccessCover');
  if (popupSuccess) {
    const disp = $('#pixSuccessBalanceDisplay');
    if (disp) disp.textContent = money(credited);
    const note = $('#pixSuccessBonusNote');
    if (note) {
      note.textContent = val >= 75 ? `+ ${money(val)} de bônus (200%) creditado na hora!` : 'Saldo disponível para jogar!';
    }
    popupSuccess.style.display = 'flex';
  }

  window.lucide?.createIcons();
  toast(val >= 75 ? `🎉 Bônus ativado! ${money(credited)} adicionados!` : `🎉 Depósito de ${money(val)} confirmado!`);
}

async function checkPixStatus(correlationID, manual) {
  if (!correlationID) return;
  if (manual) {
    setPixStatus('checking', 'Consultando Dotfy PIX...');
  }
  try {
    const res = await fetch(`/api/game/raspa-fortuna/pix/status/${encodeURIComponent(correlationID)}`);
    const data = await res.json();
    if (data.success && (data.paid || data.status === 'PAID' || data.status === 'COMPLETED' || data.status === 'CONFIRMED')) {
      const val = Number($('#depositAmount').value) || data.amount || 0;
      const credited = val >= 75 ? val * 2 : val;
      handlePaymentSuccess(val, credited, data.balance);
    } else if (manual) {
      setPixStatus('pending', 'Aguardando pagamento no banco...');
      toast('Pagamento ainda não detectado. Aguarde alguns segundos.');
    }
  } catch (err) {
    if (manual) toast('Erro ao verificar status.');
  }
}

function populatePixModalData(value, pixData) {
  const isBonus = value >= 75;
  const bonusVal = isBonus ? value : 0;
  const credited = isBonus ? value * 2 : value;

  // Clean amount display
  const payDisp = $('#pixPayDisplay');
  if (payDisp) payDisp.textContent = money(value);

  // Bonus clean tag
  const bonusTag = $('#pixBonusCleanTag');
  const bonusTxt = $('#pixBonusCleanText');
  if (bonusTag && bonusTxt) {
    if (isBonus) {
      bonusTag.style.display = 'inline-flex';
      bonusTxt.textContent = `+ ${money(bonusVal)} de Bônus (Total: ${money(credited)})`;
    } else {
      bonusTag.style.display = 'none';
    }
  }

  // Real QR Code and code string from Dotfy API
  const codeString = pixData.qrCode || pixData.brCode || pixData.pixCopiaECola || pixData.emv || pixData.qr_code || pixData.qrcode || pixData.payload || '';
  let qrSrc = pixData.qrCodeImage || pixData.qr_code_image || pixData.qrCodeBase64 || pixData.qrcode_url || pixData.qrCodeUrl || '';
  if (!qrSrc && codeString) {
    qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&margin=0&data=${encodeURIComponent(codeString)}`;
  }

  const popupQr = $('#pixPopupQrImg');
  if (popupQr) {
    if (qrSrc) {
      popupQr.src = qrSrc;
      popupQr.style.display = 'block';
    } else {
      popupQr.style.display = 'none';
    }
  }
  const placeholder = $('#pixPopupQrPlaceholder');
  if (placeholder) placeholder.style.display = qrSrc ? 'none' : 'flex';

  const codeInp = $('#pixPopupCodeInput');
  if (codeInp) codeInp.value = codeString;

  const timer = $('#pixPopupTimer');
  if (timer) timer.textContent = '15:00';

  const copyLbl = $('#pixPopupCopyLabel');
  if (copyLbl) copyLbl.textContent = 'Copiar Código';
  const copyBtn = $('#pixPopupCopyBtn');
  if (copyBtn) {
    copyBtn.classList.remove('copied');
    const copyIcon = $('#pixPopupCopyIcon');
    if (copyIcon) copyIcon.setAttribute('data-lucide', 'copy');
  }

  // Reset success cover
  const cover = $('#pixSuccessCover');
  if (cover) cover.style.display = 'none';

  // Open modal
  modal($('#pixModal'), true);
  window.lucide?.createIcons();
}

$('#generatePixBtn').onclick = async () => {
  const value = Number($('#depositAmount').value);
  if (!value || value < 1) return toast('Digite um valor válido');

  stopPixPolling();
  const btn = $('#generatePixBtn');
  const origText = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<i data-lucide="loader-2" class="spinIcon"></i> Gerando PIX Oficial Dotfy...';
  window.lucide?.createIcons();

  const customer = getCustomerData();

  try {
    const resp = await fetch('/api/game/raspa-fortuna/pix/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: value,
        token: currentAuthToken,
        customer: customer ? {
          name: customer.name,
          phone: customer.phone,
          email: customer.email,
          taxID: customer.cpf || customer.taxID
        } : undefined
      })
    });
    const result = await resp.json();

    if (!result.success || !result.data) {
      throw new Error(result.error || 'Falha ao gerar cobrança PIX');
    }

    const d = result.data;
    currentCorrelationId = d.correlationID;

    // Display QR Code in inline area as well
    const codeString = d.qrCode || d.brCode || d.pixCopiaECola || d.emv || d.qr_code || d.qrcode || d.payload || '';
    let qrSrc = d.qrCodeImage || d.qr_code_image || d.qrCodeBase64 || d.qrcode_url || d.qrCodeUrl || '';
    if (!qrSrc && codeString) {
      qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&margin=0&data=${encodeURIComponent(codeString)}`;
    }

    $('#pixResult').classList.add('show');
    $('#pixQrImg').src = qrSrc;
    $('#pixQrImg').style.display = 'block';
    $('#pixQrPlaceholder').style.display = 'none';
    $('#pixCode').value = codeString;
    $('#pixAmountDisplay').textContent = money(value);
    setPixStatus('pending', 'Aguardando pagamento no banco...');
    if ($('#pixSuccessNotice')) $('#pixSuccessNotice').style.display = 'none';
    $('#step1')?.classList.remove('active');
    $('#step2')?.classList.add('active');

    // ONLY NOW: Open the popup modal with full data and QR Code!
    populatePixModalData(value, d);

    startCountdown(900);

    pixPollInterval = setInterval(() => {
      checkPixStatus(currentCorrelationId, false);
    }, 2500);

    toast('PIX Dotfy gerado! Escaneie o QR Code ou copie o código.');
  } catch (err) {
    console.error('Falha na API Dotfy:', err);
    toast(err.message || 'Erro ao gerar PIX Dotfy. Tente novamente.');
  } finally {
    btn.disabled = false;
    btn.innerHTML = origText;
    window.lucide?.createIcons();
  }
};

// Copy code in popup
const popupCopyBtn = $('#pixPopupCopyBtn');
if (popupCopyBtn) {
  popupCopyBtn.onclick = async () => {
    const inp = $('#pixPopupCodeInput');
    const code = inp ? (inp.value || inp.textContent) : '';
    if (!code || code.includes('Gerando')) return toast('Código PIX não disponível');
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      try {
        inp.select();
        document.execCommand('copy');
      } catch {}
    }
    popupCopyBtn.classList.add('copied');
    const label = $('#pixPopupCopyLabel');
    if (label) label.textContent = 'Copiado com Sucesso!';
    const icon = $('#pixPopupCopyIcon');
    if (icon) icon.setAttribute('data-lucide', 'check');
    window.lucide?.createIcons();
    toast('Código PIX copiado!');
    setTimeout(() => {
      popupCopyBtn.classList.remove('copied');
      if (label) label.textContent = 'Copiar Código';
      if (icon) icon.setAttribute('data-lucide', 'copy');
      window.lucide?.createIcons();
    }, 2500);
  };
}

// Check status in popup
const popupCheckBtn = $('#pixPopupCheckBtn');
if (popupCheckBtn) {
  popupCheckBtn.onclick = () => {
    if (!currentCorrelationId) return toast('Gere uma cobrança PIX primeiro');
    checkPixStatus(currentCorrelationId, true);
  };
}

// Play now button after payment success in popup
const successPlayBtn = $('#pixSuccessPlayBtn');
if (successPlayBtn) {
  successPlayBtn.onclick = () => {
    modal($('#pixModal'), false);
    closeDeposit();
    $$('.bottomNav a').forEach(x => x.classList.remove('active'));
    $$('.bottomNav a[href="#raspadinhas"]').forEach(x => x.classList.add('active'));
    location.hash = '#raspadinhas';
    const gamesSection = $('#raspadinhas');
    if (gamesSection) gamesSection.scrollIntoView({ behavior: 'smooth' });
    toast('Saldo pronto! Escolha uma raspadinha e boa sorte!');
  };
}

$('#copyPixBtn').onclick = async () => {
  const inp = $('#pixCode');
  const code = inp ? (inp.value || inp.textContent) : '';
  if (!code || code.includes('Gerando')) return toast('Código PIX não disponível');
  try {
    await navigator.clipboard.writeText(code);
    toast('Código PIX copiado com sucesso!');
  } catch {
    try {
      inp.select();
      document.execCommand('copy');
      toast('Código PIX copiado!');
    } catch {
      toast('Selecione e copie o código');
    }
  }
};

$('#checkPixBtn').onclick = () => {
  if (!currentCorrelationId) return toast('Gere uma cobrança PIX primeiro');
  checkPixStatus(currentCorrelationId, true);
};

$('#prizeInfoPlay').onclick=()=>{modal($('#prizeInfoModal'),false);openGame(infoGame.id)};
$$('.bottomNav a').forEach(a=>a.onclick=e=>{$$('.bottomNav a').forEach(x=>x.classList.remove('active'));a.classList.add('active');if(a.id==='depositNav'){e.preventDefault();openDeposit()}if(a.id==='prizesNav'){e.preventDefault();openPrizes()}});
renderGames();renderWinners();renderPrizeOdds();saveBalance(false);renderAccount();updateDepositBonus();$('#lastDeposit').textContent=localStorage.getItem('rf_last_deposit')||'Nenhum depósito neste aparelho';window.lucide?.createIcons();motionScan();

// Sincronizar sessão e saldo do usuário com o servidor em tempo real
let isSyncingSession = false;
async function syncUserSession() {
  if (isSyncingSession || isPlacingBet || (Date.now() - lastBetTimestamp < 3500) || (Date.now() - lastWithdrawTimestamp < 10000)) return;
  const token = getActiveAuthToken();
  if (!token) return;

  isSyncingSession = true;
  try {
    const res = await fetch('/api/auth/me', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Game-Origin': 'g_raspa_fortuna'
      }
    });
    if (res.ok) {
      const data = await res.json();
      const u = (data && data.user) ? data.user : data;
      if (u && (typeof u.balance === 'number' || u.id)) {
        currentAuthToken = token;
        localStorage.setItem('rf_token', token);
        localStorage.setItem('pg_auth_token', token);
        localStorage.setItem('paygateway_token', token);
        localStorage.setItem('rf_user', JSON.stringify(u));
        localStorage.setItem('user', JSON.stringify(u));
        if (!isPlacingBet && (Date.now() - lastBetTimestamp >= 3500) && (Date.now() - lastWithdrawTimestamp >= 10000) && typeof u.balance === 'number' && !isNaN(u.balance)) {
          balance = Number(u.balance);
          saveBalance(false);
        }
        renderAccount();
        if (typeof checkRfInfluencerStatus === 'function') {
          checkRfInfluencerStatus();
        }
      }
    }
  } catch(e) {
  } finally {
    isSyncingSession = false;
  }
}
syncUserSession();

// Sincronização contínua a cada 3s e ao reativar a aba
setInterval(syncUserSession, 3000);
window.addEventListener('focus', syncUserSession);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') syncUserSession();
});
window.addEventListener('storage', (e) => {
  if (e.key === 'rf_balance' || e.key === 'user' || e.key === 'rf_user' || e.key === 'pg_auth_token') {
    syncUserSession();
  }
});

// TriboPay Shell Bridge
(function() {
  window.addEventListener("message", function(e) {
    if (!e.data) return;
    if (e.data.source === "tribopay-parent" || e.data.event === "session" || e.data.event === "balance") {
      if (typeof e.data.balance === "number" && !isNaN(e.data.balance)) {
        if (Date.now() - lastWithdrawTimestamp >= 10000 && Date.now() - lastBetTimestamp >= 3500) {
          balance = Number(e.data.balance);
          saveBalance(false);
        }
      }
      if (e.data.token) {
        currentAuthToken = e.data.token;
        localStorage.setItem('rf_token', e.data.token);
        localStorage.setItem('pg_auth_token', e.data.token);
      }
      if (e.data.user && typeof e.data.user === "object") {
        try {
          const u = e.data.user;
          if (typeof u.balance === 'number' && !isNaN(u.balance)) {
            if (Date.now() - lastWithdrawTimestamp >= 10000 && Date.now() - lastBetTimestamp >= 3500) {
              balance = Number(u.balance);
              saveBalance(false);
            }
          }
          localStorage.setItem("rf_user", JSON.stringify(u));
          localStorage.setItem("user", JSON.stringify(u));
          if (typeof renderAccount === "function") renderAccount();
        } catch(err) {}
      }
    }
  });

  try {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ source: "raspa-fortuna-shell", event: "ready" }, "*");
    }
  } catch(e) {}
})();

// === RASPA FORTUNA INFLUENCER PROFILE MODULE ===
(function initRfInfluencerModule() {
  let currentInfluencerStats = null;

  function switchTab(mode) {
    const user = JSON.parse(localStorage.getItem('rf_user') || localStorage.getItem('user') || '{}');
    const isInf = Boolean(user && user.isInfluencer);
    if (mode === 'influencer' && !isInf) {
      mode = 'player';
    }

    const playerTab = document.getElementById('rfTabPlayer');
    const infTab = document.getElementById('rfTabInfluencer');
    const playerSec = document.getElementById('rfPlayerSection');
    const infSec = document.getElementById('rfInfluencerSection');

    if (!playerTab || !infTab || !playerSec || !infSec) return;

    if (mode === 'influencer') {
      playerTab.style.background = 'transparent';
      playerTab.style.color = '#8cb898';
      infTab.style.background = '#f59e0b';
      infTab.style.color = '#061109';
      playerSec.style.display = 'none';
      infSec.style.display = 'flex';
      loadRfInfluencerStats();
    } else {
      playerTab.style.background = '#2ecc71';
      playerTab.style.color = '#05140a';
      infTab.style.background = 'transparent';
      infTab.style.color = '#f59e0b';
      playerSec.style.display = 'block';
      infSec.style.display = 'none';
    }
    window.lucide?.createIcons();
  }

  window.checkRfInfluencerStatus = async function() {
    let user = JSON.parse(localStorage.getItem('rf_user') || localStorage.getItem('user') || 'null');
    const token = localStorage.getItem('pg_auth_token') || localStorage.getItem('paygateway_token') || localStorage.getItem('token') || '';

    // If token exists, sync latest isInfluencer status from server
    if (token) {
      try {
        const checkRes = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (checkRes.ok) {
          const freshData = await checkRes.json();
          if (freshData && typeof freshData.isInfluencer === 'boolean') {
            if (!user) user = {};
            user.isInfluencer = freshData.isInfluencer;
            try {
              localStorage.setItem('rf_user', JSON.stringify(user));
              localStorage.setItem('user', JSON.stringify(user));
            } catch(e) {}
          }
        }
      } catch (e) {}
    }

    const infTab = document.getElementById('rfTabInfluencer');
    const modeTabs = document.querySelector('.rfModeTabs');
    const playerSec = document.getElementById('rfPlayerSection');
    const infSec = document.getElementById('rfInfluencerSection');
    const isInf = Boolean(user && user.isInfluencer);

    if (infTab) {
      infTab.style.display = isInf ? 'block' : 'none';
      if (isInf) {
        infTab.innerHTML = '⭐ Modo Influenciador <span style="background: rgba(0,0,0,0.3); padding: 1px 5px; border-radius: 10px; font-size: 9px;">VIP</span>';
      }
    }
    if (modeTabs) {
      modeTabs.style.display = isInf ? 'flex' : 'none';
    }
    if (!isInf) {
      if (playerSec) playerSec.style.display = 'block';
      if (infSec) infSec.style.display = 'none';
      const playerTab = document.getElementById('rfTabPlayer');
      if (playerTab) {
        playerTab.style.background = '#2ecc71';
        playerTab.style.color = '#05140a';
      }
      if (infTab) {
        infTab.style.background = 'transparent';
        infTab.style.color = '#f59e0b';
      }
    }
  };

  async function loadRfInfluencerStats() {
    try {
      const user = JSON.parse(localStorage.getItem('rf_user') || localStorage.getItem('user') || '{}');
      if (!user || !user.isInfluencer) return;
      const email = user.email || user.phone || '';
      const token = localStorage.getItem('pg_auth_token') || localStorage.getItem('paygateway_token') || localStorage.getItem('token') || '';

      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/gen-dino/influencer-stats?email=${encodeURIComponent(email)}&game=g_raspa_fortuna`, { headers });
      const data = await res.json();

      if (res.ok && data.stats) {
        currentInfluencerStats = data.stats;
        renderRfInfluencerStats(data.stats);
      }
    } catch (err) {
      console.error('[Raspa Fortuna] Falha ao carregar métricas de influenciador:', err);
    }
  }

  function renderRfInfluencerStats(stats) {
    const sponsorName = document.getElementById('rfInfSponsorName');
    const sponsorCode = document.getElementById('rfInfSponsorCode');
    const shareInput = document.getElementById('rfInfShareInput');
    const metricReferrals = document.getElementById('rfInfMetricReferrals');
    const metricTotal = document.getElementById('rfInfMetricTotalDeposits');
    const metricPaidCount = document.getElementById('rfInfMetricPaidCount');
    const metricPaidAmount = document.getElementById('rfInfMetricPaidAmount');
    const metricBalance = document.getElementById('rfInfMetricBalance');
    const requestsList = document.getElementById('rfInfluencerRequestsList');

    if (sponsorName) {
      sponsorName.textContent = stats.responsibleAffiliate?.name || 'Afiliado Gestor Responsável';
    }
    if (sponsorCode) {
      sponsorCode.textContent = `CÓDIGO: ${stats.responsibleAffiliate?.code || 'AFILIADO'}`;
    }
    if (shareInput) {
      const code = stats.referralCode || (stats.responsibleAffiliate?.code ? `INF-${stats.responsibleAffiliate.code}` : 'VIP');
      shareInput.value = `${window.location.origin}/?ref=${code}&game=g_raspa_fortuna`;
    }

    const byGameStats = (stats.byGame && stats.byGame['g_raspa_fortuna']) || {
      referralsCount: stats.gameReferralsCount ?? 0,
      totalDepositsBrought: stats.gameTotalDepositsBrought ?? 0,
      paidDepositsCount: stats.gamePaidDepositsCount ?? 0,
      paidDepositsAmount: stats.gamePaidDepositsAmount ?? 0,
    };

    if (metricReferrals) metricReferrals.textContent = String(byGameStats.referralsCount);
    if (metricTotal) {
      metricTotal.textContent = typeof money === 'function' ? money(byGameStats.totalDepositsBrought) : `R$ ${byGameStats.totalDepositsBrought.toFixed(2)}`;
    }
    if (metricPaidCount) metricPaidCount.textContent = String(byGameStats.paidDepositsCount);
    if (metricPaidAmount) {
      metricPaidAmount.textContent = `${typeof money === 'function' ? money(byGameStats.paidDepositsAmount) : `R$ ${byGameStats.paidDepositsAmount.toFixed(2)}`} pagos`;
    }
    if (metricBalance) {
      metricBalance.textContent = typeof money === 'function' ? money(stats.commissionBalance || 0) : `R$ ${(stats.commissionBalance || 0).toFixed(2)}`;
    }

    if (requestsList) {
      if (stats.requests && stats.requests.length > 0) {
        requestsList.innerHTML = stats.requests.map(req => {
          const statusBg = req.status === 'approved' ? '#2ecc71' : req.status === 'rejected' ? '#e74c3c' : '#f39c12';
          const statusText = req.status === 'approved' ? 'Aprovado' : req.status === 'rejected' ? 'Recusado' : 'Aguardando Afiliado';
          const valFormatted = typeof money === 'function' ? money(req.amount) : `R$ ${req.amount.toFixed(2)}`;
          const dateStr = new Date(req.createdAt).toLocaleDateString('pt-BR');
          return `
            <div style="display:flex; justify-content:space-between; align-items:center; background:#08130a; border:1px solid rgba(255,255,255,0.08); border-radius:10px; padding:8px 10px; font-size:11px;">
              <div>
                <strong style="color:#ffffff; font-size:12px;">${valFormatted}</strong>
                ${req.amountReleased && req.amountReleased !== req.amount ? `<span style="color:#2ecc71; font-size:10px; margin-left:4px;">(Lib: R$ ${req.amountReleased.toFixed(2)})</span>` : ''}
                <small style="display:block; color:#6e8e78; font-size:9px;">PIX: ${req.pixKey} • ${dateStr}</small>
                ${req.rejectionReason ? `<small style="display:block; color:#e74c3c; font-size:9px;">Motivo: ${req.rejectionReason}</small>` : ''}
              </div>
              <span style="background:${statusBg}20; border:1px solid ${statusBg}50; color:${statusBg}; font-weight:800; font-size:10px; padding:3px 8px; border-radius:12px;">
                ${statusText}
              </span>
            </div>
          `;
        }).join('');
      } else {
        requestsList.innerHTML = '<div style="text-align:center; color:#6e8e78; font-size:11px; padding:12px; background:#0a140c; border-radius:10px;">Nenhuma solicitação enviada ainda.</div>';
      }
    }
  }

  // Bind UI Events
  document.addEventListener('DOMContentLoaded', () => {
    const tabPlayer = document.getElementById('rfTabPlayer');
    const tabInf = document.getElementById('rfTabInfluencer');
    const btnCopy = document.getElementById('rfBtnCopyShare');
    const btnToggleDrawer = document.getElementById('rfBtnToggleWithdrawDrawer');
    const withdrawForm = document.getElementById('rfInfluencerWithdrawForm');

    if (tabPlayer) tabPlayer.onclick = () => switchTab('player');
    if (tabInf) tabInf.onclick = () => switchTab('influencer');

    if (btnCopy) {
      btnCopy.onclick = () => {
        const shareInput = document.getElementById('rfInfShareInput');
        if (shareInput) {
          navigator.clipboard.writeText(shareInput.value).then(() => {
            if (typeof toast === 'function') toast('Link do Raspa Fortuna copiado com sucesso!');
            btnCopy.textContent = 'Copiado!';
            setTimeout(() => { btnCopy.textContent = 'Copiar'; }, 2000);
          });
        }
      };
    }

    if (btnToggleDrawer) {
      btnToggleDrawer.onclick = () => {
        const drawer = document.getElementById('rfWithdrawDrawer');
        if (drawer) {
          drawer.style.display = drawer.style.display === 'none' ? 'block' : 'none';
        }
      };
    }

    if (withdrawForm) {
      withdrawForm.onsubmit = async (e) => {
        e.preventDefault();
        const amountInput = document.getElementById('rfWithdrawAmount');
        const keyTypeInput = document.getElementById('rfWithdrawKeyType');
        const pixKeyInput = document.getElementById('rfWithdrawPixKey');
        const submitBtn = document.getElementById('rfBtnSubmitWithdraw');

        const amount = parseFloat(amountInput.value);
        if (!amount || isNaN(amount) || amount <= 0) {
          if (typeof toast === 'function') toast('Informe um valor de saque válido.');
          return;
        }

        const pixKey = pixKeyInput.value.trim();
        if (!pixKey) {
          if (typeof toast === 'function') toast('Informe a sua chave PIX.');
          return;
        }

        try {
          if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Enviando...';
          }

          const token = localStorage.getItem('pg_auth_token') || localStorage.getItem('paygateway_token') || localStorage.getItem('token') || '';
          const headers = { 'Content-Type': 'application/json' };
          if (token) headers['Authorization'] = `Bearer ${token}`;

          const res = await fetch('/api/gen-dino/influencer-withdraw', {
            method: 'POST',
            headers,
            body: JSON.stringify({
              amount,
              pixKey,
              pixKeyType: keyTypeInput.value,
              gameOrigin: 'g_raspa_fortuna'
            })
          });

          const data = await res.json();
          if (!res.ok) {
            if (typeof toast === 'function') toast(data.error || 'Erro ao solicitar saque.');
            return;
          }

          if (typeof toast === 'function') toast(data.message || 'Solicitação enviada ao afiliado gestor!');
          amountInput.value = '';
          pixKeyInput.value = '';
          const drawer = document.getElementById('rfWithdrawDrawer');
          if (drawer) drawer.style.display = 'none';

          loadRfInfluencerStats();
        } catch (err) {
          if (typeof toast === 'function') toast('Erro ao conectar com o servidor.');
        } finally {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Confirmar Solicitação de Saque';
          }
        }
      };
    }
  });
})();
