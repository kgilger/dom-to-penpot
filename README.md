# DOM to Penpot

Outil pour extraire le DOM d'une page web (styles, positions, texte) et l'importer dans [Penpot](https://penpot.app) comme objets de design.

## Prérequis

- **Node.js** ≥ 18 (LTS recommandé)
- **Microsoft Edge** installé (Playwright utilise `channel: "msedge"` pour éviter de télécharger Chromium — utile derrière un proxy)
- **Penpot** accessible (instance cloud ou self-hosted)

### Installer Node.js sans droits admin (version portable)

Si Node.js n'est pas installé et que l'installation est bloquée sur le réseau pro :

1. Depuis un PC avec accès internet, télécharger le **zip Windows** (pas le .msi) :
   https://nodejs.org/en/download → **Windows Binary (.zip)** 64-bit
2. Copier le zip sur le PC cible (clé USB, partage réseau…)
3. Décompresser dans un dossier, par exemple `C:\Tools\node`
4. Ajouter ce dossier au `PATH` de la session PowerShell :

```powershell
$env:PATH = "C:\Tools\node;$env:PATH"
node --version   # doit afficher v18+ ou v20+
npm --version
```

> **Astuce** : pour rendre ça permanent sans droits admin, ajouter la ligne dans votre profil PowerShell :
>
> ```powershell
> # Ouvre (ou crée) le fichier profil dans le bloc-notes
> if (!(Test-Path $PROFILE)) { New-Item $PROFILE -Force }
> notepad $PROFILE
> ```
>
> Puis ajouter cette ligne dans le fichier et sauvegarder :
>
> ```powershell
> $env:PATH = "C:\Tools\node;$env:PATH"
> ```
>
> La prochaine fois que PowerShell s'ouvre, Node sera dans le PATH automatiquement.

## Installation

```bash
git clone <url-du-repo>
cd dom-to-penpot
npm install
```

> **Note proxy** : si `npx playwright install chromium` échoue à cause d'un proxy, ce n'est pas grave — le projet utilise Edge système directement.

## Structure du projet

```
dom-to-penpot/
├── package.json
├── tsconfig.json
├── extraction.json              ← Fichier JSON généré par l'extracteur
└── src/
    ├── shared/
    │   └── types.ts             ← Types du format JSON intermédiaire
    ├── extractor/
    │   ├── extract.ts           ← Script Playwright (pilote Edge)
    │   └── browser-extract.js   ← Code JS injecté dans le navigateur (bypass CSP)
    ├── plugin/
    │   ├── manifest.json        ← Manifest du plugin Penpot
    │   ├── icon.svg             ← Icône du plugin
    │   ├── index.html           ← UI du plugin (panneau dans Penpot)
    │   └── main.js              ← Logique de conversion JSON → shapes Penpot
    └── server/
        └── index.ts             ← Serveur Express (port 4400)
```

## Utilisation

### 1. Extraire le DOM d'une page web

```bash
npm run extract -- --url <URL>
```

Options :

| Option        | Défaut             | Description                            |
|---------------|--------------------|----------------------------------------|
| `--url`       | *(obligatoire)*    | URL de la page à extraire              |
| `--output`    | `extraction.json`  | Nom du fichier JSON de sortie          |
| `--viewport`  | `1920x1080`        | Dimensions du viewport (largeur×hauteur) |
| `--selector`  | `body`             | Sélecteur CSS du nœud racine à extraire |

Exemples :

```bash
# Extraction basique
npm run extract -- --url https://example.com

# Avec viewport mobile et sélecteur
npm run extract -- --url https://example.com --viewport 375x812 --selector "main"

# Fichier de sortie personnalisé
npm run extract -- --url https://example.com --output mon-site.json
```

Le fichier `extraction.json` est généré à la racine du projet.

### 2. Lancer le serveur local

```bash
npm run serve
```

Le serveur démarre sur **http://localhost:4400** et expose :

| Endpoint                          | Description                    |
|-----------------------------------|--------------------------------|
| `GET /health`                     | Health check                   |
| `GET /manifest.json`              | Manifest du plugin Penpot      |
| `GET /plugin/`                    | UI du plugin (index.html)      |
| `GET /plugin/main.js`             | Code du plugin                 |
| `GET /data/extraction.json`       | Fichier JSON extrait           |

> En développement, `npm run dev` lance le serveur en mode watch (redémarre automatiquement).

### 3. Installer le plugin dans Penpot

1. Ouvrir Penpot et ouvrir un fichier de design
2. Ouvrir le **gestionnaire d'extensions** (icône puzzle dans la barre d'outils)
3. Entrer l'URL : `http://localhost:4400/manifest.json`
4. Cliquer **Installer**

### 4. Importer dans Penpot

1. S'assurer que le serveur tourne (`npm run serve`)
2. Dans Penpot, ouvrir le plugin via **OUVRIR** dans les extensions
3. Vérifier les paramètres (Server URL, nom du fichier, scale)
4. Cliquer **Import into Penpot**

Les shapes sont créées directement sur la page courante.

## Stack technique

- **TypeScript** + **Node.js** (tsx comme runner)
- **Playwright** avec Edge système (`channel: "msedge"`)
- **Express** pour le serveur HTTP local
- **Penpot Plugin API** (JS vanilla)

## Problèmes connus

- **Proxy d'entreprise** : si Playwright ne peut pas télécharger de navigateur, le projet utilise `channel: "msedge"` (Edge doit être installé sur la machine)
- **CSP** : certains sites bloquent l'injection de scripts — le code browser est injecté via `page.evaluate(string)` qui utilise CDP et contourne la CSP
- **Images** : les `<img>` sont extraites en tant que rectangles (pas de téléchargement du bitmap)
- **SVG inline** : les éléments SVG sont extraits comme des formes avec leurs bounds, pas comme du SVG natif Penpot
- **Polices** : le plugin tente de résoudre les polices via `penpot.fonts.findByName()` — si la police n'est pas disponible dans Penpot, le rendu du texte peut différer
