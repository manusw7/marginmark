# Modifiche

## 0.2.1 · 26 ottobre 2026

- Eliminazione immediata di evidenziazioni e pagine, senza popup di conferma.
- Copie precedenti nella cronologia e controlli sui conflitti mantenuti.

## 0.2.0 · 26 ottobre 2026

- Menu chiaro con barra di icone sopra il passaggio e riquadro nota sotto.
- Modifica diretta di tag, nota, colore e domanda flashcard.
- Salvataggio automatico e pulsanti per grassetto, corsivo, elenchi, codice e titoli Markdown.
- Copia del testo e della citazione Markdown. Nuovo permesso di sola scrittura negli appunti.
- Bozza mantenuta visibile in caso di conflitto. Chiusura bloccata finché le modifiche non sono salvate.
- Nessuna migrazione dei file nel vault.

## 0.1.2 · 26 ottobre 2026

- Rimozione diretta dal riquadro dell’evidenziazione, con conferma.
- Nota associata rimossa insieme al passaggio. Copia precedente nella cronologia.
- Rifiuto della rimozione se i file sono cambiati dopo l’apertura del riquadro.

## 0.1.1 · 26 ottobre 2026

### Correzioni

- Evidenziazioni web con sfondo pieno e testo a contrasto sui siti chiari e scuri.
- Palette colori opaca e leggibile, separata dal compositing delle evidenziazioni.
- Clic normale sui passaggi: anteprima della nota e accesso al suo editor.
- Apertura dell’editor sul passaggio scelto, anche quando la pagina contiene molte note.
- Selezione del testo e clic sui pulsanti della palette senza apertura accidentale di una nota.

### Compatibilità

- Nessuna migrazione dei dati richiesta.
- Su Firefox senza CSS Custom Highlight: fallback con rettangoli semitrasparenti.
- XPI non firmato. Caricamento temporaneo tramite `about:debugging`.

## 0.1.0 · 26 ottobre 2026

- Prima versione locale: web, PDF, note, tag, ricerca, raccolte e lettura offline.
- Importazione Web Highlights, file Obsidian e controllo dei conflitti.
