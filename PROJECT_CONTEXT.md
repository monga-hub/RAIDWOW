# RAIDWOW — contesto di progetto

Leggere questo file prima di modificare il simulatore. È una memoria sintetica delle decisioni consolidate; il codice resta la fonte di verità per i dettagli implementativi.

## Stato del progetto

- Repository: `monga-hub/RAIDWOW`, branch `main`.
- Ultimo commit noto al momento della stesura: `3d977d3` (`feat: add enemy artwork`).
- Demo principale: `index.html`.
- Logica plance, combattimento, talenti, nemici, tesori e progressione: `player-board.js`.
- Esplorazione e Marble Bag: `exploration.js`.
- Composizione delle stanze tramite uscita + lato della tile: `connected-rooms.js`.
- `legacy.html`, `vnext.html` e `vnext.js` sono prototipi precedenti: non usarli come interfaccia principale e non sostituire `index.html` con essi.

## Direzione del gioco

Titolo/ambientazione: **Paludi della Luna Avvelenata**. Dark fantasy paludoso popolato da Ranidi; miniboss: **Grumara, Strega del Miasma**.

Il simulatore deve rimanere una singola interfaccia giocabile, desktop e mobile. Non creare una seconda UI per nuove regole: integrare sempre le modifiche nell'interfaccia esistente.

## Core combat

- Ogni Eroe ha 3 azioni per turno.
- Le azioni non equivalgono alle carte: un'azione può essere `Base Action + Technique + Modifier`.
- Massimo 1 Technique e 1 Modifier per azione.
- Equipment e relative Base Action sono sempre disponibili e non appartengono al deck.
- Cambiare Stance/Position costa 1 azione.
- Critical è un Modifier gratuito: +1 al valore principale (danno, cura o Block), senza aumentare Bleed, bersagli o quantità secondarie.
- Le Technique note devono risolversi direttamente sull'Equipment corretto quando vengono cliccate; non richiedere un secondo clic su arma/scudo.
- Il pulsante **Passa** deve rimanere disponibile anche in stati incompleti, risolvendo/annullando in modo sicuro eventuali scelte pendenti.
- Ordine a colonne rotanti: Warrior → Priest → Rogue → Overlord; il giocatore attivo è sempre la prima colonna.

## Warrior — Guardian

HP iniziali 12. Stance permanente `AGGRESSIVE / DEFENSIVE`.

Equipment iniziale:

- Sword: 1 danno base.
- Shield: 1 Block base.

Deck iniziale effettivo (10): Heroic Strike ×2, Rend ×2, Parry ×3, Taunt ×2, Critical ×1.

Carte:

- Heroic Strike: AGGRESSIVE, Sword +1; totale iniziale 2 danni. Con Critical: 3.
- Rend: utilizzabile in entrambe le stance, attacco Sword con 1 danno e 1 Bleed. Bleed riduce di 1 le Command pescate alla prossima attivazione; a 3 Bleed l'attivazione salta e i Bleed si azzerano.
- Parry: DEFENSIVE, Shield +1 Block. Critical può portare lo stack base a 3 Block.
- Taunt/Provocazione: utilizzabile in entrambe le stance.
- Shield Slam: DEFENSIVE, 3 danni e interrompe Cast Lunghi; il talento aggiunge 2 carte.
- Cleave: talento Protection, 2 danni a tutti; aggiunge 2 carte.
- Whirlwind: AGGRESSIVE, richiede arma a due mani, consuma 3 azioni e infligge il danno base dell'arma a tutti (Ascia del Turbine lo riduce a 2 azioni).

Talenti (pagina richiudibile):

- Defense: Parry Mastery 2 step → Parry passa da +1 a +2 Block; Shield Slam 1; Cleave 1.
- Aggressive: Heroic Strike Mastery 2 step → +2; Improved Rend 1 → +1 danno; Whirlwind 1.
- Improved Critical 1, accessibile da entrambi: aggiunge 1 Critical al deck.
- Non esistono più Counterattack e Two-Handed Specialization.

