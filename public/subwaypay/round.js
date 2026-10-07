(function(root){'use strict';
const getConfig=()=>(typeof window!=='undefined'&&window.SubwayConfig)||api.config||{};
const api={
  config:{maxMultiplier:5.0,minCashoutMultiplier:1.5,targetCoins:80},
  payout(entry,coins){
    const cleanCoins=Math.max(0,Number(coins)||0);
    if(cleanCoins<=0)return 0;
    const cfg=getConfig();
    const maxM=Number(cfg.maxMultiplier)||5.0;
    const targetCoins=Number(cfg.targetCoins)||80;
    // Scale progress smoothly from 1.0x up to maxMultiplier (5x)
    // 0 coins: 1.0x
    // 20 coins: 2.0x
    // 40 coins: 3.0x
    // 60 coins: 4.0x
    // 80 coins: 5.0x (Auto Cashout!)
    const progress=Math.min(1,cleanCoins/targetCoins);
    const multiplier=Math.min(maxM,Math.max(1,1+progress*(maxM-1)));
    return Math.round(entry*multiplier*100)/100;
  },
  canCashout(entry,coins){
    const cfg=getConfig();
    const minM=Number(cfg.minCashoutMultiplier)||1.5;
    const val=api.payout(entry,coins);
    const cleanEntry=Math.max(0,Number(entry)||0);
    return val>=Math.round(cleanEntry*minM*100)/100;
  },
  settle(round,users,outcome,coins){
    if(!round||round.status!=='active')return false;
    const collected=Math.max(0,Number(coins)||0);
    if(outcome==='cashout'&&!api.canCashout(round.entry,collected))return false;
    const user=users.find(u=>u.email===round.email);
    if(!user)return false;
    round.status=outcome;
    round.coins=collected;
    if(outcome==='loss'){
      round.payout=0;
    } else {
      round.payout=api.payout(round.entry,collected);
      user.balance=Math.round((user.balance+round.payout)*100)/100;
    }
    return true;
  }
};
if(typeof module==='object')module.exports=api;
else root.SubwayRound=api;
})(typeof window==='object'?window:globalThis);
