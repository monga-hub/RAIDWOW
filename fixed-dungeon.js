'use strict';

// Geografia e incontri fissi del Tempio di Grum'Arat. Le carte di percorso
// continuano a governare tesori e collegamenti, mentre ogni sala ha una
// composizione riconoscibile e ripetibile.
const GRUMARAT_TEMPLE={
  id:'grumarat-temple',
  art:'assets/optimized/dungeon-paludi-organic-master-v4.png',
  start:'gate',
  rooms:[
    {id:'gate',number:1,name:'La Scalinata delle Tre Bocche',kind:'entrance',encounter:['GOBLIN','GOBLIN'],x:49.9,y:92.99,links:['vestibule'],closeup:'assets/optimized/dungeon-closeups/01-ingresso-tempio.webp?v=3'},
    {id:'vestibule',number:2,name:'Il Vestibolo della Veglia',kind:'hall',encounter:['GOBLIN','GOBLIN'],x:49.68,y:78.5,links:['gate','cistern'],closeup:'assets/optimized/dungeon-closeups/02-vestibolo-veglia.webp?v=3'},
    {id:'cistern',number:3,name:'La Rotonda del Girino Sacro',kind:'crossroads',encounter:['GOBLIN','GOBLIN','ENGINEER'],x:49.77,y:62.54,links:['vestibule','ossuary','high-stairs','eye-well','tongue-pools','root-gallery'],closeup:'assets/optimized/dungeon-closeups/03-rotonda-girino-sacro.webp?v=3'},
    {id:'ossuary',number:4,name:'L’Ossario delle Ossa Fradice',kind:'chapel',encounter:['GOBLIN','GOBLIN','WARCHIEF'],x:18.42,y:68.71,links:['cistern','tongue-pools','high-stairs'],closeup:'assets/optimized/dungeon-closeups/04-ossario-ossa-fradice.webp?v=3'},
    {id:'tongue-pools',number:5,name:'Le Pozze delle Lingue in Agguato',kind:'pools',encounter:['GOBLIN','WARCHIEF','ENGINEER'],x:16.74,y:47.04,links:['ossuary','high-stairs','four-eyes-chapel','cistern'],closeup:'assets/optimized/dungeon-closeups/05-pozze-lingue-agguato.webp?v=5',key:'Chiave Enrage I'},
    {id:'root-gallery',number:6,name:'La Galleria delle Radici che Ascoltano',kind:'gallery',encounter:['GOBLIN','GOBLIN','ENGINEER'],x:81.36,y:47.59,links:['eye-well','high-stairs','skull-sanctum','cistern'],closeup:'assets/optimized/dungeon-closeups/06-galleria-radici.webp?v=3'},
    {id:'eye-well',number:7,name:'Il Pozzo dell’Occhio Insonne',kind:'sanctuary',encounter:['GOBLIN','ENGINEER','WARCHIEF'],x:80.46,y:70.15,links:['root-gallery','cistern','high-stairs'],closeup:'assets/optimized/dungeon-closeups/07-pozzo-occhio-insonne.webp?v=3',key:'Chiave Enrage II'},
    {id:'high-stairs',number:8,name:'Le Scale del Miasma',kind:'stairs',encounter:['GOBLIN','GOBLIN','ENGINEER','WARCHIEF'],x:49.48,y:39.78,links:['cistern','tongue-pools','root-gallery','skull-sanctum','four-eyes-chapel','throne','ossuary','eye-well'],closeup:'assets/optimized/dungeon-closeups/08-scale-miasma.webp?v=4'},
    {id:'skull-sanctum',number:9,name:'Il Santuario dei Teschi Sommersi',kind:'sanctuary',encounter:['ENGINEER','WARCHIEF','WARCHIEF'],x:76.76,y:28.28,links:['high-stairs','root-gallery'],closeup:'assets/optimized/dungeon-closeups/09-santuario-teschi.webp?v=3'},
    {id:'throne',number:10,name:'Il Trono Sommerso di Grum’Arat',kind:'finale',encounter:[],boss:'miniBoss',x:49.74,y:25.66,links:['high-stairs'],closeup:'assets/optimized/dungeon-closeups/10-trono-sommerso.webp?v=3'},
    {id:'four-eyes-chapel',number:11,name:'La Cappella delle Quattro Pupille',kind:'chapel',encounter:['GOBLIN','GOBLIN','ENGINEER','ENGINEER'],x:23.42,y:27.58,links:['high-stairs','tongue-pools'],closeup:'assets/optimized/dungeon-closeups/11-cappella-quattro-pupille.webp?v=3'}
  ]
};

function fixedTempleRoom(id){return GRUMARAT_TEMPLE.rooms.find(room=>room.id===id)}
function applyFixedTempleEncounter(g,room,templeId=g?.temple?.pendingId||g?.temple?.currentId){
  const plan=fixedTempleRoom(templeId);if(!plan||!room||!Array.isArray(plan.encounter))return room;
  room.fighters=[...plan.encounter];room.fightersAlive=room.fighters.length;room.fixedEncounter=true;
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
