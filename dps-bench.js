/* DPS Bench — banco di bilanciamento parametrico con talenti.
   4 classi ciclano il mazzo su un manichino a HP infiniti, gioco greedy.
   Il MOTORE reale governa le meccaniche (mazzo, stance, cast lungo, carte morte);
   il DANNO per carta viene da una tabella EDITABILE (PARAMS). I TALENTI sono
   toggle: aggiungono le loro carte al mazzo e applicano i bonus. Isolato: game
   monoclasse propri, non tocca la partita globale.
   DoT (Vile Poison, Garrote, Holy Fire, Living Bomb) modellati come danno-per-carta
   approssimato (valore editabile), non come tick nel turno Overlord. */
(function(){
  const ROLES=['warrior','rogue','healer','mage'];
  const LABELS={warrior:'Guerriero',rogue:'Rogue',healer:'Prete',mage:'Mago'};
  const COLORS={warrior:'#c98b4b',rogue:'#8c6fd0',healer:'#e7ca76',mage:'#5aa9e6'};

  // parametri danno editabili: [key,label,default]. Le carte da talento sono in coda.
  const PARAM_DEFS={
    warrior:[['sword_base','Spada (arma base)',1],['heroic_strike','Heroic Strike (+ arma)',2],['rend_bleed','Rend (ferita fissa)',1],['crit','Critico (+)',1],['cleave','Cleave (AOE) — talento',3]],
    rogue:[['dagger_base','Pugnale (base)',1],['backstab','Backstab (+)',2],['eviscerate','Eviscerate (+)',1],['kick','Kick',1],['crit','Critico (+)',1],['mutilate','Mutilate — talento',3],['vile_poison','Vile Poison /carta — talento',1],['garrote','Garrote /carta — talento',2],['fan_of_knives','Fan of Knives (AOE) — talento',2]],
    healer:[['holy_pulse','Impulso Sacro',1],['divine_strike','Colpo Divino (cast corto)',2],['wand','Bacchetta (FAR)',1],['crit','Critico (+)',1],['holy_fire','Holy Fire /carta — talento',2],['holy_strike','Holy Strike (completo) — talento',4]],
    mage:[['frostbolt','Frostbolt',2],['fireball','Fireball (completo)',4],['blizzard','Blizzard',1],['counterspell','Counterspell',1],['wand','Bacchetta (FAR)',1],['crit','Critico (+)',1],['cone_of_cold','Cone of Cold (AOE) — talento',2],['living_bomb','Living Bomb (AOE/carta) — talento',2]]
  };
  const PARAMS={};
  for(const r of ROLES){PARAMS[r]={};for(const [k,,d] of PARAM_DEFS[r])PARAMS[r][k]=d;}

  // talenti DPS. kind: 'bonus' (val = bonus modificabile) | 'count' (val = n. carte aggiunte,
  // carta in `card`) | 'flag' (booleano, nessun valore).
  const TALENT_DEFS={
    warrior:[
      {id:'heroic_mastery',label:'Heroic Mastery',kind:'bonus',val:2,hint:'+ Spada'},
      {id:'improved_rend',label:'Improved Rend',kind:'bonus',val:1,hint:'+ Rend'},
      {id:'cleave',label:'Cleave',kind:'count',val:2,card:'cleave',hint:'carte'},
      {id:'improved_critical',label:'Improved Critical',kind:'count',val:1,card:'critical',hint:'carte'}
    ],
    rogue:[
      {id:'improved_backstab',label:'Improved Backstab',kind:'bonus',val:2,hint:'+ Backstab'},
      {id:'evasion_tricky',label:'Evasion Tricky (flip gratis)',kind:'flag'},
      {id:'mutilate',label:'Mutilate',kind:'count',val:2,card:'mutilate',hint:'carte'},
      {id:'vile_poison',label:'Vile Poison',kind:'count',val:2,card:'vile_poison',hint:'carte'},
      {id:'garrote',label:'Garrote',kind:'count',val:4,card:'garrote',hint:'carte'},
      {id:'fan_of_knives',label:'Fan of Knives (AOE)',kind:'count',val:2,card:'fan_of_knives',hint:'carte'},
      {id:'improved_critical',label:'Improved Critical',kind:'count',val:1,card:'critical',hint:'carte'}
    ],
    healer:[
      {id:'improved_spell_damage',label:'Improved Spell Damage',kind:'bonus',val:2,hint:'+ spell'},
      {id:'holy_fire',label:'Holy Fire',kind:'count',val:3,card:'holy_fire',hint:'carte'},
      {id:'holy_strike',label:'Holy Strike',kind:'count',val:3,card:'holy_strike',hint:'carte'},
      {id:'improved_critical',label:'Improved Critical',kind:'count',val:1,card:'critical',hint:'carte'}
    ],
    mage:[
      {id:'improved_frost',label:'Improved Frost',kind:'bonus',val:1,hint:'+ Frost'},
      {id:'improved_fire',label:'Improved Fire',kind:'bonus',val:1,hint:'+ Fire'},
      {id:'cone_of_cold',label:'Cone of Cold',kind:'count',val:2,card:'cone_of_cold',hint:'carte'},
      {id:'living_bomb',label:'Living Bomb',kind:'count',val:2,card:'living_bomb',hint:'carte'},
      {id:'improved_critical',label:'Improved Critical',kind:'count',val:1,card:'critical',hint:'carte'}
    ]
  };
  const ACTIVE={warrior:new Set(),rogue:new Set(),healer:new Set(),mage:new Set()};
  const TALENT_VALS={};                                 // valori correnti (modificabili)
  for(const r of ROLES){TALENT_VALS[r]={};for(const t of TALENT_DEFS[r])if(t.kind!=='flag')TALENT_VALS[r][t.id]=t.val;}
  const isOn=(role,id)=>ACTIVE[role].has(id);
  const V=(role,id)=>TALENT_VALS[role][id]||0;          // valore del talento (se attivo)
  const bonus=(role,id)=>isOn(role,id)?V(role,id):0;    // bonus se il talento è attivo
  let TARGETS=1;                                        // n. manichini (1-4)


  // carte ad area: il danno scala col numero di bersagli
  const AOE=new Set(['cleave','holy_pulse','blizzard','cone_of_cold','fan_of_knives','living_bomb']);
  // schools per moltiplicatori mago
  const FROST=new Set(['frostbolt','blizzard','cone_of_cold']);
  const FIRE=new Set(['fireball','living_bomb']);

  function hitDamage(role,card,crit,h){
    const d=hitPerTarget(role,card,crit,h);
    return AOE.has(card)?d*TARGETS:d;                   // le carte ad area colpiscono tutti i manichini
  }
  function hitPerTarget(role,card,crit,h){
    const P=PARAMS[role];
    if(role==='warrior'){
      let d=P.sword_base;
      if(card==='sword')d+=P.heroic_strike+bonus('warrior','heroic_mastery');
      else if(card==='rend')return P.rend_bleed+bonus('warrior','improved_rend')+(crit?P.crit:0);
      else if(card==='cleave')return P.cleave+(crit?P.crit:0);
      return d+(crit?P.crit:0);
    }
    if(role==='rogue'){
      let d;
      if(card==='backstab')d=P.dagger_base+P.backstab+bonus('rogue','improved_backstab');
      else if(card==='eviscerate')d=P.dagger_base+P.eviscerate;
      else if(card==='mutilate')return P.mutilate+(crit?P.crit:0);
      else if(card==='vile_poison')return P.vile_poison;
      else if(card==='garrote')return P.garrote;
      else if(card==='fan_of_knives')return P.fan_of_knives;
      else if(card==='kick')d=P.kick;
      else d=P.dagger_base;
      return d+(crit?P.crit:0);
    }
    if(role==='healer'){
      const sd=bonus('healer','improved_spell_damage');
      if(card==='holy_pulse')return P.holy_pulse+sd+(crit?P.crit:0);
      if(card==='divine_strike')return P.divine_strike+sd;
      if(card==='holy_strike')return P.holy_strike+sd;
      if(card==='holy_fire')return P.holy_fire+sd;
      if(card==='wand')return P.wand+sd;
      return 0;
    }
    if(role==='mage'){
      let d=P[card]||0;
      if(FROST.has(card))d+=bonus('mage','improved_frost');
      if(FIRE.has(card))d+=bonus('mage','improved_fire');
      return d+(crit?P.crit:0);
    }
    return 0;
  }

  // metadati carte per il greedy value-based
  const CARD_STANCE={
    warrior:{sword:'AGGRESSIVE',cleave:'AGGRESSIVE',rend:null,bare:null},
    rogue:{backstab:'BEHIND',eviscerate:'FRONT',mutilate:'FRONT',vile_poison:null,garrote:null,kick:null,fan_of_knives:null,bare:null},
    healer:{holy_pulse:null,divine_strike:'NEAR',holy_strike:'NEAR',holy_fire:'FAR',wand:'FAR'},
    mage:{frostbolt:'NEAR',fireball:'FAR',blizzard:'FAR',cone_of_cold:'NEAR',living_bomb:'NEAR',counterspell:null,wand:'FAR'}
  };
  const DMG_CARDS={
    warrior:['cleave','sword','rend','bare'],
    rogue:['backstab','eviscerate','mutilate','vile_poison','garrote','fan_of_knives','kick','bare'],
    healer:['holy_pulse','divine_strike','holy_strike','holy_fire','wand'],
    mage:['frostbolt','fireball','blizzard','cone_of_cold','living_bomb','counterspell','wand']
  };
  const DEAD_CARDS={warrior:['taunt','parry'],rogue:['evasion','preparation'],healer:['quick_heal','slow_heal'],mage:['blink']};
  const WEAPON=new Set(['bare','wand']);                 // colpo d'arma: non consuma carta dal mazzo
  const CAST=new Set(['holy_strike','fireball']); // cast lungo: 2 azioni (Colpo Divino ora è cast corto)
  const critBoostable=(role,card)=>role==='warrior'?['sword','rend','cleave','bare'].includes(card)
    :role==='rogue'?['backstab','eviscerate','mutilate','bare'].includes(card)
    :role==='healer'?card==='holy_pulse'
    :role==='mage'?['frostbolt','blizzard','counterspell','fireball','cone_of_cold'].includes(card):false;
  // ---- Simulatore astratto (niente motore): mazzo/pesca/stance/cast/carte morte, danno dai PARAMS ----
  const BASE_DECK={
    warrior:['sword','sword','rend','rend','parry','parry','parry','taunt','taunt','critical'],
    rogue:['backstab','backstab','backstab','eviscerate','eviscerate','eviscerate','evasion','kick','preparation','critical'],
    healer:['quick_heal','quick_heal','slow_heal','slow_heal','slow_heal','divine_strike','divine_strike','holy_pulse','holy_pulse','critical'],
    mage:['frostbolt','frostbolt','frostbolt','critical','blizzard','counterspell','fireball','fireball','fireball','blink']
  };
  const START_STANCE={warrior:'AGGRESSIVE',rogue:'FRONT',healer:'FAR',mage:'FAR'};
  const HAND_LIMIT=5;
  let AI_MODE='greedy', ROLL_DEPTH=6, ROLL_COUNT=4;      // rollout Monte-Carlo
  function shuf(a){a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
  function dump(s,c){const i=s.hand.indexOf(c);if(i>=0){s.hand.splice(i,1);s.discard.push(c);}}
  function refillS(s){while(s.hand.length<HAND_LIMIT){if(!s.draw.length){if(!s.discard.length)break;s.draw=shuf(s.discard);s.discard=[];}s.hand.push(s.draw.pop());}}
  function clone(s){return {role:s.role,deck:s.deck,draw:[...s.draw],discard:[...s.discard],hand:[...s.hand],stance:s.stance,casting:s.casting};}
  function candidates(s){
    const role=s.role, crit=s.hand.includes('critical'), out=[];
    const flipFree=(role==='rogue'&&isOn('rogue','evasion_tricky'));
    for(const card of DMG_CARDS[role]){
      if(!WEAPON.has(card)&&!s.hand.includes(card))continue;
      const st=CARD_STANCE[role][card], needFlip=st&&st!==s.stance, flipCost=needFlip?(flipFree?0:1):0;
      const cast=CAST.has(card)&&s.casting!==card;
      const boost=crit&&critBoostable(role,card);
      const dmg=hitDamage(role,card,boost,null);
      out.push({card,st,needFlip,flipCost,cast,crit:boost,dmg,val:dmg/((cast?2:1)+flipCost)});
    }
    return out;
  }
  // applica UNA azione (flip / gioca / completa cast / cicla carta morta); ritorna il danno
  function actOne(s, choose){
    const role=s.role;
    if(s.casting&&s.hand.includes(s.casting)){          // completa cast lungo
      const card=s.casting, st=CARD_STANCE[role][card];
      if(st&&st!==s.stance){s.stance=st;return 0;}
      dump(s,card); s.casting=null; return hitDamage(role,card,false,null);
    }
    const cands=candidates(s);
    if(!cands.length)return 0;
    const pick=choose(cands,s);
    return applyPick(s,pick);
  }
  function applyPick(s,pick){
    const role=s.role;
    if(WEAPON.has(pick.card)){                            // colpo d'arma: se ci sono carte morte, ciclane una
      const dead=DEAD_CARDS[role].find(c=>s.hand.includes(c));
      if(dead){dump(s,dead);return 0;}
    }
    if(pick.needFlip){s.stance=pick.st; if(pick.flipCost)return 0;} // flip a pagamento = questa azione
    if(pick.crit)dump(s,'critical');
    if(pick.cast){dump(s,pick.card);s.casting=pick.card;return 0;}  // carica
    if(!WEAPON.has(pick.card))dump(s,pick.card);
    return pick.dmg;
  }
  const greedy=(cands)=>cands.reduce((a,b)=>b.val>a.val?b:a);
  const rnd=(cands)=>cands[Math.floor(Math.random()*cands.length)];
  function rolloutChoose(cands,s){                        // Monte-Carlo: media di ROLL_COUNT playout casuali a profondità ROLL_DEPTH
    let best=null;
    for(const c of cands){
      let tot=0;
      for(let i=0;i<ROLL_COUNT;i++){
        const cl=clone(s);
        tot+=applyPick(cl,c);
        for(let k=1;k<ROLL_DEPTH;k++){ if(cl.hand.length<2)refillS(cl); tot+=actOne(cl,rnd); }
      }
      const avg=tot/ROLL_COUNT;
      if(!best||avg>best.avg)best={c,avg};
    }
    return best.c;
  }
  function newSim(role){
    const deck=[...BASE_DECK[role]];
    for(const tal of TALENT_DEFS[role]) if(tal.kind==='count'&&isOn(role,tal.id)) for(let i=0;i<V(role,tal.id);i++) deck.push(tal.card);
    return {role, deck, draw:shuf(deck), discard:[], hand:[], stance:START_STANCE[role], casting:null, damage:0, actions:0, wasted:0, rounds:0};
  }
  function advance(sim, rounds){
    const choose=AI_MODE==='rollout'?rolloutChoose:greedy;
    for(let r=0;r<rounds;r++){
      sim.rounds++; refillS(sim);
      for(let a=0;a<3;a++){
        const dmg=actOne(sim,choose);
        sim.actions++; sim.damage+=(dmg>0?dmg:0); if(dmg<=0)sim.wasted++;
      }
    }
  }

  let sims=[], timer=null;
  const fmt=n=>Number.isInteger(n)?n:n.toFixed(2);
  function refreshCards(){
    const maxDpa=Math.max(0.001,...sims.map(s=>s.actions?s.damage/s.actions:0));
    for(const s of sims){
      const dpa=s.actions?s.damage/s.actions:0, dpr=s.rounds?s.damage/s.rounds:0, wpct=s.actions?100*s.wasted/s.actions:0;
      const c=document.getElementById('dpsc-'+s.role);
      c.querySelector('.dpsc-total').textContent=Math.round(s.damage);
      c.querySelector('.dpsc-dpa').textContent=fmt(dpa);
      c.querySelector('.dpsc-dpr').textContent=fmt(dpr);
      c.querySelector('.dpsc-acts').textContent=s.actions;
      c.querySelector('.dpsc-rounds').textContent=s.rounds;
      c.querySelector('.dpsc-wasted').textContent=`${s.wasted} (${wpct.toFixed(0)}%)`;
      const bar=c.querySelector('.dpsc-bar');
      bar.style.width=(100*dpa/maxDpa).toFixed(1)+'%'; bar.textContent=fmt(dpa);
    }
  }
  function resetSims(){sims=ROLES.map(newSim);refreshCards();}
  function tick(){const n=AI_MODE==='rollout'?3:12;for(const s of sims)advance(s,n);refreshCards();}
  function run(){if(timer)return;if(!sims.length)resetSims();timer=setInterval(tick,60);setBtns(true);}
  function stop(){clearInterval(timer);timer=null;setBtns(false);}
  function reset(){const wasRunning=!!timer;stop();resetSims();if(wasRunning)run();}
  function setBtns(running){document.getElementById('dps-run').disabled=running;document.getElementById('dps-stop').disabled=!running;}

  function buildUI(){
    if(document.getElementById('benchPage'))return;
    const style=document.createElement('style');
    style.textContent=`
      #benchPage .dps-controls{display:flex;gap:8px;align-items:center;margin-bottom:14px}
      #benchPage .dps-tgt{min-width:34px;padding:6px 9px}
      #benchPage .dps-tgt.active,#benchPage .dps-ai.active{background:var(--gold);color:#19150b;border-color:#e7ca76}
      #benchPage .dps-ai{padding:6px 9px}
      #benchPage .dps-cards,#benchPage .dps-params{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
      #benchPage .dps-params{margin-top:14px;align-items:start}
      @media(max-width:900px){#benchPage .dps-cards,#benchPage .dps-params{grid-template-columns:1fr 1fr}}
      .dpsc{background:#18281d;border:1px solid var(--edge);border-radius:14px;padding:14px}
      .dpsc h3{margin:0 0 4px;font-size:1.05rem}
      .dpsc .dpsc-sub{color:var(--muted);font-size:11px;margin-bottom:6px}
      .dpsc .dpsc-track{height:26px;background:#101a13;border-radius:7px;overflow:hidden;border:1px solid #2c3a2f;margin-bottom:12px}
      .dpsc .dpsc-bar{height:100%;display:flex;align-items:center;justify-content:flex-end;padding-right:7px;font-weight:800;font-size:12px;color:#101a13;transition:width .12s linear;min-width:22px}
      .dpsc table{width:100%;border-collapse:collapse;font-size:12px}
      .dpsc td{padding:3px 0;color:var(--muted)} .dpsc td.v{text-align:right;color:var(--ink);font-weight:700}
      .dparam{background:#141f18;border:1px solid var(--edge);border-radius:12px;padding:12px}
      .dparam h4{margin:0 0 8px;font-size:12px;letter-spacing:.05em;text-transform:uppercase}
      .dparam .prow{display:flex;justify-content:space-between;align-items:center;gap:8px;margin:5px 0}
      .dparam .prow label{font-size:12px;color:var(--muted);flex:1;min-width:0}
      .dparam input[type=number]{width:56px;padding:5px 6px;text-align:center;font:inherit;font-weight:700;color:var(--ink);background:#0f1712;border:1px solid #3a4a3d;border-radius:7px}
      .dparam .thead{margin:12px 0 4px;font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:#8a9287;border-top:1px solid #2c3a2f;padding-top:9px}
      .dparam .trow{display:flex;align-items:center;gap:7px;margin:4px 0}
      .dparam .trow label{font-size:12px;color:var(--ink);cursor:pointer;flex:1;min-width:0}
      .dparam .trow .tval{width:46px;padding:4px 5px;text-align:center;font:inherit;font-weight:700;color:var(--ink);background:#0f1712;border:1px solid #3a4a3d;border-radius:6px}
      .dparam .trow .thint{font-size:10px;color:#8a9287;width:56px}
      #benchPage .dps-note{color:#8a9287;font-size:11px;margin-top:14px;line-height:1.5}`;
    document.head.append(style);

    const page=document.createElement('section');
    page.id='benchPage'; page.className='app-page'; page.hidden=true;
    page.innerHTML=`
      <div class="card">
        <h2>DPS Bench — manichino</h2>
        <p class="muted">Le 4 classi ciclano il mazzo su un manichino a HP infiniti, giocando per il massimo danno. Valori di danno e talenti sono modificabili qui sotto: le curve si ricalcolano dal vivo.</p>
        <div class="dps-controls">
          <button id="dps-run">▶ Run</button>
          <button id="dps-stop" class="secondary" disabled>■ Stop</button>
          <button id="dps-reset" class="secondary">↺ Reset</button>
          <span style="display:flex;align-items:center;gap:6px">
            <span style="color:var(--muted);font-size:12px">AI:</span>
            <button class="secondary dps-ai active" data-ai="greedy">Greedy</button>
            <button class="secondary dps-ai" data-ai="rollout">Rollout MC</button>
          </span>
          <span class="dps-roll" hidden style="display:flex;align-items:center;gap:6px">
            <label style="color:var(--muted);font-size:12px">profondità (d6)<input id="dps-depth" type="number" min="1" max="12" value="6" style="width:48px;margin-left:5px;padding:5px 6px;text-align:center;font:inherit;font-weight:700;color:var(--ink);background:#0f1712;border:1px solid #3a4a3d;border-radius:6px"></label>
            <label style="color:var(--muted);font-size:12px">rollout<input id="dps-count" type="number" min="1" max="30" value="4" style="width:48px;margin-left:5px;padding:5px 6px;text-align:center;font:inherit;font-weight:700;color:var(--ink);background:#0f1712;border:1px solid #3a4a3d;border-radius:6px"></label>
          </span>
          <span class="dps-targets" style="margin-left:auto;display:flex;align-items:center;gap:6px">
            <span style="color:var(--muted);font-size:12px">Manichini:</span>
            ${[1,2,3,4].map(n=>`<button class="secondary dps-tgt${n===1?' active':''}" data-targets="${n}">${n}</button>`).join('')}
          </span>
        </div>
        <div class="dps-cards">
          ${ROLES.map(r=>`
            <article class="dpsc" id="dpsc-${r}" style="border-top:3px solid ${COLORS[r]}">
              <h3 style="color:${COLORS[r]}">${LABELS[r]}</h3>
              <div class="dpsc-sub">danno / azione</div>
              <div class="dpsc-track"><div class="dpsc-bar" style="width:0;background:${COLORS[r]}">0</div></div>
              <table>
                <tr><td>Danno totale</td><td class="v dpsc-total">0</td></tr>
                <tr><td>Danno / azione</td><td class="v dpsc-dpa">0</td></tr>
                <tr><td>Danno / round</td><td class="v dpsc-dpr">0</td></tr>
                <tr><td>Azioni</td><td class="v dpsc-acts">0</td></tr>
                <tr><td>Round</td><td class="v dpsc-rounds">0</td></tr>
                <tr><td>Azioni sprecate</td><td class="v dpsc-wasted">0</td></tr>
              </table>
            </article>`).join('')}
        </div>
        <h3 style="margin:20px 0 0">Valori carte &amp; Talenti</h3>
        <div class="dps-params">
          ${ROLES.map(r=>`
            <div class="dparam" style="border-left:3px solid ${COLORS[r]}">
              <h4 style="color:${COLORS[r]}">${LABELS[r]}</h4>
              ${PARAM_DEFS[r].map(([k,label,d])=>`
                <div class="prow"><label for="p-${r}-${k}">${label}</label>
                <input id="p-${r}-${k}" type="number" min="0" max="30" step="1" value="${d}" data-role="${r}" data-key="${k}"></div>`).join('')}
              <div class="thead">Talenti</div>
              ${TALENT_DEFS[r].map(t=>`
                <div class="trow"><input type="checkbox" id="t-${r}-${t.id}" data-trole="${r}" data-tid="${t.id}"><label for="t-${r}-${t.id}">${t.label}</label>${t.kind==='flag'?'':`<input class="tval" type="number" min="0" max="12" step="1" value="${t.val}" data-tvrole="${r}" data-tvid="${t.id}" title="${t.hint||''}"><span class="thint">${t.hint||''}</span>`}</div>`).join('')}
            </div>`).join('')}
        </div>
        <p class="dps-note">Il simulatore gestisce mazzo, pesca, stance e cast lungo; il danno per colpo viene dai valori qui sopra. AI: <b>Greedy</b> = ogni azione sceglie il miglior danno/azione; <b>Rollout MC</b> = per ogni azione simula più giocate future casuali (profondità = d6) e sceglie la mossa col miglior esito medio (lookahead). I talenti aggiungono le loro carte al mazzo e applicano i bonus. Assunzioni: cambio stance = 1 azione (gratis per il Rogue con Evasion Tricky); carte non-danno = 0 danni; cast lungo (Fireball, Holy Strike) = 2 carte + 2 azioni (Colpo Divino è cast corto: 1 carta, 1 azione); i DoT (Vile Poison, Garrote, Holy Fire, Living Bomb) sono modellati come danno-per-carta approssimato, non come tick nel turno Overlord — tara quei valori a piacere. Cambiare qualcosa azzera e ricalcola.</p>
      </div>`;
    document.querySelector('main').append(page);

    const tab=document.createElement('button');
    tab.className='page-tab'; tab.dataset.page='benchPage'; tab.textContent='DPS Bench';
    document.querySelector('.page-tabs').append(tab);
    const pages=()=>[...document.querySelectorAll('.app-page')];
    document.querySelectorAll('.page-tab').forEach(btn=>{
      if(!btn.dataset.page)return;
      btn.onclick=()=>{
        document.querySelectorAll('.page-tab').forEach(x=>x.classList.toggle('active',x===btn));
        pages().forEach(p=>p.hidden=(p.id!==btn.dataset.page));
        if(btn.dataset.page!=='benchPage')stop();
      };
    });
    function openBench(){
      const setup=document.getElementById('campaignSetup'); if(setup)setup.hidden=true;
      document.querySelectorAll('.page-tab').forEach(x=>x.classList.toggle('active',x===tab));
      pages().forEach(p=>p.hidden=(p.id!=='benchPage'));
    }
    (function addSetupEntry(tries){
      const panel=document.querySelector('#campaignSetup .campaign-controls');
      if(!panel){ if(tries<40)setTimeout(()=>addSetupEntry(tries+1),150); return; }
      if(panel.querySelector('[data-dps-entry]'))return;
      const entry=document.createElement('button');
      entry.className='secondary'; entry.type='button'; entry.dataset.dpsEntry=''; entry.textContent='🎯 DPS Bench';
      entry.onclick=openBench; panel.append(entry);
    })(0);

    page.querySelectorAll('.dparam input[data-key]').forEach(inp=>{
      inp.oninput=()=>{PARAMS[inp.dataset.role][inp.dataset.key]=Math.max(0,+inp.value||0);reset();};
    });
    page.querySelectorAll('.dparam input[data-tvid]').forEach(inp=>{
      inp.oninput=()=>{TALENT_VALS[inp.dataset.tvrole][inp.dataset.tvid]=Math.max(0,+inp.value||0);reset();};
    });
    page.querySelectorAll('.dparam input[type=checkbox]').forEach(chk=>{
      chk.onchange=()=>{const s=ACTIVE[chk.dataset.trole];chk.checked?s.add(chk.dataset.tid):s.delete(chk.dataset.tid);reset();};
    });

    page.querySelectorAll('.dps-tgt').forEach(btn=>{
      btn.onclick=()=>{TARGETS=+btn.dataset.targets;page.querySelectorAll('.dps-tgt').forEach(b=>b.classList.toggle('active',b===btn));reset();};
    });
    page.querySelectorAll('.dps-ai').forEach(btn=>{
      btn.onclick=()=>{AI_MODE=btn.dataset.ai;page.querySelectorAll('.dps-ai').forEach(b=>b.classList.toggle('active',b===btn));page.querySelector('.dps-roll').hidden=(AI_MODE!=='rollout');reset();};
    });
    document.getElementById('dps-depth').oninput=e=>{ROLL_DEPTH=Math.max(1,Math.min(12,+e.target.value||6));reset();};
    document.getElementById('dps-count').oninput=e=>{ROLL_COUNT=Math.max(1,Math.min(30,+e.target.value||4));reset();};

    document.getElementById('dps-run').onclick=run;
    document.getElementById('dps-stop').onclick=stop;
    document.getElementById('dps-reset').onclick=reset;
    resetSims();
  }

  function init(){
    if(!document.querySelector('.page-tabs')||typeof startBoardCampaign!=='function'){setTimeout(init,150);return;}
    buildUI();
  }
  if(document.readyState==='complete'||document.readyState==='interactive')init();
  else window.addEventListener('DOMContentLoaded',init);
})();
