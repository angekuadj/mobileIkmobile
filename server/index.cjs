const { createServer } = require('node:http');
const path = require('node:path');
const dotenv = require('dotenv');
const {
  buildAutomaticCoupon,
  buildCoupon,
  isRiskLevel,
} = require('./coupons.cjs');
const {
  validDate,
  loadFotMobDay,
  loadFotMobDateRange,
  loadFotMobDetails,
  statsResponse,
} = require('./fotmob.cjs');

dotenv.config({ path: path.join(__dirname, '.env') });

const port = Number(process.env.PORT || 4000);
const host = process.env.HOST || '0.0.0.0';
const allowedOrigins = (
  process.env.ALLOWED_ORIGINS
  || 'http://localhost:8081,http://localhost:4174,http://localhost:19006,http://192.168.1.50:8081,http://192.168.1.50:4174'
)
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

function sendJson(response, status, payload) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    ...(response.requestOrigin ? { 'Access-Control-Allow-Origin': response.requestOrigin } : {}),
  });
  response.end(JSON.stringify(payload));
}

async function readJson(request) {
  let body = '';
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 1_000_000) {
      throw Object.assign(new Error('Request body too large.'), { status: 413 });
    }
  }
  try {
    return JSON.parse(body);
  } catch {
    throw Object.assign(new Error('Invalid JSON request body.'), { status: 400 });
  }
}

async function mapInBatches(values, batchSize, callback) {
  const results = [];
  for (let index = 0; index < values.length; index += batchSize) {
    results.push(...await Promise.all(values.slice(index, index + batchSize).map(callback)));
  }
  return results;
}

async function loadDetailsForFixtures(fixtures, skipFailures = false) {
  const results = await mapInBatches(fixtures, 5, async fixture => {
    try {
      return { fixture, details: await loadFotMobDetails(fixture.id) };
    } catch (error) {
      if (!skipFailures) throw error;
      console.error(`Could not load FotMob details for match ${fixture.id}.`, error);
      return null;
    }
  });
  return results.filter(Boolean);
}

function attachCardStats(fixture, details) {
  const get = label => details.stats.get(label);
  const count = label => {
    const values = get(label);
    return values && {
      home: Number.parseInt(values.home, 10) || 0,
      away: Number.parseInt(values.away, 10) || 0,
    };
  };
  const yellowCards = count('yellow cards');
  const redCards = count('red cards');
  const corners = count('corners');
  const matchStats = {};
  if (yellowCards) matchStats.yellowCards = yellowCards;
  if (redCards) matchStats.redCards = redCards;
  if (corners) matchStats.corners = corners;
  if (Object.keys(matchStats).length === 0) return fixture;
  return { ...fixture, matchStats };
}

function isLiveFixture(fixture) {
  const status = fixture.status?.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase('fr-FR');
  return ['en direct', 'en live', 'mi-temps', 'live'].includes(status);
}

async function handleCouponSuggestion(request, response) {
  const payload = await readJson(request);
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    sendJson(response, 400, { error: 'Invalid request body.' });
    return;
  }

  if (payload.mode === 'auto') {
    const { from, count, riskLevel = 'very-safe', excludeFixtureIds = [], includeLive = false, randomize = false } = payload;
    if (!validDate(from) || !Number.isInteger(count) || count < 1 || count > 20
      || !isRiskLevel(riskLevel) || !Array.isArray(excludeFixtureIds)
      || !excludeFixtureIds.every(id => typeof id === 'string' && id.length > 0)
      || typeof includeLive !== 'boolean' || typeof randomize !== 'boolean') {
      sendJson(response, 400, { error: 'Provide a valid start date, event count, risk level, and excluded fixture IDs.' });
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
    if (from < today) {
      sendJson(response, 400, { error: 'The start date must be today or later.' });
      return;
    }
    const throughDate = new Date(`${from}T00:00:00.000Z`);
    throughDate.setUTCDate(throughDate.getUTCDate() + 6);
    const fixtures = (await loadFotMobDateRange(from, throughDate.toISOString().slice(0, 10)))
      .filter(fixture => fixture.date >= today
        && (fixture.status === 'Prévu' || (includeLive && fixture.date === today && isLiveFixture(fixture))))
      .slice(0, Math.min(100, Math.max(20, count * 4)));
    const loaded = await loadDetailsForFixtures(fixtures, true);
    const coupon = buildAutomaticCoupon(loaded, count, riskLevel, excludeFixtureIds, randomize);
    sendJson(response, 200, { coupon });
    return;
  }

  const fixtureIds = payload.fixtureIds;
  const riskLevel = payload.riskLevel || 'medium';
  const couponCount = payload.couponCount === undefined ? 3 : payload.couponCount;
  const regenerate = payload.regenerate === true;
  const includeLive = payload.includeLive === true;
  if (!Array.isArray(fixtureIds) || fixtureIds.length < 1 || fixtureIds.length > 20
    || !fixtureIds.every(id => typeof id === 'string' && /^\d{1,20}$/.test(id))
    || new Set(fixtureIds).size !== fixtureIds.length) {
    sendJson(response, 400, { error: 'Choose between 1 and 20 unique FotMob fixtures.' });
    return;
  }
  if (!isRiskLevel(riskLevel) || !Number.isInteger(couponCount) || couponCount < 1 || couponCount > 50
    || (payload.regenerate !== undefined && typeof payload.regenerate !== 'boolean')
    || (payload.includeLive !== undefined && typeof payload.includeLive !== 'boolean')) {
    sendJson(response, 400, { error: 'Provide a valid risk level, coupon count, and regenerate flag.' });
    return;
  }

  const results = await mapInBatches(fixtureIds, 5, async id => {
    const details = await loadFotMobDetails(id);
    return { fixture: details.fixture, details };
  });
  const today = new Date().toISOString().slice(0, 10);
  if (results.some(({ fixture }) => fixture.date < today
    || (fixture.status !== 'Prévu' && !(includeLive && isLiveFixture(fixture))))) {
    sendJson(response, 400, { error: 'Combinations require upcoming fixtures or live fixtures when enabled.' });
    return;
  }
  sendJson(response, 200, { coupons: buildCoupon(
    results.map(result => result.fixture),
    results.map(result => result.details),
    riskLevel,
    couponCount,
    regenerate
  ) });
}

