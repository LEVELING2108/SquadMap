// Live map load test: many trips, each with a host and guests sending their location every 2 seconds over
// the live connection. Measures how long an update takes to come back from the server (sent, stored,
// relayed through Redis and broadcast), against the target in docs/07: p95 under 3 s, errors under 0.5%.
//
// For a local or staging stack only: it signs up one account per trip and joins guests.
//
//   k6 run infra/k6/ws-load.js                                   # 5 trips x 10 people for 2 minutes
//   k6 run -e TRIPS=200 -e MEMBERS=10 -e DURATION=15m infra/k6/ws-load.js
//   k6 run -e BASE=https://staging.example.com infra/k6/ws-load.js
//
// Sign-ups and joins are rate limited per address, so setup gives each person a different X-Forwarded-For
// address. That works against a backend reached directly; behind a proxy that sets the header itself, run
// setup from several machines or raise the limits on the test stack instead.
import http from 'k6/http';
import ws from 'k6/ws';
import { check, fail } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

const BASE = __ENV.BASE || 'http://localhost:8480';
const TRIPS = Number(__ENV.TRIPS || 5);
const MEMBERS = Number(__ENV.MEMBERS || 10);
const DURATION = __ENV.DURATION || '2m';
const SEND_EVERY_S = 2;

const roundTrip = new Trend('location_round_trip', true);
const refused = new Rate('location_refused');
const received = new Counter('locations_received');

export const options = {
  setupTimeout: '15m',
  scenarios: {
    members: {
      executor: 'per-vu-iterations',
      vus: TRIPS * MEMBERS,
      iterations: 1,
      maxDuration: `${durationSeconds(DURATION) + 120}s`,
    },
  },
  thresholds: {
    location_round_trip: ['p(95)<3000'],
    location_refused: ['rate<0.005'],
  },
};

function durationSeconds(text) {
  const match = /^(\d+)(s|m|h)$/.exec(text);
  if (!match) return 120;
  return Number(match[1]) * { s: 1, m: 60, h: 3600 }[match[2]];
}

function fakeAddress(n) {
  return `10.${(n >> 16) & 255}.${(n >> 8) & 255}.${n & 255}`;
}

function post(path, body, headers = {}) {
  return http.post(`${BASE}/api/v1${path}`, body === null ? null : JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

/** One trip per TRIPS: a host who agreed to share, and MEMBERS - 1 guests who joined sharing. */
export function setup() {
  const run = Date.now();
  const trips = [];
  let address = 1;
  for (let t = 0; t < TRIPS; t += 1) {
    const signup = post(
      '/auth/signup',
      { name: `Host ${t}`, email: `load-${run}-${t}@squadmap.test`, password: 'load test password', acceptedTerms: true },
      { 'X-Forwarded-For': fakeAddress(address++) },
    );
    if (signup.status !== 201 && signup.status !== 200) fail(`sign-up failed: ${signup.status}`);
    const host = signup.json('accessToken');
    const auth = { Authorization: `Bearer ${host}` };
    const trip = post('/trips', { name: `Load ${t}`, shareHours: 1, chatEnabled: false }, auth);
    if (trip.status !== 201) fail(`trip failed: ${trip.status}`);
    const tripId = trip.json('id');
    post(`/trips/${tripId}/sharing`, null, auth);
    const tokens = [host];
    for (let m = 1; m < MEMBERS; m += 1) {
      const join = post(
        `/join/${trip.json('code')}`,
        { displayName: `Guest ${m}`, shareLocation: true },
        { 'X-Forwarded-For': fakeAddress(address++) },
      );
      if (join.status !== 201) fail(`join failed: ${join.status}`);
      tokens.push(join.json('accessToken'));
    }
    trips.push({ tripId, tokens });
  }
  return { trips };
}

function frame(command, headers, body = '') {
  const lines = Object.entries(headers).map(([key, value]) => `${key}:${value}`);
  return `${command}\n${lines.join('\n')}\n\n${body}\0`;
}

function parse(data) {
  const [head, ...rest] = data.replace(/^\n+/, '').split('\n\n');
  const [command, ...lines] = head.split('\n');
  const headers = {};
  for (const line of lines) headers[line.slice(0, line.indexOf(':'))] = line.slice(line.indexOf(':') + 1);
  return { command, headers, body: rest.join('\n\n').replace(/\0$/, '') };
}

export default function (data) {
  const vu = __VU - 1;
  const trip = data.trips[Math.floor(vu / MEMBERS)];
  const token = trip.tokens[vu % MEMBERS];
  const url = `${BASE.replace(/^http/, 'ws')}/ws/websocket`;
  // Everyone starts somewhere in Pune and walks a little each time.
  let lat = 18.52 + Math.random() * 0.05;
  let lng = 73.85 + Math.random() * 0.05;
  const sentAt = {};
  let memberId = null;

  const response = ws.connect(url, {}, (socket) => {
    socket.on('open', () => {
      socket.send(frame('CONNECT', { 'accept-version': '1.2', 'heart-beat': '10000,10000', Authorization: `Bearer ${token}` }));
    });
    socket.on('message', (raw) => {
      if (raw === '\n') return;
      const message = parse(raw);
      if (message.command === 'CONNECTED') {
        socket.send(frame('SUBSCRIBE', { id: 'loc', destination: `/topic/trip.${trip.tripId}.locations` }));
        socket.send(frame('SUBSCRIBE', { id: 'err', destination: '/user/queue/errors' }));
        socket.setInterval(() => {
          lat += (Math.random() - 0.5) * 0.0004;
          lng += (Math.random() - 0.5) * 0.0004;
          const ts = new Date().toISOString();
          sentAt[ts] = Date.now();
          const body = JSON.stringify({ lat, lng, acc: 10, ts });
          socket.send(frame('SEND', { destination: `/app/trip.${trip.tripId}.loc`, 'content-type': 'application/json' }, body));
        }, SEND_EVERY_S * 1000);
      } else if (message.command === 'MESSAGE' && message.headers.subscription === 'loc') {
        received.add(1);
        const update = JSON.parse(message.body);
        // Our own update coming back: the full trip through the server.
        if (sentAt[update.ts] !== undefined && (memberId === null || memberId === update.memberId)) {
          memberId = update.memberId;
          roundTrip.add(Date.now() - sentAt[update.ts]);
          refused.add(false);
          delete sentAt[update.ts];
        }
      } else if (message.command === 'MESSAGE' && message.headers.subscription === 'err') {
        refused.add(true);
      } else if (message.command === 'ERROR') {
        refused.add(true);
        socket.close();
      }
    });
    socket.setTimeout(() => socket.close(), durationSeconds(DURATION) * 1000);
  });
  check(response, { 'live connection opened': (r) => r && r.status === 101 });
}
