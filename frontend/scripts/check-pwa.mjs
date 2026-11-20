// Checks the built app (dist/) is an installable PWA that caches only its own files.
// Run after `npm run build`: `npm run check:pwa`. Exits non-zero with every problem listed.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const problems = [];
const check = (ok, message) => ok || problems.push(message);

const manifestPath = join(dist, 'manifest.webmanifest');
check(existsSync(manifestPath), 'dist/manifest.webmanifest is missing');
if (existsSync(manifestPath)) {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  check(manifest.name === 'SquadMap', 'manifest name should be SquadMap');
  check(manifest.display === 'standalone', 'manifest display should be standalone');
  check(manifest.start_url === '/', 'manifest start_url should be /');
  const sizes = (purpose) =>
    manifest.icons.filter((icon) => (icon.purpose ?? 'any') === purpose).map((icon) => icon.sizes);
  check(sizes('any').includes('192x192'), 'a 192x192 icon is required');
  check(sizes('any').includes('512x512'), 'a 512x512 icon is required');
  check(sizes('maskable').includes('512x512'), 'a 512x512 maskable icon is required');
  for (const icon of manifest.icons) check(existsSync(join(dist, icon.src)), `icon ${icon.src} is missing`);
}
check(existsSync(join(dist, 'apple-touch-icon-180x180.png')), 'the Apple touch icon is missing');

const html = readFileSync(join(dist, 'index.html'), 'utf8');
check(html.includes('rel="manifest"'), 'index.html does not link the manifest');
check(html.includes('name="theme-color"'), 'index.html has no theme-color');

const swPath = join(dist, 'sw.js');
check(existsSync(swPath), 'dist/sw.js is missing');
if (existsSync(swPath)) {
  const urls = [...readFileSync(swPath, 'utf8').matchAll(/"url":"([^"]*)"/g)].map((match) => match[1]);
  check(urls.includes('index.html'), 'index.html is not precached');
  check(
    urls.some((url) => /^assets\/index-.*\.js$/.test(url)),
    'the app script is not precached',
  );
  check(new Set(urls).size === urls.length, 'some files are precached twice');
  // Trip and location data must never be cached on the phone.
  for (const url of urls) check(!/(^|\/)(api|ws)(\/|$)/.test(url), `server route ${url} is precached`);
}

if (problems.length > 0) {
  console.error(`PWA check failed:\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
console.log('PWA check passed: manifest, icons and service worker are in place; only app files are cached.');
