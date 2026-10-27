import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { before, after, test } from 'node:test';
import { resolve } from 'node:path';

// Use an existing Playwright installation; no runtime/app dependency is added.
// PLAYWRIGHT_MODULE may be an absolute path to Playwright's index.mjs.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const runtime = await readFile(new URL('../js/injector.js', import.meta.url));
const styles = await readFile(new URL('../css/style.css', import.meta.url));
const evidenceDir = process.env.NEXTINJECT_EVIDENCE_DIR;
const rules = [
  { id: 'disabled', enabled: false, priority: 999, matcher: { value: '_AN' },
    surfaces: ['files', 'public'], badge: { key: 'hinweis', text: 'Disabled' } },
  ...[
    ['offer-pdf', '_AN.pdf', 'angebot', 'PDF-Angebot', 310],
    ['offer', '_AN', 'angebot', 'Angebot', 300],
    ['invoice', '_RE', 'rechnung', 'Rechnung', 200],
    ['delivery', '_LI', 'lieferung', 'Lieferung', 100],
  ].map(([id, value, preset, text, priority]) => ({
    id, priority, enabled: true, surfaces: ['files', 'public'],
    matcher: { value, caseSensitive: true }, badgePreset: preset,
    badge: { key: preset, className: `nextinject-badge--${preset}`, text, icon: '&' },
    headerAction: { enabled: true, label: text, variant: 'primary',
      url: `https://example.invalid/${id}?file={fileName}&context={contextLabel}` },
  })),
];

const modernRow = (name, metadata = true) => `<tr class="files-list__row" ${metadata ? `data-cy-files-list-row-name="${name}"` : ''}>
  <td><button class="files-list__row-name-link" type="button"><span class="files-list__row-name-text">${name.slice(0, -4)}</span><span class="files-list__row-name-extension">${name.slice(-4)}</span></button></td></tr>`;
const themeRow = (name, index) => `<div class="theme-row" data-nextinject-file-name="${name}" data-index="${index}">
  <button type="button">${name}</button><span data-nextinject-badge-host></span></div>`;

