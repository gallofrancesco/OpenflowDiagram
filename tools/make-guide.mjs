// Builds src/docs/guida.html (the illustrated getting-started guide) from the screenshots in src/docs/img.
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { setLanguage, t } from '../src/core/i18n.js';
import { shapeIcon } from '../src/ui/chart.js';
import { COLOR_SCHEMES, CHART_STYLES } from '../src/ui/schemes.js';

setLanguage('it');
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const docs = join(root, 'src', 'docs');
const meta = JSON.parse(readFileSync(join(docs, 'img', 'meta.json'), 'utf8'));
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const scheme = COLOR_SCHEMES.system;
const style = CHART_STYLES.standard;

const fig = (img, caption, cls = '') => `<figure class="${cls}"><img src="img/${img}.png" alt="${caption.replace(/<[^>]+>/g, '')}"><figcaption>${caption}</figcaption></figure>`;
const tip = html => `<div class="callout tip"><strong>Suggerimento</strong><div>${html}</div></div>`;
const note = html => `<div class="callout note"><strong>Da sapere</strong><div>${html}</div></div>`;
const kbd = k => k.split('+').map(x => `<kbd>${x}</kbd>`).join('+');

/* ---------- overview callouts ---------- */
const ov = meta.overview;
const CALLOUTS = [
  ['file', 'File: nuovo, apri, salva'],
  ['run', 'Esegui, Passo, Pausa, Ferma'],
  ['speed', 'Velocità di esecuzione'],
  ['funcs', 'Funzione mostrata nel diagramma'],
  ['tabs', 'Schede Diagramma e Tabella di traccia'],
  ['chart', 'Il diagramma di flusso'],
  ['console', 'Console: output e input'],
  ['vars', 'Variabili e loro valori'],
  ['trace', 'Tabella di traccia'],
  ['code', 'Finestra del codice sorgente'],
];
// Badges sit next to what they point at, never on top of a label.
const ANCHORS = {
  below: a => [a.x + a.width / 2, a.y + a.height + 16],
  tabs: a => [a.x + 395, a.y + a.height / 2],
  inside: a => [a.x + 44, a.y + 44],
  leftEdge: a => [a.x - 2, a.y + a.height / 2],
};
const PLACE = { file: 'below', run: 'below', speed: 'below', funcs: 'below', trace: 'below', code: 'below', tabs: 'tabs', chart: 'inside', console: 'leftEdge', vars: 'leftEdge' };
const badge = (area, n) => {
  const [px, py] = ANCHORS[PLACE[area]](ov.areas[area]);
  const x = (px / ov.window.width) * 100, y = (py / ov.window.height) * 100;
  return `<span class="badge-n" style="left:${x.toFixed(2)}%;top:${y.toFixed(2)}%">${n}</span>`;
};
const overview = `<div class="annotated">
  <img src="img/overview.png" alt="La finestra principale di OpenflowDiagram">
  ${CALLOUTS.map(([a], i) => badge(a, i + 1)).join('\n  ')}
</div>
<ol class="legend">${CALLOUTS.map(([, l]) => `<li>${l}</li>`).join('')}</ol>`;

/* ---------- shapes table ---------- */
const SHAPES = [
  ['declare', 'Crea una o più variabili di un tipo (Integer, Real, String, Boolean), anche come array.', 'Integer n, i  ·  Real Array voti[10]'],
  ['assign', 'Calcola un\'espressione e ne mette il risultato in una variabile.', 'somma = somma + x'],
  ['input', 'Chiede un valore all\'utente nella Console e lo salva in una variabile.', 'Input nome'],
  ['output', 'Mostra un valore o un testo nella Console (con o senza "a capo").', 'Output "Ciao, " & nome'],
  ['if', 'Sceglie tra due rami in base a una condizione: Vero a destra, Falso a sinistra.', 'Se voto >= 6'],
  ['call', 'Esegue una funzione che non restituisce valori.', 'Ordina(v)'],
  ['while', 'Ripete il corpo finché la condizione è vera (controllo all\'inizio).', 'Mentre n != 1'],
  ['for', 'Ripete con un contatore da un valore iniziale a uno finale, crescente o decrescente, con passo.', 'Per i = 1 to 10 step 2'],
  ['do', 'Esegue il corpo almeno una volta e lo ripete finché la condizione è vera (controllo alla fine).', 'Ripeti … mentre risposta != "no"'],
  ['comment', 'Una nota nel diagramma: non viene eseguita.', 'Calcolo della media'],
  ['breakpoint', 'Mette in pausa l\'esecuzione in quel punto (sempre o solo se una condizione è vera).', 'Breakpoint: i == 5'],
  ['open', 'Apre un file di testo in lettura o in scrittura.', 'Apri file "dati.txt" (Lettura)'],
  ['read', 'Legge la riga successiva del file in una variabile.', 'Leggi file x'],
  ['write', 'Scrive un valore come nuova riga del file.', 'Scrivi file totale'],
  ['close', 'Chiude il file aperto (i dati scritti vengono salvati).', 'Chiudi file'],
];
const shapesTable = `<table class="data shapes">
<thead><tr><th>Blocco</th><th>A cosa serve</th><th>Esempio</th></tr></thead>
<tbody>${SHAPES.map(([k, what, example]) => `<tr><td class="icon">${shapeIcon(k, t(`shape_${k}`), scheme, style)}</td><td>${what}</td><td><code>${example}</code></td></tr>`).join('\n')}</tbody></table>`;

