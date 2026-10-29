# NextInject

[English version](README.en.md)

NextInject ist eine kleine systemweite Nextcloud-App für NC31 bis NC35. Sie markiert Dateien und Public Shares anhand definierter Namensmuster mit typisierten Badges und kann passende Public-Share-Header-Aktionen einblenden.

Die Konfiguration ist admin-only, systemweit und ohne freies HTML. Regeln werden zentral in der Nextcloud-Administration gepflegt.

## Funktionen

- substring-basierte Regeln für Dateinamen, Share-Titel und Public-Share-Kontext
- Badge-Presets für `_AN`, `_RE`, `_LI` und weitere Marker
- optionale Public-Share-Header-Aktionen, z. B. `Angebot bestätigen`
- Import und Export der Regeln als JSON
- eigene Admin-Seite unter `Einstellungen -> Verwaltung -> NextInject`
- Legacy-Migration aus `nextinject.admin_targets`, `elementinjector.admin_targets` und alten User-Settings
- Theme-Kompatibilität für bestehende Public-Share-Styles wie `cta_AN`, `AN_open` und `gimmick_active`

## Kompatibilität

- Nextcloud: `31` bis `35` (ab NextInject `2.1.8`)
- App-ID: `nextinject`
- Namespace: `OCA\NextInject`
- Oberflächen: `Files`, `Public Share`
- Build-Artefakte `js/admin.js`, `css/admin.css`, `js/injector.js` und `css/style.css` werden mit versioniert, damit die App ohne Server-Build installierbar bleibt.

## Installation

1. Repository nach `apps/nextinject` kopieren.
2. Besitzer und Berechtigungen passend für den Webserver setzen.
3. App aktivieren oder aktualisieren:

```bash
php occ app:enable nextinject
php occ upgrade
```

4. Admin-Oberfläche öffnen:

```text
Einstellungen -> Verwaltung -> NextInject
```

## Konfiguration

Die App startet mit sicheren Standardregeln. Public-Share-Aktionen sind explizite Regelkonfiguration und werden nicht mehr als freies HTML gespeichert.

| Marker | Badge | Public-CTA |
| --- | --- | --- |
| `_AN` | Angebot | optional |
| `_RE` | Rechnung | optional |
| `_LI` | Lieferung | keine |

Unterstützte Platzhalter in `headerAction.url`:

- `{contextLabel}`
- `{fileName}`

Beispielregel:

```json
{
  "id": "angebot-an",
  "enabled": true,
  "label": "Angebot",
  "matcher": {
    "type": "substring",
    "value": "_AN",
    "caseSensitive": true
  },
  "surfaces": ["files", "public"],
  "badgePreset": "angebot",
  "headerAction": {
    "enabled": true,
    "label": "Angebot bestätigen",
    "url": "https://example.com/confirm?file={fileName}",
    "variant": "primary"
  },
  "description": "Angebots-Dokumente und Freigaben",
  "priority": 300
}
```

## API

Admin-Endpunkte liegen unter `/apps/nextinject/api/v1/admin/config` und erfordern Admin-Rechte.

- `GET /apps/nextinject/api/v1/admin/config`
- `POST /apps/nextinject/api/v1/admin/config`
- `DELETE /apps/nextinject/api/v1/admin/config/{id}`
- `POST /apps/nextinject/api/v1/admin/config/reset`
- `POST /apps/nextinject/api/v1/admin/config/import`
- `GET /apps/nextinject/api/v1/admin/config/export`

Frontend-Read-Only:

- `GET /apps/nextinject/api/v1/frontend/config`

## Theme-Adapter (ab 2.1.8)

Eigene Dateizeilen können explizit einen Dateinamen und einen leeren Badge-Host anbieten:

```html
<div class="file-row" data-nextinject-file-name="Projekt_AN.pdf">
  <button type="button">Projekt_AN.pdf</button>
  <span data-nextinject-badge-host></span>
</div>
```

