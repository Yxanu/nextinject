# NextInject

[Deutsche Version](README.md)

NextInject is a small system-wide Nextcloud app for NC31 through NC35. It marks files and public shares based on configured filename patterns and can add matching public-share header actions.

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

- Nextcloud: `31` through `35` (since NextInject `2.1.8`)
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

## Theme adapter (since 2.1.8)

Custom file rows can opt in explicitly:

```html
<div class="file-row" data-nextinject-file-name="Project_AN.pdf">
  <button type="button">Project_AN.pdf</button>
  <span data-nextinject-badge-host></span>
</div>
```

NextInject inserts the badge **inside** the reserved host, using the same rules, surfaces, presets and priorities as native rows. Every row is handled, including repeated files in different tabs or sidebars. Native and custom rows can coexist. A custom row without a host is ignored. The theme controls spacing outside the host.

Signal an opened or changed viewer on `window`:

```js
window.dispatchEvent(new CustomEvent('nextinject:context-changed', {
  detail: { viewerOpen: true, fileName: file.name, dir: ctx.dir, contextLabel: ctx.title },
}));
```

On close, send `{ viewerOpen: false, fileName: null, dir: ctx.dir, contextLabel: ctx.title }`. The optional `dir` is the already decoded current folder path; `contextLabel` is the stable share title. An open viewer always takes precedence over folders, share metadata and README text. An open viewer with an empty filename produces no action. With no viewer, the current directory takes precedence over the root share, so closing a viewer on an `_AN` share may restore a share action.

After rebuilding rows, `detail: { reason: 'theme-render' }` requests a scan and response while preserving viewer context. `detail: { reset: true }` returns to native Nextcloud context detection. History navigation, `popstate` and `hashchange` also clear the explicit theme context. Themes must signal every open, file change and close.

Listen on `window` for `nextinject:updated` after the update:

```js
window.addEventListener('nextinject:updated', ({ detail }) => {
  const offerViewerOpen = detail.context?.viewerOpen === true
    && detail.activeRule?.badgePreset === 'angebot';
  // Update offer-only content; replace mirrored links using detail.actions.
});
```

The payload contains `surface` (`public`/`files`), `context` (`{ contextLabel, dir, activeViewerTitle, fileName, tokens, viewerOpen }` for public shares, otherwise `null`), `activeRule` (`{ id, badgePreset }` or `null`), `actions` (an array of `{ label, url, variant }` with URL-encoded placeholders, or `[]`), and `badgeCount` (including repeated files).

Events are emitted on the initial scan, effective context/badge changes and explicit scan requests. Unchanged automatic scans emit no event. Listeners may update their own UI, but should not echo updates into another context event. Clear mirrored actions immediately on viewer changes and accept new actions only from an update matching the current file. Links are provided without ever invoking them automatically.

## Migration

Migration runs automatically the first time the admin UI or frontend config is loaded.

- Legacy entries are mapped to safe badge presets.
- Existing HTML snippets are not copied 1:1.
- Header actions should be reviewed explicitly in the admin UI after migration.
- If no legacy data exists, NextInject starts with its built-in default rules.

## Development

### Project website

The landing page at [nextinject.tosa.io](https://nextinject.tosa.io/) is built from this repository. `appinfo/info.xml` supplies the version and supported Nextcloud range; this README supplies the introduction, feature list and JSON rule example. `site/index.template.html` controls the layout and remaining website copy. Release/download links always lead to the latest published GitHub release.

```bash
npm run build:site
```

The dependency-free generator writes `dist/site/`, including `site-manifest.json` for deployment verification. The Dockerfile runs the same generator in a build stage and serves only its static output with nginx. No runtime GitHub API requests, API tokens or manual HTML copies are needed. Coolify builds the website from `main`; its GitHub push webhook should remain enabled. Publishing a release updates the existing latest-release destination without editing the landing page. This website deployment does not deploy the Nextcloud app.

### App development

```bash
npm install
npm run build
npm run lint
npm test
find appinfo lib templates -name '*.php' -print0 | xargs -0 -n1 php -l
```

Before a release, commit the built files in `js/` and `css/`.

Run targeted DOM/browser regression tests against a local synthetic server using an existing Playwright installation:

```bash
# Set an absolute module path if Playwright is not available in this project.
PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs PLAYWRIGHT_CHANNEL=chrome npm run test:browser
```

Without `PLAYWRIGHT_CHANNEL`, Playwright uses Chromium. Optionally set `NEXTINJECT_EVIDENCE_DIR=/absolute/path` for screenshots. Tests use synthetic rules, block external browser requests and require local requests to be read-only. They do not replace a smoke test on a real Nextcloud 35/PHP 8.5 installation. `js/injector.js` and `css/style.css` are shipped directly; editing them does not require rebuilding the admin bundle.

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

### Updating to 2.1.8 and browser caching

After replacing app files, run `php occ upgrade` as the web-server user and confirm `2.1.8` with `php occ config:app:get nextinject installed_version`. Nextcloud 35 derives the JavaScript version hash from installed app versions; replacing files or changing only `max-version` does not reliably refresh that cache key. Fresh share HTML must reference `injector.js?v=…` with a changed hash. Already open tabs need a page reload. No cloud-specific script-loading override is required.

### App does not appear

```bash
php occ app:disable nextinject
php occ app:enable nextinject
php occ maintenance:repair
```

## License

AGPL-3.0-or-later. See [LICENSE](LICENSE).
