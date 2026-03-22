# NextInject

NextInject is a system-wide Nextcloud app for NC31/NC32. It marks files and public shares based on filename patterns and can add typed header actions to public shares.

## Status

- App ID: `nextinject`
- Namespace: `OCA\\NextInject`
- Target surfaces: `Files`, `Public Share`
- Configuration: admin-only, system-wide
- Arbitrary HTML injection is no longer supported

## Core features

- substring-based rules for file names and share names
- typed badge presets for `_AN`, `_RE`, `_LI`, and more
- public-share header actions such as `Confirm offer`
- JSON import/export for rules
- one-time legacy migration from:
  - `nextinject.admin_targets`
  - `elementinjector.admin_targets`
  - old user settings in `nextinject.targets` and `elementinjector.targets`

## Installation

1. Copy the app to `apps/nextinject`.
2. Set ownership and permissions for the web server.
3. Enable the app:

```bash
sudo -u www-data php occ app:enable nextinject
```

4. Open the admin UI:

`Settings -> Administration -> Additional settings -> NextInject`

## Default rules

The app ships with these presets:

| Marker | Badge | Public CTA |
| --- | --- | --- |
| `_AN` | Offer | `Confirm offer` |
| `_RE` | Invoice | `Report payment` |
| `_LI` | Delivery | none |

Additional presets such as `Order`, `Protocol`, and `Notice` can be added in the admin dashboard.

## Rule model

Each rule is stored as typed JSON:

```json
{
  "id": "angebot-an",
  "enabled": true,
  "label": "Offer",
  "matcher": {
    "type": "substring",
    "value": "_AN",
    "caseSensitive": true
  },
  "surfaces": ["files", "public"],
  "badgePreset": "angebot",
  "headerAction": {
    "enabled": true,
    "label": "Confirm offer",
    "url": "https://www.telefonansagen.de/kontakt/bestaetigen?kunde={contextLabel}",
    "variant": "primary"
  },
  "description": "Offer documents and related public shares",
  "priority": 300
}
```

Supported placeholders in `headerAction.url`:

- `{contextLabel}`
- `{fileName}`

## Admin API

All admin endpoints live below `/apps/nextinject/api/v1/admin/config`.

- `GET /apps/nextinject/api/v1/admin/config`
- `POST /apps/nextinject/api/v1/admin/config`
- `DELETE /apps/nextinject/api/v1/admin/config/{id}`
- `POST /apps/nextinject/api/v1/admin/config/reset`
- `POST /apps/nextinject/api/v1/admin/config/import`
- `GET /apps/nextinject/api/v1/admin/config/export`

Frontend read-only endpoint:

- `GET /apps/nextinject/api/v1/frontend/config`

## Migration

Migration runs automatically the first time the admin UI or frontend config is loaded.

- Existing HTML snippets are not copied 1:1.
- Legacy entries are mapped to safe badge presets and typed CTA actions.
- If no legacy data exists, NextInject starts with Telefonansagen defaults.

## Troubleshooting

### App does not appear

```bash
sudo -u www-data php occ app:disable nextinject
sudo -u www-data php occ app:enable nextinject
sudo -u www-data php occ maintenance:repair
```

### Admin UI does not load

- check the browser console for JS errors
- inspect requests to `/apps/nextinject/api/v1/admin/config`
- make sure `js/admin.js` and `css/style.css` are delivered

### Public-share buttons are missing

- verify the rule includes `public` in `surfaces`
- verify `headerAction` is enabled
- verify the share title or file names contain the configured marker

## Development

Syntax checks:

```bash
find appinfo lib templates -name '*.php' -print0 | xargs -0 -n1 php -l
node --check js/admin.js
node --check js/injector.js
```