NextInject fügt das Badge **in** den Host ein. Jede Zeile wird bedient, auch wenn dieselbe Datei in mehreren Tabs oder in der Sidebar vorkommt. Native und eigene Zeilen dürfen gleichzeitig existieren; die zentralen Regeln, Oberflächen, Presets und Prioritäten gelten für beide. Ohne Badge-Host bleibt eine eigene Zeile unberührt. Das Theme sollte den Host für NextInject reservieren und den übrigen Zeilenabstand selbst gestalten.

Das Theme meldet einen geöffneten Viewer auf `window`:

```js
window.dispatchEvent(new CustomEvent('nextinject:context-changed', {
  detail: { viewerOpen: true, fileName: file.name, dir: ctx.dir, contextLabel: ctx.title },
}));
```

Beim Schließen lautet `detail`:

```js
{ viewerOpen: false, fileName: null, dir: ctx.dir, contextLabel: ctx.title }
```

`dir` ist der bereits dekodierte aktuelle Ordnerpfad, `contextLabel` der stabile Share-Titel; beide sind optional. Ein geöffneter Viewer gewinnt immer gegen Ordner, Share-Titel und README. Ein leerer Dateiname bei offenem Viewer erzeugt keine Aktion. Ohne Viewer entscheidet der aktuelle Ordner, danach der Share-Titel. Ein `_AN`-Share kann daher nach dem Schließen wieder eine Share-Aktion bekommen.

Nach reinem Zeilen-Neuaufbau genügt `detail: { reason: 'theme-render' }`. Das fordert einen Scan und eine Rückmeldung an, ohne den Viewer-Kontext zu ändern. `detail: { reset: true }` gibt die Kontextwahl an die native Nextcloud-Erkennung zurück. History-Navigation sowie `popstate`/`hashchange` setzen den Theme-Kontext ebenfalls zurück. Ein Theme muss nach jedem eigenen Öffnen, Dateiwechsel und Schließen den neuen Zustand melden.

NextInject sendet nach der Aktualisierung `nextinject:updated` auf `window`:

```js
window.addEventListener('nextinject:updated', ({ detail }) => {
  const offerViewerOpen = detail.context?.viewerOpen === true
    && detail.activeRule?.badgePreset === 'angebot';
  // Angebotsbezogene Theme-Inhalte anhand von offerViewerOpen aktualisieren.
  // Gespiegelte Aktionslinks vollständig durch detail.actions ersetzen.
});
```

`detail` enthält:

- `surface`: `public` oder `files`
- `context`: bei Public Shares `{ contextLabel, dir, activeViewerTitle, fileName, tokens, viewerOpen }`, sonst `null`
- `activeRule`: `{ id, badgePreset }` oder `null`
- `actions`: konfigurierte Links als `{ label, url, variant }`, andernfalls `[]`; Platzhalter sind bereits URL-kodiert
- `badgeCount`: Anzahl aller eingefügten Badges, einschließlich mehrfach angezeigter Dateien

Das Event kommt beim ersten Scan, bei wirksamen Kontext-/Badge-Änderungen und als Antwort auf einen expliziten Scanwunsch. Unveränderte automatische Scans senden kein Event. Listener dürfen die eigene Ansicht aktualisieren; sie sollten daraus keinen erneuten `context-changed`-Aufruf erzeugen. Vor einem Viewerwechsel alte gespiegelte Aktionen sofort entfernen und neue nur aus der zur aktuellen Datei passenden Rückmeldung übernehmen. Links werden ausschließlich bereitgestellt, niemals automatisch aufgerufen.

## Migration

Die Migration läuft automatisch beim ersten Laden der Admin- oder Frontend-Konfiguration.

- Legacy-Einträge werden auf sichere Badge-Presets abgebildet.
- Bestehende HTML-Snippets werden nicht 1:1 übernommen.
- Header-Aktionen sollten nach der Migration explizit im Admin-UI geprüft werden.
- Wenn keine Legacy-Daten gefunden werden, startet NextInject mit den eingebauten Standardregeln.

## Entwicklung

### Projekt-Webseite

