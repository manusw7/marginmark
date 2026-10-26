# Verifiche

Data: 26 ottobre 2026. Sistema: Linux. Browser di test: Firefox 158.0.1.

## Esito

- 10 test Python superati.
- 4 test JavaScript sulle ancore testuali superati.
- Flussi end-to-end superati in Firefox reale, profilo headless separato.
- Validatore WebExtension: 0 errori, 0 avvisi, 0 notifiche.
- `npm audit --omit=dev`: nessuna vulnerabilità segnalata nelle dipendenze runtime al momento della verifica.
- Ispezione visiva degli screenshot: evidenziatore web, libreria, lettore PDF con pannello note.

## Flussi Firefox verificati

- Collegamento dell’estensione al componente Python tramite Native Messaging.
- Selezione web, Alt+S, creazione del record e successiva riapertura.
- Modifica di note e tag, salvataggio e riapertura del modulo.
- Modifica Markdown esterna con modulo aperto: salvataggio rifiutato, bozza mantenuta.
- Rimozione di un passaggio e conservazione delle note personali Obsidian.
- Ripristino visivo web dopo il caricamento della pagina.
- Rendering PDF, selezione testuale, salvataggio delle coordinate e ripristino dopo il reload.
- Esportazione PDF evidenziato e navigazione tra pagine.
- Selezione di un PDF locale, copia nel vault e riapertura mediante il componente nativo.
- Ricerca nella libreria.
- Lettore offline, selezione e salvataggio di un nuovo passaggio.
- Flashcard locale: domanda, risposta, valutazione e scadenza persistita.
- Importazione JSON dal browser, ripetizione senza duplicati.
- Record superiore a 1 MB: ricomposizione delle risposte native suddivise in blocchi.
- Rifiuto di operazioni RPC privilegiate da un normale content script.
- Eliminazione della pagina con PDF aperto: rimozione delle evidenziazioni visive e creazione successiva di un nuovo passaggio.

## Test su filesystem e protocollo

- CRUD e apertura da una nuova istanza di `Store`.
- Revisioni obsolete rifiutate.
- Modifiche nella sezione personale Markdown conservate.
- Modifiche nella sezione generata rilevate e non sovrascritte.
- JSON modificato esternamente riletto; JSON malformato preservato.
- Relazioni originali, note HTML, campi sconosciuti e contenuti salvati conservati.
- Ordine originale dei passaggi applicato.
- ID con traversal e URL eseguibili rifiutati.
- Ricerca su note e paginazione.
- PDF locali: blocchi ordinati, checksum, riapertura, rifiuto di file non PDF.
- Messaggi nativi troncati rilevati.
- Citazioni con spazi normalizzati e Unicode.
- Passaggi ambigui o mancanti: nessuna scelta arbitraria.

## Non verificato

- Installazione temporanea nel profilo Firefox personale dell’utente: da eseguire con i passaggi del README.
- Firma AMO e installazione permanente dopo il riavvio di Firefox.
- Ripristino su tutte le pagine remote dopo modifiche al sito.
- Fedeltà delle interazioni rispetto all’estensione originale installata.
- Scorciatoia globale con focus fuori dalla pagina, menu contestuale e pannello laterale nativo in un profilo personale.
- Dialogo di stampa, esportazioni HTML/Markdown scaricate e flussi con siti autenticati.
- YouTube e riferimenti a immagini su siti reali.
- PDF cifrati, ruotati, documenti molto grandi e scritture esterne simultanee al singolo rename.
- Versioni Firefox diverse dalla 158.0.1.
- Funzioni mancanti elencate nel confronto: nessuna parità completa dichiarata.

## Correzioni 0.1.1

- Causa riprodotta: compositing `multiply` sul contenitore, applicato anche alla palette.
- Sito scuro di prova, con grassetto, codice e CSS globali sui pulsanti.
- Passaggi importati: registrazione nel CSS Highlight Registry; sfondo giallo con testo nero e sfondo scuro con testo bianco.
- Palette: sfondo opaco, quattro colori leggibili, creazione del passaggio tramite clic sul colore.
- Clic normale: anteprima della nota salvata, anche su un link evidenziato senza navigazione accidentale.
- Selezione di nuovo testo: palette visibile, anteprima della nota chiusa.
- Editor: parametro del passaggio nella URL, scorrimento e focus sul passaggio richiesto fra più note della stessa pagina.
- Test in profilo, host e vault temporanei. Nessuna scrittura nei dati reali.
- Screenshot: `.test-artifacts/dark-highlight.png` e `.test-artifacts/dark-palette.png`.
- Limite: controllo su sito di prova in Firefox 158.0.1. Nessun test sulle esatte pagine mostrate dall’utente o sul fallback per Firefox senza CSS Custom Highlight.

## Rimozione dal riquadro · 0.1.2

- Pulsante **Elimina evidenziazione** con conferma.
- Annullamento: passaggio ancora presente.
- Conferma: rimozione dal testo e dal record, persistente dopo il reload.
- Altri passaggi della pagina conservati.
- Revisione obsoleta: rimozione rifiutata, richiesta di ricaricare la pagina.
- Nuovo tentativo dopo il reload: rimozione consentita, note personali esterne conservate.
- Copie precedenti gestite dalla cronologia esistente.

## Menu ed editor diretto · 0.2.0

- Barra compatta, nota e tag verificati visivamente su pagina scura.
- Nota e tag modificati nel riquadro e riletti nell’editor della libreria.
- Formattazione Markdown persistita, con selezione del testo preservata.
- Cambio del colore: aggiornamento visivo e persistenza.
- Domanda flashcard: salvataggio automatico nel record.
- Copia del testo e della citazione Markdown: scrittura negli appunti riuscita. Nessuna lettura degli appunti.
- Conflitto simulato: nessuna sovrascrittura esterna; bozza visibile e chiusura rifiutata.
- Digitazione durante una scrittura rallentata nel test: entrambe le modifiche conservate.
- Conferma e annullamento dell’eliminazione ancora funzionanti.
- Flussi web, PDF, lettura e importazione precedenti superati.
- Limiti: editor Markdown, senza rendering WYSIWYG; verifica nel profilo di prova Firefox 158.0.1.

## Eliminazione immediata · 0.2.1

- Rimozione senza dialogo di conferma.
- Test del rifiuto delle revisioni obsolete e della persistenza dopo il reload.
- Copie precedenti nella cronologia esistente.
