'use strict';

const CONNECTED_ROOM_TILES=[
  {id:'E2-01',name:'Crocevia delle Lucciole Spettrali',connectors:[{id:'A',icons:{FIGHTER:0,TREASURE:1}},{id:'B',icons:{FIGHTER:0,TREASURE:1}},{id:'C',icons:{FIGHTER:1,TREASURE:0}},{id:'D',icons:{FIGHTER:0,TREASURE:0}}]},
  {id:'E2-02',name:'Gola del Fango Silente',connectors:[{id:'A',icons:{FIGHTER:0,TREASURE:0}},{id:'B',icons:{FIGHTER:2,TREASURE:0}}]},
  {id:'E2-03',name:'Bivio dei Teschi Sommersi',connectors:[{id:'A',icons:{FIGHTER:0,TREASURE:1}},{id:'B',icons:{FIGHTER:0,TREASURE:1}},{id:'C',icons:{FIGHTER:1,TREASURE:1}}]},
  {id:'E2-04',name:'Corridoio dei Mille Occhi',connectors:[{id:'A',icons:{FIGHTER:0,TREASURE:0}},{id:'B',icons:{FIGHTER:1,TREASURE:0}},{id:'C',icons:{FIGHTER:2,TREASURE:0}}]},
  {id:'E2-05',name:'Crocevia delle Radici Affamate',connectors:[{id:'A',icons:{FIGHTER:1,TREASURE:0}},{id:'B',icons:{FIGHTER:0,TREASURE:0}},{id:'C',icons:{FIGHTER:1,TREASURE:1}},{id:'D',icons:{FIGHTER:1,TREASURE:0}}]},
  {id:'E2-06',name:'Cripta delle Spore Dorate',connectors:[{id:'A',icons:{FIGHTER:1,TREASURE:1}},{id:'B',icons:{FIGHTER:0,TREASURE:1}}]},
  {id:'E2-07',name:'Bivio del Sangue Nero',connectors:[{id:'A',icons:{FIGHTER:1,TREASURE:0}},{id:'B',icons:{FIGHTER:2,TREASURE:0}},{id:'C',icons:{FIGHTER:1,TREASURE:0}}]},
  {id:'E2-08',name:'Pozze delle Lingue in Agguato',connectors:[{id:'A',icons:{FIGHTER:2,TREASURE:0}},{id:'B',icons:{FIGHTER:0,TREASURE:1}},{id:'C',icons:{FIGHTER:0,TREASURE:0}},{id:'D',icons:{FIGHTER:1,TREASURE:0}}]},
  {id:'E2-09',name:'Breccia del Miasma',connectors:[{id:'A',icons:{FIGHTER:2,TREASURE:1}},{id:'B',icons:{FIGHTER:0,TREASURE:0}}]},
  {id:'E2-10',name:'Altare delle Monete Marce',connectors:[{id:'A',icons:{FIGHTER:1,TREASURE:1}},{id:'B',icons:{FIGHTER:0,TREASURE:1}},{id:'C',icons:{FIGHTER:2,TREASURE:0}}]}
];

EXPLORATION_CONFIG_T7_B.connectionPlacement=true;
EXPLORATION_CONFIG_T7_B.roomTiles=CONNECTED_ROOM_TILES;
MINI_BOSS_TILE_T2.connectors=[{id:'A',icons:{FIGHTER:0,TREASURE:0}},{id:'B',icons:{FIGHTER:0,TREASURE:0}}];

function roomTileConnectors(tile){
  if(tile.connectors)return tile.connectors;
  return[{id:'LEGACY',icons:tile.contentIcons||{}},...(tile.exits||[])];
}

function chooseConnectedTile(x,selectedExit,tileId){
  if(!tileId)return chooseRoomTile(x.overlordHand,selectedExit,x);
  const index=x.overlordHand.findIndex(tile=>tile.id===tileId),tile=x.overlordHand[index];
  if(!tile)return{tile:null,index:-1,ageingForced:false,selectedAge:0};
  const selectedAge=x.tileAge[tile.id]||0;
  for(const other of x.overlordHand)if(other!==tile)x.tileAge[other.id]=(x.tileAge[other.id]||0)+1;
  delete x.tileAge[tile.id];
  return{tile,index,ageingForced:false,selectedAge};
}

