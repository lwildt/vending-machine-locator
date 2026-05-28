# Vending Machine Locator

Kurzanleitung zum lokalen Entwickeln und zur Projektstruktur.

## Voraussetzungen
- Node.js (LTS, z.B. >= 18)
- npm (wird mit Node installiert)

## Lokales Setup
1. Abhängigkeiten installieren:

```powershell
npm install
```

2. Dev-Server starten:

```powershell
npm run dev
```

Die App wird standardmäßig unter `http://localhost:5173/vending-machine-locator/` erreichbar sein.

Hinweis: Unter PowerShell kann das direkte Ausführen von `npm`-PowerShell-Skripten durch die ExecutionPolicy blockiert werden; nutze nötigenfalls `npm.cmd` oder öffne eine neue Konsole.

## Branching-Workflow
- Basis-Branch: `main`
- Entwicklungs-Branch: `development` (Feature- und Bugfix-Branches werden von `development` erstellt)
- Temporäre Branches: `feature/xyz`, `bugfix/xyz` — nach Fertigstellung zurück in `development` mergen

Beispiel:

```bash
git checkout development
git checkout -b feature/awesome
# arbeiten, committen
git push -u origin feature/awesome
# PR nach development
```

## Build & Preview

```powershell
npm run build
npm run preview
```

## Weitere Dokumentation
Siehe `docs/` für CONTRIBUTING und Branching-Konventionen.

## Kontakt
Öffne Issues oder PRs gegen `development`.
# vending-machine-locator