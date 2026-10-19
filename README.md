# Openflow

Ambiente di programmazione con diagrammi di flusso (sul modello di Flowgorithm), con esecuzione
passo passo e traduzione del diagramma in **C, C++, Java e Python**.

## Uso

- Installer: `dist\Openflow Setup 1.0.0.exe` (installazione per utente, collegamenti su desktop e menu Start).
- File: formato `.fprg` (XML), compatibile con i file di Flowgorithm per i blocchi standard.
- Esempi: menu **File › Esempi**.
- Esecuzione: **Esegui** (F5), **Passo** (F10, un blocco alla volta), **Pausa** (F6), **Ferma** (Maiusc+F5).
- Codice sorgente: finestra mobile che si apre col pulsante **Codice** (F4).
- Tabella di traccia: scheda **Tabella di traccia** (pulsante **Traccia**, F7). Si scelgono variabili ed
  espressioni/condizioni da seguire; la tabella si riempie durante l'esecuzione (anche passo passo)
  e si esporta in PNG.

## Sviluppo

```
npm install                 # poi, se npm blocca gli script: node node_modules/electron/install.js
npm start                   # avvia l'app
npm test                    # test del nucleo; il codice generato viene eseguito con python e java
npm run dist:win            # installer Windows (dist/Openflow Setup x.y.z.exe)
npm run dist:linux          # AppImage, .deb e .tar.gz (da Windows riesce solo il .tar.gz)
npm run dist:mac            # .dmg e .zip universali (solo su un Mac)
```

## Build per Windows, macOS e Linux

La pipeline [`.github/workflows/build.yml`](.github/workflows/build.yml) costruisce i pacchetti dei tre sistemi su
macchine GitHub vere a ogni push su `main`: si scaricano dalla pagina *Actions* del repository. Creando un tag
`vX.Y.Z` (`git tag v1.0.1 && git push --tags`) i pacchetti vengono pubblicati anche in una *Release*.

I pacchetti non sono firmati: Windows SmartScreen e macOS Gatekeeper mostrano un avviso al primo avvio
(su Mac: clic destro sull'app › Apri). Per eliminarlo servono un certificato di firma Windows e un account
Apple Developer, da configurare come segreti della pipeline.

Per eseguire nei test anche il C e il C++ generati, imposta `OPENFLOW_CC` e `OPENFLOW_CXX`
(ad es. `python -m ziglang cc` / `python -m ziglang c++`).

Test dell'interfaccia: `electron tests/ui-smoke.cjs <screenshot.png> [programma.fprg] [script.js]`
(da un terminale senza `ELECTRON_RUN_AS_NODE`).

## Guida introduttiva

La guida illustrata è `src/docs/guida.html` (nell'app: **Aiuto › Guida introduttiva**, F1); la versione PDF è
`docs/Openflow - Guida introduttiva.pdf`. Per rigenerarla dopo modifiche all'interfaccia:

```
node tools/screenshots.mjs          # screenshot dall'interfaccia vera → src/docs/img/
node tools/make-guide.mjs           # src/docs/guida.html
electron tools/guide-pdf.cjs        # PDF
```

## Struttura

- `src/core/` — modello e formato file, linguaggio delle espressioni, interprete, generatori di codice, testi IT/EN
- `src/ui/` — diagramma (layout e SVG), finestre di dialogo, pannelli, controller
- `main.cjs`, `preload.cjs` — processo principale di Electron e ponte verso il file system
