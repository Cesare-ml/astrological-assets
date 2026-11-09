# Astrological Assets

**Archivio privato dedicato alle risorse grafiche astrologiche condivise** tra [Astrological Charts](https://github.com/Cesare-ml/astrological-charts), il frontend VirgoStars e l'Astrolabio offline.

> **Stato iniziale:** repository privato, **nessun asset originale ancora importato né approvato**. La sorgente attiva resta `Cesare-ml/virgo-stars/public/assets/`. Nessuna modifica alla produzione e nessun deploy automatico.

## Scopo

Chi collabora ai grafici può ottenere **codice e immagini senza accedere al repository privato `virgo-stars`**, una volta che gli asset condivisibili saranno stati trasferiti qui con i diritti verificati.

La libreria Angular/Three.js non conterrà immagini duplicate. Questo repository manterrà invece l'albero canonico `public/assets/img/...` e, se indispensabile, `public/assets/fonts/...`.

## Regole di sicurezza

- Soltanto asset astrologici pertinenti, approvati e con provenienza e diritti registrati; niente backend, temi di utenti, token, password, contenuti personali o archivio generale del sito.
- Non modificare i nomi, la capitalizzazione, le estensioni o la struttura delle cartelle senza una migrazione testata dei consumer.
- Il passaggio da `virgo-stars/public/assets/` a questo repository **non è ancora avvenuto**; prima fare un audit e testare sito e Astrolabio.
- Nessuna GitHub Action, pubblicazione npm, CDN, aggiornamento hardware o deploy automatico.
- Collaborazione tramite branch e PR. Nessuna licenza open source concessa al momento; i diritti di ciascun asset devono essere documentati.

## Documentazione

L'implementazione di importazione e verifica sarà proposta tramite pull request prima di aggiungere i file reali.

- `docs/ASSET_SCOPE.md` — raccolte da condividere e cosa escludere
- `docs/MIGRATION_PLAN.md` — passaggio sicuro a una sola copia nella build del sito
- `docs/RIGHTS_AND_REVIEW.md` — licenze e procedura di approvazione
- `scripts/` — import selettivo dal checkout locale e verifica checksum

## Compatibilità

**Percorso atteso dall'applicazione host:** `/assets/img/simboli-bianchi/segni/01.png`.

**Percorso corrispondente in questo repository:** `public/assets/img/simboli-bianchi/segni/01.png`.

Il solo codice del renderer sta in `astrological-charts`: questo repository conterrà esclusivamente asset e strumenti per conservarli/versionarli.

## Accesso dei collaboratori

Invitare a questo repository soltanto chi deve utilizzare gli asset effettivi. Chi contribuisce esclusivamente agli algoritmi grafici può usare fixture sintetiche e non necessita dell'archivio originale.
