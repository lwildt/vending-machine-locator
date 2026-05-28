# Branching-Konventionen

Ziel: klarer Fluss für Feature- und Bugfix-Entwicklung.

- `main`: stabile Produktionsbasis
- `development`: Integration aller fertigen Features/Bugfixes
- Feature-Branches: `feature/<kurz-beschreibung>`
- Bugfix-Branches: `bugfix/<kurz-beschreibung>`

Workflow:

1. Always branch from `development` for new work.
2. Keep branches small and focused.
3. Open a Pull Request into `development` when ready.
4. After review and CI, merge into `development`.
5. Periodically merge `development` into `main` for releases.
