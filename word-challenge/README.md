# Janus Word Challenge

Applicazione didattica Janus per comporre parole con sei lettere nelle lingue italiano, inglese, spagnolo, francese e tedesco.

- Produzione: https://janus-word-challenge.pages.dev
- Manuale utente: https://janus-word-challenge.pages.dev/manuale.html
- Repository: https://github.com/Istituto-Janus/giochi-didattici
- Branch: `jwc-word-challenge`
- Versione applicativa approvata: `025aa4b68687c4adef544cc3e793c721cb9505be`; frontend e backend sono identici alla versione originale `15a4ba5381ba094dc9fd0063fe2fb90ba847fb1b`.
- Il commit dell'aggiornamento documentale è consultabile nella cronologia del branch. Non implica un nuovo deploy.

La Direzione ha confermato il 13 ottobre 2026 la pubblicazione manuale su Cloudflare Pages e il collaudo funzionale positivo. Le verifiche finali sono descritte in [docs/CHIUSURA.md](docs/CHIUSURA.md).

## Architettura

Il frontend statico su Cloudflare Pages invia richieste alla funzione server in Supabase. Il database conserva giochi, sessioni e risultati. Il server valida le parole contro lessici Hunspell versionati, aggiorna il punteggio e applica le scadenze. La classifica è condivisa per gioco e conserva il miglior risultato concluso per nickname.

La chiave pubblica Supabase nel frontend è intenzionale e non abilita operazioni amministrative. Le credenziali riservate rimangono nel runtime server. Le operazioni docente richiedono una chiave di gestione e sono limitate ai giochi appartenenti alla stessa chiave; l'accesso diretto alle tabelle e alle funzioni privilegiate è negato ai ruoli pubblici. Questo accesso libero non verifica l'identità istituzionale del docente.

## File

- `public/`: asset del sito e manuale nelle cinque lingue.
- `edge.js`, `core.js`: backend e regole di validazione.
- `schema.sql`: riferimento di installazione su uno schema nuovo; non rieseguirlo su un'installazione esistente.
- `lexicons/`: lessici, cataloghi, manifest degli hash, input originali e licenze.
- `scripts/`: generazione verificata dei lessici e dei cataloghi.
- `tests/`: controlli automatici e script del precedente collaudo.
- `deploy/frontend.zip`: pacchetto statico della versione approvata; soltanto gli asset pubblici.

## Docenti e studenti

Il docente sceglie la lingua, inserisce o genera le sei lettere, imposta titolo, obiettivo indicativo, timer e nuovi tentativi, controlla l'anteprima e pubblica un gioco alla volta. Il suo archivio offre apertura/copia link, modifica titolo, eliminazione logica e registro dei risultati.

Lo studente inserisce un nickname, compone parole da 3 a 6 lettere, riceve la verifica immediata e accumula 10, 20, 30 o 50 punti. Ogni lettera si usa solo quante volte compare. Le parole trovate sono raggruppate per lunghezza. La classifica appare prima e dopo la partita; le soluzioni sono disponibili nella schermata finale.

## Chiave di gestione

Ogni browser riceve automaticamente una chiave casuale, senza account. Copiarla dalla sezione “Chiave di gestione” e conservarla privatamente. “Ripristina chiave” permette di riaprire il proprio archivio da un altro browser. Cancellare i dati del browser senza una copia della chiave comporta perdita dell'accesso gestionale. Chi possiede la chiave ha gli stessi diritti; non inserirla nei link condivisi. La perdita senza backup richiede intervento amministrativo interno.

## Pubblicazione e aggiornamenti

La versione in produzione è stata caricata manualmente dalla console Cloudflare. Non occorrono build o nuove credenziali per il frontend.

1. Dopo l'autorizzazione a un aggiornamento, utilizzare soltanto la cartella `public/` della versione approvata o il corrispondente ZIP.
2. Nel progetto Pages esistente selezionare **Create a new deployment**, quindi l'ambiente produzione; caricare gli asset e confermare **Save and Deploy**.
3. Verificare URL ufficiale, hash degli asset, apertura di un gioco, classifica e richieste API non autorizzate.
4. Conservare commit, pacchetto e riferimento della distribuzione per un eventuale ripristino.

Non creare un nuovo progetto per aggiornare quello esistente. Non caricare l'intero repository, dizionari o codice server come asset del sito. Gli aggiornamenti del backend seguono la procedura tecnica interna e richiedono autorizzazione separata al deploy.

Documentazione Cloudflare: https://developers.cloudflare.com/pages/get-started/direct-upload/

