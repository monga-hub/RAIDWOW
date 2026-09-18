'use strict';

// Geografia e incontri fissi del Tempio di Grum'Arat. Le carte di percorso
// continuano a governare tesori e collegamenti, mentre ogni sala ha una
// composizione riconoscibile e ripetibile.
const GRUMARAT_TEMPLE={
  id:'grumarat-temple',
  start:'gate',
  rooms:[
    {id:'gate',number:1,name:'Ingresso del Dungeon',kind:'entrance',encounter:['GOBLIN','GOBLIN'],links:['high-stairs','tongue-pools'],closeup:'assets/ingresso.jpeg?v=1',terrain:'assets/terrain-start-v1.jpg?v=1',terrainLayout:{rows:4,cols:6,passages:{west:[2,3],east:[2,3]},obstacles:[]}},
    {id:'vestibule',number:2,name:'Il Crocevia delle Lucciole',kind:'hall',encounter:['GOBLIN','GOBLIN'],objective:{type:'defense',title:'Difesa della Luce',name:'Lanterna delle Lucciole',hp:12,rounds:4,breachCol:3,damagePerEnemy:1,position:{row:2,col:1},waves:[['GOBLIN','GOBLIN'],['GOBLIN'],['GOBLIN','ENGINEER'],['WARCHIEF']]},links:['gate','cistern'],closeup:'assets/stanza-e2-01.jpeg?v=1',terrain:'assets/terrain-e2-01-v1.jpg?v=1',terrainLayout:{rows:4,cols:6,passages:{west:[2,3],east:[2,3]},obstacles:[]}},
    {id:'cistern',number:3,name:'La Gola del Fango Silente',kind:'crossroads',encounter:['GOBLIN','GOBLIN','ENGINEER'],links:['vestibule','ossuary','high-stairs','eye-well','tongue-pools','root-gallery'],closeup:'assets/stanza-e2-02.jpeg?v=1',terrain:'assets/terrain-e2-02-v1.jpg?v=1',terrainLayout:{rows:4,cols:6,passages:{west:[2,3],east:[2,3]},obstacles:[]}},
    {id:'ossuary',number:4,name:'La Cripta delle Spore Dorate',kind:'chapel',encounter:['GOBLIN','GOBLIN','WARCHIEF'],links:['cistern','tongue-pools','high-stairs'],closeup:'assets/stanza-e2-06.jpeg?v=1',terrain:'assets/terrain-e2-06-v1.jpg?v=1',terrainLayout:{rows:4,cols:6,passages:{west:[2,3],east:[2,3]},obstacles:[]}},
    {id:'tongue-pools',number:5,name:'Le Pozze delle Lingue in Agguato',kind:'pools',encounter:['GOBLIN','WARCHIEF','ENGINEER'],links:['gate','ossuary','high-stairs','four-eyes-chapel','cistern'],closeup:'assets/stanza-e2-08.jpeg?v=1',terrain:'assets/terrain-e2-08-v1.jpg?v=1',terrainLayout:{rows:4,cols:6,passages:{west:[2,3],east:[2,3]},obstacles:[]},key:'Chiave Enrage I'},
    {id:'root-gallery',number:6,name:'Il Crocevia delle Radici Affamate',kind:'gallery',encounter:['GOBLIN','GOBLIN','ENGINEER'],links:['eye-well','high-stairs','skull-sanctum','cistern'],closeup:'assets/stanza-e2-05.jpeg?v=1',terrain:'assets/terrain-e2-05-v1.jpg?v=1',terrainLayout:{rows:4,cols:6,passages:{west:[2,3],east:[2,3]},obstacles:[]}},
    {id:'eye-well',number:7,name:'Il Corridoio dei Mille Occhi',kind:'sanctuary',encounter:['GOBLIN','ENGINEER','WARCHIEF'],links:['root-gallery','cistern','high-stairs'],closeup:'assets/stanza-e2-04.jpeg?v=1',terrain:'assets/terrain-e2-04-v1.jpg?v=1',terrainLayout:{rows:4,cols:6,passages:{west:[2,3],east:[2,3]},obstacles:[]},key:'Chiave Enrage II'},
    {id:'high-stairs',number:8,name:'La Breccia del Miasma',kind:'stairs',encounter:['GOBLIN','GOBLIN','ENGINEER','WARCHIEF'],links:['gate','cistern','tongue-pools','root-gallery','skull-sanctum','four-eyes-chapel','throne','ossuary','eye-well'],closeup:'assets/stanza-e2-09.jpeg?v=1',terrain:'assets/terrain-e2-09-v1.jpg?v=1',terrainLayout:{rows:4,cols:6,passages:{west:[2,3],east:[2,3]},obstacles:[]}},
    {id:'skull-sanctum',number:9,name:'Il Bivio dei Teschi Sommersi',kind:'sanctuary',encounter:['ENGINEER','WARCHIEF','WARCHIEF'],links:['high-stairs','root-gallery'],closeup:'assets/stanza-e2-03.jpeg?v=1',terrain:'assets/terrain-e2-03-v1.jpg?v=1',terrainLayout:{rows:4,cols:6,passages:{west:[2,3],east:[2,3]},obstacles:[]}},
    {id:'throne',number:10,name:'Il Trono di Grum’Arat',kind:'finale',encounter:[],boss:'miniBoss',links:['high-stairs'],closeup:'assets/trono-grumara.jpeg?v=1',terrain:'assets/terrain-special-mini-boss-v1.jpg?v=1',terrainLayout:{rows:4,cols:6,passages:{west:[2,3],east:[2,3]},obstacles:[]}},
    {id:'four-eyes-chapel',number:11,name:'L’Altare delle Monete Marce',kind:'chapel',encounter:['GOBLIN','GOBLIN','ENGINEER','ENGINEER'],links:['high-stairs','tongue-pools'],closeup:'assets/stanza-e2-10.jpeg?v=1',terrain:'assets/terrain-e2-10-v1.jpg?v=1',terrainLayout:{rows:4,cols:6,passages:{west:[2,3],east:[2,3]},obstacles:[]}}
  ]
};

function fixedTempleRoom(id){return GRUMARAT_TEMPLE.rooms.find(room=>room.id===id)}
function applyFixedTempleEncounter(g,room,templeId=g?.temple?.pendingId||g?.temple?.currentId){
  const plan=fixedTempleRoom(templeId);if(!plan||!room||!Array.isArray(plan.encounter))return room;
  room.fighters=[...plan.encounter];room.fightersAlive=room.fighters.length;room.fixedEncounter=true;room.objective=plan.objective?structuredClone(plan.objective):null;
  room.composition??={known:{},hidden:{},total:{}};
  room.composition.known={...room.composition.known,FIGHTER:room.fighters.length};
  room.composition.hidden={...room.composition.hidden,FIGHTER:0};
  room.composition.total={...room.composition.total,FIGHTER:room.fighters.length};
  return room;
}
function validateFixedTemple(){
  const rooms=GRUMARAT_TEMPLE.rooms,ids=new Set(rooms.map(room=>room.id)),tokens=new Set(['GOBLIN','ENGINEER','WARCHIEF']);
  return rooms.length===11&&ids.size===11&&rooms.every(room=>room.links.every(link=>ids.has(link))&&room.encounter.every(token=>tokens.has(token)))&&!!fixedTempleRoom(GRUMARAT_TEMPLE.start);
}

if(!validateFixedTemple())throw new Error('Mappa fissa del Tempio non valida');