/* ---------- language reference ---------- */
const BUILTINS = [
  ['Abs(x)', 'valore assoluto'], ['Sqrt(x)', 'radice quadrata'], ['Int(x)', 'parte intera (tronca i decimali)'],
  ['Sgn(x)', 'segno: -1, 0 o 1'], ['Random(n)', 'numero intero casuale da 0 a n-1'], ['Log(x), Log10(x)', 'logaritmo naturale e in base 10'],
  ['Sin, Cos, Tan(x)', 'funzioni trigonometriche (radianti)'], ['ArcSin, ArcCos, ArcTan(x)', 'funzioni inverse'],
  ['Len(s)', 'lunghezza di una stringa'], ['Char(s, i)', 'carattere in posizione i (da 0)'], ['ToCode(s)', 'codice del primo carattere'],
  ['ToChar(n)', 'carattere con codice n'], ['ToInteger(x)', 'converte in Integer (anche da testo)'], ['ToReal(x)', 'converte in Real'],
  ['ToString(x)', 'converte in testo'], ['ToFixed(x, d)', 'testo con d cifre decimali'], ['Size(a)', 'numero di elementi di un array'],
  ['EOF()', 'vero se il file aperto in lettura è finito'], ['Pi', 'la costante π'],
];
const builtinsTable = `<table class="data compact"><thead><tr><th>Funzione</th><th>Risultato</th></tr></thead><tbody>${
  BUILTINS.map(([f, d]) => `<tr><td><code>${f}</code></td><td>${d}</td></tr>`).join('')}</tbody></table>`;

const SHORTCUTS = [
  ['Ctrl+N', 'Nuovo programma'], ['Ctrl+O', 'Apri'], ['Ctrl+S', 'Salva'], ['Ctrl+Shift+S', 'Salva con nome'], ['Ctrl+P', 'Stampa'],
  ['Ctrl+Z', 'Annulla'], ['Ctrl+Y', 'Ripeti'], ['Ctrl+X / C / V', 'Taglia, copia, incolla blocchi'], ['Canc', 'Elimina i blocchi selezionati'],
  ['Invio', 'Modifica il blocco selezionato'], ['Esc', 'Deseleziona / chiude una finestra'], ['F5', 'Esegui (o continua)'], ['F10', 'Passo'],
  ['F6', 'Pausa'], ['Shift+F5', 'Ferma'], ['F4', 'Mostra/nascondi il codice sorgente'], ['F7', 'Tabella di traccia'],
  ['Ctrl+= / Ctrl+-', 'Ingrandisci / riduci il diagramma'], ['Ctrl+0', 'Zoom 100%'], ['Ctrl+rotellina', 'Zoom con il mouse'], ['F1', 'Questa guida (Aiuto › Guida introduttiva)'],
];
const shortcutsTable = `<table class="data compact"><thead><tr><th>Tasti</th><th>Azione</th></tr></thead><tbody>${
  SHORTCUTS.map(([k, a]) => `<tr><td>${k.split(' / ').map(kbd).join(' / ')}</td><td>${a}</td></tr>`).join('')}</tbody></table>`;

const SECTIONS = [
  ['benvenuto', 'Benvenuto in OpenflowDiagram'], ['finestra', 'La finestra principale'], ['primo', 'Il primo programma'],
  ['blocchi', 'I blocchi'], ['linguaggio', 'Tipi, operatori e funzioni'], ['esecuzione', 'Eseguire e fare debug'],
  ['console', 'Console e Variabili'], ['funzioni', 'Funzioni'], ['codice', 'Codice sorgente'],
  ['traccia', 'Tabella di traccia'], ['file', 'File, salvataggio ed esportazione'], ['personalizza', 'Personalizzare OpenflowDiagram'],
  ['tasti', 'Scorciatoie da tastiera'], ['esempi', 'Esempi ed esercizi'], ['faq', 'Domande frequenti'],
];
const h2 = (id, n) => `<h2 id="${id}"><span class="num">${n}</span>${SECTIONS.find(s => s[0] === id)[1]}</h2>`;
let n = 0;
const sec = id => h2(id, ++n);

