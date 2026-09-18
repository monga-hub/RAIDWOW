/* DPS Bench — banco di bilanciamento parametrico con talenti.
   Tutte le classi ciclano il mazzo su un manichino a HP infiniti, gioco greedy.
   Il MOTORE reale governa le meccaniche (mazzo, posizionamento, cast lungo, carte morte);
   il DANNO per carta viene da una tabella EDITABILE (PARAMS). I TALENTI sono
   toggle: aggiungono le loro carte al mazzo e applicano i bonus. Isolato: game
   monoclasse propri, non tocca la partita globale.
   DoT (Vile Poison, Garrote, Holy Fire, Ignite) modellati come danno-per-carta
   approssimato (valore editabile), non come tick nel turno Overlord. */
(function(){
  const ROLES=['warrior','rogue','healer','mage','paladin','warlock','shaman','hunter'];
  const LABELS={warrior:'Guerriero',rogue:'Rogue',healer:'Prete',mage:'Mago',paladin:'Paladino',warlock:'Warlock',shaman:'Sciamano',hunter:'Hunter'};
  const COLORS={warrior:'#c98b4b',rogue:'#8c6fd0',healer:'#e7ca76',mage:'#5aa9e6',paladin:'#e3c462',warlock:'#a56bd1',shaman:'#35a9d8',hunter:'#7fc451'};

  // parametri danno editabili: [key,label,default]. Le carte da talento sono in coda.
  const PARAM_DEFS={
    warrior:[['sword_base','Arma base',1],['heroic_strike','Heroic Strike (+ arma)',2],['rend_bleed','Rend (+ arma)',1],['crit','Critico (+)',1],['concussion_blow','Concussion Blow — talento',2],['shield_slam','Shield Slam — talento',3],['thunder_stomp','Thunder Stomp (+ arma) — talento',1],['execute','Execute (+ arma)',1],['sweeping_strikes','Sweeping Strikes (+ arma)',1],['whirlwind','Whirlwind (+ arma)',2]],
    rogue:[['dagger_base','Pugnale (base)',1],['backstab','Backstab (+)',1],['eviscerate','Eviscerate (Combo medio)',2],['kick','Kick',2],['crit','Critico (+)',1],['mutilate','Mutilate — talento',3],['cheap_shot','Cheap Shot — talento',3],['fan_of_knives','Fan of Knives (AOE) — talento',1]],
    healer:[['smite','Smite',2],['mind_blast','Mind Blast',3],['shadow_word_pain','Shadow Word: Pain (totale)',2],['wand','Bacchetta',1],['holy_nova','Holy Nova (AOE) — talento',1],['penance','Penance offensiva — talento',3],['mind_flay','Mind Flay (completo) — talento',4],['silence','Silence — talento',1]],
    mage:[['frostbolt','Frostbolt',2],['fireball','Fireball (completo)',4],['blizzard','Blizzard',1],['counterspell','Counterspell',1],['wand','Frost Wand',1],['crit','Critico (+)',1],['frost_nova','Frost Nova (AOE) — talento',2],['cone_of_cold','Cone of Cold (AOE) — talento',2],['fire_blast','Fire Blast — talento',3],['scorch','Scorch + 2 cariche — talento',5],['pyroblast','Pyroblast (completo) — talento',7]],
    paladin:[['hammer','Martello base',1],['crusader_strike','Oathbound Blow (+ arma)',1],['consecration','Dawn Circle (AOE)',1],['judgment','Sun Verdict',2],['avengers_shield','Returning Aegis (AOE)',2],['hammer_justice','Lawbringer Strike',1],['holy_shock','Radiant Jolt',3]],
    warlock:[['shadow_bolt','Void Needle',2],['corruption','Rot Seed (totale)',2],['immolate','Witchflame (totale)',3],['drain_life','Blood Tithe',2],['curse_agony','Torment Spiral (totale)',6],['siphon_life','Leeching Hex (totale)',3],['curse_exhaustion','Withering Chains',1],['wand','Wand',1]],
    shaman:[['weapon','Ascia base',1],['storm_maul','Storm Maul (+ arma)',1],['sky_spark','Sky Spark',2],['thunder_rend','Thunder Rend',3],['forked_sky','Forked Sky (AOE)',2],['crash_wave','Crash Wave (AOE)',2]],
    hunter:[['bow','Arco base',1],['quarry_mark','Quarry Mark',1],['piercing_shot','Piercing Shot',3],['fang_command','Fang Command',2],['pinning_shot','Pinning Shot',2],['scatter_volley','Scatter Volley (AOE)',1],['pounce_command','Pounce Command (AOE)',2],['snare_trap','Snare Trap (AOE)',1],['split_arrow','Split Arrow',2],['deep_pierce','Deep Pierce',3],['pack_finish','Pack Finish',3],['shock_trap','Shock Trap (AOE)',1],['sweeping_volley','Sweeping Volley (AOE)',2],['pack_pounce','Pack Pounce (AOE)',2],['predator_storm','Predator Storm (AOE)',3]]
  };
  const PARAMS={};
  for(const r of ROLES){PARAMS[r]={};for(const [k,,d] of PARAM_DEFS[r])PARAMS[r][k]=d;}

  // talenti DPS. kind: 'bonus' (val = bonus modificabile) | 'count' (val = n. carte aggiunte,
  // carta in `card`) | 'flag' (booleano, nessun valore).
  const TALENT_DEFS={
    warrior:[
      {id:'heroic_mastery',label:'Heroic Strike Mastery · 3 gradi',kind:'bonus',val:3,hint:'+ Heroic'},
      {id:'improved_rend',label:'Improved Rend · 2 gradi',kind:'bonus',val:2,hint:'+ Rend'},
      {id:'sunder_armor',label:'Sunder Armor · 1 step',kind:'count',val:2,card:'sunder_armor',hint:'carte'},
      {id:'concussion_blow',label:'Concussion Blow · 1 grado',kind:'count',val:2,card:'concussion_blow',hint:'carte'},
      {id:'shield_slam',label:'Shield Slam · 1 grado',kind:'count',val:2,card:'shield_slam',hint:'carte'},
      {id:'thunder_stomp',label:'Thunder Stomp · 2 gradi',kind:'count',val:2,card:'thunder_stomp',hint:'carte'},
      {id:'execute',label:'Execute · 1 grado',kind:'count',val:2,card:'execute',hint:'carte'},
      {id:'sweeping_strikes',label:'Sweeping Strikes · 1 grado',kind:'count',val:2,card:'sweeping_strikes',hint:'carte'},
      {id:'whirlwind',label:'Whirlwind · 1 grado',kind:'count',val:1,card:'whirlwind',hint:'carta'}
    ],
    rogue:[
      {id:'improved_backstab',label:'Improved Backstab · 2 gradi',kind:'bonus',val:2,hint:'+ Backstab'},
      {id:'opportunity',label:'Opportunity · 2 gradi',kind:'bonus',val:2,hint:'+ Backstab isolato'},
      {id:'mutilate',label:'Mutilate · 1 grado',kind:'count',val:2,card:'mutilate',hint:'carte'},
      {id:'improved_eviscerate',label:'Improved Eviscerate · 2 gradi',kind:'bonus',val:2,hint:'+ Eviscerate'},
      {id:'cold_blood',label:'Cold Blood · 1 grado',kind:'count',val:1,card:'cold_blood',hint:'carta'},
      {id:'dirty_tricks',label:'Dirty Tricks · 2 gradi',kind:'bonus',val:2,hint:'+ Kick'},
      {id:'cheap_shot',label:'Cheap Shot · 1 grado',kind:'count',val:2,card:'cheap_shot',hint:'carte'},
      {id:'fan_of_knives',label:'Fan of Knives · 1 grado',kind:'count',val:2,card:'fan_of_knives',hint:'carte'},
      {id:'improved_critical',label:'Improved Critical · 1 grado',kind:'count',val:1,card:'critical',hint:'carta'}
    ],
    healer:[
      {id:'improved_mind_blast',label:'Improved Mind Blast · 2 gradi',kind:'bonus',val:2,hint:'+ Mind Blast'},
      {id:'improved_shadow_word_pain',label:'Improved Shadow Word: Pain · 2 gradi',kind:'bonus',val:2,hint:'+ tick'},
      {id:'holy_nova',label:'Holy Nova · 1 grado',kind:'count',val:2,card:'holy_nova',hint:'carte'},
      {id:'penance',label:'Penance · 1 grado',kind:'count',val:2,card:'penance',hint:'carte'},
      {id:'mind_flay',label:'Mind Flay · 1 grado',kind:'count',val:2,card:'mind_flay',hint:'carte'},
      {id:'silence',label:'Silence · 1 grado',kind:'count',val:2,card:'silence',hint:'carte'},
      {id:'shadowform',label:'Shadowform · 1 grado',kind:'flag'}
    ],
    mage:[
      {id:'improved_frostbolt',label:'Improved Frostbolt · 2 gradi',kind:'bonus',val:2,hint:'+ Frostbolt'},
      {id:'permafrost',label:'Permafrost · 2 gradi',kind:'flag'},
      {id:'frost_nova',label:'Frost Nova · 1 grado',kind:'count',val:2,card:'frost_nova',hint:'carte'},
      {id:'improved_blizzard',label:'Improved Blizzard · 2 gradi',kind:'bonus',val:2,hint:'+ Blizzard'},
      {id:'cone_of_cold',label:'Cone of Cold · 1 step',kind:'count',val:2,card:'cone_of_cold',hint:'carte'},
      {id:'shatter',label:'Shatter · +3 su Congelato',kind:'flag'},
      {id:'improved_fireball',label:'Improved Fireball · 3 gradi',kind:'bonus',val:3,hint:'+ Fireball'},
      {id:'ignite',label:'Ignite · 2 gradi',kind:'bonus',val:2,hint:'+ Fire diretto'},
      {id:'fire_blast',label:'Fire Blast · 1 grado',kind:'count',val:2,card:'fire_blast',hint:'carte'},
      {id:'scorch',label:'Scorch · 1 grado',kind:'count',val:2,card:'scorch',hint:'carte'},
      {id:'pyroblast',label:'Pyroblast · 1 grado',kind:'count',val:2,card:'pyroblast',hint:'carte'},
      {id:'molten_fury',label:'Molten Fury · 2 gradi',kind:'bonus',val:2,hint:'+ a ≤25% HP'},
      {id:'combustion',label:'Combustion · 1 grado',kind:'flag'}
    ],
    paladin:[
      {id:'improved_consecration',label:'Improved Consecration · 2 gradi',kind:'bonus',val:2,hint:'+ AOE'},
      {id:'avengers_shield',label:"Avenger's Shield · 1 grado",kind:'count',val:2,card:'avengers_shield',hint:'carte'},
      {id:'hammer_justice',label:'Hammer of Justice · 1 grado',kind:'count',val:2,card:'hammer_justice',hint:'carte'},
      {id:'holy_shock',label:'Holy Shock · 1 grado',kind:'count',val:2,card:'holy_shock',hint:'carte'}
    ],
    warlock:[
      {id:'improved_corruption',label:'Improved Corruption · 2 gradi',kind:'bonus',val:2,hint:'+ tick'},
      {id:'improved_drain_life',label:'Improved Drain Life · 2 gradi',kind:'bonus',val:2,hint:'+ danno'},
      {id:'curse_agony',label:'Curse of Agony · 1 grado',kind:'count',val:2,card:'curse_agony',hint:'carte'},
      {id:'siphon_life',label:'Siphon Life · 1 grado',kind:'count',val:2,card:'siphon_life',hint:'carte'},
      {id:'curse_exhaustion',label:'Curse of Exhaustion · 1 grado',kind:'count',val:2,card:'curse_exhaustion',hint:'carte'},
      {id:'shadow_mastery',label:'Shadow Mastery · 1 grado',kind:'bonus',val:1,hint:'+ Shadow'}
    ],
    shaman:[
      {id:'charged_edge',label:'Charged Edge · 2 gradi',kind:'bonus',val:2,hint:'+ Maul'},
      {id:'storm_focus',label:'Storm Focus · 2 gradi',kind:'bonus',val:2,hint:'+ Spark'},
      {id:'forked_sky',label:'Forked Sky · 1 grado',kind:'count',val:2,card:'forked_sky',hint:'carte'},
      {id:'crash_wave',label:'Crash Wave · 1 grado',kind:'count',val:2,card:'crash_wave',hint:'carte'},
      {id:'storm_avatar',label:'Storm Avatar · 1 grado',kind:'flag'}
    ],
    hunter:[
      {id:'steady_hand',label:'Steady Hand · 2 gradi',kind:'bonus',val:2,hint:'+ Piercing'},
      {id:'patient_hunt',label:'Patient Hunt · 2 gradi',kind:'bonus',val:2,hint:'+ Fang'},
      {id:'split_arrow',label:'Split Arrow · 1 grado',kind:'count',val:2,card:'split_arrow',hint:'carte'},
      {id:'deep_pierce',label:'Deep Pierce · 1 grado',kind:'count',val:2,card:'deep_pierce',hint:'carte'},
      {id:'pack_finish',label:'Pack Finish · 1 grado',kind:'count',val:2,card:'pack_finish',hint:'carte'},
      {id:'barbed_control',label:'Barbed Control · 2 gradi',kind:'bonus',val:2,hint:'+ Pinning'},
      {id:'wide_scatter',label:'Wide Scatter · 2 gradi',kind:'bonus',val:2,hint:'+ Volley'},
      {id:'shock_trap',label:'Shock Trap · 1 grado',kind:'count',val:2,card:'shock_trap',hint:'carte'},
      {id:'sweeping_volley',label:'Sweeping Volley · 1 grado',kind:'count',val:2,card:'sweeping_volley',hint:'carte'},
      {id:'pack_pounce',label:'Pack Pounce · 1 grado',kind:'count',val:2,card:'pack_pounce',hint:'carte'},
      {id:'predator_storm',label:'Predator Storm · 1 grado',kind:'count',val:1,card:'predator_storm',hint:'carta'},
      {id:'perfect_quarry',label:'Perfect Quarry · 1 grado',kind:'flag'}
    ]
  };
  const ACTIVE=Object.fromEntries(ROLES.map(role=>[role,new Set()]));
  const TALENT_VALS={};                                 // valori correnti (modificabili)
  for(const r of ROLES){TALENT_VALS[r]={};for(const t of TALENT_DEFS[r])if(t.kind!=='flag')TALENT_VALS[r][t.id]=t.val;}
  const isOn=(role,id)=>ACTIVE[role].has(id);
  const V=(role,id)=>TALENT_VALS[role][id]||0;          // valore del talento (se attivo)
  const bonus=(role,id)=>isOn(role,id)?V(role,id):0;    // bonus se il talento è attivo
  const BENCH_BUILDS={
    single:{warrior:['heroic_mastery','improved_rend','execute','sweeping_strikes'],rogue:['improved_backstab','opportunity','mutilate','improved_eviscerate','improved_critical'],healer:['improved_mind_blast','improved_shadow_word_pain','mind_flay','silence','shadowform'],mage:['improved_fireball','ignite','fire_blast','scorch','combustion'],paladin:['improved_consecration','avengers_shield','hammer_justice'],warlock:['improved_corruption','improved_drain_life','curse_agony','siphon_life','curse_exhaustion','shadow_mastery'],shaman:['charged_edge','storm_focus','forked_sky','crash_wave','storm_avatar'],hunter:['steady_hand','patient_hunt','split_arrow','deep_pierce','pack_finish','perfect_quarry']},
    aoe:{warrior:['heroic_mastery','thunder_stomp','sweeping_strikes','whirlwind'],rogue:['dirty_tricks','cheap_shot','fan_of_knives'],healer:['holy_nova','penance'],mage:['improved_frostbolt','frost_nova','improved_blizzard','cone_of_cold','shatter'],paladin:['improved_consecration','avengers_shield','hammer_justice'],warlock:['improved_corruption','improved_drain_life','curse_agony','siphon_life','curse_exhaustion','shadow_mastery'],shaman:['charged_edge','storm_focus','forked_sky','crash_wave','storm_avatar'],hunter:['barbed_control','wide_scatter','shock_trap','sweeping_volley','pack_pounce','predator_storm']}
  };
  let TARGETS=1;                                        // n. manichini (1-4)


  // carte ad area: il danno scala col numero di bersagli
  const AOE=new Set(['thunder_stomp','whirlwind','holy_nova','blizzard','frost_nova','cone_of_cold','fan_of_knives','consecration','avengers_shield','forked_sky','crash_wave','scatter_volley','pounce_command','snare_trap','shock_trap','sweeping_volley','pack_pounce','predator_storm']);
  // schools per moltiplicatori mago
  const FROST=new Set(['frostbolt','blizzard','frost_nova','cone_of_cold']);
  const FIRE=new Set(['fireball','fire_blast','scorch','pyroblast']);

  function hitDamage(role,card,crit,h){
    const d=hitPerTarget(role,card,crit,h);
    if(card==='sweeping_strikes')return d*Math.min(TARGETS,2);
    if(card==='avengers_shield')return d*Math.min(TARGETS,3);
    if(card==='forked_sky')return d*Math.min(TARGETS,2);
    if(card==='split_arrow')return d+(TARGETS>1?1:0);
    return AOE.has(card)?d*TARGETS:d;                   // le carte ad area colpiscono tutti i manichini
  }
  function hitPerTarget(role,card,crit,h){
    const P=PARAMS[role];
    if(role==='warrior'){
      let d=P.sword_base;
      if(card==='sword')d+=P.heroic_strike+bonus('warrior','heroic_mastery');
      else if(card==='rend')return d+P.rend_bleed+bonus('warrior','improved_rend')+(crit?P.crit:0);
      else if(card==='concussion_blow'||card==='shield_slam')return P[card]+(crit?P.crit:0);
      else if(['thunder_stomp','execute','sweeping_strikes','whirlwind'].includes(card))return d+P[card]+(crit?P.crit:0);
      return d+(crit?P.crit:0);
    }
    if(role==='rogue'){
      let d;
      if(card==='backstab')d=P.dagger_base+P.backstab+bonus('rogue','improved_backstab')+bonus('rogue','opportunity');
      else if(card==='eviscerate')d=P.dagger_base+P.eviscerate+bonus('rogue','improved_eviscerate');
      else if(card==='mutilate')return P.mutilate+(crit?P.crit:0);
      else if(card==='cheap_shot')return P.cheap_shot+(crit?P.crit:0);
      else if(card==='fan_of_knives')return P.fan_of_knives;
      else if(card==='kick')d=P.kick+bonus('rogue','dirty_tricks');
      else d=P.dagger_base;
      return d+(crit?P.crit:0);
    }
    if(role==='healer'){
      const shadowform=isOn('healer','shadowform'),ticks=2+bonus('healer','improved_shadow_word_pain');
      if(card==='mind_blast')return P.mind_blast+bonus('healer','improved_mind_blast')+(shadowform?1:0);
      if(card==='shadow_word_pain')return P.shadow_word_pain+bonus('healer','improved_shadow_word_pain')+(shadowform?ticks:0);
      if(['mind_flay','silence'].includes(card))return P[card]+(shadowform?1:0);
      return P[card]||0;
    }
    if(role==='mage'){
      let d=P[card]||0;
      if(card==='frostbolt')d+=bonus('mage','improved_frostbolt');
      if(card==='blizzard')d+=bonus('mage','improved_blizzard');
      if(card==='fireball')d+=bonus('mage','improved_fireball');
      if(FROST.has(card)&&AOE.has(card)&&TARGETS>1)d++;
      if(FIRE.has(card)&&bonus('mage','improved_fireball')>=3&&TARGETS===1)d+=2;
      if(FIRE.has(card))d+=bonus('mage','ignite');
      if(FIRE.has(card)&&isOn('mage','combustion'))d+=1;
      return d+(crit?P.crit:0);
    }
    if(role==='paladin'){
      if(card==='bare')return P.hammer;
      if(card==='crusader_strike')return P.hammer+P.crusader_strike;
      if(card==='consecration')return P.consecration+bonus('paladin','improved_consecration');
      return P[card]||0;
    }
    if(role==='warlock'){
      let d=P[card]||0;
      if(card==='corruption')d+=bonus('warlock','improved_corruption');
      if(card==='drain_life')d+=bonus('warlock','improved_drain_life');
      if(card!=='immolate'&&card!=='wand'&&card!=='bare')d+=bonus('warlock','shadow_mastery');
      return d;
    }
    if(role==='shaman'){
      let d=card==='bare'?P.weapon:card==='storm_maul'?P.weapon+P.storm_maul+bonus('shaman','charged_edge'):P[card]||0;
      if(card==='sky_spark')d+=bonus('shaman','storm_focus');
      if(isOn('shaman','storm_avatar'))d+=1;
      return d;
    }
    if(role==='hunter'){
      const marked=!!h?.marked;
      if(card==='bare')return P.bow;
      if(card==='quarry_mark')return P.quarry_mark+(isOn('hunter','perfect_quarry')?2:0);
      if(card==='piercing_shot')return P.piercing_shot+(marked?2:0)+bonus('hunter','steady_hand')+(h?.perfectQuarryBonus||0);
      if(card==='fang_command')return P.fang_command+(marked?2+bonus('hunter','patient_hunt'):0);
      if(card==='pinning_shot')return P.pinning_shot+bonus('hunter','barbed_control');
      if(card==='scatter_volley')return P.scatter_volley+bonus('hunter','wide_scatter');
      if(card==='deep_pierce')return marked?5:P.deep_pierce;
      return P[card]||0;
    }
    return 0;
  }

  // metadati carte per il greedy value-based
  const CARD_STANCE={
    warrior:{sword:null,rend:null,sunder_armor:null,concussion_blow:null,shield_slam:null,thunder_stomp:null,execute:null,sweeping_strikes:null,whirlwind:null,bare:null},
    rogue:{backstab:null,eviscerate:null,mutilate:null,cheap_shot:null,kick:null,fan_of_knives:null,bare:null},
    healer:{smite:null,mind_blast:null,shadow_word_pain:null,holy_nova:null,penance:null,mind_flay:null,silence:null,wand:null},
    mage:{frostbolt:null,fireball:null,blizzard:null,frost_nova:null,cone_of_cold:null,fire_blast:null,scorch:null,pyroblast:null,counterspell:null,wand:null},
    paladin:{crusader_strike:null,consecration:null,judgment:null,avengers_shield:null,hammer_justice:null,holy_shock:null,bare:null},
    warlock:{shadow_bolt:null,corruption:null,immolate:null,drain_life:null,curse_agony:null,siphon_life:null,curse_exhaustion:null,wand:null},
    shaman:{storm_maul:null,sky_spark:null,thunder_rend:null,forked_sky:null,crash_wave:null,bare:null},
    hunter:{quarry_mark:null,piercing_shot:null,fang_command:null,pinning_shot:null,scatter_volley:null,pounce_command:null,snare_trap:null,split_arrow:null,deep_pierce:null,pack_finish:null,shock_trap:null,sweeping_volley:null,pack_pounce:null,predator_storm:null,bare:null}
  };
  const DMG_CARDS={
    warrior:['whirlwind','sweeping_strikes','thunder_stomp','shield_slam','concussion_blow','execute','sword','rend','sunder_armor','charge','bare'],
    rogue:['backstab','eviscerate','mutilate','cheap_shot','fan_of_knives','kick','bare'],
    healer:['mind_flay','mind_blast','penance','shadow_word_pain','smite','holy_nova','silence','wand'],
    mage:['pyroblast','fireball','scorch','fire_blast','frost_nova','cone_of_cold','frostbolt','blizzard','counterspell','wand'],
    paladin:['holy_shock','avengers_shield','judgment','crusader_strike','consecration','hammer_justice','bare'],
    warlock:['curse_agony','siphon_life','immolate','drain_life','shadow_bolt','corruption','curse_exhaustion','wand'],
    shaman:['forked_sky','crash_wave','thunder_rend','sky_spark','storm_maul','bare'],
    hunter:['predator_storm','deep_pierce','pack_finish','piercing_shot','fang_command','split_arrow','pounce_command','pack_pounce','sweeping_volley','pinning_shot','scatter_volley','snare_trap','shock_trap','quarry_mark','bare']
  };
  const DEAD_CARDS={warrior:['taunt','shield_protection','battle_shout','last_stand'],rogue:['kidney_shot','evasion','preparation','expose_armor','cold_blood','shadowstep','gouge','blind'],healer:['flash_heal','greater_heal','power_word_shield','purify'],mage:['blink','frost_armor','combustion'],paladin:['holy_light','righteous_defense','blessing_protection','cleanse','blessing_sanctuary','paladin_holy_shield','flash_of_light','beacon_of_light','divine_favor','lay_on_hands'],warlock:['fear','summon_imp','healthstone','summon_voidwalker','soul_link','fel_domination'],shaman:['gale_totem','primal_mend','flowing_chain','cleansing_rain','spring_totem','tempest_stride','raging_totem','storm_avatar','living_current','ancestral_well','purifying_totem','swift_current','tide_rebirth'],hunter:['stillness','retreat_roll']};
  const WEAPON=new Set(['bare','wand']);                 // colpo d'arma: non consuma carta dal mazzo
  const CAST=new Set(['mind_flay','fireball','pyroblast']);
  const critBoostable=(role,card)=>role==='warrior'?['charge','sword','rend','sunder_armor','concussion_blow','shield_slam','thunder_stomp','execute','sweeping_strikes','whirlwind','bare'].includes(card)
    :role==='rogue'?['backstab','eviscerate','mutilate','bare'].includes(card)
    :role==='healer'?false
    :role==='mage'?['frostbolt','blizzard','frost_nova','counterspell','fireball','fire_blast','scorch','pyroblast','cone_of_cold'].includes(card):false;
  // ---- Simulatore astratto (niente motore): mazzo/pesca/posizione/cast/carte morte, danno dai PARAMS ----
  const BASE_DECK={
    warrior:['charge','charge','sword','sword','sword','taunt','taunt','rend','rend','shield_protection'],
    rogue:['backstab','backstab','backstab','eviscerate','eviscerate','kidney_shot','evasion','kick','preparation','critical'],
    healer:['flash_heal','flash_heal','greater_heal','greater_heal','power_word_shield','power_word_shield','smite','mind_blast','shadow_word_pain','purify'],
    mage:['frostbolt','frostbolt','frostbolt','critical','blizzard','counterspell','fireball','fireball','fireball','blink'],
    paladin:['crusader_strike','crusader_strike','holy_light','holy_light','righteous_defense','righteous_defense','blessing_protection','consecration','cleanse','judgment'],
    warlock:['shadow_bolt','shadow_bolt','corruption','corruption','immolate','immolate','drain_life','drain_life','fear','summon_imp'],
    shaman:['storm_maul','storm_maul','sky_spark','thunder_rend','gale_totem','primal_mend','primal_mend','flowing_chain','cleansing_rain','spring_totem'],
    hunter:['quarry_mark','quarry_mark','piercing_shot','piercing_shot','fang_command','pinning_shot','pinning_shot','scatter_volley','pounce_command','snare_trap']
  };
  const START_STANCE=Object.fromEntries(ROLES.map(role=>[role,role==='rogue'?'FRONT':role==='mage'?'FAR':null]));
  const HAND_LIMIT=5;
  let AI_MODE='greedy', ROLL_DEPTH=6, ROLL_COUNT=4;      // rollout Monte-Carlo
  function shuf(a){a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
  function dump(s,c){const i=s.hand.indexOf(c);if(i>=0){s.hand.splice(i,1);s.discard.push(c);}}
  function refillS(s){while(s.hand.length<HAND_LIMIT){if(!s.draw.length){if(!s.discard.length)break;s.draw=shuf(s.discard);s.discard=[];}s.hand.push(s.draw.pop());}}
  function clone(s){return {role:s.role,deck:s.deck,draw:[...s.draw],discard:[...s.discard],hand:[...s.hand],stance:s.stance,casting:s.casting,marked:s.marked,perfectQuarryBonus:s.perfectQuarryBonus};}
  function candidates(s){
    const role=s.role, crit=s.hand.includes('critical'), out=[];
    const flipFree=false;
    for(const card of DMG_CARDS[role]){
      if(!WEAPON.has(card)&&!s.hand.includes(card))continue;
      if(role==='hunter'&&['split_arrow','predator_storm'].includes(card)&&!s.marked)continue;
      const st=CARD_STANCE[role][card], needFlip=st&&st!==s.stance, flipCost=needFlip?(flipFree?0:1):0;
      const cast=CAST.has(card)&&s.casting!==card;
      const boost=crit&&critBoostable(role,card);
      const dmg=hitDamage(role,card,boost,s);
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
      dump(s,card); s.casting=null; return hitDamage(role,card,false,s);
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
    if(role==='hunter'&&pick.card==='quarry_mark'){s.marked=true;s.perfectQuarryBonus=isOn('hunter','perfect_quarry')?2:0;}
    if(role==='hunter'&&pick.card==='piercing_shot')s.perfectQuarryBonus=0;
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
    const additions=TALENT_DEFS[role].flatMap(tal=>tal.kind==='count'&&isOn(role,tal.id)?Array(V(role,tal.id)).fill(tal.card):[]);
    for(const card of additions){let index=deck.findIndex(value=>DEAD_CARDS[role].includes(value));if(index<0)index=deck.map((value,i)=>({i,value:DMG_CARDS[role].includes(value)?hitDamage(role,value,false,{marked:true}):0})).filter(entry=>!(role==='hunter'&&entry.value==='quarry_mark')).sort((a,b)=>a.value-b.value)[0]?.i??-1;if(index>=0)deck[index]=card;}
    return {role, deck, draw:shuf(deck), discard:[], hand:[], stance:START_STANCE[role], casting:null,marked:false,perfectQuarryBonus:0,damage:0,actions:0,wasted:0,rounds:0,peakRound:0};
  }
  function advance(sim, rounds){
    const choose=AI_MODE==='rollout'?rolloutChoose:greedy;
    for(let r=0;r<rounds;r++){
      sim.rounds++; refillS(sim);let roundDamage=0;
      for(let a=0;a<3;a++){
        const dmg=actOne(sim,choose);
        sim.actions++;sim.damage+=(dmg>0?dmg:0);roundDamage+=Math.max(0,dmg);if(dmg<=0)sim.wasted++;
      }
      sim.peakRound=Math.max(sim.peakRound,roundDamage);
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
      c.querySelector('.dpsc-peak').textContent=fmt(s.peakRound);
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
      #benchPage .dps-cards,#benchPage .dps-params{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}
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
      #benchPage .mage-scenario-bench{margin-top:16px;padding:14px;border:1px solid var(--edge);border-radius:14px;background:#101a13}
      #benchPage .mage-scenario-head{display:flex;align-items:center;justify-content:space-between;gap:12px}
      #benchPage .mage-scenario-head h3{margin:0 0 4px}.mage-scenario-head p{margin:0}
      #benchPage .mage-scenario-progress{display:block;width:100%;margin:10px 0}
      #benchPage .mage-scenario-results{overflow:auto}
      #benchPage .mage-scenario-results table{width:100%;border-collapse:collapse;font-size:11px}
      #benchPage .mage-scenario-results th,#benchPage .mage-scenario-results td{padding:6px;border-bottom:1px solid #2c3a2f;text-align:right;white-space:nowrap}
      #benchPage .mage-scenario-results th:first-child,#benchPage .mage-scenario-results td:first-child{text-align:left}
      #benchPage .mage-spec-fire{color:#ff9a63}.mage-spec-frost{color:#77c9ff}.mage-spec-base{color:#c8cec7}
      #benchPage .dps-note{color:#8a9287;font-size:11px;margin-top:14px;line-height:1.5}`;
    document.head.append(style);

    const page=document.createElement('section');
    page.id='benchPage'; page.className='app-page'; page.hidden=true;
    page.innerHTML=`
      <div class="card">
        <h2>DPS Bench — manichino</h2>
        <p class="muted">Tutte le classi ciclano il mazzo su manichini a HP infiniti, giocando per il massimo danno. Valori e talenti sono modificabili: oltre alla media viene registrato il miglior round da 3 azioni per individuare i picchi.</p>
        <div class="dps-controls">
          <button id="dps-back" class="secondary">← Editor</button>
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
                <tr><td>Picco in 1 round</td><td class="v dpsc-peak">0</td></tr>
                <tr><td>Azioni</td><td class="v dpsc-acts">0</td></tr>
                <tr><td>Round</td><td class="v dpsc-rounds">0</td></tr>
                <tr><td>Azioni sprecate</td><td class="v dpsc-wasted">0</td></tr>
              </table>
            </article>`).join('')}
        </div>
        <section class="mage-scenario-bench">
          <div class="mage-scenario-head"><div><h3>Scenari strategici Mago</h3><p class="muted">Party completo · Base, Fire e Frost · Normal LV9, Heroic LV12, Hardcore LV13 · stessi semi casuali.</p></div><button id="mage-scenario-run">Esegui matrice</button></div>
          <progress class="mage-scenario-progress" id="mage-scenario-progress" max="1" value="0" hidden></progress>
          <div class="mage-scenario-results" id="mage-scenario-results"><small>Boss singolo, orda da controllare e stanza mista. Il test usa il motore reale e non modifica il bilanciamento.</small></div>
        </section>
        <section class="mage-scenario-bench">
          <div class="mage-scenario-head"><div><h3>Scenari strategici Rogue</h3><p class="muted">Party completo · Base, Assassination e Subtlety · Normal LV9, Heroic LV12, Hardcore LV13 · stessi semi casuali.</p></div><button id="rogue-scenario-run">Esegui matrice</button></div>
          <progress class="mage-scenario-progress" id="rogue-scenario-progress" max="1" value="0" hidden></progress>
          <div class="mage-scenario-results" id="rogue-scenario-results"><small>Misura burst, danno totale, Command rimosse e attivazioni negate nel motore reale.</small></div>
        </section>
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
        <p class="dps-note">Il simulatore astratto gestisce mazzo, pesca, posizionamento e cast lungo; il danno per colpo viene dai valori qui sopra. Il Guerriero non usa stance. AI: <b>Greedy</b> = ogni azione sceglie il miglior danno/azione; <b>Rollout MC</b> = simula più giocate future. Le matrici strategiche usano invece il motore reale: Combo Point, controllo, griglia, party e Overlord sono risolti integralmente. Fireball e Pyroblast richiedono 2 carte + 2 azioni; il controllo non viene convertito in danno nel banco monoclasse.</p>
      </div>`;
    document.querySelector('main').append(page);

    const tab=document.createElement('button');
    tab.className='page-tab'; tab.dataset.page='benchPage'; tab.textContent='DPS Bench';
    const pageTabs=document.querySelector('.page-tabs');
    if(pageTabs)pageTabs.append(tab);
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
      document.body.classList.add('player-board-active');
      const setup=document.getElementById('campaignSetup'); if(setup)setup.hidden=true;
      const menu=document.getElementById('mainMenu');if(menu)menu.hidden=true;
      document.querySelectorAll('.page-tab').forEach(x=>x.classList.toggle('active',x===tab));
      pages().forEach(p=>p.hidden=(p.id!=='benchPage'));
    }
    (function addSetupEntry(tries){
      const panels=[document.querySelector('#campaignSetup .campaign-controls'),document.querySelector('#editorMenuPanel .menu-buttons')].filter(Boolean);
      panels.forEach(panel=>{if(panel.querySelector('[data-dps-entry]'))return;const entry=document.createElement('button');entry.className='secondary';entry.type='button';entry.dataset.dpsEntry='';entry.textContent='🎯 DPS Bench';entry.onclick=openBench;panel.append(entry)});
      if(panels.length<2&&tries<40)setTimeout(()=>addSetupEntry(tries+1),150);
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
    document.getElementById('dps-back').onclick=()=>{stop();page.hidden=true;document.body.classList.remove('player-board-active');const menu=document.getElementById('mainMenu');if(menu?._showEditors)menu._showEditors();else if(menu)menu.hidden=false};
    const scenarioRun=document.getElementById('mage-scenario-run'),scenarioProgress=document.getElementById('mage-scenario-progress'),scenarioResults=document.getElementById('mage-scenario-results');let scenarioFrame=null;
    const scenarioMessage=event=>{if(!scenarioFrame||event.source!==scenarioFrame.contentWindow||event.origin!==location.origin)return;const data=event.data||{};if(data.type==='mage-benchmark-progress'){scenarioProgress.max=data.total;scenarioProgress.value=data.done;scenarioRun.textContent=`Test ${data.done}/${data.total}`;return}if(data.type==='mage-benchmark-error'){scenarioResults.innerHTML=`<strong>Test non completato</strong><pre>${String(data.message)}</pre>`;scenarioRun.disabled=false;scenarioRun.textContent='Riprova';scenarioFrame.remove();scenarioFrame=null;return}if(data.type!=='mage-benchmark-result')return;const spec={base:'Base',fire:'Fire',frost:'Frost'},rows=data.result.summary.map(row=>`<tr><td>${row.scenarioLabel}</td><td>${row.difficulty} · LV${row.level}</td><td class="mage-spec-${row.spec}">${spec[row.spec]}</td><td>${row.clearRate}%</td><td>${row.avgRounds}</td><td>${row.avgPartyHpPct}%</td><td>${row.avgDamageTaken}</td><td>${row.avgControlStops}</td><td>${row.avgConsumables}</td><td>${row.avgMageDamage}</td></tr>`).join('');scenarioResults.innerHTML=`<table><thead><tr><th>Scenario</th><th>Livello</th><th>Build</th><th>Vittorie</th><th>Round</th><th>HP party</th><th>Danni subiti</th><th>Turni negati</th><th>Consumabili</th><th>Danno Mago</th></tr></thead><tbody>${rows}</tbody></table><small>${data.result.samples} prove accoppiate per combinazione.</small>`;scenarioProgress.hidden=true;scenarioRun.disabled=false;scenarioRun.textContent='Esegui di nuovo';scenarioFrame.remove();scenarioFrame=null};
    window.addEventListener('message',scenarioMessage);
    scenarioRun.onclick=()=>{scenarioFrame?.remove();scenarioRun.disabled=true;scenarioRun.textContent='Avvio…';scenarioProgress.hidden=false;scenarioProgress.max=81;scenarioProgress.value=0;scenarioResults.innerHTML='<small>Simulazione in corso nel motore reale…</small>';scenarioFrame=document.createElement('iframe');scenarioFrame.hidden=true;scenarioFrame.src=`index.html?mage-benchmark-worker=1&samples=3&run=${Date.now()}`;document.body.append(scenarioFrame)};
    const rogueRun=document.getElementById('rogue-scenario-run'),rogueProgress=document.getElementById('rogue-scenario-progress'),rogueResults=document.getElementById('rogue-scenario-results');let rogueFrame=null;
    window.addEventListener('message',event=>{if(!rogueFrame||event.source!==rogueFrame.contentWindow||event.origin!==location.origin)return;const data=event.data||{};if(data.type==='rogue-benchmark-progress'){rogueProgress.max=data.total;rogueProgress.value=data.done;rogueRun.textContent=`Test ${data.done}/${data.total}`;return}if(data.type==='rogue-benchmark-error'){rogueResults.innerHTML=`<strong>Test non completato</strong><pre>${String(data.message)}</pre>`;rogueRun.disabled=false;rogueRun.textContent='Riprova';rogueFrame.remove();rogueFrame=null;return}if(data.type!=='rogue-benchmark-result')return;const spec={base:'Base',burst:'Assassination',control:'Subtlety'},rows=data.result.summary.map(row=>`<tr><td>${row.scenarioLabel}</td><td>${row.difficulty} · LV${row.level}</td><td class="mage-spec-${row.spec}">${spec[row.spec]}</td><td>${row.clearRate}%</td><td>${row.avgRounds}</td><td>${row.avgPartyHpPct}%</td><td>${row.avgDamageTaken}</td><td>${row.avgControlStops}</td><td>${row.avgCommandRemoved}</td><td>${row.avgRogueDamage}</td></tr>`).join('');rogueResults.innerHTML=`<table><thead><tr><th>Scenario</th><th>Livello</th><th>Build</th><th>Vittorie</th><th>Round</th><th>HP party</th><th>Danni subiti</th><th>Turni negati</th><th>Command −</th><th>Danno Rogue</th></tr></thead><tbody>${rows}</tbody></table><small>${data.result.samples} prove accoppiate per combinazione.</small>`;rogueProgress.hidden=true;rogueRun.disabled=false;rogueRun.textContent='Esegui di nuovo';rogueFrame.remove();rogueFrame=null});
    rogueRun.onclick=()=>{rogueFrame?.remove();rogueRun.disabled=true;rogueRun.textContent='Avvio…';rogueProgress.hidden=false;rogueProgress.max=81;rogueProgress.value=0;rogueResults.innerHTML='<small>Simulazione in corso nel motore reale…</small>';rogueFrame=document.createElement('iframe');rogueFrame.hidden=true;rogueFrame.src=`index.html?rogue-benchmark-worker=1&samples=3&run=${Date.now()}`;document.body.append(rogueFrame)};
    resetSims();
  }

  function runWorker(params){
    TARGETS=Math.max(1,Math.min(4,+params.get('targets')||1));const requestedBuild=params.get('build'),build=requestedBuild==='base'?'base':requestedBuild==='aoe'?'aoe':'single',rounds=Math.max(50,Math.min(2000,+params.get('rounds')||600)),originalRandom=Math.random;let seed=90210+TARGETS*100+(build==='aoe'?1:build==='single'?2:0);Math.random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
    for(const role of ROLES){ACTIVE[role].clear();for(const talent of BENCH_BUILDS[build]?.[role]||[])ACTIVE[role].add(talent)}
    sims=ROLES.map(newSim);for(const sim of sims)advance(sim,rounds);Math.random=originalRandom;
    const result={build,targets:TARGETS,rounds,results:sims.map(sim=>({role:sim.role,label:LABELS[sim.role],damage:sim.damage,dpa:+(sim.damage/sim.actions).toFixed(3),dpr:+(sim.damage/sim.rounds).toFixed(3),peakRound:sim.peakRound,wastedPct:+(100*sim.wasted/sim.actions).toFixed(1)})).sort((a,b)=>b.dpr-a.dpr)};document.body.textContent=JSON.stringify(result,null,2);
  }
  function init(){
    const params=new URLSearchParams(location.search);if(params.has('dps-benchmark-worker')){runWorker(params);return}if(params.has('mage-benchmark-worker')||params.has('rogue-benchmark-worker'))return;
    if(!document.querySelector('main')||typeof startBoardCampaign!=='function'){setTimeout(init,150);return;}
    buildUI();
  }
  if(document.readyState==='complete'||document.readyState==='interactive')init();
  else window.addEventListener('DOMContentLoaded',init);
})();
