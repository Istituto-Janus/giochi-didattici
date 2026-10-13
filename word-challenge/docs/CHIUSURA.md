# JWC-CLOSE-001 — verifiche conclusive

Data: 13 ottobre 2026. Applicazione: Janus Word Challenge.

| Elemento | Esito |
|---|---|
| Pubblicazione e collaudo funzionale in produzione | PASS, comunicati dalla Direzione |
| URL produzione | https://janus-word-challenge.pages.dev |
| Versione applicativa | `025aa4b68687c4adef544cc3e793c721cb9505be` |
| Sicurezza API | PASS: nove richieste con chiave assente, malformata o estranea respinte con HTTP 403 |
| Accesso pubblico ai dati privilegiati | PASS: ruoli pubblici privi di autorizzazione a tabelle e RPC privilegiate |
| Persistenza e classifica condivisa | PASS: risultati nel database, punteggio ricalcolato coerente, risposte pubbliche stabili tra richieste indipendenti |
| Integrità backend | PASS: quattro file del servizio attivo identici ai corrispondenti file del repository |
| Scansione repository e archivio frontend | PASS: nessuna credenziale riservata rilevata; JWT presenti di ruolo pubblico anon |
| Integrità frontend in produzione | IN VERIFICA: confronto degli asset necessario prima della proposta di chiusura |
| Documentazione | Aggiornata: architettura, chiave, funzioni, manutenzione, ripristino e limiti |

Le prove API con operazioni amministrative sono richieste destinate al rifiuto, su un gioco sintetico preesistente. Non sono stati creati, modificati o cancellati giochi e risultati. Nessun nuovo deploy, modifica grafica, modifica al meccanismo di gioco o migrazione è stato eseguito.

I precedenti test locali, multilingua e desktop/mobile restano validi per la versione applicativa invariata; non è stata ripetuta l'intera suite. Le evidenze tecniche interne e quelle contenenti dati dei giocatori sono conservate separatamente dal repository pubblico.

Le limitazioni migliorative sono documentate nel README e nel manuale: identità non verificata, conservazione dopo eliminazione logica, chiusura delle sessioni scadute alla richiesta successiva e copertura lessicale non esaustiva. Il completamento del confronto frontend in produzione è necessario per formulare la proposta di chiusura direzionale.
