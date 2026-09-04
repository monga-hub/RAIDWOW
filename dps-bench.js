/* DPS Bench — strumento di bilanciamento.
   4 classi ciclano il mazzo su un manichino a HP infiniti, gioco greedy per
   massimizzare il danno. Run/Stop live con danno totale, danno/azione,
   danno/round, azioni sprecate. Riusa il motore reale (play/useSword/...).
   Isolato: costruisce game monoclasse propri, non tocca la partita globale. */
(function(){
  const ROLES=['warrior','rogue','healer','mage'];
  const LABELS={warrior:'Guerriero',rogue:'Rogue',healer:'Prete',mage:'Mago'};
  const COLORS={warrior:'#c98b4b',rogue:'#8c6fd0',healer:'#e7ca76',mage:'#5aa9e6'};
  const T='enemy:99:99';

  function mkDummy(){return {id:99,type:'dummy',hp:1e9,maxHp:1e9,damage:0,draw:[],discard:[],bleeds:[],bleedCount:0,taunted:false,casting:null,holyFireDots:0,livingBomb:0,frostVulnerable:false,firePierced:false};}
  const has=(h,c)=>h.hand.includes(c);

  // una decisione greedy per la classe; ritorna {dmg,acts} (acts>=1, tranne mosse gratis=0)
  function stepR(g,h,role,d){
    const pos=()=>h.board.position.card, before=d.hp;
    const flip=to=>{h.board.position.card=to;h.actions--;return {dmg:0,acts:1};};
    const done=()=>({dmg:before-d.hp,acts:1});
    if(role==='warrior'){
      if(has(h,'critical')&&!h.criticalArmed)toggleCritical(g,h);
      if(has(h,'sword')){toggleWarriorTechnique(g,h,'sword',h.hand.indexOf('sword'));useSword(g,h,T);return done();}
      if(has(h,'rend')){toggleWarriorTechnique(g,h,'rend',h.hand.indexOf('rend'));useSword(g,h,T);return done();}
      if(has(h,'taunt')){play(g,h,'taunt',T);return done();}
      if(has(h,'parry')){const i=h.hand.indexOf('parry');h.hand.splice(i,1);h.discard.push('parry');h.actions--;return {dmg:0,acts:1};}
      useSword(g,h,T);return done();
    }
    if(role==='rogue'){
      if(has(h,'critical')&&!h.criticalArmed)toggleCritical(g,h);
      if(has(h,'backstab')){if(pos()!=='BEHIND')return flip('BEHIND');h.rogueTechniqueArmed='backstab';h.rogueTechniqueIndex=h.hand.indexOf('backstab');useDagger(g,h,T,'left');return done();}
      if(has(h,'eviscerate')){if(pos()!=='FRONT')return flip('FRONT');h.rogueTechniqueArmed='eviscerate';h.rogueTechniqueIndex=h.hand.indexOf('eviscerate');useDagger(g,h,T,'left');return done();}
      if(has(h,'kick')){play(g,h,'kick',T);return done();}
      if(has(h,'preparation')){play(g,h,'preparation',T);h.preparationPending=0;return done();}
      if(has(h,'evasion')){const i=h.hand.indexOf('evasion');h.hand.splice(i,1);h.discard.push('evasion');h.actions--;return {dmg:0,acts:1};}
      useDagger(g,h,T,'left');return done();
    }
    if(role==='healer'){
      if(h.divineStrikeCasting&&has(h,'divine_strike')){if(pos()!=='NEAR')return flip('NEAR');play(g,h,'divine_strike',T);return done();}
      if(has(h,'critical')&&!h.criticalArmed)toggleCritical(g,h);
      if(has(h,'holy_pulse')){play(g,h,'holy_pulse',T);return done();}
      if(has(h,'divine_strike')&&!h.divineStrikeCasting){if(pos()!=='NEAR')return flip('NEAR');play(g,h,'divine_strike',T);return done();}
      if(pos()==='FAR'){useWand(g,h,T);return done();}
      if(has(h,'quick_heal')){const i=h.hand.indexOf('quick_heal');h.hand.splice(i,1);h.discard.push('quick_heal');h.actions--;return {dmg:0,acts:1};}
      if(has(h,'slow_heal')){const i=h.hand.indexOf('slow_heal');h.hand.splice(i,1);h.discard.push('slow_heal');h.actions--;return {dmg:0,acts:1};}
      return flip('FAR');
    }
    if(role==='mage'){
      if(h.fireballCasting&&has(h,'fireball')){if(pos()!=='FAR')return flip('FAR');playMageCard(g,h,'fireball',T);return done();}
      if(has(h,'frostbolt')){if(pos()!=='NEAR')return flip('NEAR');playMageCard(g,h,'frostbolt',T);return done();}
      if(has(h,'fireball')&&!h.fireballCasting){if(pos()!=='FAR')return flip('FAR');playMageCard(g,h,'fireball',T);return done();}
      if(has(h,'blizzard')){if(pos()!=='FAR')return flip('FAR');playMageCard(g,h,'blizzard',T);return done();}
      if(has(h,'counterspell')){playMageCard(g,h,'counterspell',T);return done();}
      if(has(h,'blink')){const i=h.hand.indexOf('blink');h.hand.splice(i,1);h.discard.push('blink');return {dmg:0,acts:0};}
      if(pos()!=='FAR')return flip('FAR');useMageWand(g,h,T);return done();
    }
    return {dmg:0,acts:1};
  }

  // costruisce un game monoclasse isolato senza sporcare la partita globale
  function buildSim(role){
    const savedGame=game, savedRender=render;
    render=function(){};                               // sopprime il render durante la build
    try{ startBoardCampaign([role],'heroic'); }catch(e){}
    const g=game;
    game=savedGame; render=savedRender;                // ripristina la partita reale
    g.enemies=[mkDummy()]; g.state='playing'; g.activeRole=role; g.round=1;
    g.currentEncounter={firstKillRound:null,won:false,size:1};
    return {role, g, h:g.party[0], dummy:g.enemies[0], damage:0, actions:0, wasted:0, rounds:0};
  }

  // avanza sim di N round completi (3 azioni/round)
  function advance(sim, roundsToRun){
    const {g,h,role,dummy}=sim;
    for(let r=0;r<roundsToRun;r++){
      sim.rounds++; h.actions=CONFIG.actionsPerRound; refill(h,g);
      let guard=0;
      while(h.actions>0 && guard++<30){
        const aBefore=h.actions, res=stepR(g,h,role,dummy);
        if(!res){h.actions--;sim.actions++;sim.wasted++;continue;}
        if(res.acts===0){continue;}                    // mossa gratis (Blink)
        if(h.actions===aBefore)h.actions--;            // safety
        sim.actions+=res.acts; sim.damage+=res.dmg; if(res.dmg<=0)sim.wasted+=res.acts;
      }
    }
  }

  let sims=[], timer=null;

  function fmt(n){return Number.isInteger(n)?n:n.toFixed(2);}
  function refreshCards(){
    const maxDpa=Math.max(0.001,...sims.map(s=>s.actions?s.damage/s.actions:0));
    for(const s of sims){
      const dpa=s.actions?s.damage/s.actions:0, dpr=s.rounds?s.damage/s.rounds:0, wpct=s.actions?100*s.wasted/s.actions:0;
      const card=document.getElementById('dpsc-'+s.role);
      card.querySelector('.dpsc-total').textContent=Math.round(s.damage);
      card.querySelector('.dpsc-dpa').textContent=fmt(dpa);
      card.querySelector('.dpsc-dpr').textContent=fmt(dpr);
      card.querySelector('.dpsc-acts').textContent=s.actions;
      card.querySelector('.dpsc-rounds').textContent=s.rounds;
      card.querySelector('.dpsc-wasted').textContent=`${s.wasted} (${wpct.toFixed(0)}%)`;
      card.querySelector('.dpsc-bar').style.width=(100*dpa/maxDpa).toFixed(1)+'%';
      card.querySelector('.dpsc-bar').textContent=fmt(dpa);
    }
  }
  function resetSims(){sims=ROLES.map(buildSim);refreshCards();}
  function tick(){for(const s of sims)advance(s,12);refreshCards();}
  function run(){if(timer)return;if(!sims.length)resetSims();timer=setInterval(tick,60);setBtns(true);}
  function stop(){clearInterval(timer);timer=null;setBtns(false);}
  function reset(){stop();resetSims();}
  function setBtns(running){document.getElementById('dps-run').disabled=running;document.getElementById('dps-stop').disabled=!running;}

  function buildUI(){
    if(document.getElementById('benchPage'))return;
    const style=document.createElement('style');
    style.textContent=`
      #benchPage .dps-controls{display:flex;gap:8px;align-items:center;margin-bottom:14px}
      #benchPage .dps-cards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
      @media(max-width:900px){#benchPage .dps-cards{grid-template-columns:1fr 1fr}}
      .dpsc{background:#18281d;border:1px solid var(--edge);border-radius:14px;padding:14px}
      .dpsc h3{margin:0 0 4px;font-size:1.05rem}
      .dpsc .dpsc-big{font-size:2rem;font-weight:800;line-height:1;margin:6px 0 2px}
      .dpsc .dpsc-sub{color:var(--muted);font-size:11px;margin-bottom:10px}
      .dpsc .dpsc-track{height:26px;background:#101a13;border-radius:7px;overflow:hidden;border:1px solid #2c3a2f;margin-bottom:12px}
      .dpsc .dpsc-bar{height:100%;display:flex;align-items:center;justify-content:flex-end;padding-right:7px;font-weight:800;font-size:12px;color:#101a13;transition:width .12s linear;min-width:22px}
      .dpsc table{width:100%;border-collapse:collapse;font-size:12px}
      .dpsc td{padding:3px 0;color:var(--muted)}
      .dpsc td.v{text-align:right;color:var(--ink);font-weight:700}
      #benchPage .dps-note{color:#8a9287;font-size:11px;margin-top:14px;line-height:1.5}`;
    document.head.append(style);

    const page=document.createElement('section');
    page.id='benchPage'; page.className='app-page'; page.hidden=true;
    page.innerHTML=`
      <div class="card">
        <h2>DPS Bench — manichino</h2>
        <p class="muted">Le 4 classi (gear base, livello 1, nessun talento) ciclano il mazzo su un manichino a HP infiniti, giocando per il massimo danno. Premi Run.</p>
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
        <p class="dps-note">Assunzioni: cambio stance = 1 azione (Rogue FRONT/BEHIND, Mago/Prete NEAR/FAR); carte non-danno giocate (costano azione, 0 danni); cast lungo (Colpo Divino, Fireball) = 2 carte + 2 azioni; DoT (Bleed del Rend) non contati perché si risolvono nel turno Overlord. Le percentuali si stabilizzano dopo qualche secondo.</p>
      </div>`;
    document.querySelector('main').append(page);

    // tab + switch generico su tutte le .app-page
    const tab=document.createElement('button');
    tab.className='page-tab'; tab.dataset.page='benchPage'; tab.textContent='DPS Bench';
    document.querySelector('.page-tabs').append(tab);
    const pages=()=>[...document.querySelectorAll('.app-page')];
    document.querySelectorAll('.page-tab').forEach(btn=>{
      if(!btn.dataset.page)return;                     // salta il tab "Salvataggi" (overlay)
      btn.onclick=()=>{
        document.querySelectorAll('.page-tab').forEach(x=>x.classList.toggle('active',x===btn));
        pages().forEach(p=>p.hidden=(p.id!==btn.dataset.page));
        if(btn.dataset.page!=='benchPage')stop();      // ferma il loop uscendo dal bench
      };
    });

    function openBench(){
      const setup=document.getElementById('campaignSetup'); if(setup)setup.hidden=true;
      document.querySelectorAll('.page-tab').forEach(x=>x.classList.toggle('active',x===tab));
      pages().forEach(p=>p.hidden=(p.id!=='benchPage'));
    }
    // punto d'ingresso dal setup campagna (l'overlay copre i tab in header)
    (function addSetupEntry(tries){
      const setupPanel=document.querySelector('#campaignSetup .campaign-controls');
      if(!setupPanel){ if(tries<40)setTimeout(()=>addSetupEntry(tries+1),150); return; }
      if(setupPanel.querySelector('[data-dps-entry]'))return;
      const entry=document.createElement('button');
      entry.className='secondary'; entry.type='button'; entry.dataset.dpsEntry=''; entry.textContent='🎯 DPS Bench';
      entry.onclick=openBench;
      setupPanel.append(entry);
    })(0);

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
