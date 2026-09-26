(function(root){'use strict';
const getConfig=()=>(typeof window!=='undefined'&&window.SubwayConfig)||api.config||{};
const api={
  config:{maxMultiplier:4,minCashoutMultiplier:2},
  payout(entry,coins){
    const cleanCoins=Math.max(0,Number(coins)||0);
    if(cleanCoins<=0)return 0;
    const cfg=getConfig();
    const maxM=Number(cfg.maxMultiplier)||4;
    const multiplier=Math.min(maxM,(cleanCoins/100)*2);
    return Math.round(entry*multiplier*100)/100;
  },
  canCashout(entry,coins){
    const cfg=getConfig();
    const minM=Number(cfg.minCashoutMultiplier)||2;
    const val=api.payout(entry,coins);
    return val>0&&val>=Math.max(0,Number(entry)||0)*minM;
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
      // Balance was already deducted upon entry; loss awards zero
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
