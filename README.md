# NextInject

NextInject ist eine systemweite Nextcloud-App fuer NC31/NC32. Sie markiert Dateien und Public Shares anhand definierter Dateimuster mit typisierten Badges und optionalen Header-Aktionen.

## Status

- App-ID: `nextinject`
- Namespace: `OCA\\NextInject`
- Zieloberflaechen: `Files`, `Public Share`
- Konfiguration: nur Admins, systemweit
- Freies HTML wird nicht mehr unterstuetzt

## Kernfunktionen

- substring-basierte Regeln fuer Dateinamen oder Share-Namen
- Badge-Presets fuer `_AN`, `_RE`, `_LI` und weitere Marker
- Public-Share-Header-Aktionen wie `Angebot bestaetigen`
- Import/Export von Regeln als JSON
- einmalige Legacy-Migration aus:
  - `nextinject.admin_targets`
  - `elementinjector.admin_targets`
  - alten User-Settings unter `nextinject.targets` und `elementinjector.targets`

## Installation

1. App nach `apps/nextinject` kopieren.
2. Besitzer/Berechtigungen passend fuer den Webserver setzen.
3. App aktivieren:

```bash
sudo -u www-data php occ app:enable nextinject
```

4. Admin-Einstellungen aufrufen:

`Einstellungen -> Verwaltung -> Additional settings -> NextInject`

## Standardregeln

Die App liefert diese Presets direkt mit:

| Marker | Badge | Public-CTA |
| --- | --- | --- |
| `_AN` | Angebot | `Angebot bestaetigen` |
| `_RE` | Rechnung | `Zahlung mitteilen` |
| `_LI` | Lieferung | keine |

Weitere Presets wie `Bestellung`, `Protokoll` und `Hinweis` koennen im Admin-Dashboard hinzugefuegt werden.

## Regelmodell

Jede Regel wird als JSON mit typisierten Feldern gespeichert:

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
    "label": "Angebot bestaetigen",
    "url": "https://www.telefonansagen.de/kontakt/bestaetigen?kunde={contextLabel}",
    "variant": "primary"
  },
  "description": "Angebots-Dokumente und Freigaben",
  "priority": 300
}
```

Unterstuetzte Platzhalter in `headerAction.url`:

- `{contextLabel}`
- `{fileName}`

## Admin-API

Alle Admin-Endpunkte liegen unter `/apps/nextinject/api/v1/admin/config`.

- `GET /apps/nextinject/api/v1/admin/config`
- `POST /apps/nextinject/api/v1/admin/config`
- `DELETE /apps/nextinject/api/v1/admin/config/{id}`
- `POST /apps/nextinject/api/v1/admin/config/reset`
- `POST /apps/nextinject/api/v1/admin/config/import`
- `GET /apps/nextinject/api/v1/admin/config/export`

Frontend-Read-Only:

- `GET /apps/nextinject/api/v1/frontend/config`

## Migration

Die Migration laeuft automatisch beim ersten Laden der Admin- oder Frontend-Konfiguration.

- Bestehende HTML-Templates werden nicht 1:1 uebernommen.
- Legacy-Eintraege werden auf Badge-Presets und sichere CTA-Typen abgebildet.
- Wenn keine Legacy-Daten gefunden werden, startet NextInject mit TA-Defaults.

## Troubleshooting

### App erscheint nicht

```bash
sudo -u www-data php occ app:disable nextinject
sudo -u www-data php occ app:enable nextinject
sudo -u www-data php occ maintenance:repair
```

### Admin-UI laedt nicht

- Browser-Konsole auf JS-Fehler pruefen
- Netzwerkanfragen auf `/apps/nextinject/api/v1/admin/config` pruefen
- sicherstellen, dass `js/admin.js` und `css/style.css` ausgeliefert werden

### Public-Share-Buttons fehlen

- pruefen, ob die Regel `public` in `surfaces` enthaelt
- pruefen, ob `headerAction` aktiv ist
- pruefen, ob Share-Titel oder Dateinamen den Marker enthalten

## Entwicklung

Syntax-Checks:

```bash
find appinfo lib templates -name '*.php' -print0 | xargs -0 -n1 php -l
node --check js/admin.js
node --check js/injector.js
```