const generateExplorationRoomWithoutConnections=generateExplorationRoom;
generateExplorationRoom=function(x,placement={}){
  if(!x.config.connectionPlacement)return generateExplorationRoomWithoutConnections(x);
  const parent=currentExplorationRoom(x);
  auditExploration(x,parent.state==='CLEARED'&&parent.canExplore,'uscita selezionata prima del clear');
  explorationEvent(x,'EXIT_OFFERED',{roomId:parent.id,exits:parent.exits.map(exit=>({exitId:exit.id,icons:exit.icons}))});
  const selectedExit=chooseExit(x,parent),otherExits=parent.exits.filter(exit=>exit!==selectedExit);
  explorationEvent(x,'EXIT_SELECTED',{roomId:parent.id,exitId:selectedExit.id,icons:selectedExit.icons});
  explorationEvent(x,'OVERLORD_HAND',{roomId:parent.id,tilesInHand:x.overlordHand.map(tile=>tile.id)});
  const handBefore=[...x.overlordHand],pick=chooseConnectedTile(x,selectedExit,placement.tileId),tile=pick.tile;
  if(!tile)throw new Error('Room Tile Overlord non disponibile');
  const connectors=roomTileConnectors(tile),connector=placement.connectorId?connectors.find(side=>side.id===placement.connectorId):randomChoice(connectors);
  if(!connector)throw new Error('Lato della Room Tile non disponibile');
  const remainingConnectors=connectors.filter(side=>side!==connector),otherConnectors=handBefore.filter(other=>other!==tile).flatMap(roomTileConnectors);
  const heroAvoidance=otherExits.length?otherExits.reduce((sum,exit)=>sum+(exit.icons.FIGHTER||0),0)/otherExits.length-(selectedExit.icons.FIGHTER||0):0;
  const overlordCounterplay=otherConnectors.length?(connector.icons.FIGHTER||0)-otherConnectors.reduce((sum,side)=>sum+(side.icons.FIGHTER||0),0)/otherConnectors.length:0;
  x.overlordHand.splice(pick.index,1);
  x.handPositionPicks[pick.index]=(x.handPositionPicks[pick.index]||0)+1;
  x.tilePicks[tile.id]=(x.tilePicks[tile.id]||0)+1;
  explorationEvent(x,'ROOM_TILE_SELECTED',{selectedTileId:tile.id,selectedConnectorId:connector.id,selectedConnectorIcons:connector.icons,selectedTileContentIcons:connector.icons,selectedTileExits:remainingConnectors});
  fillOverlordHand(x);
  auditExploration(x,x.overlordHand.length===x.config.roomHandSize||!x.tileDeck.length,'mano Overlord non ripristinata');
  const totalIcons=addIcons(selectedExit.icons,connector.icons);
  explorationEvent(x,'ROOM_COMPOSITION_CREATED',{heroExitIcons:selectedExit.icons,overlordConnectorIcons:connector.icons,exitIcons:selectedExit.icons,tileIcons:connector.icons,totalIcons});
  const fighterBefore={available:x.fighterBag.available.length,discarded:x.fighterBag.discarded.length},treasureBefore={available:x.treasureBag.available.length,discarded:x.treasureBag.discarded.length};
  const fighters=Array.from({length:totalIcons.FIGHTER||0},()=>drawExplorationBag(x,x.fighterBag,'FIGHTER'));
  const treasures=Array.from({length:totalIcons.TREASURE||0},()=>drawExplorationBag(x,x.treasureBag,'TREASURE'));
  x.fighterSequence.push(...fighters);x.treasureSequence.push(...treasures);
  const exitIcons=clone(selectedExit.icons),connectorIcons=clone(connector.icons);
  const room={id:`room-${x.roomsExplored+1}`,tileId:tile.id,parentRoomId:parent.id,entryExitId:selectedExit.id,entryConnectorId:connector.id,fighters,treasures,heroExitTreasure:selectedExit.icons.TREASURE||0,exits:clone(remainingConnectors),state:'READY',canExplore:false,depth:x.roomsExplored+1,composition:{exit:exitIcons,connector:connectorIcons,known:exitIcons,hidden:connectorIcons,total:totalIcons},agency:{heroAvoidance,overlordCounterplay},bagAtCreation:{fighter:fighterBefore,treasure:treasureBefore}};
  x.map.rooms.push(room);
  x.map.connections.push({fromRoomId:parent.id,fromExitId:selectedExit.id,toRoomId:room.id,toConnectorId:connector.id});
  x.map.currentRoomId=room.id;x.roomsExplored++;
  explorationEvent(x,'ROOM_CREATED',{roomId:room.id,tileId:room.tileId,heroExitId:selectedExit.id,overlordConnectorId:connector.id,fighters:room.fighters,treasures:room.treasures,exits:room.exits});
  auditExploration(x,room.exits.length===connectors.length-1,'il lato collegato non è stato consumato');
  return room;
};