## Priest — Healer

HP iniziali 8. Position permanente `FAR / NEAR`, parte FAR.

Equipment iniziale:

- Staff: +1 alle cure; non aumenta Holy Pulse.
- Wand: FAR, 1 danno base.

Deck iniziale effettivo (10): Quick Heal ×2, Slow Heal ×3, Bandage ×2, Holy Pulse ×2, Critical ×1.

Carte:

- Quick Heal: NEAR (diventa anche FAR con Divine Reach); valore della carta ridotto di 1 rispetto al vecchio valore, poi riceve il bonus Staff.
- Slow Heal: FAR, cura grande/cast lungo; valore della carta ridotto di 1, poi riceve il bonus Staff.
- Bandage: NEAR.
- Holy Pulse: 1 danno a tutti i nemici; non usa il bonus cure della Staff. Critical lo porta a 2.
- Colpo Divino: NEAR, Cast Lungo con 2 carte, 2 danni; il talento aggiunge 2 carte.
- Holy Shield: target alleato, −2 danni; la carta resta davanti al bersaglio fino alla fine del turno Overlord; il talento aggiunge 2 carte.
- Holy Fire: FAR, DoT cumulativo; a 3 stack esplode per 5 danni.

Talenti Heal/Damage (pagina richiudibile):

- Heal: Improved Healing 2 step, totale +2 alle cure → Holy Shield → Divine Reach.
- Damage: Holy Fire → Colpo Divino → Improved Spell Damage 2 step, totale +2 allo spell damage.
- Improved Critical 1, comune: aggiunge 1 Critical al deck.

## Rogue — Assassin

HP iniziali 9. Position permanente `FRONT / BEHIND`.

Equipment iniziale: due Dagger, uno per slot, entrambi da 1 danno.

Deck iniziale effettivo (10): Backstab ×3, Eviscerate ×3, Evasion ×1, Kick ×1, Preparation ×1, Critical ×1.

Carte:

- Backstab: BEHIND, modifica un Dagger; totale base 3 danni.
- Eviscerate: FRONT, Dagger +1; +2 se il bersaglio è sotto il 50% HP (totale iniziale 2/3).
- Evasion: annulla il prossimo Attack o AOE.
- Kick: 1 danno e interrompe un Cast Lungo.
- Preparation: pesca 2, poi scarta 2 Ability; non scarta Wound e non deve bloccare il turno.
- Critical modifica l'attacco senza azione aggiuntiva.

Talenti Assassination/Subtlety (pagina richiudibile):

- Assassination: Mutilate 1 (aggiunge 2 carte, FRONT, danno Main + Offhand +1) → Vile Poison 1 (aggiunge 2 carte, DoT cumulativo da 1, rimosso da cura o morte) → Improved Mutilate 2 step, totale +2.
- Subtlety: Improved Backstab 2 step, totale +2 → Evasion Tricky 1 (dopo Evasion, flip gratuito) → Garrote 1 (aggiunge 4 carte, DoT cumulativo da 2).
- Improved Critical 1, comune: aggiunge 1 Critical al deck.

## Ricompense, talenti e progressione

- A fine combattimento e per ogni livello ottenuto si riceve una scelta relativa a una carta: aggiungerla al deck, spenderla in un talento compatibile oppure metterla in Riserva.
- Affinità Warrior: scudo = Defense, spada = Aggressive, entrambe = spendibile su entrambi.
- Affinità Priest: Heal o Damage. Rogue: Assassination o Subtlety.
- Due carte in Riserva dell'affinità opposta possono pagare 1 step di un talento dell'altro ramo.
- XP: ogni nemico abbattuto assegna 3 XP a ogni Eroe vivo.
- Soglie per salire di livello: 9, 11, 13, 15, 17 XP; dopo il livello il contatore torna a 0.
- Ogni livello aumenta HP massimi e correnti di 2 e genera una ricompensa a fine combattimento.

## Nemici e Command Deck

