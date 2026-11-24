/**
 * Records the README's demo: the real app on this computer, in two phone-sized windows. Priya (light theme)
 * hosts a trip; Aman (dark theme) joins by its link as a guest. Their locations are made up.
 *
 *   node scripts/record-demo.mjs          # needs the stack running (make up, make backend, make frontend)
 *
 * Writes docs/media/: demo.gif and a few still screens. Long waits are cut and the drive is sped up.
 * It creates one throwaway account and one trip in the local database, and ends the trip.
 */
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
// Comes with @vite-pwa/assets-generator, which also draws the app's icons with it.
import sharp from 'sharp';

const WEB = process.env.WEB ?? 'http://localhost:5480';
const OUT = fileURLToPath(new URL('../../docs/media/', import.meta.url));
const PHONE = { width: 390, height: 844 };
/** Each phone in the clip, after scaling down. */
const SHOWN = { width: 320, height: 692 };
const GAP = 24;
const FRAME_MS = 200;
/** Slower than the server's limit (70 m/s), which refuses impossible jumps. */
const METRES_PER_SECOND = 40;

const PRIYA_START = { latitude: 18.5478, longitude: 73.9105 };
const AMAN_START = { latitude: 18.5765, longitude: 73.9125 };

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

/** Polyline6 to [{ latitude, longitude }]. */
function decode(line) {
  const points = [];
  const at = [0, 0];
  for (let i = 0; i < line.length;) {
    for (const axis of [0, 1]) {
      let value = 0;
      let shift = 0;
      let byte;
      do {
        byte = line.charCodeAt(i++) - 63;
        value |= (byte & 31) << shift;
        shift += 5;
      } while (byte >= 32);
      at[axis] += value & 1 ? ~(value >> 1) : value >> 1;
    }
    points.push({ latitude: at[0] / 1e6, longitude: at[1] / 1e6 });
  }
  return points;
}

function metres(a, b) {
  const north = (b.latitude - a.latitude) * 111_320;
  const east = (b.longitude - a.longitude) * 111_320 * Math.cos((a.latitude * Math.PI) / 180);
  return Math.hypot(north, east);
}

/** Where someone is after driving this far along the route. */
function along(route, distance) {
  let left = distance;
  for (let i = 1; i < route.length; i++) {
    const step = metres(route[i - 1], route[i]);
    if (step > left) {
      const part = left / step;
      return {
        latitude: route[i - 1].latitude + (route[i].latitude - route[i - 1].latitude) * part,
        longitude: route[i - 1].longitude + (route[i].longitude - route[i - 1].longitude) * part,
      };
    }
    left -= step;
  }
  return route.at(-1);
}

const length = (route) => route.slice(1).reduce((sum, point, i) => sum + metres(route[i], point), 0);

const browser = await chromium.launch({
  channel: 'chromium',
  args: ['--enable-gpu', '--ignore-gpu-blocklist'],
});

async function phone(colorScheme, start) {
  const context = await browser.newContext({
    viewport: PHONE,
    hasTouch: true,
    colorScheme,
    locale: 'en-IN',
    timezoneId: 'Asia/Kolkata',
    baseURL: WEB,
    geolocation: { ...start, accuracy: 8 },
    permissions: ['geolocation'],
  });
  const page = await context.newPage();
  const it = { context, page, token: null };
  page.on('request', (request) => {
    const header = request.headers().authorization;
    if (header && request.url().includes('/api/v1/')) it.token = header;
  });
  page.on('pageerror', (error) => console.warn('page error:', error.message));
  return it;
}

const priya = await phone('light', PRIYA_START);
const aman = await phone('dark', AMAN_START);

const moveTo = (who, spot) => who.context.setGeolocation({ ...spot, accuracy: 8 });

async function read(path) {
  const response = await fetch(`${WEB}/api/v1${path}`, { headers: { authorization: priya.token } });
  return response.json();
}

/* ---- Recording ------------------------------------------------------------------------------- */

const frames = [];

