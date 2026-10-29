import { createHash } from 'node:crypto';
import { mkdir, readFile, copyFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const escape = value => String(value).replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char]);
const inline = value => value.split(/(`[^`]+`)/g).map(part =>
  part.startsWith('`') && part.endsWith('`') ? `<code>${escape(part.slice(1, -1))}</code>` : escape(part),
).join('');

export function renderSite({ xml, readme, template }) {
  const field = name => {
    const value = xml.match(new RegExp(`<${name}\\b[^>]*>([^<]+)</${name}>`))?.[1]?.trim();
    if (!value) throw new Error(`Missing app metadata: ${name}`);
    return value;
  };
  const version = field('version');
  if (!/^\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/.test(version)) throw new Error('Invalid app version');
  const repository = field('repository').replace(/\.git$/, '');
  if (!/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+$/.test(repository)) throw new Error('Invalid repository URL');
  const dependency = xml.match(/<nextcloud\b[^>]*>/)?.[0] || '';
  const min = dependency.match(/min-version="(\d+)"/)?.[1];
  const max = dependency.match(/max-version="(\d+)"/)?.[1];
  if (!min || !max || Number(min) > Number(max)) throw new Error('Invalid Nextcloud compatibility range');
  const introduction = readme.split(/\r?\n\s*\r?\n/).find(paragraph => paragraph.startsWith('NextInject '));
  if (!introduction) throw new Error('Missing README introduction');
  const intro = introduction.replace(/\bNC\d+ through NC\d+\b/g, `Nextcloud ${min}–${max}`);
  const section = name => {
    const content = readme.match(new RegExp(`^## ${name}\\r?\\n([\\s\\S]*?)(?=^## |$(?![\\s\\S]))`, 'm'))?.[1];
    if (!content) throw new Error(`Missing README section: ${name}`);
    return content;
  };
  const features = [...section('Features').matchAll(/^- (.+)$/gm)].map(match => match[1].trim());
  if (features.length === 0) throw new Error('Missing README features');
  const example = section('Configuration').match(/```json\r?\n([\s\S]*?)\r?\n```/)?.[1];
  if (!example) throw new Error('Missing README rule example');
  const rule = JSON.parse(example);
  if (typeof rule.matcher?.value !== 'string' || !Array.isArray(rule.surfaces)) throw new Error('Invalid README rule schema');
  const buildId = createHash('sha256').update(JSON.stringify({ xml, readme, template })).digest('hex').slice(0, 16);
  const values = {
    VERSION: escape(version), NC_MIN: min, NC_MAX: max, BUILD_ID: buildId,
    DESCRIPTION: escape(intro.replace(/\s+/g, ' ').replace(/`/g, '')),
    INTRO: inline(intro.replace(/\s+/g, ' ')),
    RELEASE_URL: `${repository}/releases/latest`,
    LICENSE_URL: `${repository}/blob/main/LICENSE`, DOCS_URL: `${repository}/blob/main/README.en.md`,
    FEATURES: features.map(feature => `<li>${inline(feature)}</li>`).join('\n'),
    RULE_JSON: escape(JSON.stringify(rule, null, 2)),
  };
  const html = template.replace(/{{([A-Z_]+)}}/g, (_, key) => {
    if (!(key in values)) throw new Error(`Unknown site placeholder: ${key}`);
    return values[key];
  });
  return { html, manifest: { version, nextcloud: { min, max }, repository, releaseUrl: values.RELEASE_URL, buildId } };
}

export async function buildSite({ root = projectRoot, output = resolve(projectRoot, 'dist/site') } = {}) {
  const [xml, readme, template] = await Promise.all([
    readFile(resolve(root, 'appinfo/info.xml'), 'utf8'),
    readFile(resolve(root, 'README.en.md'), 'utf8'),
    readFile(resolve(root, 'site/index.template.html'), 'utf8'),
  ]);
  const result = renderSite({ xml, readme, template });
  await mkdir(output, { recursive: true });
  await Promise.all([
    writeFile(resolve(output, 'index.html'), result.html),
    writeFile(resolve(output, 'site-manifest.json'), JSON.stringify(result.manifest, null, 2) + '\n'),
    copyFile(resolve(root, 'nextinject.png'), resolve(output, 'nextinject.png')),
  ]);
  return result;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.length && !(args.length === 2 && args[0] === '--out')) throw new Error('Usage: node scripts/build-site.mjs [--out directory]');
  const result = await buildSite(args.length ? { output: resolve(args[1]) } : {});
  console.log(`Built NextInject ${result.manifest.version} site (${result.manifest.buildId})`);
}