const body = `
<header class="hero">
  <img class="logo" src="../../build/icon.png" alt="">
  <div>
    <p class="eyebrow">Guida introduttiva · versione ${pkg.version}</p>
    <h1>Programmare con i diagrammi di flusso</h1>
    <p class="lead">Tutto quello che serve per usare OpenflowDiagram: creare un programma, eseguirlo passo passo, seguirne i valori
    con la tabella di traccia e tradurlo in C, C++, Java o Python.</p>
  </div>
</header>

<section>
${sec('benvenuto')}
<p>OpenflowDiagram è un ambiente per imparare a programmare <b>disegnando</b>: invece di scrivere codice, costruisci un diagramma di
flusso con blocchi grafici (dichiarazioni, input, output, condizioni, cicli…) e lo esegui subito. Puoi:</p>
<div class="cards">
  <div class="card"><div class="card-title">Costruire</div>Inserisci i blocchi cliccando sulle frecce del diagramma.</div>
  <div class="card"><div class="card-title">Eseguire</div>Tutto insieme o un blocco alla volta, guardando le variabili cambiare.</div>
  <div class="card"><div class="card-title">Tracciare</div>La tabella di traccia registra valori e condizioni a ogni passo.</div>
  <div class="card"><div class="card-title">Tradurre</div>Il diagramma diventa codice C, C++, Java o Python, sempre aggiornato.</div>
</div>
${note('I programmi si salvano in file <code>.fprg</code>, lo stesso formato di Flowgorithm: puoi aprire i file creati con Flowgorithm e viceversa (per i blocchi supportati).')}
</section>

<section>
${sec('finestra')}
<p>All'avvio OpenflowDiagram mostra un programma vuoto. Questa è la finestra con un programma d'esempio appena eseguito:</p>
${overview}
<p>La <b>barra dei menu</b> (File, Modifica, Programma, Visualizza, Strumenti, Aiuto) contiene tutti i comandi, anche quelli
che non hanno un pulsante. Console e Variabili si possono chiudere con la <kbd>✕</kbd> e riaprire con i pulsanti a destra
della barra; il bordo tra diagramma e pannelli si trascina per cambiarne la larghezza.</p>
</section>

<section>
${sec('primo')}
<p>Costruiamo un programma che chiede il nome e saluta: <i>"Come ti chiami?" → Ada → "Ciao, Ada!"</i></p>
<div class="steps">
<div class="step"><div class="step-n">1</div><div>
  <h3>Inserisci un blocco</h3>
  <p>Un programma nuovo contiene solo <b>Main</b> e <b>Fine</b>. Clicca sulla <b>freccia</b> tra i due: si apre il menu dei blocchi,
  diviso in Blocchi, Cicli, Altro e File. Ogni pulsante mostra la forma del blocco.</p>
  ${fig('tutorial-insert', 'Il menu che compare cliccando su una freccia.')}
</div></div>
<div class="step"><div class="step-n">2</div><div>
  <h3>Dichiara una variabile</h3>
  <p>Scegli <b>Dichiara</b>. Nella finestra scrivi il nome <code>nome</code> e scegli il tipo <b>String</b>, poi <b>OK</b>.
  Le variabili vanno sempre dichiarate prima di usarle.</p>
  ${fig('tutorial-declare', 'La finestra del blocco Dichiara.', 'narrow')}
</div></div>
<div class="step"><div class="step-n">3</div><div>
  <h3>Aggiungi Output e Input</h3>
  <p>Clicca sulla freccia sotto <i>String nome</i> e scegli <b>Output</b>: scrivi <code>"Come ti chiami?"</code> (il testo va tra virgolette).
  Poi, sotto, un blocco <b>Input</b> con la variabile <code>nome</code>, e infine un altro <b>Output</b> con
  <code>"Ciao, " &amp; nome &amp; "!"</code> — il simbolo <code>&amp;</code> unisce testi e valori.</p>
  ${fig('tutorial-output', 'La finestra del blocco Output: l\'opzione "Vai a capo" è attiva di default.', 'narrow')}
</div></div>
<div class="step"><div class="step-n">4</div><div>
  <h3>Controlla il diagramma</h3>
  <p>Il programma completo è questo. Se un campo è vuoto o un'espressione è sbagliata, OpenflowDiagram te lo dice subito nella finestra del blocco;
  un blocco lasciato vuoto appare tratteggiato.</p>
  ${fig('tutorial-chart', 'Il programma "Saluto".', 'narrow')}
</div></div>
<div class="step"><div class="step-n">5</div><div>
  <h3>Esegui e rispondi</h3>
  <p>Premi <b>Esegui</b> (<kbd>F5</kbd>). Quando il programma arriva al blocco Input, la casella in fondo alla Console si illumina:
  scrivi la risposta e premi <kbd>Invio</kbd>.</p>
  ${fig('tutorial-waiting', 'La Console attende un valore.', 'narrow')}
  ${fig('tutorial-run', 'Il programma terminato: l\'output nella Console e il valore di <code>nome</code> nel pannello Variabili.')}
</div></div>
<div class="step"><div class="step-n">6</div><div>
  <h3>Salva</h3>
  <p>Usa <b>File › Salva</b> (<kbd>Ctrl</kbd>+<kbd>S</kbd>). Il pallino • nel titolo della finestra indica modifiche non salvate.</p>
</div></div>
</div>
</section>

<section>
${sec('blocchi')}
${shapesTable}
<h3>Lavorare con i blocchi</h3>
<ul class="checks">
  <li><b>Modificare</b>: doppio clic sul blocco (oppure selezionalo e premi <kbd>Invio</kbd>).</li>
  <li><b>Selezionare più blocchi</b>: clic sul primo e <kbd>Shift</kbd>+clic sull'ultimo (devono essere nello stesso ramo).</li>
  <li><b>Tagliare, copiare, incollare, eliminare</b>: clic destro sul blocco, oppure <kbd>Ctrl</kbd>+<kbd>X</kbd>/<kbd>C</kbd>/<kbd>V</kbd> e <kbd>Canc</kbd>.
  Per incollare in un punto preciso, clicca la freccia e scegli <b>Incolla</b> in fondo al menu.</li>
  <li><b>Annullare</b>: <kbd>Ctrl</kbd>+<kbd>Z</kbd> e <kbd>Ctrl</kbd>+<kbd>Y</kbd> annullano e ripetono qualsiasi modifica.</li>
  <li><b>Zoom</b>: pulsanti lente nella barra, oppure <kbd>Ctrl</kbd>+rotellina.</li>
</ul>
${fig('shapes', 'Se e cicli: il ramo Vero e il ramo Falso, e la freccia che riporta all\'inizio del ciclo Mentre (esempio "Cicli").', 'narrow')}
</section>

<section>
${sec('linguaggio')}
<div class="two">
<div>
<h3>Tipi</h3>
<table class="data compact"><thead><tr><th>Tipo</th><th>Valori</th></tr></thead><tbody>
<tr><td><span class="pill b-Integer">Integer</span></td><td>numeri interi: <code>42</code>, <code>-7</code></td></tr>
<tr><td><span class="pill b-Real">Real</span></td><td>numeri con la virgola: <code>3.14</code></td></tr>
<tr><td><span class="pill b-String">String</span></td><td>testo: <code>"ciao"</code></td></tr>
<tr><td><span class="pill b-Boolean">Boolean</span></td><td><code>true</code> o <code>false</code></td></tr>
</tbody></table>
<h3>Operatori</h3>
<table class="data compact"><thead><tr><th>Operatore</th><th>Significato</th></tr></thead><tbody>
<tr><td><code>+ - * /</code></td><td>aritmetica (<code>/</code> dà sempre un Real: <code>7 / 2 = 3.5</code>)</td></tr>
<tr><td><code>%</code> o <code>mod</code></td><td>resto della divisione</td></tr>
<tr><td><code>^</code></td><td>potenza: <code>2 ^ 10</code></td></tr>
<tr><td><code>&amp;</code></td><td>unisce testi e valori</td></tr>
<tr><td><code>== != &lt; &lt;= &gt; &gt;=</code></td><td>confronti (anche <code>=</code> e <code>&lt;&gt;</code>)</td></tr>
<tr><td><code>and or not</code></td><td>logica (anche <code>&amp;&amp; || !</code>)</td></tr>
</tbody></table>
</div>
<div>
<h3>Funzioni predefinite</h3>
${builtinsTable}
</div>
</div>
${note('Gli array partono da 0: un <code>Integer Array v[5]</code> ha gli elementi <code>v[0]</code> … <code>v[4]</code>. Maiuscole e minuscole nei nomi non contano (<code>Somma</code> e <code>somma</code> sono la stessa variabile).')}
</section>

<section>
${sec('esecuzione')}
<table class="data compact"><thead><tr><th>Pulsante</th><th>Cosa fa</th></tr></thead><tbody>
<tr><td><b>Esegui</b> <kbd>F5</kbd></td><td>Esegue il programma alla velocità scelta; durante una pausa, riprende.</td></tr>
<tr><td><b>Passo</b> <kbd>F10</kbd></td><td>Esegue <b>un blocco alla volta</b>: il blocco evidenziato in arancione è quello che sta per essere eseguito.</td></tr>
<tr><td><b>Pausa</b> <kbd>F6</kbd></td><td>Ferma temporaneamente un programma in esecuzione.</td></tr>
<tr><td><b>Ferma</b> <kbd>Shift</kbd>+<kbd>F5</kbd></td><td>Interrompe il programma.</td></tr>
<tr><td><b>Velocità</b></td><td>Lenta, Media, Veloce (per seguire l'evidenziazione) o Massima (risultato immediato).</td></tr>
</tbody></table>
${fig('step', 'Passo passo: il blocco evidenziato, la riga corrispondente nel codice e le variabili aggiornate.')}
<h3>Breakpoint</h3>
<p>Un blocco <b>Breakpoint</b> mette in pausa il programma quando viene raggiunto (sempre, oppure solo se una condizione è vera).
Da lì puoi continuare con <b>Esegui</b> o con <b>Passo</b>. <b>Programma › Ignora i breakpoint</b> li salta tutti,
<b>Rimuovi tutti i breakpoint</b> li elimina.</p>
${fig('breakpoint', 'Il programma in pausa sul breakpoint.')}
<h3>Errori</h3>
<p>Se qualcosa va storto (divisione per zero, variabile non inizializzata, indice fuori dall'array…) OpenflowDiagram si ferma,
evidenzia in rosso il blocco responsabile e spiega il problema in italiano.</p>
${fig('error', 'Un errore di esecuzione: il blocco <code>n = 27 / 0</code> è evidenziato in rosso.')}
</section>

<section>
${sec('console')}
<p>La <b>Console</b> mostra l'output e raccoglie l'input. Con <b>Fumetti</b> attivo i messaggi appaiono come in una chat
(programma a sinistra, tu a destra); disattivandolo diventa un terminale classico. <b>Copia tutto</b> copia il contenuto, <b>Pulisci</b> lo svuota.</p>
<p>Il pannello <b>Variabili</b> mostra il valore di ogni variabile mentre il programma gira; <code>?</code> indica una variabile non ancora
inizializzata. Con <b>Mostra stack</b> vedi anche le variabili delle funzioni chiamanti:</p>
${fig('variables-stack', 'Dentro la funzione Ordina: le sue variabili e, sotto, quelle di Main.', 'narrow')}
</section>

<section>
${sec('funzioni')}
<p>Un programma può avere, oltre a <b>Main</b>, altre funzioni. Usa il pulsante <b>+</b> della barra (o <b>Programma › Aggiungi funzione</b>)
e scegli nome, tipo restituito, variabile restituita e parametri. Il menu a tendina nella barra mostra la funzione da modificare.</p>
<div class="two">
${fig('function-edit', 'Definizione di una funzione con un parametro array.')}
${fig('function-chart', 'Il diagramma della funzione Somma: il blocco finale restituisce <code>s</code>.')}
</div>
<ul class="checks">
  <li>Una funzione che restituisce un valore si usa nelle espressioni: <code>"Somma = " &amp; Somma(v)</code>.</li>
  <li>Una funzione senza valore (tipo <b>Nessuno</b>) si esegue con il blocco <b>Chiama</b>.</li>
  <li>I parametri normali ricevono una copia del valore; gli <b>array</b> sono passati per riferimento (la funzione può modificarli).</li>
  <li>Doppio clic sul blocco iniziale di una funzione per modificarne la definizione.</li>
</ul>
${fig('functions-manager', '<b>Gestione funzioni</b> (pulsante <b>Funzioni</b> nella barra): apri, modifica, elimina o importa funzioni da un altro file .fprg.', 'narrow')}
</section>

<section>
${sec('codice')}
<p>Il pulsante <b>Codice</b> (<kbd>F4</kbd>) apre una finestra mobile con il programma tradotto in <b>C, C++, Java o Python</b>.
La traduzione si aggiorna mentre modifichi il diagramma e, durante l'esecuzione, evidenzia la riga del blocco corrente.
Trascina la finestra dal titolo e ridimensionala dall'angolo in basso a destra.</p>
<div class="two">
${fig('code-window', 'Il programma Fattoriale in Python.')}
${fig('code-java', 'Lo stesso programma in Java.')}
</div>
${tip('<b>Copia</b> mette il codice negli appunti, <b>Salva su file…</b> lo salva con l\'estensione giusta (<code>.c</code>, <code>.cpp</code>, <code>.java</code>, <code>.py</code>), pronto da compilare o eseguire.')}
</section>

<section>
${sec('traccia')}
<p>La <b>tabella di traccia</b> è il modo classico per capire cosa fa un algoritmo: una riga per ogni blocco eseguito, con i valori
delle variabili e l'esito delle condizioni. Si apre con il pulsante <b>Traccia</b> (<kbd>F7</kbd>) e compare in una scheda accanto al diagramma.</p>
<h3>1. Scegli cosa tracciare</h3>
<p>La prima volta OpenflowDiagram chiede quali <b>variabili</b> seguire (raggruppate per funzione) e quali <b>espressioni o condizioni</b>
calcolare a ogni passo, per esempio <code>i % 2 == 0</code>. Puoi cambiare la scelta con <b>Scegli valori…</b>.</p>
${fig('trace-setup', 'La scelta dei valori: variabili di Main, la variabile r della funzione Fact e una condizione.', 'narrow')}
<h3>2. Costruiscila passo passo</h3>
<p>Premi <b>Passo</b>: a ogni blocco eseguito si aggiunge una riga, e l'ultima è evidenziata. I valori appena cambiati sono in giallo,
le condizioni mostrano <span class="pill yes">Vero</span> o <span class="pill no">Falso</span>.</p>
${fig('trace-step', 'Dopo alcuni passi.')}
<h3>3. Completa ed esporta</h3>
<p>Con <b>Esegui</b> la tabella si completa. <b>Solo righe con cambiamenti</b> nasconde le righe in cui non cambia nulla;
<b>Esporta PNG</b> salva un'immagine della tabella, ideale per consegne e appunti.</p>
${fig('trace-table', 'La tabella completa del programma Fattoriale, con la colonna Output.')}
</section>

<section>
${sec('file')}
<h3>Leggere e scrivere file</h3>
<p>I blocchi <b>Apri file</b>, <b>Leggi file</b>, <b>Scrivi file</b> e <b>Chiudi file</b> lavorano su file di testo, una riga per valore.
Il nome del file è relativo alla cartella del programma salvato (o a Documenti, se il programma non è ancora salvato).
<code>EOF()</code> dice quando il file è finito.</p>
${fig('files', 'L\'esempio "File" scrive i quadrati da 1 a 25 e poi li rilegge sommandoli.')}
<h3>Salvare, aprire, esportare</h3>
<ul class="checks">
  <li><b>File › Salva / Apri</b>: programmi in formato <code>.fprg</code>; puoi anche trascinare un file sulla finestra.</li>
  <li><b>File › Recenti</b>: gli ultimi file usati. <b>File › Esempi</b>: programmi pronti (si aprono come copie senza nome).</li>
  <li><b>File › Esporta immagine PNG / SVG</b>: il diagramma della funzione mostrata.</li>
  <li><b>File › Stampa</b>: stampa tutte le funzioni, una per pagina.</li>
  <li><b>Programma › Attributi del programma</b>: nome, autori e descrizione salvati nel file.</li>
</ul>
</section>

<section>
${sec('personalizza')}
<p>Da <b>Strumenti › Impostazioni</b> scegli lingua (italiano o inglese), schema colori, stile del diagramma, linguaggio
predefinito per il codice e profondità massima delle chiamate.</p>
<div class="two">
${fig('settings', 'Le impostazioni.')}
${fig('style-classic', 'Stile <b>Classico</b> con lo schema <b>Vivace</b>.')}
</div>
<p>Schemi colore: <b>Sistema</b> (predefinito), Pastello, Vivace, Bianco e nero (adatto alla stampa), Progetto.
Stili: <b>Standard</b>, <b>Descrittivo</b> (ogni blocco mostra anche il suo nome) e <b>Classico</b> (forme tradizionali).
Si cambiano al volo anche da <b>Visualizza</b>.</p>
</section>

<section>
${sec('tasti')}
${shortcutsTable}
</section>

<section>
${sec('esempi')}
<p>In <b>File › Esempi</b> trovi:</p>
<table class="data compact"><thead><tr><th>Esempio</th><th>Cosa mostra</th></tr></thead><tbody>
<tr><td><b>Fattoriale</b></td><td>ciclo Per e funzione ricorsiva</td></tr>
<tr><td><b>Ordinamento</b></td><td>array, funzioni con parametri array (bubble sort e somma)</td></tr>
<tr><td><b>Cicli</b></td><td>Mentre, Ripeti, Per decrescente, Se annidati, breakpoint</td></tr>
<tr><td><b>Input</b></td><td>lettura di testi, numeri e valori Boolean</td></tr>
<tr><td><b>Stringhe</b></td><td>Len, Char, ToCode, ToChar, confronti tra testi</td></tr>
<tr><td><b>File</b></td><td>scrittura e lettura di un file di testo</td></tr>
</tbody></table>
<h3>Esercizi per iniziare</h3>
<ol class="exercises">
  <li><b>Pari o dispari</b> — chiedi un numero e scrivi se è pari o dispari (suggerimento: <code>n % 2 == 0</code>).</li>
  <li><b>Tabellina</b> — chiedi un numero e stampa la sua tabellina da 1 a 10 con un ciclo Per.</li>
  <li><b>Indovina il numero</b> — il programma sceglie <code>Random(100) + 1</code> e risponde "più alto" o "più basso" finché non indovini (ciclo Ripeti).</li>
  <li><b>Media dei voti</b> — leggi 5 voti in un <code>Real Array</code> e calcola la media; usa <code>ToFixed(media, 2)</code> per l'output.</li>
  <li><b>Massimo con funzione</b> — scrivi una funzione <code>Massimo(Integer Array a)</code> che restituisce il valore più grande e seguila con la tabella di traccia.</li>
</ol>
</section>

<section>
${sec('faq')}
<dl class="faq">
  <dt>Il programma non parte e un blocco è tratteggiato.</dt><dd>Il blocco è incompleto: fai doppio clic e compila i campi.</dd>
  <dt>«La variabile … non è stata inizializzata».</dt><dd>La variabile è dichiarata ma non ha ancora un valore: assegnale un valore o leggila con Input prima di usarla.</dd>
  <dt>«Tipo del valore incompatibile».</dt><dd>Stai mettendo, per esempio, un Real in una variabile Integer: usa <code>Int(…)</code> o dichiara la variabile Real.</dd>
  <dt>Il programma non finisce mai.</dt><dd>Probabilmente un ciclo infinito: premi <b>Ferma</b> e controlla che la condizione del ciclo possa diventare falsa.</dd>
  <dt>Voglio vedere un ciclo lentamente.</dt><dd>Scegli la velocità <b>Lenta</b>, oppure usa <b>Passo</b> e la tabella di traccia.</dd>
  <dt>Come cambio lingua?</dt><dd><b>Strumenti › Impostazioni › Lingua</b> (Tools › Settings in inglese).</dd>
</dl>
</section>
`;

