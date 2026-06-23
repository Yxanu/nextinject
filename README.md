# NextInject

[English version](README.en.md)

NextInject ist eine kleine systemweite Nextcloud-App für NC31 bis NC33. Sie markiert Dateien und Public Shares anhand definierter Namensmuster mit typisierten Badges und kann passende Public-Share-Header-Aktionen einblenden.

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

- Nextcloud: `31` bis `33`
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

## Migration

Die Migration läuft automatisch beim ersten Laden der Admin- oder Frontend-Konfiguration.

- Legacy-Einträge werden auf sichere Badge-Presets abgebildet.
- Bestehende HTML-Snippets werden nicht 1:1 übernommen.
- Header-Aktionen sollten nach der Migration explizit im Admin-UI geprüft werden.
- Wenn keine Legacy-Daten gefunden werden, startet NextInject mit den eingebauten Standardregeln.

## Entwicklung

```bash
npm install
npm run build
npm run lint
find appinfo lib templates -name '*.php' -print0 | xargs -0 -n1 php -l
```

Vor einem Release sollten die gebauten Dateien in `js/` und `css/` committed sein.

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

### App erscheint nicht

```bash
php occ app:disable nextinject
php occ app:enable nextinject
php occ maintenance:repair
```

## Lizenz

AGPL-3.0-or-later. Siehe [LICENSE](LICENSE).