/** Records while `work` runs; `speed` 2 plays it back twice as fast. `tail` holds the last picture. */
async function record(work, { speed = 1, tail = 800 } = {}) {
  const run = { on: true };
  const recording = (async () => {
    let last = null;
    while (run.on) {
      const started = Date.now();
      const [left, right] = await Promise.all(
        [priya, aman].map((who) => who.page.screenshot({ type: 'png', caret: 'initial' })),
      );
      if (last) last.ms = Math.round((started - last.at) / speed);
      last = { left, right, at: started, ms: FRAME_MS };
      frames.push(last);
      await sleep(Math.max(0, FRAME_MS * speed - (Date.now() - started)));
    }
  })();
  await work();
  await sleep(tail * speed);
  run.on = false;
  await recording;
}

async function still(name, page) {
  await sleep(1_200);
  await page.screenshot({ path: `${OUT}${name}.png`, scale: 'css' });
}

/* ---- The story ------------------------------------------------------------------------------- */

await mkdir(OUT, { recursive: true });
const p = priya.page;
const a = aman.page;

// Off camera: Priya's account.
await p.goto('/signup');
await p.getByLabel('Name').fill('Priya');
await p.getByLabel('Email').fill(`demo-${Date.now()}@example.com`);
await p.getByLabel('Password', { exact: true }).fill(`Kite-7 Rivermoon ${Date.now()}`);
await p.getByRole('checkbox').check();
await p.getByRole('button', { name: 'Create account' }).click();
await p.getByRole('link', { name: 'Your profile, Priya' }).waitFor();
await a.goto('/');
await sleep(4_000);

console.log('1. Priya plans a trip');
await record(
  async () => {
    await sleep(900);
    await p.getByRole('link', { name: 'New trip' }).click();
    await p.getByLabel('Search for a place').pressSequentially('Phoenix Marketcity Pune', { delay: 45 });
    const place = p.getByRole('list', { name: 'Places found' }).getByRole('button').first();
    await place.waitFor();
    await sleep(700);
    await place.click();
    await p.getByRole('button', { name: 'Create trip and invite' }).waitFor();
    await sleep(1_500);
    await p.getByRole('button', { name: 'Create trip and invite' }).click();
    await p.getByRole('heading', { name: 'Trip is live' }).waitFor();
    await sleep(1_200);
  },
  { speed: 1.6 },
);
await still('invite', p);
const tripId = p.url().match(/trip\/([^/]+)\/invite/)[1];
const trip = await read(`/trips/${tripId}`);

// Off camera: the invite link loads.
await a.goto(`/join/${trip.code}`);
await a.getByText('Priya invited you to').waitFor();

console.log('2. Aman joins by link');
await record(
  async () => {
    await sleep(700);
    await a.getByLabel('Your name').pressSequentially('Aman', { delay: 90 });
    await a.getByRole('button', { name: 'Continue' }).click();
    await a.getByRole('button', { name: 'Share my location' }).waitFor();
    await sleep(1_200);
    await p.getByRole('link', { name: 'Open live map' }).click();
    await a.getByRole('button', { name: 'Share my location' }).click();
    await p.getByRole('button', { name: 'Share my location' }).click();
    await p.getByText('How are you travelling?').waitFor();
    await a.getByText('How are you travelling?').waitFor();
    await sleep(1_500);
    await p.getByText('Car', { exact: true }).click();
    await a.getByText('Car', { exact: true }).click();
    await sleep(1_500);
  },
  { speed: 1.5 },
);

/** Both people's routes, as the app's own directions give them. */
async function routes() {
  for (let attempt = 0; attempt < 20; attempt++) {
    const members = await read(`/trips/${tripId}/members`);
    const etas = await read(`/trips/${tripId}/eta`);
    const routeOf = (name) => {
      const member = members.find((m) => m.displayName === name);
      const line = etas.find((eta) => eta.memberId === member?.memberId)?.route;
      return line && decode(line);
    };
    const found = { priya: routeOf('Priya'), aman: routeOf('Aman') };
    if (found.priya && found.aman) return found;
    await sleep(1_500);
  }
  throw new Error('No routes: is MAPBOX_SERVER_TOKEN set in backend/.env.local?');
}
const way = await routes();
console.log(`   routes: Priya ${Math.round(length(way.priya))} m, Aman ${Math.round(length(way.aman))} m`);

