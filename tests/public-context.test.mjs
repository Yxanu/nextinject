import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

// Exercise the shipped, no-bundler runtime in a minimal read-only DOM fixture.
// Only this test VM exposes the class; production gains no test API or globals.
const source = readFileSync(new URL('../js/injector.js', import.meta.url), 'utf8');
const marker = 'const runtime = new NextInjectRuntime();';
assert.equal(source.split(marker).length, 2);
const fixtureSource = source.replace(marker, `globalThis.Runtime = NextInjectRuntime; ${marker}`);

function fixture({ shareName = '', ogTitle = '', title = 'Öffentliche Dateifreigabe - Dateien - telefonansagen.de',
  search = '?dir=/', viewerName, viewerVisible = true, viewerHasTitle = true, headerName = '', surface = 'public' } = {}) {
  const viewer = viewerName === undefined ? null : {
    offsetHeight: viewerVisible ? 800 : 0,
    querySelector: () => viewerHasTitle ? { textContent: viewerName } : null,
  };
  const nodes = {
    '.kunde-name': shareName ? { textContent: shareName } : null,
    'meta[property="og:title"]': ogTitle ? { getAttribute: () => ogTitle } : null,
    '#header .header-title': headerName ? { textContent: headerName } : null,
    '#viewer': viewer,
  };
  const document = { body: { id: surface === 'public' ? 'body-public' : 'body-user' }, title,
    readyState: 'loading', addEventListener() {}, querySelector: selector => nodes[selector] || null };
  const context = vm.createContext({ document, URLSearchParams, console,
    window: { location: { pathname: surface === 'public' ? '/index.php/s/FIXTURE' : '/apps/files', search },
      getComputedStyle: () => ({ display: viewerVisible ? 'block' : 'none', visibility: 'visible' }) } });
  vm.runInContext(fixtureSource, context);
  const runtime = new context.Runtime();
  return { runtime, document, nodes, viewer,
    read: () => JSON.parse(JSON.stringify(runtime.getPublicContext(runtime.getContextLabel()))) };
}
const offerRule = { matcher: { value: '_AN', caseSensitive: true } };
const invoiceRule = { matcher: { value: '_RE', caseSensitive: true } };

test('stable theme share name keeps the offer action after the viewer closes', () => {
  const f = fixture({ shareName: 'Muster_AN', title: 'Muster_AN.pdf - telefonansagen.de', viewerName: 'Muster_AN.pdf' });
  assert.equal(f.runtime.contextMatchesRule(f.read(), offerRule), true);
  f.nodes['#viewer'] = null;
  f.document.title = 'Öffentliche Dateifreigabe - Dateien - telefonansagen.de';
  assert.deepEqual(f.read(), { contextLabel: 'Muster_AN', dir: '/', activeViewerTitle: '', fileName: 'Muster_AN', tokens: ['Muster_AN'] });
  assert.equal(f.runtime.contextMatchesRule(f.read(), offerRule), true);
});
test('native share metadata works without the custom theme and outranks generic headings', () => {
  const f = fixture({ ogTitle: 'Muster_AN.pdf', headerName: 'Dateien' });
  assert.equal(f.read().contextLabel, 'Muster_AN.pdf');
  assert.equal(f.runtime.contextMatchesRule(f.read(), offerRule), true);
});
test('root share metadata supports both absent and root dir query', () => {
  for (const search of ['', '?dir=/', '?dir=%2F']) {
    assert.equal(fixture({ ogTitle: 'Muster_AN.pdf', search }).read().fileName, 'Muster_AN.pdf');
  }
});
test('the active invoice cannot inherit its offer parent action', () => {
  const f = fixture({ shareName: 'Projekt_AN', search: '?dir=/Projekt_AN', viewerName: 'Muster_RE.pdf' });
  assert.equal(f.runtime.contextMatchesRule(f.read(), offerRule), false);
  assert.equal(f.runtime.contextMatchesRule(f.read(), invoiceRule), true);
  assert.equal(f.read().contextLabel, 'Muster_RE.pdf');
});
test('an unclassified active file cannot inherit the root offer action', () => {
  const f = fixture({ shareName: 'Projekt_AN', viewerName: 'Briefing.pdf' });
  assert.equal(f.runtime.contextMatchesRule(f.read(), offerRule), false);
});
test('a closed hidden viewer cannot keep a stale offer action on an invoice share', () => {
  const f = fixture({ shareName: 'Muster_RE', viewerName: 'Muster_AN.pdf', viewerVisible: false });
  assert.equal(f.runtime.contextMatchesRule(f.read(), offerRule), false);
  assert.equal(f.runtime.contextMatchesRule(f.read(), invoiceRule), true);
});
test('visible NC34 viewer without a title node uses its current document title', () => {
  const f = fixture({ shareName: 'Projekt_AN', viewerName: '', viewerHasTitle: false, title: 'Muster_RE.pdf - telefonansagen.de' });
  assert.equal(f.runtime.contextMatchesRule(f.read(), offerRule), false);
  assert.equal(f.runtime.contextMatchesRule(f.read(), invoiceRule), true);
});
test('current directory outranks ancestors and the root share', () => {
  const f = fixture({ shareName: 'Projekt_AN', search: '?dir=%2FProjekt_AN%2FRechnung_RE' });
  assert.equal(f.runtime.contextMatchesRule(f.read(), offerRule), false);
  assert.equal(f.runtime.contextMatchesRule(f.read(), invoiceRule), true);
  assert.equal(f.read().fileName, 'Rechnung_RE');
});
test('a neutral child directory does not inherit its parent offer action', () => {
  const f = fixture({ shareName: 'Projekt_AN', search: '?dir=/Projekt_AN/Material' });
  assert.equal(f.runtime.contextMatchesRule(f.read(), offerRule), false);
});
test('literal percent names and encoded-looking text are decoded exactly once', () => {
  assert.equal(fixture({ search: '?dir=%2F100%25_AN' }).read().fileName, '100%_AN');
  assert.equal(fixture({ search: '?dir=%2F%252F_AN' }).read().fileName, '%2F_AN');
});
test('blank contexts produce no action tokens', () => {
  assert.deepEqual(fixture({ title: '', search: '' }).read().tokens, []);
});
test('legacy headers remain the fallback when no stable root name exists', () => {
  assert.equal(fixture({ headerName: 'Legacy_AN' }).read().fileName, 'Legacy_AN');
});
test('file names in action links are encoded, not inserted as additional query parameters', () => {
  const f = fixture({ shareName: 'A&B #1_AN.pdf' });
  const result = f.runtime.resolveActionUrl('https://example.com/confirm?kunde={contextLabel}&file={fileName}', f.read());
  const url = new URL(result);
  assert.equal(url.searchParams.get('kunde'), 'A&B #1_AN.pdf');
  assert.equal(url.searchParams.get('file'), 'A&B #1_AN.pdf');
  assert.equal([...url.searchParams.keys()].length, 2);
});
test('authenticated file-list labels are unaffected by public metadata', () => {
  assert.equal(fixture({ surface: 'files', shareName: 'Ignore_AN', ogTitle: 'Ignore_RE', headerName: 'Dateien' }).runtime.getContextLabel(), 'Dateien');
});
