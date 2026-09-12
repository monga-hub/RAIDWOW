'use strict';

// Geografia fissa del Tempio di Grum'Arat. Gli incontri saranno assegnati
// dalle scelte di partita, non dalla generazione della mappa.
const GRUMARAT_TEMPLE={
  id:'grumarat-temple',
  art:'assets/optimized/dungeon-paludi-organic-master-v4.png',
  start:'gate',
  rooms:[
    {id:'gate',number:1,name:'La Scalinata delle Tre Bocche',kind:'entrance',x:50,y:84,links:['vestibule'],closeup:'assets/optimized/dungeon-closeups/01-ingresso-tempio.webp?v=3'},
    {id:'vestibule',number:2,name:'Il Vestibolo della Veglia',kind:'hall',x:50,y:72,links:['gate','cistern','ossuary'],closeup:'assets/optimized/dungeon-closeups/02-vestibolo-veglia.webp?v=3'},
    {id:'cistern',number:3,name:'La Rotonda del Girino Sacro',kind:'crossroads',x:50,y:58,links:['vestibule','ossuary','root-gallery','high-stairs'],closeup:'assets/optimized/dungeon-closeups/03-rotonda-girino-sacro.webp?v=3'},
    {id:'ossuary',number:4,name:'L’Ossario delle Ossa Fradice',kind:'chapel',x:22,y:59,links:['vestibule','cistern','tongue-pools'],closeup:'assets/optimized/dungeon-closeups/04-ossario-ossa-fradice.webp?v=3'},
    {id:'tongue-pools',number:5,name:'Le Pozze delle Lingue in Agguato',kind:'pools',x:19,y:43,links:['ossuary','high-stairs'],closeup:'assets/optimized/dungeon-closeups/05-pozze-lingue-agguato.webp?v=5',key:'Chiave Enrage I'},
    {id:'root-gallery',number:6,name:'La Galleria delle Radici che Ascoltano',kind:'gallery',x:77,y:47,links:['cistern','eye-well','high-stairs'],closeup:'assets/optimized/dungeon-closeups/06-galleria-radici.webp?v=3'},
    {id:'eye-well',number:7,name:'Il Pozzo dell’Occhio Insonne',kind:'sanctuary',x:79,y:64,links:['root-gallery','high-stairs'],closeup:'assets/optimized/dungeon-closeups/07-pozzo-occhio-insonne.webp?v=3',key:'Chiave Enrage II'},
    {id:'high-stairs',number:8,name:'Le Scale del Miasma',kind:'stairs',x:50,y:41,links:['cistern','tongue-pools','root-gallery','skull-sanctum','four-eyes-chapel'],closeup:'assets/optimized/dungeon-closeups/08-scale-miasma.webp?v=4'},
    {id:'skull-sanctum',number:9,name:'Il Santuario dei Teschi Sommersi',kind:'sanctuary',x:75,y:26,links:['high-stairs','throne'],closeup:'assets/optimized/dungeon-closeups/09-santuario-teschi.webp?v=3'},
    {id:'throne',number:10,name:'Il Trono Sommerso di Grum’Arat',kind:'finale',x:50,y:25,links:['skull-sanctum'],closeup:'assets/optimized/dungeon-closeups/10-trono-sommerso.webp?v=3'},
    {id:'four-eyes-chapel',number:11,name:'La Cappella delle Quattro Pupille',kind:'chapel',x:23,y:28,links:['high-stairs'],closeup:'assets/optimized/dungeon-closeups/11-cappella-quattro-pupille.webp?v=3'}
  ]
};

function fixedTempleRoom(id){return GRUMARAT_TEMPLE.rooms.find(room=>room.id===id)}
function validateFixedTemple(){
  const rooms=GRUMARAT_TEMPLE.rooms,ids=new Set(rooms.map(room=>room.id));
  return rooms.length===11&&ids.size===11&&rooms.every(room=>room.links.every(link=>ids.has(link)))&&!!fixedTempleRoom(GRUMARAT_TEMPLE.start);
}

if(!validateFixedTemple())throw new Error('Mappa fissa del Tempio non valida');
