# AI Agent Instructions

Dieses Dokument dient als Leitfaden für KI-Agenten und Coding-Assistenten. Bitte lies diese Anweisungen sorgfältig durch, bevor du Code generierst oder änderst.

## 1. Projektkontext
Dies ist eine leichtgewichtige Web-App ("Vending Machine Locator"), die auf GitHub Pages gehostet wird. 
Sie zeigt spezifische POIs (aktuell Zigarettenautomaten) auf einer interaktiven Karte an, basierend auf dem aktuellen Kartenausschnitt oder dem GPS-Standort des Nutzers.

## 2. Tech-Stack
- **Bundler/Dev-Server:** Vite
- **Frontend:** Vanilla JavaScript, HTML5, CSS3
- **Karten-Bibliothek:** Leaflet.js
- **Datenquelle:** OpenStreetMap (Overpass API)

## 3. Architektur & Code-Richtlinien
- **Vanilla JS:** Verwende keine Frontend-Frameworks wie React, Vue oder Svelte. Bleibe bei modernem, modularem Vanilla JavaScript (ES6+).
- **Abhängigkeiten:** Halte die App so leichtgewichtig wie möglich. Installiere keine unnötigen npm-Pakete.
- **Fehlerbehandlung:** Die Overpass API und die Geolocation API können fehlschlagen (Timeouts, Blockaden, fehlende Rechte). Verwende immer sauberes Error-Handling (`try/catch`) und zeige dem Nutzer verständliche Fehlermeldungen in der UI (z. B. im `#status`-Element).
- **Sicherheit:** Benutzereingaben oder Daten von Drittanbieter-APIs (Overpass) müssen beim Einfügen ins DOM escaped werden, um XSS zu vermeiden (siehe `escapeHtml` in `main.js`).
- **Code-Hygiene & Artefakte:** Entferne aktiv ungenutzten Code, Assets oder veraltete Konfigurationen, sobald sie eindeutig nicht mehr benötigt werden und keine bestehende Funktionalität beeinträchtigen. Ziel ist es, das Projekt schlank und übersichtlich zu halten. Im Zweifelsfall, ob etwas entfernt werden kann, frage nach oder kommentiere es aus, anstatt es sofort zu löschen.
- **Dokumentation:** Halte die Dokumentation (z. B. `README.md`, `docs/`, Inline-Kommentare) stets aktuell. Wenn du Code schreibst, der bestehende Funktionen ändert oder neue hinzufügt, prüfe zwingend, ob die zugehörige Dokumentation angepasst werden muss, und setze diese Änderung direkt im selben Schritt um.



## 4. Git Workflow & Branching
Halte dich strikt an unseren Workflow (siehe `docs/BRANCHING.md`):
- **Niemals** direkt in den `main`-Branch committen. `main` ist die stabile Produktionsbasis für GitHub Pages.
- **Immer** den `development`-Branch auschecken und vorher pullen.
- Neue Funktionen kommen in Branches nach dem Muster `feature/<kurz-beschreibung>`.
- Fehlerbehebungen kommen in Branches nach dem Muster `bugfix/<kurz-beschreibung>`.
- Erstelle Pull Requests immer gegen den `development`-Branch.

## 5. Deployment / GitHub Pages
- Die App wird mit `npm run build` im Ordner `dist/` gebaut.
- Da sie auf GitHub Pages (in einem Unterordner) gehostet wird, sind absolute Pfade (`/`) bei Assets mit Vorsicht zu genießen. Der Base-Path in Vite ist entsprechend konfiguriert (`/vending-machine-locator/`).

## 6. Deine Rolle als Agent
- Denke Schritt für Schritt.
- Halte Dateien klein und fokussiert.
- Wenn du in `src/main.js` arbeitest, achte darauf, bestehende Referenzen wie `map` oder `markerLayer` nicht aus Versehen zu überschreiben.