const driven = { priya: 0, aman: 0 };
/** Moves both people along their routes for a while. */
async function drive(seconds) {
  const end = Date.now() + seconds * 1_000;
  while (Date.now() < end) {
    driven.priya += METRES_PER_SECOND;
    driven.aman += METRES_PER_SECOND;
    await moveTo(priya, along(way.priya, driven.priya));
    await moveTo(aman, along(way.aman, driven.aman));
    await sleep(1_000);
  }
}

console.log('3. On the way');
await record(() => drive(18), { speed: 4 });
await still('live-map-light', p);
await still('live-map-dark', a);

console.log('4. Chat');
await record(
  async () => {
    await p.getByRole('link', { name: /^Trip chat/ }).click();
    await p.getByPlaceholder('Message the group').pressSequentially('Meet at gate 2?', { delay: 55 });
    await p.getByRole('button', { name: 'Send', exact: true }).click();
    await sleep(700);
    await a.getByRole('link', { name: /^Trip chat/ }).click();
    await a.getByPlaceholder('Message the group').pressSequentially('Yes! Almost there', { delay: 55 });
    await a.getByRole('button', { name: 'Send', exact: true }).click();
    await sleep(900);
  },
  { speed: 1.3 },
);
await still('chat', a);
await p.goto(`/trip/${tripId}`);
await a.goto(`/trip/${tripId}`);
await sleep(4_000);

console.log('5. Aman arrives');
const seconds = Math.ceil(Math.max(0, length(way.aman) - driven.aman) / METRES_PER_SECOND) + 2;
if (seconds > 20) await drive(seconds - 16);
await record(() => drive(Math.min(seconds, 16)), { speed: 4 });
// The app waits 20 seconds at the spot before it says someone arrived: off camera.
const center = { latitude: trip.destination.lat, longitude: trip.destination.lng };
for (let i = 0; i < 40 && !a.url().endsWith('/arrived'); i++) {
  // A small wobble, as a real phone has, keeps readings coming.
  await moveTo(aman, { ...center, latitude: center.latitude + (i % 2 ? 0.00012 : -0.00012) });
  await sleep(3_000);
}
await record(() => a.getByRole('heading', { name: 'You made it!' }).waitFor(), { tail: 2_500 });

console.log('6. Priya ends the trip');
await record(
  async () => {
    await p.getByLabel('Trip menu').click();
    await sleep(900);
    await p.getByRole('button', { name: 'End trip for everyone' }).click();
    await sleep(900);
    await p.getByRole('button', { name: 'End trip', exact: true }).click();
    await p.waitForURL(/\/ended$/);
    await sleep(2_000);
  },
  { speed: 1.4, tail: 2_000 },
);
await browser.close();

/* ---- Putting it together --------------------------------------------------------------------- */

const WIDTH = SHOWN.width * 2 + GAP * 3;
const HEIGHT = SHOWN.height + GAP * 2;
const corners = Buffer.from(
  `<svg width="${SHOWN.width}" height="${SHOWN.height}"><rect width="100%" height="100%" rx="28"/></svg>`,
);
const screen = (png) =>
  sharp(png)
    .resize(SHOWN.width, SHOWN.height)
    .composite([{ input: corners, blend: 'dest-in' }])
    .png()
    .toBuffer();

const pictures = [];
for (const frame of frames) {
  const [left, right] = await Promise.all([screen(frame.left), screen(frame.right)]);
  const base = sharp({ create: { width: WIDTH, height: HEIGHT, channels: 3, background: '#DDE7F5' } });
  pictures.push(
    await base
      .composite([
        { input: left, left: GAP, top: GAP },
        { input: right, left: GAP * 2 + SHOWN.width, top: GAP },
      ])
      .png()
      .toBuffer(),
  );
}
const delay = frames.map((frame) => Math.max(40, frame.ms));
const result = await sharp(pictures, { join: { animated: true } })
  .gif({ delay, loop: 0, effort: 10, interFrameMaxError: 6, interPaletteMaxError: 20 })
  .toFile(`${OUT}demo.gif`);
const total = Math.round(delay.reduce((sum, ms) => sum + ms, 0) / 1_000);
console.log(`demo.gif: ${frames.length} frames, ${total} s, ${(result.size / 1e6).toFixed(1)} MB`);