Die Landingpage unter [nextinject.tosa.io](https://nextinject.tosa.io/) wird aus diesem Repository gebaut. `appinfo/info.xml` liefert Version und Nextcloud-Kompatibilität; `README.en.md` liefert Einleitung, Funktionsliste und JSON-Regelbeispiel. Layout und weitere Webseitentexte stehen in `site/index.template.html`. Download- und Release-Links führen immer zum neuesten veröffentlichten GitHub-Release.

```bash
npm run build:site
```

Der Generator benötigt keine zusätzlichen Pakete und schreibt nach `dist/site/`, einschließlich `site-manifest.json` zur Deployment-Prüfung. Das Dockerfile führt denselben Build aus und liefert nur die erzeugten statischen Dateien über nginx aus. Es sind keine GitHub-API-Aufrufe im Browser, API-Tokens oder manuellen HTML-Kopien nötig. Coolify baut die Webseite von `main`; der GitHub-Push-Webhook muss aktiviert bleiben. Ein neues Release aktualisiert das bestehende Ziel des Latest-Release-Links automatisch. Die Nextcloud-App wird durch dieses Webseiten-Deployment nicht deployt.

### App-Entwicklung

```bash
npm install
npm run build
npm run lint
npm test
find appinfo lib templates -name '*.php' -print0 | xargs -0 -n1 php -l
```

Vor einem Release sollten die gebauten Dateien in `js/` und `css/` committed sein.

Gezielte DOM-/Browser-Regressionstests laufen mit einer vorhandenen Playwright-Installation gegen einen lokalen synthetischen Server:

```bash
# Falls Playwright nicht im Projekt verfügbar ist: absoluten Modulpfad setzen.
PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs PLAYWRIGHT_CHANNEL=chrome npm run test:browser
```

Ohne `PLAYWRIGHT_CHANNEL` wird Playwrights Chromium verwendet. Optional speichert `NEXTINJECT_EVIDENCE_DIR=/absolute/path` Screenshots. Die Tests verwenden synthetische Regeln, blockieren externe Browser-Aufrufe und prüfen ausschließlich lesende lokale Requests. Sie ersetzen keinen Smoke-Test auf einer echten Nextcloud-35/PHP-8.5-Installation. `js/injector.js` und `css/style.css` werden direkt ausgeliefert; Änderungen daran benötigen keinen Admin-Neubuild.

## Troubleshooting

### Admin-Seite bleibt leer

- Browser-Konsole auf JavaScript-Fehler prüfen.
- Sicherstellen, dass `js/admin.js` und `css/admin.css` ausgeliefert werden.
- Nach Updates Browser-Cache hart neu laden.

### Public-Share-Button fehlt

- Prüfen, ob die Regel `public` in `surfaces` enthält.
- Prüfen, ob `headerAction` aktiv ist.
- Prüfen, ob Share-Titel, Ordnerpfad oder Dateiname den Marker enthält.
- Bei Theme-Styles prüfen, ob `cta_AN`, `AN_open` und `gimmick_active` erwartet werden.

### Update auf 2.1.8 und Browser-Cache

Nach dem Austausch der App-Dateien `php occ upgrade` als Webserver-Benutzer ausführen und mit `php occ config:app:get nextinject installed_version` die Version `2.1.8` prüfen. Nextcloud 35 bildet den JavaScript-Versionshash aus den installierten App-Versionen; nur die Dateien oder `max-version` auszutauschen aktualisiert diesen Cache-Schlüssel nicht zuverlässig. Eine frisch geladene Share-Seite muss `injector.js?v=…` mit verändertem Hash referenzieren. Bereits offene Tabs benötigen einen Seiten-Reload. Es ist keine zusätzliche Cloud-spezifische Änderung an der Script-Einbindung nötig.

### App erscheint nicht

```bash
php occ app:disable nextinject
php occ app:enable nextinject
php occ maintenance:repair
```

## Lizenz

AGPL-3.0-or-later. Siehe [LICENSE](LICENSE).
