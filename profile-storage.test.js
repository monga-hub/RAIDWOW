'use strict';

const assert=require('node:assert/strict');
const RaidProfile=require('./profile-storage.js');

function memoryStorage(seed={}){
  const values=new Map(Object.entries(seed));
  return{getItem:key=>values.has(key)?values.get(key):null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key),raw:key=>values.get(key)};
}

const legacyJourney={company:'Compagnia del Fango',roles:['warrior','hunter','shaman','paladin'],roster:[{role:'warrior',heroLevel:12,xp:3,deck:['sword']},{role:'hunter',heroLevel:7,xp:5,deck:['quarry_mark']}],initiative:['warrior','hunter','overlord','shaman','paladin'],unlocked:2,deepWingCleared:false};
const storage=memoryStorage({[RaidProfile.LEGACY_JOURNEY_KEY]:JSON.stringify(legacyJourney),[RaidProfile.LEGACY_CLEARED_KEY]:JSON.stringify({normale:true,heroic:true})});
const migrated=RaidProfile.load(storage);

assert.equal(migrated.version,1);
assert.equal(migrated.company,'Compagnia del Fango');
assert.deepEqual(Object.keys(migrated.heroes),RaidProfile.ROLES);
assert.equal(migrated.heroes.warrior.heroLevel,12);
assert.equal(migrated.heroes.mage,null);
assert.equal(migrated.unlocks.raidDifficultyIndex,2);
assert.deepEqual(migrated.unlocks.cleared,{normale:true,heroic:true});
assert.equal(migrated.stash.length,0);
assert.deepEqual({runs:migrated.stats.runs,wins:migrated.stats.wins,losses:migrated.stats.losses},{runs:0,wins:0,losses:0});
assert.deepEqual(JSON.parse(storage.raw(RaidProfile.LEGACY_JOURNEY_KEY)),legacyJourney,'La migrazione non deve modificare il vecchio salvataggio');
assert.equal(RaidProfile.load(storage).createdAt,migrated.createdAt,'La migrazione deve essere idempotente');

const nextJourney={...legacyJourney,company:'Radici Erranti',roster:[...legacyJourney.roster,{role:'mage',heroLevel:6,xp:1,deck:['frostbolt']}],deepWingCleared:true};
assert.equal(RaidProfile.saveJourney(storage,nextJourney),true);
assert.equal(RaidProfile.load(storage).heroes.mage.heroLevel,6);
assert.equal(RaidProfile.load(storage).unlocks.wings.deep,true);
assert.deepEqual(JSON.parse(storage.raw(RaidProfile.LEGACY_JOURNEY_KEY)),nextJourney,'Durante la transizione il journey v1 deve continuare a essere scritto');

assert.equal(RaidProfile.markCleared(storage,'profonda'),true);
assert.equal(JSON.parse(storage.raw(RaidProfile.LEGACY_CLEARED_KEY)).profonda,true);
assert.equal(RaidProfile.load(storage).unlocks.cleared.profonda,true);

const activeStorage=memoryStorage({[RaidProfile.LEGACY_JOURNEY_KEY]:JSON.stringify(legacyJourney)});
RaidProfile.load(activeStorage);
assert.equal(RaidProfile.saveHeroes(activeStorage,[{role:'warrior',heroLevel:13,deck:['sword']}]),true);
assert.deepEqual(RaidProfile.load(activeStorage).activeJourney,legacyJourney,'Modificare la Scuderia non deve alterare la spedizione attiva');
const stableProfile=RaidProfile.load(activeStorage);stableProfile.company='Custodi della Luna';stableProfile.stash=[{item:'silver_bomb',count:2}];stableProfile.heroes.warrior.bag=[{item:'bronze_bandage',count:1}];
assert.equal(RaidProfile.write(activeStorage,stableProfile),true);
assert.equal(RaidProfile.load(activeStorage).company,'Custodi della Luna','Il nome della compagnia deve persistere nel profilo');
assert.deepEqual(RaidProfile.load(activeStorage).stash,[{item:'silver_bomb',count:2}],'Il deposito condiviso deve persistere nel profilo');
assert.deepEqual(RaidProfile.load(activeStorage).heroes.warrior.bag,[{item:'bronze_bandage',count:1}],'La Bag modificata in Scuderia deve persistere con l’eroe');
assert.equal(RaidProfile.recordRun(activeStorage,'win',['warrior','hunter'],'heroic','temple','2026-09-19T12:00:00.000Z'),true);
assert.equal(RaidProfile.recordRun(activeStorage,'loss',['warrior','shaman'],'normale','temple','2026-09-19T13:00:00.000Z'),true);
const career=RaidProfile.load(activeStorage).stats;
assert.deepEqual({runs:career.runs,wins:career.wins,losses:career.losses},{runs:2,wins:1,losses:1});
assert.equal(career.heroes.warrior,2);assert.equal(career.heroes.hunter,1);assert.equal(career.heroes.shaman,1);
assert.equal(career.completions.heroic,1);assert.equal(career.lastRun.result,'loss');
const backup=JSON.parse(JSON.stringify({type:'raidwow-profile-backup',profile:RaidProfile.load(activeStorage)}));
assert.equal(RaidProfile.normalize(backup.profile).stats.runs,2,'Un profilo esportato deve poter essere validato prima dell’importazione');
assert.equal(RaidProfile.normalize({version:99}),null,'Un file di una versione sconosciuta non deve sostituire il profilo');

assert.equal(RaidProfile.clearJourney(storage),true);
assert.equal(storage.getItem(RaidProfile.LEGACY_JOURNEY_KEY),null);
assert.equal(RaidProfile.load(storage).activeJourney,null);
assert.deepEqual(RaidProfile.load(storage).selectedRoles,nextJourney.roles,'Terminare la spedizione deve conservare la formazione preferita');
assert.equal(RaidProfile.load(storage).heroes.warrior.heroLevel,12,'Nuova run non deve cancellare la scuderia del profilo');

assert.equal(RaidProfile.saveHeroes(storage,[{role:'hunter',heroLevel:9,xp:2,deck:['quarry_mark']}],'Radici Erranti'),true);
assert.equal(RaidProfile.load(storage).heroes.hunter.heroLevel,9,'La spedizione deve aggiornare solo gli eroi partecipanti');
assert.equal(RaidProfile.load(storage).heroes.warrior.heroLevel,12,'Gli eroi rimasti in Scuderia non devono essere sovrascritti');
assert.equal(RaidProfile.load(storage).activeJourney,null,'Aggiornare gli eroi non deve riaprire una spedizione conclusa');

const corrupt=memoryStorage({[RaidProfile.PROFILE_KEY]:'{rotto',[RaidProfile.LEGACY_JOURNEY_KEY]:JSON.stringify(legacyJourney)});
assert.equal(RaidProfile.load(corrupt),null);
assert.deepEqual(RaidProfile.loadJourney(corrupt),legacyJourney,'Un profilo corrotto deve lasciare disponibile il rollback legacy');
assert.equal(corrupt.raw(RaidProfile.PROFILE_KEY),'{rotto','Un profilo corrotto non deve essere sovrascritto automaticamente');

console.log('Profile migration checks passed.');
