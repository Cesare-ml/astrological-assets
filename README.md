# Astrological Assets

Archivio **privato** di risorse condivisibili per [Astrological Charts](https://github.com/Cesare-ml/astrological-charts), VirgoStars e l'Astrolabio offline.

**Stato:** repository e strumenti di importazione inizializzati; **nessun file immagine o font reale è stato ancora trasferito**. La produzione continua a utilizzare `Cesare-ml/virgo-stars/public/assets`.

## Inventario e diritti

- `catalog/upstream-candidates.json` contiene i metadati di **1.078 file candidati, circa 80.30 MiB** complessivi, recuperati dal repository originale al commit `9900c36acc309bc2a6e87009f554b2e4141e4864`: percorsi, dimensione e hash Git; **non sono file binari né un'autorizzazione a distribuirli**.
- `catalog/approvals.json` è inizialmente **vuoto**: nessun elemento è implicitamente approvato.
- Le istruzioni in [diritti e revisione](docs/RIGHTS_AND_REVIEW.md) indicano come autorizzare un asset in modo esplicito.

## Import selettivo dal PC del proprietario

Servono Node.js 20+ e un checkout autorizzato di `Cesare-ml/virgo-stars`, nella cartella adiacente a questo repository.

1. Selezionare una famiglia di asset e creare una scheda di revisione **ancora tutta in stato `pending`**:

```powershell
node scripts/prepare-review.mjs `
  --family img/simboli-bianchi/segni/ `
  --out ./segni-review.local.json
```

Dopo aver verificato personalmente i diritti, approvare i singoli file o la famiglia con prove pertinenti; trasferire le righe approvate in `catalog/approvals.json`. Il generatore non approva nulla da solo.
2. Eseguire prima una **simulazione** (non copia nulla):

```powershell
node scripts/import-approved-assets.mjs `
  --source ../virgo-stars/public/assets `
  --target ./public/assets `
  --approvals ./catalog/approvals.json
```

3. Solo dopo aver verificato i permessi e il piano di import, eseguire:

```powershell
node scripts/import-approved-assets.mjs `
  --source ../virgo-stars/public/assets `
  --target ./public/assets `
  --approvals ./catalog/approvals.json `
  --apply `
  --manifest ./manifests/approved-assets.json
```

4. Verificare gli hash dell'archivio appena creato:

```powershell
node scripts/verify-pack.mjs `
  --root ./public/assets `
  --manifest ./manifests/approved-assets.json

npm test
```

**Nessuno script invia dati o file a GitHub, AWS o al sito.** Prima di committare i binari approvati, esaminare `git status`, il manifest e la relativa licenza.

## Collaboratori senza accesso a VirgoStars

Una volta che gli asset autorizzati saranno presenti nel repository e i collaboratori saranno invitati, potranno clonare solo **`astrological-charts` e `astrological-assets`**. Il server locale di `astrological-charts` può usare questa cartella:

```powershell
node scripts/serve-local-assets.mjs --root ../astrological-assets/public/assets
```

Così i simboli vengono serviti in sviluppo da `http://127.0.0.1:4177/assets/img/...`, senza accesso al backend, ai temi degli utenti o alle credenziali VirgoStars. Il renderer non include copie delle immagini.

## Indice

- [Ambito del catalogo e inventario](docs/ASSET_SCOPE.md)
- [Diritti e approvazione](docs/RIGHTS_AND_REVIEW.md)
- [Coordinamento dei tre repository e gate di rilascio](docs/ECOSYSTEM_COORDINATION.md)
- [Migrazione verso una sola copia di build](docs/MIGRATION_PLAN.md)
- [AGENTS.md](AGENTS.md) — regole per agenti e sviluppatori
- [CONTRIBUTING.md](CONTRIBUTING.md) — contributi

Il progetto non ha una licenza open source, non esegue GitHub Actions e **non** apporta modifiche al sito in produzione o agli Astrolabi.

### Nota sui permessi GitHub

Il repository appartiene a un **account personale** (`Cesare-ml`): secondo la [documentazione ufficiale GitHub](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/repository-access-and-collaboration/permission-levels-for-a-personal-account-repository), nei repository privati gli invitati possono avere accesso di scrittura, non un ruolo read-only garantito. Prima di condividere asset riservati, verificare i permessi effettivi. Se è necessario un ruolo di sola lettura affidabile, valutare un'organizzazione GitHub con ruoli granulari oppure una distribuzione selettiva.

## Aggiornare il catalogo dal monorepo locale

Se cambia il commit di `virgo-stars`, è possibile rigenerare il catalogo senza copiare immagini e senza usare Actions:

```powershell
node scripts/refresh-source-catalog.mjs --repo ../virgo-stars
node scripts/refresh-source-catalog.mjs `
  --repo ../virgo-stars --out ./catalog/upstream-candidates.json --write
npm run audit:catalog
```

Le approvazioni pregresse vanno riesaminate se cambia l'hash Git di un file. L'inventario generato contiene soltanto metadati.

## Preflight obbligatorio contro gli asset duplicati

Quando il primo pacchetto approvato sarà realmente disponibile, questo comando **non modifica né copia nulla**; segnala se gli stessi path verranno importati sia dal vecchio `virgo-stars/public` sia dal repository asset:

```powershell
node scripts/check-web-asset-collisions.mjs `
  --legacy ../virgo-stars/public/assets `
  --pack ./public/assets `
  --manifest ./manifests/approved-assets.json `
  --out ./collision-report.local.json
```

Codici: `0` = disgiunto; `3` = copie identiche ancora presenti nel sorgente legacy, da **escludere** dalla futura build; `2` = file divergenti, mancanti o alterati, migrazione bloccata. Non interpretare un confronto superato come prova che Angular copi correttamente i file: prima di un deploy serve anche verificare l'output della build.

La [scheda di revisione iniziale dei 78 simboli](catalog/reviews/simboli-bianchi.pending.json) contiene **solo voci pending**, senza alcuna autorizzazione implicita. Il manifest degli asset approvati non è ancora stato creato.

## Verifica locale rapida su Windows

Senza importare o modificare nulla, puoi eseguire test Node, audit del catalogo e — quando esiste un manifest autorizzato — verificare gli hash:

```powershell
powershell -NoProfile -File .\scripts\preflight-local.ps1
```

Per aggiungere il controllo delle doppie copie rispetto al tuo checkout locale di VirgoStars:

```powershell
powershell -NoProfile -File .\scripts\preflight-local.ps1 `
  -VirgoStarsAssets ..\virgo-stars\public\assets
```

Il preflight non carica file su GitHub, non approva immagini e non modifica il sito. Prima dell'importazione vera il manifest approvato non esiste e questa parte del test viene correttamente saltata.