## Manutenzione e ripristino

Conservare backup privati dei dati e delle chiavi di gestione. Un backup del repository o del frontend non comprende i giochi e i risultati nel database. Prima di un ripristino verificare compatibilità del frontend, backend e versione lessicale; evitare di rieseguire lo schema su dati esistenti. Per ripristinare il frontend, dopo autorizzazione, distribuire il pacchetto dell'ultimo commit approvato e verificare l'URL. Per backend e dati usare la procedura interna del servizio, mantenendo i risultati reali.

La documentazione tecnica interna, le credenziali, i backup dei dati e le evidenze che contengono dati dei giocatori non devono essere inseriti in questo repository pubblico.

## Limiti effettivi

- Nickname senza autenticazione: possibili impersonazioni; divieto di nuovi tentativi per nickname, non per persona.
- Le anteprime docente sono libere: non è un sistema che impedisce ogni aiuto esterno allo studente.
- Eliminazione logica: il gioco e i risultati diventano inaccessibili dall'app, ma i record restano fino alla rimozione amministrativa.
- Una sessione scaduta è conclusa alla prima richiesta successiva; una partita abbandonata senza più richieste non entra in classifica finché non viene chiusa. Senza timer il limite tecnico è 24 ore.
- Archivio limitato, classifica primi 100 e registro paginato; limiti di richieste possono richiedere un'attesa in caso di uso intenso.
- Lessici non esaustivi per tutte le derivazioni e non filtrati semanticamente per la scuola: verificare l'anteprima.

## Dizionari e licenze

Import da [wooorm/dictionaries](https://github.com/wooorm/dictionaries), fonti e licenze conservate integralmente in `lexicons/sources/`. Hash SHA-256 di input/output in `lexicons/manifest.json`. Non usare AI per espansione o validazione.

| Lingua | Fonte | Licenza del lessico | Forme 3–6 |
|---|---|---|---:|
| Italiano | PLIO / Italian Writing Aids 4.2 | GPL-3.0 | 25.936 |
| English | SCOWL / Aspell | copyright e licenze permissive originali, inclusi BSD | 16.995 |
| Español | RLA-ES 2.8 | GPL-3.0-or-later scelta tra GPL/LGPL/MPL | 38.010 |
| Français | Grammalecte classique 7.5 | MPL-2.0 | 30.002 |
| Deutsch | igerman98 20161207 | GPL-3.0 scelta tra GPL-2.0/GPL-3.0 | 15.677 |

Il codice applicativo originale è distribuito GPL-3.0. I file dei lessici mantengono le licenze specifiche. I lessici non sono esaustivi né filtrati semanticamente per uso scolastico: forme rare, abbreviazioni e nomi propri tedeschi possono essere presenti. Fuori dal tedesco si escludono radici inizialmente maiuscole; per il tedesco si conserva la corretta capitalizzazione nel controllo Hunspell prima della normalizzazione. Alcune derivazioni complesse oltre tre passaggi/composti produttivi non sono enumerate. La preview docente è necessaria per adeguatezza didattica. Tutte le soluzioni di un gioco restano congelate alla pubblicazione, insieme alla versione lessicale.

Accenti non rimossi. NFC applicato; `é ≠ e`, `ñ ≠ n`, `ß ≠ ss`, umlaut distinti. Lunghezza Unicode in lettere. Maiuscole equivalenti; `ß` visualizzata `ẞ`. Sono escluse grafie con spazi, apostrofi e trattini. Il catalogo automatico conserva 600 combinazioni per lingua con almeno cinque soluzioni; la richiesta automatica è rifiutata se nessuna combinazione raggiunge l'obiettivo. L'obiettivo non tronca il set delle parole ammesse.

## Verifiche e riproduzione

I collaudi precedenti comprendono nove test automatici, API reali nelle cinque lingue e interfacce desktop/mobile. Il collaudo conclusivo usa controlli non distruttivi senza modificare giochi e risultati reali. Non eseguire lo script `tests/live-api.py` come semplice controllo su produzione: lo script del collaudo iniziale crea dati sintetici ed esegue eliminazioni logiche.

Per rigenerare i lessici in un ambiente di sviluppo (Python 3, libhunspell 1.7, Node 24):

```sh
python scripts/build-lexicons.py
node scripts/build-catalogue.mjs
npm test
```

La rigenerazione non aggiorna da sola la versione pubblicata. Ogni modifica applicativa e ogni nuovo deploy richiedono approvazione.
