# Astrological Assets

Archivio **privato** di risorse condivisibili per [Astrological Charts](https://github.com/Cesare-ml/astrological-charts), VirgoStars e l'Astrolabio offline.

**Stato:** repository e strumenti di importazione inizializzati; **nessun file immagine o font reale è stato ancora trasferito**. La produzione continua a utilizzare `Cesare-ml/virgo-stars/public/assets`.

## Inventario e diritti

- `catalog/upstream-candidates.json` contiene i metadati di **1.078 file candidati, circa 80.30 MiB** complessivi, recuperati dal repository originale al commit `9900c36acc309bc2a6e87009f554b2e4141e4864`: percorsi, dimensione e hash Git; **non sono file binari né un'autorizzazione a distribuirli**.
- `catalog/approvals.json` è inizialmente **vuoto**: nessun elemento è implicitamente approvato.
- Le istruzioni in [diritti e revisione](docs/RIGHTS_AND_REVIEW.md) indicano come autorizzare un asset in modo esplicito.

## Import selettivo dal PC del proprietario

Servono Node.js 20+ e un checkout autorizzato di `Cesare-ml/virgo-stars`, nella cartella adiacente a questo repository.

1. Scegliere gli asset effettivamente utilizzati e documentarne i diritti in `catalog/approvals.json`.
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
- [Migrazione verso una sola copia di build](docs/MIGRATION_PLAN.md)
- [AGENTS.md](AGENTS.md) — regole per agenti e sviluppatori
- [CONTRIBUTING.md](CONTRIBUTING.md) — contributi

Il progetto non ha una licenza open source, non esegue GitHub Actions e **non** apporta modifiche al sito in produzione o agli Astrolabi.
