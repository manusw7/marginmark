# Confronto funzionale

Riferimento pubblico verificato il 26 ottobre 2026. Nessun accesso diretto all’installazione personale di Web Highlights.

## Fonti

- [Sito ufficiale](https://web-highlights.com/): evidenziatore, note, tag, segnalibri, esportazioni, lettura, flashcard, YouTube, AI.
- [Modalità e funzioni](https://www.web-highlights.com/docs/introduction/getting-started): disponibilità per modalità offline e cloud.
- [FAQ](https://www.web-highlights.com/faq): PDF locali e remoti, restrizioni, importazioni e impostazioni.
- [MDN: content script](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Content_scripts): limitazioni del lettore PDF nativo e delle pagine privilegiate.
- [MDN: file](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Working_with_files): elaborazione mediante applicazione nativa.
- [MDN: Native Messaging](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Native_messaging): protocollo, autorizzazioni e limite di 1 MB per risposta.

## Implementazione

| Funzione del riferimento | Marginmark 0.2.1 |
| --- | --- |
| Evidenziazioni web persistenti e multicolore | Implementate: sfondo e testo a contrasto, palette, scorciatoia e menu contestuale |
| Note su passaggi e pagine | Implementate; editor diretto nel riquadro, salvataggio automatico, Markdown con pulsanti di formattazione |
| Formattazione WYSIWYG originale | Non replicata |
| Tag e organizzazione | Tag, raccolte piatte e preferiti |
| Collezioni gerarchiche | Non implementate |
| Ricerca e filtri | Testo, note, URL, metadati, tag, raccolta e preferiti |
| Segnalibri e contenuto offline | Implementati; copia testuale |
| Lettore offline | Implementato; testo sicuro, senza layout originale |
| PDF locali e remoti | Lettore PDF.js dedicato, testo selezionabile |
| Ripristino delle evidenziazioni PDF | Implementato; pagina e citazione per i nuovi passaggi |
| Esportazione PDF con evidenziazioni | Rettangoli visivi, senza commenti o annotazioni modificabili |
| PDF scansionati / OCR | Non implementato |
| Esportazioni Markdown, HTML, PDF | Implementate; PDF tramite stampa o copia PDF evidenziata |
| Importazione Web Highlights | Implementata, con conservazione integrale dei record originali |
| Importazioni Kindle, Pocket, Weava, Diigo, segnalibri Firefox | Non implementate |
| Flashcard e ripasso | Implementazione locale essenziale; algoritmo proprio |
| Generazione AI, sintesi e chat | Non implementate |
| Evidenziazione immagini | Salvataggio del riferimento URL; niente annotazioni di aree o copia offline |
| YouTube | Selezione del testo visibile e riferimento al tempo del video |
| Estrazione automatica trascrizioni YouTube | Non implementata |
| Personalizzazione | Palette, colore predefinito e disattivazione per hostname |
| Outline, riordino manuale, trascinamento e toolbox avanzato | Non implementati; ordine originale importato quando presente |
| Cloud, account, condivisione remota, Notion, Capacities | Esclusi dall’architettura locale richiesta |
| App mobili e sincronizzazione dispositivi | Non implementate |

## Elementi verificabili solo nell’installazione originale

- Comportamento esatto della versione Firefox installata dall’utente.
- Scorciatoie personalizzate e impostazioni effettivamente abilitate.
- Fedeltà visiva di palette, pannelli e interazioni.
- Ripristino su tutte le pagine originali, soprattutto dopo modifiche del sito.
- Caratteristiche di eventuali PDF, documenti autenticati e trascrizioni non presenti nei dati forniti.

