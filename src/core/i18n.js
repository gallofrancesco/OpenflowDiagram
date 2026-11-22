// User-interface and runtime-error text. Italian is the default language.

const it = {
  appName: 'OpenflowDiagram',
  untitled: 'Senza titolo',
  // menus and toolbar
  file: 'File', edit: 'Modifica', program: 'Programma', view: 'Visualizza', tools: 'Strumenti', help: 'Aiuto',
  new: 'Nuovo', open: 'Apri…', save: 'Salva', saveAs: 'Salva con nome…', recent: 'Recenti', examples: 'Esempi', print: 'Stampa…',
  exportPng: 'Esporta immagine PNG…', exportSvg: 'Esporta immagine SVG…', exit: 'Esci',
  undo: 'Annulla', redo: 'Ripeti', cut: 'Taglia', copy: 'Copia', paste: 'Incolla', delete: 'Elimina',
  insertShape: 'Inserisci blocco…', insertShapeShort: 'Inserisci', editShape: 'Modifica blocco…', selectNone: 'Deseleziona',
  toggleDevTools: 'Strumenti di sviluppo',
  run: 'Esegui', step: 'Passo', pause: 'Pausa', stop: 'Ferma', speed: 'Velocità',
  speedSlow: 'Lenta', speedMedium: 'Media', speedFast: 'Veloce', speedFull: 'Massima',
  ignoreBreakpoints: 'Ignora i breakpoint', removeBreakpoints: 'Rimuovi tutti i breakpoint',
  addFunction: 'Aggiungi funzione…', manageFunctions: 'Gestione funzioni…', attributes: 'Attributi del programma…',
  console: 'Console', variables: 'Variabili', sourceCode: 'Codice sorgente',
  layout: 'Disposizione', layoutChart: 'Solo diagramma', layoutConsole: 'Diagramma e console',
  layoutVariables: 'Diagramma, variabili e console', layoutAll: 'Tutti i pannelli',
  zoomIn: 'Ingrandisci', zoomOut: 'Riduci', zoomReset: 'Zoom 100%',
  colorScheme: 'Schema colori', chartStyle: 'Stile diagramma', language: 'Lingua',
  settings: 'Impostazioni…', about: 'Informazioni su OpenflowDiagram', documentation: 'Guida rapida', guide: 'Guida introduttiva',
  // panels
  enterValue: 'Inserisci un valore e premi Invio', send: 'Invia', clear: 'Pulisci', chatBubbles: 'Fumetti',
  copyAll: 'Copia tutto', saveFile: 'Salva su file…', lineNumbers: 'Numeri di riga', showStack: 'Mostra stack',
  uninitialized: '(non inizializzata)', parameters: 'Parametri',
  noVariables: 'Nessuna variabile. Esegui il programma per vederle qui.',
  codeLanguage: 'Linguaggio',
  // shapes
  shape_declare: 'Dichiara', shape_assign: 'Assegna', shape_input: 'Input', shape_output: 'Output',
  shape_if: 'Se', shape_while: 'Mentre', shape_for: 'Per', shape_do: 'Ripeti', shape_call: 'Chiama',
  shape_comment: 'Commento', shape_breakpoint: 'Breakpoint', shape_open: 'Apri file',
  shape_close: 'Chiudi file', shape_read: 'Leggi file', shape_write: 'Scrivi file',
  groupBasic: 'Blocchi', groupLoops: 'Cicli', groupOther: 'Altro', groupFiles: 'File',
  // trace table
  // function picker
  fnPicker: 'Inserisci una funzione', fnSearch: 'Cerca una funzione…', fnGroupMath: 'Matematica', fnGroupText: 'Testo',
  fnGroupConv: 'Conversioni', fnGroupOther: 'Array e file', fnGroupUser: 'Le tue funzioni',
  fnNoValue: 'non restituisce valori: si usa con il blocco Chiama', fnReturns: 'restituisce un {type}',
  fnNoMatch: 'Nessuna funzione trovata.', fnNoneDefined: 'Il programma non ha ancora funzioni: creane una con il pulsante +.',
  fn_abs: 'valore assoluto', fn_sqrt: 'radice quadrata', fn_int: 'parte intera (tronca i decimali)', fn_sgn: 'segno: -1, 0 oppure 1',
  fn_random: 'intero casuale da 0 a n-1', fn_log: 'logaritmo naturale', fn_log10: 'logaritmo in base 10',
  fn_sin: 'seno (angolo in radianti)', fn_cos: 'coseno (angolo in radianti)', fn_tan: 'tangente (angolo in radianti)',
  fn_arcsin: 'arcoseno', fn_arccos: 'arcocoseno', fn_arctan: 'arcotangente', fn_pi: 'la costante π (3,14159…)',
  fn_len: 'numero di caratteri del testo', fn_char: 'carattere in posizione i (la prima è 0)', fn_tocode: 'codice del primo carattere',
  fn_tochar: 'carattere con codice n', fn_tointeger: 'converte in Integer (anche da testo)', fn_toreal: 'converte in Real (anche da testo)',
  fn_tostring: 'converte in testo', fn_tofixed: 'testo con d cifre decimali', fn_size: 'numero di elementi dell\'array',
  fn_eof: 'vero se il file aperto in lettura è finito',
  // file viewer
  filesPanel: 'File', fileRefresh: 'Aggiorna', fileOpenOther: 'Apri…',
  fileViewerEmpty: 'Il programma non usa file. Qui compare il contenuto dei file usati dai blocchi Apri file, Leggi file e Scrivi file; con «Apri…» puoi vedere qualsiasi file di testo.',
  fileStateRead: 'Aperto in lettura · prossima riga: {n}', fileStateReadEnd: 'Aperto in lettura · fine del file',
  fileStateWrite: 'Aperto in scrittura · {rows} (salvataggio alla chiusura)', fileStateDisk: 'Su disco · {rows}',
  oneLine: '1 riga', nLines: '{n} righe',
  fileMissing: 'Il file non esiste ancora: verrà creato quando il programma lo apre in scrittura.',
  fileError: 'Impossibile leggere il file.', fileEmpty: '(file vuoto)', fileTruncated: 'Mostrate solo le prime {n} righe.',
  chartTab: 'Diagramma', traceTable: 'Tabella di traccia', traceShort: 'Traccia', codeShort: 'Codice', traceChoose: 'Scegli valori…', traceTitle: 'Valori da tracciare',
  traceVariables: 'Variabili', traceExpressions: 'Espressioni e condizioni', traceExprHint: 'Esempi: i * 2   ·   n > 0   ·   x % 2 == 0   ·   Len(nome)',
  traceAddExpr: 'Aggiungi espressione', traceOutputCol: 'Mostra la colonna Output', traceOnlyChanges: 'Solo righe con cambiamenti',
  traceExportPng: 'Esporta PNG', traceEmpty: 'Premi Esegui o Passo: la tabella si riempie mentre il programma viene eseguito.',
  traceNotConfigured: 'Scegli le variabili e le condizioni da seguire per costruire la tabella di traccia.',
  traceStep: '#', traceFunction: 'Funzione', traceBlock: 'Blocco', traceResult: 'Esito', traceOutput: 'Output',
  traceLimit: 'Raggiunto il limite di {n} righe: la registrazione si è fermata.', traceRow: '1 riga', traceRows: '{n} righe',
  traceNoUserCalls: 'Le espressioni tracciate non possono chiamare funzioni del programma.',
  traceNothing: 'Scegli almeno una variabile o un\'espressione da tracciare.', traceIn: 'in',
  start: 'Inizio', end: 'Fine', main: 'Main', returnWord: 'Restituisci', trueWord: 'Vero', falseWord: 'Falso',
  incomplete: 'Blocco incompleto',
  // dialogs
  ok: 'OK', cancel: 'Annulla', close: 'Chiudi', yes: 'Sì', no: 'No', add: 'Aggiungi', remove: 'Rimuovi',
  moveUp: 'Su', moveDown: 'Giù', import: 'Importa…',
  variableName: 'Nome variabile', variableNames: 'Nomi delle variabili (separati da virgola)', type: 'Tipo',
  isArray: 'Array', arraySize: 'Dimensione', expression: 'Espressione', condition: 'Condizione',
  newline: 'Vai a capo', noNewline: 'Resta sulla stessa riga', start_: 'Valore iniziale', end_: 'Valore finale', stepValue: 'Passo',
  direction: 'Direzione', increasing: 'Crescente', decreasing: 'Decrescente', commentText: 'Testo del commento',
  callText: 'Chiamata (es. MiaFunzione(1, x))', always: 'Fermati sempre', conditional: 'Fermati solo se la condizione è vera',
  fileName: 'Nome del file', mode: 'Modalità', modeRead: 'Lettura', modeWrite: 'Scrittura',
  functionName: 'Nome della funzione', returnType: 'Tipo restituito', returnVariable: 'Variabile restituita',
  none: 'Nessuno', parameterName: 'Nome parametro', programName: 'Nome del programma', authors: 'Autori',
  aboutProgram: 'Descrizione', editFunction: 'Funzione', newFunction: 'Nuova funzione',
  confirmDiscard: 'Il programma contiene modifiche non salvate. Vuoi salvarle?',
  deleteFunctionConfirm: 'Eliminare la funzione "{name}"?', invalidName: 'Nome non valido: "{name}"',
  duplicateName: 'Esiste già una funzione chiamata "{name}"', runtimeError: 'Errore di esecuzione',
  syntaxError: 'Errore', programEnded: 'Programma terminato.', programStopped: 'Programma interrotto.',
  breakpointHit: 'Breakpoint raggiunto', waitingInput: 'In attesa di input…', running: 'In esecuzione…',
  paused: 'In pausa', ready: 'Pronto', saved: 'Salvato', functionsOf: 'Funzioni',
  importFunctions: 'Seleziona le funzioni da importare', noFunctionsToImport: 'Il file non contiene funzioni da importare.',
  mainProgram: 'Programma principale',
  breakpoint: 'Breakpoint', copied: 'Copiato negli appunti', settingsTitle: 'Impostazioni',
  maxStack: 'Profondità massima delle chiamate', defaultCodeLanguage: 'Linguaggio predefinito per il codice',
  helpText: `<p><b>OpenflowDiagram</b> è un ambiente di programmazione visuale: scrivi programmi con diagrammi di flusso.</p>
<ul>
<li>Fai clic su una <b>freccia</b> del diagramma per inserire un nuovo blocco.</li>
<li>Fai <b>doppio clic</b> su un blocco per modificarlo; clic destro per tagliare, copiare o eliminare.</li>
<li>Usa <b>Esegui</b> (F5) o <b>Passo</b> (F10) per eseguire il programma; i valori compaiono in Console e Variabili.</li>
<li>Il pannello <b>Codice sorgente</b> traduce il diagramma in C, C++, Java o Python.</li>
<li>Tipi: Integer, Real, String, Boolean. Operatori: + - * / % ^ &amp; == != &lt; &lt;= &gt; &gt;= and or not.</li>
<li>Funzioni: Abs, ArcCos, ArcSin, ArcTan, Char, Cos, EOF, Int, Len, Log, Log10, Random, Sgn, Sin, Size, Sqrt, Tan,
 ToChar, ToCode, ToFixed, ToInteger, ToReal, ToString. Costanti: Pi, true, false.</li>
</ul>`,
  aboutText: 'Ambiente didattico per programmare con i diagrammi di flusso, con traduzione in C, C++, Java e Python.',
  // runtime errors
  errStackOverflow: 'Troppe chiamate annidate (stack overflow).',
  errFileAlreadyOpen: 'Un file è già aperto.', errFileNotOpen: 'Nessun file aperto.',
  errCannotAccessFile: 'Impossibile accedere al file "{name}".', errFileNotFound: 'File "{name}" non trovato.',
  errReadPastEnd: 'Lettura oltre la fine del file.', errInvalidFileMode: 'Operazione non consentita nella modalità del file aperto.',
  errFunctionReturnsNoValue: 'La funzione "{name}" non restituisce un valore.',
  errMissingReturnVariable: 'La variabile restituita dalla funzione "{name}" non è dichiarata.',
  errIdentifierInvalid: 'Identificatore non valido: "{name}".', errFunctionUndefined: 'Funzione non definita: "{name}".',
  errStepIsNegative: 'Il passo del ciclo Per deve essere positivo (usa la direzione decrescente).',
  errStepIsZero: 'Il passo del ciclo Per non può essere zero.', errOverflow: 'Valore fuori dall\'intervallo consentito (overflow).',
  errDivideByZero: 'Divisione per zero.', errModulusByZero: 'Modulo per zero.',
  errIllegalValue: 'Valore non valido "{value}" per il tipo {type}.', errNotArray: '"{name}" non è un array.',
  errBadSubscript: 'Indice {index} fuori dai limiti di "{name}".', errMissingSubscript: 'Manca l\'indice per l\'array "{name}".',
  errDuplicateDefinition: '"{name}" è già definito.', errVariableUndeclared: 'Variabile non dichiarata: "{name}".',
  errVariableUninitialized: 'La variabile "{name}" non è stata inizializzata.',
  errNegateTypeMismatch: 'Il segno meno si applica solo ai numeri.', errNotTypeMismatch: '"not" si applica solo ai valori Boolean.',
  errEqualityTypeMismatch: 'Impossibile confrontare valori di tipo diverso.', errCompareMismatch: 'Confronto tra tipi incompatibili.',
  errBooleanMismatch: 'È richiesta un\'espressione Boolean.', errMathMismatch: 'Operazione matematica su tipi non numerici.',
  errAssignTypeMismatch: 'Tipo del valore incompatibile con "{name}".', errSubscriptTypeMismatch: 'L\'indice deve essere un Integer.',
  errArgumentTypeMismatch: 'Tipo dell\'argomento {index} di "{name}" non valido.',
  errArgumentCountMismatch: '"{name}" richiede {expected} argomenti, ne sono stati passati {got}.',
  errSyntaxUnexpected: 'Errore di sintassi vicino a "{token}".', errSyntaxEnd: 'Espressione incompleta: "{text}".',
  errLexical: 'Carattere o simbolo non valido: "{text}".', errIncomplete: 'Il blocco evidenziato è incompleto.',
};