function resetConnectedCampaignToEntrance(g){
  if(!g.exploration?.config.connectionPlacement)return g;
  g.exploration=createExplorationState(EXPLORATION_CONFIG_T7_B);
  g.sequence=[];g.enemies=[];g.encounter=0;g.round=1;g.currentEncounter=null;g.pendingRewards=[];g.pendingExitChoice=true;g.pendingOverlordPlacement=null;g.state='exit_choice';g.logs=[];
  g.telemetry.encounterEntries=[];g.selectedTarget='ally:warrior:0';initializeCommandEncounter(g);resetHeroTurn(g);
  note(g,'🧭 Gli Eroi scelgono la prima uscita; poi l’Overlord collega tile e lato.');
  return g;
}

function beginConnectedPlacement(g,exitId){
  const x=g.exploration,room=currentExplorationRoom(x),exit=room.exits.find(side=>side.id===exitId);
  if(!g.playerBoardEnabled||!x?.config.connectionPlacement||g.state!=='exit_choice'||!exit)return false;
  x.playerChosenExitId=exitId;offerMiniBossTile(x);g.pendingExitChoice=false;g.pendingOverlordPlacement={roomId:room.id,exitId,forceMiniBoss:!!g.forceMiniBossPlacement};g.state='overlord_placement';
  boardAudit(g,'HERO_EXIT_SELECTED',{roomId:room.id,exitId,icons:exit.icons});
  note(g,g.forceMiniBossPlacement?`🧭 Gli Eroi scelgono ${exitId}. Ora l’Overlord collega il Trono Sommerso di Grum’Arat.`:`🧭 Gli Eroi scelgono ${exitId}. Ora l’Overlord sceglie tile e lato.`);
  return true;
}

function resolveConnectedPlacement(g,tileId,connectorId){
  const x=g.exploration,pending=g.pendingOverlordPlacement,initial=!g.currentEncounter&&x.roomsExplored===0;
  if(!g.playerBoardEnabled||!x?.config.connectionPlacement||g.state!=='overlord_placement'||!pending)return false;
  const tile=x.overlordHand.find(item=>item.id===tileId),connector=roomTileConnectors(tile||{}).find(side=>side.id===connectorId);
  if(!tile||!connector||pending.forceMiniBoss&&tile.id!==MINI_BOSS_TILE_T2.id)return false;
  const next=generateExplorationRoom(x,{tileId,connectorId});recordMiniBossMaterialization(x,next);g.pendingOverlordPlacement=null;g.forceMiniBossPlacement=false;
  boardAudit(g,'OVERLORD_CONNECTION_SELECTED',{tileId,connectorId,connectorIcons:connector.icons,nextRoomId:next.id});
  if(initial){g.sequence=[next.fighters.length];g.encounter=0;g.state='playing';startEncounter(g);note(g,`🧩 ${roomDisplayName(x,next)}: uscita Eroi + lato ${connectorId} dell’Overlord.`);return true}
  g.sequence.push(next.fighters.length);g.encounter++;
  g.pendingRewards=advancementRewards(g);
  note(g,`🧩 L’Overlord collega ${roomDisplayName(x,next)} dal lato ${connectorId}.`);if(g.pendingRewards.length){g.state='reward';note(g,'★ Scegli DECK, TALENTO o RISERVA per ogni ricompensa di livello.')}else continueAfterRewards(g);return true;
}

function connectedPlacementPanel(g){
  const x=g.exploration,room=currentExplorationRoom(x),exit=room.exits.find(side=>side.id===g.pendingOverlordPlacement?.exitId);
  const forced=!!g.pendingOverlordPlacement?.forceMiniBoss,tiles=forced?x.overlordHand.filter(tile=>tile.id===MINI_BOSS_TILE_T2.id):x.overlordHand;
  return`<section class="hero connection-placement"><h2>${forced?'Stanza 11 — collega il Trono di Grum’Arat':'Turno Overlord — collega la Room Tile'}</h2><p>Uscita scelta dagli Eroi: <strong>${exit?.id||'—'}</strong> ${iconSummary(exit?.icons)}</p><div class="connection-tiles">${tiles.map(tile=>`<article class="connection-tile"><h3>${tile.name||tile.id}</h3><small>${tile.id} · scegli il lato da collegare</small>${roomTileConnectors(tile).map(side=>`<button data-connect-tile="${tile.id}" data-connect-side="${side.id}"><b>Lato ${side.id}</b>${iconSummary(side.icons)}<small>Restano ${roomTileConnectors(tile).length-1} uscite</small></button>`).join('')}</article>`).join('')}</div></section>`;
}
