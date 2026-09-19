'use strict';

const RAID_PROFILE_KEY='raidwow-profile-v1';
const RAID_LEGACY_JOURNEY_KEY='raidwow-journey-v1';
const RAID_LEGACY_CLEARED_KEY='raidwow-cleared-v1';
const RAID_PROFILE_ROLES=['warrior','healer','rogue','mage','paladin','warlock','shaman','hunter'];

function profileClone(value){return value==null?value:JSON.parse(JSON.stringify(value))}
function profileRead(storage,key){const raw=storage.getItem(key);if(raw===null)return null;try{return JSON.parse(raw)}catch{return undefined}}
function profileHeroes(roster=[]){const heroes=Object.fromEntries(RAID_PROFILE_ROLES.map(role=>[role,null]));for(const build of roster)if(build?.role&&build.role in heroes)heroes[build.role]=profileClone(build);return heroes}
function profileStats(stats={}){const count=value=>Math.max(0,Number(value)||0),heroes=Object.fromEntries(RAID_PROFILE_ROLES.map(role=>[role,count(stats.heroes?.[role])]));return{runs:count(stats.runs),wins:count(stats.wins),losses:count(stats.losses),heroes,completions:{...(stats.completions||{})},lastRun:stats.lastRun&&typeof stats.lastRun==='object'?profileClone(stats.lastRun):null}}
function migrateRaidProfile(journey=null,cleared={},now=new Date().toISOString()){
  const safeJourney=journey&&typeof journey==='object'?profileClone(journey):null,safeCleared=cleared&&typeof cleared==='object'?profileClone(cleared):{};
  return{version:1,createdAt:now,updatedAt:now,company:safeJourney?.company||'',heroes:profileHeroes(safeJourney?.roster),stash:[],selectedRoles:[...(safeJourney?.roles||[])],initiative:[...(safeJourney?.initiative||[])],unlocks:{cleared:safeCleared,raidDifficultyIndex:Math.max(0,Number(safeJourney?.unlocked)||0),wings:{deep:!!(safeJourney?.deepWingCleared||safeCleared.profonda)}},stats:profileStats(),activeJourney:safeJourney,migration:safeJourney||Object.keys(safeCleared).length?{source:'journey-v1',at:now}:null};
}
function normalizeRaidProfile(profile){
  if(!profile||profile.version!==1||typeof profile!=='object')return null;
  const normalized=profileClone(profile);normalized.company=typeof normalized.company==='string'?normalized.company:'';normalized.heroes={...profileHeroes(),...(normalized.heroes||{})};normalized.stash=Array.isArray(normalized.stash)?normalized.stash:[];normalized.selectedRoles=Array.isArray(normalized.selectedRoles)?normalized.selectedRoles:[];normalized.initiative=Array.isArray(normalized.initiative)?normalized.initiative:[];normalized.unlocks={cleared:{...(normalized.unlocks?.cleared||{})},raidDifficultyIndex:Math.max(0,Number(normalized.unlocks?.raidDifficultyIndex)||0),wings:{deep:!!normalized.unlocks?.wings?.deep}};normalized.stats=profileStats(normalized.stats);normalized.activeJourney=normalized.activeJourney&&typeof normalized.activeJourney==='object'?normalized.activeJourney:null;return normalized;
}
function loadRaidProfile(storage){
  const stored=profileRead(storage,RAID_PROFILE_KEY);if(stored!==null){if(stored===undefined)return null;return normalizeRaidProfile(stored)}
  const journey=profileRead(storage,RAID_LEGACY_JOURNEY_KEY),cleared=profileRead(storage,RAID_LEGACY_CLEARED_KEY),profile=migrateRaidProfile(journey===undefined?null:journey,cleared===undefined?{}:cleared);storage.setItem(RAID_PROFILE_KEY,JSON.stringify(profile));return profile;
}
function writeRaidProfile(storage,profile){const normalized=normalizeRaidProfile(profile);if(!normalized)return false;normalized.updatedAt=new Date().toISOString();storage.setItem(RAID_PROFILE_KEY,JSON.stringify(normalized));return true}
function loadProfileJourney(storage){const profile=loadRaidProfile(storage);if(profile)return profileClone(profile.activeJourney);const legacy=profileRead(storage,RAID_LEGACY_JOURNEY_KEY);return legacy===undefined?null:legacy}
function saveProfileJourney(storage,journey){
  storage.setItem(RAID_LEGACY_JOURNEY_KEY,JSON.stringify(journey));const profile=loadRaidProfile(storage);if(!profile)return false;
  profile.activeJourney=profileClone(journey);profile.company=journey?.company||profile.company;profile.selectedRoles=[...(journey?.roles||[])];profile.initiative=[...(journey?.initiative||[])];profile.unlocks.raidDifficultyIndex=Math.max(profile.unlocks.raidDifficultyIndex,Number(journey?.unlocked)||0);profile.unlocks.wings.deep=profile.unlocks.wings.deep||!!journey?.deepWingCleared;for(const build of journey?.roster||[])if(build?.role&&build.role in profile.heroes)profile.heroes[build.role]=profileClone(build);return writeRaidProfile(storage,profile);
}
function clearProfileJourney(storage){const profile=loadRaidProfile(storage);storage.removeItem(RAID_LEGACY_JOURNEY_KEY);if(!profile)return false;profile.activeJourney=null;profile.initiative=[];return writeRaidProfile(storage,profile)}
function saveProfileHeroes(storage,roster=[],company=''){const profile=loadRaidProfile(storage);if(!profile)return false;for(const build of roster)if(build?.role&&build.role in profile.heroes)profile.heroes[build.role]=profileClone(build);if(company)profile.company=company;return writeRaidProfile(storage,profile)}
function recordProfileRun(storage,result,roles=[],difficulty='normale',wing='temple',now=new Date().toISOString()){const profile=loadRaidProfile(storage);if(!profile||!['win','loss'].includes(result))return false;const stats=profile.stats=profileStats(profile.stats),key=wing==='deep'?'profonda':difficulty;stats.runs++;stats[result==='win'?'wins':'losses']++;if(result==='win')stats.completions[key]=Math.max(0,Number(stats.completions[key])||0)+1;for(const role of new Set(roles))if(role in stats.heroes)stats.heroes[role]++;stats.lastRun={result,difficulty:key,roles:[...new Set(roles)].filter(role=>RAID_PROFILE_ROLES.includes(role)),at:now};return writeRaidProfile(storage,profile)}
function loadProfileCleared(storage){const profile=loadRaidProfile(storage);if(profile)return profileClone(profile.unlocks.cleared);const legacy=profileRead(storage,RAID_LEGACY_CLEARED_KEY);return legacy&&legacy!==undefined?legacy:{}}
function markProfileCleared(storage,id){
  const cleared=loadProfileCleared(storage);if(cleared[id])return true;cleared[id]=true;storage.setItem(RAID_LEGACY_CLEARED_KEY,JSON.stringify(cleared));const profile=loadRaidProfile(storage);if(!profile)return false;profile.unlocks.cleared=profileClone(cleared);if(id==='profonda')profile.unlocks.wings.deep=true;return writeRaidProfile(storage,profile);
}

const RaidProfile={PROFILE_KEY:RAID_PROFILE_KEY,LEGACY_JOURNEY_KEY:RAID_LEGACY_JOURNEY_KEY,LEGACY_CLEARED_KEY:RAID_LEGACY_CLEARED_KEY,ROLES:RAID_PROFILE_ROLES,migrate:migrateRaidProfile,normalize:normalizeRaidProfile,load:loadRaidProfile,write:writeRaidProfile,loadJourney:loadProfileJourney,saveJourney:saveProfileJourney,clearJourney:clearProfileJourney,saveHeroes:saveProfileHeroes,recordRun:recordProfileRun,loadCleared:loadProfileCleared,markCleared:markProfileCleared};
if(typeof window!=='undefined')window.RaidProfile=RaidProfile;
if(typeof module!=='undefined'&&module.exports)module.exports=RaidProfile;