const en = {
  appName: 'OpenflowDiagram',
  untitled: 'Untitled',
  file: 'File', edit: 'Edit', program: 'Program', view: 'View', tools: 'Tools', help: 'Help',
  new: 'New', open: 'Open…', save: 'Save', saveAs: 'Save As…', recent: 'Recent', examples: 'Examples', print: 'Print…',
  exportPng: 'Export PNG image…', exportSvg: 'Export SVG image…', exit: 'Exit',
  undo: 'Undo', redo: 'Redo', cut: 'Cut', copy: 'Copy', paste: 'Paste', delete: 'Delete',
  insertShape: 'Insert shape…', insertShapeShort: 'Insert', editShape: 'Edit shape…', selectNone: 'Deselect',
  toggleDevTools: 'Developer tools',
  run: 'Run', step: 'Step', pause: 'Pause', stop: 'Stop', speed: 'Speed',
  speedSlow: 'Slow', speedMedium: 'Medium', speedFast: 'Fast', speedFull: 'Full',
  ignoreBreakpoints: 'Ignore breakpoints', removeBreakpoints: 'Remove all breakpoints',
  addFunction: 'Add function…', manageFunctions: 'Function manager…', attributes: 'Program attributes…',
  console: 'Console', variables: 'Variables', sourceCode: 'Source code',
  layout: 'Layout', layoutChart: 'Chart only', layoutConsole: 'Chart and console',
  layoutVariables: 'Chart, variables and console', layoutAll: 'All panels',
  zoomIn: 'Zoom in', zoomOut: 'Zoom out', zoomReset: 'Zoom 100%',
  colorScheme: 'Color scheme', chartStyle: 'Chart style', language: 'Language',
  settings: 'Settings…', about: 'About OpenflowDiagram', documentation: 'Quick guide', guide: 'Getting started guide',
  enterValue: 'Type a value and press Enter', send: 'Send', clear: 'Clear', chatBubbles: 'Bubbles',
  copyAll: 'Copy all', saveFile: 'Save to file…', lineNumbers: 'Line numbers', showStack: 'Show stack',
  uninitialized: '(uninitialized)', parameters: 'Parameters',
  noVariables: 'No variables. Run the program to see them here.',
  codeLanguage: 'Language',
  shape_declare: 'Declare', shape_assign: 'Assign', shape_input: 'Input', shape_output: 'Output',
  shape_if: 'If', shape_while: 'While', shape_for: 'For', shape_do: 'Do', shape_call: 'Call',
  shape_comment: 'Comment', shape_breakpoint: 'Breakpoint', shape_open: 'Open file',
  shape_close: 'Close file', shape_read: 'Read file', shape_write: 'Write file',
  groupBasic: 'Shapes', groupLoops: 'Loops', groupOther: 'Other', groupFiles: 'Files',
  fnPicker: 'Insert a function', fnSearch: 'Search a function…', fnGroupMath: 'Math', fnGroupText: 'Text',
  fnGroupConv: 'Conversions', fnGroupOther: 'Arrays and files', fnGroupUser: 'Your functions',
  fnNoValue: 'returns no value: use it with the Call shape', fnReturns: 'returns a {type}',
  fnNoMatch: 'No function found.', fnNoneDefined: 'The program has no functions yet: create one with the + button.',
  fn_abs: 'absolute value', fn_sqrt: 'square root', fn_int: 'integer part (drops the decimals)', fn_sgn: 'sign: -1, 0 or 1',
  fn_random: 'random integer from 0 to n-1', fn_log: 'natural logarithm', fn_log10: 'base-10 logarithm',
  fn_sin: 'sine (angle in radians)', fn_cos: 'cosine (angle in radians)', fn_tan: 'tangent (angle in radians)',
  fn_arcsin: 'arc sine', fn_arccos: 'arc cosine', fn_arctan: 'arc tangent', fn_pi: 'the constant π (3.14159…)',
  fn_len: 'number of characters', fn_char: 'character at position i (the first is 0)', fn_tocode: 'code of the first character',
  fn_tochar: 'character with code n', fn_tointeger: 'converts to Integer (also from text)', fn_toreal: 'converts to Real (also from text)',
  fn_tostring: 'converts to text', fn_tofixed: 'text with d decimal digits', fn_size: 'number of elements of the array',
  fn_eof: 'true when the file open for reading has ended',
  filesPanel: 'Files', fileRefresh: 'Refresh', fileOpenOther: 'Open…',
  fileViewerEmpty: 'The program uses no files. This panel shows the files used by the Open file, Read file and Write file shapes; with "Open…" you can view any text file.',
  fileStateRead: 'Open for reading · next line: {n}', fileStateReadEnd: 'Open for reading · end of file',
  fileStateWrite: 'Open for writing · {rows} (saved on close)', fileStateDisk: 'On disk · {rows}',
  oneLine: '1 line', nLines: '{n} lines',
  fileMissing: 'The file does not exist yet: it will be created when the program opens it for writing.',
  fileError: 'Cannot read the file.', fileEmpty: '(empty file)', fileTruncated: 'Only the first {n} lines are shown.',
  chartTab: 'Flowchart', traceTable: 'Trace table', traceShort: 'Trace', codeShort: 'Code', traceChoose: 'Choose values…', traceTitle: 'Values to trace',
  traceVariables: 'Variables', traceExpressions: 'Expressions and conditions', traceExprHint: 'Examples: i * 2   ·   n > 0   ·   x % 2 == 0   ·   Len(name)',
  traceAddExpr: 'Add expression', traceOutputCol: 'Show the Output column', traceOnlyChanges: 'Only rows with changes',
  traceExportPng: 'Export PNG', traceEmpty: 'Press Run or Step: the table fills in while the program runs.',
  traceNotConfigured: 'Choose the variables and conditions to follow to build the trace table.',
  traceStep: '#', traceFunction: 'Function', traceBlock: 'Shape', traceResult: 'Result', traceOutput: 'Output',
  traceLimit: 'Reached the limit of {n} rows: recording stopped.', traceRow: '1 row', traceRows: '{n} rows',
  traceNoUserCalls: 'Traced expressions cannot call program functions.',
  traceNothing: 'Choose at least one variable or expression to trace.', traceIn: 'in',
  start: 'Start', end: 'End', main: 'Main', returnWord: 'Return', trueWord: 'True', falseWord: 'False',
  incomplete: 'Incomplete shape',
  ok: 'OK', cancel: 'Cancel', close: 'Close', yes: 'Yes', no: 'No', add: 'Add', remove: 'Remove',
  moveUp: 'Up', moveDown: 'Down', import: 'Import…',
  variableName: 'Variable name', variableNames: 'Variable names (comma separated)', type: 'Type',
  isArray: 'Array', arraySize: 'Size', expression: 'Expression', condition: 'Condition',
  newline: 'New line', noNewline: 'Stay on the same line', start_: 'Start value', end_: 'End value', stepValue: 'Step',
  direction: 'Direction', increasing: 'Increasing', decreasing: 'Decreasing', commentText: 'Comment text',
  callText: 'Call (e.g. MyFunction(1, x))', always: 'Always stop', conditional: 'Stop only when the condition is true',
  fileName: 'File name', mode: 'Mode', modeRead: 'Read', modeWrite: 'Write',
  functionName: 'Function name', returnType: 'Return type', returnVariable: 'Return variable',
  none: 'None', parameterName: 'Parameter name', programName: 'Program name', authors: 'Authors',
  aboutProgram: 'Description', editFunction: 'Function', newFunction: 'New function',
  confirmDiscard: 'The program has unsaved changes. Do you want to save them?',
  deleteFunctionConfirm: 'Delete the function "{name}"?', invalidName: 'Invalid name: "{name}"',
  duplicateName: 'A function named "{name}" already exists', runtimeError: 'Runtime error',
  syntaxError: 'Error', programEnded: 'Program finished.', programStopped: 'Program stopped.',
  breakpointHit: 'Breakpoint reached', waitingInput: 'Waiting for input…', running: 'Running…',
  paused: 'Paused', ready: 'Ready', saved: 'Saved', functionsOf: 'Functions',
  importFunctions: 'Select the functions to import', noFunctionsToImport: 'The file has no functions to import.',
  mainProgram: 'Main program',
  breakpoint: 'Breakpoint', copied: 'Copied to clipboard', settingsTitle: 'Settings',
  maxStack: 'Maximum call depth', defaultCodeLanguage: 'Default code language',
  helpText: `<p><b>OpenflowDiagram</b> is a visual programming environment: you write programs as flowcharts.</p>
<ul>
<li>Click an <b>arrow</b> in the chart to insert a new shape.</li>
<li><b>Double-click</b> a shape to edit it; right-click to cut, copy or delete.</li>
<li>Use <b>Run</b> (F5) or <b>Step</b> (F10); values appear in the Console and Variables panels.</li>
<li>The <b>Source code</b> panel translates the chart into C, C++, Java or Python.</li>
<li>Types: Integer, Real, String, Boolean. Operators: + - * / % ^ &amp; == != &lt; &lt;= &gt; &gt;= and or not.</li>
<li>Functions: Abs, ArcCos, ArcSin, ArcTan, Char, Cos, EOF, Int, Len, Log, Log10, Random, Sgn, Sin, Size, Sqrt, Tan,
 ToChar, ToCode, ToFixed, ToInteger, ToReal, ToString. Constants: Pi, true, false.</li>
</ul>`,
  aboutText: 'A teaching environment for programming with flowcharts, with translation into C, C++, Java and Python.',
  errStackOverflow: 'Too many nested calls (stack overflow).',
  errFileAlreadyOpen: 'A file is already open.', errFileNotOpen: 'No file is open.',
  errCannotAccessFile: 'Cannot access the file "{name}".', errFileNotFound: 'File "{name}" not found.',
  errReadPastEnd: 'Read past the end of the file.', errInvalidFileMode: 'Operation not allowed in the open file\'s mode.',
  errFunctionReturnsNoValue: 'The function "{name}" does not return a value.',
  errMissingReturnVariable: 'The return variable of "{name}" is not declared.',
  errIdentifierInvalid: 'Invalid identifier: "{name}".', errFunctionUndefined: 'Undefined function: "{name}".',
  errStepIsNegative: 'The For step must be positive (use the decreasing direction).',
  errStepIsZero: 'The For step cannot be zero.', errOverflow: 'Value out of range (overflow).',
  errDivideByZero: 'Division by zero.', errModulusByZero: 'Modulus by zero.',
  errIllegalValue: 'Illegal value "{value}" for type {type}.', errNotArray: '"{name}" is not an array.',
  errBadSubscript: 'Index {index} is out of bounds for "{name}".', errMissingSubscript: 'Missing index for the array "{name}".',
  errDuplicateDefinition: '"{name}" is already defined.', errVariableUndeclared: 'Undeclared variable: "{name}".',
  errVariableUninitialized: 'The variable "{name}" has not been initialized.',
  errNegateTypeMismatch: 'Minus applies only to numbers.', errNotTypeMismatch: '"not" applies only to Boolean values.',
  errEqualityTypeMismatch: 'Cannot compare values of different types.', errCompareMismatch: 'Comparison between incompatible types.',
  errBooleanMismatch: 'A Boolean expression is required.', errMathMismatch: 'Math operation on non-numeric types.',
  errAssignTypeMismatch: 'Value type is incompatible with "{name}".', errSubscriptTypeMismatch: 'The index must be an Integer.',
  errArgumentTypeMismatch: 'Argument {index} of "{name}" has the wrong type.',
  errArgumentCountMismatch: '"{name}" needs {expected} arguments, {got} were given.',
  errSyntaxUnexpected: 'Syntax error near "{token}".', errSyntaxEnd: 'Incomplete expression: "{text}".',
  errLexical: 'Invalid character or symbol: "{text}".', errIncomplete: 'The highlighted shape is incomplete.',
};

export const LANGUAGES = { it: { name: 'Italiano', strings: it }, en: { name: 'English', strings: en } };

let current = it;

export function setLanguage(code) {
  current = (LANGUAGES[code] || LANGUAGES.it).strings;
}

export function t(key, params = {}) {
  const s = current[key] ?? en[key] ?? key;
  return s.replace(/\{(\w+)\}/g, (m, k) => (k in params ? String(params[k]) : m));
}

// Singular/plural: plural(1, 'oneLine', 'nLines') → "1 riga", plural(5, ...) → "5 righe".
export function plural(n, oneKey, manyKey) {
  return n === 1 ? t(oneKey) : t(manyKey, { n });
}

export function messages() {
  return current;
}
