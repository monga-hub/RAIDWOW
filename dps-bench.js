/* DPS Bench — banco di bilanciamento parametrico.
   4 classi ciclano il mazzo su un manichino a HP infiniti, gioco greedy.
   Il MOTORE reale governa le meccaniche (mazzo, stance, cast lungo, carte morte);
   il DANNO per carta viene da una tabella EDITABILE (PARAMS) così puoi tunare ogni
   valore. Isolato: game monoclasse propri, non tocca la partita globale. */
(function(){
  const ROLES=['warrior','rogue','healer','mage'];
  const LABELS={warrior:'Guerriero',rogue:'Rogue',healer:'Prete',mage:'Mago'};
  const COLORS={warrior:'#c98b4b',rogue:'#8c6fd0',healer:'#e7ca76',mage:'#5aa9e6'};
  const T='enemy:99:99';

  // definizione parametri editabili: [key, etichetta, default]
  const PARAM_DEFS={
    warrior:[['sword_base','Spada (arma base)',1],['heroic_strike','Heroic Strike (+ arma)',1],['rend_bleed','Rend — sanguinamento extra',0],['crit','Critico (+)',1]],
    rogue:[['dagger_base','Pugnale (base)',1],['backstab','Backstab (+)',2],['eviscerate','Eviscerate (+)',1],['kick','Kick',1],['crit','Critico (+)',1]],
    healer:[['holy_pulse','Impulso Sacro',1],['divine_strike','Colpo Divino (completo)',2],['wand','Bacchetta (FAR)',1],['crit','Critico (+)',1]],
    mage:[['frostbolt','Frostbolt',2],['fireball','Fireball (completo)',4],['blizzard','Blizzard',1],['counterspell','Counterspell',1],['wand','Bacchetta (FAR)',1]]
  };
  // valori correnti (mutabili dall'utente)
  const PARAMS={};
  for(const r of ROLES){PARAMS[r]={};for(const [k,,d] of PARAM_DEFS[r])PARAMS[r][k]=d;}

  function mkDummy(){return {id:99,type:'dummy',hp:1e9,maxHp:1e9,damage:0,draw:[],discard:[],bleeds:[],bleedCount:0,taunted:false,casting:null,holyFireDots:0,livingBomb:0,frostVulnerable:false,firePierced:false};}
  const has=(h,c)=>h.hand.includes(c);

  // danno di un colpo secondo la tabella parametri
  function hitDamage(role,card,crit){
    const P=PARAMS[role];
    if(role==='warrior'){let d=P.sword_base;if(card==='sword')d+=P.heroic_strike;else if(card==='rend')d+=P.rend_bleed;return d+(crit?P.crit:0);}
    if(role==='rogue'){let d;if(card==='backstab')d=P.dagger_base+P.backstab;else if(card==='eviscerate')d=P.dagger_base+P.eviscerate;else if(card==='kick')d=P.kick;else d=P.dagger_base;return d+(crit?P.crit:0);}
    if(role==='healer'){if(card==='holy_pulse')return P.holy_pulse+(crit?P.crit:0);if(card==='divine_strike')return P.divine_strike;if(card==='wand')return P.wand;return 0;}
    if(role==='mage')return P[card]||0;
    return 0;
  }

  // una decisione greedy; ritorna {acts, card|null, crit} — card!=null => colpo a segno
  function stepR(g,h,role,d){
    const pos=()=>h.board.position.card;
    const flip=to=>{h.board.position.card=to;h.actions--;return {acts:1,card:null};};
    const hit=(card,crit)=>({acts:1,card,crit:!!crit});
    if(role==='warrior'){
      const crit=has(h,'critical')&&!h.criticalArmed?(toggleCritical(g,h),true):h.criticalArmed;
      if(has(h,'sword')){toggleWarriorTechnique(g,h,'sword',h.hand.indexOf('sword'));useSword(g,h,T);return hit('sword',crit);}
      if(has(h,'rend')){toggleWarriorTechnique(g,h,'rend',h.hand.indexOf('rend'));useSword(g,h,T);return hit('rend',crit);}
      if(has(h,'taunt')){play(g,h,'taunt',T);return {acts:1,card:null};}
      if(has(h,'parry')){const i=h.hand.indexOf('parry');h.hand.splice(i,1);h.discard.push('parry');h.actions--;return {acts:1,card:null};}
      useSword(g,h,T);return hit('bare',crit);
    }
    if(role==='rogue'){
      const crit=has(h,'critical')&&!h.criticalArmed?(toggleCritical(g,h),true):h.criticalArmed;
      if(has(h,'backstab')){if(pos()!=='BEHIND')return flip('BEHIND');h.rogueTechniqueArmed='backstab';h.rogueTechniqueIndex=h.hand.indexOf('backstab');useDagger(g,h,T,'left');return hit('backstab',crit);}
      if(has(h,'eviscerate')){if(pos()!=='FRONT')return flip('FRONT');h.rogueTechniqueArmed='eviscerate';h.rogueTechniqueIndex=h.hand.indexOf('eviscerate');useDagger(g,h,T,'left');return hit('eviscerate',crit);}
      if(has(h,'kick')){play(g,h,'kick',T);return hit('kick',false);}
      if(has(h,'preparation')){play(g,h,'preparation',T);h.preparationPending=0;return {acts:1,card:null};}
      if(has(h,'evasion')){const i=h.hand.indexOf('evasion');h.hand.splice(i,1);h.discard.push('evasion');h.actions--;return {acts:1,card:null};}
      useDagger(g,h,T,'left');return hit('bare',crit);
    }
    if(role==='healer'){
      if(h.divineStrikeCasting&&has(h,'divine_strike')){if(pos()!=='NEAR')return flip('NEAR');play(g,h,'divine_strike',T);return hit('divine_strike',false);}
      const crit=has(h,'critical')&&!h.criticalArmed?(toggleCritical(g,h),true):h.criticalArmed;
      if(has(h,'holy_pulse')){play(g,h,'holy_pulse',T);return hit('holy_pulse',crit);}
      if(has(h,'divine_strike')&&!h.divineStrikeCasting){if(pos()!=='NEAR')return flip('NEAR');play(g,h,'divine_strike',T);return {acts:1,card:null};} // carica (no danno)
      if(pos()==='FAR'){useWand(g,h,T);return hit('wand',false);}
      if(has(h,'quick_heal')){const i=h.hand.indexOf('quick_heal');h.hand.splice(i,1);h.discard.push('quick_heal');h.actions--;return {acts:1,card:null};}
      if(has(h,'slow_heal')){const i=h.hand.indexOf('slow_heal');h.hand.splice(i,1);h.discard.push('slow_heal');h.actions--;return {acts:1,card:null};}
      return flip('FAR');
    }
    if(role==='mage'){
      if(h.fireballCasting&&has(h,'fireball')){if(pos()!=='FAR')return flip('FAR');playMageCard(g,h,'fireball',T);return hit('fireball',false);}
      if(has(h,'frostbolt')){if(pos()!=='NEAR')return flip('NEAR');playMageCard(g,h,'frostbolt',T);return hit('frostbolt',false);}
      if(has(h,'fireball')&&!h.fireballCasting){if(pos()!=='FAR')return flip('FAR');playMageCard(g,h,'fireball',T);return {acts:1,card:null};} // carica
      if(has(h,'blizzard')){if(pos()!=='FAR')return flip('FAR');playMageCard(g,h,'blizzard',T);return hit('blizzard',false);}
      if(has(h,'counterspell')){playMageCard(g,h,'counterspell',T);return hit('counterspell',false);}
      if(has(h,'blink')){const i=h.hand.indexOf('blink');h.hand.splice(i,1);h.discard.push('blink');return {acts:0,card:null};}
      if(pos()!=='FAR')return flip('FAR');useMageWand(g,h,T);return hit('wand',false);
    }
    return {acts:1,card:null};
  }

  function buildSim(role){
    const savedGame=game, savedRender=render;
    render=function(){};
    try{ startBoardCampaign([role],'heroic'); }catch(e){}
    const g=game;
    game=savedGame; render=savedRender;
    g.enemies=[mkDummy()]; g.state='playing'; g.activeRole=role; g.round=1;
    g.currentEncounter={firstKillRound:null,won:false,size:1};
    return {role, g, h:g.party[0], dummy:g.enemies[0], damage:0, actions:0, wasted:0, rounds:0};
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
        const dmg=res.card?hitDamage(role,res.card,res.crit):0;
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
      #benchPage .dps-cards,#benchPage .dps-params{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
      #benchPage .dps-params{margin-top:14px}
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
      .dparam input{width:58px;padding:5px 6px;text-align:center;font:inherit;font-weight:700;color:var(--ink);background:#0f1712;border:1px solid #3a4a3d;border-radius:7px}
      #benchPage .dps-note{color:#8a9287;font-size:11px;margin-top:14px;line-height:1.5}`;
    document.head.append(style);

    const page=document.createElement('section');
    page.id='benchPage'; page.className='app-page'; page.hidden=true;
    page.innerHTML=`
      <div class="card">
        <h2>DPS Bench — manichino</h2>
        <p class="muted">Le 4 classi (livello 1, nessun talento) ciclano il mazzo su un manichino a HP infiniti, giocando per il massimo danno. I valori di danno delle carte sono modificabili qui sotto: cambiali e le curve si ricalcolano dal vivo.</p>
        <div class="dps-controls">
          <button id="dps-run">▶ Run</button>
          <button id="dps-stop" class="secondary" disabled>■ Stop</button>
          <button id="dps-reset" class="secondary">↺ Reset</button>
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
        <h3 style="margin:20px 0 0">Valori carte (modificabili)</h3>
        <div class="dps-params">
          ${ROLES.map(r=>`
            <div class="dparam" style="border-left:3px solid ${COLORS[r]}">
              <h4 style="color:${COLORS[r]}">${LABELS[r]}</h4>
              ${PARAM_DEFS[r].map(([k,label,d])=>`
                <div class="prow"><label for="p-${r}-${k}">${label}</label>
                <input id="p-${r}-${k}" type="number" min="0" max="30" step="1" value="${d}" data-role="${r}" data-key="${k}"></div>`).join('')}
            </div>`).join('')}
        </div>
        <p class="dps-note">Il motore gestisce mazzo, pesca, stance e cast lungo; il danno per colpo viene da questi valori. Assunzioni: cambio stance = 1 azione (Rogue FRONT/BEHIND, Mago/Prete NEAR/FAR); carte non-danno giocate a 0 danni; cast lungo (Colpo Divino, Fireball) = 2 carte + 2 azioni; il Bleed del Rend è modellato come "sanguinamento extra" sul colpo (default 0). Cambiare un valore azzera e ricalcola i contatori.</p>
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

    // input parametri -> aggiorna PARAMS e ricalcola
    page.querySelectorAll('.dparam input').forEach(inp=>{
      inp.oninput=()=>{const v=Math.max(0,+inp.value||0);PARAMS[inp.dataset.role][inp.dataset.key]=v;reset();};
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
