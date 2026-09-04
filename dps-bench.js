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
  const T='enemy:99:99';

  // parametri danno editabili: [key,label,default]. Le carte da talento sono in coda.
  const PARAM_DEFS={
    warrior:[['sword_base','Spada (arma base)',1],['heroic_strike','Heroic Strike (+ arma)',1],['rend_bleed','Rend — sanguinamento extra',0],['crit','Critico (+)',1],['cleave','Cleave (AOE) — talento',2]],
    rogue:[['dagger_base','Pugnale (base)',1],['backstab','Backstab (+)',2],['eviscerate','Eviscerate (+)',1],['kick','Kick',1],['crit','Critico (+)',1],['mutilate','Mutilate — talento',3],['vile_poison','Vile Poison /carta — talento',1],['garrote','Garrote /carta — talento',2]],
    healer:[['holy_pulse','Impulso Sacro',1],['divine_strike','Colpo Divino (completo)',2],['wand','Bacchetta (FAR)',1],['crit','Critico (+)',1],['holy_fire','Holy Fire /carta — talento',2],['holy_strike','Holy Strike (completo) — talento',4]],
    mage:[['frostbolt','Frostbolt',2],['fireball','Fireball (completo)',4],['blizzard','Blizzard',1],['counterspell','Counterspell',1],['wand','Bacchetta (FAR)',1],['cone_of_cold','Cone of Cold (AOE) — talento',2],['living_bomb','Living Bomb /carta — talento',2]]
  };
  const PARAMS={};
  for(const r of ROLES){PARAMS[r]={};for(const [k,,d] of PARAM_DEFS[r])PARAMS[r][k]=d;}

  // talenti rilevanti per il DPS: id, etichetta, carte aggiunte, flag h.talents impostati
  const TALENT_DEFS={
    warrior:[
      {id:'heroic_mastery',label:'Heroic Mastery (Spada +1)',flags:{heroic_mastery:2}},
      {id:'improved_rend',label:'Improved Rend (Rend +1)',flags:{improved_rend:1}},
      {id:'cleave',label:'Cleave (+2 carte)',cards:['cleave','cleave']},
      {id:'improved_critical',label:'Improved Critical (+1 Critico)',cards:['critical']}
    ],
    rogue:[
      {id:'improved_backstab',label:'Improved Backstab (Backstab +2)',flags:{improved_backstab:2}},
      {id:'evasion_tricky',label:'Evasion Tricky (flip gratis)',flags:{evasion_tricky:1}},
      {id:'mutilate',label:'Mutilate (+2 carte)',cards:['mutilate','mutilate']},
      {id:'vile_poison',label:'Vile Poison (+2 carte)',cards:['vile_poison','vile_poison']},
      {id:'garrote',label:'Garrote (+4 carte)',cards:['garrote','garrote','garrote','garrote']},
      {id:'improved_critical',label:'Improved Critical (+1 Critico)',cards:['critical']}
    ],
    healer:[
      {id:'improved_spell_damage',label:'Improved Spell Damage (+2 spell)',flags:{improved_spell_damage:2}},
      {id:'holy_fire',label:'Holy Fire (+3 carte)',cards:['holy_fire','holy_fire','holy_fire']},
      {id:'holy_strike',label:'Holy Strike (+3 carte)',cards:['holy_strike','holy_strike','holy_strike']},
      {id:'improved_critical',label:'Improved Critical (+1 Critico)',cards:['critical']}
    ],
    mage:[
      {id:'improved_frost',label:'Improved Frost (+1 Frost)',flags:{improved_frost:1}},
      {id:'improved_fire',label:'Improved Fire (+1 Fire)',flags:{improved_fire:1}},
      {id:'cone_of_cold',label:'Cone of Cold (+2 carte)',cards:['cone_of_cold','cone_of_cold']},
      {id:'living_bomb',label:'Living Bomb (+2 carte)',cards:['living_bomb','living_bomb']}
    ]
  };
  const ACTIVE={warrior:new Set(),rogue:new Set(),healer:new Set(),mage:new Set()};
  const isOn=(role,id)=>ACTIVE[role].has(id);
  let TARGETS=1;                                        // n. manichini (1-4)

  function mkDummy(id){return {id,type:'dummy',hp:1e9,maxHp:1e9,damage:0,draw:[],discard:[],bleeds:[],bleedCount:0,taunted:false,casting:null,holyFireDots:0,livingBomb:0,vilePoison:0,garrote:0,frostVulnerable:false,firePierced:false};}
  const has=(h,c)=>h.hand.includes(c);

  // carte ad area: il danno scala col numero di bersagli
  const AOE=new Set(['cleave','holy_pulse','blizzard','cone_of_cold']);
  // schools per moltiplicatori mago
  const FROST=new Set(['frostbolt','blizzard','cone_of_cold']);
  const FIRE=new Set(['fireball','living_bomb']);

  function hitDamage(role,card,crit,h){
    const d=hitPerTarget(role,card,crit,h);
    return AOE.has(card)?d*TARGETS:d;                   // le carte ad area colpiscono tutti i manichini
  }
  function hitPerTarget(role,card,crit,h){
    const P=PARAMS[role], t=h.talents||{};
    if(role==='warrior'){
      let d=P.sword_base;
      if(card==='sword')d+=P.heroic_strike+(t.heroic_mastery>=2?1:0);
      else if(card==='rend')d+=P.rend_bleed+(t.improved_rend||0);
      else if(card==='cleave')return P.cleave+(crit?P.crit:0);
      return d+(crit?P.crit:0);
    }
    if(role==='rogue'){
      let d;
      if(card==='backstab')d=P.dagger_base+P.backstab+(t.improved_backstab>=2?2:0);
      else if(card==='eviscerate')d=P.dagger_base+P.eviscerate;
      else if(card==='mutilate')return P.mutilate+(crit?P.crit:0);
      else if(card==='vile_poison')return P.vile_poison;
      else if(card==='garrote')return P.garrote;
      else if(card==='kick')d=P.kick;
      else d=P.dagger_base;
      return d+(crit?P.crit:0);
    }
    if(role==='healer'){
      const sd=t.improved_spell_damage>=2?2:0;
      if(card==='holy_pulse')return P.holy_pulse+sd+(crit?P.crit:0);
      if(card==='divine_strike')return P.divine_strike+sd;
      if(card==='holy_strike')return P.holy_strike+sd;
      if(card==='holy_fire')return P.holy_fire+sd;
      if(card==='wand')return P.wand+sd;
      return 0;
    }
    if(role==='mage'){
      let d=P[card]||0;
      if(FROST.has(card))d+=(t.improved_frost||0);
      if(FIRE.has(card))d+=(t.improved_fire||0);
      return d;
    }
    return 0;
  }

  // decisione greedy; ritorna {acts, card|null, crit}
  function stepR(g,h,role,d){
    const pos=()=>h.board.position.card;
    const flipCost=(role==='rogue'&&isOn('rogue','evasion_tricky'))?0:1; // Evasion Tricky = flip gratis
    const flip=to=>{h.board.position.card=to; if(flipCost)h.actions--; return {acts:flipCost,card:null};};
    const hit=(card,crit)=>({acts:1,card,crit:!!crit});
    if(role==='warrior'){
      const crit=has(h,'critical')&&!h.criticalArmed?(toggleCritical(g,h),true):h.criticalArmed;
      if(has(h,'cleave')){toggleWarriorTechnique(g,h,'cleave',h.hand.indexOf('cleave'));useSword(g,h,T);return hit('cleave',crit);}
      if(has(h,'sword')){toggleWarriorTechnique(g,h,'sword',h.hand.indexOf('sword'));useSword(g,h,T);return hit('sword',crit);}
      if(has(h,'rend')){toggleWarriorTechnique(g,h,'rend',h.hand.indexOf('rend'));useSword(g,h,T);return hit('rend',crit);}
      if(has(h,'taunt')){play(g,h,'taunt',T);return {acts:1,card:null};}
      if(has(h,'parry')){const i=h.hand.indexOf('parry');h.hand.splice(i,1);h.discard.push('parry');h.actions--;return {acts:1,card:null};}
      useSword(g,h,T);return hit('bare',crit);
    }
    if(role==='rogue'){
      const crit=has(h,'critical')&&!h.criticalArmed?(toggleCritical(g,h),true):h.criticalArmed;
      if(has(h,'backstab')){if(pos()!=='BEHIND')return flip('BEHIND');h.rogueTechniqueArmed='backstab';h.rogueTechniqueIndex=h.hand.indexOf('backstab');useDagger(g,h,T,'left');return hit('backstab',crit);}
      if(has(h,'mutilate')){if(pos()!=='FRONT')return flip('FRONT');play(g,h,'mutilate',T);return hit('mutilate',crit);}
      if(has(h,'eviscerate')){if(pos()!=='FRONT')return flip('FRONT');h.rogueTechniqueArmed='eviscerate';h.rogueTechniqueIndex=h.hand.indexOf('eviscerate');useDagger(g,h,T,'left');return hit('eviscerate',crit);}
      if(has(h,'vile_poison')){if(pos()!=='FRONT'&&pos()!=='BEHIND'){};play(g,h,'vile_poison',T);return hit('vile_poison',false);}
      if(has(h,'garrote')){play(g,h,'garrote',T);return hit('garrote',false);}
      if(has(h,'kick')){play(g,h,'kick',T);return hit('kick',false);}
      if(has(h,'preparation')){play(g,h,'preparation',T);h.preparationPending=0;return {acts:1,card:null};}
      if(has(h,'evasion')){const i=h.hand.indexOf('evasion');h.hand.splice(i,1);h.discard.push('evasion');h.actions--;return {acts:1,card:null};}
      useDagger(g,h,T,'left');return hit('bare',crit);
    }
    if(role==='healer'){
      if(h.divineStrikeCasting&&has(h,'divine_strike')){if(pos()!=='NEAR')return flip('NEAR');play(g,h,'divine_strike',T);return hit('divine_strike',false);}
      if(h.holyStrikeCasting&&has(h,'holy_strike')){if(pos()!=='NEAR')return flip('NEAR');play(g,h,'holy_strike',T);return hit('holy_strike',false);}
      const crit=has(h,'critical')&&!h.criticalArmed?(toggleCritical(g,h),true):h.criticalArmed;
      if(has(h,'holy_pulse')){play(g,h,'holy_pulse',T);return hit('holy_pulse',crit);}
      if(has(h,'holy_fire')){if(pos()!=='FAR')return flip('FAR');play(g,h,'holy_fire',T);return hit('holy_fire',false);}
      if(has(h,'holy_strike')&&!h.holyStrikeCasting){if(pos()!=='NEAR')return flip('NEAR');play(g,h,'holy_strike',T);return {acts:1,card:null};} // carica
      if(has(h,'divine_strike')&&!h.divineStrikeCasting){if(pos()!=='NEAR')return flip('NEAR');play(g,h,'divine_strike',T);return {acts:1,card:null};} // carica
      if(pos()==='FAR'){useWand(g,h,T);return hit('wand',false);}
      if(has(h,'quick_heal')){const i=h.hand.indexOf('quick_heal');h.hand.splice(i,1);h.discard.push('quick_heal');h.actions--;return {acts:1,card:null};}
      if(has(h,'slow_heal')){const i=h.hand.indexOf('slow_heal');h.hand.splice(i,1);h.discard.push('slow_heal');h.actions--;return {acts:1,card:null};}
      return flip('FAR');
    }
    if(role==='mage'){
      if(h.fireballCasting&&has(h,'fireball')){if(pos()!=='FAR')return flip('FAR');playMageCard(g,h,'fireball',T);return hit('fireball',false);}
      if(has(h,'frostbolt')){if(pos()!=='NEAR')return flip('NEAR');playMageCard(g,h,'frostbolt',T);return hit('frostbolt',false);}
      if(has(h,'cone_of_cold')){if(pos()!=='NEAR')return flip('NEAR');playMageCard(g,h,'cone_of_cold',T);return hit('cone_of_cold',false);}
      if(has(h,'living_bomb')){if(pos()!=='NEAR')return flip('NEAR');playMageCard(g,h,'living_bomb',T);return hit('living_bomb',false);}
      if(has(h,'fireball')&&!h.fireballCasting){if(pos()!=='FAR')return flip('FAR');playMageCard(g,h,'fireball',T);return {acts:1,card:null};} // carica
      if(has(h,'blizzard')){if(pos()!=='FAR')return flip('FAR');playMageCard(g,h,'blizzard',T);return hit('blizzard',false);}
      if(has(h,'counterspell')){playMageCard(g,h,'counterspell',T);return hit('counterspell',false);}
      if(has(h,'blink')){const i=h.hand.indexOf('blink');h.hand.splice(i,1);h.discard.push('blink');return {acts:0,card:null};}
      if(pos()!=='FAR')return flip('FAR');useMageWand(g,h,T);return hit('wand',false);
    }
    return {acts:1,card:null};
  }

  function applyTalents(g,h,role){
    for(const tal of TALENT_DEFS[role]){
      if(!isOn(role,tal.id))continue;
      if(tal.flags)Object.assign(h.talents,tal.flags);
      if(tal.cards)for(const c of tal.cards)h.deck.push(c);
    }
    h.draw=shuffle(h.deck); h.discard=[]; h.hand=[]; refill(h,g);
  }
  function buildSim(role){
    const savedGame=game, savedRender=render;
    render=function(){};
    try{ startBoardCampaign([role],'heroic'); }catch(e){}
    const g=game;
    game=savedGame; render=savedRender;
    g.enemies=Array.from({length:TARGETS},(_,i)=>mkDummy(99-i)); g.state='playing'; g.activeRole=role; g.round=1;
    g.currentEncounter={firstKillRound:null,won:false,size:1};
    const h=g.party[0];
    applyTalents(g,h,role);
    return {role, g, h, dummy:g.enemies[0], damage:0, actions:0, wasted:0, rounds:0};
  }
  function advance(sim, roundsToRun){
    const {g,h,role,dummy}=sim;
    for(let r=0;r<roundsToRun;r++){
      sim.rounds++; h.actions=CONFIG.actionsPerRound; refill(h,g);
      let guard=0;
      while(h.actions>0 && guard++<30){
        const aBefore=h.actions, res=stepR(g,h,role,dummy);
        if(!res){h.actions--;sim.actions++;sim.wasted++;continue;}
        if(res.acts===0)continue;
        if(h.actions===aBefore)h.actions--;
        sim.actions+=res.acts;
        const dmg=res.card?hitDamage(role,res.card,res.crit,h):0;
        sim.damage+=dmg; if(dmg<=0)sim.wasted+=res.acts;
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
  function resetSims(){sims=ROLES.map(buildSim);refreshCards();}
  function tick(){for(const s of sims)advance(s,12);refreshCards();}
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
      #benchPage .dps-tgt.active{background:var(--gold);color:#19150b;border-color:#e7ca76}
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
      .dparam .trow label{font-size:12px;color:var(--ink);cursor:pointer}
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
                <div class="trow"><input type="checkbox" id="t-${r}-${t.id}" data-trole="${r}" data-tid="${t.id}"><label for="t-${r}-${t.id}">${t.label}</label></div>`).join('')}
            </div>`).join('')}
        </div>
        <p class="dps-note">Il motore gestisce mazzo, pesca, stance e cast lungo; il danno per colpo viene dai valori qui sopra. I talenti aggiungono le loro carte al mazzo e applicano i bonus. Assunzioni: cambio stance = 1 azione (gratis per il Rogue con Evasion Tricky); carte non-danno = 0 danni; cast lungo (Colpo Divino, Fireball, Holy Strike) = 2 carte + 2 azioni; i DoT (Vile Poison, Garrote, Holy Fire, Living Bomb) sono modellati come danno-per-carta approssimato, non come tick nel turno Overlord — tara quei valori a piacere. Cambiare qualcosa azzera e ricalcola.</p>
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

    page.querySelectorAll('.dparam input[type=number]').forEach(inp=>{
      inp.oninput=()=>{PARAMS[inp.dataset.role][inp.dataset.key]=Math.max(0,+inp.value||0);reset();};
    });
    page.querySelectorAll('.dparam input[type=checkbox]').forEach(chk=>{
      chk.onchange=()=>{const s=ACTIVE[chk.dataset.trole];chk.checked?s.add(chk.dataset.tid):s.delete(chk.dataset.tid);reset();};
    });

    page.querySelectorAll('.dps-tgt').forEach(btn=>{
      btn.onclick=()=>{TARGETS=+btn.dataset.targets;page.querySelectorAll('.dps-tgt').forEach(b=>b.classList.toggle('active',b===btn));reset();};
    });

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
