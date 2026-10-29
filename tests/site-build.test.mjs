import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { buildSite, renderSite } from '../scripts/build-site.mjs';

const [xml, readme, template] = await Promise.all([
  readFile(new URL('../appinfo/info.xml', import.meta.url), 'utf8'),
  readFile(new URL('../README.en.md', import.meta.url), 'utf8'),
  readFile(new URL('../site/index.template.html', import.meta.url), 'utf8'),
]);
const inputs = { xml, readme, template };
const currentVersion = xml.match(/<version>([^<]+)<\/version>/)[1];
const currentMin = xml.match(/min-version="(\d+)"/)[1];
const currentMax = xml.match(/max-version="(\d+)"/)[1];
const ruleExample = readme.match(/```json\r?\n([\s\S]*?)\r?\n```/)[1];

test('the landing page inherits app version, compatibility and the real README matcher schema', () => {
  const { html, manifest } = renderSite(inputs);
  assert.equal(manifest.version, currentVersion);
  assert.deepEqual(manifest.nextcloud, { min: currentMin, max: currentMax });
  assert.ok(html.includes(`Nextcloud ${currentMin}–${currentMax}`));
  assert.ok(html.includes(`NextInject v${currentVersion}`));
  assert.ok(html.includes('&quot;type&quot;: &quot;substring&quot;'));
  assert.ok(html.includes('https://github.com/Yxanu/nextinject/releases/latest'));
  assert.equal(/{{[A-Z_]+}}|v2\.1\.1|through NC33|31, 32, or 33/.test(html), false);
  assert.equal(html.includes('osite Network'), false);
});

test('future metadata updates refresh every displayed version/range without editing HTML or old README copy', () => {
  const futureMax = String(Number(currentMax) + 1);
  const updated = renderSite({ ...inputs, xml: xml.replace(`<version>${currentVersion}</version>`, '<version>9.9.9</version>').replace(`max-version="${currentMax}"`, `max-version="${futureMax}"`) });
  assert.equal(updated.manifest.version, '9.9.9');
  assert.ok(updated.html.includes('NextInject v9.9.9'));
  assert.ok(updated.html.includes(`Nextcloud ${currentMin}–${futureMax}`));
  assert.ok(updated.html.includes(`Nextcloud ${currentMin} through ${futureMax}`));
  assert.equal(updated.html.includes(`Nextcloud ${currentMin}–${currentMax}`), false);
  assert.equal(updated.html.includes(`v${currentVersion}`), false);
  assert.notEqual(updated.manifest.buildId, renderSite(inputs).manifest.buildId);
});

test('README feature and rule changes reach the page while HTML in documentation stays inert', () => {
  const example = JSON.parse(ruleExample);
  example.matcher.value = '_CUSTOM';
  const docs = readme.replace(/(## Features\r?\n)/, '$1\n- <img src=x onerror=alert(1)> `safe-code` rules\n')
    .replace(ruleExample, JSON.stringify(example, null, 2));
  const { html } = renderSite({ ...inputs, readme: docs });
  assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt; <code>safe-code</code>'));
  assert.ok(html.includes('&quot;value&quot;: &quot;_CUSTOM&quot;'));
  assert.equal(html.includes('<img src=x'), false);
});

test('invalid or missing repository facts fail the build instead of publishing stale or broken content', () => {
  assert.throws(() => renderSite({ ...inputs, xml: xml.replace(`<version>${currentVersion}</version>`, '') }), /metadata/);
  assert.throws(() => renderSite({ ...inputs, xml: xml.replace(`max-version="${currentMax}"`, `max-version="${Number(currentMin) - 1}"`) }), /compatibility/);
  assert.throws(() => renderSite({ ...inputs, readme: readme.replace('## Features', '## Renamed') }), /section/);
  assert.throws(() => renderSite({ ...inputs, template: template + '{{UNKNOWN}}' }), /placeholder/);
  assert.throws(() => renderSite({ ...inputs, readme: readme.replace('"matcher": {', '"matcher": "_AN", "unused": {') }), /schema/);
});

test('the static output contains the rendered page, image and a reproducible public manifest', async () => {
  const output = await mkdtemp(join(tmpdir(), 'nextinject-site-'));
  try {
    const result = await buildSite({ output });
    assert.equal(await readFile(join(output, 'index.html'), 'utf8'), result.html);
    assert.deepEqual(JSON.parse(await readFile(join(output, 'site-manifest.json'), 'utf8')), result.manifest);
    assert.ok((await readFile(join(output, 'nextinject.png'))).length > 0);
    assert.equal(JSON.stringify(result.manifest).includes('/Users/'), false);
    assert.equal(renderSite(inputs).manifest.buildId, result.manifest.buildId);
  } finally {
    await rm(output, { recursive: true, force: true });
  }
});
