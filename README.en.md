# NextInject

[Deutsche Version](README.md)

NextInject is a small system-wide Nextcloud app for NC31 through NC33. It marks files and public shares based on configured filename patterns and can add matching public-share header actions.

Configuration is admin-only, system-wide, and does not allow arbitrary HTML. Rules are managed centrally in the Nextcloud administration area.

## Features

- substring-based rules for file names, share titles, and public-share context
- badge presets for `_AN`, `_RE`, `_LI`, and additional markers
- optional public-share header actions, for example `Confirm offer`
- JSON import and export for rule configuration
- dedicated admin page at `Settings -> Administration -> NextInject`
- legacy migration from `nextinject.admin_targets`, `elementinjector.admin_targets`, and old user settings
- theme compatibility for existing public-share styles such as `cta_AN`, `AN_open`, and `gimmick_active`

## Compatibility

- Nextcloud: `31` through `33`
- App ID: `nextinject`
- Namespace: `OCA\NextInject`
- Surfaces: `Files`, `Public Share`
- Built assets `js/admin.js`, `css/admin.css`, `js/injector.js`, and `css/style.css` are committed so the app can be installed without building on the server.

## Installation

1. Copy the repository to `apps/nextinject`.
2. Set ownership and permissions for the web server.
3. Enable or upgrade the app:

```bash
php occ app:enable nextinject
php occ upgrade
```

4. Open the admin UI:

```text
Settings -> Administration -> NextInject
```

## Configuration

The app starts with safe default rules. Public-share actions are explicit rule configuration and are no longer stored as arbitrary HTML.

| Marker | Badge | Public CTA |
| --- | --- | --- |
| `_AN` | Offer | optional |
| `_RE` | Invoice | optional |
| `_LI` | Delivery | none |

Supported placeholders in `headerAction.url`:

- `{contextLabel}`
- `{fileName}`

Example rule:

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
    "url": "https://example.com/confirm?file={fileName}",
    "variant": "primary"
  },
  "description": "Offer documents and related public shares",
  "priority": 300
}
```

## API

Admin endpoints live below `/apps/nextinject/api/v1/admin/config` and require admin permissions.

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

- Legacy entries are mapped to safe badge presets.
- Existing HTML snippets are not copied 1:1.
- Header actions should be reviewed explicitly in the admin UI after migration.
- If no legacy data exists, NextInject starts with its built-in default rules.

## Development

```bash
npm install
npm run build
npm run lint
find appinfo lib templates -name '*.php' -print0 | xargs -0 -n1 php -l
```

Before a release, commit the built files in `js/` and `css/`.

## Troubleshooting

### Admin page is blank

- Check the browser console for JavaScript errors.
- Make sure `js/admin.js` and `css/admin.css` are delivered.
- Hard-refresh the browser cache after updates.

### Public-share button is missing

- Verify the rule includes `public` in `surfaces`.
- Verify `headerAction` is enabled.
- Verify the share title, folder path, or file name contains the marker.
- For theme styles, check whether `cta_AN`, `AN_open`, and `gimmick_active` are expected.

### App does not appear

```bash
php occ app:disable nextinject
php occ app:enable nextinject
php occ maintenance:repair
```

## License

AGPL-3.0-or-later. See [LICENSE](LICENSE).