Command Deck comune: Attack ×3, Tactic ×2, Special ×1.

- Razziatore Ranide: 16 HP; Attack 3; Tactic 2 + Wound; Special Colpo Spazzante, 2 danni a massimo 2 Eroi NEAR.
- Artificiere Ranide: 18 HP; Attack 2; Tactic cura 2 a un nemico ferito; Special Mega Bomba, Cast Lungo da 2 Special, 5 AOE WIDE, interrompibile.
- Rana Warchief: 20 HP; Attack 4; Tactic ordina a un altro Ranide di attaccare; Special è un attacco critico da 5.
- Grumara, Strega del Miasma: 40 HP; Attack 6; Tactic 3 + Wound; Mega Bomba 5 WIDE, Cast Lungo interrompibile. A 25 e 10 HP evoca 3 Girini Putrescenti.
- Girino Putrescente: 4 HP; attacco fisso 1; non pesca Command e agisce dal turno Overlord successivo all'evocazione.
- La partita termina solo quando Grumara e tutti gli altri nemici della stanza sono eliminati.

Fighter Bag (12): Razziatore ×4, Artificiere ×4, Warchief ×4.

Artwork:

- `assets/rana-razziatrice.jpeg`
- `assets/rana-warchief.jpeg`
- `assets/rana-ingegnere.jpeg`
- `assets/grumara-miniboss.jpeg`

## Dungeon ed esplorazione

- Campagna ordinaria fino a 10 stanze.
- Se il miniboss appare prima, la campagna continua finché la sua intera stanza è completata.
- Se dopo 10 stanze non è apparso, la stanza 11 forza il Trono di Grumara.
- Le stanze non hanno contenuto intrinseco: il contenuto nasce sommando le icone dell'uscita scelta dagli Eroi e quelle del lato della tile collegato dall'Overlord.
- Una tile non ha entrata/uscita fissa: il lato collegato diventa l'ingresso e gli altri lati rimangono uscite.
- Mappa e Marble Bag devono essere compatte; su mobile i target dei nemici devono restare vicini al giocatore attivo/sticky durante lo scorrimento.
- Marble Bag UI e pagine Talenti sono richiudibili.

Bag:

- Treasure Bag ordinaria: Bronze ×6, Silver ×3. La Gold non è nel bag: è ricompensa garantita di Grumara.
- Threat Bag: Safe ×2, Ambush ×2, Enrage ×2; Enrage è persistente.
- Una cassa rivela 3 carte al momento dell'apertura, non durante il setup della stanza.

## Inventario, tesori e recupero

- Ogni Eroe ha 6 slot bag.
- Inizio partita: 5 mele impilate in un solo slot; ogni mela cura 2 HP e costa 1 azione.
- Ogni oggetto nella bag ha un'icona cestino.
- L'Equipment sostituito torna nella bag, non viene eliminato.
- Tra le stanze c'è un Turno di Recupero: 3 azioni per Eroe per curarsi, usare oggetti, cambiare Stance/Position ed equipaggiarsi. Nessun recupero automatico precedente deve sommarsi a questa fase.

Gold Equipment garantito da Grumara:

- Warrior: Spada del Comandante; Scudo Spezzamagie; Ascia del Turbine.
- Priest: Staffa della Misericordia; Bacchetta del Giudizio; Staffa del Dolore.
- Rogue: Pugnale Velenoso; Pugnale dell'Ombra.

I valori e i poteri completi sono definiti in `TREASURE_ITEMS` dentro `player-board.js`.

## Regole operative per le prossime chat

1. Aprire e modificare la demo principale, non i prototipi legacy/vNext.
2. Preservare i comportamenti già concordati; niente redesign generale se viene chiesta una modifica locale.
3. Verificare l'interazione manuale interessata e gli smoke test pertinenti prima del commit.
4. Non implementare o cambiare tuning non richiesto silenziosamente.
5. Dopo ogni modifica indicare file toccati, comportamento verificato e commit GitHub.