async function handleRequest(request, response) {
  const origin = request.headers.origin;
  if (origin && !allowedOrigins.includes(origin)) {
    sendJson(response, 403, { error: 'Origin is not allowed.' });
    return;
  }
  response.requestOrigin = origin;

  if (request.method === 'OPTIONS') {
    response.writeHead(204, {
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      ...(origin ? { 'Access-Control-Allow-Origin': origin } : {}),
    });
    response.end();
    return;
  }

  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
  try {
    if (request.method === 'GET' && url.pathname === '/api/health') {
      sendJson(response, 200, { status: 'ok', service: 'ikprono-mobile-api', dataSource: 'fotmob' });
      return;
    }

    if (request.method === 'GET' && url.pathname === '/api/sports/fixtures') {
      const from = url.searchParams.get('from') || '';
      const to = url.searchParams.get('to') || from;
      if (!validDate(from) || !validDate(to) || to < from) {
        sendJson(response, 400, { error: 'Provide valid from and to dates in YYYY-MM-DD format.' });
        return;
      }
      const sport = url.searchParams.get('sport') || 'football';
      if (sport !== 'all' && sport !== 'football') {
        sendJson(response, 400, { error: 'FotMob match data is available for football only.' });
        return;
      }
      const fixtures = await loadFotMobDateRange(from, to);
      sendJson(response, 200, { fixtures, errors: {}, source: 'fotmob' });
      return;
    }

    if (request.method === 'GET' && url.pathname === '/api/sports/fixtures/live') {
      const today = new Date().toISOString().slice(0, 10);
      const dayFixtures = await loadFotMobDay(today);
      const liveFixtures = dayFixtures.filter(fixture => fixture.status === 'En direct');
      const details = await loadDetailsForFixtures(liveFixtures, true);
      const statsById = new Map(details.map(({ fixture, details: matchDetails }) =>
        [fixture.id, attachCardStats(fixture, matchDetails)]
      ));
      sendJson(response, 200, {
        fixtures: liveFixtures.map(fixture => statsById.get(fixture.id) || fixture),
        liveAvailable: true,
        source: 'fotmob',
      });
      return;
    }

    if (request.method === 'GET' && url.pathname === '/api/sports/fixtures/status') {
      const ids = (url.searchParams.get('ids') || '').split(',').filter(Boolean);
      if (ids.length < 1 || ids.length > 100
        || ids.some(id => !/^\d{1,20}$/.test(id))
        || new Set(ids).size !== ids.length) {
        sendJson(response, 400, { error: 'Provide between 1 and 100 unique FotMob fixture IDs.' });
        return;
      }
      const details = await mapInBatches(ids, 5, loadFotMobDetails);
      sendJson(response, 200, {
        fixtures: details.map(details => attachCardStats(details.fixture, details)),
        source: 'fotmob',
      });
      return;
    }

    const statsMatch = url.pathname.match(/^\/api\/football\/fixtures\/([^/]+)\/statistics$/);
    if (request.method === 'GET' && statsMatch) {
      const details = await loadFotMobDetails(decodeURIComponent(statsMatch[1]));
      sendJson(response, 200, statsResponse(details));
      return;
    }

    if (request.method === 'POST' && url.pathname === '/api/coupons/suggest') {
      await handleCouponSuggestion(request, response);
      return;
    }

    sendJson(response, 404, { error: 'API route not found.' });
  } catch (error) {
    const status = Number.isInteger(error.status)
      ? error.status
      : error.message.includes('limited to 31 days') ? 422 : 502;
    console.error('FotMob API request failed:', error);
    sendJson(response, status, { error: error.message || 'Unable to load data from FotMob.' });
  }
}

const server = createServer((request, response) => {
  void handleRequest(request, response);
});

server.listen(port, host, () => {
  console.log(`IKProno Mobile API listening on http://${host}:${port} (FotMob source; no database)`);
});

function shutdown() {
  server.close(error => {
    if (error) {
      console.error('Could not shut down the mobile API cleanly:', error);
      process.exitCode = 1;
    }
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