const toc = SECTIONS.map(([id, title], i) => `<a href="#${id}"><span>${i + 1}</span>${title}</a>`).join('');

const html = `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; img-src 'self' data:; style-src 'unsafe-inline'">
<title>OpenflowDiagram — Guida introduttiva</title>
<style>
:root {
  --primary: #007aff; --primary-subtle: #e6f1ff; --text: #1c1c1e; --text-2: #3a3a3c; --muted: #6e6e73;
  --bg: #f2f2f7; --surface: #fff; --border: #e3e3e8; --header: #f7f7f9;
  --font: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI Variable Text", "Segoe UI", system-ui, sans-serif;
  --mono: "SF Mono", ui-monospace, "Cascadia Mono", Consolas, monospace;
}
* { box-sizing: border-box; }
html { scroll-behavior: smooth; scroll-padding-top: 20px; }
body { margin: 0; background: var(--bg); color: var(--text); font: 16px/1.65 var(--font); -webkit-font-smoothing: antialiased; }
.layout { display: grid; grid-template-columns: 270px minmax(0, 1fr); max-width: 1320px; margin: 0 auto; }
nav.toc { position: sticky; top: 0; height: 100vh; overflow: auto; padding: 28px 18px 28px 24px; }
nav.toc .brand { display: flex; align-items: center; gap: 10px; font-weight: 700; font-size: 19px; margin-bottom: 18px; }
nav.toc .brand img { width: 34px; height: 34px; }
nav.toc a { display: flex; gap: 10px; padding: 6px 10px; border-radius: 8px; color: var(--text-2); text-decoration: none; font-size: 14.5px; }
nav.toc a span { color: var(--muted); min-width: 18px; text-align: right; font-variant-numeric: tabular-nums; }
nav.toc a:hover { background: var(--primary-subtle); color: var(--primary); }
main { padding: 28px 32px 60px 8px; }
section, header.hero { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: 30px 36px; margin-bottom: 22px; box-shadow: 0 1px 2px rgba(0,0,0,.04); }
header.hero { display: flex; gap: 26px; align-items: center; background: linear-gradient(135deg, #ffffff 0%, #eef5ff 100%); }
header.hero .logo { width: 104px; height: 104px; flex: none; }
.eyebrow { color: var(--primary); font-weight: 600; margin: 0; font-size: 14px; text-transform: uppercase; letter-spacing: .05em; }
h1 { font-size: 36px; line-height: 1.15; margin: 6px 0 10px; letter-spacing: -.02em; }
.lead { font-size: 18px; color: var(--text-2); margin: 0; }
h2 { font-size: 27px; margin: 0 0 16px; letter-spacing: -.01em; display: flex; align-items: center; gap: 12px; }
h2 .num { display: inline-flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: 10px; background: var(--primary); color: #fff; font-size: 17px; }
h3 { font-size: 19px; margin: 24px 0 8px; }
p { margin: 10px 0; }
code { font-family: var(--mono); font-size: .9em; background: #f2f2f7; border-radius: 5px; padding: 1px 6px; }
kbd { font-family: var(--font); font-size: 13px; font-weight: 600; background: #fff; border: 1px solid #c7c7cc; border-bottom-width: 2px; border-radius: 6px; padding: 1px 7px; white-space: nowrap; }
figure { margin: 18px 0; }
figure img { display: block; max-width: 100%; height: auto; border-radius: 12px; border: 1px solid var(--border); box-shadow: 0 6px 22px rgba(0,0,0,.10); }
figure.narrow img { max-width: 560px; }
figcaption { color: var(--muted); font-size: 14px; margin-top: 8px; }
.two { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; align-items: start; }
.two figure { margin-top: 8px; }
.cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin: 16px 0; }
.card { border: 1px solid var(--border); border-radius: 12px; padding: 14px 16px; background: var(--header); font-size: 15px; }
.card-title { font-weight: 700; color: var(--primary); margin-bottom: 4px; }
.callout { display: flex; gap: 14px; border-radius: 12px; padding: 14px 18px; margin: 18px 0; font-size: 15px; }
.callout strong { white-space: nowrap; }
.callout.tip { background: #e8f7ec; border: 1px solid #bfe8ca; }
.callout.tip strong { color: #1e8a3c; }
.callout.note { background: var(--primary-subtle); border: 1px solid #c3dcff; }
.callout.note strong { color: #0060d1; }
.annotated { position: relative; margin: 16px 0; }
.annotated img { display: block; width: 100%; border-radius: 12px; border: 1px solid var(--border); box-shadow: 0 6px 22px rgba(0,0,0,.10); }
.badge-n { position: absolute; transform: translate(-50%, -50%); width: 30px; height: 30px; border-radius: 50%; background: #ff3b30; color: #fff;
  font-weight: 700; font-size: 15px; display: flex; align-items: center; justify-content: center; border: 2.5px solid #fff; box-shadow: 0 2px 8px rgba(0,0,0,.3); }
ol.legend { display: grid; grid-template-columns: repeat(2, 1fr); gap: 4px 30px; padding: 0; list-style: none; counter-reset: c; }
ol.legend li { counter-increment: c; display: flex; gap: 10px; align-items: center; }
ol.legend li::before { content: counter(c); flex: none; width: 24px; height: 24px; border-radius: 50%; background: #ff3b30; color: #fff; font-weight: 700; font-size: 13px; display: flex; align-items: center; justify-content: center; }
.steps { display: flex; flex-direction: column; gap: 6px; }
.step { display: grid; grid-template-columns: 44px minmax(0, 1fr); gap: 16px; padding: 14px 0; border-top: 1px solid var(--border); }
.step:first-child { border-top: none; }
.step-n { width: 40px; height: 40px; border-radius: 50%; background: var(--primary-subtle); color: var(--primary); font-weight: 700; font-size: 18px; display: flex; align-items: center; justify-content: center; }
.step h3 { margin-top: 6px; }
table.data { width: 100%; border-collapse: separate; border-spacing: 0; border: 1px solid var(--border); border-radius: 12px; overflow: hidden; margin: 14px 0; font-size: 15px; }
table.data th { background: var(--header); text-align: left; padding: 10px 14px; font-weight: 600; border-bottom: 1px solid var(--border); }
table.data td { padding: 9px 14px; border-bottom: 1px solid #efeff3; vertical-align: middle; }
table.data tr:last-child td { border-bottom: none; }
table.data.compact td { padding: 7px 14px; }
table.shapes td.icon { width: 140px; }
table.shapes td.icon svg { display: block; }
.pill { display: inline-block; padding: 1px 10px; border-radius: 999px; font-size: 13px; font-weight: 600; }
.b-Integer { background: #e6f1ff; color: #0060d1; } .b-Real { background: #f5e9fb; color: #8e3cb5; }
.b-String { background: #fff1e0; color: #b35c00; } .b-Boolean { background: #e5f7ea; color: #1e8a3c; }
.pill.yes { background: #e5f7ea; color: #1e8a3c; } .pill.no { background: #ffeceb; color: #d70015; }
ul.checks { padding-left: 0; list-style: none; }
ul.checks li { position: relative; padding-left: 28px; margin: 8px 0; }
ul.checks li::before { content: "✓"; position: absolute; left: 4px; color: var(--primary); font-weight: 700; }
ol.exercises li { margin: 8px 0; }
dl.faq dt { font-weight: 600; margin-top: 14px; }
dl.faq dd { margin: 4px 0 0; color: var(--text-2); }
footer { text-align: center; color: var(--muted); font-size: 14px; padding: 10px 0 30px; }
@media (max-width: 1000px) {
  .layout { grid-template-columns: 1fr; }
  nav.toc { display: none; }
  main { padding: 16px; }
  .two, .cards { grid-template-columns: 1fr; }
}
@media print {
  @page { size: A4; margin: 14mm 12mm; }
  body { background: #fff; font-size: 12.5pt; }
  .layout { display: block; max-width: none; }
  nav.toc { display: none; }
  main { padding: 0; }
  section, header.hero { box-shadow: none; border: none; padding: 0; margin: 0 0 9mm; }
  header.hero { background: #fff; }
  /* Only small things are kept whole; long sections and steps may flow across pages. */
  h2, h3 { break-after: avoid; }
  figure, .annotated, tr, .callout, .card { break-inside: avoid; }
  figure img, .annotated img { box-shadow: none; }
  figure.narrow img { max-width: 70%; }
  .cards { grid-template-columns: repeat(2, 1fr); }
  .badge-n { width: 20px; height: 20px; font-size: 11px; border-width: 1.5px; }
  a { color: inherit; text-decoration: none; }
}
</style>
</head>
<body>
<div class="layout">
<nav class="toc" aria-label="Indice">
  <div class="brand"><img src="../../build/icon.png" alt="">OpenflowDiagram</div>
  ${toc}
</nav>
<main>
${body}
<footer>OpenflowDiagram ${pkg.version} · Guida introduttiva</footer>
</main>
</div>
</body>
</html>
`;

writeFileSync(join(docs, 'guida.html'), html);
console.log('src/docs/guida.html written');