function fixture(url) {
  const share = url.searchParams.get('share') || 'Projekt';
  const theme = url.searchParams.has('theme');
  const authenticated = url.pathname.startsWith('/apps/files');
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>NextInject NC35 fixture</title>
  <link rel="stylesheet" href="/style.css"><style>
  body{font:16px system-ui;margin:24px;color:#202b37;background:#f6f8fa} #header,.header-end{display:flex;align-items:center;gap:20px}
  #header{justify-content:space-between}button,a{padding:10px}a{color:#125799}.theme-row,td{padding:10px;background:white}
  #viewer,#theme-preview{padding:24px;background:#e8f1ff;margin-top:20px}#feedback{padding:12px;overflow-wrap:anywhere}
  </style></head><body id="body-${authenticated ? 'user' : 'public'}">
  <header id="header"><div class="header-start"><h1 class="kunde-name">${share}</h1></div><div class="header-end">
    <div id="native-header-tools"><div><button id="header-primary-action">Herunterladen</button></div><div><button id="public-page-menu">Menü</button></div></div>
  </div></header><main id="content"><h2>Dateien</h2><aside><h2>README_AN</h2>Dieses Angebot enthält _AN-Hinweise.</aside>
  <table><tbody>${modernRow('Demo_AN.pdf')}${modernRow('Demo_AN.pdf', false)}${modernRow('Demo_RE.pdf')}
  <tr data-file="Alt_RE.pdf"><td class="filename"><span class="nametext">Alt_RE.pdf</span></td></tr></tbody></table>
  ${[0, 1, 2, 3].map((i) => themeRow('Thema_AN.pdf', i)).join('')}
  <div data-nextinject-file-name="Ignored_AN.pdf"><span>Kein Host</span></div></main>
  <nav aria-label="Teststeuerung">
    <button data-open="Demo_AN.pdf">Angebot öffnen</button><button data-open="Demo_RE.pdf">Rechnung öffnen</button>
    <button data-open="Briefing.pdf">Normale Datei öffnen</button><button data-open="Lieferung_LI.pdf">Lieferung öffnen</button>
    <button id="close">Viewer schließen</button><button id="replace">Inhalt ersetzen</button>
  </nav><div id="ProvenExpert_widgetbar_container" style="display:none">Kundenstimmen</div><output id="feedback"></output>
  <script>
    window.OC = {generateUrl: p => p};
    window.scanSchedules = 0;
    const originalTimeout = window.setTimeout.bind(window);
    window.setTimeout = (...args) => { window.scanSchedules++; return originalTimeout(...args); };
    window.updates = [];
    window.addEventListener('nextinject:updated', e => {
      window.updates.push(e.detail);
      // Deliberately mutate an external node to expose feedback/observer loops.
      document.querySelector('#feedback').textContent = JSON.stringify(e.detail);
    });
    function context(fileName) {
      window.dispatchEvent(new CustomEvent('nextinject:context-changed', {detail: {
        viewerOpen: fileName !== null, fileName, dir: '/', contextLabel: ${JSON.stringify(share)}
      }}));
    }
    document.querySelectorAll('[data-open]').forEach(button => button.addEventListener('click', () => {
      let viewer = document.querySelector('#viewer, #theme-preview');
      if (!viewer) { viewer = document.createElement('section'); viewer.id = ${JSON.stringify(theme ? 'theme-preview' : 'viewer')};
        viewer.innerHTML = '<h2 class="modal-header__name"></h2>'; document.body.append(viewer); }
      viewer.hidden = false; viewer.style.display = '';
      viewer.querySelector('h2').textContent = button.dataset.open;
      ${theme ? 'context(button.dataset.open);' : ''}
    }));
    document.querySelector('#close').addEventListener('click', () => {
      document.querySelector('#viewer, #theme-preview')?.remove(); ${theme ? 'context(null);' : ''}
    });
    document.querySelector('#replace').addEventListener('click', () => {
      const replacement = document.createElement('main'); replacement.id = 'content';
      replacement.innerHTML = ${JSON.stringify(`<h2>Neue Dateien</h2><table><tbody>${modernRow('Neu_RE.pdf')}</tbody></table>`)};
      document.querySelector('#content').replaceWith(replacement);
    });
  </script><script src="/injector.js"></script></body></html>`;
}

let browser, server, origin;
const requests = [];
before(async () => {
  server = createServer((req, res) => {
    requests.push({ method: req.method, url: req.url });
    const url = new URL(req.url, 'http://localhost');
    if (req.method !== 'GET') { res.writeHead(405).end(); return; }
    if (url.pathname === '/injector.js') { res.setHeader('Content-Type', 'text/javascript'); res.end(runtime); }
    else if (url.pathname === '/style.css') { res.setHeader('Content-Type', 'text/css'); res.end(styles); }
    else if (url.pathname.includes('/api/')) {
      const respond = () => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ rules, settings: { injectionDelay: 20 } })); };
      if (req.headers.referer?.includes('slow-config')) setTimeout(respond, 200);
      else respond();
    } else { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(fixture(url)); }
  }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) });
  console.log(`Browser: ${await browser.version()}; local synthetic fixture: ${origin}`);
  if (evidenceDir) await mkdir(evidenceDir, { recursive: true });
});
after(async () => {
  await browser?.close();
  if (server) await new Promise((done) => server.close(done));
  assert.equal(requests.some(({ method }) => method !== 'GET'), false, 'no transaction requests');
});

async function open(t, path = '/s/FIXTURE', beforeLoad) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 960 } });
  const errors = [], external = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', e => { if (['error', 'warning'].includes(e.type())) errors.push(e.text()); });
  await page.route('**/*', (route) => {
    if (new URL(route.request().url()).origin !== origin) { external.push(route.request().url()); return route.abort(); }
    return route.continue();
  });
  t.after(async () => {
    await page.close();
    assert.deepEqual(errors, [], 'no browser errors/warnings');
    assert.deepEqual(external, [], 'no external network or action calls');
  });
  if (beforeLoad) await page.addInitScript(beforeLoad);
  await page.goto(origin + path);
  await page.waitForFunction(() => window.updates.length > 0);
  assert.equal(await page.title(), 'NextInject NC35 fixture');
  assert.equal(new URL(page.url()).pathname, new URL(origin + path).pathname);
  assert.equal(await page.locator('#content h2').first().textContent(), 'Dateien');
  assert.equal(await page.locator('nextjs-portal, vite-error-overlay, #webpack-dev-server-client-overlay').count(), 0);
  return page;
}
async function last(page) { return page.evaluate(() => window.updates.at(-1)); }
async function active(page, preset) {
  await page.waitForFunction(p => (window.updates.at(-1).activeRule?.badgePreset || null) === p, preset);
}
async function settled(page) {
  await page.waitForTimeout(120);
  const count = await page.evaluate(() => window.updates.length);
  await page.waitForTimeout(200);
  assert.equal(await page.evaluate(() => window.updates.length), count, 'no notification/mutation loop');
}
async function screenshot(page, name) {
  if (evidenceDir) await page.screenshot({ path: resolve(evidenceDir, name), fullPage: true });
}

test('NC35 BUTTON names, split extension, duplicate names, legacy and all four explicit hosts share rule priorities', async t => {
  const page = await open(t);
  assert.equal(await page.locator('.files-list__row .nextinject-badge').count(), 3);
  assert.equal(await page.locator('tr[data-file] .nextinject-badge').count(), 1);
  assert.equal(await page.locator('[data-nextinject-badge-host] > .nextinject-badge').count(), 4);
  assert.equal(await page.locator('[data-nextinject-file-name="Ignored_AN.pdf"] .nextinject-badge').count(), 0);
  assert.equal(await page.locator('[data-nextinject-rule="offer-pdf"]').count(), 6);
  assert.equal(await page.locator('.files-list__row-name-extension + .nextinject-badge').count(), 3);
  assert.equal((await last(page)).badgeCount, 8);
  assert.equal(await page.locator('.files-list__row-name-text .nextinject-badge').count(), 0);
  await page.evaluate(() => { window.keptBadge = document.querySelector('.nextinject-badge');
    window.dispatchEvent(new CustomEvent('nextinject:context-changed', { detail: { reason: 'theme-render' } })); });
  await settled(page);
  assert.equal(await page.evaluate(() => window.keptBadge === document.querySelector('.nextinject-badge')), true);
  await screenshot(page, 'native-and-theme-badges-desktop.png');
  await page.setViewportSize({ width: 390, height: 844 });
  await screenshot(page, 'native-and-theme-badges-mobile.png');
});

test('nested header anchors support AN → RE → ordinary → closed and modern links', async t => {
  const page = await open(t);
  await page.getByRole('button', { name: 'Angebot öffnen', exact: true }).click();
  await active(page, 'angebot');
  assert.equal(await page.locator('.header-end > a.cta_AN').count(), 1);
  assert.equal(await page.locator('.header-end > a.cta_AN + #native-header-tools').count(), 1);
  await page.getByRole('button', { name: 'Rechnung öffnen', exact: true }).click();
  await active(page, 'rechnung');
  assert.equal(await page.locator('a.cta_AN').count(), 0);
  const href = await page.locator('a.cta_RE').getAttribute('href');
  assert.equal(new URL(href).searchParams.get('file'), 'Demo_RE.pdf');
  assert.equal(await page.locator('body.RE_open:not(.AN_open)').count(), 1);
  await screenshot(page, 'invoice-context.png');
  await page.getByRole('button', { name: 'Normale Datei öffnen', exact: true }).click();
  await active(page, null);
  assert.deepEqual((await last(page)).actions, []);
  assert.equal(await page.locator('a.cta_AN, a.cta_RE, .nextinject-public-actions').count(), 0);
  assert.equal(await page.locator('body.AN_open, body.RE_open, #header.gimmick_active').count(), 0);
  assert.equal(await page.locator('#ProvenExpert_widgetbar_container').evaluate(n => n.style.display), 'none');
  await page.getByRole('button', { name: 'Viewer schließen', exact: true }).click();
  await page.waitForFunction(() => window.updates.at(-1).context.viewerOpen === false);
  assert.deepEqual((await last(page)).actions, []);
  await page.getByRole('button', { name: 'Lieferung öffnen', exact: true }).click();
  await active(page, 'lieferung');
  assert.equal(await page.locator('.header-end > .nextinject-public-actions + #native-header-tools').count(), 1);
  await page.evaluate(() => {
    const end = document.createElement('div'); end.className = 'header-end';
    end.innerHTML = '<div id="new-tools"><div><button id="public-page-menu">Menü</button></div></div>';
    document.querySelector('.header-end').replaceWith(end);
  });
  await page.waitForFunction(() => document.querySelector('.header-end > .nextinject-public-actions + #new-tools'));
  await settled(page);
});

test('a native invoice and ordinary viewer outrank _AN share, directory and README; closing restores root context', async t => {
  const page = await open(t, '/s/FIXTURE?share=Projekt_AN&dir=/Projekt_AN');
  await active(page, 'angebot');
  await page.getByRole('button', { name: 'Rechnung öffnen', exact: true }).click();
  await active(page, 'rechnung');
  assert.equal((await last(page)).context.fileName, 'Demo_RE.pdf');
  assert.equal(await page.locator('a.cta_AN').count(), 0);
  await page.getByRole('button', { name: 'Normale Datei öffnen', exact: true }).click();
  await active(page, null);
  assert.deepEqual((await last(page)).actions, []);
  await page.getByRole('button', { name: 'Viewer schließen', exact: true }).click();
  await active(page, 'angebot');
  assert.equal((await last(page)).context.viewerOpen, false);
  assert.equal(new URL((await last(page)).actions[0].url).searchParams.get('file'), 'Projekt_AN');
});

test('observer survives #content replacement, row attributes and native viewer hidden/style changes', async t => {
  const page = await open(t);
  await page.getByRole('button', { name: 'Inhalt ersetzen', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('#content .nextinject-badge')?.dataset.nextinjectRule === 'invoice');
  assert.equal(await page.locator('#content .nextinject-badge').count(), 1);
  await page.evaluate(() => document.querySelector('#content tr').setAttribute('data-cy-files-list-row-name', 'Neu_AN.pdf'));
  await page.waitForFunction(() => document.querySelector('#content .nextinject-badge')?.dataset.nextinjectRule === 'offer-pdf');
  await page.getByRole('button', { name: 'Rechnung öffnen', exact: true }).click();
  await active(page, 'rechnung');
  await page.evaluate(() => { document.querySelector('#viewer').hidden = true; });
  await active(page, null);
  assert.equal(await page.locator('a.cta_RE').count(), 0);
  await page.evaluate(() => { document.querySelector('#viewer').hidden = false; });
  await active(page, 'rechnung');
  await page.evaluate(() => { document.querySelector('#viewer').style.display = 'none'; });
  await active(page, null);
  await settled(page);
});

test('theme event contract supplies viewer/dir/root context, supports duplicate host rename and prevents feedback loops', async t => {
  const page = await open(t, '/s/FIXTURE?theme');
  for (const [label, preset, filename] of [
    ['Angebot öffnen', 'angebot', 'Demo_AN.pdf'],
    ['Rechnung öffnen', 'rechnung', 'Demo_RE.pdf'],
    ['Normale Datei öffnen', null, 'Briefing.pdf'],
  ]) {
    await page.getByRole('button', { name: label, exact: true }).click();
    await active(page, preset);
    assert.equal((await last(page)).context.fileName, filename);
    assert.equal((await last(page)).context.viewerOpen, true);
    await settled(page);
  }
  assert.equal(await page.locator('a.cta_AN, a.cta_RE').count(), 0);
  await page.getByRole('button', { name: 'Viewer schließen', exact: true }).click();
  await page.waitForFunction(() => window.updates.at(-1).context.viewerOpen === false);
  assert.deepEqual((await last(page)).actions, []);
  await page.evaluate(() => document.querySelector('[data-index="0"]').dataset.nextinjectFileName = 'Neu_RE.pdf');
  await page.waitForFunction(() => document.querySelector('[data-index="0"] .nextinject-badge')?.dataset.nextinjectRule === 'invoice');
  assert.equal(await page.locator('[data-nextinject-badge-host] > .nextinject-badge').count(), 4);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('nextinject:context-changed', {
    detail: { viewerOpen: false, fileName: null, dir: '/Rechnung_RE', contextLabel: 'Parent_AN' },
  })));
  await active(page, 'rechnung');
  assert.equal((await last(page)).context.fileName, 'Rechnung_RE');
  // An open viewer with an unknown filename must not inherit a parent offer.
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('nextinject:context-changed', {
    detail: { viewerOpen: true, fileName: '', dir: '/Parent_AN', contextLabel: 'Parent_AN' },
  })));
  await active(page, null);
  assert.deepEqual((await last(page)).actions, []);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('nextinject:context-changed', { detail: { reset: true } })));
  await page.waitForFunction(() => window.updates.at(-1).context.viewerOpen === false);
  await settled(page);
});

test('history, back/forward and rescan-only events clear or preserve explicit context as documented', async t => {
  const page = await open(t, '/s/FIXTURE?theme');
  await page.getByRole('button', { name: 'Angebot öffnen', exact: true }).click();
  await active(page, 'angebot');
  const count = await page.evaluate(() => window.updates.length);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('nextinject:context-changed', { detail: { reason: 'theme-render' } })));
  await page.waitForFunction(n => window.updates.length > n, count);
  assert.equal((await last(page)).context.fileName, 'Demo_AN.pdf');
  await page.evaluate(() => history.pushState({}, '', '?dir=/Aktuell_RE'));
  await active(page, 'rechnung');
  assert.equal((await last(page)).context.viewerOpen, false);
  await page.goBack();
  await active(page, null);
  await page.goForward();
  await active(page, 'rechnung');
  await settled(page);
});

test('authenticated Files keeps native and explicit badges without public actions', async t => {
  const page = await open(t, '/apps/files');
  assert.equal((await last(page)).surface, 'files');
  assert.equal((await last(page)).context, null);
  assert.equal((await last(page)).badgeCount, 8);
  assert.equal(await page.locator('a.cta_AN, a.cta_RE, .nextinject-public-actions').count(), 0);
  await settled(page);
});

test('unrelated audio progress and theme animation mutations do not schedule scans', async t => {
  const page = await open(t);
  await settled(page);
  const before = await page.evaluate(() => window.scanSchedules);
  await page.evaluate(() => {
    const row = document.querySelector('[data-index="0"]');
    const progress = document.createElement('output'); progress.className = 'audio-progress'; row.append(progress);
    let ticks = 0;
    window.progressTimer = setInterval(() => {
      progress.textContent = '0:' + ticks++;
      row.style.setProperty('--progress', String(ticks));
      row.classList.toggle('playing', ticks % 2 === 0);
    }, 10);
  });
  await page.waitForTimeout(200);
  await page.evaluate(() => clearInterval(window.progressTimer));
  assert.equal(await page.evaluate(() => window.scanSchedules), before);
});

test('a theme viewer context sent during config loading is retained for the first configured scan', async t => {
  const page = await open(t, '/s/FIXTURE?theme&slow-config', () => {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(() => window.dispatchEvent(new CustomEvent('nextinject:context-changed', {
        detail: { viewerOpen: true, fileName: 'Early_RE.pdf', dir: '/Parent_AN', contextLabel: 'Root_AN' },
      })), 10);
    });
  });
  await active(page, 'rechnung');
  assert.equal((await last(page)).context.fileName, 'Early_RE.pdf');
  assert.equal(await page.locator('a.cta_AN').count(), 0);
  assert.equal(new URL((await last(page)).actions[0].url).searchParams.get('file'), 'Early_RE.pdf');
  await settled(page);
});

test('native BUTTON fallback and nested basename/extension keep badges outside filename text and remove obsolete badges', async t => {
  const page = await open(t);
  await page.evaluate(() => {
    const tbody = document.querySelector('#content tbody');
    const plain = document.createElement('tr'); plain.id = 'plain-button'; plain.className = 'files-list__row';
    plain.innerHTML = '<td class="filename"><button class="files-list__row-name-link">100%_RE.pdf</button></td>';
    const nested = document.createElement('tr'); nested.id = 'nested-name'; nested.className = 'files-list__row';
    nested.innerHTML = '<td><button class="files-list__row-name-link"><span class="files-list__row-name-text"><span class="files-list__row-name-">Kunde_AN</span><span class="files-list__row-name-extension">.pdf</span></span></button></td>';
    tbody.append(plain, nested);
  });
  await page.waitForFunction(() => document.querySelector('#nested-name .nextinject-badge'));
  assert.equal(await page.locator('#plain-button td > button + .nextinject-badge[data-nextinject-rule="invoice"]').count(), 1);
  assert.equal(await page.locator('#nested-name .files-list__row-name-text + .nextinject-badge[data-nextinject-rule="offer-pdf"]').count(), 1);
  await page.evaluate(() => { document.querySelector('#plain-button button').textContent = 'Neutral.pdf'; });
  await page.waitForFunction(() => !document.querySelector('#plain-button .nextinject-badge'));
  assert.equal(await page.locator('#plain-button .nextinject-runtime-match').count(), 0);
  await settled(page);
});
