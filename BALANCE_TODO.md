# Bilanciamento eroi e talenti

- [x] Correggere ed eseguire i benchmark isolati di Mago e Rogue senza cinematica.
  - 12 prove accoppiate per scenario/build/difficoltà: 324 combattimenti per classe.
  - Baseline: Mago Fire 23,48, Frost 25,29; Rogue Burst 23,37, Control 11,03.
- [x] Separare le identità Fire/Frost e portare Rogue Control vicino al Burst senza perdere controllo.
  - Boss singolo: Fire 6,44, Frost 5,97.
  - Più bersagli: Frost 43,06 contro 31,94 nell'orda; 32,81 contro 31,56 nella stanza mista.
  - Rogue: Burst 24,11, Control 20,23; Control mantiene 4,60 carte controllo medie contro 0,57.
- [x] Aggiungere scenari che richiedano controllo: protezione, rituali, sopravvivenza e rinforzi.
  - Matrice completa: 1.920 scontri, 80 composizioni, 3 difficoltà e 8 scenari.
  - Nei quattro obiettivi Frost supera Fire, ma Fire conserva almeno il 54% di successo in ciascuno.
  - Rogue Control 64,4% contro Burst 62,0%: vantaggio utile, non dominante.
- [x] Misurare ogni talento con test di ablazione, rimuovendo un nodo alla volta.
  - 5.024 scontri accoppiati: 127 confronti su 57 talenti, 8 scenari e 3 difficoltà.
  - Segnale più forte: Permafrost (+11,5% obiettivi), Thunder Stomp (+7,9%) e Mutilate (+5,2%).
  - Corrette le priorità AI: niente cast incompleti di Mind Flay, niente protezioni sovrascritte o fuori zona e niente danni che spezzano subito Gouge/Blind.
  - Dopo la correzione Gouge torna neutro e Hammer of Justice positivo (+3,1% obiettivi); Improved Eviscerate sale a +3,1%.
  - Nodi ancora quasi invisibili: Improved Power Word: Shield, Opportunity, Dirty Tricks e Improved Blizzard.
  - Aggiunto Spell Weaving: completare un Cast Lungo permette di giocare nella stessa azione il prossimo Instant da una carta; non concatena e non rende gratis carte già a costo zero.
  - Primo intervento di design applicato: Mind Flay 5 Shadow/−2 Command, Blind non si interrompe con danni periodici, Blessing of Sanctuary ha 3 cariche da −2 fisico; Holy Shield invariato.
  - Verifica successiva: 5.024 scontri, un solo stallo complessivo e due wipe. Spell Weaving viene usato ma non crea una build dominante.
  - Mind Flay e Blind aumentano il controllo ma restano penalizzati dal costo/opportunità delle carte; Sanctuary aumenta la prevenzione in Hardcore, senza ancora migliorare stabilmente gli obiettivi. Prossimo intervento da valutare: frequenza delle carte e timing AI, non altri aumenti numerici immediati.
- [x] Simulare con Overlord AI il percorso completo del dungeon, con HP e risorse persistenti, poi ripeterlo in sequenza Normal → Heroic → Hardcore fino allo scontro finale.
  - 3 composizioni × 3 semi: 23 attraversamenti effettivi; una sconfitta interrompe correttamente la sequenza successiva.
  - Nessuno stallo: Normal 100% completato, Heroic 55,6%, Hardcore 40% tra i gruppi che vi sono arrivati.
  - Due sequenze su nove hanno completato tutte e tre le difficoltà; Equilibrata e Controllo una ciascuna, Assalto nessuna.
  - Corretti tre blocchi emersi dal percorso reale: ritorno nelle stanze visitate, gestione di forzieri multipli e posizionamento in griglia dei Girini evocati da Grum’Arat.

## Prossimi passi — riequilibrio delle classi

Obiettivo finale: una compagnia ben costruita deve completare Hardcore nel 55–60% delle prove. Le specializzazioni della stessa classe devono raggiungere efficacia complessiva comparabile con identità differenti, come Assassination e Subtlety del Rogue.

- [x] Correggere l’uso automatico delle carte personali Hunter e ripetere il confronto isolato Deadeye/Wildsnare.
  - 384 scontri accoppiati: stessa compagnia, 8 scenari, 3 difficoltà e 8 semi; cambiano soltanto Deadeye e Wildsnare.
  - Deadeye: 27,22 danni medi, 4,14 per round, 0,06 controlli e 7,73 round di gruppo.
  - Wildsnare: 56,49 danni medi, 11,99 per round, 4,59 controlli e 4,60 round di gruppo.
  - La correzione consente all’IA di usare Stillness, Retreat Roll e Predator Storm. Il divario non dipendeva soltanto dall’IA: l’alta resa AOE di Wildsnare contro mob fragili è un problema reale da isolare sulle fasce di Vita.
- [ ] Ritarare gli obiettivi a tempo per la regola delle 2 Command distinte, soprattutto Rituale e Rinforzi.
- [ ] Misurare single target contro AOE su più fasce di Vita dei mob; provare l’aumento della Vita prima di potenziare le carte.
- [ ] Portare Deadeye e Wildsnare alla stessa efficacia complessiva: Deadeye forte sul singolo bersaglio, Wildsnare su AOE e controllo.
- [ ] Portare Fire e Frost alla stessa efficacia complessiva: Fire molto forte sul singolo bersaglio, senza imporlo come massimo DPS assoluto.
- [ ] Aumentare danno o ritmo di Demonology mantenendo distinta la sua identità difensiva rispetto ad Affliction.
- [ ] Verificare e, se necessario, potenziare Holy Paladin affinché possa sostenere da solo il gruppo fino alla fine di Hardcore.
- [ ] Isolare Stormclaw e confrontare Paladin Protection con Warrior Protection.
- [ ] Ripetere il percorso Normal → Heroic → Hardcore e validare il 55–60% di completamento Hardcore, poi confermare con playtest umano.
