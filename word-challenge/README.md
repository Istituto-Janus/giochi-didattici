# Janus Word Challenge

Applicazione didattica nelle cinque lingue IT, EN, ES, FR, DE. Frontend statico Cloudflare Pages, API Supabase Edge Function e database del progetto **Giochi Janus** (`tageubqfxkshigrriiyw`). Nessuna modifica ai giochi esistenti.

## Struttura

- `public/`: unico contenuto da pubblicare su Pages. Non pubblicare la cartella superiore, che contiene dizionari, codice server e documentazione tecnica.
- `edge.js`: API con validazione lessicale, capability docente/sessione e chiamata RPC con chiave service disponibile esclusivamente nel runtime Supabase.
- `schema.sql`: installazione completa su uno schema JWC nuovo; **non rieseguire** su un'installazione esistente. Le migrazioni applicate sono registrate in Supabase.
- `lexicons/`: lessici finiti e catalogo automatico. `sources/` conserva fonti Hunspell, copyright e licenze.
- `scripts/`: espansione affissi (massimo tre passaggi) e verifica libhunspell, poi catalogo automatico. Richiede Python 3, libhunspell 1.7 e Node 24; nessuna dipendenza npm runtime.
- `tests/`: validazione Unicode, ripetizioni, punteggi, lessici, forme flesse, cataloghi e protezione payload.

## Accesso e sicurezza effettiva

L'area docente è pubblica, senza account. Un token casuale di 256 bit viene creato dal server e conservato in localStorage; il database conserva solo SHA-256. Archivio e registro sono accessibili soltanto al possessore di quel token, per i propri giochi. La chiave può essere copiata/ripristinata: non identifica il docente e non sostituisce un'autenticazione istituzionale. La perdita della chiave richiede intervento amministrativo; non esiste recupero pubblico. Non condividere mai chiavi di gestione o sessione nei link.

Gli studenti sono identificati dal nickname, normalizzato NFC e senza distinzione maiuscole/minuscole. Il blocco dei tentativi è per nickname, non per persona; sono possibili impersonazioni. La classifica mantiene il miglior risultato concluso per nickname e mostra i primi 100. I pareggi sono ordinati per nickname. Il registro conserva tutti i tentativi conclusi ed è paginato a 100 righe.

Le tabelle sono nello schema non esposto `jwc_private`, con RLS attiva e senza policy pubbliche. `public.jwc_dispatch` è SECURITY INVOKER ed eseguibile soltanto da service_role. La funzione Edge richiede il JWT anon pubblico già usato da Janus; questa chiave NON autentica il docente. Capability e validazione dell'operazione sono eseguite nel corpo dell'API. La chiave service non è nel repository, nei file pubblici o in Cloudflare.

Ogni parola viene confrontata con il set di soluzioni del gioco. Score, duplicati, timer e chiusura sono calcolati nel database con lock di sessione. Il punteggio inviato dallo studente è rifiutato. Nessuna soluzione viene inviata nelle operazioni pubbliche `game`, `start`, `state` o `word`. L'operazione `solutions` richiede una sessione conclusa. Le anteprime docente sono libere: un utente determinato può ricostruire le soluzioni dalle lettere; non è un sistema anti-cheating assoluto.

Rate limit persistente: 30 richieste/minuto per IP e operazione create/delete/rename/start, 180 per le altre; limite globale 100 create e 3000 per altra operazione/minuto. Il contatore IP usa 4096 slot hash per operazione, con possibili collisioni conservative. L'IP è fornito dagli header del gateway; limiti globali e capability restano necessari anche in presenza di header falsificati. Massimo 200 giochi attivi per chiave. Nessun cambio di piano o servizio a pagamento.

L'eliminazione è **logica**: disattiva link, gestione e accesso ai risultati; i record restano in Supabase fino alla cancellazione amministrativa. Non è presente un job di cancellazione fisica. Il timer è server-side: una sessione scaduta viene conclusa alla prima richiesta successiva. Una partita abbandonata senza più richieste non compare in classifica finché non viene richiamata/chiusa. Le sessioni senza timer scadono dopo 24 ore. I punti accettati sono già salvati e la ricarica può riprendere la sessione nello stesso browser.

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

## Riproduzione

```sh
python scripts/build-lexicons.py
node scripts/build-catalogue.mjs
npm test
```

Il frontend si pubblica senza build. Da una macchina con accesso Cloudflare autorizzato, usare Wrangler già configurato per l'account Istituto Janus:

```sh
wrangler pages project create janus-word-challenge --production-branch main
wrangler pages deploy public --project-name janus-word-challenge --branch main
```

Il comando create si esegue soltanto se il progetto non esiste. Non distribuire nella Pages dei giochi precedenti. La funzione Supabase `janus-word-challenge` è distribuita separatamente, includendo `edge.js`, `core.js`, `lexicons/words.js` e `lexicons/catalogue.js`, con `verify_jwt=true`. Usa i secret builtin Supabase, senza generare nuove API key. La chiave anon in `public/config.js` è intenzionalmente pubblica.

Il manuale utente, localizzato, è `public/manuale.html`. Il report finale indica i controlli effettivamente completati e l'eventuale blocco di deploy.
